import { CATALOG, FAMILY_LIFETIME_LEARNERS, FREE_CLASS_STUDENT_CAP, teachingOrder } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, describeRelativeDay, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { RosterLearner, RosterSeats } from './api';
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
  /** Learners whose last activity is older than a week, or who never synced. */
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
    notSynced: learners.filter((l) => !l.summary || now.getTime() - Date.parse(l.summary.lastActiveAt) > NOT_SYNCED_AFTER_DAYS * DAY_MS).length,
  };
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
