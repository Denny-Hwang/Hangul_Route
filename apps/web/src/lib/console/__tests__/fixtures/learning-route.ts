import { StageKeySchema, ThemeKeySchema, type Catalog, type CurriculumMeta, type PlanItem, type StageKey } from '@hangul-route/content-schema';
import type { PlanView, RosterLearner, RosterSummary } from '../../api';

/**
 * Frozen inputs for the Learning Route view models (amendment section 6.1 and 6.3, LR-7):
 * the October 2026 catalogue shape (Stage 1 full, a Stage 2 and a Stage 4 taste, every other
 * stage coming later), stage titles, curriculum plans and roster rows. Tests pass this catalogue
 * explicitly, so new shipped content never changes their expectations.
 */

export const TODAY = '2026-10-11';

const SHIPPED: Readonly<Record<string, readonly string[]>> = {
  'stage1-letters': ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'],
  'stage1-life': ['quest:stage1-life-q1', 'quest:stage1-life-q2'],
  'stage1-rites': ['quest:stage1-rites-q1'],
  'stage1-nature': ['quest:stage1-nature-q1'],
  'stage1-crafts': ['quest:stage1-crafts-q1'],
  'stage2-life': ['quest:stage2-life-q1'],
  'stage2-nature': ['quest:stage2-nature-q1'],
  'stage4-rites': ['quest:stage4-rites-q1'],
};

const keyParts = (key: string): { stage: StageKey; theme: (typeof ThemeKeySchema.options)[number] } => {
  const [stage, theme] = key.split('-') as [StageKey, (typeof ThemeKeySchema.options)[number]];
  return { stage, theme };
};

export const ROUTE_CATALOG: Catalog = {
  version: 1,
  cells: StageKeySchema.options.flatMap((stage) =>
    ThemeKeySchema.options.map((theme) => {
      const questIds = [...(SHIPPED[`${stage}-${theme}`] ?? [])];
      return { stage, theme, episodeId: `episode:${stage}-${theme}`, title: `${stage} ${theme}`, status: questIds.length > 0 ? ('shipped' as const) : ('preview' as const), minutes: 10, questIds };
    }),
  ),
  quests: [
    ...Object.entries(SHIPPED).flatMap(([key, ids]) =>
      ids.map((id) => ({ id, episodeId: `episode:${key}`, ...keyParts(key), title: id, minutes: 5, teaches: [], kind: 'lesson' as const })),
    ),
    // A shelf story quest: never a lesson, so it never moves a plan goal.
    { id: 'quest:story-moon', episodeId: 'episode:story-moon', stage: 'stage5', theme: 'nature', title: 'Moon story', minutes: 5, teaches: [], kind: 'story' },
  ],
  stories: [],
  topics: [],
};

const TITLES: Readonly<Record<StageKey, string>> = {
  stage1: 'Hangul',
  stage2: 'Words',
  stage3: 'Sentences',
  stage4: 'Dialogue',
  stage5: 'Stories',
  stage6: 'Real-use',
  stage7: 'Self-expression',
};
export const stageTitle = (stage: StageKey): string => TITLES[stage];

/** A curriculum meta of `weeks` weeks from `start` (a Monday or not, it does not matter here). */
export const meta = (start = '2026-10-05', weeks = 4): CurriculumMeta => ({
  kind: 'curriculum',
  generatorVersion: 1,
  catalogVersion: 4,
  params: {
    audience: 'class',
    level: { stage: 'stage1', band: 0 },
    startDate: start,
    weeks,
    sessionsPerWeek: 2,
    minutesPerSession: 10,
    daysOff: [],
    goals: { focus: 'balanced' },
    includeComingSoon: true,
    culturalAnchors: true,
    unlockedStages: ['stage1'],
  },
  weeks: Array.from({ length: weeks }, (_, i) => ({
    index: i + 1,
    startDate: new Date(Date.parse(`${start}T00:00:00.000Z`) + 7 * i * 86_400_000).toISOString().slice(0, 10),
    kind: 'learn' as const,
    focus: { episodeId: null, storyIds: [], festival: null },
    extras: [],
  })),
  horizonDays: 7,
  repacedAt: null,
});

export const quest = (id: string): PlanItem => ({ kind: 'quest', id });

/** A published, unarchived curriculum plan for everyone in the space, ending Nov 1 (four weeks from Oct 5). */
export const plan = (over: Partial<PlanView> & Pick<PlanView, 'id'>): PlanView => ({
  spaceId: 'space:x',
  authorAccountId: 'account:grown-up',
  title: 'Weekly plan',
  items: [quest('quest:stage2-life-q1')],
  targetLearnerIds: null,
  publishedAt: '2026-10-05T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-04T09:00:00.000Z',
  updatedAt: '2026-10-05T09:00:00.000Z',
  meta: meta(),
  ...over,
});

export type JourneyRow = { stage: string; state: string; done: number; known: number; total: number };

/** Appendix C: four known from the level check and two done in Stage 1, the Stage 4 taste played. */
export const journeyRows = (over: Partial<Record<StageKey, Partial<JourneyRow>>> = {}): JourneyRow[] =>
  StageKeySchema.options.map((stage) => {
    const base: JourneyRow =
      stage === 'stage1'
        ? { stage, state: 'open', done: 2, known: 4, total: 8 }
        : stage === 'stage2'
          ? { stage, state: 'open', done: 0, known: 0, total: 2 }
          : stage === 'stage4'
            ? { stage, state: 'open', done: 1, known: 0, total: 1 }
            : { stage, state: 'later', done: 0, known: 0, total: 0 };
    return { ...base, ...over[stage] };
  });

export const journey = (rows: JourneyRow[] = journeyRows(), here: string | null = 'stage1') => ({ v: 1 as const, here, stages: rows, seeded: true as const });

export const placement = (stage: StageKey = 'stage1', band = 2) => ({
  takenAt: '2026-10-09T12:00:00.000Z',
  level: { stage, band },
  oralStage: null,
  strands: {
    'hangul-recognition': 'secure' as const,
    'sound-letter': 'secure' as const,
    'syllable-reading': 'getting-there' as const,
    vocabulary: 'not-tested' as const,
    sentences: 'not-tested' as const,
  },
  beyondContent: false,
  overridden: false,
});

/** A roster summary as a family space receives it; a class roster never carries `routeGoal` or `selfRoute`. */
export const summary = (over: Record<string, unknown> = {}): RosterSummary =>
  ({
    lastActiveAt: '2026-10-11T08:00:00.000Z',
    streakDays: 2,
    stage1: { questsDone: 2, questsTotal: 8, anchorAccuracy: null },
    cardsUnlocked: 3,
    minutesLast7d: 20,
    jamoRecognized: [],
    needsPractice: [],
    planProgress: {},
    journey: journey(),
    ...over,
  }) as RosterSummary;

export const learner = (over: Partial<RosterLearner> = {}): RosterLearner => ({
  id: 'learner:sam',
  displayName: 'Sam',
  ageGroup: '8-9',
  avatar: 'tiger',
  joinedAt: '2026-10-01T00:00:00.000Z',
  lastActiveAt: '2026-10-11T08:00:00.000Z',
  summary: summary(),
  lastSyncedAt: '2026-10-11T15:00:00.000Z',
  ...over,
});
