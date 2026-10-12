import { FREE_CLASS_STUDENT_CAP } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, describeRelativeDay, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { RosterLearner } from './api';

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
  const revisit = topThree(counts);
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

/** The three most frequent keys, ties by key: the result never depends on the roster order. */
function topThree(counts: ReadonlyMap<string, number>): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([key]) => key);
}

/** One student's words to revisit, each once; nothing from a malformed slice. */
function wordsToRevisit(vocab: unknown): Set<string> {
  const list: unknown = typeof vocab === 'object' && vocab !== null ? (vocab as { needsPractice?: unknown }).needsPractice : undefined;
  return new Set(Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []);
}

export interface CapState {
  used: number;
  total: number;
  warning: boolean;
  reached: boolean;
}

export function capState(kind: string, students: number): CapState | null {
  if (kind !== 'class') return null;
  const total = FREE_CLASS_STUDENT_CAP;
  return { used: students, total, warning: students >= Math.ceil(total * CAP_WARNING_RATIO), reached: students >= total };
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
