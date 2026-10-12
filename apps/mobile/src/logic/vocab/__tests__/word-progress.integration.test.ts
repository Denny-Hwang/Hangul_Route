import {
  ProgressSummarySchema,
  SnapshotPutSchema,
  VocabProgressSchema,
  type ProgressSnapshot,
  type ProgressSummary,
  type RuntimeVocabItem,
  type VocabItemState,
  type VocabProgress,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { seededRandom } from '../../listen-pick';
import { syncLearner, type PutResult, type SyncApi } from '../../sync/engine';
import { isSubsetOf, mergeSnapshots, mergeVocab } from '../../sync/merge';
import { summarize, vocabSummaryOf } from '../../sync/summarize';
import { createVocabCatalog } from '../catalog';
import { NUDGE_MIN_DUE, vocabNudge, type NudgeTopicRef } from '../nudge';
import { applyVocabEvents, emptyVocab, localDay, vocabOf, type VocabEvent } from '../progress';
import { recordReviewAnswer, vocabPools } from '../review-pools';
import { selectSpeedWords } from '../select-words';
import { addDays, isDue } from '../srs';

/**
 * F-VOC-005 P-5: the integration suite (spec sections 3.3, 3.4, 3.6, 3.8, 3.11; PR table row P-5).
 *
 * The unit suites check each module alone. Here the real modules run together on the real
 * launch vocabulary: the reducer (`applyVocabEvents`), the Daily Test pools, the Speed Round
 * selection, the Home nudge, the caregiver summary, the snapshot merge and the sync engine
 * against an in-memory server that answers like the Worker (schema-checked compare-and-set,
 * 409 with the stored copy). Three scenarios:
 *
 * - the 14-day simulation of section 3.6, with the exact days pinned;
 * - a 30-day simulation of a learner who meets three topics, takes Daily Tests and Speed Rounds
 *   and is away for a week (skipped days are invisible, section 3.4);
 * - two devices that sync through the engine in either order and converge (section 3.3,
 *   behaviours 6, 7 and 15).
 *
 * Every day of every simulation checks the same invariants: the slice parses, nothing collected
 * is lost, every learner-visible number only grows (D3), the pools hold exactly the due words,
 * the nudge appears only from three due words and carries no date, and the snapshot and the
 * summary pass the Worker's schemas (server first, P6).
 *
 * Days are local calendar days (P5): each event happens at local noon of its day, so the suite
 * reads the same in any time zone.
 */

const catalog = createVocabCatalog(VOCAB_TOPICS, VOCAB_ITEMS);
const idsOf = (topic: string): string[] => catalog.topicItems(topic).map((i) => i.id);

/** The visible topic that opens a word, for the nudge (as Home wires it). */
const topicOf = (id: string): NudgeTopicRef | undefined => {
  const key = catalog.vocabItem(id)?.topics[0];
  const topic = key === undefined ? undefined : catalog.vocabTopics.find((t) => t.key === key);
  return topic ? { key: topic.key, order: topic.order } : undefined;
};

const DAY0 = '2026-10-01';
const dayOf = (n: number): string => addDays(DAY0, n);
/** Local time on day `n`; noon unless an hour is given. */
const at = (n: number, hour = 12, minute = 0): Date => {
  const [y, m, d] = dayOf(n).split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour, minute);
};

const stateOf = (v: VocabProgress, id: string): VocabItemState | undefined => v.items.find((s) => s.id === id);
const inAnyPool = (pools: ReturnType<typeof vocabPools>, id: string): boolean => [...pools.a, ...pools.b, ...pools.d].includes(id);

function snapshotWith(profileId: string, vocab: VocabProgress | undefined, updatedAt: Date): ProgressSnapshot {
  return {
    profileId,
    updatedAt: updatedAt.toISOString(),
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    questDoneAt: {},
    ...(vocab ? { vocab } : {}),
  };
}

const summaryOf = (snapshot: ProgressSnapshot, now: Date): ProgressSummary => summarize({ snapshot, now, stage1QuestIds: [], questJamo: {} });

/**
 * The checks every simulated day passes. `prev` is the slice at the start of the day, `next` at
 * its end; `today` is the local day.
 */
function expectDayInvariants(prev: VocabProgress, next: VocabProgress, today: string, now: Date): void {
  expect(VocabProgressSchema.safeParse(next).success, `${today}: slice parses`).toBe(true);

  // Nothing collected is lost and every learner-visible number only grows (P2, D3).
  for (const before of prev.items) {
    const after = stateOf(next, before.id);
    expect(after, `${today}: ${before.id} kept`).toBeDefined();
    if (!after) continue;
    expect(after.first).toBe(before.first);
    expect(after.seen).toBeGreaterThanOrEqual(before.seen);
    expect(after.right).toBeGreaterThanOrEqual(before.right);
    expect(after.bestBox).toBeGreaterThanOrEqual(before.bestBox);
    expect(after.last >= before.last).toBe(true);
    expect(after.box).toBeGreaterThanOrEqual(1);
  }
  for (const before of prev.topics) {
    const after = next.topics.find((t) => t.topic === before.topic);
    expect(after, `${today}: topic ${before.topic} kept`).toBeDefined();
    if (!after) continue;
    expect(after.bestStars).toBeGreaterThanOrEqual(before.bestStars);
    expect(after.sessions).toBeGreaterThanOrEqual(before.sessions);
    expect(after.bestCaught).toBeGreaterThanOrEqual(before.bestCaught);
  }

  // The caregiver summary only grows where the learner earned something.
  const was = vocabSummaryOf(prev, today);
  const is = vocabSummaryOf(next, today);
  expect(is.collected).toBeGreaterThanOrEqual(was.collected);
  expect(is.strong).toBeGreaterThanOrEqual(was.strong);
  for (const id of is.needsPractice) {
    const s = stateOf(next, id);
    expect(s?.box).toBe(1);
    expect(s?.seen ?? 0).toBeGreaterThanOrEqual(2);
  }

  // Pools of the next day hold exactly the words due then, each once (section 3.6).
  const tomorrow = addDays(today, 1);
  const pools = vocabPools(next, tomorrow);
  const pooled = [...pools.a, ...pools.b, ...pools.d];
  expect(new Set(pooled).size).toBe(pooled.length);
  expect(pooled.sort()).toEqual(next.items.filter((s) => isDue(s, tomorrow)).map((s) => s.id).sort());

  // The nudge: only from three due words, a topic and a count, never a date (section 3.7).
  const nudge = vocabNudge(next, topicOf, tomorrow);
  const dueOpenable = next.items.filter((s) => isDue(s, tomorrow) && topicOf(s.id) !== undefined).length;
  if (dueOpenable < NUDGE_MIN_DUE) expect(nudge).toBeNull();
  else expect(nudge).toEqual({ topicKey: expect.any(String), due: dueOpenable });

  // Server first (P6): the snapshot and the summary pass the Worker's put schema every day.
  const snapshot = snapshotWith('profile:sim', next, now);
  const summary = summaryOf(snapshot, now);
  expect(ProgressSummarySchema.safeParse(summary).success).toBe(true);
  expect(summary.vocab).toEqual(vocabSummaryOf(next, localDay(now)));
  expect(SnapshotPutSchema.safeParse({ baseRev: 0, snapshot, summary, schemaVer: 1, contentVer: 'test' }).success).toBe(true);
}

describe('14-day simulation on the launch vocabulary (section 3.6)', () => {
  const words = idsOf('food');
  // Two scripted words pin the exact days; the other ten answer right with probability 0.8.
  const [steady, wobbly] = words as [string, string, ...string[]];
  const SCRIPT: Record<string, Record<number, boolean>> = {
    [steady]: { 1: true, 4: true, 11: true },
    [wobbly]: { 1: false, 2: true, 5: false },
  };

  interface Day {
    n: number;
    pools: ReturnType<typeof vocabPools>;
    before: VocabProgress;
    after: VocabProgress;
  }

  function run(seed: number): Day[] {
    const rand = seededRandom(seed);
    // Day 0: the learner meets the twelve food words on flashcards.
    let v = applyVocabEvents(emptyVocab(), [...words.map((id): VocabEvent => ({ type: 'introduced', id })), { type: 'session', topicKey: 'food', kind: 'cards' }], at(0));
    const days: Day[] = [];
    for (let n = 1; n <= 14; n++) {
      const today = dayOf(n);
      const pools = vocabPools(v, today);
      const events = [...pools.a, ...pools.b, ...pools.d].map((id) => recordReviewAnswer(id, SCRIPT[id]?.[n] ?? rand() < 0.8));
      const before = v;
      v = applyVocabEvents(v, events, at(n));
      expectDayInvariants(before, v, today, at(n));
      days.push({ n, pools, before, after: v });
    }
    return days;
  }

  const days = run(2026);
  const day = (n: number): Day => days[n - 1] as Day;

  it('collects twelve words in box 1, due on day 1', () => {
    const first = day(1).before;
    expect(first.items).toHaveLength(12);
    for (const s of first.items) expect(s).toMatchObject({ box: 1, bestBox: 1, seen: 0, right: 0, due: dayOf(1), first: DAY0 });
    expect(first.topics).toEqual([{ topic: 'food', bestStars: 0, sessions: 1, last: DAY0, bestCaught: 0 }]);
  });

  it('brings a word answered right on day 1 back on day 4, and not on days 2 or 3', () => {
    expect(stateOf(day(1).after, steady)).toMatchObject({ box: 2, due: dayOf(4) });
    expect(inAnyPool(day(2).pools, steady)).toBe(false);
    expect(inAnyPool(day(3).pools, steady)).toBe(false);
    expect(day(4).pools.b).toContain(steady);
  });

  it('returns a word missed on day 5 to box 1, due on day 6, without lowering its best box', () => {
    expect(stateOf(day(2).after, wobbly)).toMatchObject({ box: 2, bestBox: 2, due: dayOf(5) });
    expect(day(5).pools.b).toContain(wobbly);
    expect(stateOf(day(5).after, wobbly)).toMatchObject({ box: 1, bestBox: 2, due: dayOf(6) });
    expect(day(6).pools.a).toContain(wobbly);
  });

  it('first fills Pool D on day 11, never earlier', () => {
    expect(days.find((d) => d.pools.d.length > 0)?.n).toBe(11);
    expect(day(11).pools.d).toContain(steady);
    expect(stateOf(day(11).after, steady)).toMatchObject({ box: 4, bestBox: 4, due: dayOf(25) });
    for (const seed of [1, 7, 42, 99, 2024]) expect(run(seed).find((d) => d.pools.d.length > 0)?.n, `seed ${seed}`).toBe(11);
  });

  it('feeds the Speed Round the due words first, oldest due first', () => {
    const v = day(6).before;
    const today = dayOf(6);
    const due = v.items.filter((s) => isDue(s, today));
    const picked = selectSpeedWords({ collected: catalog.topicItems('food'), progress: v, today, count: 10, seed: 6 });
    expect(picked).toHaveLength(10);
    expect(new Set(picked.map((i) => i.id)).size).toBe(10);
    const head = picked.slice(0, Math.min(6, due.length)).map((i) => stateOf(v, i.id));
    for (const s of head) expect(s && isDue(s, today)).toBe(true);
    const dues = head.map((s) => s?.due ?? '');
    expect(dues).toEqual([...dues].sort());
  });

  it('tells a caregiver counts and words to revisit, never a day count', () => {
    const summary = vocabSummaryOf(day(14).after, dayOf(14));
    expect(Object.keys(summary).sort()).toEqual(['collected', 'firstTryRate', 'needsPractice', 'strong', 'topicsPracticed7d', 'topicsStarted']);
    expect(summary.collected).toBe(12);
    expect(summary.strong).toBe(day(14).after.items.filter((s) => s.bestBox >= 3).length);
    expect(summary.strong).toBeGreaterThanOrEqual(1);
  });
});

describe('30-day simulation: three topics, Daily Tests, Speed Rounds and a week away', () => {
  const food = idsOf('food');
  const animals = idsOf('animals');
  const colors = idsOf('colors');
  /** Always right, and only ever met in the Daily Test: its boxes land on exact days. */
  const steady = food[0] as string;
  const AWAY = new Set([14, 15, 16, 17, 18, 19, 20]);

  /** Flashcards: every word is introduced; "Got it" on every third word, "Show me again" on every fifth. */
  const meet = (ids: readonly string[], topicKey: string): VocabEvent[] => [
    ...ids.map((id): VocabEvent => ({ type: 'introduced', id })),
    ...ids.flatMap((id, i): VocabEvent[] => (id === steady ? [] : i % 3 === 2 ? [{ type: 'self', id, known: true }] : i % 5 === 4 ? [{ type: 'self', id, known: false }] : [])),
    { type: 'session', topicKey, kind: 'cards' },
  ];

  /** Day 22: the learner flips through the cards of all three topics again and taps "Got it" on every one. */
  const CARDS_AGAIN = 22;

  interface Day {
    n: number;
    before: VocabProgress;
    after: VocabProgress;
    pools: ReturnType<typeof vocabPools>;
    speedTopic: string | null;
    /** The Speed Round of the day: the slice around it and the words answered right with the idle hint. */
    speed: { before: VocabProgress; after: VocabProgress; hintedRight: string[] } | null;
    /** The flashcards of day 22: the slice around them. */
    cards: { before: VocabProgress; after: VocabProgress } | null;
  }

  function run(seed: number): Day[] {
    const rand = seededRandom(seed);
    let v = applyVocabEvents(emptyVocab(), meet(food, 'food'), at(0));
    const days: Day[] = [];
    for (let n = 1; n <= 30; n++) {
      const today = dayOf(n);
      const before = v;
      const pools = vocabPools(v, today);
      let speedTopic: string | null = null;
      let speed: Day['speed'] = null;
      let cards: Day['cards'] = null;
      if (!AWAY.has(n)) {
        const events: VocabEvent[] = [];
        if (n === CARDS_AGAIN) {
          const was = v;
          const again = (ids: readonly string[], topicKey: string): VocabEvent[] => [
            ...ids.filter((id) => id !== steady).map((id): VocabEvent => ({ type: 'self', id, known: true })),
            { type: 'session', topicKey, kind: 'cards' },
          ];
          v = applyVocabEvents(v, [...again(food, 'food'), ...again(animals, 'animals'), ...again(colors, 'colors')], at(n, 8));
          cards = { before: was, after: v };
        }
        if (n === 3) events.push(...meet(animals, 'animals'));
        if (n === 8) events.push(...meet(colors, 'colors'));
        // Every third day Home's pinned plan carries the "Words are ready" card (built at the start of
        // the day, from three due words), and the learner plays a Relaxed Speed Round for its topic first.
        const nudge = n % 3 === 0 ? vocabNudge(v, topicOf, today) : null;
        if (nudge) {
          speedTopic = nudge.topicKey;
          const collected = catalog.topicItems(nudge.topicKey).filter((i: RuntimeVocabItem) => i.id !== steady && stateOf(v, i.id) !== undefined);
          const round = selectSpeedWords({ collected, progress: v, today, count: 10, seed: seed + n });
          // Relaxed mode: now and then the idle hint (F-VOC-004 section 3.6) is showing when the learner answers.
          const answers = round.map((i): VocabEvent => {
            const correct = rand() < 0.85;
            return { type: 'answer', id: i.id, correct, hinted: rand() < 0.2, source: 'speed', format: 'pick-meaning', ms: 1500 };
          });
          const right = answers.filter((e) => e.type === 'answer' && e.correct).length;
          const stars = right >= 9 ? 3 : right >= 7 ? 2 : 1;
          const was = v;
          v = applyVocabEvents(v, [...answers, { type: 'session', topicKey: nudge.topicKey, kind: 'speed', stars, mode: 'relaxed', endedBy: 'questions' }], at(n, 9));
          speed = { before: was, after: v, hintedRight: answers.flatMap((e) => (e.type === 'answer' && e.correct && e.hinted ? [e.id] : [])) };
        }
        // The Daily Test: every word still due, right 80 % of the time.
        const left = vocabPools(v, today);
        for (const id of [...left.a, ...left.b, ...left.d]) events.push(recordReviewAnswer(id, id === steady ? true : rand() < 0.8));
        v = applyVocabEvents(v, events, at(n));
      }
      expectDayInvariants(before, v, today, at(n, 19));
      days.push({ n, before, after: v, pools, speedTopic, speed, cards });
    }
    return days;
  }

  const days = run(30);
  const day = (n: number): Day => days[n - 1] as Day;

  it('climbs one box per right Daily Test answer: box 2 on day 1, 3 on day 4, 4 on day 11, 5 on day 25', () => {
    const boxes = days.map((d) => stateOf(d.after, steady)?.box);
    expect(boxes[0]).toBe(2);
    expect(boxes[3]).toBe(3);
    expect(boxes[10]).toBe(4);
    expect(boxes[24]).toBe(5);
    expect(stateOf(day(25).after, steady)).toMatchObject({ bestBox: 5, due: dayOf(55), seen: 4, right: 4 });
    // It is due only on those four days.
    expect(days.filter((d) => inAnyPool(d.pools, steady)).map((d) => d.n)).toEqual([1, 4, 11, 25]);
  });

  it('collects all 36 words from three topics and never loses one', () => {
    expect(day(2).after.items).toHaveLength(12);
    expect(day(3).after.items).toHaveLength(24);
    expect(day(30).after.items).toHaveLength(36);
    expect(day(30).after.topics.map((t) => t.topic)).toEqual(['animals', 'colors', 'food']);
    for (const t of day(30).after.topics) expect(t.sessions).toBeGreaterThanOrEqual(1);
  });

  it('seeds "Got it" words in box 2 and never above it', () => {
    const gotIt = food.filter((id, i) => id !== steady && i % 3 === 2);
    for (const id of gotIt) expect(stateOf(day(1).before, id)).toMatchObject({ box: 2, bestBox: 2, due: dayOf(3), seen: 0 });
  });

  it('caps a later "Got it" at box 2: a word already in box 2 or higher keeps its box, best box and day (P4)', () => {
    const cards = day(CARDS_AGAIN).cards;
    expect(cards).not.toBeNull();
    if (!cards) return;
    const words = [...food, ...animals, ...colors].filter((id) => id !== steady).map((id) => ({ was: stateOf(cards.before, id), is: stateOf(cards.after, id) }));
    const higher = words.filter((w) => (w.was?.box ?? 0) >= 2);
    // The run reaches both cases the cap guards: a word in box 2 and a word in box 4 or higher.
    expect(higher.some((w) => w.was?.box === 2)).toBe(true);
    expect(higher.some((w) => (w.was?.box ?? 0) >= 4)).toBe(true);
    for (const { was, is } of higher) expect(is).toMatchObject({ box: was?.box, bestBox: was?.bestBox, due: was?.due, seen: was?.seen, right: was?.right });
    // A word in box 1 is raised to box 2 and comes back three days later.
    for (const { was, is } of words.filter((w) => w.was?.box === 1)) {
      expect(is).toMatchObject({ box: 2, bestBox: Math.max(2, was?.bestBox ?? 0), due: dayOf(CARDS_AGAIN + 3) });
    }
  });

  it('never promotes a right Speed Round answer given with the idle hint, and never demotes it (P3)', () => {
    const hinted = days.flatMap((d) => (d.speed ? d.speed.hintedRight.map((id) => ({ id, n: d.n, speed: d.speed })) : []));
    expect(hinted.length).toBeGreaterThanOrEqual(2);
    for (const { id, n, speed } of hinted) {
      const was = speed && stateOf(speed.before, id);
      const is = speed && stateOf(speed.after, id);
      expect(is, `${id} on day ${n}`).toMatchObject({ box: was?.box, bestBox: was?.bestBox, right: was?.right, seen: (was?.seen ?? 0) + 1 });
    }
  });

  it('runs Speed Rounds only from three due words, and they count as practice', () => {
    const rounds = days.filter((d) => d.speedTopic !== null);
    expect(rounds.length).toBeGreaterThanOrEqual(3);
    const speedSessions = (v: VocabProgress): number => v.topics.reduce((sum, t) => sum + t.sessions, 0);
    // Three first meetings, the three topics' cards again on day 22, and one session per round.
    expect(speedSessions(day(30).after)).toBe(6 + rounds.length);
    for (const d of rounds) expect(['food', 'animals', 'colors']).toContain(d.speedTopic);
  });

  it('changes nothing while the learner is away, and brings every waiting word back on the first day home', () => {
    expect(day(20).after).toBe(day(13).after);
    const home = day(21);
    const waiting = home.before.items.filter((s) => s.due !== null && s.due <= dayOf(21)).map((s) => s.id).sort();
    expect(waiting.length).toBeGreaterThan(0);
    expect([...home.pools.a, ...home.pools.b, ...home.pools.d].sort()).toEqual(waiting);
    // Nothing the learner sees or a caregiver reads knows how long they were away.
    const nudge = vocabNudge(home.before, topicOf, dayOf(21));
    if (nudge) expect(Object.keys(nudge).sort()).toEqual(['due', 'topicKey']);
    expect(Object.keys(vocabSummaryOf(home.before, dayOf(21))).sort()).toEqual(['collected', 'firstTryRate', 'needsPractice', 'strong', 'topicsPracticed7d', 'topicsStarted']);
  });

  it('keeps the slice small: well under 200 bytes of JSON per word', () => {
    const v = day(30).after;
    expect(JSON.stringify(v).length).toBeLessThan(200 * v.items.length);
  });

  it('is deterministic for a seed', () => {
    expect(run(30).map((d) => d.after)).toEqual(days.map((d) => d.after));
  });
});

/**
 * The server side of a sync, as the Worker answers it (section 3.3): the body must pass
 * `SnapshotPutSchema` (an invalid slice would be a 422; zod strips unknown keys), and a put whose
 * base rev is not the stored rev is a 409 that returns the stored snapshot.
 */
function memoryServer() {
  let rev = 0;
  let stored: { snapshot: ProgressSnapshot; summary: ProgressSummary } | null = null;
  const puts: { baseRev: number; status: PutResult['status'] }[] = [];
  const api: SyncApi = {
    putSnapshot: async (_learnerId, body) => {
      const parsed = SnapshotPutSchema.safeParse({ ...body, schemaVer: 1, contentVer: 'test' });
      if (!parsed.success) {
        puts.push({ baseRev: body.baseRev, status: 'error' });
        return { status: 'error', code: 'bad_request' };
      }
      if (body.baseRev !== rev) {
        puts.push({ baseRev: body.baseRev, status: 'conflict' });
        return { status: 'conflict', rev, snapshot: stored ? stored.snapshot : null };
      }
      rev += 1;
      stored = { snapshot: parsed.data.snapshot as ProgressSnapshot, summary: parsed.data.summary };
      puts.push({ baseRev: body.baseRev, status: 'ok' });
      return { status: 'ok', rev };
    },
  };
  return {
    api,
    puts,
    get rev() {
      return rev;
    },
    get stored() {
      return stored;
    },
  };
}

interface Device {
  name: string;
  snapshot: ProgressSnapshot;
  rev: number;
}

async function sync(device: Device, server: ReturnType<typeof memoryServer>, now: Date): Promise<boolean> {
  const out = await syncLearner({ learnerId: 'profile:mina', local: device.snapshot, localRev: device.rev, api: server.api, now, summarize: (s) => summaryOf(s, now) });
  expect(out.status, `${device.name} synced`).toBe('synced');
  if (out.status !== 'synced') return false;
  device.snapshot = out.snapshot;
  device.rev = out.rev;
  return out.merged;
}

describe('two devices: phone and tablet (sections 3.3 and 3.11, behaviours 6, 7 and 15)', () => {
  const food = idsOf('food');
  const animals = idsOf('animals');
  /** On both devices: box 4 on the phone at 10:00 on day 11, then a miss on the tablet at 11:00. */
  const shared = food[3] as string;

  function phoneSlice(): VocabProgress {
    let v = applyVocabEvents(emptyVocab(), [...food.slice(0, 6).map((id): VocabEvent => ({ type: 'introduced', id })), { type: 'session', topicKey: 'food', kind: 'cards' }], at(0, 9));
    for (const n of [1, 4]) v = applyVocabEvents(v, food.slice(0, 6).map((id) => recordReviewAnswer(id, id !== food[1])), at(n, 9));
    v = applyVocabEvents(v, [recordReviewAnswer(shared, true), { type: 'session', topicKey: 'food', kind: 'speed', stars: 2, mode: 'challenge', caught: 7 }], at(11, 10));
    return v;
  }

  function tabletSlice(): VocabProgress {
    let v = applyVocabEvents(emptyVocab(), [...animals.slice(0, 6).map((id): VocabEvent => ({ type: 'introduced', id })), { type: 'session', topicKey: 'animals', kind: 'cards' }], at(2, 8));
    v = applyVocabEvents(v, [...food.slice(3, 6).map((id): VocabEvent => ({ type: 'introduced', id })), { type: 'session', topicKey: 'food', kind: 'cards' }], at(2, 8, 30));
    v = applyVocabEvents(v, [...animals.slice(0, 6).map((id) => recordReviewAnswer(id, true)), recordReviewAnswer(food[4] as string, true)], at(3, 8));
    v = applyVocabEvents(v, [recordReviewAnswer(shared, false), { type: 'session', topicKey: 'food', kind: 'speed', stars: 3, mode: 'challenge', caught: 9 }], at(11, 11));
    return v;
  }

  const phone0 = phoneSlice();
  const tablet0 = tabletSlice();

  async function converge(order: 'phone-first' | 'tablet-first') {
    const server = memoryServer();
    const phone: Device = { name: 'phone', snapshot: snapshotWith('profile:mina', phone0, at(11, 10)), rev: 0 };
    const tablet: Device = { name: 'tablet', snapshot: snapshotWith('profile:mina', tablet0, at(11, 11)), rev: 0 };
    const [first, second] = order === 'phone-first' ? [phone, tablet] : [tablet, phone];
    const now = at(11, 12);
    expect(await sync(first, server, now)).toBe(false);
    // The second device's base rev is stale: a 409, a merge with the stored copy, one retry.
    expect(await sync(second, server, now)).toBe(true);
    // The first device catches up the same way.
    expect(await sync(first, server, now)).toBe(true);
    return { server, phone, tablet };
  }

  it('converges to the same words on both devices and the server, in either order (behaviour 6)', async () => {
    const a = await converge('phone-first');
    const b = await converge('tablet-first');
    expect(a.phone.snapshot.vocab).toEqual(a.tablet.snapshot.vocab);
    expect(a.server.stored?.snapshot.vocab).toEqual(a.phone.snapshot.vocab);
    expect(b.server.stored?.snapshot.vocab).toEqual(a.server.stored?.snapshot.vocab);
    expect(a.server.stored?.snapshot.vocab).toEqual(mergeVocab(phone0, tablet0));
    expect(mergeVocab(tablet0, phone0)).toEqual(mergeVocab(phone0, tablet0));
    expect(a.server.puts.map((p) => p.status)).toEqual(['ok', 'conflict', 'ok', 'conflict', 'ok']);
  });

  it('keeps every collected word and the larger of each count', async () => {
    const { server } = await converge('phone-first');
    const merged = vocabOf(server.stored?.snapshot ?? snapshotWith('x', undefined, at(0)));
    const union = new Set([...phone0.items, ...tablet0.items].map((s) => s.id));
    expect(merged.items.map((s) => s.id).sort()).toEqual([...union].sort());
    expect(merged.items).toHaveLength(12);
    for (const s of merged.items) {
      const p = stateOf(phone0, s.id);
      const t = stateOf(tablet0, s.id);
      expect(s.seen).toBe(Math.max(p?.seen ?? 0, t?.seen ?? 0));
      expect(s.right).toBe(Math.max(p?.right ?? 0, t?.right ?? 0));
      expect(s.bestBox).toBe(Math.max(p?.bestBox ?? 0, t?.bestBox ?? 0));
      expect(s.first).toBe([p?.first, t?.first].filter((d): d is string => d !== undefined).sort()[0]);
    }
    expect(merged.topics).toEqual([
      { topic: 'animals', bestStars: 0, sessions: 1, last: dayOf(2), bestCaught: 0 },
      { topic: 'food', bestStars: 3, sessions: 2, last: dayOf(11), bestCaught: 9 },
    ]);
  });

  it('takes the later schedule and keeps the best box: box 1 from the tablet, best box 4 (behaviour 7)', async () => {
    expect(stateOf(phone0, shared)).toMatchObject({ box: 4, bestBox: 4, due: dayOf(25) });
    expect(stateOf(tablet0, shared)).toMatchObject({ box: 1, bestBox: 1, due: dayOf(12) });
    const { phone } = await converge('phone-first');
    expect(stateOf(vocabOf(phone.snapshot), shared)).toMatchObject({ box: 1, bestBox: 4, due: dayOf(12), seen: 3, right: 3 });
    // The schedule dropped; the collection did not: the word still counts as strong for a caregiver.
    expect(phone.snapshot.vocab && vocabSummaryOf(phone.snapshot.vocab, dayOf(11)).strong).toBeGreaterThanOrEqual(1);
  });

  it('uploads a summary that describes the merged words, and needs no further upload', async () => {
    const { server, phone, tablet } = await converge('tablet-first');
    const stored = server.stored;
    expect(stored?.summary.vocab).toEqual(vocabSummaryOf(mergeVocab(phone0, tablet0) ?? emptyVocab(), dayOf(11)));
    expect(stored?.summary.vocab?.collected).toBe(12);
    if (!stored) return;
    expect(isSubsetOf(phone.snapshot, stored.snapshot)).toBe(true);
    expect(isSubsetOf(tablet.snapshot, stored.snapshot)).toBe(true);
    // A device that learns something new is no longer covered, so it uploads again.
    const later = applyVocabEvents(vocabOf(tablet.snapshot), [recordReviewAnswer(animals[0] as string, true)], at(12));
    expect(isSubsetOf({ ...tablet.snapshot, vocab: later }, stored.snapshot)).toBe(false);
  });

  it('lets a clock running a year ahead move when a word comes back, never what was earned', () => {
    const ahead = new Date(at(11, 11).getTime() + 365 * 86_400_000);
    const skewed = applyVocabEvents(emptyVocab(), [{ type: 'introduced', id: shared }, recordReviewAnswer(shared, false)], ahead);
    for (const merged of [mergeVocab(phone0, skewed), mergeVocab(skewed, phone0)]) {
      const s = merged && stateOf(merged, shared);
      // The schedule: the skewed device's later `at` wins, so the word is in box 1, due the day after its clock.
      expect(s).toMatchObject({ box: 1, due: addDays(localDay(ahead), 1) });
      // What was earned: the larger counts, the best box and the first day, whatever the clock said.
      expect(s).toMatchObject({ bestBox: 4, seen: 3, right: 3, first: dayOf(0) });
      expect(merged?.items).toHaveLength(6);
    }
  });

  it('a reset sends the empty slice; only a device that still holds the words brings them back (behaviour 15)', async () => {
    const { server, phone, tablet } = await converge('phone-first');
    expect(server.stored?.snapshot.vocab?.items).toHaveLength(12);
    // The phone is up to date with the server through the engine itself, not by hand.
    expect(phone.rev).toBe(server.rev);
    expect(tablet.rev).toBeLessThan(server.rev);

    // A grown-up resets the phone's progress: the next upload carries the empty slice, not an absent key.
    phone.snapshot = snapshotWith('profile:mina', emptyVocab(), at(12));
    expect(await sync(phone, server, at(12))).toBe(false);
    expect(server.stored?.snapshot.vocab).toEqual({ v: 1, items: [], topics: [] });
    // An empty slice reports no words to caregivers.
    expect(server.stored?.summary.vocab).toBeUndefined();

    // The tablet still holds the words: its next sync folds the empty slice in and the words come back.
    expect(await sync(tablet, server, at(12, 13))).toBe(true);
    expect(server.stored?.snapshot.vocab).toEqual(mergeVocab(phone0, tablet0));
    expect(mergeSnapshots(snapshotWith('profile:mina', emptyVocab(), at(12)), tablet.snapshot, { now: at(12) }).vocab).toEqual(tablet.snapshot.vocab);
  });

  it('a reset on a device behind the server is undone by its own conflict merge (section 3.10)', async () => {
    const server = memoryServer();
    const phone: Device = { name: 'phone', snapshot: snapshotWith('profile:mina', phone0, at(11, 10)), rev: 0 };
    const tablet: Device = { name: 'tablet', snapshot: snapshotWith('profile:mina', tablet0, at(11, 11)), rev: 0 };
    expect(await sync(phone, server, at(11, 12))).toBe(false);
    expect(await sync(tablet, server, at(11, 12))).toBe(true);
    // The phone last synced at rev 1; the tablet's merged upload moved the server on.
    expect(phone.rev).toBeLessThan(server.rev);

    phone.snapshot = snapshotWith('profile:mina', emptyVocab(), at(12));
    const puts = server.puts.length;
    // The empty slice meets a 409; the engine folds the server copy in (the union keeps every word) and retries.
    expect(await sync(phone, server, at(12))).toBe(true);
    expect(server.puts.slice(puts).map((p) => p.status)).toEqual(['conflict', 'ok']);
    expect(phone.snapshot.vocab).toEqual(mergeVocab(phone0, tablet0));
    expect(server.stored?.snapshot.vocab).toEqual(mergeVocab(phone0, tablet0));
    expect(server.stored?.summary.vocab?.collected).toBe(12);
  });
});
