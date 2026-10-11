import type { PlanItem } from '@hangul-route/content-schema';
import type { RosterLearner } from './api';

/** Pure plan-builder helpers — F-PLAN-001 §3.5 (wireframe console/plan-builder). */

// The date helpers live in the shared package (F-PLAN-002 PR P2-1) so the curriculum generator can use them; re-exported to keep every web import path unchanged.
export { addDays, dateKey, oneExplicitPerDay, spreadDates } from '@hangul-route/content-schema';
export type { SpacedItems } from '@hangul-route/content-schema';

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
