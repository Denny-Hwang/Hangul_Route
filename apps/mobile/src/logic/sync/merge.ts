import type {
  CardCollectionEntry,
  EpisodeProgress,
  HomeworkAssignment,
  ProgressSnapshot,
  QuestProgress,
  ReviewEntry,
  SessionLog,
} from '@hangul-route/content-schema';
import { computeStreak } from '../streak';

/**
 * Deterministic snapshot merge — F-SYNC-001 §3.3. Every collection in a
 * snapshot only ever grows, so a set union with per-field tie-breaks is
 * enough; no clock skew can lose a card or a star.
 */

function earliest(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function latest(a: string, b: string): string {
  return a > b ? a : b;
}

/** Union by key, output sorted by key so merge order never changes the result. */
function unionBy<T>(local: readonly T[], server: readonly T[], keyOf: (t: T) => string, pick: (l: T, s: T) => T): T[] {
  const out = new Map<string, T>();
  for (const item of local) out.set(keyOf(item), item);
  for (const item of server) {
    const key = keyOf(item);
    const existing = out.get(key);
    out.set(key, existing ? pick(existing, item) : item);
  }
  return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

export function mergeQuest(l: QuestProgress, s: QuestProgress): QuestProgress {
  const winner = l.stars !== s.stars ? (l.stars > s.stars ? l : s) : l.accuracy >= s.accuracy ? l : s;
  return {
    ...winner,
    attempts: l.attempts + s.attempts,
    startedAt: earliest(l.startedAt, s.startedAt) ?? winner.startedAt,
    completedAt: earliest(l.completedAt, s.completedAt),
  };
}

export function mergeEpisode(l: EpisodeProgress, s: EpisodeProgress): EpisodeProgress {
  return {
    episodeId: l.episodeId,
    startedAt: earliest(l.startedAt, s.startedAt) ?? l.startedAt,
    completedAt: earliest(l.completedAt, s.completedAt),
    questsCompleted: Math.max(l.questsCompleted, s.questsCompleted),
    totalQuests: Math.max(l.totalQuests, s.totalQuests),
  };
}

export function mergeCard(l: CardCollectionEntry, s: CardCollectionEntry): CardCollectionEntry {
  return { cardId: l.cardId, unlockedAt: earliest(l.unlockedAt, s.unlockedAt) ?? l.unlockedAt, newSinceLastView: l.newSinceLastView };
}

export function mergeHomework(l: HomeworkAssignment, s: HomeworkAssignment): HomeworkAssignment {
  const completedAt = earliest(l.completedAt, s.completedAt);
  return { ...(l.completedAt ? l : s.completedAt ? s : l), completedAt };
}

export function mergeReview(l: ReviewEntry, s: ReviewEntry): ReviewEntry {
  const ls = l.resultStars ?? -1;
  const ss = s.resultStars ?? -1;
  return ls >= ss ? l : s;
}

export interface MergeOptions {
  /** Clock for the streak recomputation; injected for determinism. */
  now: Date;
}

export function mergeSnapshots(local: ProgressSnapshot, server: ProgressSnapshot, opts: MergeOptions): ProgressSnapshot {
  const sessions = unionBy<SessionLog>(local.sessions, server.sessions, (x) => x.id, (l) => l).sort(
    (a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
  );
  return {
    profileId: local.profileId,
    updatedAt: latest(local.updatedAt, server.updatedAt),
    quests: unionBy(local.quests, server.quests, (q) => q.questId, mergeQuest),
    episodes: unionBy(local.episodes, server.episodes, (e) => e.episodeId, mergeEpisode),
    cards: unionBy(local.cards, server.cards, (c) => c.cardId, mergeCard),
    sessions,
    homework: unionBy(local.homework, server.homework, (h) => h.id, mergeHomework),
    reviews: unionBy(local.reviews, server.reviews, (r) => r.id, mergeReview),
    streakDays: computeStreak(
      sessions.map((s) => s.startedAt),
      opts.now,
    ),
  };
}

/** True when nothing in `local` is missing from `server` (upload not needed). */
export function isSubsetOf(local: ProgressSnapshot, server: ProgressSnapshot): boolean {
  const has = <T>(arr: readonly T[], key: (t: T) => string) => new Set(arr.map(key));
  const q = has(server.quests, (x) => `${x.questId}:${x.stars}`);
  const c = has(server.cards, (x) => x.cardId);
  const s = has(server.sessions, (x) => x.id);
  return (
    local.quests.every((x) => q.has(`${x.questId}:${x.stars}`)) &&
    local.cards.every((x) => c.has(x.cardId)) &&
    local.sessions.every((x) => s.has(x.id))
  );
}
