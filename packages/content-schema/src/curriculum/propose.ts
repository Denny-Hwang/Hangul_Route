import { routeCatalogOf } from '../catalog/route-catalog';
import type { Catalog } from '../catalog/schema';
import { inRouteOrder, placementLevelRank, placementStageNumber, questsPlacedOutAtLevel } from '../placement/level-map';
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
/**
 * Where the plan starts (section 3.1a): `start-stage1` at the opening Stage 1 lesson,
 * `continue-stage1` at a later Stage 1 lesson, `continue-lessons` at a lesson of a later
 * stage; with no lesson to schedule, `stories-and-words` (a level below Stage 3) or
 * `beyond-content` (Stage 3 or higher, past the published lessons).
 */
export type ProposalHeadline = 'start-stage1' | 'continue-stage1' | 'continue-lessons' | 'stories-and-words' | 'beyond-content';

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
  /** The freeze point for an existing plan, and a new plan's start unless `startDate` is given. */
  today: DateKey;
  /** A new plan's first day, on or after `today` (a class: its next class day, from the wizard); absent = `today`. */
  startDate?: DateKey;
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
  /** `new`: the recommended card's params; `update` / `unchanged`: the re-seeded plan's (its length and end date). Every kind carries the learner's completions. */
  params: CurriculumParams;
  options: readonly [DurationOption, DurationOption, DurationOption];
  defaultId: DurationId;
  /**
   * `update` only: future items (dated today or later, the learner's finished quests left out)
   * that leave and join the plan, and its next lesson. Applying an update is
   * `regenerateFrom(existing, today, catalog, { mode: 'reseed', paramsPatch, completedQuestIds })`,
   * which rebuilds the future from the catalogue (hand-picked future items included), so the
   * screen shows `itemsRemoved` before the grown-up confirms.
   */
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

/** The stage of the probe's first lesson; with no lesson, the level's stage (see `ProposalHeadline`). */
const headlineOf = (probe: CurriculumDraft, level: PlacementLevel, catalog: Catalog, m: Measures): ProposalHeadline => {
  const first = probe.items.find(m.isLesson);
  const quest = first === undefined ? undefined : catalog.quests.find((candidate) => candidate.id === first.id);
  if (quest === undefined) return placementStageNumber(level.stage) >= 3 ? 'beyond-content' : 'stories-and-words';
  if (quest.stage !== 'stage1') return 'continue-lessons';
  const opening = inRouteOrder(routeCatalogOf(catalog)).find((candidate) => candidate.grid && candidate.playable);
  return opening?.id === quest.id ? 'start-stage1' : 'continue-stage1';
};

/** The params every card shares: the pace's sessions, the minutes, the seed's start and goals, the start day. */
const baseParamsOf = (input: ProposeInput, pace: PaceId, minutesPerSession: CurriculumParams['minutesPerSession']): CurriculumParamsInput => {
  const { seed, motivation } = input;
  // The seed's theme order carries the newest result's motivation; a motivation given here wins.
  const ordered = seed !== null && motivation === undefined && seed.themeOrder.some((theme, i) => theme !== CANONICAL_ORDER[i]);
  return {
    audience: input.audience,
    level: seed?.level ?? START_LEVEL,
    ...(seed === null ? {} : { placedOutQuestIds: [...seed.placedOutQuestIds] }),
    completedQuestIds: [...input.completedQuestIds],
    startDate: input.startDate ?? input.today,
    weeks: PROBE_WEEKS,
    sessionsPerWeek: PACES[pace],
    minutesPerSession,
    goals: {
      focus: 'balanced',
      ...(ordered && seed !== null ? { themes: [...seed.themeOrder] } : {}),
      ...(motivation === undefined ? {} : { motivation }),
    },
    unlockedStages: [...input.unlockedStages],
  };
};

const sameSet = (a: readonly string[], b: readonly string[]): boolean => {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((id) => right.has(id));
};

/**
 * One recommended weekly plan, or null when no plan exists and the probe schedules
 * no ready item. With `existing` it is always `update` or `unchanged`.
 *
 * With `existing`, the kind follows the start alone (rule 4): `unchanged` when the seed
 * would not move the stored level (it never goes lower) or the stored placed-out set,
 * when the re-seed lays out the same future as re-pacing the plan as it is, or when the
 * re-seeded future would hold no lesson or story (no update empties a plan). A
 * grown-up's hand edits, a plan extended by weeks and new catalogue lessons never read
 * as a new start. `params` is the re-seeded plan's, with the learner's completions.
 * The pace, the cards, `defaultId` and `headline` follow the stored plan: its chip (else
 * the chosen one) and its minutes, so the selected chip and the cards always agree; a
 * pace picked for an existing plan is a separate change of the plan, not of its start.
 */
export function proposeRoute(input: ProposeInput): RouteProposal | null {
  const { catalog, today } = input;
  const existing = input.existing ?? null;
  const m = measuresOf(catalog);
  const chosen = input.pace ?? defaultPaceFor(input.audience, input.levelOrder);
  const pace = existing === null ? chosen : (paceOfSessions(sessionsPerWeekOf(existing.meta.params)) ?? chosen);
  const minutes = existing?.meta.params.minutesPerSession ?? defaultMinutesFor(input.audience, input.levelOrder, input.rosterLevelOrders);
  const base = baseParamsOf(input, pace, minutes);

  const probe = generateCurriculum(base, catalog);
  if (existing === null && probe.stats.readyItems === 0) return null;
  const probeLastLesson = m.lastWeek(probe, m.isLesson);
  const defaultId = defaultDurationFor(probeLastLesson);
  const options = DURATION_IDS.map((id) => optionOf(id, base, catalog, probeLastLesson, m)) as unknown as RouteProposal['options'];
  const headline = headlineOf(probe, probe.params.level, catalog, m);

  if (existing === null) {
    const params = CurriculumParamsSchema.parse({ ...base, weeks: LENGTH_PRESETS[defaultId].weeks });
    return { kind: 'new', headline, pace, params, options, defaultId };
  }

  const completedQuestIds = [...input.completedQuestIds];
  const seed = input.seed;
  const stored = existing.meta.params;
  const storedSet = stored.placedOutQuestIds ?? questsPlacedOutAtLevel(stored.level, routeCatalogOf(catalog));
  const moves =
    seed !== null && (placementLevelRank(seed.level) > placementLevelRank(stored.level) || !sameSet(seed.placedOutQuestIds, storedSet));
  const paramsPatch = seed === null ? {} : { level: seed.level, placedOutQuestIds: [...seed.placedOutQuestIds] };
  const reseeded = regenerateFrom(existing, today, catalog, { mode: 'reseed', paramsPatch, completedQuestIds });
  const unchanged: RouteProposal = { kind: 'unchanged', headline, pace, params: reseeded.params, options, defaultId };
  if (!moves) return unchanged;

  const finished = new Set(completedQuestIds);
  const ahead = (draft: CurriculumDraft): PlanItem[] =>
    draft.items.filter((item) => item.targetDate !== undefined && item.targetDate >= today && !finished.has(item.id));
  const before = ahead(regenerateFrom(existing, today, catalog, { mode: 'shift', completedQuestIds }));
  const after = ahead(reseeded);
  if (!after.some(m.isContent)) return unchanged;
  const key = (item: PlanItem): string => `${item.kind}|${item.id}|${String(item.targetDate)}`;
  const same = before.length === after.length && before.every((item, i) => key(item) === key(after[i] as PlanItem));
  if (same) return unchanged;

  const beforeIds = new Set(before.map((item) => item.id));
  const afterIds = new Set(after.map((item) => item.id));
  return {
    ...unchanged,
    kind: 'update',
    diff: {
      itemsRemoved: before.filter((item) => !afterIds.has(item.id)).length,
      itemsAdded: after.filter((item) => !beforeIds.has(item.id)).length,
      newStartQuestId: after.find(m.isLesson)?.id ?? null,
    },
  };
}
