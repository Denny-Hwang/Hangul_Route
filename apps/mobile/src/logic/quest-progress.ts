import { ProgressSnapshotSchema, type ProgressSnapshot, type QuestProgress } from '@hangul-route/content-schema';
import { earlierLatchTime } from './sync/merge';

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

/**
 * The Worker's own rule for one `questDoneAt` entry (`ProgressSnapshotSchema`):
 * an entry it refuses fails the whole upload with a 422, and every later one.
 */
const LATCH_ENTRY = ProgressSnapshotSchema.shape.questDoneAt.unwrap();
const accepted = (questId: string, at: unknown): at is string =>
  LATCH_ENTRY.keySchema.safeParse(questId).success && LATCH_ENTRY.valueSchema.safeParse(at).success;

/**
 * The quest latch writer (F-REPORT-001 section 3.3.1, M5): each quest's first
 * finish, in `questDoneAt`. A quest that has a `completedAt` (a time that names
 * an instant) and no entry gains one with that time; an entry is never moved
 * later, and never removed. A replay moves `completedAt`, never the first finish,
 * and entries for quests this copy does not hold (another device, or before a
 * profile reset) stay. An entry is also never later than its quest's own
 * `completedAt`: a finish is never before the first one, so when a sync merge
 * brings another device's earlier finish (the earliest `completedAt` wins) the
 * entry moves back to it, as the latch merge would. The key is always written
 * (an empty record when nothing is finished), so "key absent" means "an older
 * build" to the Worker's preserve rule.
 *
 * The store calls it on hydrate (the one-time backfill: history before RP-3a
 * is dated by the latest finish, biased late, and stays put after that), after a
 * quest result (the first finish) and on a snapshot from sync or restore.
 * `updatedAt` is left alone, so a backfill never reads as practice today
 * (`lastActiveAt`). Only entries the Worker accepts are written, and a held
 * entry it would refuse (a corrupted record) is dropped, so the latch never
 * blocks a sync. Best effort: it runs over stored JSON that is not validated,
 * so a record it cannot read is returned unchanged. Returns the same snapshot
 * when nothing changes.
 */
export function latchQuests(snapshot: ProgressSnapshot): ProgressSnapshot {
  try {
    if (!Array.isArray(snapshot.quests)) return snapshot;
    const raw: unknown = snapshot.questDoneAt;
    const held = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? Object.entries(raw) : undefined;
    // A Map, so a quest id such as `__proto__` is an entry like any other.
    const latch = new Map<string, string>();
    let changed = held === undefined;
    for (const [questId, at] of held ?? []) {
      if (accepted(questId, at)) latch.set(questId, at);
      else changed = true;
    }
    for (const { questId, completedAt } of snapshot.quests) {
      if (!accepted(questId, completedAt) || !Number.isFinite(Date.parse(completedAt))) continue;
      const prev = latch.get(questId);
      const first = prev === undefined ? completedAt : earlierLatchTime(prev, completedAt);
      if (first === prev) continue;
      latch.set(questId, first);
      changed = true;
    }
    return changed ? { ...snapshot, questDoneAt: Object.fromEntries(latch) } : snapshot;
  } catch {
    return snapshot;
  }
}
