import type { ProgressSnapshot, ProgressSummary } from '@hangul-route/content-schema';

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
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const RECOGNIZED_ACCURACY = 0.8;
export const PRACTICE_ACCURACY = 0.6;

export function summarize({ snapshot, now, stage1QuestIds, questJamo }: SummarizeInput): ProgressSummary {
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
  const needsPractice = [...shaky].filter((j) => !recognized.has(j)).slice(0, 3);

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
    planProgress: {},
  };
}
