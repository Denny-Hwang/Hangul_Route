import {
  CATALOG,
  LENGTH_PRESETS,
  PACES,
  WEEKDAYS,
  addDays,
  effectiveRoute,
  levelOrder,
  placementStageNumber,
  proposeRoute,
  routeCatalogOf,
  spreadDates,
  toPlanItems,
  weekdayOf,
  type Catalog,
  type CurriculumDraft,
  type CurriculumParamsInput,
  type DateKey,
  type DurationId,
  type DurationOption,
  type LearnerType,
  type PaceId,
  type PlacementResult,
  type ProposeInput,
  type RouteProposal,
  type StageKey,
  type Weekday,
} from '@hangul-route/content-schema';

/**
 * The learner's weekly plan proposal (F-PLAN-002 section 3.9, AMENDMENTS-PLC-PLAN-HANDOFF
 * AM-6 / FP-B6, OD-15, OD-16): when the Home prompt shows, where the Profile row opens, what
 * `proposeRoute` is asked, the choice the learner shapes on the proposal screen, and the
 * telemetry. Pure: the screens and the route store pass the clock, the snapshot and the tier.
 * Codes and counts only; every word comes from `learner.weeklyPlan` in the UI locale.
 */

/** Where the proposal was opened from (`RouteProposal.source`, `route.proposed.source`). */
export type ProposalSource = 'placement' | 'home' | 'profile' | 'parent';

/** After Not now / Just start the prompt stays hidden this long, or until the next placement result (OD-16). */
export const PLAN_PROMPT_HIDE_DAYS = 14;
const DAY_MS = 86_400_000;

/** How many days after tomorrow "Pick a day" offers (a start never before today, AMENDMENTS section 1.4). */
export const PICK_DAYS_AHEAD = 12;

export interface PlanPromptInput {
  /** `flags.routeEnabled`. */
  enabled: boolean;
  /** `effectiveLearnerType(profile)`: the prompt is for a self profile only (OD-14; a child gets a plan through the grown-up). */
  learnerType: LearnerType;
  /** An inbox plan or an active self plan (`hasPlanNow`). */
  hasPlan: boolean;
  /** Finished quests of the profile. */
  questsDone: number;
  /** `completedAt` of the newest placement result; undefined without one. */
  newestResultAt: string | undefined;
  /** `route-ui:<profileId>.dismissedAt`. */
  dismissedAt: string | undefined;
  nowMs: number;
}

/**
 * Hidden after a dismissal until the next placement result or 14 days later, whichever comes
 * first (AM-6, OD-16). An empty or unreadable time reads as no dismissal.
 */
export function planPromptHidden(dismissedAt: string | undefined, newestResultAt: string | undefined, nowMs: number): boolean {
  if (dismissedAt === undefined || dismissedAt === '') return false;
  const at = Date.parse(dismissedAt);
  if (Number.isNaN(at)) return false;
  if (newestResultAt !== undefined && Date.parse(newestResultAt) > at) return false;
  return nowMs - at < PLAN_PROMPT_HIDE_DAYS * DAY_MS;
}

/**
 * The Home prompt "Hoya can make a weekly plan for you" (AM-6): the flag, a self profile, no
 * plan yet, at least one finished quest or a placement result, and not dismissed. Visibility
 * follows the learner type, never the device gate.
 */
export function planPromptEligible(i: PlanPromptInput): boolean {
  if (!i.enabled || i.learnerType !== 'self' || i.hasPlan) return false;
  if (i.questsDone < 1 && i.newestResultAt === undefined) return false;
  return !planPromptHidden(i.dismissedAt, i.newestResultAt, i.nowMs);
}

/** The newest `completedAt` of the stored results, or undefined without one. */
export function newestResultAt(placements: readonly Pick<PlacementResult, 'completedAt'>[] | undefined): string | undefined {
  if (placements === undefined || placements.length === 0) return undefined;
  return placements.reduce((top, r) => (r.completedAt > top ? r.completedAt : top), placements[0]!.completedAt);
}

/**
 * The Profile row "Make a weekly plan" (section 3.9): a self profile opens the proposal
 * directly; a child profile goes through the grown-up gate when the device needs one right now.
 */
export function profileRowOpens(i: { learnerType: LearnerType; opensDirectly: boolean }): 'proposal' | 'gate' {
  return i.learnerType === 'self' || i.opensDirectly ? 'proposal' : 'gate';
}

export interface ProposalContext {
  placements: readonly PlacementResult[] | undefined;
  /** The learner's finished quests (single learner). */
  completedQuestIds: readonly string[];
  /** The profile's stored level id: `levelOrder` pre-selects the pace and the minutes only (D1). */
  ageGroup: string;
  /** `unlockedStagesFor(now, profileId)`: the access tier, so stage and quest access agree. */
  unlockedStages: readonly StageKey[];
  today: DateKey;
  pace?: PaceId;
  startDate?: DateKey;
  /** Tests only; the app always plans from the shared catalogue. */
  catalog?: Catalog;
}

/**
 * `proposeRoute`'s input for a self learner (F-PLC-001 AM-4): the effective route of every
 * stored result **with** the learner's real completions (so the plan starts at the first quest
 * still to play), null without a level check (stage1 band 0).
 */
export function proposalInputOf(c: ProposalContext): ProposeInput {
  const catalog = c.catalog ?? CATALOG;
  const unlocked = new Set<string>(c.unlockedStages);
  const seed =
    c.placements === undefined
      ? null
      : effectiveRoute(c.placements, routeCatalogOf(catalog), {
          isEntitled: (stage) => unlocked.has(stage),
          completedQuestIds: new Set(c.completedQuestIds),
        });
  return {
    audience: 'self',
    seed,
    completedQuestIds: [...c.completedQuestIds],
    levelOrder: levelOrder(c.ageGroup),
    ...(c.pace === undefined ? {} : { pace: c.pace }),
    unlockedStages: [...c.unlockedStages],
    catalog,
    today: c.today,
    ...(c.startDate === undefined ? {} : { startDate: c.startDate }),
  };
}

/** `proposeRoute`, or null when it has nothing ready or the input breaks a params cap (it throws then). */
export function safePropose(input: ProposeInput): RouteProposal | null {
  try {
    return proposeRoute(input);
  } catch {
    return null;
  }
}

export type LengthChoice = DurationId | 'custom';
export type MinuteChoice = 5 | 10 | 15 | 20 | 30;
export const MINUTE_CHOICES: readonly MinuteChoice[] = [5, 10, 15, 20, 30];
export const PACE_IDS: readonly PaceId[] = ['gentle', 'steady', 'brisk'];
/** "Choose weeks" runs from 1 to 52 (section 3.1). */
export const CUSTOM_WEEKS_MIN = 1;
export const CUSTOM_WEEKS_MAX = 52;

/** What the learner shapes on the proposal screen; everything not here comes from the proposal. */
export interface PlanChoice {
  pace: PaceId;
  length: LengthChoice;
  /** The "Choose weeks" count, kept while another length is picked. */
  customWeeks: number;
  startDate: DateKey;
  /** null = the pace's own spread days; else the days picked under "Change days and time". */
  days: Weekday[] | null;
  minutes: MinuteChoice;
}

/** The proposal as it stands: its pace (Steady off the chips), the suggested length, its start day and minutes. */
export function initialChoice(proposal: RouteProposal): PlanChoice {
  return {
    pace: proposal.pace ?? 'steady',
    length: proposal.defaultId,
    customWeeks: LENGTH_PRESETS[proposal.defaultId].weeks,
    startDate: proposal.params.startDate,
    days: null,
    minutes: proposal.params.minutesPerSession,
  };
}

export function weeksOfChoice(choice: PlanChoice): number {
  return choice.length === 'custom' ? choice.customWeeks : LENGTH_PRESETS[choice.length].weeks;
}

/** The weekdays the generator spreads a pace over from a start day (`spreadDates`, in date order). */
export function defaultDaysFor(startDate: DateKey, pace: PaceId): Weekday[] {
  const n = PACES[pace];
  return spreadDates(startDate, n, n).map(weekdayOf);
}

/** Turn one day on or off, starting from the spread days; the list keeps the Sunday-first week order. */
export function toggleDay(choice: PlanChoice, day: Weekday): PlanChoice {
  const current = choice.days ?? defaultDaysFor(choice.startDate, choice.pace);
  const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
  return { ...choice, days: WEEKDAYS.filter((d) => next.includes(d)) };
}

/** The picked days match the pace's days a week (the length previews were drafted at that pace). */
export function daysReady(choice: PlanChoice): boolean {
  return choice.days === null || choice.days.length === PACES[choice.pace];
}

/** A new pace starts again from its own spread days. */
export function withPace(choice: PlanChoice, pace: PaceId): PlanChoice {
  return { ...choice, pace, days: null };
}

/** The generator params of a choice: the proposal's start, goals and tier with the learner's length, day, pace, days and minutes. */
export function paramsOfChoice(proposal: RouteProposal, choice: PlanChoice): CurriculumParamsInput {
  const { sessionDays: _days, ...base } = proposal.params;
  return {
    ...base,
    weeks: weeksOfChoice(choice),
    startDate: choice.startDate,
    sessionsPerWeek: PACES[choice.pace],
    minutesPerSession: choice.minutes,
    ...(choice.days === null ? {} : { sessionDays: [...choice.days] }),
  };
}

const sameDays = (a: PlanChoice, b: PlanChoice): boolean => {
  const left = a.days ?? defaultDaysFor(a.startDate, a.pace);
  const right = b.days ?? defaultDaysFor(b.startDate, b.pace);
  return left.length === right.length && left.every((d, i) => d === right[i]);
};

/** Whether the learner changed what Hoya proposed (`route.created.changed`). */
export function choiceChanged(initial: PlanChoice, final: PlanChoice): boolean {
  return (
    initial.pace !== final.pace ||
    weeksOfChoice(initial) !== weeksOfChoice(final) ||
    initial.startDate !== final.startDate ||
    initial.minutes !== final.minutes ||
    !sameDays(initial, final)
  );
}

export interface StartDays {
  today: DateKey;
  tomorrow: DateKey;
  /** The days "Pick a day" offers, after tomorrow. */
  later: DateKey[];
}

/** Today (default, OD-15), tomorrow, and the next days to pick from; never a day before today. */
export function startDaysOf(today: DateKey): StartDays {
  return {
    today,
    tomorrow: addDays(today, 1),
    later: Array.from({ length: PICK_DAYS_AHEAD }, (_, i) => addDays(today, i + 2)),
  };
}

export function startPickOf(startDate: DateKey, today: DateKey): 'today' | 'tomorrow' | 'pick' {
  if (startDate === today) return 'today';
  return startDate === addDays(today, 1) ? 'tomorrow' : 'pick';
}

/** One length card's preview sentence, as a code with its numbers (AMENDMENTS section 1.3). */
export type PreviewLine =
  | { code: 'lessons-and-stories'; stage: number; week: number }
  | { code: 'lessons-cut-short'; weeks: number }
  | { code: 'lessons-then-free-practice'; weeks: number }
  | { code: 'lessons-fill'; weeks: number }
  | { code: 'stories-and-words'; stories: number };

/**
 * The card's sentence: a projection, never a deadline, and never a finish the card does not
 * reach (`lessons-cut-short` when the lessons run past its weeks). A card whose lessons fill
 * every week says so instead of "the rest is free practice".
 */
export function previewLineOf(option: DurationOption): PreviewLine {
  switch (option.preview) {
    case 'lessons-and-stories':
      return { code: 'lessons-and-stories', stage: placementStageNumber(option.stats.endsAtStage), week: option.lastLessonWeek };
    case 'lessons-cut-short':
      return { code: 'lessons-cut-short', weeks: option.weeks };
    case 'stories-and-words':
      return { code: 'stories-and-words', stories: option.stats.stories };
    default:
      return option.lastContentWeek >= option.weeks
        ? { code: 'lessons-fill', weeks: option.weeks }
        : { code: 'lessons-then-free-practice', weeks: option.lastContentWeek };
  }
}

/**
 * Learner screens sum up locked and unreleased lessons only as "More lessons are coming."
 * (section 3.9): never the `premium-needed` warning, a price or the word Premium.
 */
export function moreLessonsComing(option: Pick<DurationOption, 'warnings'>): boolean {
  return option.warnings.includes('premium-needed') || option.warnings.includes('coming-soon-included');
}

export interface WeekRow {
  date: DateKey;
  kind: 'quest' | 'episode';
  id: string;
}

/** The first week of a draft, by date: the short list under "First week". */
export function firstWeekRows(draft: CurriculumDraft): WeekRow[] {
  return toPlanItems(draft)
    .filter((item) => item.week === 1 && item.targetDate !== undefined)
    .map((item) => ({ date: item.targetDate as DateKey, kind: item.kind, id: item.id }));
}

export interface RouteEvent<P> {
  name: 'route.proposed' | 'route.proposal_skipped' | 'route.created';
  profileId: string;
  payload: P;
}

/** `route.proposed` once per screen open; `pace` left out when the proposal's pace is null. */
export function proposedEvent(
  profileId: string,
  source: ProposalSource,
  proposal: RouteProposal,
): RouteEvent<{ source: ProposalSource; kind: 'new' | 'update'; defaultWeeks: number; pace?: PaceId }> {
  return {
    name: 'route.proposed',
    profileId,
    payload: {
      source,
      kind: proposal.kind === 'new' ? 'new' : 'update',
      defaultWeeks: LENGTH_PRESETS[proposal.defaultId].weeks,
      ...(proposal.pace === null ? {} : { pace: proposal.pace }),
    },
  };
}

/** `route.proposal_skipped` for Not now (and the result screen's Just start, F-PLC-001 P-7b). */
export function proposalSkippedEvent(profileId: string, source: ProposalSource): RouteEvent<{ source: ProposalSource }> {
  return { name: 'route.proposal_skipped', profileId, payload: { source } };
}

export interface CreatedPayload {
  audience: 'self';
  weeks: number;
  sessionsPerWeek: number;
  focus: string;
  startStage: StageKey;
  from: 'proposal' | 'setup';
  changed: boolean;
}

/** `route.created` (section 3.11, FP-B7): the plan's shape, never an item id or a date. */
export function createdEvent(profileId: string, draft: CurriculumDraft, from: 'proposal' | 'setup', changed: boolean): RouteEvent<CreatedPayload> {
  const { params } = draft;
  return {
    name: 'route.created',
    profileId,
    payload: {
      audience: 'self',
      weeks: params.weeks,
      sessionsPerWeek: params.sessionDays?.length ?? params.sessionsPerWeek,
      focus: params.goals.focus,
      startStage: params.level.stage,
      from,
      changed,
    },
  };
}

/**
 * Section 3.10: a learner who already has a class or home plan may add an own plan, and is told
 * the other one comes first. `teacher` when any class plan is in the inbox, else `home`
 * (a school space reads as home, like its `assignedBy`); null with none or while plans load.
 */
export function otherPlanFrom(plans: readonly { spaceKind: 'class' | 'family' | 'school' }[] | undefined): 'teacher' | 'home' | null {
  if (plans === undefined || plans.length === 0) return null;
  return plans.some((p) => p.spaceKind === 'class') ? 'teacher' : 'home';
}
