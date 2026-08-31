import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';

/**
 * Today's mission — F-HW-001 §3.1, §3.2.
 *
 * Exactly three cards, in fixed slot order:
 *   ① Replay      — a recent Quest the learner got something wrong on
 *   ② New         — the next Quest on the Journey cursor
 *   ③ Daily test  — a short review (F-RVW-001)
 *
 * Slot ③ is capability-gated: F-RVW-001 has not shipped, so until it does the
 * slot falls back down slot ①'s preference chain rather than rendering a card
 * that navigates nowhere (F-HW-001 §9.2). The child-facing invariant is
 * "exactly three live cards", not which engine backs each one.
 */

export type MissionCardKind = 'replay' | 'new' | 'daily-test' | 'story';

export interface MissionCard {
  slot: 1 | 2 | 3;
  kind: MissionCardKind;
  titleEn: string;
  subtitleEn: string;
  /** Present for replay / new cards. */
  questId?: string;
  /** Present for replay / new / story cards. */
  episodeId?: string;
  /** True once the underlying Quest was completed today. */
  collected: boolean;
}

export interface MissionPlan {
  /** YYYY-MM-DD the plan was built for. */
  date: string;
  profileId: string;
  cards: MissionCard[];
}

export interface MissionCapabilities {
  /** Flip to true when F-RVW-001 ships (T-030–T-032). */
  dailyTestAvailable: boolean;
}

export const DEFAULT_CAPABILITIES: MissionCapabilities = { dailyTestAvailable: false };

export interface BuildMissionInput {
  profileId: string;
  snapshot: ProgressSnapshot;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  /** YYYY-MM-DD. */
  today: string;
  capabilities?: MissionCapabilities;
  /**
   * The plan already built for `today`, if any. Slot targets are reused
   * verbatim so cards never shift position mid-day (§3.2); only `collected`
   * is recomputed. A plan from another day is ignored.
   */
  pinned?: MissionPlan | null;
}

/** How far back a Quest counts as replayable (§3.1 — days N−1, N−2). */
export const REPLAY_WINDOW_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysBefore(dayA: string, dayB: string): number {
  const a = new Date(`${dayA}T00:00:00Z`).getTime();
  const b = new Date(`${dayB}T00:00:00Z`).getTime();
  return Math.round((b - a) / DAY_MS);
}

function episodeOfQuest(episodes: readonly Episode[], questId: string): Episode | undefined {
  return episodes.find((e) => e.questIds.includes(questId));
}

/**
 * Quests completed within the replay window that the learner got something
 * wrong on, most-in-need first (lowest accuracy, then most recent).
 */
type CompletedQuest = ProgressSnapshot['quests'][number] & { completedAt: string };

function replayCandidates(snapshot: ProgressSnapshot, today: string): CompletedQuest[] {
  return snapshot.quests
    .filter((q): q is CompletedQuest => {
      if (!q.completedAt) return false;
      if (q.accuracy >= 1) return false;
      const age = daysBefore(dayKey(q.completedAt), today);
      return age >= 1 && age <= REPLAY_WINDOW_DAYS;
    })
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.completedAt.localeCompare(a.completedAt);
    });
}

/** Episodes a learner can actually open, in content order. */
function playableEpisodes(episodes: readonly Episode[]): Episode[] {
  return episodes.filter((e) => e.status === 'shipped' || e.status === 'ready');
}

/**
 * The Journey cursor. Only quests inside a playable episode are offered — a
 * quest whose episode is still a preview placeholder would route the learner
 * into an unshipped screen.
 */
function nextQuest(
  snapshot: ProgressSnapshot,
  quests: readonly Quest[],
  episodes: readonly Episode[],
): Quest | undefined {
  const openIds = new Set(playableEpisodes(episodes).flatMap((e) => e.questIds));
  const offerable = quests.filter((q) => openIds.has(q.id));
  const done = new Set(snapshot.quests.filter((q) => q.completedAt).map((q) => q.questId));
  return offerable.find((q) => !done.has(q.id)) ?? offerable[offerable.length - 1];
}

function completedToday(snapshot: ProgressSnapshot, questId: string, today: string): boolean {
  const record = snapshot.quests.find((q) => q.questId === questId);
  return Boolean(record?.completedAt && dayKey(record.completedAt) === today);
}

function replayCard(slot: 1 | 3, quest: Quest, episodeId: string | undefined): MissionCard {
  return {
    slot,
    kind: 'replay',
    titleEn: quest.titleEn,
    subtitleEn: 'One more go with Hoya',
    questId: quest.id,
    episodeId,
    collected: false,
  };
}

function storyCard(slot: 1 | 3, episode: Episode): MissionCard {
  return {
    slot,
    kind: 'story',
    titleEn: episode.titleEn,
    subtitleEn: 'Story time',
    episodeId: episode.id,
    collected: false,
  };
}

/**
 * Slot ①'s preference chain, also used by slot ③ when the daily test is not
 * available: best replay first, else a Story Time episode the learner has
 * already opened, else the first playable episode.
 */
function fallbackCard(
  slot: 1 | 3,
  input: BuildMissionInput,
  usedQuestIds: Set<string>,
  usedEpisodeIds: Set<string>,
): MissionCard | null {
  const { snapshot, quests, episodes, today } = input;

  for (const candidate of replayCandidates(snapshot, today)) {
    if (usedQuestIds.has(candidate.questId)) continue;
    const quest = quests.find((q) => q.id === candidate.questId);
    if (!quest) continue;
    return replayCard(slot, quest, episodeOfQuest(episodes, quest.id)?.id);
  }

  for (const episode of playableEpisodes(episodes)) {
    if (usedEpisodeIds.has(episode.id)) continue;
    return storyCard(slot, episode);
  }
  return null;
}

export function buildTodaysMission(input: BuildMissionInput): MissionPlan {
  const { profileId, snapshot, quests, episodes, today } = input;
  const capabilities = input.capabilities ?? DEFAULT_CAPABILITIES;

  // §3.2 — reuse today's existing slot targets so nothing shifts under the
  // learner; only completion state is refreshed.
  if (input.pinned && input.pinned.date === today && input.pinned.profileId === profileId) {
    return {
      ...input.pinned,
      cards: input.pinned.cards.map((card) => ({
        ...card,
        collected: card.questId ? completedToday(snapshot, card.questId, today) : card.collected,
      })),
    };
  }

  const usedQuestIds = new Set<string>();
  const usedEpisodeIds = new Set<string>();
  const cards: MissionCard[] = [];

  // ① Replay, else Story Time.
  const first = fallbackCard(1, input, usedQuestIds, usedEpisodeIds);
  if (first) {
    if (first.questId) usedQuestIds.add(first.questId);
    if (first.episodeId) usedEpisodeIds.add(first.episodeId);
    cards.push(first);
  }

  // ② New — the Journey cursor.
  const upcoming = nextQuest(snapshot, quests, episodes);
  if (upcoming) {
    usedQuestIds.add(upcoming.id);
    cards.push({
      slot: 2,
      kind: 'new',
      titleEn: upcoming.titleEn,
      subtitleEn: 'Something new today',
      questId: upcoming.id,
      episodeId: episodeOfQuest(episodes, upcoming.id)?.id,
      collected: false,
    });
  }

  // ③ Daily test when available, else slot ①'s chain again.
  if (capabilities.dailyTestAvailable) {
    cards.push({
      slot: 3,
      kind: 'daily-test',
      titleEn: 'Quick review',
      subtitleEn: 'About a minute with Hoya',
      collected: false,
    });
  } else {
    const third = fallbackCard(3, input, usedQuestIds, usedEpisodeIds);
    if (third) cards.push(third);
  }

  return {
    date: today,
    profileId,
    cards: cards.map((card) => ({
      ...card,
      collected: card.questId ? completedToday(snapshot, card.questId, today) : false,
    })),
  };
}

/** Every learner-visible string in a plan — asserted against banned-text. */
export function missionCopy(plan: MissionPlan): string[] {
  return plan.cards.flatMap((c) => [c.titleEn, c.subtitleEn]);
}
