import {
  CATALOG,
  CURR_TELEMETRY_PAYLOADS,
  ROLLUP_SEEDED_COUNT_EDGES,
  ROLLUP_SPREAD_DAYS_EDGES,
  rollupBucketCode,
  type MemoryBackup,
  type MemorySummary,
  type ProgressSnapshot,
  type VocabProgress,
} from '@hangul-route/content-schema';
import { MemoryPullSchema } from '@hangul-route/content-schema/memory';
import type { FirstRoundAnswer } from '../../store/quest-run-store';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { ReviewItemIndex } from '../reviews/review-items-store';
import { applyVocabEvents, vocabOf, type VocabEvent } from '../vocab/progress';
import { daysBetween, isDue } from '../vocab/srs';
import { countAnswer, durableWeek, memoryDailyPayload, openDay, studyMinutes } from './daily';
import { answeredByShard, emptyMemoryFile, foldStates, holdsStates, laySeed, pushBatches, readMemoryFile, readableStore, sameState, storedFile, type MemoryFile } from './memory-file';
import { buildLookup, cellOfEpisode, resolveItems, resolveRound, shardOf, type ItemLookup } from './resolve';
import { MEMORY_KEY } from './keys';
import { deriveSeed, seedInputKey } from './seed';
import { memorySummaryOf } from './summary';
import { DURABLE_LAG_DAYS, applyAnswer, isItemDue, type Rung } from './spacing';

/**
 * The memory store at runtime (F-CURR-002 sections 4.3, 4.8, 4.9, 11.3 and 12.3, row CM-12). A
 * chunk of its own, loaded the first time the boot module (`./boot.ts`, in the start bundle) needs
 * it, so the start bundle does not grow by the scheduler, the seeding or the sync code.
 *
 * Shadow mode (section 12.3): it records answers, seeds existing learners, syncs the answered states
 * and sends `memory.daily`, and nothing a learner sees reads it yet. The boot module calls it only
 * while `memoryRecord` is on for a learner profile; a grown-up persona never records (section 4.9).
 *
 * Every operation on a profile runs one after another (a chain per profile), on the stored value
 * `memory:<profileId>` held in memory once read. Writes are coalesced and saved shortly after; a
 * profile switch saves the outgoing profile's store and starts its push at once (`flush`). A store
 * that could not be read, or whose stored value is damaged, is never written over. Network calls run
 * outside the chain, so a slow request never holds an answer back.
 *
 * Seeded states (`n` = 0) are never stored or sent: each read of the store derives them again from
 * the snapshot (`questDoneAt`, the stars, the placements, `memSeededAt`), and they are derived again
 * whenever those inputs change (`seedInputKey`: a sync brought older quests, a placement or a higher
 * star count), so two devices of one learner end with the same seeded states whatever their snapshot
 * held when each first seeded. A learner registered for sync latches `memSeededAt` only after this
 * device's first successful snapshot sync of the session, so a stale or blank local snapshot never
 * latches a wrong seeding.
 */

/** One answer the review surfaces (warm-up, Daily Review, Checks; rows CM-14, CM-15, CM-21, CM-22) record. */
export interface MemoryAnswer {
  itemId: string;
  correct: boolean;
  hinted?: boolean;
  rung: Rung;
}

export interface MemoryNet {
  base: string;
  fetch: typeof fetch;
  /** The device credentials of a learner registered on the server, or null. */
  creds(learnerId: string): Promise<{ deviceId: string; secret: string } | null>;
}

export interface MemoryRuntimeDeps {
  now(): Date;
  dayOf(instant: Date): string;
  items(): Promise<ReviewItemIndex>;
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  hydrate(profileId: string): Promise<void>;
  snapshot(profileId: string): ProgressSnapshot | undefined;
  applySeed(profileId: string, seed: { memSeededAt: string; cellBest: Readonly<Record<string, 1>> }): string | null;
  recordVocab(profileId: string, events: readonly VocabEvent[], now: Date): void;
  /** The server time of the learner's last snapshot sync (the inbox's `serverTime`), or null: the stamp cap of CM-11's hand-off. */
  serverTime?(profileId: string): string | null;
  /** Whether the profile is on this device (a removed learner restored by its Rescue Code comes back). */
  profileHere(profileId: string): boolean;
  track(event: TelemetryEvent): void;
  requestSync(profileId: string): void;
  net(): MemoryNet | null;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  saveDelayMs?: number;
}

export interface MemoryRuntime {
  recordRound(profileId: string, answer: FirstRoundAnswer): Promise<void>;
  recordAnswers(profileId: string, answers: readonly MemoryAnswer[], at: Date): Promise<void>;
  countVocab(profileId: string, before: VocabProgress, events: readonly VocabEvent[], clock: Date): Promise<void>;
  ensureSeeded(profileId: string): Promise<void>;
  sendDailyIfDue(profileId: string): Promise<void>;
  /** After a successful snapshot sync of the learner: the seeding (the first latch waits for this), then the push and the pull. */
  sync(profileId: string): Promise<void>;
  pull(learnerId: string, from?: number): Promise<void>;
  backup(profileId: string): Promise<MemoryBackup | undefined>;
  /** Folds a backup file's states in; with `send` (the profile records now) they are queued for the server too. */
  restore(profileId: string, memory: MemoryBackup, send?: boolean): Promise<void>;
  /** Saves the store at once; with `send` (the profile records now) starts its push and pull. */
  flush(profileId: string, send?: boolean): Promise<void>;
  forget(profileId: string): void;
  /** Tests and later rows: the store as held in memory (read first when needed). */
  file(profileId: string): Promise<MemoryFile | null>;
  /**
   * The summary's `memory` block today (row CM-16, `./summary.ts`), after every earlier operation on the profile;
   * undefined while the store or the snapshot cannot be read.
   */
  summary(profileId: string): Promise<MemorySummary | undefined>;
}

const VOCAB_ID = /^vocab:/;
/** How far past the latest stamp in the store a new stamp may be (as the word slice's clamp, F-VOC-005 section 3.3). */
const STAMP_CLAMP_MS = 24 * 60 * 60 * 1000;

/**
 * The schedule stamp `at` of an answer at `at`: the device clock, but never more than a day past the
 * later of the last server time seen (the learner's last snapshot sync, CM-11's hand-off) and the
 * latest stamp the store holds (every state pulled from the server, so a real later answer from
 * another device is never stamped over), so a device clock set far ahead cannot make its schedule win
 * every merge for long (CM-11's `boundMemoryStateToNow` holds the server side, also when nothing has
 * been seen yet). The local day of the answer is never clamped.
 */
export function stampOf(file: Pick<MemoryFile, 'rows'>, at: Date, serverTime: string | null = null): string {
  let latest = serverTime === null ? Number.NEGATIVE_INFINITY : Date.parse(serverTime);
  if (!Number.isFinite(latest)) latest = Number.NEGATIVE_INFINITY;
  for (const row of Object.values(file.rows)) {
    const t = Date.parse(row.st.at);
    if (t > latest) latest = t;
  }
  const ms = at.getTime();
  return new Date(Number.isFinite(latest) && ms > latest + STAMP_CLAMP_MS ? latest + STAMP_CLAMP_MS : ms).toISOString();
}

/** The rung a word question asked: heard to picture is recognize, the rest read (F-VOC-005 formats). */
const rungOfVocab = (format: string | undefined): Rung => (format === 'audio-to-image' ? 'recognize' : 'read');

export function createMemoryRuntime(deps: MemoryRuntimeDeps): MemoryRuntime {
  const cache = new Map<string, MemoryFile>();
  const chains = new Map<string, Promise<unknown>>();
  const timers = new Map<string, unknown>();
  const removed = new Set<string>();
  const scopeLimited = new Set<string>();
  /** The seed inputs whose derivation is laid in the store held in memory, per profile. */
  const laid = new Map<string, string>();
  /** Profiles with a successful snapshot sync this session. */
  const synced = new Set<string>();
  let lookup: { index: ReviewItemIndex; lookup: ItemLookup } | null = null;

  const gone = (profileId: string): boolean => removed.has(profileId) && !deps.profileHere(profileId);

  /** Runs `fn` after every earlier operation on the profile; a failure never blocks the next. */
  function run<T>(profileId: string, fn: () => Promise<T>): Promise<T> {
    const prev = chains.get(profileId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    chains.set(
      profileId,
      next.catch(() => undefined),
    );
    return next;
  }

  /**
   * Lays the seeded states derived from the snapshot's seeding over the store held in memory, when
   * their inputs changed since the last time (or were never laid since the read). Returns whether
   * the seeding the store was derived from moved (`seededFrom`, which is stored).
   */
  async function relay(profileId: string, file: MemoryFile): Promise<boolean> {
    await deps.hydrate(profileId);
    const snap = deps.snapshot(profileId);
    const seededAt = snap?.memSeededAt ?? file.seededFrom;
    if (!snap || seededAt === null || seededAt === undefined) return false;
    const { index } = await items();
    const inputs = { snapshot: snap, items: index.items, retired: index.retired, quests: CATALOG.quests, seededAt, dayOf: deps.dayOf };
    const key = seedInputKey(inputs);
    if (laid.get(profileId) === key && file.seededFrom === seededAt) return false;
    const moved = file.seededFrom !== seededAt;
    laySeed(file, deriveSeed({ ...inputs, cells: CATALOG.cells }).states, seededAt);
    laid.set(profileId, key);
    return moved;
  }

  async function load(profileId: string): Promise<MemoryFile | null> {
    if (gone(profileId)) return null;
    const held = cache.get(profileId);
    if (held) return held;
    let raw: unknown;
    try {
      raw = await deps.read(MEMORY_KEY(profileId));
    } catch {
      return null;
    }
    // A damaged value (not JSON, or not an object) is neither read as empty nor written over.
    if (!readableStore(raw)) return null;
    const file = raw === null || raw === undefined ? emptyMemoryFile() : readMemoryFile(raw);
    // The seeded states are not stored: derive them before anything reads the store.
    await relay(profileId, file);
    if (gone(profileId)) return null;
    cache.set(profileId, file);
    return file;
  }

  async function saveNow(profileId: string): Promise<void> {
    const timer = timers.get(profileId);
    if (timer !== undefined) deps.clearTimer(timer);
    timers.delete(profileId);
    const file = cache.get(profileId);
    if (!file || gone(profileId)) return;
    await deps.write(MEMORY_KEY(profileId), storedFile(file)).catch(() => undefined);
  }

  function markDirty(profileId: string): void {
    if (timers.has(profileId)) return;
    timers.set(
      profileId,
      deps.setTimer(() => {
        timers.delete(profileId);
        void run(profileId, () => saveNow(profileId));
      }, deps.saveDelayMs ?? 400),
    );
  }

  async function items(): Promise<{ index: ReviewItemIndex; lookup: ItemLookup }> {
    const index = await deps.items();
    if (lookup?.index !== index) lookup = { index, lookup: buildLookup(index.items, index.retired) };
    return lookup;
  }

  /** The due pool now: memory items and topic words due on `day`. */
  function duePool(file: MemoryFile, profileId: string, day: string, retired: ReadonlySet<string>): number {
    let n = 0;
    for (const [id, row] of Object.entries(file.rows)) if (!retired.has(id) && isItemDue(row.st, day)) n += 1;
    const snap = deps.snapshot(profileId);
    if (snap) for (const s of vocabOf(snap).items) if (isDue(s, day)) n += 1;
    return n;
  }

  /** Sends the counted day if it is not sent yet (once a local day), then forgets it. */
  function sendDay(profileId: string, file: MemoryFile): void {
    const day = file.day;
    file.day = null;
    if (!day || file.dailySent === day.day) return;
    const snap = deps.snapshot(profileId);
    const payload = memoryDailyPayload(day, durableWeek(file, day.day), studyMinutes(snap?.sessions ?? [], day.day));
    file.dailySent = day.day;
    if (payload) deps.track({ name: 'memory.daily', profileId, payload });
  }

  /** Today's counts, opening the day (and sending the last one) when the local day turned. */
  function today(profileId: string, file: MemoryFile, day: string, retired: ReadonlySet<string>): NonNullable<MemoryFile['day']> {
    if (file.day && file.day.day !== day) sendDay(profileId, file);
    file.day ??= openDay(day, duePool(file, profileId, day, retired));
    return file.day;
  }

  /** Answers to topic words go to the `vocab` slice, for words the learner has collected (F-VOC-005 P7). */
  function vocabAnswers(profileId: string, answers: readonly MemoryAnswer[]): VocabEvent[] {
    const snap = deps.snapshot(profileId);
    const held = new Set(snap ? vocabOf(snap).items.map((s) => s.id) : []);
    return answers
      .filter((a) => VOCAB_ID.test(a.itemId) && held.has(a.itemId))
      .map((a) => ({ type: 'answer' as const, id: a.itemId, correct: a.correct, ...(a.hinted ? { hinted: true } : {}), source: 'review' as const }));
  }

  async function recordAnswersNow(profileId: string, answers: readonly MemoryAnswer[], at: Date): Promise<void> {
    const words = vocabAnswers(profileId, answers);
    const rest = answers.filter((a) => !VOCAB_ID.test(a.itemId));
    if (rest.length > 0) {
      await run(profileId, async () => {
        const file = await load(profileId);
        if (!file) return;
        const { index } = await items();
        const day = deps.dayOf(at);
        const iso = stampOf(file, at, deps.serverTime?.(profileId) ?? null);
        const counts = today(profileId, file, day, index.retired);
        const pending = new Set(file.pending);
        for (const a of rest) {
          const item = index.byId.get(a.itemId);
          if (!item || index.retired.has(item.id)) continue;
          const row = file.rows[item.id];
          const out = applyAnswer(row?.st, row ?? {}, a, day, iso);
          file.rows[item.id] = { sh: row?.sh ?? shardOf(item), st: out.state, ...out.facts };
          // A seeded item's first check moves its schedule but is not measured (`lagDays` null, no lapse).
          countAnswer(counts, { id: item.id, kind: item.kind, rung: a.rung, spaced: out.spaced, lagDays: out.lagDays, right: a.correct && !a.hinted, lapse: out.lapse, newHeld: out.newHeld });
          pending.add(item.id);
        }
        file.pending = [...pending];
        markDirty(profileId);
      });
      deps.requestSync(profileId);
    }
    // The word slice records through the progress store, which hands the answers back to `countVocab`.
    if (words.length > 0) deps.recordVocab(profileId, words, at);
  }

  /** One GET a sync: CM-11's route is not paged (every shard above the cursor comes at once), and each GET writes the device's `lastSeenAt`. */
  async function pullNow(learnerId: string, net: MemoryNet, creds: { deviceId: string; secret: string }): Promise<void> {
    const file = await run(learnerId, () => load(learnerId));
    if (!file) return;
    let body: unknown;
    try {
      const res = await net.fetch(`${net.base}/api/sync/learners/${encodeURIComponent(learnerId)}/memory?since=${file.cursor}`, {
        method: 'GET',
        headers: { Authorization: `Device ${creds.deviceId}:${creds.secret}` },
      });
      if (res.status === 403) scopeLimited.add(learnerId);
      if (res.status !== 200) return;
      body = ((await res.json()) as { data?: unknown }).data;
    } catch {
      return;
    }
    const parsed = MemoryPullSchema.safeParse(body);
    if (!parsed.success) return;
    const { cursor, shards } = parsed.data;
    await run(learnerId, async () => {
      const held = await load(learnerId);
      if (!held) return;
      foldStates(held, Object.fromEntries(shards.map((s) => [s.shard, s.states])));
      held.cursor = cursor;
      markDirty(learnerId);
    });
  }

  async function syncNow(profileId: string): Promise<void> {
    const net = deps.net();
    if (!net || scopeLimited.has(profileId) || gone(profileId)) return;
    const creds = await net.creds(profileId);
    if (!creds) return;
    const batches = await run(profileId, async () => {
      const file = await load(profileId);
      return file ? pushBatches(file) : [];
    });
    for (const batch of batches) {
      let status: number;
      try {
        const res = await net.fetch(`${net.base}/api/sync/learners/${encodeURIComponent(profileId)}/memory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Device ${creds.deviceId}:${creds.secret}` },
          body: JSON.stringify({ shards: batch.shards }),
        });
        status = res.status;
      } catch {
        return;
      }
      // A class device keeps its memory on the device, like the rest of its progress (SEC-4).
      if (status === 403) {
        scopeLimited.add(profileId);
        return;
      }
      if (status !== 200) return;
      await run(profileId, async () => {
        const file = await load(profileId);
        if (!file) return;
        const sent = new Set(batch.ids.filter((id) => {
          const shard = file.rows[id]?.sh;
          const now = file.rows[id]?.st;
          const was = shard === undefined ? undefined : batch.shards[shard]?.[id];
          return now !== undefined && was !== undefined && sameState(now, was);
        }));
        file.pending = file.pending.filter((id) => !sent.has(id));
        markDirty(profileId);
      });
    }
    await pullNow(profileId, net, creds);
  }

  const api: MemoryRuntime = {
    async recordRound(profileId, answer) {
      const round = resolveRound(answer.asked);
      if (!round) return;
      const { lookup: l } = await items();
      const asked = resolveItems(l, cellOfEpisode(answer.episodeId), round);
      if (asked.length === 0) return;
      await recordAnswersNow(
        profileId,
        asked.map((item) => ({ itemId: item.id, correct: answer.correct, rung: round.rung })),
        answer.at,
      );
    },

    recordAnswers: (profileId, answers, at) => recordAnswersNow(profileId, answers, at),

    countVocab(profileId, before, events, clock) {
      return run(profileId, async () => {
        const file = await load(profileId);
        if (!file) return;
        const day = deps.dayOf(clock);
        const retired = (await items()).index.retired;
        const counts = today(profileId, file, day, retired);
        let v = before;
        for (const e of events) {
          const next = applyVocabEvents(v, [e], clock, { spacing: true });
          if (e.type === 'answer') {
            const was = v.items.find((s) => s.id === e.id);
            const now = next.items.find((s) => s.id === e.id);
            if (now) {
              const spaced = was !== undefined && was.last < day && isDue(was, day);
              const facts = { ...(file.vf[e.id] ?? {}), l: day };
              // With no spaced day on this device (answered on another one, or before CM-12), the lag runs from its last answer.
              const lagDays = spaced && was ? Math.max(0, daysBetween(facts.p ?? was.last, day)) : null;
              const right = e.correct && !e.hinted;
              if (spaced) facts.p = day;
              if (spaced && right && (lagDays ?? 0) >= DURABLE_LAG_DAYS) facts.w = day;
              file.vf[e.id] = facts;
              countAnswer(counts, {
                id: e.id,
                kind: 'lex',
                rung: rungOfVocab(e.format),
                spaced,
                lagDays,
                right,
                lapse: spaced && !e.correct,
                newHeld: (was?.bestBox ?? 0) < 3 && now.bestBox >= 3,
              });
            }
          }
          v = next;
        }
        markDirty(profileId);
      });
    },

    ensureSeeded(profileId) {
      return run(profileId, async () => {
        await deps.hydrate(profileId);
        const snap = deps.snapshot(profileId);
        const file = await load(profileId);
        if (!snap || !file) return;
        if (snap.memSeededAt === undefined) {
          // A learner registered for sync latches only after this device's first snapshot sync, so the seeding reads every quest the other devices finished.
          if (!synced.has(profileId)) {
            const net = deps.net();
            if (net !== null && (await net.creds(profileId).catch(() => null)) !== null) return;
          }
          const { index } = await items();
          const seededFrom = deps.now().toISOString();
          const seed = deriveSeed({ snapshot: snap, items: index.items, retired: index.retired, quests: CATALOG.quests, cells: CATALOG.cells, seededAt: seededFrom, dayOf: deps.dayOf });
          const latched = deps.applySeed(profileId, { memSeededAt: seededFrom, cellBest: seed.cellBest });
          if (latched === null) return;
          // Sent once, by the device that latched; a device that derives the seeding again never sends it.
          if (latched === seededFrom) {
            const payload = CURR_TELEMETRY_PAYLOADS['items.seeded'].safeParse({
              countBucket: rollupBucketCode(seed.count, ROLLUP_SEEDED_COUNT_EDGES),
              spreadDaysBucket: rollupBucketCode(seed.spreadDays, ROLLUP_SPREAD_DAYS_EDGES),
            });
            if (payload.success) deps.track({ name: 'items.seeded', profileId, payload: payload.data });
          }
        }
        if (await relay(profileId, file)) markDirty(profileId);
      });
    },

    sendDailyIfDue(profileId) {
      return run(profileId, async () => {
        const file = await load(profileId);
        if (!file?.day || file.day.day >= deps.dayOf(deps.now())) return;
        sendDay(profileId, file);
        markDirty(profileId);
      });
    },

    async sync(profileId) {
      synced.add(profileId);
      await api.ensureSeeded(profileId);
      await syncNow(profileId);
    },

    async pull(learnerId, from = 0) {
      const net = deps.net();
      if (!net) return;
      const creds = await net.creds(learnerId);
      if (!creds) return;
      scopeLimited.delete(learnerId);
      await run(learnerId, async () => {
        const file = await load(learnerId);
        if (file) file.cursor = from;
      });
      await pullNow(learnerId, net, creds);
    },

    backup(profileId) {
      return run(profileId, async () => {
        const file = await load(profileId);
        if (!file || !holdsStates(file)) return undefined;
        const out = answeredByShard(file);
        return Object.keys(out).length > 0 ? out : undefined;
      });
    },

    async restore(profileId, memory, send = true) {
      removed.delete(profileId);
      await run(profileId, async () => {
        const file = await load(profileId);
        if (!file) return;
        if (foldStates(file, memory, true).length > 0) await saveNow(profileId);
      });
      if (send) deps.requestSync(profileId);
    },

    async flush(profileId, send = true) {
      await run(profileId, () => saveNow(profileId));
      if (send) await syncNow(profileId);
    },

    forget(profileId) {
      removed.add(profileId);
      const timer = timers.get(profileId);
      if (timer !== undefined) deps.clearTimer(timer);
      timers.delete(profileId);
      cache.delete(profileId);
      laid.delete(profileId);
      synced.delete(profileId);
      scopeLimited.delete(profileId);
      deps.remove(MEMORY_KEY(profileId)).catch(() => undefined);
    },

    file: (profileId) => run(profileId, () => load(profileId)),

    summary(profileId) {
      return run(profileId, async () => {
        await deps.hydrate(profileId);
        const file = await load(profileId);
        const snapshot = deps.snapshot(profileId);
        if (!file || !snapshot) return undefined;
        const { index } = await items();
        return memorySummaryOf({ rows: file.rows, retired: index.retired, snapshot, today: deps.dayOf(deps.now()) });
      });
    },
  };
  return api;
}
