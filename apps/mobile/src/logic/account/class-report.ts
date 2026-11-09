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
  type StageKey,
} from '@hangul-route/content-schema';
import { formatDate, type Messages, type UiLocale } from '@hangul-route/i18n';
import { letterLabel, sentenceOf, type ReportSentence, type ReportStepButton, type ReportStepperView, type ReportTabsView } from '../reports/report-view';
import type { AccountClassReportBody } from './account-data';

/**
 * F-AUTH-004 section 8.7 (row NS-6; design `account-reports.md` board 2, `design/screens/reports/class-report.md`;
 * F-REPORT-001 section 3.7; CS-N5; anti-shame): the native account class report in words. The Worker computes the
 * class figures for one window (`classReport`, RP-5b); this module turns its codes and counts into the page's lines,
 * tabs and stepper, as the console's `class-report-view.ts` does, with what native leaves out (D14):
 *
 * - Send a note, Print, **Plan a lesson**, and the homework plan link: the homework counts stay, as plain text;
 * - the back link (the stack's Back is the way back), and the owner's archived sentence that points at Settings: every
 *   viewer reads the neutral `report.state.archived.class` (nobody unarchives here, ND-2).
 *
 * Hard rules (F-REPORT-001 section 3.7): every number is an aggregate. No learner id, name, avatar or row reaches the
 * view; nothing is ordered by a learner's figure (letters, bands, strands and plans are the only lists); "more than"
 * only when a figure grew, never a down marker. Pure: the clock, the words and the stage titles come in.
 */

/** A heading over counted letters ("ㅂ (b): 5"), each a sentence whose letter is marked Korean. */
export interface ClassLetterBlock {
  heading: string;
  chips: ReportSentence[];
}

export interface AccountClassReportView {
  /** "Sunflower class: class report". */
  title: string;
  /** The neutral archived line (`report.state.archived.class`) for an archived class; else null. */
  archived: string | null;
  /** Neutral lines under the title: members, an older app, last saved long ago. */
  classLines: string[];
  /** "No learners yet." for a class with no learner: nothing else is drawn. */
  empty: string | null;
  tabs: ReportTabsView | null;
  stepper: ReportStepperView | null;
  /** The polite announcement after a period change or a step. */
  announce: string | null;
  /** `note`: on All time, the neutral line that the totals include practice from before joining. */
  headline: { text: string; up: string | null; note: string | null } | null;
  /** Hidden with no practice in the window. */
  wentWell: {
    heading: string;
    letters: ClassLetterBlock | null;
    quests: { text: string; up: string | null };
    cards: string;
    milestones: { heading: string; lines: string[] } | null;
  } | null;
  practiceTogether: { heading: string; revisit: ClassLetterBlock } | null;
  thisPeriod: {
    heading: string;
    noneYet: string | null;
    afterUpdate: string | null;
    bands: { heading: string; rows: string[] } | null;
    notSaved: string | null;
    time: { heading: string; total: string; up: string | null; median: string | null } | null;
  } | null;
  moreDetail: {
    button: string;
    memory: { heading: string; lines: string[]; from: string } | null;
    levelCheck: { heading: string; strands: { name: string; rows: string[] }[] } | null;
    /** The class's plans as plain text: the title and its counts (the plan builder is not in the app, ND-2). */
    homework: { heading: string; plans: { title: string; counts: string }[] } | null;
  } | null;
}

export interface AccountClassReportInput {
  body: AccountClassReportBody;
  /** The period and the window the screen asks for (the tabs and the stepper read these at once). */
  period: ReportPeriod;
  at: string | null;
  /** The viewer's clock: the stepper's dates and limits read the viewer's own day. */
  now: Date;
  locale: UiLocale;
  messages: Messages;
  stageTitle: (stage: StageKey) => string;
}

const DAY_KEY_TIME = 'T00:00:00.000Z';
const instantOf = (day: string): string => `${day}${DAY_KEY_TIME}`;
/** "Oct 12", with the year when it is not `today`'s year (a learner-local day key, never shifted by a zone). */
const dayText = (day: string, today: string, locale: UiLocale): string =>
  formatDate(locale, instantOf(day), day.slice(0, 4) === today.slice(0, 4) ? 'monthDay' : 'monthDayYear', { utc: true });
/** "October 2026". */
const monthText = (day: string, locale: UiLocale): string => formatDate(locale, instantOf(`${day.slice(0, 7)}-01`), 'monthYear', { utc: true });

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
  if (period === 'day') return when.onDay(dayText(at, w.today, w.locale));
  if (period === 'week') return when.weekTo(dayText(at, w.today, w.locale));
  return when.inMonth(monthText(at, w.locale));
}

/** A window's dates: a week's range, a month, a day. */
function rangeOf(period: ReportPeriod, at: string | null, w: Words): string {
  const window = windowOf(period, w.today, at);
  if (period === 'day') return dayText(window.from, w.today, w.locale);
  if (period === 'month') return monthText(window.from, w.locale);
  return w.m.report.step.range(dayText(window.from, w.today, w.locale), dayText(window.to, w.today, w.locale));
}

/** A window's name in `a11y.report`: "this week", "last week", or its dates. */
function windowName(period: ReportPeriod, at: string | null, w: Words): string {
  return stepKind(period, at, w.today) === 'older' ? rangeOf(period, at, w) : whenOf(period, at, w);
}

/** Previous and Next within the class stepper's limits (`classAtOf`); Next is absent on the current window. */
function stepperOf(period: ReportPeriod, at: string | null, now: Date, w: Words): ReportStepperView | null {
  if (period === 'all' || w.today === '') return null;
  const m = w.m;
  let prevAt: string;
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
  const first = period === 'day' ? m.report.step.prevDay : period === 'week' ? m.report.step.prevWeek : m.report.step.prevMonth;
  const button = (target: string | null, label: string, name: (window: string) => string): ReportStepButton => ({ at: target, label, name: name(windowName(period, target, w)) });
  return {
    range: rangeOf(period, at, w),
    prev: classAtOf(period, prevAt, now) !== null ? button(prevAt, stepKind(period, prevAt, w.today) === 'previous' ? first : rangeOf(period, prevAt, w), m.a11y.report.step) : null,
    next: nextAt === undefined ? null : button(nextAt, m.report.step.next, m.a11y.report.stepNext),
  };
}

/** Sentinel for the letter inside `report.letter`; never in a message. */
const LETTER = '\u0002';

/** A letter with its number of learners, "ㅂ (b): 5" (`report.class.count`), the letter its own part (spoken in Korean). */
export function countedLetter(letter: string, count: number, m: Messages): ReportSentence {
  const label = letterLabel(letter);
  return sentenceOf((put) => {
    if (label.romanization === null) return m.report.class.count(put({ kind: 'letter', ...label, before: '', after: '' }), count);
    const text = m.report.letter(LETTER, label.romanization);
    const cut = text.indexOf(LETTER);
    return m.report.class.count(put({ kind: 'letter', ...label, before: text.slice(0, cut), after: text.slice(cut + LETTER.length) }), count);
  });
}

function bandLabel(band: Exclude<ClassDayBand, '0' | 'not_yet'>, m: Messages): string {
  const b = m.report.class.band;
  if (band === 'practiced') return b.practiced;
  if (band === '10+') return b.atLeast(10);
  const [from, to] = band.split('-').map(Number) as [number, number];
  return b.range(from, to);
}

/** One day-band row: "Didn't practice: 3" for the empty band, "1 to 2 days: 3" for the others. No highlight on any. */
function bandRow(band: ClassDayBand, learners: number, m: Messages): string {
  const c = m.report.class;
  return band === '0' || band === 'not_yet' ? c.didntPractice(learners) : c.count(bandLabel(band, m), learners);
}

const STATUS_ROWS: readonly [keyof ClassReport['levelCheck'][number], 'secure' | 'getting-there' | 'not-yet' | 'not-tested'][] = [
  ['secure', 'secure'],
  ['gettingThere', 'getting-there'],
  ['notYet', 'not-yet'],
  ['notTested', 'not-tested'],
];

const strandName = (strand: PlacementStrand, m: Messages): string => m.caregiver.placementReport.strand[strand];
const stageNumber = (stage: StageKey): number => StageKeySchema.options.indexOf(stage) + 1;

/**
 * The class's memory block (F-CURR-002 CM-16): totals added together, a line only above 0, and how many learners they
 * come from. Never a mean, a maximum or a learner's own figure. Null when the report carries none or every total is 0.
 */
function memoryOf(memory: ClassReport['memory'], m: Messages): NonNullable<AccountClassReportView['moreDetail']>['memory'] {
  if (!memory || memory.learners === 0) return null;
  const c = m.report.class;
  const [done, practiced, mastered] = memory.levels;
  const lines = [
    ...(memory.wordsKnown > 0 ? [c.wordsKnown(memory.wordsKnown)] : []),
    ...(memory.readyToRefresh > 0 ? [c.readyToRefresh(memory.readyToRefresh)] : []),
    ...(done + practiced + mastered > 0 ? [m.report.detail.mastery(done, practiced, mastered)] : []),
    ...(memory.stageChecks > 0 ? [c.stageChecks(memory.stageChecks)] : []),
  ];
  return lines.length ? { heading: m.report.detail.memory, lines, from: c.memoryFrom(memory.learners) } : null;
}

/** The class report in words, or null for a space that has no class report (a family or a school). */
export function accountClassReportView(input: AccountClassReportInput): AccountClassReportView | null {
  const { body, now, messages: m, locale } = input;
  if (body.space.kind !== 'class') return null;
  const r = body.report;
  // The controls read what the screen asks for, so a later period or step draws its tabs and stepper at once; a loaded
  // report reads the same window (the Worker's `classAtOf`).
  const period = input.period;
  const at = period === 'all' ? null : classAtOf(period, input.at, now);
  const today = viewerToday(now);
  const w: Words = { m, locale, today };
  const c = m.report.class;
  const when = whenOf(period, at, w);
  const past = at !== null;
  const previous = period === 'month' ? (past ? m.report.previous.monthBefore : m.report.previous.month) : past ? m.report.previous.weekBefore : m.report.previous.week;
  const up = (grew: true | undefined): string | null => (grew && period !== 'day' && period !== 'all' ? m.report.figure.up(previous) : null);

  const base = {
    title: m.report.title.class(body.space.name),
    archived: body.space.archivedAt !== null ? m.report.state.archived.class : null,
    classLines: [c.learners(r.class.learners), ...(r.class.olderApp > 0 ? [c.olderApp(r.class.olderApp)] : []), ...(r.class.notSaved7d > 0 ? [c.notSaved(r.class.notSaved7d)] : [])],
  };
  if (r.class.learners === 0) {
    return { ...base, empty: c.empty, tabs: null, stepper: null, announce: null, headline: null, wentWell: null, practiceTogether: null, thisPeriod: null, moreDetail: null };
  }

  const chips = (heading: string, letters: ClassReport['revisit']): ClassLetterBlock | null =>
    letters.length ? { heading, chips: letters.map((row) => countedLetter(row.letter, row.learners, m)) } : null;
  const practiced = r.headline.practiced > 0 && r.class.withActivity > 0;
  const revisit = chips(c.revisit, r.revisit);

  let thisPeriod: AccountClassReportView['thisPeriod'];
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
      bands: bands && bands.length ? { heading: c.section.daysPracticed, rows: bands.map((row) => bandRow(row.band, row.learners, m)) } : null,
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
  const memory = memoryOf(r.memory, m);
  const homework = r.plans.length ? { heading: c.section.homework, plans: r.plans.map((plan) => ({ title: plan.title, counts: c.planRow(plan.assigned, plan.started, plan.finished) })) } : null;

  return {
    ...base,
    empty: null,
    tabs: { label: m.a11y.report.periods, items: REPORT_PERIODS.map((p) => ({ id: p, label: m.report.period[p] })), value: period },
    stepper: stepperOf(period, at, now, w),
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
    practiceTogether: revisit !== null ? { heading: c.section.practiceTogether, revisit } : null,
    thisPeriod,
    moreDetail: memory || levelCheck || homework ? { button: m.report.section.moreDetail, memory, levelCheck, homework } : null,
  };
}
