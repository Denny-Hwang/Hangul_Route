import {
  REPORT_PERIODS,
  StageKeySchema,
  addDays,
  classAtOf,
  monthOf,
  todayFor,
  windowOf,
  type ClassDayBand,
  type ClassReport,
  type PlacementStrand,
  type ReportPeriod,
  type SpaceKind,
  type SpaceRole,
  type StageKey,
} from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ApiResult, ClassReportBody, SpaceListItem } from './api';
import {
  countedLetter,
  reportBackLink,
  reportDayText,
  reportLoadProblem,
  reportMonthText,
  reportViewerRights,
  type ReportLink,
  type ReportSentence,
  type ReportStepButton,
  type ReportStepper,
  type ReportTab,
} from './report-view';
import { ROUTES, groupSpaces } from './routing';

/**
 * The console's class report in words — F-REPORT-001 RP-8 (sections 3.1, 3.7, 3.14; design
 * `design/screens/reports/class-report.md`). The Worker computes the class figures (`classReport`, RP-5b); this module
 * turns its codes and counts into the page's lines, tabs, stepper and links.
 *
 * Hard rules (section 3.7, anti-shame): every number is an aggregate. No learner id, name, avatar or per-learner row
 * reaches the view; nothing is ordered by a learner's figure; letters, bands, strands and plans are the only lists;
 * "more than" only when a figure grew, never a down marker; the class report is a class space's only (a family gets
 * "not available").
 */

type Messages = ReturnType<typeof getMessages>;

/** A heading over counted letter chips ("ㅂ (b): 5"). */
export interface ClassLetterBlock {
  heading: string;
  chips: ReportSentence[];
}

export interface ClassReportView {
  documentTitle: string;
  printFooter: string;
  /** "Sunflower: class report". */
  title: string;
  back: ReportLink;
  /** The archived sentence: `console.settings.archived.class` for the owner, `report.state.archived.class` otherwise. */
  archived: string | null;
  /** Neutral lines under the title: members, an older app, last saved long ago. */
  classLines: string[];
  /** "No learners yet." for a class with no learner: nothing else is drawn. */
  empty: string | null;
  tabsLabel: string;
  tabs: ReportTab[] | null;
  stepper: ReportStepper | null;
  announce: string | null;
  /** `note`: on All time, the neutral line that the totals include practice from before joining (RP-2c). */
  headline: { text: string; up: string | null; note: string | null } | null;
  /** Hidden with no practice in the window (no heading). */
  wentWell: {
    heading: string;
    letters: ClassLetterBlock | null;
    quests: { text: string; up: string | null };
    cards: string;
    milestones: { heading: string; lines: string[] } | null;
  } | null;
  practiceTogether: { heading: string; revisit: ClassLetterBlock | null; planLesson: ReportLink | null } | null;
  thisPeriod: {
    heading: string;
    /** "No practice yet this week." when no learner practiced in the window. */
    noneYet: string | null;
    /** "Appears after learners' apps update." when no learner has day-by-day data. */
    afterUpdate: string | null;
    bands: { heading: string; rows: string[] } | null;
    /** Learners with day-by-day data whose window holds nothing saved in the class: never counted in "Not yet". */
    notSaved: string | null;
    time: { heading: string; total: string; up: string | null; median: string | null } | null;
  } | null;
  moreDetail: {
    button: string;
    levelCheck: { heading: string; strands: { name: string; rows: string[] }[] } | null;
    homework: { heading: string; plans: { href: string; title: string; counts: string }[] } | null;
  } | null;
}

export interface ClassReportViewInput {
  /** `getClassReport`'s body (while a later period or step loads: the cached one, whose figures are not drawn). */
  data: ClassReportBody;
  /** The address: the tabs, the stepper and the window's words read it. */
  query: { period: ReportPeriod; at: string | null };
  /** The viewer's clock: the stepper's dates and limits read the viewer's own day. */
  now: Date;
  /** The viewer's role in this class from `listSpaces()`; null when not listed (a school admin). */
  role: SpaceRole | null;
  /** `lectureModeEnabled()`: **Plan a lesson** links to the lecture setup with the revisit letters (F-TCH-004). */
  lecture: boolean;
  stageTitle: (stage: StageKey) => string;
  locale?: UiLocale;
}

const monthStart = (day: string): string => `${monthOf(day)}-01`;
/** The first day of the month after the one `day` is in. */
const nextMonthStart = (day: string): string => monthStart(addDays(`${monthOf(day)}-28`, 4));
/** The first day of the month before the one `day` is in. */
const prevMonthStart = (day: string): string => monthStart(addDays(monthStart(day), -1));

/** The viewer's own day: the class stepper names the windows the viewer lives in. */
const viewerToday = (now: Date): string => (Number.isNaN(now.getTime()) ? '' : todayFor(now, -now.getTimezoneOffset()));

/** Where the window at `at` sits: the current one, the first step back, or older. */
function stepKind(period: ReportPeriod, at: string | null, today: string): 'current' | 'previous' | 'older' {
  if (at === null) return 'current';
  if (period === 'day') return at === addDays(today, -1) ? 'previous' : 'older';
  if (period === 'week') return at === addDays(today, -7) ? 'previous' : 'older';
  return monthStart(at) === prevMonthStart(today) ? 'previous' : 'older';
}

interface Words {
  m: Messages;
  locale: UiLocale;
  today: string;
}

/** The window inside a sentence: "this week", "last week", "in the week to Oct 1", "so far". */
function whenOf(period: ReportPeriod, at: string | null, w: Words): string {
  const when = w.m.report.when;
  if (period === 'all') return when.all;
  const kind = stepKind(period, at, w.today);
  if (kind === 'current' || at === null) return when[period];
  if (kind === 'previous') return period === 'day' ? when.prevDay : period === 'week' ? when.prevWeek : when.prevMonth;
  if (period === 'day') return when.onDay(reportDayText(at, w.today, w.locale));
  if (period === 'week') return when.weekTo(reportDayText(at, w.today, w.locale));
  return when.inMonth(reportMonthText(at, w.locale));
}

/** A window's dates: a week's range, a month, a day. */
function rangeOf(period: ReportPeriod, at: string | null, w: Words): string {
  const window = windowOf(period, w.today, at);
  if (period === 'day') return reportDayText(window.from, w.today, w.locale);
  if (period === 'month') return reportMonthText(window.from, w.locale);
  return w.m.report.step.range(reportDayText(window.from, w.today, w.locale), reportDayText(window.to, w.today, w.locale));
}

/** A window's name in `a11y.report`: "this week", "last week", or its dates. */
function windowName(period: ReportPeriod, at: string | null, w: Words): string {
  const kind = stepKind(period, at, w.today);
  if (kind === 'older') return rangeOf(period, at, w);
  return whenOf(period, at, w);
}

/** Previous and Next within the class stepper's limits (`classAtOf`); Next is absent on the current window. */
function stepperOf(period: ReportPeriod, at: string | null, now: Date, href: (at: string | null) => string, w: Words): ReportStepper | null {
  if (period === 'all' || w.today === '') return null;
  const m = w.m;
  let prevAt: string | null;
  let nextAt: string | null | undefined;
  if (period === 'month') {
    prevAt = prevMonthStart(at ?? w.today);
    const next = at === null ? undefined : nextMonthStart(at);
    nextAt = next === undefined ? undefined : monthOf(next) >= monthOf(w.today) ? null : next;
  } else {
    const size = period === 'day' ? 1 : 7;
    prevAt = addDays(at ?? w.today, -size);
    const next = at === null ? undefined : addDays(at, size);
    nextAt = next === undefined ? undefined : next >= w.today ? null : next;
  }
  const prevOk = classAtOf(period, prevAt, now) !== null;
  const first = period === 'day' ? m.report.step.prevDay : period === 'week' ? m.report.step.prevWeek : m.report.step.prevMonth;
  const button = (target: string | null, label: string, name: (window: string) => string): ReportStepButton => ({ href: href(target), label, name: name(windowName(period, target, w)) });
  return {
    range: rangeOf(period, at, w),
    prev: prevOk && prevAt !== null ? button(prevAt, stepKind(period, prevAt, w.today) === 'previous' ? first : rangeOf(period, prevAt, w), m.a11y.report.step) : null,
    next: nextAt === undefined ? null : button(nextAt, m.report.step.next, m.a11y.report.stepNext),
  };
}

function bandLabel(band: ClassDayBand, m: Messages): string {
  const b = m.report.class.band;
  if (band === '0' || band === 'not_yet') return b.none;
  if (band === 'practiced') return b.practiced;
  if (band === '10+') return b.atLeast(10);
  const [from, to] = band.split('-').map(Number) as [number, number];
  return b.range(from, to);
}

const STATUS_ROWS: readonly [keyof ClassReport['levelCheck'][number], 'secure' | 'getting-there' | 'not-yet' | 'not-tested'][] = [
  ['secure', 'secure'],
  ['gettingThere', 'getting-there'],
  ['notYet', 'not-yet'],
  ['notTested', 'not-tested'],
];

const strandName = (strand: PlacementStrand, m: Messages): string => m.caregiver.placementReport.strand[strand];
const stageNumber = (stage: StageKey): number => StageKeySchema.options.indexOf(stage) + 1;

/** The class report page in words (section 3.7). */
export function classReportView(input: ClassReportViewInput): ClassReportView {
  const { data, now } = input;
  const locale = input.locale ?? DEFAULT_LOCALE;
  const m = getMessages(locale);
  const r = data.report;
  // The controls read the address, so a later period or step draws its tabs and stepper at once while the panel loads
  // (the cached report's figures are not drawn then); a loaded report reads the same window (the Worker's `classAtOf`).
  const period = input.query.period;
  const at = period === 'all' ? null : classAtOf(period, input.query.at, now);
  const today = viewerToday(now);
  const w: Words = { m, locale, today };
  const space = data.space;
  const archived = space.archivedAt !== null;
  const rights = reportViewerRights(input.role, 'class');
  const c = m.report.class;
  const when = whenOf(period, at, w);
  const past = at !== null;
  const previous = period === 'month' ? (past ? m.report.previous.monthBefore : m.report.previous.month) : past ? m.report.previous.weekBefore : m.report.previous.week;
  const up = (grew: true | undefined): string | null => (grew && period !== 'day' && period !== 'all' ? m.report.figure.up(previous) : null);
  const href = (target: string | null): string => ROUTES.classReport({ spaceId: space.id, period, at: target });
  const printed = formatDate(locale, now.getTime(), 'monthDay') || formatDate(locale, data.serverTime, 'monthDay');

  const base = {
    documentTitle: m.report.documentTitle,
    printFooter: m.report.print.footer(printed),
    title: m.report.title.class(space.name),
    back: { href: ROUTES.space(space.id), text: m.report.back.space(space.name) },
    archived: archived ? (rights.manage ? m.console.settings.archived.class : m.report.state.archived.class) : null,
    tabsLabel: m.a11y.report.periods,
  };
  const classLines = [c.learners(r.class.learners), ...(r.class.olderApp > 0 ? [c.olderApp(r.class.olderApp)] : []), ...(r.class.notSaved7d > 0 ? [c.notSaved(r.class.notSaved7d)] : [])];

  if (r.class.learners === 0) {
    return { ...base, classLines, empty: c.empty, tabs: null, stepper: null, announce: null, headline: null, wentWell: null, practiceTogether: null, thisPeriod: null, moreDetail: null };
  }

  const chips = (heading: string, letters: ClassReport['revisit']): ClassLetterBlock | null =>
    letters.length ? { heading, chips: letters.map((row) => countedLetter(row.letter, row.learners, locale)) } : null;
  const practiced = r.headline.practiced > 0 && r.class.withActivity > 0;

  const revisit = chips(c.revisit, r.revisit);
  const planLesson = input.lecture && rights.planWrite && !archived ? { href: ROUTES.spaceLecture(space.id, 'revisit'), text: c.planLesson } : null;

  let thisPeriod: ClassReportView['thisPeriod'];
  if (r.class.withActivity === 0) {
    thisPeriod = { heading: m.report.section.thisPeriod, noneYet: null, afterUpdate: c.afterUpdate, bands: null, notSaved: null, time: null };
  } else {
    const h = m.report.headline;
    const bands = r.practice.dayBands;
    const notSaved = r.practice.notSaved ?? 0;
    thisPeriod = {
      heading: m.report.section.thisPeriod,
      noneYet: practiced ? null : period === 'all' ? h.noneEver : past ? h.noneThen(when) : h.noneYet(when),
      afterUpdate: null,
      bands: bands && bands.length ? { heading: c.section.daysPracticed, rows: bands.map((row) => c.count(bandLabel(row.band, m), row.learners)) } : null,
      notSaved: notSaved > 0 ? c.windowNotSaved(notSaved) : null,
      time: {
        heading: c.section.time,
        total: c.minutesTotal(r.time.minutesTotal.count),
        up: up(r.time.minutesTotal.up),
        median: r.time.minutesMedian === null ? null : c.medianMinutes(r.time.minutesMedian),
      },
    };
  }

  const levelCheck = r.levelCheck.length
    ? {
        heading: c.section.levelCheck,
        strands: r.levelCheck.map((row) => ({ name: strandName(row.strand, m), rows: STATUS_ROWS.map(([key, status]) => c.count(m.report.strand.status[status], row[key] as number)) })),
      }
    : null;
  const homework = r.plans.length
    ? { heading: c.section.homework, plans: r.plans.map((plan) => ({ href: ROUTES.spacePlan(space.id, plan.planId), title: plan.title, counts: c.planRow(plan.assigned, plan.started, plan.finished) })) }
    : null;

  return {
    ...base,
    classLines,
    empty: null,
    tabs: REPORT_PERIODS.map((p) => ({ period: p, label: m.report.period[p], selected: p === period, href: ROUTES.classReport({ spaceId: space.id, period: p }) })),
    stepper: stepperOf(period, at, now, href, w),
    announce: period === 'all' ? m.a11y.report.periodChangedAll : m.a11y.report.periodChanged(windowName(period, at, w)),
    headline: { text: c.headline(r.headline.practiced, r.headline.learners, when), up: up(r.headline.up), note: period === 'all' ? c.allBeforeJoin : null },
    wentWell: practiced
      ? {
          heading: m.report.section.wentWell,
          letters: chips(c.lettersNew, r.wentWell.lettersNew),
          quests: { text: c.questsNew(r.wentWell.questsNew.count), up: up(r.wentWell.questsNew.up) },
          cards: c.cardsNew(r.wentWell.cardsNew),
          milestones: r.wentWell.milestones.length
            ? {
                heading: c.milestones(when),
                // A stage this build cannot name (a newer Worker's) is left out, never shown as a code.
                lines: r.wentWell.milestones.flatMap((row) => {
                  const stage = StageKeySchema.safeParse(row.stage);
                  return stage.success ? [c.milestone(stageNumber(stage.data), input.stageTitle(stage.data), row.count)] : [];
                }),
              }
            : null,
        }
      : null,
    practiceTogether: revisit || planLesson ? { heading: c.section.practiceTogether, revisit, planLesson } : null,
    thisPeriod,
    moreDetail: levelCheck || homework ? { button: m.report.section.moreDetail, levelCheck, homework } : null,
  };
}

/** Which screen the class page draws (section 3.14). */
export type ClassReportScreen =
  | { kind: 'state'; title: string; retry: string | null; back: ReportLink }
  | { kind: 'chooser' }
  | { kind: 'loading'; back: ReportLink }
  | { kind: 'report'; data: ClassReportBody; busy: boolean; error: { message: string; retry: string } | null }
  | { kind: 'signedOut' };

export interface ClassReportScreenInput {
  enabled: boolean;
  spaceId: string;
  load: ApiResult<ClassReportBody> | null;
  /** The last body this tab loaded for the class (any window): drawn as a skeleton's frame while a later load runs. */
  cached: ClassReportBody | null;
  /** Whether `cached` was loaded for the address's period and window: only then does it stay under a failed load. */
  cachedWindow?: boolean;
  locale?: UiLocale;
}

export function classReportScreenOf(input: ClassReportScreenInput): ClassReportScreen {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const m = getMessages(locale);
  const back = reportBackLink(null, null, locale);
  if (!input.enabled) return { kind: 'state', title: m.report.state.flagOff, retry: null, back };
  if (!input.spaceId) return { kind: 'chooser' };
  const { load, cached } = input;
  if (load === null) return cached ? { kind: 'report', data: cached, busy: true, error: null } : { kind: 'loading', back };
  if (load.ok) return load.data.space.kind === 'class' ? { kind: 'report', data: load.data, busy: false, error: null } : { kind: 'state', title: m.report.state.unavailable, retry: null, back };
  const problem = reportLoadProblem(load, locale);
  if (problem.kind === 'signedOut') return { kind: 'signedOut' };
  const message = problem.message ?? m.report.state.error;
  // The Worker computes the figures for one window: a cached body stays under the error only for the same window.
  if (problem.kind === 'error' && problem.retry !== null && cached && input.cachedWindow === true) return { kind: 'report', data: cached, busy: false, error: { message, retry: problem.retry } };
  return { kind: 'state', title: message, retry: problem.retry, back };
}

/** The class chooser (`/teach/space/report` with no id): the account's class spaces in teacher-home order. */
export function classChooserRows(spaces: readonly SpaceListItem[]): { href: string; name: string }[] {
  return groupSpaces(spaces).class.map((item) => ({ href: ROUTES.classReport({ spaceId: item.space.id }), name: item.space.name }));
}

/**
 * The roster roll-up's **Class report** link (section 3.1, RP-8): class spaces only (a family never gets class
 * statistics: siblings are never compared), and only while `reportsEnabled(locale)` holds.
 */
export function rosterClassReportLink(opts: { spaceId: string; kind: SpaceKind; enabled: boolean; locale?: UiLocale }): ReportLink | null {
  if (!opts.enabled || opts.kind !== 'class') return null;
  return { href: ROUTES.classReport({ spaceId: opts.spaceId }), text: getMessages(opts.locale ?? DEFAULT_LOCALE).report.class.link };
}
