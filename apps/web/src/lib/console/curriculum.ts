import {
  AUDIENCE_DEFAULTS,
  CATALOG,
  FREE_ROUTE_STAGES,
  CURRICULUM_MAX_ITEMS,
  LENGTH_PRESETS,
  PICTURES_FIRST_MINUTES,
  StageKeySchema,
  WEEKDAYS,
  addDays,
  generateCurriculum,
  isDateKey,
  levelOrder,
  regenerateFrom,
  toMeta,
  toPlanItems,
  type Catalog,
  type CurriculumDraft,
  type CurriculumItem,
  type CurriculumMeta,
  type CurriculumParamsInput,
  type CurriculumStats,
  type CurriculumWarning,
  type DaysOff,
  type Entitlement,
  type Focus,
  type LengthPresetId,
  type PlacementLevel,
  type PlanItem,
  type SpaceRole,
  type StageKey,
  type ThemeKey,
  type WeekExtra,
  type WeekMeta,
  type Weekday,
} from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import { itemCategory, itemTitle, type ItemCategory } from '@/data/catalog';
import { isActive } from './billing';
import { currentPlan, type PlanLike, type ReadoutRow } from './plans';

/**
 * Pure logic of the curriculum wizard and of a route plan's builder and readout
 * (F-PLAN-002 section 3.8; wireframe console/curriculum-planner). The page holds a
 * `WizardState`; `toParams` turns it into generator params; the generator
 * (`@hangul-route/content-schema`) runs locally, so the preview works offline. Every
 * text here is worded from `console.curriculum` messages in the console's UI locale.
 *
 * Not here on purpose (they need owner decisions OD-12 / OD-13 and `proposeRoute`,
 * F-PLAN-002 PR P2-6b, after P2-3b): the pace chips, a pre-selected *Suggested* length and the family
 * card's *Update the plan* (`reseed`). Until then no length is pre-selected and the
 * rhythm starts from the audience table of section 3.1.
 */

export type WizardAudience = 'class' | 'family';

export const STARTING_POINT_IDS = ['brand-new', 'some-letters', 'all-letters', 'reads-words', 'first-words', 'first-sentences'] as const;
export type StartingPointId = (typeof STARTING_POINT_IDS)[number];

/** The six cards of step 1 and the placement level each one stands for. */
export const STARTING_LEVELS: Readonly<Record<StartingPointId, PlacementLevel>> = {
  'brand-new': { stage: 'stage1', band: 0 },
  'some-letters': { stage: 'stage1', band: 1 },
  'all-letters': { stage: 'stage1', band: 2 },
  'reads-words': { stage: 'stage1', band: 3 },
  'first-words': { stage: 'stage2', band: 0 },
  'first-sentences': { stage: 'stage3', band: 0 },
};

export type LengthChoice = LengthPresetId | 'custom';
export const LENGTH_CHOICES: readonly LengthChoice[] = ['4-week', '12-week', '6-month', 'custom'];

export const MINUTE_CHOICES = [5, 10, 15, 20, 30] as const;
export type MinuteChoice = (typeof MINUTE_CHOICES)[number];

export const SESSION_CHOICES = [1, 2, 3, 4, 5, 6, 7] as const;

/** `daysOff` holds at most this many ranges (the params schema). */
export const MAX_DAYS_OFF = 12;

export const FOCUS_CHOICES: readonly Focus[] = ['balanced', 'reading', 'words', 'culture'];

export interface WizardState {
  audience: WizardAudience;
  /** Family only: the learner the route is for (null = everyone in the family). */
  learnerId: string | null;
  start: StartingPointId;
  /** None until the grown-up picks one (no recommendation without `proposeRoute`). */
  length: LengthChoice | null;
  customWeeks: number;
  startDate: string;
  sessionsPerWeek: number;
  /** Optional weekdays; when any is chosen their count wins over `sessionsPerWeek`. */
  sessionDays: Weekday[];
  minutesPerSession: MinuteChoice;
  daysOff: DaysOff[];
  focus: Focus;
  /** In priority order. */
  themes: ThemeKey[];
  culturalAnchors: boolean;
  includeComingSoon: boolean;
}

/** The summary fields the planner reads (section 3.8: placement first, Stage 1 counts as the fallback). */
export interface PlannerSummary {
  placement?: { level: PlacementLevel } | undefined;
  stage1: { questsDone: number; questsTotal: number };
}

export interface PlannerLearner {
  id: string;
  ageGroup: string;
  summary: PlannerSummary | null;
}

/** A coarse starting point from one learner's summary (assumption 5): the newest level check, else the share of Stage 1 done. */
export function levelFromSummary(summary: PlannerSummary | null | undefined): StartingPointId | null {
  if (!summary) return null;
  const level = summary.placement?.level;
  if (level) {
    if (level.stage === 'stage1') return STARTING_POINT_IDS[Math.min(Math.max(level.band, 0), 3)] as StartingPointId;
    return level.stage === 'stage2' ? 'first-words' : 'first-sentences';
  }
  const { questsDone, questsTotal } = summary.stage1;
  if (questsDone <= 0 || questsTotal <= 0) return 'brand-new';
  const share = questsDone / questsTotal;
  if (share >= 1) return 'first-words';
  if (share >= 2 / 3) return 'reads-words';
  if (share >= 1 / 3) return 'all-letters';
  return 'some-letters';
}

/** The most frequent starting point once three or more learners have a summary; ties go to the earlier point. Never a list. */
export function levelHint(learners: readonly PlannerLearner[]): StartingPointId | null {
  const points = learners.map((l) => levelFromSummary(l.summary)).filter((p): p is StartingPointId => p !== null);
  if (points.length < 3) return null;
  let best: StartingPointId | null = null;
  let bestCount = 0;
  for (const id of STARTING_POINT_IDS) {
    const count = points.filter((p) => p === id).length;
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

/** The wizard's starting state (section 3.1 table); a family's only learner is picked for the grown-up. */
export function defaultsFor(audience: WizardAudience, learners: readonly PlannerLearner[], today: string, learnerId: string | null = null): WizardState {
  const picked = audience === 'family' ? (learners.find((l) => l.id === learnerId) ?? (learnerId === null && learners.length === 1 ? learners[0] : undefined)) : undefined;
  const picturesFirst =
    audience === 'class'
      ? learners.filter((l) => levelOrder(l.ageGroup) === 0).length * 2 > learners.length
      : picked !== undefined && levelOrder(picked.ageGroup) === 0;
  const start = audience === 'class' ? levelHint(learners) : picked ? levelFromSummary(picked.summary) : null;
  return {
    audience,
    learnerId: picked?.id ?? null,
    start: start ?? 'brand-new',
    length: null,
    customWeeks: 12,
    startDate: today,
    sessionsPerWeek: AUDIENCE_DEFAULTS[audience].sessionsPerWeek,
    sessionDays: [],
    minutesPerSession: picturesFirst ? PICTURES_FIRST_MINUTES : AUDIENCE_DEFAULTS[audience].minutesPerSession,
    daysOff: [],
    focus: 'balanced',
    themes: [],
    culturalAnchors: true,
    includeComingSoon: true,
  };
}

/** The route length in weeks, or null while none is chosen or the custom number is out of range. */
export function weeksOf(state: WizardState): number | null {
  if (state.length === null) return null;
  if (state.length !== 'custom') return LENGTH_PRESETS[state.length].weeks;
  return Number.isInteger(state.customWeeks) && state.customWeeks >= 1 && state.customWeeks <= 52 ? state.customWeeks : null;
}

const sessionsOf = (state: WizardState): number => (state.sessionDays.length > 0 ? state.sessionDays.length : state.sessionsPerWeek);

/** Generator params for the wizard state; null until a valid length is chosen. */
export function toParams(state: WizardState, unlockedStages: readonly StageKey[]): CurriculumParamsInput | null {
  const weeks = weeksOf(state);
  if (weeks === null) return null;
  const days = WEEKDAYS.filter((day) => state.sessionDays.includes(day));
  return {
    audience: state.audience,
    level: STARTING_LEVELS[state.start],
    startDate: state.startDate,
    weeks,
    sessionsPerWeek: sessionsOf(state),
    ...(days.length > 0 ? { sessionDays: days } : {}),
    minutesPerSession: state.minutesPerSession,
    daysOff: state.daysOff.map((range) => ({ ...range })),
    goals: { focus: state.focus, ...(state.themes.length > 0 ? { themes: [...state.themes] } : {}) },
    ...(state.length !== null && state.length !== 'custom' ? { reviewEvery: LENGTH_PRESETS[state.length].reviewEvery } : {}),
    includeComingSoon: state.includeComingSoon,
    culturalAnchors: state.culturalAnchors,
    unlockedStages: [...unlockedStages],
  };
}

export type WizardProblem = 'no-length' | 'bad-weeks' | 'start-past' | 'break-missing' | 'break-reversed' | 'too-many-breaks' | 'too-many';

/** Why step 2 cannot go on yet, or null. The wizard never accepts a start before today (section 3.11). */
export function wizardProblem(state: WizardState, today: string): WizardProblem | null {
  if (state.length === null) return 'no-length';
  const weeks = weeksOf(state);
  if (weeks === null) return 'bad-weeks';
  if (!isDateKey(state.startDate) || state.startDate < today) return 'start-past';
  if (state.daysOff.some((range) => !isDateKey(range.from) || !isDateKey(range.to))) return 'break-missing';
  if (state.daysOff.some((range) => range.from > range.to)) return 'break-reversed';
  if (state.daysOff.length > MAX_DAYS_OFF) return 'too-many-breaks';
  if (weeks * sessionsOf(state) > CURRICULUM_MAX_ITEMS) return 'too-many';
  return null;
}

/**
 * Why step 1 cannot go on yet (section 3.8: a family space picks the learner first): a family
 * with learners needs one chosen, so a route never reaches everyone in the family by accident.
 * A family with no learner yet plans for everyone who joins.
 */
export function learnerProblem(state: Pick<WizardState, 'audience' | 'learnerId'>, learnerCount: number): 'no-learner' | null {
  return state.audience === 'family' && learnerCount > 0 && state.learnerId === null ? 'no-learner' : null;
}

/** An active entitlement (a Family Plan or a Group License) covers the space or its school. */
export function spaceCovered(entitlements: readonly Entitlement[], space: { id: string; parentSpaceId: string | null }, now: Date): boolean {
  const subjects = new Set([space.id, ...(space.parentSpaceId ? [space.parentSpaceId] : [])]);
  return entitlements.some((e) => e.subjectKind === 'space' && subjects.has(e.subjectId) && isActive(e, now));
}

/**
 * Stages the generator may schedule for this space (assumption 9a): every stage when an
 * active entitlement covers the space or its school, else Stage 1. Locked lessons are
 * listed by the generator, never scheduled.
 */
export function unlockedStagesForSpace(entitlements: readonly Entitlement[], space: { id: string; parentSpaceId: string | null }, now: Date): StageKey[] {
  return spaceCovered(entitlements, space, now) ? [...StageKeySchema.options] : ['stage1'];
}

export type SpaceCoverage = 'covered' | 'uncovered' | 'unknown';

/**
 * Whether a Family Plan or a Group License covers the space, as far as this viewer can tell
 * (F-ENT-003 sections 3.9.2 and 3.9.3). `GET /api/entitlements` lists the account's own rows and
 * the rows of the spaces it owns, so "uncovered" is only answered for the owner of the space,
 * and for a class inside a school only when the viewer owns the school too. Anything else (a
 * co-teacher, a co-caregiver, a class in a school someone else owns, a failed read, a list not
 * loaded yet) is "unknown": no free-plan words and no billing link, never a claimed limit.
 */
export function spaceCoverage(
  entitlements: readonly Entitlement[] | null,
  memberships: readonly { space: { id: string }; role: SpaceRole }[] | null,
  space: { id: string; parentSpaceId: string | null },
  now: Date,
): SpaceCoverage {
  if (entitlements === null) return 'unknown';
  if (spaceCovered(entitlements, space, now)) return 'covered';
  const owns = (id: string): boolean => memberships?.some((m) => m.space.id === id && m.role === 'owner') ?? false;
  return owns(space.id) && (space.parentSpaceId === null || owns(space.parentSpaceId)) ? 'uncovered' : 'unknown';
}

/**
 * The free-plan view of a wizard preview (F-ENT-003 section 3.9.3; wireframe
 * console/curriculum-free-days): only for a space this viewer knows no plan covers
 * (`spaceCoverage` is "uncovered") while the console's free-plan switch is on. The generator
 * already plans Stage 1 only for such a space (`unlockedStages`, section 3.1 golden), so nothing
 * here changes its input (OD-1).
 */
export interface FreeDaysView {
  /** Names the product: a family space -> the Family Plan, a class or school -> a Group License. */
  kind: WizardAudience;
  /** The first and the last week of the draft that hold a lesson; null when it holds none. */
  firstWeek: number | null;
  lastWeek: number | null;
  /** The plan runs on after its last lesson week: the preview says so above **Use this route**. */
  short: boolean;
  /** Whether the weeks after the last lesson hold stories (else only practice, review or days off). */
  storiesAfter: boolean;
  /** The shortest length preset, shorter than the plan, that still holds every lesson of it; null when none does. */
  shorter: { length: LengthPresetId; weeks: number } | null;
  /**
   * The draft's coming-soon episodes past the free stages: once released they open with the
   * product, not on their dates (the generator places coming-soon episodes of every stage, OD-1
   * keeps its input). The coming-soon line says so instead of "start on their dates".
   */
  comingSoonClosed: number;
  /** Whether coming-soon episodes sit after the last lesson week (the short-plan line lists them). */
  soonAfter: boolean;
}

const isLesson = (item: CurriculumItem, source: Catalog): boolean => item.kind === 'quest' && itemCategory(item.kind, item.id, source) === 'lesson';

/** The first and the last week of a draft that hold a lesson (a lesson quest; stories and coming-soon episodes do not count), or null when none does. */
export function lessonWeeks(items: readonly CurriculumItem[], source: Catalog = CATALOG): { first: number; last: number } | null {
  const weeks = items.filter((item) => isLesson(item, source)).map((item) => item.week);
  return weeks.length > 0 ? { first: Math.min(...weeks), last: Math.max(...weeks) } : null;
}

/** A coming-soon episode of the draft whose cell is past the free stages (Stage 1, OD-1): it never opens on the free plan. */
const isClosedSoon = (item: CurriculumItem, source: Catalog): boolean =>
  item.kind === 'episode' &&
  itemCategory(item.kind, item.id, source) === 'coming-soon' &&
  !FREE_ROUTE_STAGES.includes(source.cells.find((cell) => cell.episodeId === item.id)?.stage ?? 'stage1');

/** The length presets shorter than `weeks`, shortest first (the order of the wizard's chips). */
const shorterPresets = (weeks: number): LengthPresetId[] =>
  LENGTH_CHOICES.filter((choice): choice is LengthPresetId => choice !== 'custom' && LENGTH_PRESETS[choice].weeks < weeks);

/**
 * The shortest preset, shorter than the draft, whose plan holds every lesson the draft holds:
 * the same params with only the length and its review rhythm changed. The generator lays
 * lessons in queue order, so the shorter plan holds them all exactly when it schedules as many.
 */
function shorterPreset(draft: CurriculumDraft, source: Catalog): FreeDaysView['shorter'] {
  for (const length of shorterPresets(draft.params.weeks)) {
    const { weeks, reviewEvery } = LENGTH_PRESETS[length];
    if (generateCurriculum({ ...draft.params, weeks, reviewEvery }, source).stats.lessons >= draft.stats.lessons) return { length, weeks };
  }
  return null;
}

/**
 * The free-plan view of a preview, or null with the switch off (`contentGatingEnabled()`) or
 * unless this viewer knows the space is uncovered (`spaceCoverage`): then the wizard keeps
 * today's wording.
 */
export function freeDaysView(draft: CurriculumDraft, coverage: SpaceCoverage, gating: boolean, source: Catalog = CATALOG): FreeDaysView | null {
  if (!gating || coverage !== 'uncovered') return null;
  const weeks = lessonWeeks(draft.items, source);
  const short = weeks !== null && weeks.last < draft.params.weeks;
  const after = (category: ItemCategory): boolean => short && draft.items.some((item) => item.week > (weeks?.last ?? 0) && itemCategory(item.kind, item.id, source) === category);
  return {
    kind: draft.params.audience === 'family' ? 'family' : 'class',
    firstWeek: weeks?.first ?? null,
    lastWeek: weeks?.last ?? null,
    short,
    storiesAfter: after('story'),
    shorter: short ? shorterPreset(draft, source) : null,
    comingSoonClosed: draft.items.filter((item) => isClosedSoon(item, source)).length,
    soonAfter: after('coming-soon'),
  };
}

/**
 * The free-plan switch is on but this viewer cannot tell whether a plan covers the space (a
 * co-teacher, a co-caregiver, a class in a school someone else owns, a failed read): the
 * left-out line uses the glossary's neutral words (F-ENT-003 section 3.11: "the Family Plan or a
 * Group License"), never "Premium", and carries no billing link.
 */
export function leftOutNeutral(coverage: SpaceCoverage, gating: boolean): boolean {
  return gating && coverage !== 'uncovered';
}

export interface WeekItem {
  kind: PlanItem['kind'];
  id: string;
  category: ItemCategory;
  title: string;
  date: string | null;
  /** Position in the plan's item list (so the builder can wire its controls). */
  index: number;
}

export interface WeekRow {
  week: WeekMeta;
  endDate: string;
  items: WeekItem[];
}

/**
 * The week table of the preview and the week groups of the builder: each item under its
 * `week`, else under the week whose dates hold its `targetDate`; anything else (no date,
 * or outside the route) is `unscheduled`. Items keep plan order inside a week, by date.
 */
export function weekGroups(weeks: readonly WeekMeta[], items: readonly PlanItem[], source: Catalog = CATALOG): { rows: WeekRow[]; unscheduled: WeekItem[] } {
  const rows: WeekRow[] = weeks.map((week) => ({ week, endDate: addDays(week.startDate, 6), items: [] }));
  const unscheduled: WeekItem[] = [];
  items.forEach((item, index) => {
    const entry: WeekItem = { kind: item.kind, id: item.id, category: itemCategory(item.kind, item.id, source), title: itemTitle(item.kind, item.id, source), date: item.targetDate ?? null, index };
    const byWeek = item.week === undefined ? undefined : rows.find((row) => row.week.index === item.week);
    const date = item.targetDate;
    const byDate = date === undefined ? undefined : rows.find((row) => row.week.startDate <= date && date <= row.endDate);
    const row = byWeek ?? byDate;
    if (row) row.items.push(entry);
    else unscheduled.push(entry);
  });
  for (const row of rows) row.items.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.index - b.index);
  return { rows, unscheduled };
}

/** The index of the route week whose seven days hold `date`, or undefined when the date is outside the route. */
export function weekOfDate(weeks: readonly WeekMeta[], date: string): number | undefined {
  return weeks.find((week) => week.startDate <= date && date <= addDays(week.startDate, 6))?.index;
}

/** A route item on a new date: its `week` follows the date (dropped when the date is outside the route or cleared). */
export function withTargetDate(weeks: readonly WeekMeta[], item: PlanItem, date: string | undefined): PlanItem {
  const { targetDate: _date, week: _week, ...rest } = item;
  const week = date === undefined ? undefined : weekOfDate(weeks, date);
  return { ...rest, ...(date !== undefined ? { targetDate: date } : {}), ...(week !== undefined ? { week } : {}) };
}

/** Every dated route item with its `week` taken from its date again (after the one-per-day spacing moves some). */
export function reweek(weeks: readonly WeekMeta[], items: readonly PlanItem[]): PlanItem[] {
  return items.map((item) => (item.targetDate === undefined ? item : withTargetDate(weeks, item, item.targetDate)));
}

/** The plan indexes of a route's items in the order the builder shows them: week by week, then the unscheduled ones. */
export function routeShownOrder(groups: { rows: readonly WeekRow[]; unscheduled: readonly WeekItem[] }): number[] {
  return [...groups.rows.flatMap((row) => row.items.map((item) => item.index)), ...groups.unscheduled.map((item) => item.index)];
}

/**
 * Up and down on a route item (section 3.8 step 5): the two items trade places on the calendar.
 * Each slot keeps its date, week and position in the plan, and the items (with their notes)
 * move, so the order the grown-up sees and the queue a re-pace reads change together.
 */
export function swapRouteItems(items: readonly PlanItem[], a: number, b: number): PlanItem[] {
  const first = items[a];
  const second = items[b];
  if (first === undefined || second === undefined || a === b) return [...items];
  const into = (item: PlanItem, slot: PlanItem): PlanItem => {
    const { targetDate: _date, week: _week, ...rest } = item;
    return { ...rest, ...(slot.targetDate !== undefined ? { targetDate: slot.targetDate } : {}), ...(slot.week !== undefined ? { week: slot.week } : {}) };
  };
  return items.map((item, k) => (k === a ? into(second, first) : k === b ? into(first, second) : item));
}

/** The week's label (section 3.4 "Label" column) in `locale`. */
export function weekLabel(row: WeekRow, locale: UiLocale = DEFAULT_LOCALE, source: Catalog = CATALOG): string {
  const label = getMessages(locale).console.curriculum.preview.label;
  const { kind, focus } = row.week;
  if (kind === 'review') return label.review;
  if (kind === 'break') return label.break;
  if (kind === 'culture') {
    const story = source.stories.find((s) => s.id === focus.storyIds[0]);
    return story ? label.culture(story.title) : label.cultureNoStory;
  }
  if (focus.episodeId !== null) return itemTitle('episode', focus.episodeId, source);
  if (focus.storyIds.length > 0) return label.stories;
  if (row.items.some((item) => item.category === 'coming-soon')) return label.comingSoon;
  return label.freePractice;
}

/** An optional add-on of a week: a word topic or the Hangul Check (never an item, never counted). */
export function extraText(extra: WeekExtra, locale: UiLocale = DEFAULT_LOCALE, source: Catalog = CATALOG): string {
  const words = getMessages(locale).console.curriculum.preview.extras;
  if (extra.kind === 'hangul-check') return words.hangulCheck;
  return words.vocab(source.topics.find((t) => t.id === extra.topicId)?.title ?? extra.topicId);
}

/** A UTC date key as a short day ("Oct 18"). */
export function dayText(key: string, locale: UiLocale = DEFAULT_LOCALE): string {
  return formatDate(locale, key, 'monthDay', { utc: true });
}

/** "Oct 18 – Oct 24". */
export function dateRangeText(from: string, to: string, locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.curriculum.preview.dateRange(dayText(from, locale), dayText(to, locale));
}

/** A short weekday name for a chip ("Sun"), from a fixed week that starts on Sunday 11 October 2026. */
export function weekdayLabel(day: Weekday, locale: UiLocale = DEFAULT_LOCALE): string {
  return formatDate(locale, addDays('2026-10-11', WEEKDAYS.indexOf(day)), 'weekday', { utc: true });
}

/** What the free-plan wording of the left-out warning needs (F-ENT-003 section 3.9.3): the space kind and the weeks that hold lessons. */
export type FreePlanWording = Pick<FreeDaysView, 'kind' | 'firstWeek' | 'lastWeek'> & Partial<Pick<FreeDaysView, 'comingSoonClosed'>>;

/**
 * A generator warning in plain, invitational words (section 3.8 step 4). With `free` (an
 * unlicensed space while the free-plan switch is on, `freeDaysView`) the left-out line names the
 * free plan, the weeks that hold its lessons and the product that opens the rest, by space kind,
 * and the coming-soon line says which episodes open with that product once released (F-ENT-003
 * section 3.9.3). With `neutral` (`leftOutNeutral`) the left-out line names both products and
 * never "Premium". Without either, every line keeps its wording.
 */
export function warningText(warning: CurriculumWarning, locale: UiLocale = DEFAULT_LOCALE, free: FreePlanWording | null = null, neutral = false): string {
  const words = getMessages(locale).console.curriculum.preview.warnings;
  const freeDays = getMessages(locale).console.curriculum.freeDays;
  const count = warning.count ?? 0;
  if (warning.code === 'premium-needed' && free) {
    const product = getMessages(locale).console.access.product[free.kind];
    const { firstWeek, lastWeek } = free;
    return firstWeek === null || lastWeek === null ? freeDays.warningNoLessons(count, product) : freeDays.warning(firstWeek, lastWeek, count, product);
  }
  if (warning.code === 'premium-needed' && neutral) return freeDays.warningNeutral(count);
  // Coming-soon episodes past Stage 1 open with the product once released, not on their dates.
  if (warning.code === 'coming-soon-included' && free && (free.comingSoonClosed ?? 0) > 0) {
    return freeDays.comingSoon(count, Math.min(free.comingSoonClosed ?? 0, count), getMessages(locale).console.access.product[free.kind]);
  }
  switch (warning.code) {
    case 'content-runs-out':
      return words.contentRunsOut(warning.week ?? 1);
    case 'coming-soon-included':
      return words.comingSoon(count);
    case 'premium-needed':
      return words.premium(count);
    case 'fewer-sessions-than-units':
      return words.didNotFit(count);
    case 'session-too-short':
      return words.tooShort(count);
    case 'already-done-skipped':
      return words.alreadyDone(count);
  }
}

/** "18 lessons and stories · about 80 minutes · ends in Stage 2"; null when nothing ready is planned (the empty state). */
export function statsText(stats: Pick<CurriculumStats, 'readyItems' | 'minutesPlanned' | 'endsAtStage'>, locale: UiLocale = DEFAULT_LOCALE): string | null {
  if (stats.readyItems === 0) return null;
  const minutes = stats.minutesPlanned < 10 ? stats.minutesPlanned : Math.round(stats.minutesPlanned / 10) * 10;
  return getMessages(locale).console.curriculum.preview.stats(stats.readyItems, minutes, StageKeySchema.options.indexOf(stats.endsAtStage) + 1);
}

/** A learner's line on a route readout: "4 / 6 so far · 36 planned" (`total` is what the device has scheduled so far). */
export function readoutLine(row: ReadoutRow, planned: number, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.curriculum.readout;
  if (!row.synced) return words.waiting;
  return row.notReady > 0 ? words.lineNotReady(row.done, row.total, planned, row.notReady) : words.line(row.done, row.total, planned);
}

/** The plan the plan page shows: `?plan=` or the switcher's pick when it is still live, else the newest plan (F-PLAN-001 behaviour). */
export function selectedPlan<T extends PlanLike & { id: string }>(plans: readonly T[], selectedId: string | null): T | null {
  return plans.find((plan) => plan.id === selectedId && !plan.archivedAt) ?? currentPlan(plans);
}

/** A family learner's own route line on the roster ("Own route: 7 / 9 so far · 12 weeks"); never shown for a class or a school. */
export function ownRouteLine(kind: string, selfRoute: { done: number; total: number; weeks: number } | null | undefined, locale: UiLocale = DEFAULT_LOCALE): string | null {
  if (kind !== 'family' || !selfRoute) return null;
  return getMessages(locale).console.curriculum.entries.ownRoute(selfRoute.done, selfRoute.total, selfRoute.weeks);
}

type SwitchablePlan = PlanLike & { meta?: CurriculumMeta | null };

/** A plan that is published and not archived: the console's one live rule (the switcher here, the Learning Route goal sources). */
export const isLive = (plan: SwitchablePlan): boolean => plan.publishedAt !== null && plan.archivedAt === null;
const newestPublished = (a: SwitchablePlan, b: SwitchablePlan): number => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');

/** The plan switcher (section 3.8 step 5): the active route first, then the other live plans, then drafts; archived plans are left out. */
export function planSwitcherOrder<T extends SwitchablePlan>(plans: readonly T[]): T[] {
  const live = plans.filter(isLive).sort(newestPublished);
  const route = live.find((plan) => plan.meta !== null && plan.meta !== undefined);
  const drafts = plans.filter((plan) => plan.publishedAt === null && plan.archivedAt === null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return [...(route ? [route] : []), ...live.filter((plan) => plan !== route), ...drafts];
}

export type ThisWeek = { status: 'before'; startDate: string } | { status: 'in'; week: WeekMeta } | { status: 'after' };

/** Where today falls on a route: before its first week, inside a week, or after the last one. */
export function thisWeekOf(weeks: readonly WeekMeta[], today: string): ThisWeek {
  const first = weeks[0];
  if (first && today < first.startDate) return { status: 'before', startDate: first.startDate };
  const week = weeks.find((w) => w.startDate <= today && today <= addDays(w.startDate, 6));
  return week ? { status: 'in', week } : { status: 'after' };
}

/** The last day of a route (its end date never moves on a re-pace). */
export function routeEndDate(meta: CurriculumMeta): string {
  return addDays(meta.params.startDate, meta.params.weeks * 7 - 1);
}

export interface RepaceResult {
  /** The plan this result belongs to: a save into any other plan is refused. */
  planId: string;
  items: CurriculumItem[];
  meta: CurriculumMeta;
  /** The first item dated today or later, or null when no session is left. */
  nextDate: string | null;
  /** Items that no longer fit before the end: lessons and stories, and coming-soon episodes that are dropped. */
  leftOver: number;
  endDate: string;
}

const withWeeks = (meta: CurriculumMeta, extraWeeks: number): CurriculumMeta =>
  extraWeeks === 0 ? meta : { ...meta, params: { ...meta.params, weeks: meta.params.weeks + extraWeeks } };

/**
 * Re-pace from today (section 3.7), the console's only mode: `shift`. Items dated before
 * today stay; the rest keep their order and are laid on the session calendar from the next
 * session; the plan keeps its id and its horizon and gets `repacedAt`. `extraWeeks` is
 * **Add N weeks**: the same call on a longer calendar.
 */
export function repacePlan(plan: RepaceInput, today: string, nowIso: string, extraWeeks = 0, source: Catalog = CATALOG): RepaceResult {
  const draft = regenerateFrom({ meta: withWeeks(plan.meta, extraWeeks), items: plan.items }, today, source, { mode: 'shift' });
  const items = toPlanItems(draft);
  const meta: CurriculumMeta = { ...toMeta(draft), horizonDays: plan.meta.horizonDays, repacedAt: nowIso };
  // The generator counts ready lessons and stories only; a coming-soon placeholder that no longer fits is dropped too.
  const ahead = (list: readonly PlanItem[]): number => list.filter((item) => item.targetDate === undefined || item.targetDate >= today).length;
  const dropped = Math.max(0, ahead(plan.items) - ahead(items));
  return {
    planId: plan.id,
    items,
    meta,
    nextDate: items.find((item) => item.targetDate !== undefined && item.targetDate >= today)?.targetDate ?? null,
    leftOver: Math.max(dropped, draft.warnings.find((w) => w.code === 'fewer-sessions-than-units')?.count ?? 0),
    endDate: routeEndDate(meta),
  };
}

/** What a re-pace reads: the plan's id, its curriculum and its items. */
export interface RepaceInput {
  id: string;
  meta: CurriculumMeta;
  items: PlanItem[];
}

/** The plan save that stores a re-pace: the same id, title and learners, the new items and meta, still published. Null for a result of another plan. */
export function repaceSaveBody(
  plan: { id: string; title: string; targetLearnerIds: string[] | null },
  repaced: RepaceResult,
): { id: string; title: string; items: CurriculumItem[]; targetLearnerIds: string[] | null; publish: true; meta: CurriculumMeta } | null {
  if (repaced.planId !== plan.id) return null;
  return { id: plan.id, title: plan.title, items: repaced.items, targetLearnerIds: plan.targetLearnerIds, publish: true, meta: repaced.meta };
}

/** The fewest extra weeks that keep every item on a re-pace, or null when nothing is left over or no length up to 52 weeks fits. */
export function weeksToFit(plan: RepaceInput, today: string, source: Catalog = CATALOG): number | null {
  if (repacePlan(plan, today, '', 0, source).leftOver === 0) return null;
  const { weeks, sessionsPerWeek, sessionDays } = plan.meta.params;
  const perWeek = sessionDays === undefined ? sessionsPerWeek : sessionDays.length;
  for (let extra = 1; weeks + extra <= 52 && (weeks + extra) * perWeek <= CURRICULUM_MAX_ITEMS; extra += 1) {
    if (repacePlan(plan, today, '', extra, source).leftOver === 0) return extra;
  }
  return null;
}

/** A route made from an older catalogue than this build's: the readout offers **Refresh route** (a `shift` on the current catalogue; it adds no lessons). */
export function isStaleCatalog(meta: CurriculumMeta, source: Catalog = CATALOG): boolean {
  return meta.catalogVersion < source.version;
}

export interface DraftPlanBody {
  title: string;
  items: CurriculumItem[];
  meta: CurriculumMeta;
  targetLearnerIds: string[] | null;
  publish: false;
}

/** **Use this route**: an unpublished plan with the route's items and meta; a family route targets its learner. */
export function draftPlanBody(draft: CurriculumDraft, state: WizardState, locale: UiLocale = DEFAULT_LOCALE): DraftPlanBody {
  const meta = toMeta(draft);
  return {
    title: getMessages(locale).console.curriculum.preview.defaultTitle(meta.params.weeks),
    items: toPlanItems(draft),
    meta,
    targetLearnerIds: state.audience === 'family' && state.learnerId !== null ? [state.learnerId] : null,
    publish: false,
  };
}
