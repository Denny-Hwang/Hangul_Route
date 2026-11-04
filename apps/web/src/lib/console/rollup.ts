import { CATALOG, FAMILY_LIFETIME_LEARNERS, FREE_CLASS_STUDENT_CAP, teachingOrder } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, describeRelativeDay, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { RosterLearner, RosterSeats, RosterSummary } from './api';
import { joinOrder } from './parent-home';
import { parseVocabSummary } from './vocab-summary';

/**
 * Class roll-up from summaries — F-CONSOLE-001 §3.5 (F-TCH-001 §3.2 rules:
 * no ranking, no per-student percentiles, no schedule-pressure words).
 */
export const NOT_SYNCED_AFTER_DAYS = 7;
export const CAP_WARNING_RATIO = 0.8;
const DAY_MS = 86_400_000;

export interface ClassRollup {
  students: number;
  practicedThisWeek: number;
  /** Mean Stage 1 anchor accuracy across learners that have one; null when nobody does. */
  anchorAccuracy: number | null;
  /** Jamo most often flagged for practice, up to three. */
  revisit: string[];
  /**
   * Word ids (`vocab:*`) most often on the students' `summary.vocab.needsPractice`, up to three,
   * ties by id (F-VOC-005 section 3.8). A count per word across the class, never an order of
   * students and never a per-student rate. Empty while no roster carries `summary.vocab`.
   */
  vocabRevisit: string[];
  /**
   * Learners whose last activity is older than a week, or who never synced, leaving out anyone who joined under a
   * week ago (GX-8 T7: a learner who joined today has not been away for a week).
   */
  notSynced: number;
}

export function classRollup(learners: readonly RosterLearner[], now: Date): ClassRollup {
  const withSummary = learners.filter((l) => l.summary);
  const accuracies = withSummary.map((l) => l.summary?.stage1.anchorAccuracy ?? null).filter((a): a is number => a !== null);
  const counts = new Map<string, number>();
  for (const l of withSummary) for (const jamo of l.summary?.needsPractice ?? []) counts.set(jamo, (counts.get(jamo) ?? 0) + 1);
  const order = teachingOrder(CATALOG);
  const rank = (jamo: string): number => order.get(jamo) ?? Number.POSITIVE_INFINITY;
  const revisit = topThree(counts, (a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const wordCounts = new Map<string, number>();
  for (const l of withSummary) for (const id of wordsToRevisit(l.summary?.vocab)) wordCounts.set(id, (wordCounts.get(id) ?? 0) + 1);
  return {
    students: learners.length,
    practicedThisWeek: withSummary.filter((l) => (l.summary?.minutesLast7d ?? 0) > 0).length,
    anchorAccuracy: accuracies.length ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length : null,
    revisit,
    vocabRevisit: topThree(wordCounts),
    notSynced: learners.filter((l) => !joinedThisWeek(l, now) && (!l.summary || now.getTime() - Date.parse(l.summary.lastActiveAt) > NOT_SYNCED_AFTER_DAYS * DAY_MS)).length,
  };
}

/** Joined under `NOT_SYNCED_AFTER_DAYS` ago; an unreadable join time counts as earlier, as before GX-8. */
function joinedThisWeek(learner: Pick<RosterLearner, 'joinedAt'>, now: Date): boolean {
  const joined = Date.parse(learner.joinedAt);
  return !Number.isNaN(joined) && now.getTime() - joined < NOT_SYNCED_AFTER_DAYS * DAY_MS;
}

/** The roll-up's lines that change with the space kind or hide (AMENDMENTS-GROWNUP-UX GX-8, T7, T8, P4). */
export interface WeekLines {
  /** "3 of 9 practiced this week"; a family's says "learners" (P4). */
  practiced: string;
  /** "Stage 1 first-try answers: 75%"; null while no learner has a Stage 1 first-try figure (T8: never "–"). */
  anchor: string | null;
  /** "2 haven't opened the app in over a week"; null at 0. */
  notSynced: string | null;
}

export function weekLines(kind: string, rollup: ClassRollup, locale: UiLocale = DEFAULT_LOCALE): WeekLines {
  const w = getMessages(locale).console.space.week;
  return {
    practiced: kind === 'family' ? w.practicedFamily(rollup.practicedThisWeek, rollup.students) : w.practiced(rollup.practicedThisWeek, rollup.students),
    anchor: rollup.anchorAccuracy === null ? null : w.anchor(percent(rollup.anchorAccuracy)),
    notSynced: rollup.notSynced > 0 ? w.notSynced(rollup.notSynced) : null,
  };
}

/**
 * A card's quest line (T10): "Stage 1 quests: 3 of 15 · 4 cards"; a learner with no quest finished but minutes this
 * week reads "Working on the first quest", so "0 of 15" beside "2 min this week" never reads as nothing done.
 */
export function questsLine(summary: Pick<RosterSummary, 'stage1' | 'cardsUnlocked' | 'minutesLast7d'>, locale: UiLocale = DEFAULT_LOCALE): string {
  const l = getMessages(locale).console.space.learner;
  if (summary.stage1.questsDone === 0 && summary.minutesLast7d > 0) return l.firstQuest;
  return l.questsCards(summary.stage1.questsDone, summary.stage1.questsTotal, summary.cardsUnlocked);
}

/**
 * The roster's card order (P4; AMENDMENTS-GROWNUP-UX section 4): a family keeps the order its learners joined in, as
 * the family home does; a class keeps the Worker's "most recent activity first". Never by a score.
 */
export function rosterOrder(kind: string, learners: readonly RosterLearner[]): RosterLearner[] {
  return kind === 'family' ? joinOrder(learners) : [...learners];
}

/** The heading over the cards, matching `rosterOrder`: "Learners" for a family (P4), "Most recent activity first" for a class. */
export function rosterHeading(kind: string, locale: UiLocale = DEFAULT_LOCALE): string {
  const s = getMessages(locale).console.space;
  return kind === 'family' ? s.rosterHeadingFamily : s.recentFirst;
}

/** A card's join words: a family's dated "Joined Oct 14" (P4, never "Joined: Tue"); a class keeps "joined today". */
export function joinedLine(kind: string, joinedAt: string, now: Date, locale: UiLocale = DEFAULT_LOCALE): string {
  const s = getMessages(locale).console.space;
  return kind === 'family' ? s.joinedOn(formatDate(locale, joinedAt, 'monthDay')) : s.learner.joined(relativeDay(joinedAt, now, locale));
}

/**
 * The three most frequent keys, ties by `tie` (by key unless given): the result never depends on the roster order.
 * Letters tie in teaching order, as the class report's do (F-REPORT-001 RP-8; RP-2c `teachingOrder`).
 */
function topThree(counts: ReadonlyMap<string, number>, tie: (a: string, b: string) => number = (a, b) => a.localeCompare(b)): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || tie(a[0], b[0]))
    .slice(0, 3)
    .map(([key]) => key);
}

/** One student's words to revisit, each once; nothing from a slice the schema rejects (read as the card reads it). */
function wordsToRevisit(vocab: unknown): Set<string> {
  return new Set(parseVocabSummary(vocab)?.needsPractice ?? []);
}

export interface CapState {
  used: number;
  total: number;
  warning: boolean;
  reached: boolean;
  /** [SA] More learners than the cap, kept from before the limit (SA-D7): nobody is removed. */
  over: boolean;
  /** The free class cap (the upgrade nudge applies); false for a licensed class (50) and for a family. */
  free: boolean;
}

/**
 * The learner count of a family or class against its cap ([SA] AMENDMENTS-SEATS-ADMINS section 3.4). The roster's
 * `seats` (SA-1) decide: a family's 4, a class's 20 (free) or 50 (its own Group License), none for a class its school
 * covers (null: the school page shows the school count). A Worker older than SA-1 sends no `seats`: a class then
 * counts against the free cap as before, and a family against `FAMILY_LIFETIME_LEARNERS`.
 */
export function capState(kind: string, students: number, seats?: RosterSeats | null): CapState | null {
  if (kind !== 'class' && kind !== 'family') return null;
  const used = seats ? seats.learners : students;
  const total = seats ? seats.cap : kind === 'family' ? FAMILY_LIFETIME_LEARNERS : FREE_CLASS_STUDENT_CAP;
  if (total === null) return null;
  const free = kind === 'class' && total === FREE_CLASS_STUDENT_CAP;
  return { used, total, warning: used >= Math.ceil(total * CAP_WARNING_RATIO), reached: used >= total, over: used > total, free };
}

/**
 * The one line under a space's count (section 3.4): a free class keeps its nudge (`capWarning` near the cap,
 * `capReached` at it) with the billing link; a licensed class and a family say they are full (`seats.*.at`) or over
 * (`seats.*.over`) calmly, with no link. Null below the cap.
 */
export function seatLine(kind: string, cap: CapState | null, locale: UiLocale = DEFAULT_LOCALE): { text: string; upgrade: boolean } | null {
  if (!cap) return null;
  const c = getMessages(locale).console;
  if (kind === 'class' && cap.free) {
    if (cap.reached) return { text: c.capReached, upgrade: true };
    return cap.warning ? { text: c.capWarning(cap.used, cap.total), upgrade: true } : null;
  }
  const words = kind === 'family' ? c.seats.family : kind === 'class' ? c.seats.class : null;
  if (!words) return null;
  if (cap.over) return { text: words.over(cap.used, cap.total), upgrade: false };
  return cap.reached ? { text: words.at(cap.total), upgrade: false } : null;
}

/** A family's count, "3 of 4 learners" (`console.billing.usage.learners`, reused), on the family home and Settings. */
export function familyCountLine(cap: CapState, locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.billing.usage.learners(cap.used, cap.total);
}

/**
 * "today" · "yesterday" · weekday inside a week · "Sep 3" beyond · "not yet" without a date,
 * in `locale` (the words are `common.time`, the dates come from `formatDate`).
 */
export function relativeDay(iso: string | null | undefined, now: Date, locale: UiLocale = DEFAULT_LOCALE): string {
  return describeRelativeDay(locale, getMessages(locale).common.time, iso, now);
}

/** "expires in 18 days" · "expires today" · "expired" · "no code yet", in `locale`. */
export function codeExpiry(expiresAt: string | null | undefined, now: Date, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.codeExpiry;
  if (!expiresAt) return words.none;
  const ms = Date.parse(expiresAt) - now.getTime();
  if (Number.isNaN(ms) || ms <= 0) return words.expired;
  const days = Math.floor(ms / DAY_MS);
  if (days === 0) return words.today;
  return words.inDays(days);
}

export function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}
