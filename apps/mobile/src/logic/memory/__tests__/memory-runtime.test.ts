import { CURR_TELEMETRY_PAYLOADS, type MemoryItemState, type ProgressSnapshot, type VocabProgress } from '@hangul-route/content-schema';
import { mergeMemoryShard, withoutSeeded, type MemoryShardStates } from '@hangul-route/content-schema/memory';
import { afterEach, describe, expect, it } from 'vitest';
import type { MinigameScope } from '../../minigame-config';
import type { TelemetryEvent } from '../../../platform/telemetry';
import { applyVocabEvents, type VocabEvent } from '../../vocab/progress';
import { addDays } from '../../vocab/srs';
import { MEMORY_KEY } from '../keys';
import { createMemoryRuntime, type MemoryRuntime, type MemoryRuntimeDeps } from '../memory-runtime';
import { INDEX, ITEMS, finished, utcDay } from './fixtures';

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
    const since = Number(url.searchParams.get('since') ?? 0);
    const shards = [...rows.entries()]
      .filter(([k, r]) => k.startsWith(`${learnerId}|`) && r.seq > since)
      .sort(([, a], [, b]) => a.seq - b.seq)
      .map(([k, r]) => ({ shard: k.split('|')[1], seq: r.seq, states: r.states }));
    const cursor = shards.reduce((m, s) => Math.max(m, s.seq), since);
    return new Response(JSON.stringify({ ok: true, data: { cursor, shards } }), { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, posted, rows };
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

function device(opts: { server?: ReturnType<typeof fakeServer>; dayOf?: (d: Date) => string; failRead?: boolean; profiles?: string[]; heldSeed?: string } = {}): Device {
  const store = new Map<string, unknown>();
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
    recordVocab: (id, events, now) => {
      vocabCalls.push({ profileId: id, events });
      const snap = snapshots.get(id) as ProgressSnapshot;
      const before = snap.vocab as VocabProgress;
      snapshots.set(id, { ...snap, vocab: applyVocabEvents(before, events, now, { spacing: true }) });
      void rt.countVocab(id, before, events, now);
    },
    profileHere: (id) => profiles.has(id),
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
    // The first spaced answer's lag runs from the word's first day (21 days).
    expect(file?.day?.hist).toEqual({ 'lex|read|15-30': [1, 0] });
    expect(file?.vf[TOPIC.id]).toMatchObject({ l: '2026-10-22', p: '2026-10-22', w: '2026-10-22' });
  });

  it('countVocab counts a heard question at recognize, a lapse, and a word reaching box 3', async () => {
    const d = device();
    const word = { id: TOPIC.id, first: '2026-10-01', seen: 2, right: 2, bestBox: 2, last: '2026-10-10', box: 2, due: '2026-10-20', at: '2026-10-10T00:00:00.000Z' };
    const before: VocabProgress = { v: 1, items: [word], topics: [] };
    await d.rt.countVocab('p1', before, [{ type: 'introduced', id: 'vocab:x-y' }, { type: 'answer', id: TOPIC.id, correct: true, source: 'speed', format: 'audio-to-image' }], d.clock.now);
    await d.rt.countVocab('p1', { v: 1, items: [{ ...word, id: 'vocab:b-c' }], topics: [] }, [{ type: 'answer', id: 'vocab:b-c', correct: false, source: 'speed' }], d.clock.now);
    const file = await d.rt.file('p1');
    expect(file?.day).toMatchObject({ lapses: 1, newHeld: 1, hist: { 'lex|recognize|15-30': [1, 0], 'lex|read|15-30': [0, 1] } });
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

describe('fixed clocks in four time zones (the suite runs under TZ=UTC)', () => {
  const zoned = (timeZone: string) => (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const tz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = tz;
  });

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
