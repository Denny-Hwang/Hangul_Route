import { FREE_CLASS_STUDENT_CAP } from '@hangul-route/content-schema';
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
  /** Learners whose last activity is older than a week, or who never synced. */
  notSynced: number;
}

export function classRollup(learners: readonly RosterLearner[], now: Date): ClassRollup {
  const withSummary = learners.filter((l) => l.summary);
  const accuracies = withSummary.map((l) => l.summary?.stage1.anchorAccuracy ?? null).filter((a): a is number => a !== null);
  const counts = new Map<string, number>();
  for (const l of withSummary) for (const jamo of l.summary?.needsPractice ?? []) counts.set(jamo, (counts.get(jamo) ?? 0) + 1);
  const revisit = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([jamo]) => jamo);
  return {
    students: learners.length,
    practicedThisWeek: withSummary.filter((l) => (l.summary?.minutesLast7d ?? 0) > 0).length,
    anchorAccuracy: accuracies.length ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length : null,
    revisit,
    notSynced: learners.filter((l) => !l.summary || now.getTime() - Date.parse(l.summary.lastActiveAt) > NOT_SYNCED_AFTER_DAYS * DAY_MS).length,
  };
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "today" · "yesterday" · weekday inside a week · "Sep 3" beyond · "not yet" without a date. */
export function relativeDay(iso: string | null | undefined, now: Date): string {
  if (!iso) return 'not yet';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'not yet';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const days = Math.round((startOfToday - startOfThen) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return WEEKDAYS[then.getDay()] ?? 'not yet';
  return `${MONTHS[then.getMonth()] ?? ''} ${then.getDate()}`;
}

/** "expires in 18 days" · "expires today" · "expired" · "no code yet". */
export function codeExpiry(expiresAt: string | null | undefined, now: Date): string {
  if (!expiresAt) return 'no code yet';
  const ms = Date.parse(expiresAt) - now.getTime();
  if (Number.isNaN(ms) || ms <= 0) return 'expired';
  const days = Math.floor(ms / DAY_MS);
  if (days === 0) return 'expires today';
  return `expires in ${days} day${days === 1 ? '' : 's'}`;
}

export function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}
