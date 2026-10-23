import { CURR_TELEMETRY_PAYLOADS, type MemoryItemState, type ProgressSnapshot, type VocabProgress } from '@hangul-route/content-schema';
import { mergeMemoryShard, withoutSeeded, type MemoryShardStates } from '@hangul-route/content-schema/memory';
import { describe, expect, it } from 'vitest';
import type { MinigameScope } from '../../minigame-config';
import type { TelemetryEvent } from '../../../platform/telemetry';
import { applyVocabEvents, type VocabEvent } from '../../vocab/progress';
import { addDays } from '../../vocab/srs';
import { MEMORY_KEY } from '../keys';
import { createMemoryRuntime, stampOf, type MemoryRuntime, type MemoryRuntimeDeps } from '../memory-runtime';
import { CATALOG } from '@hangul-route/content-schema';
import { INDEX, ITEMS, finished, utcDay } from './fixtures';

const CATALOG_QUESTS_OF = (cell: string): string[] => CATALOG.cells.find((c) => c.episodeId === cell)?.questIds ?? [];
import { wordsInside } from '../../reviews/engine';

/**
 * The memory store at runtime (F-CURR-002 sections 4.3, 4.8, 4.9, 11.3, row CM-12): recording from
 * the rounds, the per-profile partition, the one-time seeding, sync with seeded states never
 * uploaded, backup and restore, memory.daily once a local day, and the time zones.
 */

const WORD = ITEMS.find((i) => i.kind === 'lex' && !i.id.startsWith('vocab:') && i.cells.some((c) => c.startsWith('episode:stage2'))) as (typeof ITEMS)[number];
const SENTENCE = ITEMS.find((i) => i.kind === 'pat') as (typeof ITEMS)[number];
const TOPIC = ITEMS.find((i) => i.id.startsWith('vocab:')) as (typeof ITEMS)[number];

/** A tiny Worker: shards per learner with a seq, full scope unless the learner is listed as a class device. */
function fakeServer(classDevices: ReadonlySet<string> = new Set()) {
  const rows = new Map<string, { seq: number; states: MemoryShardStates }>();
  let seq = 0;
  const posted: Array<{ learnerId: string; shards: Record<string, MemoryShardStates> }> = [];
  const gets: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const learnerId = decodeURIComponent(url.pathname.split('/')[4] ?? '');
    if (classDevices.has(learnerId)) return new Response(JSON.stringify({ ok: false, error: { code: 'scope_limited' } }), { status: 403 });
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { shards: Record<string, MemoryShardStates> };
      posted.push({ learnerId, shards: body.shards });
      const kept = withoutSeeded(body.shards);
      for (const [shard, states] of Object.entries(kept)) {
        const k = `${learnerId}|${shard}`;
        seq += 1;
        rows.set(k, { seq, states: mergeMemoryShard(rows.get(k)?.states ?? {}, states) });
      }
      return new Response(JSON.stringify({ ok: true, data: { stored: 0, seeded: 0, written: Object.keys(kept).length } }), { status: 200 });
    }
    gets.push(learnerId);
    const since = Number(url.searchParams.get('since') ?? 0);
    const shards = [...rows.entries()]
      .filter(([k, r]) => k.startsWith(`${learnerId}|`) && r.seq > since)
      .sort(([, a], [, b]) => a.seq - b.seq)
      .map(([k, r]) => ({ shard: k.split('|')[1], seq: r.seq, states: r.states }));
    const cursor = shards.reduce((m, s) => Math.max(m, s.seq), since);
    return new Response(JSON.stringify({ ok: true, data: { cursor, shards } }), { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, posted, rows, gets };
}

interface Device {
  rt: MemoryRuntime;
  store: Map<string, unknown>;
  snapshots: Map<string, ProgressSnapshot>;
  tracked: TelemetryEvent[];
  syncs: string[];
  timers: Array<() => void>;
  runTimers(): Promise<void>;
  clock: { now: Date };
  vocabCalls: Array<{ profileId: string; events: readonly VocabEvent[] }>;
}

function device(
  opts: { server?: ReturnType<typeof fakeServer>; dayOf?: (d: Date) => string; failRead?: boolean; profiles?: string[]; heldSeed?: string; store?: Map<string, unknown>; serverTime?: string } = {},
): Device {
  const store = opts.store ?? new Map<string, unknown>();
  const snapshots = new Map<string, ProgressSnapshot>();
  const tracked: TelemetryEvent[] = [];
  const syncs: string[] = [];
  const timers: Array<() => void> = [];
  const clock = { now: new Date('2026-10-22T09:00:00.000Z') };
  const vocabCalls: Device['vocabCalls'] = [];
  const profiles = new Set(opts.profiles ?? ['p1', 'p2']);
  let rt: MemoryRuntime;
  const deps: MemoryRuntimeDeps = {
    now: () => clock.now,
    dayOf: opts.dayOf ?? utcDay,
    items: async () => INDEX,
    read: async (k) => {
      if (opts.failRead) throw new Error('storage down');
      return store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null;
    },
    write: async (k, v) => {
      store.set(k, JSON.parse(JSON.stringify(v)));
    },
    remove: async (k) => {
      store.delete(k);
    },
    hydrate: async () => undefined,
    snapshot: (id) => snapshots.get(id),
    applySeed: (id, seed) => {
      const snap = snapshots.get(id);
      if (!snap) return null;
      const memSeededAt = snap.memSeededAt ?? opts.heldSeed ?? seed.memSeededAt;
      snapshots.set(id, { ...snap, memSeededAt, cellBest: { ...(snap.cellBest ?? {}), ...seed.cellBest } });
      return memSeededAt;
    },
    applyCellBest: (id, rises) => {
      const snap = snapshots.get(id);
      if (!snap) return null;
      const cellBest = { ...(snap.cellBest ?? {}) };
      for (const r of rises) cellBest[r.cellId] = Math.max(cellBest[r.cellId] ?? 0, r.level) as 0 | 1 | 2 | 3;
      snapshots.set(id, { ...snap, cellBest });
      return cellBest;
    },
    recordVocab: (id, events, now) => {
      vocabCalls.push({ profileId: id, events });
      const snap = snapshots.get(id) as ProgressSnapshot;
      const before = snap.vocab as VocabProgress;
      snapshots.set(id, { ...snap, vocab: applyVocabEvents(before, events, now, { spacing: true }) });
      void rt.countVocab(id, before, events, now);
    },
    profileHere: (id) => profiles.has(id),
    ...(opts.serverTime !== undefined ? { serverTime: () => opts.serverTime ?? null } : {}),
    track: (e) => tracked.push(e),
    requestSync: (id) => syncs.push(id),
    net: () => (opts.server ? { base: 'https://api.test', fetch: opts.server.fetchImpl, creds: async () => ({ deviceId: 'd1', secret: 's1' }) } : null),
    setTimer: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimer: () => undefined,
    saveDelayMs: 10,
  };
  rt = createMemoryRuntime(deps);
  return {
    rt,
    store,
    snapshots,
    tracked,
    syncs,
    timers,
    clock,
    vocabCalls,
    async runTimers() {
      for (const t of timers.splice(0)) t();
      await rt.file('p1');
      await rt.file('p2');
    },
  };
}

const listenScope = (ko: string): MinigameScope => ({ kind: 'listen-pick', listenPick: { rounds: [{ id: 'r1', prompt: { ko, romanization: 'x', en: 'x' }, options: [], answerId: 'a' }] } }) as unknown as MinigameScope;
const round = (ko: string, correct: boolean, at: Date, episodeId = WORD.cells[0] as string) => ({ questId: 'quest:x', episodeId, correct, asked: { scope: listenScope(ko), itemId: 'r1' }, at });
const stateOf = async (d: Device, id: string, profileId = 'p1'): Promise<MemoryItemState | undefined> => (await d.rt.file(profileId))?.rows[id]?.st;

describe('recording from a quest round', () => {
  it('the first answer meets the item: box 1, due tomorrow, one rep, queued for the server', async () => {
    const d = device();
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    expect(await stateOf(d, WORD.id)).toMatchObject({ b: 1, d: '2026-10-23', n: 1, f: '2026-10-22' });
    expect((await d.rt.file('p1'))?.pending).toEqual([WORD.id]);
    expect(d.syncs).toEqual(['p1']);
    await d.runTimers();
    expect(d.store.has(MEMORY_KEY('p1'))).toBe(true);
  });

  it('a round answered with the hint showing (the scaffold round, row CM-24) records as recordAnswers does with hinted', async () => {
    const a = device();
    const b = device();
    await a.rt.recordRound('p1', { ...round(WORD.ko, true, a.clock.now), hinted: true });
    await b.rt.recordAnswers('p1', [{ itemId: WORD.id, correct: true, hinted: true, rung: 'recognize' }], b.clock.now);
    expect(await stateOf(a, WORD.id)).toEqual(await stateOf(b, WORD.id));
    const plain = device();
    await plain.rt.recordRound('p1', round(WORD.ko, true, plain.clock.now));
    expect(await stateOf(a, WORD.id)).not.toEqual(await stateOf(plain, WORD.id));
  });

  it('a round that asks no known item records nothing', async () => {
    const d = device();
    await d.rt.recordRound('p1', round('없는말입니다', true, d.clock.now));
    await d.rt.recordRound('p1', { ...round(WORD.ko, true, d.clock.now), asked: {} });
    expect((await d.rt.file('p1'))?.rows).toEqual({});
    expect(d.syncs).toEqual([]);
  });

  it('a spaced answer the next day raises the box once; the counts reach memory.daily on the day after', async () => {
    const d = device();
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    d.clock.now = new Date('2026-10-23T09:00:00.000Z');
    await d.rt.recordAnswers('p1', [{ itemId: WORD.id, correct: true, rung: 'read' }, { itemId: WORD.id, correct: true, rung: 'read' }], d.clock.now);
    expect(await stateOf(d, WORD.id)).toMatchObject({ b: 2, d: addDays('2026-10-23', 3), n: 3 });
    // The 22nd's counts were sent when the 23rd's first answer came.
    expect(d.tracked.map((e) => e.name)).toEqual(['memory.daily']);
    expect(d.tracked[0]?.payload).toMatchObject({ items: 1, hist: [], durableWeekBucket: '0' });
    d.clock.now = new Date('2026-10-24T09:00:00.000Z');
    await d.rt.sendDailyIfDue('p1');
    await d.rt.sendDailyIfDue('p1');
    const daily = d.tracked.filter((e) => e.name === 'memory.daily');
    expect(daily).toHaveLength(2);
    expect(daily[1]?.payload).toMatchObject({ items: 1, hist: [{ kind: 'lex', rung: 'read', lag: '0-1', right: 1, wrong: 0 }], dueVolumeBucket: '1' });
    for (const e of daily) {
      expect(e.profileId).toBe('p1');
      expect(CURR_TELEMETRY_PAYLOADS['memory.daily'].safeParse(e.payload).success).toBe(true);
    }
  });

  it('a right sentence in a quest round also answers the due word inside it (credit inside sentences, section 4.3)', async () => {
    const pair = INDEX.items
      .filter((i) => i.kind === 'pat')
      .map((pat) => ({ pat, word: wordsInside(pat, INDEX).find((id) => !id.startsWith('vocab:')) }))
      .find((p) => p.word !== undefined) as { pat: (typeof ITEMS)[number]; word: string };
    const d = device();
    await d.rt.recordAnswers('p1', [{ itemId: pair.word, correct: true, rung: 'read' }], d.clock.now);
    expect(await stateOf(d, pair.word)).toMatchObject({ b: 1, d: '2026-10-23' });
    d.clock.now = new Date('2026-10-23T09:00:00.000Z');
    const sentence = { questId: 'quest:x', episodeId: pair.pat.cells[0] as string, correct: true, asked: { texts: [pair.pat.ko], rung: 'read' as const }, at: d.clock.now };
    await d.rt.recordRound('p1', sentence);
    // The word was due, so the credit is its spaced answer of the day: up one box, once.
    expect(await stateOf(d, pair.word)).toMatchObject({ b: 2, d: addDays('2026-10-23', 3), n: 2 });
    await d.rt.recordRound('p1', { ...sentence, at: new Date('2026-10-23T10:00:00.000Z') });
    expect(await stateOf(d, pair.word)).toMatchObject({ b: 2, n: 2 });
    // A miss credits nothing.
    d.clock.now = new Date('2026-10-26T09:00:00.000Z');
    await d.rt.recordRound('p1', { ...sentence, correct: false, at: d.clock.now });
    expect(await stateOf(d, pair.word)).toMatchObject({ b: 2, n: 2 });
  });

  it('a retired or unknown id given to recordAnswers is left out', async () => {
    const d = device();
    await d.rt.recordAnswers('p1', [{ itemId: 'lex:no-such-item', correct: true, rung: 'read' }], d.clock.now);
    expect((await d.rt.file('p1'))?.rows).toEqual({});
  });

  it('answers to topic words go to the word slice for collected words only, and count in memory.daily', async () => {
    const d = device();
    const collected = { id: TOPIC.id, first: '2026-10-01', seen: 2, right: 2, bestBox: 2, last: '2026-10-10', box: 2, due: '2026-10-20', at: '2026-10-10T00:00:00.000Z' };
    d.snapshots.set('p1', { ...finished(0), vocab: { v: 1, items: [collected], topics: [] } });
    await d.rt.recordAnswers('p1', [{ itemId: TOPIC.id, correct: true, rung: 'read' }, { itemId: 'vocab:not-collected', correct: true, rung: 'read' }], d.clock.now);
    expect(d.vocabCalls).toHaveLength(1);
    expect(d.vocabCalls[0]?.events).toEqual([{ type: 'answer', id: TOPIC.id, correct: true, source: 'review' }]);
    await d.rt.file('p1');
    expect((await d.rt.file('p1'))?.rows).toEqual({});
    const file = await d.rt.file('p1');
    // No spaced day on this device yet: the lag runs from the word's last answer (12 days), not its first day.
    expect(file?.day?.hist).toEqual({ 'lex|read|8-14': [1, 0] });
    expect(file?.vf[TOPIC.id]).toMatchObject({ l: '2026-10-22', p: '2026-10-22', w: '2026-10-22' });
  });

  it('countVocab counts a heard question at recognize, a lapse, and a word reaching box 3', async () => {
    const d = device();
    const word = { id: TOPIC.id, first: '2026-10-01', seen: 2, right: 2, bestBox: 2, last: '2026-10-10', box: 2, due: '2026-10-20', at: '2026-10-10T00:00:00.000Z' };
    const before: VocabProgress = { v: 1, items: [word], topics: [] };
    await d.rt.countVocab('p1', before, [{ type: 'introduced', id: 'vocab:x-y' }, { type: 'answer', id: TOPIC.id, correct: true, source: 'speed', format: 'audio-to-image' }], d.clock.now);
    await d.rt.countVocab('p1', { v: 1, items: [{ ...word, id: 'vocab:b-c' }], topics: [] }, [{ type: 'answer', id: 'vocab:b-c', correct: false, source: 'speed' }], d.clock.now);
    const file = await d.rt.file('p1');
    expect(file?.day).toMatchObject({ lapses: 1, newHeld: 1, hist: { 'lex|recognize|8-14': [1, 0], 'lex|read|8-14': [0, 1] } });
  });
});

describe('the profile partition and the switch', () => {
  it('each profile has its own store; one profile’s answers never reach another', async () => {
    const d = device();
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    await d.rt.recordRound('p2', round(SENTENCE.ko, false, d.clock.now, SENTENCE.cells[0] as string));
    await d.runTimers();
    expect(Object.keys((d.store.get(MEMORY_KEY('p1')) as { rows: object }).rows)).toEqual([WORD.id]);
    expect(Object.keys((d.store.get(MEMORY_KEY('p2')) as { rows: object }).rows)).toEqual([SENTENCE.id]);
  });

  it('flush saves the store at once and starts its push', async () => {
    const server = fakeServer();
    const d = device({ server });
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    expect(d.store.has(MEMORY_KEY('p1'))).toBe(false);
    await d.rt.flush('p1');
    expect(d.store.has(MEMORY_KEY('p1'))).toBe(true);
    expect(server.posted.map((p) => p.learnerId)).toEqual(['p1']);
    expect((await d.rt.file('p1'))?.pending).toEqual([]);
  });

  it('a removed learner’s store goes, and nothing writes it back', async () => {
    const d = device({ profiles: ['p2'] });
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    d.store.set(MEMORY_KEY('p1'), { rows: {} });
    d.rt.forget('p1');
    await d.runTimers();
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    await d.rt.flush('p1');
    expect(d.store.has(MEMORY_KEY('p1'))).toBe(false);
    expect(await d.rt.file('p1')).toBeNull();
  });

  it('a store that could not be read is never written over', async () => {
    const d = device({ failRead: true });
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    await d.rt.flush('p1');
    expect(d.store.size).toBe(0);
  });

  it('a damaged stored value (not an object) is neither read as empty nor written over', async () => {
    for (const damaged of ['{"rows": {', [1, 2, 3], 42]) {
      const d = device();
      d.store.set(MEMORY_KEY('p1'), damaged);
      await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
      await d.rt.flush('p1');
      await d.runTimers();
      expect(d.store.get(MEMORY_KEY('p1'))).toEqual(damaged);
      expect(await d.rt.file('p1')).toBeNull();
    }
  });

  it('memoryRecord off at the switch: flush saves the store and sends nothing; a restore while off queues but does not ask for a sync', async () => {
    const server = fakeServer();
    const d = device({ server });
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    d.syncs.length = 0;
    await d.rt.flush('p1', false);
    expect(d.store.has(MEMORY_KEY('p1'))).toBe(true);
    expect(server.posted).toEqual([]);
    expect(server.gets).toEqual([]);
    expect((await d.rt.file('p1'))?.pending).toEqual([WORD.id]);
    const row = (await d.rt.file('p1'))?.rows[WORD.id] as { sh: string; st: MemoryItemState };
    await d.rt.restore('p2', { [row.sh]: { [WORD.id]: row.st } }, false);
    expect(d.syncs).toEqual([]);
    expect((await d.rt.file('p2'))?.pending).toEqual([WORD.id]);
  });
});

describe('seeding at runtime', () => {
  it('runs once per profile: latches memSeededAt and cellBest, lays the seeded states, and sends items.seeded once', async () => {
    const d = device();
    d.snapshots.set('p1', finished(20));
    await d.rt.ensureSeeded('p1');
    await d.rt.ensureSeeded('p1');
    const snap = d.snapshots.get('p1') as ProgressSnapshot;
    expect(snap.memSeededAt).toBe('2026-10-22T09:00:00.000Z');
    expect(Object.values(snap.cellBest ?? {}).every((l) => l === 1)).toBe(true);
    const seeded = d.tracked.filter((e) => e.name === 'items.seeded');
    expect(seeded).toHaveLength(1);
    expect(CURR_TELEMETRY_PAYLOADS['items.seeded'].safeParse(seeded[0]?.payload).success).toBe(true);
    const file = await d.rt.file('p1');
    expect(Object.keys(file?.rows ?? {}).length).toBeGreaterThan(30);
    expect(file?.seededFrom).toBe(snap.memSeededAt);
    expect(file?.pending).toEqual([]);
  });

  it('a profile with no snapshot is not seeded; one whose seed another device latched first takes that time', async () => {
    const d = device();
    await d.rt.ensureSeeded('p1');
    expect(d.tracked).toEqual([]);
    // The progress store latched an earlier seeding meanwhile (another device's, merged in by a sync).
    const late = device({ heldSeed: '2026-10-01T00:00:00.000Z' });
    late.snapshots.set('p1', finished(5));
    await late.rt.ensureSeeded('p1');
    expect(late.tracked).toEqual([]);
    const file = await late.rt.file('p1');
    expect(file?.seededFrom).toBe('2026-10-01T00:00:00.000Z');
    expect(Object.values(file?.rows ?? {}).every((r) => r.st.at === '2026-10-01T00:00:00.000Z')).toBe(true);
  });

  it('seeded states are never uploaded, and two devices derive the same ones', async () => {
    const server = fakeServer();
    const a = device({ server });
    a.snapshots.set('p1', finished(30));
    await a.rt.ensureSeeded('p1');
    await a.rt.recordRound('p1', round(WORD.ko, true, a.clock.now));
    await a.rt.sync('p1');
    const uploaded = server.posted.flatMap((p) => Object.values(p.shards).flatMap((s) => Object.values(s)));
    expect(uploaded.length).toBe(1);
    expect(uploaded.every((s) => s.n >= 1)).toBe(true);

    // Device B gets the snapshot (memSeededAt included) through sync and pulls the shards.
    const b = device({ server });
    b.snapshots.set('p1', structuredClone(a.snapshots.get('p1') as ProgressSnapshot));
    await b.rt.ensureSeeded('p1');
    await b.rt.sync('p1');
    expect(b.tracked.filter((e) => e.name === 'items.seeded')).toEqual([]);
    const rowsA = (await a.rt.file('p1'))?.rows ?? {};
    const rowsB = (await b.rt.file('p1'))?.rows ?? {};
    const shared = (rows: typeof rowsA) => Object.fromEntries(Object.entries(rows).map(([id, r]) => [id, r.st]));
    expect(shared(rowsB)).toEqual(shared(rowsA));
  });

  it('a seeding moved earlier by a merge is derived again from the earlier time', async () => {
    const d = device();
    d.snapshots.set('p1', { ...finished(20), memSeededAt: '2026-10-20T09:00:00.000Z' });
    await d.rt.ensureSeeded('p1');
    const first = (await d.rt.file('p1'))?.rows[WORD.id]?.st.at;
    d.snapshots.set('p1', { ...finished(20), memSeededAt: '2026-10-19T09:00:00.000Z' });
    await d.rt.ensureSeeded('p1');
    const file = await d.rt.file('p1');
    expect(first).toBe('2026-10-20T09:00:00.000Z');
    expect(file?.seededFrom).toBe('2026-10-19T09:00:00.000Z');
    expect(Object.values(file?.rows ?? {}).every((r) => r.st.at === '2026-10-19T09:00:00.000Z')).toBe(true);
    expect(d.tracked).toEqual([]);
  });

  it('a registered learner latches the seeding only after this device’s first snapshot sync', async () => {
    const server = fakeServer();
    const d = device({ server });
    d.snapshots.set('p1', finished(20));
    await d.rt.ensureSeeded('p1');
    expect(d.snapshots.get('p1')?.memSeededAt).toBeUndefined();
    expect(d.tracked).toEqual([]);
    await d.rt.sync('p1');
    expect(d.snapshots.get('p1')?.memSeededAt).toBe('2026-10-22T09:00:00.000Z');
    expect(d.tracked.filter((e) => e.name === 'items.seeded')).toHaveLength(1);
    // A learner not registered for sync (no server) latches at once.
    const local = device();
    local.snapshots.set('p1', finished(20));
    await local.rt.ensureSeeded('p1');
    expect(local.snapshots.get('p1')?.memSeededAt).toBe('2026-10-22T09:00:00.000Z');
  });

  it('a device that seeded from a stale snapshot derives again when a sync brings older quests, and ends with the same states as the other device, sending nothing', async () => {
    const server = fakeServer();
    const a = device({ server });
    a.snapshots.set('p1', finished(30));
    await a.rt.sync('p1');
    const seededAt = a.snapshots.get('p1')?.memSeededAt as string;
    // Device B holds memSeededAt (synced) but only the first 5 of the quests finished before it.
    const b = device({ server });
    b.snapshots.set('p1', { ...finished(5), memSeededAt: seededAt });
    await b.rt.sync('p1');
    const before = Object.keys((await b.rt.file('p1'))?.rows ?? {}).length;
    // A later snapshot sync brings the other 25 quests (finished before memSeededAt).
    b.snapshots.set('p1', { ...finished(30), memSeededAt: seededAt });
    await b.rt.sync('p1');
    const rowsA = (await a.rt.file('p1'))?.rows ?? {};
    const rowsB = (await b.rt.file('p1'))?.rows ?? {};
    expect(Object.keys(rowsB).length).toBeGreaterThan(before);
    const shared = (rows: typeof rowsA) => Object.fromEntries(Object.entries(rows).map(([id, r]) => [id, r.st]));
    expect(shared(rowsB)).toEqual(shared(rowsA));
    expect(b.tracked.filter((e) => e.name === 'items.seeded')).toEqual([]);
    expect(server.posted.flatMap((p) => Object.values(p.shards).flatMap((sh) => Object.values(sh)))).toEqual([]);
  });

  it('only answered rows are stored; the seeded ones are derived again on the next read (all 107 quests: a small stored value)', async () => {
    const d = device();
    d.snapshots.set('p1', finished(107));
    await d.rt.ensureSeeded('p1');
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    await d.runTimers();
    const held = await d.rt.file('p1');
    expect(Object.keys(held?.rows ?? {}).length).toBeGreaterThan(600);
    const stored = d.store.get(MEMORY_KEY('p1')) as { rows: Record<string, { st: { n: number } }>; seededFrom: string };
    expect(Object.keys(stored.rows)).toEqual([WORD.id]);
    expect(stored.seededFrom).toBe(d.snapshots.get('p1')?.memSeededAt);
    expect(JSON.stringify(stored).length).toBeLessThan(2_000);
    // The app starts again on the same storage: the seeded rows come back as they were.
    const again = device({ store: d.store });
    again.snapshots.set('p1', structuredClone(d.snapshots.get('p1') as ProgressSnapshot));
    const reread = await again.rt.file('p1');
    expect(reread?.rows).toEqual(held?.rows);
  });

  it('a seeded item’s first check is kept out of the day’s lag histogram and the north star', async () => {
    const d = device();
    d.snapshots.set('p1', finished(20));
    await d.rt.ensureSeeded('p1');
    const file = (await d.rt.file('p1')) as NonNullable<Awaited<ReturnType<MemoryRuntime['file']>>>;
    const [id, row] = Object.entries(file.rows).find(([, r]) => r.st.n === 0) as [string, (typeof file.rows)[string]];
    d.clock.now = new Date(`${row.st.d}T09:00:00.000Z`);
    await d.rt.recordAnswers('p1', [{ itemId: id, correct: true, rung: 'read' }], d.clock.now);
    const after = await d.rt.file('p1');
    expect(after?.rows[id]?.st).toMatchObject({ n: 1, b: row.st.b + 1 });
    expect(after?.day).toMatchObject({ hist: {}, lapses: 0, newHeld: 0, items: [id] });
    expect(after?.rows[id]?.w).toBeUndefined();
  });

  it('backup restore: the file’s answered states win over the seeded ones, and only answered states are in a backup', async () => {
    const a = device();
    a.snapshots.set('p1', finished(20));
    await a.rt.ensureSeeded('p1');
    expect(await a.rt.backup('p1')).toBeUndefined();
    await a.rt.recordRound('p1', round(WORD.ko, false, a.clock.now));
    const backup = await a.rt.backup('p1');
    expect(Object.values(backup ?? {}).flatMap((s) => Object.keys(s))).toEqual([WORD.id]);

    // A new device restores the file: the snapshot (with memSeededAt) and the memory key.
    const b = device();
    b.snapshots.set('p1', structuredClone(a.snapshots.get('p1') as ProgressSnapshot));
    await b.rt.restore('p1', backup ?? {});
    await b.rt.ensureSeeded('p1');
    expect(await stateOf(b, WORD.id)).toEqual(await stateOf(a, WORD.id));
    expect((await b.rt.file('p1'))?.pending).toEqual([WORD.id]);
    expect(b.syncs).toContain('p1');
    expect(await b.rt.backup('p2')).toBeUndefined();
  });
});

describe('sync', () => {
  it('a class device keeps its answers on the device (403) and stops asking for the session', async () => {
    const server = fakeServer(new Set(['p1']));
    const d = device({ server });
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    await d.rt.sync('p1');
    await d.rt.sync('p1');
    expect((await d.rt.file('p1'))?.pending).toEqual([WORD.id]);
    expect(server.posted).toEqual([]);
  });

  it('no network or no credentials: nothing is sent and the answers stay queued', async () => {
    const d = device();
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    await d.rt.sync('p1');
    await d.rt.pull('p1');
    expect((await d.rt.file('p1'))?.pending).toEqual([WORD.id]);
  });

  it('one GET a sync: the route is not paged', async () => {
    const server = fakeServer();
    const d = device({ server });
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    await d.rt.sync('p1');
    expect(server.gets).toEqual(['p1']);
    await d.rt.sync('p1');
    expect(server.gets).toEqual(['p1', 'p1']);
  });

  it('a Rescue Code pull reads every shard from the start', async () => {
    const server = fakeServer();
    const a = device({ server });
    await a.rt.recordRound('p1', round(WORD.ko, true, a.clock.now));
    await a.rt.sync('p1');
    const b = device({ server });
    await b.rt.pull('p1');
    expect(await stateOf(b, WORD.id)).toEqual(await stateOf(a, WORD.id));
    expect((await b.rt.file('p1'))?.cursor).toBeGreaterThan(0);
    expect((await b.rt.file('p1'))?.pending).toEqual([]);
  });

  it('an answer made while its push was in flight stays queued', async () => {
    const server = fakeServer();
    const d = device({ server });
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    const pushing = d.rt.sync('p1');
    await d.rt.recordRound('p1', round(WORD.ko, false, d.clock.now));
    await pushing;
    const file = await d.rt.file('p1');
    expect(file?.rows[WORD.id]?.st.n).toBe(2);
  });
});

describe('fixed clocks in four time zones (the local day is injected, so the machine’s zone plays no part)', () => {
  const zoned = (timeZone: string) => (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

  /** Met at `first`, answered again at `second`: spaced (box 2) only when `second` is a later local day there. */
  async function twoAnswers(zone: string, first: string, second: string): Promise<{ box: number; met: string }> {
    const d = device({ dayOf: zoned(zone) });
    await d.rt.recordAnswers('p1', [{ itemId: WORD.id, correct: true, rung: 'read' }], new Date(first));
    await d.rt.recordAnswers('p1', [{ itemId: WORD.id, correct: true, rung: 'read' }], new Date(second));
    const st = await stateOf(d, WORD.id);
    return { box: st?.b ?? 0, met: st?.f ?? '' };
  }

  it('UTC+14 (Pacific/Kiritimati): two answers on one UTC day are two local days', async () => {
    expect(await twoAnswers('Pacific/Kiritimati', '2026-10-20T09:00:00.000Z', '2026-10-20T11:00:00.000Z')).toEqual({ box: 2, met: '2026-10-20' });
  });

  it('UTC-12 (Etc/GMT+12): late evening and just after midnight are two local days', async () => {
    expect(await twoAnswers('Etc/GMT+12', '2026-10-21T11:00:00.000Z', '2026-10-21T13:00:00.000Z')).toEqual({ box: 2, met: '2026-10-20' });
  });

  it('Asia/Seoul: the evening of the same local day is not spaced', async () => {
    expect(await twoAnswers('Asia/Seoul', '2026-10-20T23:30:00.000Z', '2026-10-21T12:00:00.000Z')).toEqual({ box: 1, met: '2026-10-21' });
  });

  it('America/Los_Angeles across both daylight-saving changes of 2026', async () => {
    // 1 November: a 25-hour day; 00:30 and 23:30 local are one day.
    expect(await twoAnswers('America/Los_Angeles', '2026-11-01T07:30:00.000Z', '2026-11-02T07:30:00.000Z')).toEqual({ box: 1, met: '2026-11-01' });
    // 8 March: a 23-hour day; 23:30 on the 7th and 00:30 on the 9th are two days apart.
    expect(await twoAnswers('America/Los_Angeles', '2026-03-08T07:30:00.000Z', '2026-03-09T07:30:00.000Z')).toEqual({ box: 2, met: '2026-03-07' });
  });
});

describe('the schedule stamp', () => {
  it('is the device clock, at most a day past the latest stamp the store holds', () => {
    const rows = { a: { sh: 'stage2', st: { b: 1, d: null, c: 0, r: 0, n: 1, f: '2026-10-01', s: 1, at: '2026-10-20T00:00:00.000Z' } } };
    expect(stampOf({ rows: {} }, new Date('2030-01-01T00:00:00.000Z'))).toBe('2030-01-01T00:00:00.000Z');
    expect(stampOf({ rows }, new Date('2026-10-20T12:00:00.000Z'))).toBe('2026-10-20T12:00:00.000Z');
    expect(stampOf({ rows }, new Date('2030-01-01T00:00:00.000Z'))).toBe('2026-10-21T00:00:00.000Z');
  });

  it('is capped at a day past the last server time seen, even with nothing stored; a later pulled stamp still lifts the cap', () => {
    const rows = { a: { sh: 'stage2', st: { b: 1, d: null, c: 0, r: 0, n: 1, f: '2026-10-01', s: 1, at: '2026-10-25T00:00:00.000Z' } } };
    expect(stampOf({ rows: {} }, new Date('2030-01-01T00:00:00.000Z'), '2026-10-22T09:00:00.000Z')).toBe('2026-10-23T09:00:00.000Z');
    expect(stampOf({ rows: {} }, new Date('2026-10-22T10:00:00.000Z'), '2026-10-22T09:00:00.000Z')).toBe('2026-10-22T10:00:00.000Z');
    expect(stampOf({ rows }, new Date('2030-01-01T00:00:00.000Z'), '2026-10-22T09:00:00.000Z')).toBe('2026-10-26T00:00:00.000Z');
    expect(stampOf({ rows: {} }, new Date('2030-01-01T00:00:00.000Z'), 'not a time')).toBe('2030-01-01T00:00:00.000Z');
  });

  it('the runtime stamps an answer with the server-time cap', async () => {
    const d = device({ serverTime: '2026-10-20T09:00:00.000Z' });
    await d.rt.recordAnswers('p1', [{ itemId: WORD.id, correct: true, rung: 'read' }], d.clock.now);
    expect((await stateOf(d, WORD.id))?.at).toBe('2026-10-21T09:00:00.000Z');
  });
});

describe('the summary memory block (row CM-16)', () => {
  it('counts what the store holds after every earlier operation: a word known only once it is answered past box 2', async () => {
    const d = device();
    d.snapshots.set('p1', { ...finished(0), cellBest: { 'letters-s1': 1 } });
    await d.rt.recordRound('p1', round(WORD.ko, true, d.clock.now));
    expect(await d.rt.summary('p1')).toEqual({ wordsKnown: 0, readyToRefresh: 0, cellBestCounts: [1, 0, 0], stageChecks: 0, weekPoints: 0, topDue: [] });
    // Tomorrow it is due (ready to refresh); a spaced right answer then lifts it to box 2 and it is known.
    d.clock.now = new Date('2026-10-23T09:00:00.000Z');
    expect(await d.rt.summary('p1')).toMatchObject({ wordsKnown: 0, readyToRefresh: 1, topDue: [WORD.id] });
    await d.rt.recordAnswers('p1', [{ itemId: WORD.id, correct: true, rung: 'read' }], d.clock.now);
    expect(await d.rt.summary('p1')).toMatchObject({ wordsKnown: 1, readyToRefresh: 0, topDue: [] });
  });

  it('is undefined while the snapshot or the store cannot be read', async () => {
    expect(await device().rt.summary('p1')).toBeUndefined();
    const broken = device({ failRead: true });
    broken.snapshots.set('p1', finished(0));
    expect(await broken.rt.summary('p1')).toBeUndefined();
  });
});

describe('mastery: levels latched into cellBest, Ready to refresh, New volume and Words known (row CM-20)', () => {
  const MASTERY_OFF = { volumesOn: false, reviewOn: false, celebrate: false } as const;
  /** A cell of this build that teaches no topic words, and its items (all lesson items). */
  const CELL = 'episode:stage3-life';
  const CELL_ITEMS = ITEMS.filter((i) => i.cells.includes(CELL));
  const held = (s: number, over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: s, d: '2026-11-30', c: 1, r: 3, n: 3, f: '2026-10-01', s, at: '2026-10-20T10:00:00.000Z', ...over });
  /**
   * p1 with every quest of the cell done, and `rows` laid in the stored file. `wk`: the Words known count this device
   * last read (0: a device that has read mastery before; null: its first mastery read, the silent baseline).
   */
  async function learner(rows: Record<string, MemoryItemState> = {}, over: Partial<ProgressSnapshot> = {}, wk: number | null = 0): Promise<Device> {
    const store = new Map<string, unknown>();
    store.set(MEMORY_KEY('p1'), { v: 1, rows: Object.fromEntries(Object.entries(rows).map(([id, st]) => [id, { sh: 'stage3', st }])), vf: {}, pending: [], cursor: 0, seededFrom: null, day: null, dailySent: null, ...(wk === null ? {} : { wk }) });
    const d = device({ store });
    const snap = { ...finished(0), memSeededAt: '2026-10-01T12:00:00.000Z' };
    const quests = CATALOG_QUESTS_OF(CELL).map((q) => ({ questId: q, episodeId: CELL, startedAt: '2026-10-01T10:00:00.000Z', completedAt: '2026-10-01T10:00:00.000Z', stars: 3 as const, attempts: 1, accuracy: 1 }));
    d.snapshots.set('p1', { ...snap, quests, ...over });
    return d;
  }

  it('latches a derived level into cellBest once, with one mastery.level_up parsed by its schema', async () => {
    expect(CELL_ITEMS.length).toBeGreaterThan(4);
    const rows = Object.fromEntries(CELL_ITEMS.map((i) => [i.id, held(3)]));
    const d = await learner(rows);
    const read = await d.rt.mastery('p1', MASTERY_OFF);
    expect(read?.cellBest[CELL]).toBe(2);
    expect(d.snapshots.get('p1')?.cellBest?.[CELL]).toBe(2);
    const ups = d.tracked.filter((e) => e.name === 'mastery.level_up');
    expect(ups).toEqual([{ name: 'mastery.level_up', profileId: 'p1', payload: { cellId: CELL, level: 2 } }]);
    expect(CURR_TELEMETRY_PAYLOADS['mastery.level_up'].safeParse(ups[0]?.payload).success).toBe(true);
    // A silent read reports no rise; a second read latches nothing and sends nothing, and the Results still gets it.
    expect(read?.rises).toEqual([]);
    expect((await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true }))?.rises).toEqual([{ cellId: CELL, level: 2 }]);
    expect(d.tracked.filter((e) => e.name === 'mastery.level_up')).toHaveLength(1);
    expect((await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true }))?.rises).toEqual([]);
  });

  it('never lowers a latched level when boxes fall, and the Results read returns its rises', async () => {
    const d = await learner(Object.fromEntries(CELL_ITEMS.map((i) => [i.id, held(1, { s: 1 })])), { cellBest: { [CELL]: 2 } });
    const read = await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true });
    expect(read?.cellBest[CELL]).toBe(2);
    expect(read?.rises).toEqual([]);
    const fresh = await learner(Object.fromEntries(CELL_ITEMS.map((i) => [i.id, held(3)])));
    expect((await fresh.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true }))?.rises).toEqual([{ cellId: CELL, level: 2 }]);
  });

  it('Ready to refresh: a mastered cell with an item due, only while the review surface is on', async () => {
    const [first, ...rest] = CELL_ITEMS;
    const rows = { ...Object.fromEntries(rest.map((i) => [i.id, held(5)])), [first?.id as string]: held(5, { b: 2, d: '2026-10-22' }) };
    const d = await learner(rows, { cellBest: { [CELL]: 3 } });
    expect((await d.rt.mastery('p1', { ...MASTERY_OFF, reviewOn: true }))?.refresh).toEqual([CELL]);
    expect((await d.rt.mastery('p1', MASTERY_OFF))?.refresh).toEqual([]);
  });

  it('New volume only with volumes on (this build ships no later volume: none)', async () => {
    const d = await learner();
    expect((await d.rt.mastery('p1', { ...MASTERY_OFF, volumesOn: true }))?.newVolume).toEqual([]);
  });

  it('Words known: the first read sets the baseline quietly; the Results read that crosses 100 celebrates it once', async () => {
    const words = ITEMS.filter((i) => i.kind === 'lex' && !i.id.startsWith('vocab:')).slice(0, 101);
    expect(words).toHaveLength(101);
    const rows = Object.fromEntries(words.slice(0, 99).map((i) => [i.id, held(2)]));
    const d = await learner(rows, {}, null);
    const first = await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true });
    expect(first).toMatchObject({ wordsKnown: 99, milestone: null });
    const file = await d.rt.file('p1');
    for (const w of words.slice(99)) if (file) file.rows[w.id] = { sh: 'stage2', st: held(2) };
    expect(await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true })).toMatchObject({ wordsKnown: 101, milestone: 100 });
    expect(await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true })).toMatchObject({ wordsKnown: 101, milestone: null });
    await d.runTimers();
    expect((d.store.get(MEMORY_KEY('p1')) as { wk?: number }).wk).toBe(101);
  });

  it('a seeded box alone (n 0) never counts a word known', async () => {
    const words = ITEMS.filter((i) => i.kind === 'lex' && !i.id.startsWith('vocab:')).slice(0, 5);
    const d = await learner();
    const file = await d.rt.file('p1');
    for (const w of words) if (file) file.rows[w.id] = { sh: 'stage2', st: held(2, { n: 0, r: 0 }) };
    expect((await d.rt.mastery('p1', MASTERY_OFF))?.wordsKnown).toBe(0);
  });

  it('a silent read (Home, the Journey: mounted under the Results) never takes the moments from the Results', async () => {
    const words = ITEMS.filter((i) => i.kind === 'lex' && !i.id.startsWith('vocab:') && !i.cells.includes(CELL)).slice(0, 101);
    const d = await learner(Object.fromEntries(words.slice(0, 99).map((i) => [i.id, held(2)])), { cellBest: { [CELL]: 1 } });
    await d.rt.mastery('p1', MASTERY_OFF);
    // The quest ends: its cell's items reach box 3 and two more words are known. Home reads first, silently.
    const file = await d.rt.file('p1');
    for (const w of words.slice(99)) if (file) file.rows[w.id] = { sh: 'stage2', st: held(2) };
    for (const i of CELL_ITEMS) if (file) file.rows[i.id] = { sh: 'stage3', st: held(3) };
    const home = await d.rt.mastery('p1', MASTERY_OFF);
    expect(home).toMatchObject({ milestone: null, rises: [] });
    expect(home?.cellBest[CELL]).toBe(2);
    await d.runTimers();
    expect((d.store.get(MEMORY_KEY('p1')) as { mc?: unknown }).mc).toMatchObject({ day: '2026-10-22', rises: { [CELL]: 2 }, words: 100 });
    // The Results read still celebrates both, once.
    const results = await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true });
    expect(results?.milestone).toBe(100);
    expect(results?.rises).toContainEqual({ cellId: CELL, level: 2 });
    // Taken moments are saved at once (no save timer): a reload right after the Results never shows them again.
    expect((d.store.get(MEMORY_KEY('p1')) as { mc?: unknown }).mc).toBeUndefined();
    expect(await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true })).toMatchObject({ milestone: null, rises: [] });
    expect(d.tracked.filter((e) => e.name === 'mastery.level_up' && (e.payload as { cellId: string }).cellId === CELL)).toHaveLength(1);
  });

  it('moments are kept for their local day: one left from an earlier day is dropped, never shown late', async () => {
    const d = await learner(Object.fromEntries(CELL_ITEMS.map((i) => [i.id, held(3)])));
    const file = await d.rt.file('p1');
    if (file) file.mc = { day: '2026-10-20', rises: { 'episode:stage4-life': 1 }, words: 250 };
    expect(await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true })).toMatchObject({ milestone: null, rises: [{ cellId: CELL, level: 2 }] });
  });

  it("the device's first mastery read (the ramp day) latches the levels reached before silently: no level_up, no banner", async () => {
    const d = await learner(Object.fromEntries(CELL_ITEMS.map((i) => [i.id, held(3)])), {}, null);
    const read = await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true });
    expect(read?.cellBest[CELL]).toBe(2);
    expect(d.snapshots.get('p1')?.cellBest?.[CELL]).toBe(2);
    expect(read?.rises).toEqual([]);
    expect(d.tracked.filter((e) => e.name === 'mastery.level_up')).toEqual([]);
    // From then on a rise is live.
    const file = await d.rt.file('p1');
    for (const i of CELL_ITEMS) if (file) file.rows[i.id] = { sh: 'stage3', st: held(4) };
    d.snapshots.set('p1', { ...(d.snapshots.get('p1') as ProgressSnapshot), cellCheckAt: { [CELL]: '2026-10-21T10:00:00.000Z' } });
    expect((await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true }))?.rises).toEqual([{ cellId: CELL, level: 3 }]);
    expect(d.tracked.filter((e) => e.name === 'mastery.level_up').map((e) => e.payload)).toEqual([{ cellId: CELL, level: 3 }]);
  });

  it('latches nothing and sends nothing before the one-time seeding (its Done levels are history, not rises)', async () => {
    const d = await learner(Object.fromEntries(CELL_ITEMS.map((i) => [i.id, held(3)])), { memSeededAt: undefined });
    const read = await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true });
    expect(read?.rises).toEqual([]);
    expect(read?.cellBest[CELL]).toBeUndefined();
    expect(d.tracked.filter((e) => e.name === 'mastery.level_up')).toEqual([]);
  });

  it('a first read before the seeding leaves the baseline to the first read after it: the levels reached before stay history', async () => {
    const words = ITEMS.filter((i) => i.kind === 'lex' && !i.id.startsWith('vocab:') && !i.cells.includes(CELL)).slice(0, 101);
    const rows = { ...Object.fromEntries(CELL_ITEMS.map((i) => [i.id, held(3)])), ...Object.fromEntries(words.map((i) => [i.id, held(2)])) };
    // This device's first mastery read lands before the seeding has latched (memSeededAt not there yet).
    const d = await learner(rows, { memSeededAt: undefined }, null);
    expect(await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true })).toMatchObject({ wordsKnown: 101, milestone: null, rises: [] });
    await d.runTimers();
    expect((d.store.get(MEMORY_KEY('p1')) as { wk?: number }).wk).toBeUndefined();
    // The seeding latches; the next read is the silent baseline: the level is latched, but no rise, no milestone, no event.
    d.snapshots.set('p1', { ...(d.snapshots.get('p1') as ProgressSnapshot), memSeededAt: '2026-10-22T09:30:00.000Z' });
    const after = await d.rt.mastery('p1', MASTERY_OFF);
    expect(after?.cellBest[CELL]).toBe(2);
    expect(d.tracked.filter((e) => e.name === 'mastery.level_up')).toEqual([]);
    expect(await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true })).toMatchObject({ wordsKnown: 101, milestone: null, rises: [] });
    await d.runTimers();
    expect((d.store.get(MEMORY_KEY('p1')) as { wk?: number }).wk).toBe(101);
    // From then on a rise is live.
    const file = await d.rt.file('p1');
    for (const i of CELL_ITEMS) if (file) file.rows[i.id] = { sh: 'stage3', st: held(4) };
    d.snapshots.set('p1', { ...(d.snapshots.get('p1') as ProgressSnapshot), cellCheckAt: { [CELL]: '2026-10-21T10:00:00.000Z' } });
    expect((await d.rt.mastery('p1', { ...MASTERY_OFF, celebrate: true }))?.rises).toEqual([{ cellId: CELL, level: 3 }]);
    expect(d.tracked.filter((e) => e.name === 'mastery.level_up').map((e) => e.payload)).toEqual([{ cellId: CELL, level: 3 }]);
  });

  it('reads nothing without a snapshot', async () => {
    const d = device();
    expect(await d.rt.mastery('p1', MASTERY_OFF)).toBeUndefined();
  });
});

describe('a test-out (row CM-21, section 4.5)', () => {
  const CELL = 'episode:stage2-letters';
  const cellItems = ITEMS.filter((i) => i.cells.includes(CELL) && !i.id.startsWith('vocab:'));
  const [right, miss, third] = cellItems as [(typeof ITEMS)[number], (typeof ITEMS)[number], (typeof ITEMS)[number]];

  it('places the asked items by their result, and a pass derives the unasked ones at box 1 over the next 3 days, never uploaded', async () => {
    const server = fakeServer();
    const d = device({ server });
    d.snapshots.set('p1', finished(3));
    // A learner registered for sync seeds after this device's first snapshot sync of the session.
    await d.rt.sync('p1');
    await d.rt.recordTestOut('p1', [{ itemId: right.id, rung: 'read', correct: true }, { itemId: miss.id, rung: 'produce', correct: false }], true, d.clock.now);
    expect(await stateOf(d, right.id)).toMatchObject({ b: 2, d: '2026-10-25', n: 1, s: 2 });
    expect(await stateOf(d, miss.id)).toMatchObject({ b: 1, d: '2026-10-23', n: 1, c: 1 });
    // The pass latches testedOut on the snapshot (the API's latch); the seeding pass lays the unasked items.
    const snap = d.snapshots.get('p1') as ProgressSnapshot;
    d.snapshots.set('p1', { ...snap, testedOut: { [CELL]: d.clock.now.toISOString() } });
    await d.rt.ensureSeeded('p1');
    expect(await stateOf(d, third.id)).toMatchObject({ b: 1, n: 0, s: 1, f: '2026-10-22' });
    // Due from the next day on, within the cap of 15 seeded items a day (the quest seeding of this learner counts too).
    expect(((await stateOf(d, third.id))?.d ?? '') > '2026-10-22').toBe(true);
    const due = new Map<string, number>();
    for (const row of Object.values((await d.rt.file('p1'))?.rows ?? {})) if (row.st.n === 0 && row.st.d) due.set(row.st.d, (due.get(row.st.d) ?? 0) + 1);
    for (const n of due.values()) expect(n).toBeLessThanOrEqual(15);
    // The asked ones keep their own state over the derivation.
    expect(await stateOf(d, right.id)).toMatchObject({ b: 2, n: 1 });
    // Only answered states are queued and sent.
    const file = await d.rt.file('p1');
    expect([...(file?.pending ?? [])].sort()).toEqual([miss.id, right.id].sort());
    await d.rt.sync('p1');
    const sent = server.posted.flatMap((p) => Object.values(p.shards).flatMap((s) => Object.keys(s)));
    expect(sent.sort()).toEqual([miss.id, right.id].sort());
    // Words known grows only with items answered: the right word (box 2, n 1) at most, never a derived one.
    await d.runTimers();
    const stored = d.store.get(MEMORY_KEY('p1')) as { rows: Record<string, unknown> };
    expect(Object.keys(stored.rows)).not.toContain(third.id);
  });

  it('a test-out that did not pass leaves a missed unmet item unmet and derives nothing', async () => {
    const d = device();
    d.snapshots.set('p1', finished(3));
    await d.rt.ensureSeeded('p1');
    await d.rt.recordTestOut('p1', [{ itemId: right.id, rung: 'read', correct: true }, { itemId: miss.id, rung: 'read', correct: false }], false, d.clock.now);
    expect(await stateOf(d, right.id)).toMatchObject({ b: 2, n: 1 });
    expect(await stateOf(d, miss.id)).toBeUndefined();
    expect(await stateOf(d, third.id)).toBeUndefined();
  });

  it('an item already met follows the spacing rule (a seeded box 1 due tomorrow is not raised early)', async () => {
    const d = device();
    d.snapshots.set('p1', finished(3));
    await d.rt.ensureSeeded('p1');
    await d.rt.recordAnswers('p1', [{ itemId: right.id, rung: 'read', correct: true }], new Date('2026-10-21T09:00:00.000Z'));
    const before = await stateOf(d, right.id);
    await d.rt.recordTestOut('p1', [{ itemId: right.id, rung: 'read', correct: true }], true, d.clock.now);
    // Met yesterday at box 1, due today: a spaced right answer raises it one step, as anywhere else.
    expect(before).toMatchObject({ b: 1, d: '2026-10-22' });
    expect(await stateOf(d, right.id)).toMatchObject({ b: 2, n: 2 });
  });

  it('two devices derive the same unasked states from the same synced testedOut', async () => {
    const one = device();
    const two = device({ dayOf: utcDay });
    const snap = { ...finished(3), testedOut: { [CELL]: '2026-10-22T08:00:00.000Z' } };
    for (const dv of [one, two]) {
      dv.snapshots.set('p1', snap);
      await dv.rt.ensureSeeded('p1');
    }
    const derived = async (dv: Device) => Object.fromEntries(Object.entries((await dv.rt.file('p1'))?.rows ?? {}).filter(([, r]) => r.st.n === 0).map(([id, r]) => [id, r.st]));
    expect(await derived(one)).toEqual(await derived(two));
    expect(Object.keys(await derived(one))).toContain(third.id);
  });
});

describe('a Stage Jump (row CM-25): asked items by their result across the stage, the rest derived, alike on two devices', () => {
  const STAGE3 = ['letters', 'life', 'rites', 'nature', 'crafts'].map((t) => `episode:stage3-${t}`);
  const own = (cell: string) => ITEMS.filter((i) => i.cells.includes(cell) && !i.id.startsWith('vocab:'));
  const [lifeRight, lifeMiss] = own('episode:stage3-life') as [(typeof ITEMS)[number], (typeof ITEMS)[number]];
  const ritesRight = own('episode:stage3-rites')[0] as (typeof ITEMS)[number];
  const unasked = own('episode:stage3-nature')[0] as (typeof ITEMS)[number];
  const jumped = (at: string): Record<string, string> => Object.fromEntries([...STAGE3, 'stage3'].map((k) => [k, at]));

  it('right to box 2 due in 3 days, a miss to box 1 due tomorrow, in any cell; every unasked item at box 1, never uploaded', async () => {
    const d = device();
    d.snapshots.set('p1', finished(3));
    await d.rt.ensureSeeded('p1');
    await d.rt.recordTestOut(
      'p1',
      [
        { itemId: lifeRight.id, rung: 'read', correct: true },
        { itemId: lifeMiss.id, rung: 'read', correct: false },
        { itemId: ritesRight.id, rung: 'produce', correct: true },
      ],
      true,
      d.clock.now,
    );
    const snap = d.snapshots.get('p1') as ProgressSnapshot;
    d.snapshots.set('p1', { ...snap, testedOut: jumped(d.clock.now.toISOString()) });
    await d.rt.ensureSeeded('p1');
    expect(await stateOf(d, lifeRight.id)).toMatchObject({ b: 2, d: '2026-10-25', n: 1 });
    expect(await stateOf(d, ritesRight.id)).toMatchObject({ b: 2, d: '2026-10-25', n: 1, c: 3 });
    expect(await stateOf(d, lifeMiss.id)).toMatchObject({ b: 1, d: '2026-10-23', n: 1 });
    expect(await stateOf(d, unasked.id)).toMatchObject({ b: 1, n: 0, s: 1, f: '2026-10-22' });
    const due = new Map<string, number>();
    for (const row of Object.values((await d.rt.file('p1'))?.rows ?? {})) if (row.st.n === 0 && row.st.d) due.set(row.st.d, (due.get(row.st.d) ?? 0) + 1);
    for (const n of due.values()) expect(n).toBeLessThanOrEqual(15);
    expect([...((await d.rt.file('p1'))?.pending ?? [])].sort()).toEqual([lifeRight.id, lifeMiss.id, ritesRight.id].sort());
  });

  it('two devices derive the same unasked states from the same synced jump', async () => {
    const one = device();
    const two = device({ dayOf: utcDay });
    const snap = { ...finished(3), testedOut: jumped('2026-10-22T08:00:00.000Z') };
    for (const dv of [one, two]) {
      dv.snapshots.set('p1', snap);
      await dv.rt.ensureSeeded('p1');
    }
    const derived = async (dv: Device) => Object.fromEntries(Object.entries((await dv.rt.file('p1'))?.rows ?? {}).filter(([, r]) => r.st.n === 0).map(([id, r]) => [id, r.st]));
    expect(await derived(one)).toEqual(await derived(two));
    expect(Object.keys(await derived(one))).toContain(unasked.id);
  });
});
