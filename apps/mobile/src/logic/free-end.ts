import { CATALOG, freeLessonsFacts, type Episode, type ProgressSnapshot, type Quest } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../platform/telemetry';
import type { RouteNext } from './route-next';

/**
 * The end of the free lessons (F-ENT-003 sections 3.7 and 3.8, PR E3-7; wireframes
 * home/next-and-free-end-card and results/back-to-plan-and-free-end; mock
 * design/components/RouteMarkers "The cards"). When `routeNext` says `free-end` (the effective
 * switch is on, the learner is free and every open quest is played), the learner sees one
 * celebration, once per profile and device (on Results or on Home, whichever comes first), and
 * from then on a plain practice card with no ask. Pure.
 */

/** The per-device UI key of "the celebration was shown" (`platform/storage.ts`, never synced). */
export function freeEndSeenKey(profileId: string): string {
  return `free-end-seen:${profileId}`;
}

/** `access.free_end_reached { freeDays, placedOut }`, sent the first time the celebration shows (section 3.12). */
export function freeEndReachedEvent(profileId: string, placedOut: boolean, facts = freeLessonsFacts(CATALOG)): TelemetryEvent {
  return { name: 'access.free_end_reached', profileId, payload: { freeDays: facts.days, placedOut } };
}

/** The first lesson of the route: the replay when nothing is kept yet. */
const FIRST_LESSON = 'quest:stage1-letters-q1';

type Kept = ProgressSnapshot['quests'][number] & { completedAt: string };

/**
 * "Play a favorite again": the kept grid quest that most needs a replay (lowest accuracy, then
 * the most recent), else the first lesson. A shelf story is never a scored replay.
 */
export function favoriteReplay(
  snapshot: ProgressSnapshot,
  quests: readonly Quest[],
  episodes: readonly Episode[],
  /** Quests another card of the day already offers (Home keeps its three cards different). */
  exclude: ReadonlySet<string> = new Set(),
): Quest | null {
  const grid = new Set(episodes.filter((e) => e.placement !== 'shelf').flatMap((e) => e.questIds));
  const kept = snapshot.quests
    .filter((q): q is Kept => Boolean(q.completedAt) && grid.has(q.questId) && !exclude.has(q.questId))
    .sort((a, b) => a.accuracy - b.accuracy || b.completedAt.localeCompare(a.completedAt));
  for (const k of kept) {
    const quest = quests.find((q) => q.id === k.questId);
    if (quest) return quest;
  }
  return exclude.has(FIRST_LESSON) ? null : (quests.find((q) => q.id === FIRST_LESSON) ?? null);
}

/** A sampler story bundled in this build (F-STORY-004 D5). */
export interface SamplerStory {
  storyId: string;
  questId: string;
  episodeId: string;
  title: string;
}

/** What the practice card opens. */
export type PracticeTarget =
  | { kind: 'topic'; topicKey: string; title: string }
  | ({ kind: 'story' } & SamplerStory)
  | { kind: 'replay'; questId: string; episodeId: string; title: string };

export interface PracticeInput {
  snapshot: ProgressSnapshot;
  /** YYYY-MM-DD. */
  today: string;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  /** The free word topics the picker shows in this build, in its order, with their titles in the UI language. */
  freeTopics: readonly { key: string; title: string }[];
  /** The first sampler story bundled in this build, or null. */
  samplerStory: SamplerStory | null;
}

/**
 * The practice card (section 3.7): the first free word topic the learner has not finished today,
 * else a sampler story, else the best kept replay. Null only when the bundle has no quest at all.
 */
export function practiceTarget(i: PracticeInput): PracticeTarget | null {
  const playedToday = new Set((i.snapshot.vocab?.topics ?? []).filter((t) => t.last === i.today).map((t) => t.topic));
  const topic = i.freeTopics.find((t) => !playedToday.has(t.key));
  if (topic) return { kind: 'topic', topicKey: topic.key, title: topic.title };
  if (i.samplerStory) return { kind: 'story', ...i.samplerStory };
  const replay = favoriteReplay(i.snapshot, i.quests, i.episodes);
  if (!replay) return null;
  const episode = i.episodes.find((e) => e.questIds.includes(replay.id));
  return episode ? { kind: 'replay', questId: replay.id, episodeId: episode.id, title: replay.titleEn } : null;
}

/** The celebration's primary: Practice words (the first free topic), else Read a story, else none. */
export type FreeEndPrimary = { kind: 'topic'; topicKey: string } | { kind: 'story'; storyId: string; questId: string; episodeId: string } | null;

export function freeEndPrimary(freeTopicKey: string | null, samplerStory: SamplerStory | null): FreeEndPrimary {
  if (freeTopicKey !== null) return { kind: 'topic', topicKey: freeTopicKey };
  if (samplerStory) return { kind: 'story', storyId: samplerStory.storyId, questId: samplerStory.questId, episodeId: samplerStory.episodeId };
  return null;
}

/** The cards the learner earned from the free lessons' episodes, newest first. */
export function freeLessonCards(snapshot: ProgressSnapshot, episodes: readonly Episode[], freeEpisodeIds: readonly string[]): string[] {
  const free = new Set(episodes.filter((e) => freeEpisodeIds.includes(e.id)).flatMap((e) => e.rewardCardIds));
  return snapshot.cards
    .filter((c) => free.has(c.cardId))
    .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt))
    .map((c) => c.cardId);
}

/** At most six faces in the Results earned row (RouteMarkers D9). */
export const EARNED_ROW_MAX = 6;

/** The faces that fit in one line (`fit`), at most six, and how many more were earned. */
export function earnedFaces(cardIds: readonly string[], fit: number): { shown: string[]; more: number } {
  const shown = cardIds.slice(0, Math.max(0, Math.min(fit, EARNED_ROW_MAX)));
  return { shown, more: cardIds.length - shown.length };
}

/**
 * What Results shows at the end of the free lessons (section 3.8): the celebration once after a
 * scored quest (`celebrate`), the calm line once it was seen (`open-for-you`), `pending` while
 * the seen key is read, or null (not free-end, or every game skipped: Results is unchanged).
 */
export function freeEndResults(i: { next: RouteNext | null; scored: boolean; seen: boolean | null }): 'celebrate' | 'open-for-you' | 'pending' | null {
  if (i.next?.kind !== 'free-end' || !i.scored) return null;
  if (i.seen === null) return 'pending';
  return i.seen ? 'open-for-you' : 'celebrate';
}
