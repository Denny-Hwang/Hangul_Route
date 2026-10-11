import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { nextQuestAfter, offerableQuests, playableEpisodes } from '../next-quest';
import type { BookmarkFile } from '../story/bookmarks';
import type { StoryIndexEntry } from '../story/story-index';
import { pickStoryForHome, type StoryPick, type StoryReason } from '../story/story-pick';
import { storyStatus } from '../story/story-status';

/**
 * Today's mission — F-HW-001 §3.1, §3.2, with the story card of F-STORY-004 §3.7.
 *
 * Exactly three cards, in fixed slot order, each the first card its chain finds:
 *   ① continue story → best replay → next story → again story → explore
 *   ② New — the next Quest on the Journey cursor (grid episodes only)
 *   ③ Daily test (F-RVW-001) when available, else
 *      next story → best remaining replay → again story → explore
 *
 * An unfinished story is a stronger signal than a replay, so it takes slot ①
 * first; otherwise replays (there is one almost every day for an active
 * learner) would hide stories. A replay is a *grid* quest: a shelf story the
 * learner finished below full accuracy comes back only as the unscored
 * `again` card, never as a scored replay (decision of F-STORY-004 §3.7, PR
 * 4.4a). `explore` (a playable grid episode, "Take a look") replaces the old
 * fallback that labelled any episode "Story time" (audit UX-19), so the row
 * keeps three cards when no story exists — as in production while every
 * bundled story is still a draft (the story index holds reviewed stories only).
 *
 * Slot ③ is capability-gated: F-RVW-001 has not shipped, so until it does the
 * slot falls back down its own chain rather than rendering a card that
 * navigates nowhere (F-HW-001 §9.2). The learner-facing invariant is "exactly
 * three live cards", not which engine backs each one.
 *
 * A card carries a subtitle *code*, never prose (F-I18N-001 §3.4 rule 3): the
 * plan is pinned for the day, so it must not freeze a language into it. The
 * words come from the dictionary through `missionCardText`.
 */

export type MissionCardKind = 'replay' | 'new' | 'daily-test' | 'story' | 'explore';

/**
 * Keys of `learner.home.mission.subtitle`, plus `explore`, whose words are
 * `learner.storyShelf.home.explore`. A `story` card with a `storyReason` reads
 * `learner.storyShelf.home.subtitle[storyReason]` (`missionCardText`).
 */
export type MissionSubtitle = 'replay' | 'story' | 'new' | 'assigned' | 'dailyTest' | 'explore';

export interface MissionCard {
  slot: 1 | 2 | 3;
  kind: MissionCardKind;
  /** The quest or episode title (content); `null` on the daily-test card, which names itself. */
  titleEn: string | null;
  subtitle: MissionSubtitle;
  /** Present for replay / new / story cards. */
  questId?: string;
  /** Present for replay / new / story / explore cards. */
  episodeId?: string;
  /** True once the underlying Quest was completed today; never on an `again` (replay-mode) story card. */
  collected: boolean;
  /** Story cards only (F-STORY-004 §3.7): the story the card opens. */
  storyId?: string;
  /** Story cards only: why this story — the subtitle follows it and may refresh from the bookmark. */
  storyReason?: StoryReason;
  /** Story cards only: `replay` opens the unscored reader (`again`), `play` the scored quest. */
  storyMode?: 'play' | 'replay';
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
  /**
   * The story card's world (F-STORY-004 §3.7): the story index, the profile's
   * bookmarks and the lock (`storyLockFor`). Absent → no story cards.
   */
  stories?: {
    entries: readonly StoryIndexEntry[];
    bookmarks: BookmarkFile;
    isLocked: (entry: StoryIndexEntry) => boolean;
  };
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

function replayCandidates(snapshot: ProgressSnapshot, episodes: readonly Episode[], today: string): CompletedQuest[] {
  return snapshot.quests
    .filter((q): q is CompletedQuest => {
      if (!q.completedAt) return false;
      // A shelf story is never a replay card: it returns as the unscored `again` card (F-STORY-004 §3.7).
      if (episodeOfQuest(episodes, q.questId)?.placement === 'shelf') return false;
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

function storyCard(slot: 1 | 3, pick: StoryPick): MissionCard {
  return {
    slot,
    kind: 'story',
    titleEn: pick.entry.story.title.en,
    subtitle: 'story',
    questId: pick.entry.questId,
    episodeId: pick.entry.episodeId,
    storyId: pick.entry.storyId,
    storyReason: pick.reason,
    storyMode: pick.mode,
    collected: false,
  };
}

function exploreCard(slot: 1 | 3, episode: Episode): MissionCard {
  return {
    slot,
    kind: 'explore',
    titleEn: episode.titleEn,
    subtitle: 'explore',
    episodeId: episode.id,
    collected: false,
  };
}

/** What the plan already holds, so no card repeats a quest, an episode or a story. */
interface Used {
  quests: Set<string>;
  episodes: Set<string>;
  stories: Set<string>;
}

type Link = (slot: 1 | 3, input: BuildMissionInput, used: Used) => MissionCard | null;

/** One stage of the story chain (`pickStoryForHome` limited to `reasons`). */
function storyLink(...reasons: StoryReason[]): Link {
  return (slot, input, used) => {
    if (!input.stories) return null;
    const pick = pickStoryForHome({
      entries: input.stories.entries,
      snapshot: input.snapshot,
      bookmarks: input.stories.bookmarks,
      isLocked: input.stories.isLocked,
      excludeStoryIds: [...used.stories],
      excludeQuestIds: [...used.quests],
      reasons,
    });
    return pick ? storyCard(slot, pick) : null;
  };
}

/** The best replay not on the plan yet (grid quests only). */
const replayLink: Link = (slot, input, used) => {
  const { snapshot, quests, episodes, today } = input;
  for (const candidate of replayCandidates(snapshot, episodes, today)) {
    if (used.quests.has(candidate.questId)) continue;
    const quest = quests.find((q) => q.id === candidate.questId);
    if (!quest) continue;
    return replayCard(slot, quest, episodeOfQuest(episodes, quest.id)?.id);
  }
  return null;
};

/** The first playable grid episode not on the plan yet. */
const exploreLink: Link = (slot, input, used) => {
  const episode = playableEpisodes(input.episodes).find((e) => !used.episodes.has(e.id));
  return episode ? exploreCard(slot, episode) : null;
};

const SLOT_1_CHAIN: readonly Link[] = [storyLink('continue'), replayLink, storyLink('next'), storyLink('again'), exploreLink];
const SLOT_3_CHAIN: readonly Link[] = [storyLink('next'), replayLink, storyLink('again'), exploreLink];

function firstOf(chain: readonly Link[], slot: 1 | 3, input: BuildMissionInput, used: Used): MissionCard | null {
  for (const link of chain) {
    const card = link(slot, input, used);
    if (card) return card;
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

/** Records a card on the plan; a replay of a book story quest also takes its story. */
function use(used: Used, card: MissionCard, input: BuildMissionInput): void {
  if (card.questId) used.quests.add(card.questId);
  if (card.episodeId) used.episodes.add(card.episodeId);
  const storyId = card.storyId ?? input.stories?.entries.find((e) => e.questId === card.questId)?.storyId;
  if (storyId) used.stories.add(storyId);
}

/** An `again` card opens the unscored reader, so it is never collected (§3.7). */
function isCollected(card: MissionCard, snapshot: ProgressSnapshot, today: string, fallback: boolean): boolean {
  if (card.storyMode === 'replay') return false;
  return card.questId ? completedToday(snapshot, card.questId, today) : fallback;
}

/**
 * A pinned story card keeps its story all day; only its reason line may
 * refresh: a `next` story the learner left mid-way now reads "Keep reading".
 */
function refreshedReason(card: MissionCard, input: BuildMissionInput): StoryReason | undefined {
  if (card.storyReason !== 'next' || !input.stories) return card.storyReason;
  const entry = input.stories.entries.find((e) => e.questId === card.questId);
  if (!entry) return card.storyReason;
  return storyStatus(entry, input.snapshot, input.stories.bookmarks).state === 'in-progress' ? 'continue' : 'next';
}

export function buildTodaysMission(input: BuildMissionInput): MissionPlan {
  const { profileId, snapshot, quests, episodes, today } = input;
  const capabilities = input.capabilities ?? DEFAULT_CAPABILITIES;

  // §3.2 — reuse today's existing slot targets so nothing shifts under the
  // learner; only completion state (and a story card's reason line) is refreshed.
  if (input.pinned && input.pinned.date === today && input.pinned.profileId === profileId) {
    return {
      ...input.pinned,
      cards: repinPlacedOut(input.pinned.cards, input).map((card) => {
        const refreshed: MissionCard = { ...card, collected: isCollected(card, snapshot, today, card.collected) };
        if (card.kind === 'story') refreshed.storyReason = refreshedReason(card, input);
        return refreshed;
      }),
    };
  }

  const used: Used = { quests: new Set(), episodes: new Set(), stories: new Set() };
  const cards: MissionCard[] = [];

  // ② New — the Journey cursor. Chosen first so slot ①'s story never repeats its quest.
  const upcoming = nextQuest(input);
  const second: MissionCard | null = upcoming ? newCard(upcoming, episodes) : null;
  if (upcoming) used.quests.add(upcoming.id);

  // ① continue story → replay → next story → again story → explore.
  const first = firstOf(SLOT_1_CHAIN, 1, input, used);
  if (first) {
    use(used, first, input);
    cards.push(first);
  }

  if (second) cards.push(second);

  // ③ Daily test when available, else next story → replay → again story → explore.
  if (capabilities.dailyTestAvailable) {
    cards.push({
      slot: 3,
      kind: 'daily-test',
      titleEn: null,
      subtitle: 'dailyTest',
      collected: false,
    });
  } else {
    const third = firstOf(SLOT_3_CHAIN, 3, input, used);
    if (third) cards.push(third);
  }

  return {
    date: today,
    profileId,
    cards: cards.map((card) => ({ ...card, collected: isCollected(card, snapshot, today, false) })),
  };
}

/** The two dictionary subtrees a card reads: `learner.home.mission` and `learner.storyShelf.home`. */
type MissionMessages = {
  home: Pick<Messages['learner']['home'], 'mission'>;
  storyShelf: Pick<Messages['learner']['storyShelf'], 'home'>;
};

/** A card's title and subtitle in the UI language (`m` is `messages.learner`). */
export function missionCardText(card: MissionCard, m: MissionMessages): { title: string; subtitle: string } {
  const mission = m.home.mission;
  const storyHome = m.storyShelf.home;
  const title = card.titleEn ?? mission.dailyTest.title;
  if (card.subtitle === 'explore') return { title, subtitle: storyHome.explore };
  if (card.subtitle === 'story' && card.storyReason) return { title, subtitle: storyHome.subtitle[card.storyReason] };
  return { title, subtitle: mission.subtitle[card.subtitle] };
}

/** Every learner-visible string in a plan — asserted against banned-text. */
export function missionCopy(plan: MissionPlan, m: MissionMessages): string[] {
  return plan.cards.flatMap((c) => {
    const { title, subtitle } = missionCardText(c, m);
    return [title, subtitle];
  });
}

export interface StoryCardShownEvent {
  name: 'home.story_card.shown';
  /** Ids and codes only (F-STORY-004 §3.11). */
  payload: { storyId: string; reason: StoryReason };
}

/**
 * `home.story_card.shown` for a plan's first story card (slot order), or null
 * when the plan has none. Home sends it once per profile and day, when the
 * plan is first pinned.
 */
export function storyCardShownEvent(plan: MissionPlan): StoryCardShownEvent | null {
  for (const card of plan.cards) {
    if (card.kind === 'story' && card.storyId && card.storyReason) {
      return { name: 'home.story_card.shown', payload: { storyId: card.storyId, reason: card.storyReason } };
    }
  }
  return null;
}
