import type { ReportSummary } from '../../../schemas/report-response';

/**
 * FROZEN. Four learners as a report reads them (F-REPORT-001 section 5), on Thursday 15 October 2026 at 12:00 UTC:
 * a steady week, a learner with a gap, a learner on an old build (no `activity`) and a learner whose device last
 * saved 4 days ago. The counts are the section 3.15 behaviours: never edit them to follow the code; add a new dated
 * fixture instead. Every summary parses with `ReportSummarySchema` (test).
 */
export const NOW = new Date('2026-10-15T12:00:00.000Z');

/** Shared level check: `oralStage` is set so a test can prove the report never reads it. */
const PLACEMENT = {
  takenAt: '2026-10-10T09:00:00.000Z',
  level: { stage: 'stage1', band: 1 },
  oralStage: 'stage2',
  strands: {
    'hangul-recognition': 'secure',
    'sound-letter': 'getting-there',
    'syllable-reading': 'not-yet',
    vocabulary: 'not-tested',
    sentences: 'not-tested',
  },
  beyondContent: false,
  overridden: false,
} as const satisfies ReportSummary['placement'];

const JOURNEY = {
  v: 1,
  here: 'stage1',
  stages: [
    { stage: 'stage1', state: 'open', done: 7, known: 0, total: 15 },
    { stage: 'stage2', state: 'later', done: 0, known: 0, total: 2 },
  ],
} as const satisfies ReportSummary['journey'];

/**
 * Mina, a steady week (behaviours 1 and 2): Mon 12, Wed 14 and Thu 15 October for 12, 9 and 15 minutes (36), two
 * new quests; the week before (2 to 8 October) had 40 minutes on 2 days. Los Angeles (UTC-7), saved today.
 * September: 6 practice days, 95 minutes, 3 quests, 3 cards (two of them before the day rows begin on 11 September).
 */
export const STEADY = {
  lastActiveAt: '2026-10-15T09:30:00.000Z',
  streakDays: 2,
  stage1: { questsDone: 7, questsTotal: 15, anchorAccuracy: 0.86 },
  cardsUnlocked: 5,
  minutesLast7d: 36,
  jamoRecognized: ['ㄱ', 'ㄴ', 'ㅁ', 'ㅇ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'],
  needsPractice: ['ㅂ', 'ㅅ'],
  placement: PLACEMENT,
  planProgress: { 'plan:family-week': { done: 3, total: 5, notReady: 1 } },
  journey: JOURNEY,
  selfRoute: { done: 2, total: 4, notReady: 1, weeks: 4, endsOn: '2026-11-01' },
  activity: {
    v: 1,
    tz: -420,
    asOf: '2026-10-15',
    days: [
      { d: '2026-09-15', min: 20, q: 1, c: 1, w: 0, j: ['ㅏ', 'ㅓ'] },
      { d: '2026-09-18', min: 15, q: 0, c: 0, w: 0, j: [] },
      { d: '2026-09-22', min: 15, q: 1, c: 1, w: 0, j: ['ㅗ', 'ㅜ'] },
      { d: '2026-09-26', min: 15, q: 0, c: 0, w: 0, j: ['ㅁ'] },
      { d: '2026-10-03', min: 20, q: 1, c: 1, w: 0, j: ['ㅇ'] },
      { d: '2026-10-06', min: 20, q: 1, c: 0, w: 0, j: [] },
      { d: '2026-10-12', min: 12, q: 1, c: 1, w: 0, j: ['ㄱ'] },
      { d: '2026-10-14', min: 9, q: 0, c: 0, w: 0, j: [] },
      { d: '2026-10-15', min: 15, q: 1, c: 0, w: 0, j: ['ㄴ'] },
    ],
    months: [
      { m: '2026-09', min: 95, q: 3, c: 3, w: 0, days: 6 },
      { m: '2026-10', min: 76, q: 4, c: 2, w: 0, days: 5 },
    ],
    total: { since: '2026-09-05', min: 171, q: 7, c: 5, w: 0, days: 11 },
    milestones: [],
    next: { q: 'quest:stage1-life-q2', plan: true },
    revisit: 'quest:stage1-life-q2',
  },
} as const satisfies ReportSummary;

/**
 * Jun, a gap: three practice days in late September, nothing since. Seoul (UTC+9); the device last computed its
 * summary yesterday, 14 October, so this week reaches one day past the data.
 */
export const GAP = {
  lastActiveAt: '2026-10-14T01:00:00.000Z',
  streakDays: 0,
  stage1: { questsDone: 2, questsTotal: 15, anchorAccuracy: 0.7 },
  cardsUnlocked: 2,
  minutesLast7d: 0,
  jamoRecognized: ['ㄱ'],
  needsPractice: ['ㅂ'],
  planProgress: {},
  activity: {
    v: 1,
    tz: 540,
    asOf: '2026-10-14',
    days: [
      { d: '2026-09-20', min: 10, q: 1, c: 1, w: 0, j: ['ㄱ'] },
      { d: '2026-09-21', min: 8, q: 1, c: 0, w: 0, j: [] },
      { d: '2026-09-23', min: 12, q: 0, c: 1, w: 0, j: [] },
    ],
    months: [{ m: '2026-09', min: 30, q: 2, c: 2, w: 0, days: 3 }],
    total: { since: '2026-09-20', min: 30, q: 2, c: 2, w: 0, days: 3 },
    milestones: [],
  },
} as const satisfies ReportSummary;

/** Ari, on an app build from before RP-4: no `activity` (behaviour 7). */
export const LEGACY = {
  lastActiveAt: '2026-10-10T08:00:00.000Z',
  streakDays: 1,
  stage1: { questsDone: 3, questsTotal: 15, anchorAccuracy: 0.9 },
  cardsUnlocked: 2,
  minutesLast7d: 14,
  jamoRecognized: ['ㄷ', 'ㄱ', 'ㄴ'],
  needsPractice: ['ㄹ'],
  placement: PLACEMENT,
  planProgress: { 'plan:class-week': { done: 1, total: 4, notReady: 2 } },
  journey: JOURNEY,
} as const satisfies ReportSummary;

/**
 * Sora, saved 4 days ago (behaviour 13): practiced every day from 1 to 11 October, finished Stage 1 on the 10th;
 * the device last computed its summary on the 11th. UTC.
 */
export const STALE4 = {
  lastActiveAt: '2026-10-11T18:00:00.000Z',
  streakDays: 11,
  stage1: { questsDone: 15, questsTotal: 15, anchorAccuracy: 0.92 },
  cardsUnlocked: 9,
  minutesLast7d: 30,
  jamoRecognized: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'],
  needsPractice: [],
  planProgress: {},
  activity: {
    v: 1,
    tz: 0,
    asOf: '2026-10-11',
    days: [
      { d: '2026-10-01', min: 10, q: 1, c: 1, w: 0, j: [] },
      { d: '2026-10-02', min: 10, q: 1, c: 1, w: 0, j: [] },
      { d: '2026-10-03', min: 10, q: 1, c: 1, w: 0, j: [] },
      { d: '2026-10-04', min: 10, q: 1, c: 0, w: 0, j: [] },
      { d: '2026-10-05', min: 10, q: 1, c: 1, w: 0, j: [] },
      { d: '2026-10-06', min: 10, q: 1, c: 0, w: 0, j: [] },
      { d: '2026-10-07', min: 10, q: 1, c: 1, w: 0, j: [] },
      { d: '2026-10-08', min: 10, q: 1, c: 0, w: 0, j: [] },
      { d: '2026-10-09', min: 10, q: 1, c: 1, w: 0, j: ['ㄷ'] },
      { d: '2026-10-10', min: 10, q: 5, c: 3, w: 0, j: ['ㄹ'] },
      { d: '2026-10-11', min: 10, q: 1, c: 0, w: 0, j: [] },
    ],
    months: [{ m: '2026-10', min: 110, q: 15, c: 9, w: 0, days: 11 }],
    total: { since: '2026-10-01', min: 110, q: 15, c: 9, w: 0, days: 11 },
    milestones: [{ stage: 'stage1', on: '2026-10-10' }],
  },
} as const satisfies ReportSummary;

/** The server's last sync of each learner, as the report route returns it. */
export const LAST_SYNCED: Readonly<Record<'steady' | 'gap' | 'legacy' | 'stale4', string>> = {
  steady: '2026-10-15T09:31:00.000Z',
  gap: '2026-10-14T01:01:00.000Z',
  legacy: '2026-10-10T08:01:00.000Z',
  stale4: '2026-10-11T18:01:00.000Z',
};
