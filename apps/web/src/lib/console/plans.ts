import type { PlanItem } from '@hangul-route/content-schema';
import type { RosterLearner } from './api';

/** Pure plan-builder helpers — F-PLAN-001 §3.5 (wireframe console/plan-builder). */
const DAY_MS = 86_400_000;

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return dateKey(new Date(Date.UTC(y, m - 1, d) + days * DAY_MS));
}

/**
 * Even spacing from `start` at `perWeek` items a week, never two on the
 * same day (F-HW-001 §3.4: one explicit item per day per source).
 */
export function spreadDates(start: string, perWeek: number, count: number): string[] {
  const step = 7 / Math.max(1, Math.min(7, perWeek));
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    let next = addDays(start, Math.round(i * step));
    const prev = out[out.length - 1];
    if (prev && next <= prev) next = addDays(prev, 1);
    out.push(next);
  }
  return out;
}

export interface SpacedItems {
  items: PlanItem[];
  moved: number;
}

/** Later items that collide on a date slide to the next free day, in list order. */
export function oneExplicitPerDay(items: readonly PlanItem[]): SpacedItems {
  const used = new Set<string>();
  let moved = 0;
  const out = items.map((item) => {
    if (!item.targetDate) return item;
    let date = item.targetDate;
    while (used.has(date)) date = addDays(date, 1);
    used.add(date);
    if (date !== item.targetDate) moved += 1;
    return date === item.targetDate ? item : { ...item, targetDate: date };
  });
  return { items: out, moved };
}

export interface PlanLike {
  id: string;
  title: string;
  publishedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
}

export function latestPublished<T extends PlanLike>(plans: readonly T[]): T | null {
  return plans.filter((p) => p.publishedAt && !p.archivedAt).sort((a, b) => (b.publishedAt as string).localeCompare(a.publishedAt as string))[0] ?? null;
}

/** The plan the builder opens with: the newest live plan, drafts included. */
export function currentPlan<T extends PlanLike>(plans: readonly T[]): T | null {
  return plans.filter((p) => !p.archivedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function planStatusLabel(plan: PlanLike): string {
  if (plan.archivedAt) return 'Archived';
  if (!plan.publishedAt) return 'Draft';
  const d = new Date(plan.publishedAt);
  return `Published ${MONTHS[d.getUTCMonth()] ?? ''} ${d.getUTCDate()}`;
}

export interface ReadoutRow {
  learnerId: string;
  name: string;
  done: number;
  total: number;
  notReady: number;
  /** False until the learner's device synced after the plan was published. */
  synced: boolean;
  lastActiveAt: string;
}

/** Per-learner progress for one plan, in roster order (most recent activity first — not a ranking). */
export function planReadout(planId: string, learners: readonly RosterLearner[]): ReadoutRow[] {
  return learners.map((l) => {
    const progress = l.summary?.planProgress[planId];
    return {
      learnerId: l.id,
      name: l.displayName,
      done: progress?.done ?? 0,
      total: progress?.total ?? 0,
      notReady: progress?.notReady ?? 0,
      synced: !!progress,
      lastActiveAt: l.lastActiveAt,
    };
  });
}

export function readoutLine(row: ReadoutRow): string {
  if (!row.synced) return 'waiting for the next sync';
  const base = `${row.done} / ${row.total}`;
  return row.notReady > 0 ? `${base} · ${row.notReady} not ready yet` : base;
}

export function moveItem(items: readonly PlanItem[], from: number, to: number): PlanItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const out = [...items];
  const [moved] = out.splice(from, 1);
  if (moved) out.splice(to, 0, moved);
  return out;
}
