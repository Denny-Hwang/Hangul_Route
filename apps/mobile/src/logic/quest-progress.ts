import type { ProgressSnapshot, QuestProgress } from '@hangul-route/content-schema';

/** One finished run of a quest, as Results hands it to the progress store. */
export interface QuestRun {
  questId: string;
  episodeId: string;
  stars: 0 | 1 | 2 | 3;
  accuracy: number;
  attempts: number;
}

/**
 * The stored record after a finished run (F-STORY-003 §3.7, D3: earned stars
 * are never taken away). Higher stars win; on equal stars the higher accuracy
 * wins — the same winner rule as the sync merge (`mergeQuest`). Attempts add
 * up, `startedAt` stays the earliest, and `completedAt` moves to the latest
 * finish because Home's "collected today" flip and the replay window read it.
 * The first finish is kept apart, in `questDoneAt` (`latchQuests`).
 */
export function recordBestQuest(previous: QuestProgress | undefined, run: QuestRun, now: string): QuestProgress {
  if (!previous) {
    return { ...run, startedAt: now, completedAt: now };
  }
  const runWins = run.stars !== previous.stars ? run.stars > previous.stars : run.accuracy > previous.accuracy;
  const best = runWins ? run : previous;
  return {
    questId: run.questId,
    episodeId: run.episodeId,
    startedAt: previous.startedAt < now ? previous.startedAt : now,
    completedAt: previous.completedAt && previous.completedAt > now ? previous.completedAt : now,
    stars: best.stars,
    accuracy: best.accuracy,
    attempts: previous.attempts + run.attempts,
  };
}

/** Bounds of a `questDoneAt` entry in `ProgressSnapshotSchema`: the Worker refuses (422) a whole upload that breaks them. */
const LATCH_ID_MAX = 64;
const LATCH_TIME_MAX = 40;

/** A quest id and a finish time the Worker accepts, and a time that names an instant. */
function latchable(questId: unknown, at: unknown): at is string {
  return (
    typeof questId === 'string' &&
    questId.length > 0 &&
    questId.length <= LATCH_ID_MAX &&
    typeof at === 'string' &&
    at.length > 0 &&
    at.length <= LATCH_TIME_MAX &&
    Number.isFinite(Date.parse(at))
  );
}

function isRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The quest latch writer (F-REPORT-001 section 3.3.1, M5): every quest that has
 * a `completedAt` and no `questDoneAt` entry gains one with that time, and the
 * key is always written (an empty record when nothing is finished), so "key
 * absent" means "an older build" to the Worker's preserve rule. An entry is
 * never moved or removed: a replay moves `completedAt`, never the first
 * finish, and entries for quests this copy does not hold (another device, or
 * before a profile reset) stay.
 *
 * The store calls it on hydrate (the one-time backfill: history before RP-3a
 * is dated by the latest finish, biased late, and never moves again), after a
 * quest result (the first finish) and on a snapshot from sync or restore.
 * `updatedAt` is left alone, so a backfill never reads as practice today
 * (`lastActiveAt`). Only entries the Worker's schema accepts are written.
 * Best effort: it runs over stored JSON that is not validated, so a record it
 * cannot read is returned unchanged. Returns the same snapshot when nothing
 * changes.
 */
export function latchQuests(snapshot: ProgressSnapshot): ProgressSnapshot {
  try {
    if (!Array.isArray(snapshot.quests)) return snapshot;
    const held = isRecord(snapshot.questDoneAt) ? snapshot.questDoneAt : undefined;
    // A Map, so a quest id such as `__proto__` is an entry like any other.
    const latch = new Map(Object.entries(held ?? {}));
    let changed = held === undefined;
    for (const quest of snapshot.quests) {
      if (latch.has(quest.questId) || !latchable(quest.questId, quest.completedAt)) continue;
      latch.set(quest.questId, quest.completedAt);
      changed = true;
    }
    return changed ? { ...snapshot, questDoneAt: Object.fromEntries(latch) } : snapshot;
  } catch {
    return snapshot;
  }
}
