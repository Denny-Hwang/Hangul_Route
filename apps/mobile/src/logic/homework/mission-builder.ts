import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { nextQuestAfter, offerableQuests, playableEpisodes } from '../next-quest';

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
 *
 * A card carries a subtitle *code*, never prose (F-I18N-001 §3.4 rule 3): the
 * plan is pinned for the day, so it must not freeze a language into it. The
 * words come from the dictionary through `missionCardText`.
 */

export type MissionCardKind = 'replay' | 'new' | 'daily-test' | 'story';

/** Keys of `learner.home.mission.subtitle`. */
export type MissionSubtitle = 'replay' | 'story' | 'new' | 'assigned' | 'dailyTest';

export interface MissionCard {
  slot: 1 | 2 | 3;
  kind: MissionCardKind;
  /** The quest or episode title (content); `null` on the daily-test card, which names itself. */
  titleEn: string | null;
  subtitle: MissionSubtitle;
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
  /** Placed-out quests of the learner's route seed (F-PLC-001 section 3.7); omitted without a level check. */
  skipQuestIds?: ReadonlySet<string>;
  /**
   * The stages the cursor may offer (`cursorContext`, F-ROUTE-001 R-4a): the
   * same predicate Results and My route use. Omitted means every playable stage.
   */
  isEntitled?: (stageKey: string) => boolean;
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

/**
 * The Journey cursor, shared with the Results teaser and My route
 * (`logic/next-quest.ts`, told the same `isEntitled` and `skipQuestIds` by
 * `cursorContext`). Home keeps its own replay fallback around it: once every
 * offerable quest is done Home keeps offering the last one, as it always has,
 * rather than an empty "New" slot.
 */
function nextQuest(input: BuildMissionInput): Quest | undefined {
  const { snapshot, quests, episodes, skipQuestIds, isEntitled } = input;
  const offerable = offerableQuests(quests, episodes, isEntitled);
  // A placed-out quest never played comes before a replay of the last quest.
  return (
    nextQuestAfter({ snapshot, quests, episodes, isEntitled, skipQuestIds }) ??
    (skipQuestIds === undefined ? undefined : nextQuestAfter({ snapshot, quests, episodes, isEntitled })) ??
    offerable[offerable.length - 1]
  );
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
    subtitle: 'replay',
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
    subtitle: 'story',
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

function newCard(quest: Quest, episodes: readonly Episode[]): MissionCard {
  return {
    slot: 2,
    kind: 'new',
    titleEn: quest.titleEn,
    subtitle: 'new',
    questId: quest.id,
    episodeId: episodeOfQuest(episodes, quest.id)?.id,
    collected: false,
  };
}

/**
 * The one exception to the day pin (F-ROUTE-001 R-4a, section 3.5): when a
 * level check places out the quest pinned on the "New" card and the learner
 * has not played it today, card (2) moves to the cursor, so Home names the
 * same next quest as Results and My route. Cards (1) and (3) never move, and
 * the pin stays when the cursor has nothing else to offer.
 */
function repinPlacedOut(cards: readonly MissionCard[], input: BuildMissionInput): readonly MissionCard[] {
  const skip = input.skipQuestIds;
  // Only the system "New" card re-pins; a caregiver or teacher assignment
  // (`subtitle: 'assigned'`, `mergeAssignments`) keeps its slot.
  const pinnedNew = cards.find((card) => card.slot === 2 && card.kind === 'new' && card.subtitle === 'new');
  if (!skip || !pinnedNew?.questId || !skip.has(pinnedNew.questId)) return cards;
  if (completedToday(input.snapshot, pinnedNew.questId, input.today)) return cards;
  const upcoming = nextQuest(input);
  if (!upcoming || skip.has(upcoming.id) || cards.some((card) => card.questId === upcoming.id)) return cards;
  return cards.map((card) => (card === pinnedNew ? newCard(upcoming, input.episodes) : card));
}

export function buildTodaysMission(input: BuildMissionInput): MissionPlan {
  const { profileId, snapshot, quests, episodes, today } = input;
  const capabilities = input.capabilities ?? DEFAULT_CAPABILITIES;

  // §3.2 — reuse today's existing slot targets so nothing shifts under the
  // learner; only completion state is refreshed.
  if (input.pinned && input.pinned.date === today && input.pinned.profileId === profileId) {
    return {
      ...input.pinned,
      cards: repinPlacedOut(input.pinned.cards, input).map((card) => ({
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
  const upcoming = nextQuest(input);
  if (upcoming) {
    usedQuestIds.add(upcoming.id);
    cards.push(newCard(upcoming, episodes));
  }

  // ③ Daily test when available, else slot ①'s chain again.
  if (capabilities.dailyTestAvailable) {
    cards.push({
      slot: 3,
      kind: 'daily-test',
      titleEn: null,
      subtitle: 'dailyTest',
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

type MissionMessages = Messages['learner']['home']['mission'];

/** A card's title and subtitle in the UI language (`m` is `learner.home.mission`). */
export function missionCardText(card: MissionCard, m: MissionMessages): { title: string; subtitle: string } {
  return { title: card.titleEn ?? m.dailyTest.title, subtitle: m.subtitle[card.subtitle] };
}

/** Every learner-visible string in a plan — asserted against banned-text. */
export function missionCopy(plan: MissionPlan, m: MissionMessages): string[] {
  return plan.cards.flatMap((c) => {
    const { title, subtitle } = missionCardText(c, m);
    return [title, subtitle];
  });
}
