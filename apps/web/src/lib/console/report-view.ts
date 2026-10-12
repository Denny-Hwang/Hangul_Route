import {
  CATALOG,
  INITIAL_JAMO,
  INITIAL_RR,
  MEDIAL_RR,
  REPORT_PERIODS,
  StageKeySchema,
  isDateKey,
  learnerReport,
  practiceNext,
  reportPeriodOf,
  todayFor,
  wentWell,
  type Catalog,
  type InsightCode,
  type InsightLine,
  type LearnerReport,
  type LearnerReportResponse,
  type LearnerReportState,
  type PlacementStrand,
  type ReportCalendarKind,
  type ReportPeriod,
  type ReportSummary,
  type ReportVoice,
  type SpaceKind,
  type SpaceRole,
  type StageKey,
} from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ApiResult } from './api';
import { startingSpotLine } from './placement';
import { ROUTES, spaceIdFrom, type ReportFrom } from './routing';
import { consoleWord } from './vocab-words';

/**
 * The console's learner report in words — F-REPORT-001 RP-7a1 (sections 3.1, 3.5, 3.6, 3.11, 3.12 and 3.14; design
 * `design/screens/reports/learner-report.md`). The report module (`packages/content-schema/src/reports/`) returns codes
 * and numbers; this module turns them into the sentences, labels and links the page (RP-7a2) draws, from `report.*`,
 * `a11y.report.*` and the few console and caregiver keys the design names. Pure: the clock, the catalogue and the
 * content titles (stages, the strand-tip games) come in as arguments.
 *
 * - **Taught Korean stays out of the messages.** A sentence is a list of parts: text, letters (with the short sound
 *   value, `report.letter`), words (romanization and gloss) and quests (a catalogue title), so the page marks Korean
 *   `lang="ko"` and RP-13 can turn a letter or a quest into a Browse link without touching the words around it.
 * - **Voices** (OD-17): the third person for grown-ups; the second person when the report's voice is `second` (the
 *   learner app on a self-only device, RP-9, which reads the same rules).
 * - **Anti-shame** (CLAUDE.md section 1): one learner only, never a class figure, an average or a position; "more than"
 *   only when a figure grew; no percentage; no word about speaking; empty sections have no heading.
 * - **Ids only in URLs**: every link is built by `ROUTES`; a learner's name never reaches one.
 */

// ---------------------------------------------------------------------------------------------
// Parts of a sentence

/** A taught letter as two parts (design: the tile's name is its visible content, never one `aria-label` string). */
export interface ReportLetter {
  letter: string;
  /** The short sound value ("b" for ㅂ); null for a symbol this build cannot read, which then shows alone. */
  romanization: string | null;
}

/**
 * A part of a sentence. `letter`: `before` + the letter (`lang="ko"`) + `after` reads `report.letter` ("ㅂ (b)").
 * `word`: the Hangul (null for an id this build does not know), then `console.space.wordGloss`. `quest`: a catalogue
 * title (a Browse link from RP-13).
 */
export type ReportPart =
  | { kind: 'text'; text: string }
  | ({ kind: 'letter'; before: string; after: string } & ReportLetter)
  | { kind: 'word'; id: string; ko: string | null; romanization: string; gloss: string | null }
  | { kind: 'quest'; id: string; title: string };

/** One sentence: its parts in order, and the same words as plain text (print, tests, live regions). */
export interface ReportSentence {
  text: string;
  parts: ReportPart[];
}

/** The letters that open the vowel block of Hangul compatibility jamo (ㅏ), in `MEDIAL_RR` order. */
const FIRST_VOWEL = 0x314f;
/** ㅇ is silent at the start of a block: its one heard sound is the final "ng" (the learner app's `silent/ng`). */
const IEUNG = 'ㅇ';

/** A taught letter with its short sound value (design notes for RP-7a1: "ㅂ (b)"); null romanization when unknown. */
export function letterLabel(letter: string): ReportLetter {
  if (letter === IEUNG) return { letter, romanization: 'ng' };
  const initial = INITIAL_JAMO.indexOf(letter);
  if (initial >= 0) return { letter, romanization: INITIAL_RR[initial] ?? null };
  const vowel = letter.length === 1 ? MEDIAL_RR[letter.charCodeAt(0) - FIRST_VOWEL] : undefined;
  return { letter, romanization: vowel ?? null };
}

/** Sentinels around a part's index inside a rendered message; never in a message or a name. */
const OPEN = '\u0000';
const CLOSE = '\u0001';
const PART_RE = /\u0000(\d+)\u0001/g;
const STRAY_RE = /[\u0000\u0001]/g;

type Placed = Exclude<ReportPart, { kind: 'text' }>;

const plainOf = (part: ReportPart, m: Messages): string => {
  if (part.kind === 'text') return part.text;
  if (part.kind === 'letter') return `${part.before}${part.letter}${part.after}`;
  if (part.kind === 'quest') return part.title;
  const tail = part.gloss === null ? part.romanization : m.console.space.wordGloss(part.romanization, part.gloss);
  return part.ko === null ? tail : `${part.ko} ${tail}`;
};

/**
 * A message rendered with its taught parts held apart: `render` gets `put`, which returns a placeholder for a part.
 * Each part is used once, in order, as the messages promise (`report.list`); a repeat is dropped, never drawn twice.
 */
function sentence(m: Messages, render: (put: (part: Placed) => string) => string): ReportSentence {
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
    last = (match.index ?? 0) + match[0].length;
  }
  text(raw.slice(last));
  return { text: parts.map((part) => plainOf(part, m)).join(''), parts };
}

/** A sentence with no taught part. */
const plainSentence = (text: string): ReportSentence => ({ text, parts: [{ kind: 'text', text }] });

function letterPart(letter: string, m: Messages): Placed {
  const label = letterLabel(letter);
  if (label.romanization === null) return { kind: 'letter', ...label, before: '', after: '' };
  const romanization = label.romanization;
  const text = m.report.letter(OPEN, romanization);
  const at = text.indexOf(OPEN);
  return { kind: 'letter', ...label, before: text.slice(0, at), after: text.slice(at + OPEN.length) };
}

// ---------------------------------------------------------------------------------------------
// Words of one report

type Messages = ReturnType<typeof getMessages>;

/** The minigame title each strand tip names (`report.tip`, `{game}`): content from the minigame catalogue. */
export type ReportTipGames = Partial<Record<Extract<PlacementStrand, 'hangul-recognition' | 'sound-letter'>, string>>;

/** What every sentence of one report reads. */
export interface ReportWords {
  name: string;
  voice: ReportVoice;
  period: ReportPeriod;
  locale: UiLocale;
  /** The window inside a sentence: "this week", "last week", "in the week to Oct 8", "so far". */
  when: string;
  /** The window a figure grew against: "last week", "the week before", "all of last month". */
  previous: string;
  /** The learner-local today: a date in another year shows its year. */
  today: string;
  stageTitle: (stage: StageKey) => string;
  tipGames: ReportTipGames;
  catalog: Catalog;
  m: Messages;
}

export interface ReportWordsOptions {
  /** The roster's name (initials when the class anonymizes). */
  name: string;
  /** A stage's title, which is content (F-I18N-001 section 3.6): "Hangul", "Words". */
  stageTitle: (stage: StageKey) => string;
  tipGames?: ReportTipGames;
  catalog?: Catalog;
  locale?: UiLocale;
}

const DAY_KEY_TIME = 'T00:00:00.000Z';
const monthOfDay = (day: string): string => day.slice(0, 7);

/** A learner-local day key as "Oct 12" (with the year when it is not `today`'s year), never shifted by the browser's zone. */
function dayText(day: string, w: Pick<ReportWords, 'locale' | 'today'>): string {
  return formatDate(w.locale, `${day}${DAY_KEY_TIME}`, day.slice(0, 4) === w.today.slice(0, 4) ? 'monthDay' : 'monthDayYear', { utc: true });
}

/** The month of a day key as "October 2026". */
const monthText = (day: string, locale: UiLocale): string => formatDate(locale, `${monthOfDay(day)}-01${DAY_KEY_TIME}`, 'monthYear', { utc: true });

/** The weekday of a day key ("Mon"). */
const weekdayText = (day: string, locale: UiLocale): string => formatDate(locale, `${day}${DAY_KEY_TIME}`, 'weekday', { utc: true });

/** The learner-local today the report reads (its own clock rule: an invalid clock reads as the last saved day). */
function todayOf(report: LearnerReport, summary: ReportSummary | null, now: Date | null): string {
  const activity = summary?.activity;
  if (now !== null && !Number.isNaN(now.getTime())) return todayFor(now, activity?.tz ?? 0);
  return activity?.asOf ?? report.window?.to ?? '';
}

/** The window inside a sentence (`report.when`). */
function whenOf(report: LearnerReport, w: Pick<ReportWords, 'locale' | 'today' | 'm'>): string {
  const when = w.m.report.when;
  const window = report.window;
  if (report.period === 'all') return when.all;
  if (window === null || window.step === 'current') return when[report.period];
  if (window.step === 'previous') return report.period === 'day' ? when.prevDay : report.period === 'week' ? when.prevWeek : when.prevMonth;
  if (report.period === 'day') return when.onDay(dayText(window.from, w));
  if (report.period === 'week') return when.weekTo(dayText(window.to, w));
  return when.inMonth(monthText(window.from, w.locale));
}

/** The words every sentence of `report` reads. */
export function reportWordsOf(report: LearnerReport, opts: ReportWordsOptions & { summary?: ReportSummary | null; now?: Date | null }): ReportWords {
  const locale = opts.locale ?? DEFAULT_LOCALE;
  const m = getMessages(locale);
  const today = todayOf(report, opts.summary ?? null, opts.now ?? null) || (report.window?.to ?? '');
  const base = { locale, today, m };
  const past = report.window !== null && report.window.step !== 'current';
  const previous = report.period === 'month' ? (past ? m.report.previous.monthBefore : m.report.previous.month) : past ? m.report.previous.weekBefore : m.report.previous.week;
  return {
    name: opts.name,
    voice: report.voice,
    period: report.period,
    locale,
    when: whenOf(report, base),
    previous,
    today,
    stageTitle: opts.stageTitle,
    tipGames: opts.tipGames ?? {},
    catalog: opts.catalog ?? CATALOG,
    m,
  };
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
      const title = w.stageTitle(stage.stage);
      if (all) return you ? you.stageDoneAll(stage.n, title) : h.stageDoneAll(name, stage.n, title);
      return you ? you.stageDone(stage.n, title, w.when) : h.stageDone(name, stage.n, title, w.when);
    }
    case 'practiced':
      if (report.period === 'day') return you ? you.practicedOn(w.when) : h.practicedOn(name, w.when);
      return you ? you.practiced(headline.days, w.when) : h.practiced(name, headline.days, w.when);
    case 'none_saved': {
      if (!past) return you ? you.noneSaved(w.when) : h.noneSaved(name, w.when);
      const asOf = dayText(report.horizon?.asOf ?? w.today, w);
      return you ? you.noneSavedAfter(asOf) : h.noneSavedAfter(name, asOf);
    }
    case 'none_yet':
      return all ? h.noneEver : past ? h.noneThen(w.when) : h.noneYet(w.when);
    default:
      return you ? you.gettingStarted : h.gettingStarted(name);
  }
}

/** One "went well" or "practice next" line in words. */
export interface ReportLineView {
  code: InsightCode;
  sentence: ReportSentence;
  /** The strand tip under P2 (`report.tip`), else null. */
  tip: ReportSentence | null;
  /** **Add to a plan** or **Open the plan**, for a console viewer with `plan.write` on a space that is not archived. */
  action: ReportLink | null;
}

const strandName = (strand: PlacementStrand, m: Messages): string => m.caregiver.placementReport.strand[strand];

function tipOf(strand: PlacementStrand, w: ReportWords): ReportSentence | null {
  const { m } = w;
  if (strand === 'hangul-recognition' || strand === 'sound-letter') {
    const game = w.tipGames[strand];
    return game ? plainSentence(m.report.tip[strand](game)) : null;
  }
  if (w.voice === 'second' && (strand === 'syllable-reading' || strand === 'sentences')) return plainSentence(m.report.you.tip[strand]);
  return plainSentence(m.report.tip[strand]);
}

const questTitleOf = (id: string, catalog: Catalog): string | null => catalog.quests.find((quest) => quest.id === id)?.title ?? null;

/**
 * The sentence of one insight line (section 3.6), in the report's voice; null for a line this build cannot word (a
 * quest its catalogue does not hold). Actions are added by the page view, which knows the space and the viewer's role.
 */
export function insightView(line: InsightLine, w: ReportWords): Omit<ReportLineView, 'action'> | null {
  const { m, name } = w;
  const i = m.report.insight;
  const you = w.voice === 'second' ? m.report.you.insight : null;
  const day = w.period === 'day';
  const letters = (put: (part: Placed) => string, list: readonly string[]): string => m.report.list(list.map((letter) => put(letterPart(letter, m))));
  const plain = (text: string) => ({ code: line.code, sentence: plainSentence(text), tip: null });
  switch (line.code) {
    case 'showed_up':
      if (day) return plain(you ? you.practice_day : i.practice_day(name));
      return plain(you ? you.showed_up(line.params.days, w.when) : i.showed_up(name, line.params.days, w.when));
    case 'stage_done': {
      const { stage, n } = line.params.stage;
      return plain(you ? you.stage_done(n, w.stageTitle(stage)) : i.stage_done(name, n, w.stageTitle(stage)));
    }
    case 'letters_new':
      return {
        code: line.code,
        sentence: sentence(m, (put) => (you ? you.letters_new(letters(put, line.params.letters)) : i.letters_new(name, letters(put, line.params.letters)))),
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
    case 'words_new':
      return plain(i.words_new(line.params.count));
    case 'rhythm':
      return plain(i.rhythm);
    case 'letters_revisit':
      return { code: line.code, sentence: sentence(m, (put) => i.letters_revisit(letters(put, line.params.letters))), tip: null };
    case 'strand_next':
      return { code: line.code, sentence: plainSentence(i.strand_next(strandName(line.params.strand, m))), tip: tipOf(line.params.strand, w) };
    case 'plan_open':
      return plain(i.plan_open[line.params.kind](line.params.count));
    case 'next_in_plan':
    case 'next_on_route': {
      const id = line.params.questId;
      const title = questTitleOf(id, w.catalog);
      if (title === null) return null;
      const message = line.code === 'next_in_plan' ? i.next_in_plan : i.next_on_route;
      return { code: line.code, sentence: sentence(m, (put) => message(put({ kind: 'quest', id, title }))), tip: null };
    }
    case 'free_days_done':
      return plain(you ? you.free_days_done : i.free_days_done(name));
    default: {
      const words = (put: (part: Placed) => string): string =>
        m.report.list(line.params.words.map((id) => put({ kind: 'word', ...consoleWord(id, w.locale) })));
      return { code: line.code, sentence: sentence(m, (put) => (you ? you.words_revisit(words(put)) : i.words_revisit(words(put)))), tip: null };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Links

export interface ReportLink {
  href: string;
  text: string;
}

/** The parent home (F-APP-001 section 3.8): where `from=home` returns. Only RP-7c's parent home card sends it. */
const PARENT_HOME = '/parent';

/** The space a report belongs to, as the back link reads it. */
export interface ReportSpaceRef {
  id: string;
  kind: SpaceKind;
  name: string;
}

/**
 * The back link (section 3.1): `from=home` to the parent home; `from=roster` to the space's roster; `from=nav` or none
 * to the persona home, which is the space's roster until RP-7c (F-APP-001 A-5b) gives a family its parent home; the
 * console home when the space is not known (a failed load).
 */
export function reportBackLink(from: ReportFrom | null, space: ReportSpaceRef | null, locale: UiLocale = DEFAULT_LOCALE): ReportLink {
  const back = getMessages(locale).report.back;
  if (from === 'home') return { href: PARENT_HOME, text: back.home };
  if (space === null) return { href: ROUTES.home, text: back.home };
  return { href: ROUTES.space(space.id), text: back.space(space.name) };
}

/** The page address of a report (`ROUTES.learnerReport`), read leniently: anything unknown reads as the default. */
export interface ReportQuery {
  spaceId: string;
  learnerId: string;
  period: ReportPeriod;
  at: string | null;
  from: ReportFrom | null;
}

const FROM_CODES: readonly ReportFrom[] = ['home', 'roster', 'nav'];

export function reportQueryOf(params: { get(name: string): string | null } | null): ReportQuery {
  const at = params?.get('at') ?? null;
  const from = params?.get('from') ?? null;
  return {
    spaceId: spaceIdFrom(params),
    learnerId: params?.get('learner')?.trim() ?? '',
    period: reportPeriodOf(params?.get('period')),
    at: at !== null && isDateKey(at) ? at : null,
    from: FROM_CODES.find((code) => code === from) ?? null,
  };
}

/** What a failed load shows (section 3.14): the sign-in, "not available" (no retry), or the error with Try again. */
export interface ReportLoadProblem {
  kind: 'signedOut' | 'unavailable' | 'error';
  message: string | null;
  retry: string | null;
}

/** A Worker answer that means "this report is not yours to open": an outsider, not a member, a school or wrong kind. */
const UNAVAILABLE_STATUSES: readonly number[] = [403, 404, 409];

export function reportLoadProblem(result: Extract<ApiResult<unknown>, { ok: false }>, locale: UiLocale = DEFAULT_LOCALE): ReportLoadProblem {
  const m = getMessages(locale);
  if (result.error === 'unauthorized') return { kind: 'signedOut', message: null, retry: null };
  if (UNAVAILABLE_STATUSES.includes(result.status)) return { kind: 'unavailable', message: m.report.state.unavailable, retry: null };
  return { kind: 'error', message: m.report.state.error, retry: m.common.buttons.tryAgain };
}

// ---------------------------------------------------------------------------------------------
// The page view

export interface ReportTab {
  period: ReportPeriod;
  label: string;
  selected: boolean;
  href: string;
}

export interface ReportStepButton {
  href: string;
  /** "Last week" for the first step back, else the dates of the window it opens; "Next" forward. */
  label: string;
  /** `a11y.report.step`: "Show last week", "Show Sep 25 to Oct 1". */
  name: string;
}

export interface ReportStepper {
  /** The window's dates between the buttons: a week's range, a month, a day. */
  range: string;
  /** Absent on the oldest window the stepper allows. */
  prev: ReportStepButton | null;
  /** Absent on the current window. */
  next: ReportStepButton | null;
}

export interface ReportGlance {
  /** "Now on Stage 1: Hangul"; null without a readable stage. */
  nowOn: string | null;
  /** "Last practice: Oct 12"; null when there is none (the empty state). */
  lastPractice: string | null;
  /** **Open Learning Route**, only when that page exists on this build. */
  route: ReportLink | null;
  /** The region's label (`console.learningRoute.section`). */
  region: string;
}

export interface ReportSection {
  heading: string;
  lines: ReportLineView[];
}

export interface ReportFigureTile {
  key: 'days' | 'minutes' | 'quests' | 'cards' | 'letters' | 'words';
  label: string;
  count: number;
  /** "More than last week", only when the figure grew (OD-11). */
  up: string | null;
}

export interface ReportCalendarCellView {
  day: string;
  kind: ReportCalendarKind;
  minutes: number;
  /** The short weekday ("Mon"), in the console locale. */
  weekday: string;
  /** The day of the month. */
  date: number;
}

export interface ReportCalendarView {
  /** Blank cells before the first one in a Monday-first grid (a month; 0 for a week, which is a row). */
  lead: number;
  cells: ReportCalendarCellView[];
  /** The visible sentence under the calendar: the practiced days, or "No practice days in this period." */
  practiced: string;
  /** "Not saved yet: Sat and Sun.", or null. */
  notSaved: string | null;
}

export interface ReportGrowthView {
  /** "Since Sep 5: 11 practice days"; null for a class (the first practice day may lie before the learner joined). */
  since: string | null;
  quests: string;
  cards: string;
  month: string;
  caption: string;
  showTable: string;
  hideTable: string;
  baseline: { quests: number; cards: number };
  /** Cumulative counts: they only rise (OD-10). */
  rows: { m: string; label: string; quests: number; cards: number }[];
}

export interface ReportThisPeriod {
  heading: string;
  /** Null when the whole window is after the last save: zeros would read as "did not practice". */
  figures: ReportFigureTile[] | null;
  calendar: ReportCalendarView | null;
  growth: ReportGrowthView | null;
}

/** A More detail block under its `h3`: letter tiles, or lines. */
export type ReportDetailBlock =
  /** "Since the start: 6 quests, 5 cards": leads the panel with no heading of its own (design pass #444). */
  | { kind: 'totals'; line: string }
  | { kind: 'letters'; heading: string; letters: ReportLetter[]; more: number }
  | { kind: 'lines'; heading: string; lines: string[] };

export interface ReportMoreDetail {
  button: string;
  blocks: ReportDetailBlock[];
}

export interface LearnerReportView {
  /** `document.title`: never the learner's name (section 3.10). */
  documentTitle: string;
  /** The `h1`: "{name}: report". */
  title: string;
  back: ReportLink;
  state: LearnerReportState;
  /**
   * An archived space (read-only: no line actions): the settings sentence `console.settings.archived.<kind>` for a
   * viewer who can unarchive it (`space.manage`), the neutral `report.state.archived.<kind>` for everyone else.
   */
  archived: string | null;
  glance: ReportGlance | null;
  /** One neutral block (stale, legacy, no_data, empty): no warning colour, no icon. */
  notices: string[];
  /** The tablist's label (`a11y.report.periods`). */
  tabsLabel: string;
  /** Hidden without day-by-day data (legacy, empty, no_data). */
  tabs: ReportTab[] | null;
  /** Null on All time and without day-by-day data. */
  stepper: ReportStepper | null;
  /** The polite live region after a period change: "Showing this week". */
  announce: string | null;
  headline: { text: string; horizon: string | null } | null;
  /** Null when there is nothing to say: the section and its heading are not drawn. */
  wentWell: ReportSection | null;
  practiceNext: ReportSection | null;
  thisPeriod: ReportThisPeriod | null;
  moreDetail: ReportMoreDetail | null;
}

export interface LearnerReportViewInput {
  /** `getLearnerReport`'s body. */
  data: LearnerReportResponse;
  query: Pick<ReportQuery, 'period' | 'at' | 'from'>;
  /** The viewer's clock: today for the learner is computed from it and the learner's offset (section 3.2). */
  now: Date;
  /**
   * The viewer's role in this space, from `listSpaces()` (the report body carries no viewer field); null when the
   * account's spaces do not list it (a school admin reading through the school). See `reportViewerRights`.
   */
  role: SpaceRole | null;
  stageTitle: (stage: StageKey) => string;
  /** The game titles of the strand tips; a tip whose game is not given is left out. */
  tipGames?: ReportTipGames;
  /** The Learning Route stage list exists on this build (LR-8): the glance links to it. */
  learningRoute?: boolean;
  catalog?: Catalog;
  locale?: UiLocale;
}

/** What the viewer may do on a report page, by its role in the space (`can.ts`). */
export interface ReportViewerRights {
  /** `space.manage`: the owner, who can unarchive the space (and reads the settings sentence when it is archived). */
  manage: boolean;
  /** `plan.write`: **Add to a plan** and **Open the plan**. */
  planWrite: boolean;
}

/**
 * The viewer's rights from its `listSpaces()` role (design pass #444, the `can.ts` rule): `owner` -> both; a class
 * `teacher` or a family `caregiver` -> `plan.write`; anyone else, or a viewer whose spaces do not list the space (a
 * school admin reading through the school) -> neither.
 */
export function reportViewerRights(role: SpaceRole | null): ReportViewerRights {
  if (role === 'owner') return { manage: true, planWrite: true };
  return { manage: false, planWrite: role === 'teacher' || role === 'caregiver' };
}

/** A space kind with a learner report: a school has none (its admin opens the class's). */
const viewerOf = (kind: SpaceKind): 'family' | 'class' | null => (kind === 'family' || kind === 'class' ? kind : null);

const firstStep = (period: ReportPeriod, m: Messages): string =>
  period === 'day' ? m.report.step.prevDay : period === 'week' ? m.report.step.prevWeek : m.report.step.prevMonth;

/** A window's dates (the stepper row; the name of an older window). */
function rangeOf(window: NonNullable<LearnerReport['window']>, w: ReportWords): string {
  if (window.period === 'day') return dayText(window.from, w);
  if (window.period === 'month') return monthText(window.from, w.locale);
  return w.m.report.step.range(dayText(window.from, w), dayText(window.to, w));
}

/** A window's name in `a11y.report`: "this week", "last week", or its dates. */
function windowName(window: NonNullable<LearnerReport['window']>, w: ReportWords): string {
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
  const lead = report.period === 'month' ? (new Date(`${first.day}${DAY_KEY_TIME}`).getUTCDay() + 6) % 7 : 0;
  const nameOf = (day: string): string => (report.period === 'week' ? weekdayText(day, w.locale) : dayText(day, w));
  const practiced = cells.filter((cell) => cell.kind === 'practiced').map((cell) => nameOf(cell.day));
  const unsaved = cells.filter((cell) => cell.kind === 'not_saved').map((cell) => nameOf(cell.day));
  const a11y = w.m.a11y.report;
  return {
    lead,
    cells: cells.map((cell) => ({ ...cell, weekday: weekdayText(cell.day, w.locale), date: Number(cell.day.slice(8, 10)) })),
    practiced: practiced.length ? a11y.calendar(w.m.report.list(practiced)) : a11y.calendarNone,
    notSaved: unsaved.length ? a11y.notSaved(w.m.report.list(unsaved)) : null,
  };
}

function figuresView(report: LearnerReport, w: ReportWords): ReportFigureTile[] | null {
  const figures = report.figures;
  if (figures === null || report.headline?.code === 'none_saved') return null;
  const labels = w.m.report.figure;
  const up = w.m.report.figure.up(w.previous);
  const keys = ['days', 'minutes', 'quests', 'cards', 'letters', 'words'] as const;
  return keys.flatMap((key) => {
    const figure = figures[key];
    return figure === null ? [] : [{ key, label: labels[key], count: figure.count, up: figure.up ? up : null }];
  });
}

function growthView(report: LearnerReport, w: ReportWords): ReportGrowthView | null {
  const growth = report.growth;
  if (growth === null) return null;
  const g = w.m.report.growth;
  const days = report.figures?.days.count ?? 0;
  return {
    since: growth.since === null ? null : g.since(dayText(growth.since, w), days),
    quests: g.quests,
    cards: g.cards,
    month: g.month,
    caption: w.m.a11y.report.growthTable,
    showTable: g.showTable,
    hideTable: g.hideTable,
    baseline: growth.baseline,
    rows: growth.months.map((row) => ({ ...row, label: monthText(`${row.m}-01`, w.locale) })),
  };
}

function detailView(report: LearnerReport, summary: ReportSummary, w: ReportWords): ReportMoreDetail | null {
  const detail = report.detail;
  if (detail === null) return null;
  const { m } = w;
  const d = m.report.detail;
  const blocks: ReportDetailBlock[] = [{ kind: 'totals', line: d.totals(detail.totals.quests, detail.totals.cards) }];
  const letters = (heading: string, list: readonly string[], more = 0): void => {
    if (list.length) blocks.push({ kind: 'letters', heading, letters: list.map(letterLabel), more });
  };
  letters(d.lettersStrong(w.name), detail.lettersStrong, detail.lettersStrongMore);
  letters(d.lettersPractising, detail.lettersPractising);
  letters(d.lettersNew, detail.lettersNew ?? []);
  // The Milestones `h3` shows only over a milestone (every one on All time); the totals never sit under it.
  if (detail.milestones.length) {
    blocks.push({ kind: 'lines', heading: d.milestones, lines: detail.milestones.map((row) => d.milestone(row.n, w.stageTitle(row.stage), dayText(row.on, w))) });
  }
  if (detail.levelCheck !== null) {
    const spot = startingSpotLine(summary, w.locale);
    const statuses = m.report.strand.status;
    blocks.push({
      kind: 'lines',
      heading: d.levelCheck,
      lines: [
        ...(spot === null ? [] : [spot]),
        d.levelCheckOn(formatDate(w.locale, detail.levelCheck.takenAt, 'monthDay')),
        ...detail.levelCheck.strands.map((row) => d.strand(strandName(row.strand, m), statuses[row.status])),
      ],
    });
  }
  const plan = detail.plan;
  if (plan !== null) {
    const rows = d.planRow;
    // A class reads "Homework", a family "This week's plan" (and its own route), the device both kinds of plan.
    const own = rows[plan.kind];
    blocks.push({
      kind: 'lines',
      heading: d.plan,
      lines: [...(plan.plans ? [own(plan.plans.done, plan.plans.ready)] : []), ...(plan.self ? [rows.self(plan.self.done, plan.self.ready)] : [])],
    });
  }
  return { button: m.report.section.moreDetail, blocks };
}

/** "Last practice: Oct 12": the learner-local day of `lastActiveAt` (UTC without day-by-day data). */
function lastPracticeOf(summary: ReportSummary, w: ReportWords): string | null {
  const ms = Date.parse(summary.lastActiveAt ?? '');
  if (!Number.isFinite(ms)) return null;
  return w.m.report.glance.lastPractice(dayText(todayFor(new Date(ms), summary.activity?.tz ?? 0), w));
}

function noticesOf(report: LearnerReport, w: ReportWords): string[] {
  const s = w.m.report.state;
  if (report.state === 'no_data') return [s.noData(w.name), s.noDataAction];
  if (report.state === 'empty') return [s.empty(w.name)];
  const lines = [...(report.stale ? [s.stale(dayText(report.stale.lastSaved, w))] : []), ...(report.state === 'legacy' ? [s.legacy] : [])];
  return lines.length ? [...lines, s.updateAction(w.name)] : [];
}

/** The learner report page in words (section 3.5), or null for a space kind with no learner report (a school). */
export function learnerReportView(input: LearnerReportViewInput): LearnerReportView | null {
  const { data, query, now } = input;
  const viewer = viewerOf(data.space.kind);
  if (viewer === null) return null;
  const catalog = input.catalog ?? CATALOG;
  const locale = input.locale ?? DEFAULT_LOCALE;
  const m = getMessages(locale);
  const summary = data.summary;
  const name = data.learner.displayName;
  const make = (at: string | null): LearnerReport =>
    learnerReport({ summary, viewer, voice: 'third', period: query.period, at, now, catalog, lastSyncedAt: data.lastSyncedAt });
  const report = make(query.at);
  const w = reportWordsOf(report, { name, stageTitle: input.stageTitle, tipGames: input.tipGames, catalog, locale, summary, now });
  const space = { id: data.space.id, kind: data.space.kind, name: data.space.name };
  const archived = data.space.archivedAt !== null;
  const rights = reportViewerRights(input.role);
  const href = (period: ReportPeriod, at: string | null): string =>
    ROUTES.learnerReport({ spaceId: space.id, learnerId: data.learner.id, kind: space.kind, period, at, from: query.from });

  const lineView = (line: InsightLine): ReportLineView | null => {
    const out = insightView(line, w);
    if (out === null) return null;
    const links = 'links' in line ? line.links : undefined;
    let action: ReportLink | null = null;
    if (rights.planWrite && !archived && links) {
      if ('addToPlan' in links) action = { href: `${ROUTES.spacePlan(space.id)}&add=${encodeURIComponent(links.addToPlan)}`, text: m.report.action.addToPlan };
      else action = { href: ROUTES.spacePlan(space.id, links.openPlan), text: m.report.action.openPlan };
    }
    return { ...out, action };
  };
  const section = (heading: string, lines: InsightLine[]): ReportSection | null => {
    const views = lines.map(lineView).filter((line): line is ReportLineView => line !== null);
    return views.length ? { heading, lines: views } : null;
  };
  const ctx = { summary, report, catalog };

  const ready = report.state === 'ready' && report.window !== null;
  const glanceOf = (): ReportGlance | null => {
    if (summary === null) return null;
    const route = input.learningRoute ? { href: ROUTES.learnerRoute(space.id, data.learner.id), text: m.console.learningRoute.open } : null;
    // The empty state shows "Now on" without "Last practice" (design: states); the module has no glance for it.
    const stage = report.glance?.nowOn ?? (report.state === 'empty' ? emptyStageOf(summary) : null);
    return {
      nowOn: stage ? m.report.glance.nowOn(stage.n, input.stageTitle(stage.stage)) : null,
      lastPractice: report.glance ? lastPracticeOf(summary, w) : null,
      route,
      region: m.console.learningRoute.section,
    };
  };

  let stepper: ReportStepper | null = null;
  if (ready && report.window !== null && report.period !== 'all') {
    const window = report.window;
    const button = (step: { at: string | null } | null, label: (target: NonNullable<LearnerReport['window']>) => string): ReportStepButton | null => {
      if (step === null) return null;
      const target = make(step.at).window as NonNullable<LearnerReport['window']>;
      return { href: href(report.period, step.at), label: label(target), name: m.a11y.report.step(windowName(target, w)) };
    };
    stepper = {
      range: rangeOf(window, w),
      prev: button(window.prev, (target) => (target.step === 'previous' ? firstStep(report.period, m) : rangeOf(target, w))),
      next: button(window.next, () => m.report.step.next),
    };
  }

  const headline = headlineText(report, w);
  return {
    documentTitle: m.report.documentTitle,
    title: m.report.title.learner(name),
    back: reportBackLink(query.from, space, locale),
    state: report.state,
    archived: archived ? (rights.manage ? m.console.settings.archived[space.kind] : m.report.state.archived[viewer]) : null,
    glance: glanceOf(),
    notices: noticesOf(report, w),
    tabsLabel: m.a11y.report.periods,
    tabs: ready ? REPORT_PERIODS.map((period) => ({ period, label: m.report.period[period], selected: period === report.period, href: href(period, null) })) : null,
    stepper,
    announce: ready ? (report.period === 'all' ? m.a11y.report.periodChangedAll : m.a11y.report.periodChanged(windowName(report.window as NonNullable<LearnerReport['window']>, w))) : null,
    headline: headline === null ? null : { text: headline, horizon: report.horizon?.partial ? m.report.horizon(dayText(report.horizon.asOf, w)) : null },
    wentWell: section(m.report.section.wentWell, wentWell(ctx)),
    practiceNext: section(m.report.section.practiceNext, practiceNext(ctx)),
    thisPeriod: ready
      ? { heading: m.report.section.thisPeriod, figures: figuresView(report, w), calendar: calendarView(report, w), growth: growthView(report, w) }
      : null,
    moreDetail: summary === null ? null : detailView(report, summary, w),
  };
}

/** "Now on" for the empty state: the journey's here stage, when this build can read it. */
function emptyStageOf(summary: ReportSummary): { stage: StageKey; n: number } | null {
  const parsed = StageKeySchema.safeParse(summary.journey?.here);
  return parsed.success ? { stage: parsed.data, n: StageKeySchema.options.indexOf(parsed.data) + 1 } : null;
}
