import type { LearnerReportResponse, ReportSummary, SpaceKind, StageKey } from '@hangul-route/content-schema';

/**
 * FROZEN fixtures for the console report view (F-REPORT-001 RP-7a1), on Thursday 15 October 2026 at 12:00 UTC. The
 * learner data mirror `packages/content-schema/src/reports/__tests__/fixtures/activity-2026-10.ts` (behaviours 1 and
 * 2 of section 3.15): never edit the counts to follow the code; add a new dated fixture instead.
 */
export const NOW = new Date('2026-10-15T12:00:00.000Z');

const TITLES: Record<StageKey, string> = {
  stage1: 'Hangul',
  stage2: 'Words',
  stage3: 'Sentences',
  stage4: 'Dialogue',
  stage5: 'Story',
  stage6: 'Real use',
  stage7: 'Self-expression',
};
export const stageTitle = (stage: StageKey): string => TITLES[stage];

/** The level check every fixture shares; `oralStage` is set so a test can prove the view never reads it. */
export const PLACEMENT = {
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
 * Mina, a steady week: Mon 12, Wed 14 and Thu 15 October for 12, 9 and 15 minutes (36), two new quests; the week
 * before (2 to 8 October) had 40 minutes on 2 days. Los Angeles (UTC-7), saved today.
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

/** Dae, whose device last saved on 2 October (13 days ago): the stale state, a week wholly after `asOf`. */
export const STALE = {
  ...STEADY,
  lastActiveAt: '2026-10-02T18:00:00.000Z',
  activity: {
    ...STEADY.activity,
    tz: 0,
    asOf: '2026-10-02',
    days: [
      { d: '2026-09-28', min: 10, q: 1, c: 0, w: 0, j: [] },
      { d: '2026-10-02', min: 14, q: 0, c: 1, w: 0, j: ['ㅂ'] },
    ],
    months: [
      { m: '2026-09', min: 10, q: 1, c: 0, w: 0, days: 1 },
      { m: '2026-10', min: 14, q: 0, c: 1, w: 0, days: 1 },
    ],
    total: { since: '2026-09-28', min: 24, q: 1, c: 1, w: 0, days: 2 },
    milestones: [{ stage: 'stage1', on: '2026-10-02' }],
  },
} as const satisfies ReportSummary;

/** Sora on an app build from before RP-4: no `activity`, the legacy state. */
export const LEGACY = {
  lastActiveAt: '2026-10-14T16:00:00.000Z',
  streakDays: 1,
  stage1: { questsDone: 3, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 2,
  minutesLast7d: 20,
  jamoRecognized: ['ㅏ', 'ㄱ'],
  needsPractice: ['ㄴ'],
  journey: JOURNEY,
  planProgress: { 'plan:class-week': { done: 2, total: 2, notReady: 0 } },
} as const satisfies ReportSummary;

/** Hana, who joined and never practiced: the empty state with the app's next quest. */
export const EMPTY = {
  lastActiveAt: '',
  stage1: { questsDone: 0, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 0,
  journey: JOURNEY,
  activity: {
    v: 1,
    tz: 0,
    asOf: '2026-10-15',
    days: [],
    months: [],
    total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 },
    milestones: [],
    next: { q: 'quest:stage1-letters-q1', plan: false },
  },
} as const satisfies ReportSummary;

/** The Worker's body for one learner in a space of `kind`. */
export function response(
  summary: ReportSummary | null,
  over: { kind?: SpaceKind; name?: string; archivedAt?: string | null; spaceName?: string; lastSyncedAt?: string | null } = {},
): LearnerReportResponse {
  const kind = over.kind ?? 'family';
  return {
    space: {
      id: kind === 'class' ? 'space:sunflower' : 'space:kim-family',
      kind,
      name: over.spaceName ?? (kind === 'class' ? 'Sunflower' : 'Kim family'),
      parentSpaceId: null,
      settings: { consentMode: 'parent', anonymizeRoster: false },
      archivedAt: over.archivedAt ?? null,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    learner: { id: 'profile:mina', displayName: over.name ?? 'Mina', avatar: 'tiger', joinedAt: '2026-09-02T00:00:00.000Z', lastActiveAt: '2026-10-15T09:30:00.000Z' },
    summary,
    lastSyncedAt: over.lastSyncedAt === undefined ? '2026-10-15T09:31:00.000Z' : over.lastSyncedAt,
    serverTime: NOW.toISOString(),
  };
}
