import {
  CURRICULUM_MAX_ITEMS,
  LENGTH_PRESETS,
  PACES,
  ThemeKeySchema,
  sessionsPerWeekOf,
  type CurriculumParams,
  type CurriculumParamsInput,
  type DateKey,
  type DurationId,
  type Focus,
  type Motivation,
  type PaceId,
  type PlacementLevel,
  type RouteProposal,
  type SelfRoute,
  type StageKey,
  type StoredCurriculumParams,
  type ThemeKey,
  type Weekday,
} from '@hangul-route/content-schema';
import { MINUTE_CHOICES, PACE_IDS, daysReady, initialChoice, weeksOfChoice, type LengthChoice, type MinuteChoice, type PlanChoice } from './proposal-flow';

/**
 * The four set-up steps of the learner's weekly plan (F-PLAN-002 section 3.9, wireframe
 * console/curriculum-planner.md G1 as amended by FP-B6 / FP-B13): where to start, time (pace,
 * days and minutes), how long, what you like. Reached by **Change the plan**, prefilled from the
 * proposal or the plan in force; the same defaults as the console wizard for `self`. Pure.
 */

export const STARTING_POINT_IDS = ['brand-new', 'some-letters', 'all-letters', 'reads-words', 'first-words', 'first-sentences'] as const;
export type StartingPointId = (typeof STARTING_POINT_IDS)[number];

/** The six starting cards and the placement level each stands for (the console wizard's table, section 3.8 step 1). */
export const STARTING_LEVELS: Readonly<Record<StartingPointId, PlacementLevel>> = {
  'brand-new': { stage: 'stage1', band: 0 },
  'some-letters': { stage: 'stage1', band: 1 },
  'all-letters': { stage: 'stage1', band: 2 },
  'reads-words': { stage: 'stage1', band: 3 },
  'first-words': { stage: 'stage2', band: 0 },
  'first-sentences': { stage: 'stage3', band: 0 },
};

/** The card nearest to a level: a Stage 1 band picks its own card, Stage 2 the first words, later stages the first sentences. */
export function startingPointOf(level: PlacementLevel | null | undefined): StartingPointId {
  if (level === null || level === undefined) return 'brand-new';
  if (level.stage === 'stage1') return STARTING_POINT_IDS[Math.min(3, Math.max(0, level.band))] as StartingPointId;
  return level.stage === 'stage2' ? 'first-words' : 'first-sentences';
}

export const SETUP_STEPS = ['start', 'time', 'length', 'likes'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** At most five themes, in the order tapped (section 3.1 `goals.themes`). */
export const MAX_THEMES = 5;
export const FOCUS_IDS: readonly Focus[] = ['balanced', 'reading', 'words', 'culture'];

export interface SetupState extends PlanChoice {
  start: StartingPointId;
  focus: Focus;
  themes: ThemeKey[];
}

/** What the plan is built from besides the answers: the learner's completions, the tier, the level check. */
export interface SetupContext {
  completedQuestIds: readonly string[];
  unlockedStages: readonly StageKey[];
  /** The level the proposal or the plan in force starts from, with its exact placed-out set when it has one. */
  level: PlacementLevel | null;
  placedOutQuestIds?: readonly string[];
  motivation?: Motivation;
}

const LENGTH_OF_WEEKS = new Map<number, DurationId>(
  (Object.keys(LENGTH_PRESETS) as DurationId[]).map((id) => [LENGTH_PRESETS[id].weeks, id]),
);

const minuteOf = (minutes: number): MinuteChoice => (MINUTE_CHOICES as readonly number[]).includes(minutes) ? (minutes as MinuteChoice) : 15;

/** The answers of a choice made on the proposal, with the start and goals of the proposal's params. */
export function setupFromChoice(choice: PlanChoice, params: Pick<CurriculumParams, 'level' | 'goals'>): SetupState {
  return {
    ...choice,
    start: startingPointOf(params.level),
    focus: params.goals.focus,
    themes: [...(params.goals.themes ?? [])],
  };
}

/** The answers that would rebuild a stored plan from today: its start, rhythm, minutes, length and goals. */
export function setupFromStored(params: StoredCurriculumParams, today: DateKey): SetupState {
  const sessions = sessionsPerWeekOf(params);
  const pace = PACE_IDS.find((id) => PACES[id] === sessions) ?? 'steady';
  const preset = LENGTH_OF_WEEKS.get(params.weeks);
  const days = params.sessionDays !== undefined && params.sessionDays.length === PACES[pace] ? [...params.sessionDays] : null;
  return {
    pace,
    length: preset ?? 'custom',
    customWeeks: params.weeks,
    startDate: today,
    days,
    minutes: minuteOf(params.minutesPerSession),
    start: startingPointOf(params.level),
    focus: params.goals.focus,
    themes: [...(params.goals.themes ?? [])],
  };
}

/** More sessions than a plan holds (section 3.11: "That is more than a plan can hold."). */
export function tooManyItems(state: SetupState): boolean {
  return weeksOfChoice(state) * (state.days?.length ?? PACES[state.pace]) > CURRICULUM_MAX_ITEMS;
}

/** Whether a step may go on: the days match the pace on the time step, the plan fits on the length step. */
export function stepReady(step: SetupStep, state: SetupState): boolean {
  if (step === 'time') return daysReady(state);
  if (step === 'length') return !tooManyItems(state);
  return true;
}

/** Tap a theme: added at the end (its priority), or taken out; never more than five. */
export function toggleTheme(state: SetupState, theme: ThemeKey): SetupState {
  if (state.themes.includes(theme)) return { ...state, themes: state.themes.filter((t) => t !== theme) };
  if (state.themes.length >= MAX_THEMES) return state;
  return { ...state, themes: [...state.themes, theme] };
}

/** The five culture themes in canonical order (the theme chips). */
export const THEMES: readonly ThemeKey[] = ThemeKeySchema.options;

/**
 * The generator params of the answers. A starting card that stands for the context's own level
 * keeps its exact placed-out set (the level check's); another card plans from that card's level.
 */
export function setupParams(ctx: SetupContext, state: SetupState): CurriculumParamsInput {
  const level = STARTING_LEVELS[state.start];
  const sameStart = ctx.level !== null && startingPointOf(ctx.level) === state.start;
  const startLevel = sameStart && ctx.level !== null ? ctx.level : level;
  return {
    audience: 'self',
    level: startLevel,
    ...(sameStart && ctx.placedOutQuestIds !== undefined ? { placedOutQuestIds: [...ctx.placedOutQuestIds] } : {}),
    completedQuestIds: [...ctx.completedQuestIds],
    startDate: state.startDate,
    weeks: weeksOfChoice(state),
    sessionsPerWeek: PACES[state.pace],
    ...(state.days === null ? {} : { sessionDays: [...state.days] as Weekday[] }),
    minutesPerSession: state.minutes,
    goals: {
      focus: state.focus,
      ...(state.themes.length > 0 ? { themes: [...state.themes] } : {}),
      ...(ctx.motivation === undefined ? {} : { motivation: ctx.motivation }),
    },
    unlockedStages: [...ctx.unlockedStages],
  };
}

/** The lengths the "how long" step offers, the custom one last. */
export const SETUP_LENGTHS: readonly LengthChoice[] = ['4-week', '12-week', '6-month', 'custom'];

export interface SetupBasisInput {
  /** The plan in force; its answers win, so "Change the plan" starts from what the learner follows. */
  active: SelfRoute | null;
  /** Hoya's proposal for a learner with no plan yet. */
  proposal: RouteProposal | null;
  /** The choice already shaped on the proposal screen, when the steps were opened from there. */
  choice?: PlanChoice;
  completedQuestIds: readonly string[];
  unlockedStages: readonly StageKey[];
  today: DateKey;
}

/**
 * The context and the first answers of the set-up steps (section 3.9: "prefilled from the
 * proposal"; G1 "pre-selected from the level check"): the plan in force first, else the proposal
 * with the choice made on it; null when there is neither.
 */
export function setupBasisOf(i: SetupBasisInput): { ctx: SetupContext; state: SetupState } | null {
  const params = i.active?.meta.params ?? i.proposal?.params ?? null;
  if (params === null) return null;
  const ctx: SetupContext = {
    completedQuestIds: [...i.completedQuestIds],
    unlockedStages: [...i.unlockedStages],
    level: params.level,
    ...(params.placedOutQuestIds === undefined ? {} : { placedOutQuestIds: [...params.placedOutQuestIds] }),
    ...(params.goals.motivation === undefined ? {} : { motivation: params.goals.motivation }),
  };
  if (i.active !== null) return { ctx, state: setupFromStored(i.active.meta.params, i.today) };
  const proposal = i.proposal as RouteProposal;
  return { ctx, state: setupFromChoice(i.choice ?? initialChoice(proposal), proposal.params) };
}

/** The screens of making a plan; after Start this plan none of them stays behind the overview. */
const PLAN_FLOW = new Set(['RouteProposal', 'RouteSetup', 'RoutePreview', 'RouteOverview']);

/** The stack after Start this plan: the screens below the plan flow, then the overview. */
export function routesAfterStart<R extends { name: string }>(routes: readonly R[], overview: R): R[] {
  const first = routes.findIndex((r) => PLAN_FLOW.has(r.name));
  const below = first === -1 ? [...routes] : routes.slice(0, first);
  return [...below, overview];
}
