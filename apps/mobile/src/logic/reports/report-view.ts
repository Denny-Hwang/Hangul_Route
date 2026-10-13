import {
  INITIAL_JAMO,
  INITIAL_RR,
  MEDIAL_RR,
  PlacementLevelSchema,
  REPORT_PERIODS,
  StageKeySchema,
  learnerReport,
  practiceNext,
  todayFor,
  wentWell,
  type Catalog,
  type InsightCode,
  type InsightLine,
  type InsightSummary,
  type LearnerReport,
  type LearnerReportState,
  type PlacementStrand,
  type ReportCalendarKind,
  type ReportPeriod,
  type ReportVoice,
  type StageKey,
} from '@hangul-route/content-schema';
import { formatDate, type Messages, type UiLocale } from '@hangul-route/i18n';
import { bandLabel } from '../placement/copy';

/**
 * The in-app learner report in words — F-REPORT-001 section 3.9 (RP-9; sections 3.5, 3.6, 3.11, 3.12; design
 * `design/screens/reports/in-app-report.md`). The report module (`packages/content-schema/src/reports/`) returns codes
 * and numbers for the device viewer; this module turns them into the sentences, labels and tiles the
 * `LearnerReport` screen draws, from `report.*` and `a11y.report.*`. Pure: the clock, the catalogue, the messages and
 * the content lookups (stage and quest titles, a letter's content romanization and gloss) come in as arguments.
 *
 * - **Voice** (OD-17): the third person for a grown-up; the second person (`report.you.*`) when `reportVoice` says so
 *   (an adult learning alone reading their own report). Lines that do not name the learner read the same in both.
 * - **Device rules** (section 3.9): no line actions (no plan builder in the app), no Browse link on a letter (letters
 *   in a sentence are plain text with their romanization; the More detail tiles expand to the content romanization
 *   and gloss), words hidden until F-VOC-005 P-4b, plan rows in the `device` variant.
 * - **Anti-shame** (CLAUDE.md section 1): one learner only, "more than" only when a figure grew, no percentage, no
 *   word about speaking, an empty section has no heading.
 */

// ---------------------------------------------------------------------------------------------
// Parts of a sentence

/** A taught letter with its short sound value ("b" for ㅂ); null romanization for a symbol this build cannot read. */
export interface ReportLetterLabel {
  letter: string;
  romanization: string | null;
}

/**
 * A part of a sentence. `letter`: `before` + the letter (marked Korean) + `after` reads `report.letter` ("ㅂ (b)").
 * `quest`: a catalogue title (plain text in the app).
 */
export type ReportPart =
  | { kind: 'text'; text: string }
  | ({ kind: 'letter'; before: string; after: string } & ReportLetterLabel)
  | { kind: 'quest'; id: string; title: string };

/** One sentence: its parts in order, and the same words as plain text (screen readers, tests). */
export interface ReportSentence {
  text: string;
  parts: ReportPart[];
}

/** The first vowel of Hangul compatibility jamo (ㅏ), in `MEDIAL_RR` order. */
const FIRST_VOWEL = 0x314f;
/** ㅇ is silent at the start of a block: its one heard sound is the final "ng". */
const IEUNG = 'ㅇ';

/** A taught letter with its short sound value ("ㅂ (b)"), as the console reads it; null romanization when unknown. */
export function letterLabel(letter: string): ReportLetterLabel {
  if (letter === IEUNG) return { letter, romanization: 'ng' };
  // `INITIAL_RR` runs parallel to `INITIAL_JAMO`; index -1 (not an initial) reads undefined.
  const initial = INITIAL_RR[INITIAL_JAMO.indexOf(letter)];
  if (initial !== undefined) return { letter, romanization: initial };
  const vowel = letter.length === 1 ? MEDIAL_RR[letter.charCodeAt(0) - FIRST_VOWEL] : undefined;
  return { letter, romanization: vowel ?? null };
}

/** Sentinels around a part's index inside a rendered message; never in a message or a name. */
const OPEN = '\u0000';
const CLOSE = '\u0001';
const PART_RE = /\u0000(\d+)\u0001/g;
const STRAY_RE = /[\u0000\u0001]/g;

type Placed = Exclude<ReportPart, { kind: 'text' }>;

const plainOf = (part: ReportPart): string =>
  part.kind === 'text' ? part.text : part.kind === 'letter' ? `${part.before}${part.letter}${part.after}` : part.title;

/**
 * A message rendered with its taught parts held apart: `render` gets `put`, which returns a placeholder for a part.
 * Each part is used once, in order, as the messages promise (`report.list`); a repeat is dropped, never drawn twice.
 */
export function sentenceOf(render: (put: (part: Placed) => string) => string): ReportSentence {
  const held: Placed[] = [];
  const raw = render((part) => `${OPEN}${held.push(part) - 1}${CLOSE}`);
  const parts: ReportPart[] = [];
  const used = new Set<number>();
  const text = (value: string): void => {
    const clean = value.replace(STRAY_RE, '');
    if (clean) parts.push({ kind: 'text', text: clean });
  };
  let last = 0;
  for (const match of raw.matchAll(PART_RE)) {
    text(raw.slice(last, match.index));
    const index = Number(match[1]);
    const part = held[index];
    if (part !== undefined && !used.has(index)) {
      used.add(index);
      parts.push(part);
    }
    last = match.index + match[0].length;
  }
  text(raw.slice(last));
  return { text: parts.map(plainOf).join(''), parts };
}

const plainSentence = (text: string): ReportSentence => ({ text, parts: [{ kind: 'text', text }] });

function letterPart(letter: string, m: Messages): Placed {
  const label = letterLabel(letter);
  if (label.romanization === null) return { kind: 'letter', ...label, before: '', after: '' };
  const text = m.report.letter(OPEN, label.romanization);
  const at = text.indexOf(OPEN);
  return { kind: 'letter', ...label, before: text.slice(0, at), after: text.slice(at + OPEN.length) };
}

// ---------------------------------------------------------------------------------------------
// Dates (learner-local day keys, never shifted by the device's zone)

const DAY_KEY_TIME = 'T00:00:00.000Z';
const instantOf = (day: string): string => `${day}${DAY_KEY_TIME}`;

/** "Oct 12", with the year when it is not `today`'s year. */
function dayText(day: string, locale: UiLocale, today: string): string {
  return formatDate(locale, instantOf(day), day.slice(0, 4) === today.slice(0, 4) ? 'monthDay' : 'monthDayYear', { utc: true });
}

/** "October 2026". */
const monthText = (day: string, locale: UiLocale): string => formatDate(locale, instantOf(`${day.slice(0, 7)}-01`), 'monthYear', { utc: true });

/** "Monday": the calendar sentence names days in full (section 3.12). */
const weekdayLongText = (day: string, locale: UiLocale): string => formatDate(locale, instantOf(day), 'weekdayLong', { utc: true });

/** "Mon": the cell's weekday label. */
const weekdayText = (day: string, locale: UiLocale): string => formatDate(locale, instantOf(day), 'weekday', { utc: true });

// ---------------------------------------------------------------------------------------------
// The input and the words of one report

export interface InAppReportInput {
  /** The local summary of the profile (`summarize` with `buildActivity`); null when it could not be built. */
  summary: InsightSummary | null;
  /** The profile's display name. */
  name: string;
  voice: ReportVoice;
  period: ReportPeriod;
  /** A learner-local day selecting a past window (the stepper); null for the current one. */
  at: string | null;
  now: Date;
  catalog: Catalog;
  locale: UiLocale;
  messages: Messages;
  /** A stage's title (content, localized). */
  stageTitle: (stage: StageKey) => string;
  /** A quest's title in the UI locale; null for a quest this build does not hold. */
  questTitle: (id: string) => string | null;
  /** A letter's content sound value and its sound hint (the bundled jamo, localized); null when unknown. */
  letterInfo: (letter: string) => { romanization: string; gloss: string | null } | null;
  /** The grown-up read-only Learning Route (L1) is on this build: the glance links to it. */
  learningRoute: boolean;
}

export interface ReportWords {
  name: string;
  voice: ReportVoice;
  period: ReportPeriod;
  locale: UiLocale;
  today: string;
  when: string;
  previous: string;
  m: Messages;
  input: InAppReportInput;
}

/** The window inside a sentence (`report.when`). */
function whenOf(report: LearnerReport, m: Messages, locale: UiLocale, today: string): string {
  const when = m.report.when;
  const window = report.window;
  if (report.period === 'all') return when.all;
  if (window === null || window.step === 'current') return when[report.period];
  if (window.step === 'previous') return report.period === 'day' ? when.prevDay : report.period === 'week' ? when.prevWeek : when.prevMonth;
  if (report.period === 'day') return when.onDay(dayText(window.from, locale, today));
  if (report.period === 'week') return when.weekTo(dayText(window.to, locale, today));
  return when.inMonth(monthText(window.from, locale));
}

export function reportWordsOf(report: LearnerReport, input: InAppReportInput, today: string): ReportWords {
  const { messages: m, locale } = input;
  const past = report.window !== null && report.window.step !== 'current';
  const previous =
    report.period === 'month' ? (past ? m.report.previous.monthBefore : m.report.previous.month) : past ? m.report.previous.weekBefore : m.report.previous.week;
  return { name: input.name, voice: report.voice, period: report.period, locale, today, when: whenOf(report, m, locale, today), previous, m, input };
}

// ---------------------------------------------------------------------------------------------
// The headline and the insight lines

/** The sentence under the tabs (section 3.5 item 5), or null without day-by-day data. */
export function headlineText(report: LearnerReport, w: ReportWords): string | null {
  const headline = report.headline;
  if (headline === null) return null;
  const { m, name } = w;
  const h = m.report.headline;
  const you = w.voice === 'second' ? m.report.you.headline : null;
  const past = report.window !== null && report.window.step !== 'current';
  const all = report.period === 'all';
  switch (headline.code) {
    case 'stage_done': {
      const stage = headline.stage as NonNullable<typeof headline.stage>;
      const title = w.input.stageTitle(stage.stage);
      if (all) return you ? you.stageDoneAll(stage.n, title) : h.stageDoneAll(name, stage.n, title);
      return you ? you.stageDone(stage.n, title, w.when) : h.stageDone(name, stage.n, title, w.when);
    }
    case 'practiced':
      if (report.period === 'day') return you ? you.practicedOn(w.when) : h.practicedOn(name, w.when);
      return you ? you.practiced(headline.days, w.when) : h.practiced(name, headline.days, w.when);
    case 'none_saved': {
      if (!past) return you ? you.noneSaved(w.when) : h.noneSaved(name, w.when);
      const asOf = dayText(report.horizon?.asOf ?? w.today, w.locale, w.today);
      return you ? you.noneSavedAfter(asOf) : h.noneSavedAfter(name, asOf);
    }
    case 'none_yet':
      return all ? h.noneEver : past ? h.noneThen(w.when) : h.noneYet(w.when);
    default:
      return you ? you.gettingStarted : h.gettingStarted(name);
  }
}

/** One "went well" or "practice next" line. The app draws no action on a line (section 3.9). */
export interface ReportLineView {
  code: InsightCode;
  sentence: ReportSentence;
  /** The strand tip under P2 (`report.tip`), else null. */
  tip: string | null;
}

const strandName = (strand: PlacementStrand, m: Messages): string => m.caregiver.placementReport.strand[strand];

/**
 * The strand tip (section 3.11). `{game}` is a game's title from the dictionary's game names
 * (`learner.myRoute.games`, the words the Learning Route's skill sheet uses): a letter game and a listening game.
 */
function tipOf(strand: PlacementStrand, w: ReportWords): string {
  const { m } = w;
  const games = m.learner.myRoute.games;
  if (strand === 'hangul-recognition') return m.report.tip[strand](games.matchShape);
  if (strand === 'sound-letter') return m.report.tip[strand](games.listenPick);
  if (w.voice === 'second' && (strand === 'syllable-reading' || strand === 'sentences')) return m.report.you.tip[strand];
  return m.report.tip[strand];
}

/**
 * The sentence of one insight line (section 3.6) in the report's voice; null for a line the app does not word: a
 * quest this build cannot title, and word lines (words stay hidden on the device until F-VOC-005 P-4b).
 */
export function insightView(line: InsightLine, w: ReportWords): ReportLineView | null {
  const { m, name } = w;
  const i = m.report.insight;
  const you = w.voice === 'second' ? m.report.you.insight : null;
  const day = w.period === 'day';
  const letters = (put: (part: Placed) => string, list: readonly string[]): string => m.report.list(list.map((letter) => put(letterPart(letter, m))));
  const plain = (text: string): ReportLineView => ({ code: line.code, sentence: plainSentence(text), tip: null });
  switch (line.code) {
    case 'showed_up':
      if (day) return plain(you ? you.practice_day : i.practice_day(name));
      return plain(you ? you.showed_up(line.params.days, w.when) : i.showed_up(name, line.params.days, w.when));
    case 'stage_done': {
      const { stage, n } = line.params.stage;
      return plain(you ? you.stage_done(n, w.input.stageTitle(stage)) : i.stage_done(name, n, w.input.stageTitle(stage)));
    }
    case 'letters_new':
      return {
        code: line.code,
        sentence: sentenceOf((put) => (you ? you.letters_new(letters(put, line.params.letters)) : i.letters_new(name, letters(put, line.params.letters)))),
        tip: null,
      };
    case 'practice_days':
      if (day) return plain(you ? you.practice_day : i.practice_day(name));
      return plain(you ? you.practice_days(line.params.days) : i.practice_days(name, line.params.days));
    case 'minutes_up':
      return plain(i.minutes_up(w.previous, line.params.minutes));
    case 'quests_new':
      return plain(i.quests_new(line.params.count));
    case 'cards_new':
      return plain(i.cards_new(line.params.count));
    case 'level_secure':
      return plain(i.level_secure(line.params.strands.map((strand) => strandName(strand, m))));
    case 'plan_done':
      return plain(i.plan_done[line.params.kind]);
    case 'streak':
      return plain(i.streak(line.params.days));
    case 'rhythm':
      return plain(i.rhythm);
    case 'letters_revisit':
      return { code: line.code, sentence: sentenceOf((put) => i.letters_revisit(letters(put, line.params.letters))), tip: null };
    case 'strand_next':
      return { code: line.code, sentence: plainSentence(i.strand_next(strandName(line.params.strand, m))), tip: tipOf(line.params.strand, w) };
    case 'plan_open':
      return plain(i.plan_open[line.params.kind](line.params.count));
    case 'next_in_plan':
    case 'next_on_route': {
      const id = line.params.questId;
      const title = w.input.questTitle(id);
      if (title === null) return null;
      const message = line.code === 'next_in_plan' ? i.next_in_plan : i.next_on_route;
      return { code: line.code, sentence: sentenceOf((put) => message(put({ kind: 'quest', id, title }))), tip: null };
    }
    case 'free_days_done':
      return plain(you ? you.free_days_done : i.free_days_done(name));
    default:
      // `words_new` and `words_revisit`: words stay hidden on the device too (section 3.9).
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// The screen view

export interface ReportTabsView {
  /** The tablist's name (`a11y.report.periods`). */
  label: string;
  items: { id: ReportPeriod; label: string }[];
  value: ReportPeriod;
}

export interface ReportStepButton {
  /** The window it opens, as the screen's `at`: null for the current window. */
  at: string | null;
  /** "Last week" for the first step back, else the dates of the window it opens; "Next" forward. */
  label: string;
  /** The accessible name, holding the visible label (WCAG 2.5.3): "Show last week", "Show this week". */
  name: string;
}

export interface ReportStepperView {
  /** The window's dates between the buttons. */
  range: string;
  /** Absent on the oldest window the stepper allows. */
  prev: ReportStepButton | null;
  /** Absent on the current window. */
  next: ReportStepButton | null;
}

export interface ReportGlanceView {
  /** "Now on Stage 1: Hangul"; null without a readable stage. */
  nowOn: string | null;
  /** **Open Learning Route** (`report.glance.openRoute`), only when L1 exists on this build. */
  openRoute: string | null;
  /** "Last practice: Oct 12"; null when there is none. */
  lastPractice: string | null;
}

export interface ReportSectionView {
  heading: string;
  lines: ReportLineView[];
}

export interface ReportFigureTile {
  key: 'days' | 'minutes' | 'quests' | 'cards' | 'letters';
  label: string;
  count: number;
  /** "More than last week", only when the figure grew (OD-11). */
  up: string | null;
}

export interface ReportCalendarCellView {
  day: string;
  /** The device saves every day up to today: a not-saved cell can only be a day another device holds, drawn as none. */
  kind: Exclude<ReportCalendarKind, 'not_saved'>;
  /** The short weekday ("Mon"). */
  weekday: string;
  /** The day of the month. */
  date: number;
}

export interface ReportCalendarView {
  /** Blank cells before the first one in a Monday-first month grid (0 for a week). */
  lead: number;
  cells: ReportCalendarCellView[];
  /** The visible sentence under the calendar: the practiced days, or "No practice days in this period." */
  sentence: string;
}

export interface ReportGrowthView {
  /** "Since Sep 14: 11 practice days". */
  since: string | null;
  quests: string;
  cards: string;
  month: string;
  /** The table's caption (`a11y.report.growthTable`). */
  caption: string;
  showTable: string;
  hideTable: string;
  /** Cumulative counts per month: they only rise (OD-10). */
  rows: { m: string; label: string; quests: number; cards: number }[];
  /** The highest cumulative count, for the drawing's scale (at least 1). */
  max: number;
}

export interface ReportThisPeriodView {
  heading: string;
  figures: ReportFigureTile[] | null;
  calendar: ReportCalendarView | null;
  growth: ReportGrowthView | null;
}

/** A letter tile in More detail: the letter and its short sound, expanding to the content romanization and gloss. */
export interface ReportLetterTile extends ReportLetterLabel {
  detail: { romanization: string; gloss: string | null } | null;
}

export type ReportDetailBlock =
  /** "Since the start: 6 quests, 5 cards": leads the panel with no heading of its own. */
  | { kind: 'totals'; line: string }
  /** `moreLine`: "And N more letters" after the strong tiles when more are known than they show, else null. */
  | { kind: 'letters'; key: 'strong' | 'practising' | 'new'; heading: string; tiles: ReportLetterTile[]; more: number; moreLine: string | null }
  | { kind: 'lines'; key: 'milestones' | 'levelCheck' | 'plan'; heading: string; lines: string[] };

export interface ReportMoreDetailView {
  button: string;
  blocks: ReportDetailBlock[];
}

export interface InAppReportView {
  /** The `h1`: "Sam: report", or "Your report" in the second voice. */
  title: string;
  state: LearnerReportState;
  glance: ReportGlanceView | null;
  /** Neutral lines for the empty and older-data states (no warning colour, no icon). */
  notices: string[];
  /** Hidden without day-by-day data. */
  tabs: ReportTabsView | null;
  /** Null on All time and without day-by-day data. */
  stepper: ReportStepperView | null;
  /** The polite announcement after a period change: "Showing this week". */
  announce: string | null;
  headline: { text: string; horizon: string | null } | null;
  /** Null when there is nothing to say: the section and its heading are not drawn. */
  wentWell: ReportSectionView | null;
  practiceNext: ReportSectionView | null;
  thisPeriod: ReportThisPeriodView | null;
  moreDetail: ReportMoreDetailView | null;
  /**
   * The stage the What to practice next section's Preview lessons row opens in All lessons (F-BROWSE-001
   * section 4.11 item 2, BR-12a): `journey.here` when this build can read it, else `stage1`.
   */
  previewStage: StageKey;
}

const firstStep = (period: ReportPeriod, m: Messages): string =>
  period === 'day' ? m.report.step.prevDay : period === 'week' ? m.report.step.prevWeek : m.report.step.prevMonth;

type ReportWindowOf = NonNullable<LearnerReport['window']>;

/** A window's dates (the stepper row; the name of an older window). */
function rangeOf(window: ReportWindowOf, w: ReportWords): string {
  if (window.period === 'day') return dayText(window.from, w.locale, w.today);
  if (window.period === 'month') return monthText(window.from, w.locale);
  return w.m.report.step.range(dayText(window.from, w.locale, w.today), dayText(window.to, w.locale, w.today));
}

/** A window's name in `a11y.report`: "this week", "last week", or its dates. */
function windowName(window: ReportWindowOf, w: ReportWords): string {
  const when = w.m.report.when;
  if (window.step === 'current') return when[window.period as Exclude<ReportPeriod, 'all'>];
  if (window.step === 'previous') return window.period === 'day' ? when.prevDay : window.period === 'week' ? when.prevWeek : when.prevMonth;
  return rangeOf(window, w);
}

function calendarView(report: LearnerReport, w: ReportWords): ReportCalendarView | null {
  const cells = report.calendar;
  if (cells === null || cells.length === 0) return null;
  const first = cells[0] as (typeof cells)[number];
  // Monday-first: Sunday (0) is the seventh column.
  const lead = report.period === 'month' ? (new Date(instantOf(first.day)).getUTCDay() + 6) % 7 : 0;
  const nameOf = (day: string): string => (report.period === 'week' ? weekdayLongText(day, w.locale) : dayText(day, w.locale, w.today));
  const practiced = cells.filter((cell) => cell.kind === 'practiced').map((cell) => nameOf(cell.day));
  const a11y = w.m.a11y.report;
  return {
    lead,
    cells: cells.map((cell) => ({
      day: cell.day,
      kind: cell.kind === 'practiced' ? 'practiced' : 'none',
      weekday: weekdayText(cell.day, w.locale),
      date: Number(cell.day.slice(8, 10)),
    })),
    // Practiced days only: the sentence never says a day was missed (design: in-app calendar).
    sentence: practiced.length ? a11y.calendar(w.m.report.list(practiced)) : a11y.calendarNone,
  };
}

function figuresView(report: LearnerReport, w: ReportWords): ReportFigureTile[] | null {
  const figures = report.figures;
  if (figures === null || report.headline?.code === 'none_saved') return null;
  const labels = w.m.report.figure;
  const up = labels.up(w.previous);
  const keys = ['days', 'minutes', 'quests', 'cards', 'letters'] as const;
  return keys.flatMap((key) => {
    const figure = figures[key];
    return figure === null ? [] : [{ key, label: labels[key], count: figure.count, up: figure.up ? up : null }];
  });
}

/** The all-time growth line (section 3.5 item 7); exported for its tests. */
export function growthView(report: LearnerReport, w: ReportWords): ReportGrowthView | null {
  const growth = report.growth;
  if (growth === null) return null;
  const g = w.m.report.growth;
  const days = report.figures?.days.count ?? 0;
  const rows = growth.months.map((row) => ({ ...row, label: monthText(`${row.m}-01`, w.locale) }));
  const last = rows[rows.length - 1];
  return {
    since: growth.since === null ? null : g.since(dayText(growth.since, w.locale, w.today), days),
    quests: g.quests,
    cards: g.cards,
    month: g.month,
    caption: w.m.a11y.report.growthTable,
    showTable: g.showTable,
    hideTable: g.hideTable,
    rows,
    max: Math.max(1, last?.quests ?? 0, last?.cards ?? 0, growth.baseline.quests, growth.baseline.cards),
  };
}

/** A learner-local day of an ISO instant (OD-12), or null for an unreadable one. */
function localDayOf(iso: string | undefined, summary: InsightSummary): string | null {
  const ms = Date.parse(iso ?? '');
  return Number.isFinite(ms) ? todayFor(new Date(ms), summary.activity?.tz ?? 0) : null;
}

function detailView(report: LearnerReport, summary: InsightSummary, w: ReportWords): ReportMoreDetailView | null {
  const detail = report.detail;
  if (detail === null) return null;
  const { m, input } = w;
  const d = m.report.detail;
  const blocks: ReportDetailBlock[] = [{ kind: 'totals', line: d.totals(detail.totals.quests, detail.totals.cards) }];
  const tiles = (list: readonly string[]): ReportLetterTile[] => list.map((letter) => ({ ...letterLabel(letter), detail: input.letterInfo(letter) }));
  const letters = (key: 'strong' | 'practising' | 'new', heading: string, list: readonly string[], more = 0): void => {
    if (list.length) blocks.push({ kind: 'letters', key, heading, tiles: tiles(list), more, moreLine: more > 0 ? d.lettersMore(more) : null });
  };
  letters('strong', w.voice === 'second' ? m.report.you.detail.lettersStrong : d.lettersStrong(w.name), detail.lettersStrong, detail.lettersStrongMore);
  letters('practising', d.lettersPractising, detail.lettersPractising);
  letters('new', d.lettersNew, detail.lettersNew ?? []);
  if (detail.milestones.length) {
    blocks.push({
      kind: 'lines',
      key: 'milestones',
      heading: d.milestones,
      lines: detail.milestones.map((row) => d.milestone(row.n, input.stageTitle(row.stage), dayText(row.on, w.locale, w.today))),
    });
  }
  if (detail.levelCheck !== null) {
    const statuses = m.report.strand.status;
    const checked = localDayOf(detail.levelCheck.takenAt, summary);
    const spot = detail.startingSpot;
    const band = spot ? bandWord(m, spot.stage, spot.band) : null;
    blocks.push({
      kind: 'lines',
      key: 'levelCheck',
      heading: d.levelCheck,
      lines: [
        // The roster's words for the starting spot (section 3.11: `console.placement.startingSpot`, the band label).
        ...(spot && band !== null && checked !== null ? [m.console.placement.startingSpot(spot.n, band, dayText(checked, w.locale, w.today))] : []),
        ...(checked === null ? [] : [d.levelCheckOn(dayText(checked, w.locale, w.today))]),
        ...detail.levelCheck.strands.map((row) => d.strand(strandName(row.strand, m), statuses[row.status])),
      ],
    });
  }
  const plan = detail.plan;
  if (plan !== null) {
    // The device reads every plan on it and its own route (section 3.5 item 10).
    const rows = d.planRow;
    blocks.push({
      kind: 'lines',
      key: 'plan',
      heading: d.plan,
      lines: [...(plan.plans ? [rows.device(plan.plans.done, plan.plans.ready)] : []), ...(plan.self ? [rows.self(plan.self.done, plan.self.ready)] : [])],
    });
  }
  return { button: m.report.section.moreDetail, blocks };
}

/**
 * The level-check band in the words the learner saw: `bandLabel`, the one the placement screens and the dashboard's
 * Starting spot row use (section 3.11), so the two never drift; null for a level this build cannot read.
 */
function bandWord(m: Messages, stage: StageKey, band: number): string | null {
  const level = PlacementLevelSchema.safeParse({ stage, band });
  return level.success ? bandLabel(m, level.data) : null;
}

/** "Now on" for the empty state: the journey's here stage, when this build can read it. */
function emptyStageOf(summary: InsightSummary): { stage: StageKey; n: number } | null {
  const parsed = StageKeySchema.safeParse(summary.journey?.here);
  return parsed.success ? { stage: parsed.data, n: StageKeySchema.options.indexOf(parsed.data) + 1 } : null;
}

function noticesOf(report: LearnerReport, w: ReportWords): string[] {
  const s = w.m.report.state;
  if (report.state === 'no_data') return [s.error];
  if (report.state === 'empty') return [w.voice === 'second' ? w.m.report.you.state.empty : s.empty(w.name)];
  // A build's own summary always carries `activity`; a legacy summary means the activity could not be built.
  return report.state === 'legacy' ? [s.legacy] : [];
}

/** The in-app learner report in words (section 3.9). */
export function inAppReportView(input: InAppReportInput): InAppReportView {
  const { summary, messages: m, now } = input;
  const make = (at: string | null): LearnerReport =>
    learnerReport({ summary, viewer: 'device', voice: input.voice, period: input.period, at, now, catalog: input.catalog, lastSyncedAt: null });
  const report = make(input.at);
  const clockOk = !Number.isNaN(now.getTime());
  // The learner-local today (section 3.2); an invalid clock reads the last saved day (the module's own rule).
  const today = clockOk ? todayFor(now, summary?.activity?.tz ?? 0) : (summary?.activity?.asOf ?? '');
  const w = reportWordsOf(report, input, today);
  const title = report.voice === 'second' ? m.report.you.title : m.report.title.learner(input.name);
  const ctx = { summary, report, catalog: input.catalog };

  const section = (heading: string, lines: InsightLine[]): ReportSectionView | null => {
    const views = lines.map((line) => insightView(line, w)).filter((line): line is ReportLineView => line !== null);
    return views.length ? { heading, lines: views } : null;
  };

  const glance = ((): ReportGlanceView | null => {
    if (summary === null) return null;
    const stage = report.glance?.nowOn ?? (report.state === 'empty' ? emptyStageOf(summary) : null);
    const last = report.glance ? localDayOf(summary.lastActiveAt, summary) : null;
    return {
      nowOn: stage ? m.report.glance.nowOn(stage.n, input.stageTitle(stage.stage)) : null,
      openRoute: input.learningRoute ? m.report.glance.openRoute : null,
      lastPractice: last === null ? null : m.report.glance.lastPractice(dayText(last, w.locale, today)),
    };
  })();

  const ready = report.state === 'ready' && report.window !== null;
  let stepper: ReportStepperView | null = null;
  if (ready && report.window !== null && report.period !== 'all') {
    const window = report.window;
    const button = (step: { at: string | null } | null, label: (target: ReportWindowOf) => string, nameOf: (name: string) => string): ReportStepButton | null => {
      if (step === null) return null;
      const target = make(step.at).window as ReportWindowOf;
      return { at: step.at, label: label(target), name: nameOf(windowName(target, w)) };
    };
    stepper = {
      range: rangeOf(window, w),
      prev: button(window.prev, (target) => (target.step === 'previous' ? firstStep(report.period, m) : rangeOf(target, w)), m.a11y.report.step),
      next: button(window.next, () => m.report.step.next, m.a11y.report.step),
    };
  }

  const headline = headlineText(report, w);
  return {
    title,
    state: report.state,
    glance,
    notices: noticesOf(report, w),
    tabs: ready ? { label: m.a11y.report.periods, items: REPORT_PERIODS.map((id) => ({ id, label: m.report.period[id] })), value: report.period } : null,
    stepper,
    announce: ready ? (report.period === 'all' ? m.a11y.report.periodChangedAll : m.a11y.report.periodChanged(windowName(report.window as ReportWindowOf, w))) : null,
    headline:
      headline === null
        ? null
        : { text: headline, horizon: report.horizon?.partial && report.headline?.code !== 'none_saved' ? m.report.horizon(dayText(report.horizon.asOf, w.locale, today)) : null },
    wentWell: section(m.report.section.wentWell, wentWell(ctx)),
    practiceNext: section(m.report.section.practiceNext, practiceNext(ctx)),
    thisPeriod: ready ? { heading: m.report.section.thisPeriod, figures: figuresView(report, w), calendar: calendarView(report, w), growth: growthView(report, w) } : null,
    moreDetail: summary === null ? null : detailView(report, summary, w),
    previewStage: (summary === null ? null : emptyStageOf(summary))?.stage ?? 'stage1',
  };
}
