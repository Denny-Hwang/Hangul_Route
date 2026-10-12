import {
  ProgressSummarySchema,
  VocabSummarySchema,
  type ProgressSnapshot,
  type VocabItemState,
  type VocabProgress,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { placementResult } from '../../placement/__tests__/fixtures';
import { placementSummaryOf, planProgressOf, summarize, vocabSummaryOf } from '../summarize';

const NOW = new Date('2026-09-21T12:00:00.000Z');
const snap: ProgressSnapshot = {
  profileId: 'profile:a',
  updatedAt: '2026-09-20T00:00:00.000Z',
  episodes: [],
  quests: [
    { questId: 'q1', episodeId: 'e', startedAt: 't', completedAt: 't', stars: 3, attempts: 1, accuracy: 1 },
    { questId: 'q2', episodeId: 'e', startedAt: 't', completedAt: 't', stars: 1, accuracy: 0.4, attempts: 3 },
    { questId: 'q3', episodeId: 'e', startedAt: 't', stars: 0, accuracy: 0, attempts: 0 },
    { questId: 'stage2', episodeId: 'e2', startedAt: 't', completedAt: 't', stars: 2, accuracy: 0.7, attempts: 1 },
  ],
  cards: [{ cardId: 'c1', unlockedAt: 't', newSinceLastView: true }],
  sessions: [
    { id: 's-old', profileId: 'profile:a', startedAt: '2026-09-01T00:00:00Z', durationSeconds: 600, episodesTouched: [] },
    { id: 's-new', profileId: 'profile:a', startedAt: '2026-09-20T10:00:00Z', durationSeconds: 900, episodesTouched: [] },
    { id: 's-latest', profileId: 'profile:a', startedAt: '2026-09-21T10:00:00Z', durationSeconds: 300, episodesTouched: [] },
  ],
  homework: [],
  reviews: [],
  streakDays: 2,
};

describe('summarize (F-SYNC-001 §3.4)', () => {
  const summary = summarize({
    snapshot: snap,
    now: NOW,
    stage1QuestIds: ['q1', 'q2', 'q3'],
    questJamo: { q1: ['ㄱ', 'ㄴ'], q2: ['ㄴ', 'ㄷ'], stage2: ['ㅁ'] },
  });

  it('counts only completed Stage 1 quests and averages their accuracy', () => {
    expect(summary.stage1).toEqual({ questsDone: 2, questsTotal: 3, anchorAccuracy: 0.7 });
  });
  it('sums minutes from the last 7 days only', () => {
    expect(summary.minutesLast7d).toBe(20);
  });
  it('lists recognized jamo (≥ 0.8) and practice jamo (< 0.6) minus recognized ones', () => {
    expect(summary.jamoRecognized).toEqual(['ㄱ', 'ㄴ']);
    expect(summary.needsPractice).toEqual(['ㄷ']);
  });
  it('takes the latest activity timestamp and passes through cards / streak', () => {
    expect(summary.lastActiveAt).toBe('2026-09-21T10:00:00Z');
    expect(summary.cardsUnlocked).toBe(1);
    expect(summary.streakDays).toBe(2);
    expect(summary.planProgress).toEqual({});
  });
  it('counts a session at most 60 minutes, so an hours-long session from an older build never inflates the minutes (F-REPORT-001 section 3.3.2)', () => {
    const long = { id: 's-long', profileId: 'profile:a', startedAt: '2026-09-21T08:00:00Z', durationSeconds: 3 * 60 * 60, episodesTouched: [] };
    const capped = summarize({ snapshot: { ...snap, sessions: [long] }, now: NOW, stage1QuestIds: [], questJamo: {} });
    expect(capped.minutesLast7d).toBe(60);
  });
  it('empty snapshot → null anchor accuracy and zeros', () => {
    const empty = summarize({ snapshot: { ...snap, quests: [], sessions: [], cards: [] }, now: NOW, stage1QuestIds: ['q1'], questJamo: {} });
    expect(empty.stage1.anchorAccuracy).toBeNull();
    expect(empty.minutesLast7d).toBe(0);
    expect(empty.lastActiveAt).toBe(snap.updatedAt);
  });
});

describe('plan progress (F-PLAN-001 §3.3)', () => {
  it('counts plan-derived assignments per plan and reports skipped items', () => {
    const withPlans: ProgressSnapshot = {
      ...snap,
      homework: [
        { id: 'plan:w3#q1', profileId: 'profile:a', questId: 'q1', episodeId: 'e', assignedBy: 'teacher', assignedAt: 't', targetDate: '2026-09-21', completedAt: 't' },
        { id: 'plan:w3#q2', profileId: 'profile:a', questId: 'q2', episodeId: 'e', assignedBy: 'teacher', assignedAt: 't', targetDate: '2026-09-21' },
        { id: 'plan:fam#q1', profileId: 'profile:a', questId: 'q1', episodeId: 'e', assignedBy: 'parent', assignedAt: 't', targetDate: '2026-09-21' },
        { id: 'hw:parent-1', profileId: 'profile:a', questId: 'q3', episodeId: 'e', assignedBy: 'parent', assignedAt: 't', targetDate: '2026-09-21' },
      ],
    };
    expect(planProgressOf(withPlans, { 'plan:w3': 1, 'plan:other': 2, 'plan:zero': 0 })).toEqual({
      'plan:w3': { done: 1, total: 2, notReady: 1 },
      'plan:fam': { done: 0, total: 1, notReady: 0 },
      'plan:other': { done: 0, total: 0, notReady: 2 },
    });
    const full = summarize({ snapshot: withPlans, now: NOW, stage1QuestIds: ['q1'], questJamo: {}, planNotReady: { 'plan:w3': 1 } });
    expect(full.planProgress['plan:w3']).toEqual({ done: 1, total: 2, notReady: 1 });
    expect(summarize({ snapshot: snap, now: NOW, stage1QuestIds: [], questJamo: {} }).planProgress).toEqual({});
  });
});

describe('plan progress never carries the self-route (F-PLAN-002 section 3.10)', () => {
  it('ignores route: assignments and route: not-ready counts, which class rosters would read', () => {
    const withRoute: ProgressSnapshot = {
      ...snap,
      homework: [
        { id: 'route:mine#q1', profileId: 'profile:a', questId: 'q1', episodeId: 'e', assignedBy: 'system', assignedAt: 't', targetDate: '2026-09-21', completedAt: 't' },
        { id: 'plan:w3#q2', profileId: 'profile:a', questId: 'q2', episodeId: 'e', assignedBy: 'teacher', assignedAt: 't', targetDate: '2026-09-21' },
      ],
    };
    expect(planProgressOf(withRoute, { 'route:mine': 3, 'plan:w3': 1 })).toEqual({ 'plan:w3': { done: 0, total: 1, notReady: 1 } });
  });
});

describe('summarize: the level check (F-PLC-001 section 3.8, section 3.7 consumer 5)', () => {
  const fresh: ProgressSnapshot = { ...snap, quests: [], sessions: [] };
  const older = placementResult({ id: 'placement:old', completedAt: '2026-09-01T00:00:00Z', priorityTokens: ['sym:ㄱ'] });
  const newer = placementResult({
    id: 'placement:new',
    completedAt: '2026-09-10T00:00:00Z',
    level: { stage: 'stage1', band: 1 },
    oralStage: 'stage2',
    priorityTokens: ['sym:ㅓ', 'sym:ㄹ/final', 'skill:blending'],
  });
  const run = (s: ProgressSnapshot) => summarize({ snapshot: s, now: NOW, stage1QuestIds: ['q1'], questJamo: {} });

  it('has no placement block without a result (a legacy snapshot too)', () => {
    expect(run(fresh).placement).toBeUndefined();
    expect(placementSummaryOf(undefined)).toBeUndefined();
    expect(placementSummaryOf([])).toBeUndefined();
  });

  it('fills the block from the newest result: statuses and level only', () => {
    const summary = run({ ...fresh, placements: [newer, older] });
    expect(summary.placement).toEqual({
      takenAt: '2026-09-10T00:00:00Z',
      level: { stage: 'stage1', band: 1 },
      oralStage: 'stage2',
      strands: newer.strands,
      beyondContent: false,
      overridden: false,
    });
  });

  it('marks an override in force on any result', () => {
    const overridden = { ...older, override: { by: 'parent' as const, at: '2026-09-02T00:00:00Z', startQuestId: 'quest:q2' } };
    expect(run({ ...fresh, placements: [overridden, newer] }).placement?.overridden).toBe(true);
  });

  it('seeds needsPractice with the route priority symbols before any quest history', () => {
    expect(run({ ...fresh, placements: [older, newer] }).needsPractice).toEqual(['ㅓ', 'ㄹ']);
  });

  it('merges them behind real practice data, never repeating or flagging a recognised symbol', () => {
    const withHistory = { ...snap, placements: [newer] };
    const summary = summarize({ snapshot: withHistory, now: NOW, stage1QuestIds: ['q1'], questJamo: { q2: ['ㄷ', 'ㅓ'] } });
    expect(summary.needsPractice).toEqual(['ㄷ', 'ㅓ', 'ㄹ']);
  });

  it('a completed quest with nothing shaky keeps the seed, minus what the quests show is recognised', () => {
    const recognisedOnly = { ...snap, quests: snap.quests.filter((q) => q.questId === 'q1'), placements: [newer] };
    const summary = summarize({ snapshot: recognisedOnly, now: NOW, stage1QuestIds: ['q1'], questJamo: { q1: ['ㅓ'] } });
    expect(summary.jamoRecognized).toEqual(['ㅓ']);
    expect(summary.needsPractice).toEqual(['ㄹ']);
  });
});


describe('summarize: summary.journey (F-ROUTE-001 section 3.12, R-8)', () => {
  const journey = { v: 1 as const, here: 'stage1' as const, stages: [{ stage: 'stage1' as const, state: 'open' as const, done: 4, known: 0, total: 8 }] };

  it('passes the journey input through unchanged, schemaVersion staying 1', () => {
    const out = summarize({ snapshot: snap, now: NOW, stage1QuestIds: ['q1'], questJamo: {}, journey });
    expect(out.journey).toEqual(journey);
    expect(out.schemaVersion).toBe(1);
    expect(ProgressSummarySchema.parse(out).journey).toEqual(journey);
  });

  it('leaves the key out when no journey is given (summarize stays pure)', () => {
    expect(summarize({ snapshot: snap, now: NOW, stage1QuestIds: ['q1'], questJamo: {} })).not.toHaveProperty('journey');
  });
});

describe('summarize: summary.routeGoal (Learning Route section 9, LR-6)', () => {
  it('passes the goal input through unchanged, next to the journey, schemaVersion staying 1', () => {
    const out = summarize({ snapshot: snap, now: NOW, stage1QuestIds: ['q1'], questJamo: {}, routeGoal: { stage: 'stage2', from: 'class' } });
    expect(out.routeGoal).toEqual({ stage: 'stage2', from: 'class' });
    expect(out.schemaVersion).toBe(1);
    expect(ProgressSummarySchema.parse(out).routeGoal).toEqual({ stage: 'stage2', from: 'class' });
  });

  it('leaves the key out when no goal is given (summarize stays pure)', () => {
    expect(summarize({ snapshot: snap, now: NOW, stage1QuestIds: ['q1'], questJamo: {} })).not.toHaveProperty('routeGoal');
    expect(summarize({ snapshot: snap, now: NOW, stage1QuestIds: ['q1'], questJamo: {}, routeGoal: undefined })).not.toHaveProperty('routeGoal');
  });
});

describe('vocabSummaryOf (F-VOC-005 section 3.8)', () => {
  const TODAY = '2026-10-20';
  const w = (slug: string, over: Partial<VocabItemState> = {}): VocabItemState => ({
    id: `vocab:${slug}`,
    first: '2026-09-01',
    seen: 4,
    right: 4,
    bestBox: 2,
    last: '2026-10-01',
    box: 2,
    due: '2026-10-25',
    at: '2026-10-01T10:00:00.000Z',
    ...over,
  });
  const topic = (key: string, last: string) => ({ topic: key, bestStars: 1, sessions: 2, last, bestCaught: 0 });

  it('counts collected and strong words (bestBox 3 and up) and the topics started', () => {
    const v: VocabProgress = {
      v: 1,
      items: [w('a', { bestBox: 3, box: 1 }), w('b', { bestBox: 5, box: 5 }), w('c'), w('d', { bestBox: 1, box: 1 })],
      topics: [topic('food', '2026-10-01'), topic('animals', '2026-10-19')],
    };
    const out = vocabSummaryOf(v, TODAY);
    expect(out).toMatchObject({ collected: 4, strong: 2, topicsStarted: 2 });
    expect(VocabSummarySchema.safeParse(out).success).toBe(true);
  });

  it('counts topics practised in the last 7 days, today included (today minus 6 is in, minus 7 is out)', () => {
    const v: VocabProgress = {
      v: 1,
      items: [w('a')],
      topics: [topic('food', '2026-10-14'), topic('animals', '2026-10-13'), topic('colors', TODAY)],
    };
    expect(vocabSummaryOf(v, TODAY).topicsPracticed7d).toBe(2);
  });

  it('rounds the first-try rate to 2 decimals and is null when nothing was answered', () => {
    const rate = (items: VocabItemState[]) => vocabSummaryOf({ v: 1, items, topics: [] }, TODAY).firstTryRate;
    expect(rate([w('a', { seen: 3, right: 2 })])).toBe(0.67);
    expect(rate([w('a', { seen: 3, right: 1 }), w('b', { seen: 3, right: 3 })])).toBe(0.67);
    expect(rate([w('a', { seen: 0, right: 0 }), w('b', { seen: 0, right: 0 })])).toBeNull();
    expect(rate([w('a', { seen: 8, right: 8 })])).toBe(1);
  });

  it('rounds an exact half up, whatever the floating-point division says', () => {
    const rate = (items: VocabItemState[]) => vocabSummaryOf({ v: 1, items, topics: [] }, TODAY).firstTryRate;
    // 23 / 40 = 0.575 and 1 / 8 = 0.125: (right / seen) * 100 lands just under the half.
    expect(rate([w('a', { seen: 40, right: 23 })])).toBe(0.58);
    expect(rate([w('a', { seen: 8, right: 1 })])).toBe(0.13);
    for (let seen = 1; seen <= 400; seen++) {
      for (let right = 0; right <= seen; right++) {
        const want = Math.floor((right * 200 + seen) / (2 * seen)) / 100;
        expect(rate([w('a', { seen, right })])).toBe(want);
      }
    }
  });

  it('lists up to three words seen twice or more, now in box 1, lowest right/seen first', () => {
    const v: VocabProgress = {
      v: 1,
      items: [
        w('half', { seen: 4, right: 2, box: 1 }),
        w('none', { seen: 2, right: 0, box: 1 }),
        w('third', { seen: 3, right: 1, box: 1 }),
        w('mostly', { seen: 5, right: 4, box: 1 }),
        w('once', { seen: 1, right: 0, box: 1 }),
        w('higher', { seen: 4, right: 0, box: 2 }),
      ],
      topics: [],
    };
    expect(vocabSummaryOf(v, TODAY).needsPractice).toEqual(['vocab:none', 'vocab:third', 'vocab:half']);
  });

  it('breaks needsPractice ties by the most recent last, then id', () => {
    const v: VocabProgress = {
      v: 1,
      items: [
        w('b-old', { seen: 2, right: 1, box: 1, last: '2026-10-01' }),
        w('z-new', { seen: 4, right: 2, box: 1, last: '2026-10-18' }),
        w('a-new', { seen: 2, right: 1, box: 1, last: '2026-10-18' }),
        w('c-mid', { seen: 2, right: 1, box: 1, last: '2026-10-10' }),
      ],
      topics: [],
    };
    expect(vocabSummaryOf(v, TODAY).needsPractice).toEqual(['vocab:a-new', 'vocab:z-new', 'vocab:c-mid']);
  });

  it('gives a learner who never missed an empty list', () => {
    const v: VocabProgress = { v: 1, items: [w('a'), w('b', { box: 1, bestBox: 1, seen: 0, right: 0 })], topics: [] };
    expect(vocabSummaryOf(v, TODAY).needsPractice).toEqual([]);
  });
});

describe('summarize with words (F-VOC-005 section 3.8)', () => {
  const NOON = new Date(2026, 9, 20, 12);
  const item: VocabItemState = {
    id: 'vocab:sagwa-apple',
    first: '2026-10-10',
    seen: 3,
    right: 1,
    bestBox: 2,
    last: '2026-10-19',
    box: 1,
    due: '2026-10-20',
    at: '2026-10-19T10:00:00.000Z',
  };

  it('adds summary.vocab when the learner has collected words, and it parses', () => {
    const out = summarize({
      snapshot: { ...snap, vocab: { v: 1, items: [item], topics: [] } },
      now: NOON,
      stage1QuestIds: ['q1'],
      questJamo: {},
    });
    expect(out.vocab).toEqual({
      collected: 1,
      strong: 0,
      topicsStarted: 0,
      topicsPracticed7d: 0,
      firstTryRate: 0.33,
      needsPractice: ['vocab:sagwa-apple'],
    });
    expect(ProgressSummarySchema.parse(out).vocab).toEqual(out.vocab);
  });

  it('has no vocab key when nothing is collected: absent, empty or unreadable slice (behaviour 13)', () => {
    const run = (s: ProgressSnapshot) => summarize({ snapshot: s, now: NOON, stage1QuestIds: ['q1'], questJamo: {} });
    const base = run(snap);
    expect(base).not.toHaveProperty('vocab');
    expect(run({ ...snap, vocab: { v: 1, items: [], topics: [] } })).toEqual(base);
    const broken = { ...snap, vocab: { v: 2, items: 'nope' } } as unknown as ProgressSnapshot;
    expect(run(broken)).toEqual(base);
  });

  it('reads the day in the device time zone', () => {
    const tz = process.env.TZ;
    try {
      process.env.TZ = 'America/Los_Angeles';
      // 2026-10-21 03:00 UTC is still 2026-10-20 in Los Angeles: a topic last practised 2026-10-14 is within 7 days.
      const late = new Date('2026-10-21T03:00:00.000Z');
      const out = summarize({
        snapshot: { ...snap, vocab: { v: 1, items: [item], topics: [{ topic: 'food', bestStars: 0, sessions: 1, last: '2026-10-14', bestCaught: 0 }] } },
        now: late,
        stage1QuestIds: ['q1'],
        questJamo: {},
      });
      expect(out.vocab?.topicsPracticed7d).toBe(1);
    } finally {
      // Assigning undefined would store the string "undefined" and leak a bogus zone.
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });
});
