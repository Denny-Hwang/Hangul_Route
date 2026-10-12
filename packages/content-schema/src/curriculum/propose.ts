import { routeCatalogOf } from '../catalog/route-catalog';
import type { Catalog } from '../catalog/schema';
import { inRouteOrder, placementStageNumber } from '../placement/level-map';
import { themeOrderFor, type RouteSeed } from '../placement/route-seed';
import type { StageKey } from '../schemas/heritage-card';
import type { PlanItem } from '../schemas/plan-item';
import type { Motivation, PlacementLevel } from '../schemas/placement';
import type { CurriculumDraft, CurriculumMeta, WarningCode } from './draft';
import { generateCurriculum, regenerateFrom } from './generate';
import { CurriculumParamsSchema, sessionsPerWeekOf, type CurriculumParams, type CurriculumParamsInput, type DateKey } from './params';
import {
  DEFAULT_SHORT_MAX,
  DEFAULT_TERM_MAX,
  LENGTH_PRESETS,
  PACES,
  PICTURES_FIRST_MINUTES,
  type CurriculumAudience,
  type LengthPresetId,
  type PaceId,
} from './presets';

/**
 * `proposeRoute` (F-PLAN-002 section 3.1a, AMENDMENTS-PLC-PLAN-HANDOFF section 1):
 * a recommended weekly plan from where the learner starts, the audience, the D1
 * reading level, the chosen pace and the tier. The console wizard and the app call
 * this one function, so the same input pre-selects the same pace and length on both.
 * Pure: no clock, no randomness, no locale; codes and counts only, words come from
 * the UI's messages.
 */

export type DurationId = LengthPresetId;
/** The three length cards, in this order (AMENDMENTS section 1.3). */
export const DURATION_IDS: readonly DurationId[] = ['4-week', '12-week', '6-month'];

/** The probe that measures what there is to teach at a pace (AMENDMENTS section 1.1). */
export const PROBE_WEEKS = 52;

export type ProposalPreview = 'lessons-and-stories' | 'lessons-cut-short' | 'lessons-then-free-practice' | 'stories-and-words';
export type ProposalHeadline = 'start-stage1' | 'continue-stage1' | 'stories-and-words' | 'beyond-content';

export interface ProposeInput {
  audience: CurriculumAudience;
  /** `effectiveRoute` with real completions; null = no level check (stage1 band 0). */
  seed: Pick<RouteSeed, 'level' | 'oralStage' | 'placedOutQuestIds' | 'themeOrder' | 'startQuestId'> | null;
  motivation?: Motivation;
  /** A single learner; empty for a class. */
  completedQuestIds: readonly string[];
  /** D1 reading level: pre-selects the pace and the minutes only. */
  levelOrder: 0 | 1 | 2 | null;
  /** The chip the learner or grown-up picked; absent = the default. */
  pace?: PaceId;
  rosterLevelOrders?: readonly (0 | 1 | 2)[];
  unlockedStages: readonly StageKey[];
  catalog: Catalog;
  today: DateKey;
  existing?: { meta: CurriculumMeta; items: PlanItem[] } | null;
}

export interface DurationOption {
  id: DurationId;
  weeks: 4 | 12 | 26;
  stats: Pick<CurriculumDraft['stats'], 'lessons' | 'stories' | 'comingSoonItems' | 'openSessions' | 'endsAtStage'>;
  /**
   * The week of this card's last lesson; when the card cannot hold every lesson,
   * the week they would finish in (always above `weeks`), so the preview never claims a finish.
   */
  lastLessonWeek: number;
  /** The week of the card's last lesson or story; 0 when it has none. */
  lastContentWeek: number;
  preview: ProposalPreview;
  warnings: WarningCode[];
}

export interface RouteProposal {
  kind: 'new' | 'update' | 'unchanged';
  headline: ProposalHeadline;
  pace: PaceId;
  /** `new`: the recommended card's params; `update` / `unchanged`: the re-seeded plan's (its length and end date). */
  params: CurriculumParams;
  options: readonly [DurationOption, DurationOption, DurationOption];
  defaultId: DurationId;
  /** `update` only: future items (dated today or later) that leave and join the plan, and its next lesson. */
  diff?: { itemsRemoved: number; itemsAdded: number; newStartQuestId: string | null };
}

/** Gentle for "Pictures first" (`levelOrder` 0) and for classes, Steady otherwise (OD-13). */
export const defaultPaceFor = (audience: CurriculumAudience, levelOrder: 0 | 1 | 2 | null): PaceId =>
  audience === 'class' || levelOrder === 0 ? 'gentle' : 'steady';

/** Section 3.1 minutes: 10 for "Pictures first" (a class: most of its roster), else 15. */
export const defaultMinutesFor = (
  audience: CurriculumAudience,
  levelOrder: 0 | 1 | 2 | null,
  rosterLevelOrders: readonly (0 | 1 | 2)[] = [],
): 10 | 15 => {
  if (audience === 'class') {
    const picturesFirst = rosterLevelOrders.filter((order) => order === 0).length;
    return picturesFirst * 2 > rosterLevelOrders.length ? PICTURES_FIRST_MINUTES : 15;
  }
  return levelOrder === 0 ? PICTURES_FIRST_MINUTES : 15;
};

/** The recommended length from the probe's last lesson week (OD-12, thresholds 4 and 16). */
export const defaultDurationFor = (lastLessonWeek: number): DurationId => {
  if (lastLessonWeek <= DEFAULT_SHORT_MAX) return '4-week';
  if (lastLessonWeek <= DEFAULT_TERM_MAX) return '12-week';
  return '6-month';
};

const START_LEVEL: PlacementLevel = { stage: 'stage1', band: 0 };
const CANONICAL_ORDER = themeOrderFor(undefined);

/** The pace of a stored plan, when its sessions a week match a chip. */
const paceOfSessions = (sessions: number): PaceId | undefined =>
  (Object.keys(PACES) as PaceId[]).find((pace) => PACES[pace] === sessions);

interface Measures {
  isLesson: (item: Pick<PlanItem, 'kind' | 'id'>) => boolean;
  /** A lesson or a story quest (not a coming-soon placeholder). */
  isContent: (item: Pick<PlanItem, 'kind' | 'id'>) => boolean;
  lastWeek: (draft: CurriculumDraft, test: (item: Pick<PlanItem, 'kind' | 'id'>) => boolean) => number;
}

const measuresOf = (catalog: Catalog): Measures => {
  const kinds = new Map(catalog.quests.map((quest) => [quest.id, quest.kind]));
  const storyQuests = new Set(catalog.stories.map((story) => story.questId));
  const isLesson = (item: Pick<PlanItem, 'kind' | 'id'>): boolean => item.kind === 'quest' && kinds.get(item.id) === 'lesson';
  return {
    isLesson,
    isContent: (item) => isLesson(item) || (item.kind === 'quest' && storyQuests.has(item.id)),
    lastWeek: (draft, test) => draft.items.reduce((top, item) => (test(item) ? Math.max(top, item.week) : top), 0),
  };
};

/** Section 1.3: a card never claims a finish its draft does not reach. */
const previewOf = (draft: CurriculumDraft, weeks: number, lastLessonWeek: number): ProposalPreview => {
  if (draft.stats.lessons === 0) return 'stories-and-words';
  if (lastLessonWeek > weeks) return 'lessons-cut-short';
  return draft.stats.stories > 0 ? 'lessons-and-stories' : 'lessons-then-free-practice';
};

const optionOf = (id: DurationId, base: CurriculumParamsInput, catalog: Catalog, probeLastLesson: number, m: Measures): DurationOption => {
  const weeks = LENGTH_PRESETS[id].weeks as DurationOption['weeks'];
  const draft = generateCurriculum({ ...base, weeks }, catalog);
  const allFit = !draft.warnings.some((warning) => warning.code === 'fewer-sessions-than-units');
  const lastLessonWeek = allFit ? m.lastWeek(draft, m.isLesson) : Math.max(probeLastLesson, weeks + 1);
  const { lessons, stories, comingSoonItems, openSessions, endsAtStage } = draft.stats;
  return {
    id,
    weeks,
    stats: { lessons, stories, comingSoonItems, openSessions, endsAtStage },
    lastLessonWeek,
    lastContentWeek: m.lastWeek(draft, m.isContent),
    preview: previewOf(draft, weeks, lastLessonWeek),
    warnings: draft.warnings.map((warning) => warning.code),
  };
};

/** Stage 1 from its first quest, Stage 1 from later on, or no Stage 1 lesson left (by the level's stage). */
const headlineOf = (probe: CurriculumDraft, level: PlacementLevel, catalog: Catalog, m: Measures): ProposalHeadline => {
  const first = probe.items.find(m.isLesson);
  const quest = first === undefined ? undefined : catalog.quests.find((candidate) => candidate.id === first.id);
  if (quest?.stage === 'stage1') {
    const opening = inRouteOrder(routeCatalogOf(catalog)).find((candidate) => candidate.grid && candidate.playable);
    return opening?.id === quest.id ? 'start-stage1' : 'continue-stage1';
  }
  return placementStageNumber(level.stage) >= 3 ? 'beyond-content' : 'stories-and-words';
};

/** The params every card shares: the pace's sessions, the minutes, the seed's start and goals, today. */
const baseParamsOf = (input: ProposeInput, pace: PaceId): CurriculumParamsInput => {
  const { seed, motivation } = input;
  // The seed's theme order carries the newest result's motivation; a motivation given here wins.
  const ordered = seed !== null && motivation === undefined && seed.themeOrder.some((theme, i) => theme !== CANONICAL_ORDER[i]);
  return {
    audience: input.audience,
    level: seed?.level ?? START_LEVEL,
    ...(seed === null ? {} : { placedOutQuestIds: [...seed.placedOutQuestIds] }),
    completedQuestIds: [...input.completedQuestIds],
    startDate: input.today,
    weeks: PROBE_WEEKS,
    sessionsPerWeek: PACES[pace],
    minutesPerSession: defaultMinutesFor(input.audience, input.levelOrder, input.rosterLevelOrders),
    goals: {
      focus: 'balanced',
      ...(ordered && seed !== null ? { themes: [...seed.themeOrder] } : {}),
      ...(motivation === undefined ? {} : { motivation }),
    },
    unlockedStages: [...input.unlockedStages],
  };
};

/** One recommended weekly plan, or null when nothing ready can be scheduled (and no plan exists yet). */
export function proposeRoute(input: ProposeInput): RouteProposal | null {
  const { catalog, today } = input;
  const existing = input.existing ?? null;
  const m = measuresOf(catalog);
  const chosen = input.pace ?? defaultPaceFor(input.audience, input.levelOrder);
  const base = baseParamsOf(input, chosen);

  const probe = generateCurriculum(base, catalog);
  if (existing === null && probe.stats.readyItems === 0) return null;
  const probeLastLesson = m.lastWeek(probe, m.isLesson);
  const defaultId = defaultDurationFor(probeLastLesson);
  const options = DURATION_IDS.map((id) => optionOf(id, base, catalog, probeLastLesson, m)) as unknown as RouteProposal['options'];
  const headline = headlineOf(probe, probe.params.level, catalog, m);

  if (existing === null) {
    const params = CurriculumParamsSchema.parse({ ...base, weeks: LENGTH_PRESETS[defaultId].weeks });
    return { kind: 'new', headline, pace: chosen, params, options, defaultId };
  }

  // Exactly `regenerateFrom(existing, today, catalog, { mode: 'reseed', paramsPatch })`: the learner's
  // completions are left out, so a quest finished early never reads as a new place to start
  // (derivation marks a finished quest done on any date).
  const seed = input.seed;
  const reseeded = regenerateFrom(existing, today, catalog, {
    mode: 'reseed',
    paramsPatch: seed === null ? {} : { level: seed.level, placedOutQuestIds: [...seed.placedOutQuestIds] },
  });
  const ahead = (items: readonly PlanItem[]): PlanItem[] => items.filter((item) => item.targetDate === undefined || item.targetDate >= today);
  const before = ahead(existing.items);
  const after = ahead(reseeded.items);
  const key = (item: PlanItem): string => `${item.kind}|${item.id}|${String(item.targetDate)}`;
  const pace = paceOfSessions(sessionsPerWeekOf(existing.meta.params)) ?? chosen;
  const same = before.length === after.length && before.every((item, i) => key(item) === key(after[i] as PlanItem));
  if (same) return { kind: 'unchanged', headline, pace, params: reseeded.params, options, defaultId };

  const beforeIds = new Set(before.map((item) => item.id));
  const afterIds = new Set(after.map((item) => item.id));
  return {
    kind: 'update',
    headline,
    pace,
    params: reseeded.params,
    options,
    defaultId,
    diff: {
      itemsRemoved: before.filter((item) => !afterIds.has(item.id)).length,
      itemsAdded: after.filter((item) => !beforeIds.has(item.id)).length,
      newStartQuestId: after.find(m.isLesson)?.id ?? null,
    },
  };
}
