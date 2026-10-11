import {
  effectiveRoute,
  type PlacementResult,
  type PlacementSummary,
  type ProgressSnapshot,
  type ProgressSummary,
} from '@hangul-route/content-schema';
import { planIdOf } from '../homework/plan-derivation';
import { compareInstant } from './merge';

/**
 * Client-side aggregate uploaded next to the snapshot — F-SYNC-001 §3.4.
 * This is the only column caregivers and teachers read, so nothing here
 * may leak per-quest detail beyond what the dashboards are allowed to show.
 */
export interface SummarizeInput {
  snapshot: ProgressSnapshot;
  now: Date;
  /** Quest ids that belong to Stage 1 (the anchor stage). */
  stage1QuestIds: readonly string[];
  /** Jamo taught per quest, used for recognized / needs-practice lists. */
  questJamo: Readonly<Record<string, readonly string[]>>;
  /** Items per plan the device could not assign yet (F-PLAN-001 §3.3). */
  planNotReady?: Readonly<Record<string, number>>;
  /** My route stage counts, computed by sync-store (F-ROUTE-001 R-8); left out when absent. */
  journey?: ProgressSummary['journey'];
}

/** done / total per plan from the plan-derived assignments, plus what was skipped. */
export function planProgressOf(snapshot: ProgressSnapshot, planNotReady: Readonly<Record<string, number>> = {}): ProgressSummary['planProgress'] {
  const out: ProgressSummary['planProgress'] = {};
  for (const h of snapshot.homework) {
    const planId = planIdOf(h.id);
    if (!planId) continue;
    const row = out[planId] ?? { done: 0, total: 0, notReady: 0 };
    row.total += 1;
    if (h.completedAt) row.done += 1;
    out[planId] = row;
  }
  for (const [planId, n] of Object.entries(planNotReady)) {
    // Only space plans: a self-route's count stays off the summary class rosters read (F-PLAN-002 section 3.10).
    if (n <= 0 || !planId.startsWith('plan:')) continue;
    const row = out[planId] ?? { done: 0, total: 0, notReady: 0 };
    row.notReady = n;
    out[planId] = row;
  }
  return out;
}

/**
 * The grown-up view of the level check (F-PLC-001 section 3.8): the newest
 * result's statuses and level only, no per-question data and no counts.
 * `overridden` is true while a parent override is in force on any result.
 * The level is the newest result's on purpose ("summarize fills it from the
 * newest result", section 3.8), not `effectiveRoute`'s highest level: the
 * summary reports what the latest check saw.
 */
export function placementSummaryOf(placements: readonly PlacementResult[] | undefined): PlacementSummary | undefined {
  if (placements === undefined || placements.length === 0) return undefined;
  const newest = [...placements].sort((a, b) => compareInstant(b.completedAt, a.completedAt))[0] as PlacementResult;
  return {
    takenAt: newest.completedAt,
    level: newest.level,
    oralStage: newest.oralStage,
    strands: newest.strands,
    beyondContent: newest.beyondContent,
    overridden: placements.some((r) => r.override !== undefined),
  };
}

/**
 * The route's priority symbols as jamo (a final key such as `sym:<jamo>/final` gives the jamo), at most three.
 * Priority tokens do not depend on the catalogue, so an empty one is enough.
 */
function prioritySymbols(placements: readonly PlacementResult[] | undefined): string[] {
  const seed = effectiveRoute(placements ?? [], { quests: [] }, { isEntitled: () => true, completedQuestIds: new Set() });
  if (seed === null) return [];
  const symbols = seed.priorityTokens.filter((t) => t.startsWith('sym:')).map((t) => t.slice(4).split('/')[0] as string);
  return [...new Set(symbols)].slice(0, 3);
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const RECOGNIZED_ACCURACY = 0.8;
export const PRACTICE_ACCURACY = 0.6;

export function summarize({ snapshot, now, stage1QuestIds, questJamo, planNotReady, journey }: SummarizeInput): ProgressSummary {
  const completed = snapshot.quests.filter((q) => q.completedAt);
  const stage1Set = new Set(stage1QuestIds);
  const stage1Done = completed.filter((q) => stage1Set.has(q.questId));
  const anchorAccuracy =
    stage1Done.length === 0 ? null : stage1Done.reduce((sum, q) => sum + q.accuracy, 0) / stage1Done.length;

  const weekAgo = now.getTime() - 7 * DAY_MS;
  const secondsLast7d = snapshot.sessions
    .filter((s) => new Date(s.startedAt).getTime() >= weekAgo)
    .reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);

  const recognized = new Set<string>();
  const shaky = new Set<string>();
  for (const q of completed) {
    const jamo = questJamo[q.questId] ?? [];
    if (q.accuracy >= RECOGNIZED_ACCURACY) jamo.forEach((j) => recognized.add(j));
    else if (q.accuracy < PRACTICE_ACCURACY) jamo.forEach((j) => shaky.add(j));
  }
  // The level check's priority symbols make a new grown-up view meaningful;
  // real practice data comes first and they fill what is left (F-PLC-001
  // section 3.7, consumer 5).
  const practiced = [...shaky].filter((j) => !recognized.has(j));
  const seeded = prioritySymbols(snapshot.placements).filter((j) => !recognized.has(j));
  const needsPractice = [...new Set([...practiced, ...seeded])].slice(0, 3);

  const placement = placementSummaryOf(snapshot.placements);

  const lastSession = snapshot.sessions[snapshot.sessions.length - 1];
  const lastActiveAt =
    lastSession && lastSession.startedAt > snapshot.updatedAt ? lastSession.startedAt : snapshot.updatedAt;

  return {
    schemaVersion: 1,
    lastActiveAt,
    streakDays: snapshot.streakDays,
    stage1: {
      questsDone: stage1Done.length,
      questsTotal: stage1QuestIds.length,
      anchorAccuracy: anchorAccuracy === null ? null : Math.round(anchorAccuracy * 100) / 100,
    },
    cardsUnlocked: snapshot.cards.length,
    minutesLast7d: Math.round(secondsLast7d / 60),
    jamoRecognized: [...recognized].sort(),
    needsPractice,
    planProgress: planProgressOf(snapshot, planNotReady),
    ...(placement ? { placement } : {}),
    ...(journey ? { journey } : {}),
  };
}
