import type { PlanItem, SpaceKind } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
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

/**
 * The plan the roster shows (the "Open plan" button and the card lines): the newest published
 * plan for everyone, so a plan sent to one or a few learners (such as a suggested start) never
 * buries the class plan; the newest published plan of any kind when there is no plan for everyone.
 */
export function rosterPlan<T extends PlanLike & { targetLearnerIds: readonly string[] | null }>(plans: readonly T[]): T | null {
  return latestPublished(plans.filter((p) => p.targetLearnerIds === null)) ?? latestPublished(plans);
}

/** Whether a plan reaches this learner: a plan for everyone reaches all, a targeted plan only its learners. */
export function planReaches(plan: { targetLearnerIds: readonly string[] | null }, learnerId: string): boolean {
  return plan.targetLearnerIds === null || plan.targetLearnerIds.includes(learnerId);
}

/** The plan the builder opens with: the newest live plan, drafts included. */
export function currentPlan<T extends PlanLike>(plans: readonly T[]): T | null {
  return plans.filter((p) => !p.archivedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

/** "Archived" · "Draft" · "Published Sep 20" (the UTC calendar day of publishing), in `locale`. */
export function planStatusLabel(plan: PlanLike, locale: UiLocale = DEFAULT_LOCALE): string {
  const status = getMessages(locale).console.planStatus;
  if (plan.archivedAt) return status.archived;
  if (!plan.publishedAt) return status.draft;
  return status.published(formatDate(locale, plan.publishedAt, 'monthDay', { utc: true }));
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

/** "2 / 3" · "0 / 2 · 1 not ready yet" · "waiting for the next sync", in `locale`. */
export function readoutLine(row: ReadoutRow, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.plan.readout;
  if (!row.synced) return words.waiting;
  return row.notReady > 0 ? words.withNotReady(row.done, row.total, row.notReady) : words.progress(row.done, row.total);
}

/**
 * A roster's space kind as a key of the member-worded messages (`noMembers`, `noneJoined`,
 * `summary.some`). Null (the roster has not loaded) reads as a family's "learners", as the page
 * always said; so does a kind this build does not know, since the roster is not validated at
 * runtime and a Worker deployed first could send one.
 */
export function memberKind(kind: SpaceKind | null): SpaceKind {
  return kind === 'class' || kind === 'school' ? kind : 'family';
}

/** A roster's space kind as a key of the space-worded messages (`summary.everyone`, `who.everyone`); null or unknown reads "space". */
export function spaceKey(kind: SpaceKind | null): SpaceKind | 'space' {
  return kind === 'family' || kind === 'class' || kind === 'school' ? kind : 'space';
}

/** The readout's summary, in `locale`: "4 items · for everyone in this class" · "4 items · for 3 students". */
export function planSummary(items: number, targets: number | null, kind: SpaceKind | null, locale: UiLocale = DEFAULT_LOCALE): string {
  const summary = getMessages(locale).console.plan.summary;
  return targets === null ? summary.everyone[spaceKey(kind)](items) : summary.some[memberKind(kind)](items, targets);
}

/** The "everyone" choice of the audience radio, in `locale`: "everyone in this class". */
export function planEveryone(kind: SpaceKind | null, locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.plan.who.everyone[spaceKey(kind)];
}

/** Why the plan page could not load or save; a key, worded at render time so it follows the header language select. */
export type PlanError = 'cantReach' | 'saveInvalid' | 'saveFailed' | 'archiveFailed';

/** The words for a `PlanError`, in `locale`. */
export function planErrorText(error: PlanError, locale: UiLocale = DEFAULT_LOCALE): string {
  const c = getMessages(locale).console;
  return error === 'cantReach' ? c.cantReach : c.plan[error];
}

export function moveItem(items: readonly PlanItem[], from: number, to: number): PlanItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const out = [...items];
  const [moved] = out.splice(from, 1);
  if (moved) out.splice(to, 0, moved);
  return out;
}
