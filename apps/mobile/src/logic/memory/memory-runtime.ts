import {
  CATALOG,
  CURR_TELEMETRY_PAYLOADS,
  ROLLUP_SEEDED_COUNT_EDGES,
  ROLLUP_SPREAD_DAYS_EDGES,
  rollupBucketCode,
  type MemoryBackup,
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
import { answeredByShard, emptyMemoryFile, foldStates, holdsStates, laySeed, pushBatches, readMemoryFile, sameState, type MemoryFile } from './memory-file';
import { buildLookup, cellOfEpisode, resolveItems, resolveRound, shardOf, type ItemLookup } from './resolve';
import { MEMORY_KEY } from './keys';
import { deriveSeed } from './seed';
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
 * that could not be read is never written over. Network calls run outside the chain, so a slow
 * request never holds an answer back.
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
  sync(profileId: string): Promise<void>;
  pull(learnerId: string, from?: number): Promise<void>;
  backup(profileId: string): Promise<MemoryBackup | undefined>;
  restore(profileId: string, memory: MemoryBackup): Promise<void>;
  flush(profileId: string): Promise<void>;
  forget(profileId: string): void;
  /** Tests and later rows: the store as held in memory (read first when needed). */
  file(profileId: string): Promise<MemoryFile | null>;
}

const VOCAB_ID = /^vocab:/;
const PULL_PAGES = 5;

/** The rung a word question asked: heard to picture is recognize, the rest read (F-VOC-005 formats). */
const rungOfVocab = (format: string | undefined): Rung => (format === 'audio-to-image' ? 'recognize' : 'read');

export function createMemoryRuntime(deps: MemoryRuntimeDeps): MemoryRuntime {
  const cache = new Map<string, MemoryFile>();
  const chains = new Map<string, Promise<unknown>>();
  const timers = new Map<string, unknown>();
  const removed = new Set<string>();
  const scopeLimited = new Set<string>();
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
    const file = raw === null || raw === undefined ? emptyMemoryFile() : readMemoryFile(raw);
    cache.set(profileId, file);
    return file;
  }

  async function saveNow(profileId: string): Promise<void> {
    const timer = timers.get(profileId);
    if (timer !== undefined) deps.clearTimer(timer);
    timers.delete(profileId);
    const file = cache.get(profileId);
    if (!file || gone(profileId)) return;
    await deps.write(MEMORY_KEY(profileId), file).catch(() => undefined);
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
        const iso = at.toISOString();
        const counts = today(profileId, file, day, index.retired);
        const pending = new Set(file.pending);
        for (const a of rest) {
          const item = index.byId.get(a.itemId);
          if (!item || index.retired.has(item.id)) continue;
          const row = file.rows[item.id];
          const out = applyAnswer(row?.st, row ?? {}, a, day, iso);
          file.rows[item.id] = { sh: row?.sh ?? shardOf(item), st: out.state, ...out.facts };
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

  async function pullNow(learnerId: string, net: MemoryNet, creds: { deviceId: string; secret: string }): Promise<void> {
    for (let page = 0; page < PULL_PAGES; page += 1) {
      const file = await run(learnerId, () => load(learnerId));
      if (!file) return;
      const since = file.cursor;
      let body: unknown;
      try {
        const res = await net.fetch(`${net.base}/api/sync/learners/${encodeURIComponent(learnerId)}/memory?since=${since}`, {
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
      if (shards.length === 0 || cursor <= since) return;
    }
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

  return {
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
              const lagDays = spaced && was ? Math.max(0, daysBetween(facts.p ?? was.first, day)) : null;
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
        const held = snap.memSeededAt;
        if (held !== undefined && file.seededFrom === held) return;
        const { index } = await items();
        const derive = (seededAt: string) =>
          deriveSeed({ snapshot: snap, items: index.items, retired: index.retired, quests: CATALOG.quests, cells: CATALOG.cells, seededAt, dayOf: deps.dayOf });
        let seededFrom = held ?? deps.now().toISOString();
        let seed = derive(seededFrom);
        if (held === undefined) {
          const latched = deps.applySeed(profileId, { memSeededAt: seededFrom, cellBest: seed.cellBest });
          if (latched === null) return;
          if (latched === seededFrom) {
            const payload = CURR_TELEMETRY_PAYLOADS['items.seeded'].safeParse({
              countBucket: rollupBucketCode(seed.count, ROLLUP_SEEDED_COUNT_EDGES),
              spreadDaysBucket: rollupBucketCode(seed.spreadDays, ROLLUP_SPREAD_DAYS_EDGES),
            });
            if (payload.success) deps.track({ name: 'items.seeded', profileId, payload: payload.data });
          } else {
            seededFrom = latched;
            seed = derive(seededFrom);
          }
        }
        laySeed(file, seed.states, seededFrom);
        markDirty(profileId);
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

    sync: (profileId) => syncNow(profileId),

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

    async restore(profileId, memory) {
      removed.delete(profileId);
      await run(profileId, async () => {
        const file = await load(profileId);
        if (!file) return;
        if (foldStates(file, memory, true).length > 0) await saveNow(profileId);
      });
      deps.requestSync(profileId);
    },

    async flush(profileId) {
      await run(profileId, () => saveNow(profileId));
      await syncNow(profileId);
    },

    forget(profileId) {
      removed.add(profileId);
      const timer = timers.get(profileId);
      if (timer !== undefined) deps.clearTimer(timer);
      timers.delete(profileId);
      cache.delete(profileId);
      scopeLimited.delete(profileId);
      deps.remove(MEMORY_KEY(profileId)).catch(() => undefined);
    },

    file: (profileId) => run(profileId, () => load(profileId)),
  };
}
