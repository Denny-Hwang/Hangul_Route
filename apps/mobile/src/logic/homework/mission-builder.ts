import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { PracticeTarget } from '../free-end';
import { nextQuestAfter, offerableQuests, playableEpisodes } from '../next-quest';
import { inAPlan, routeNext, type RouteNextInput } from '../route-next';
import type { BookmarkFile } from '../story/bookmarks';
import { entryForQuest, type StoryIndexEntry } from '../story/story-index';
import { planOpenStory, type OpenStoryMode, type OpenStoryPlan } from '../story/open-story';
import { pickStoryForHome, type StoryPick, type StoryReason } from '../story/story-pick';
import { storyStatus, type StoryStatus } from '../story/story-status';

/**
 * Today's mission — F-HW-001 §3.1, §3.2, with the story card of F-STORY-004 §3.7.
 *
 * Exactly three cards, in fixed slot order, each the first card its chain finds:
 *   ① continue story → best replay → next story → again story → explore
 *   ② New — the one next quest (`routeNext`, F-ENT-003 section 3.5) when the
 *     caller gives `route`, else the Journey cursor (grid episodes only)
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

/**
 * `free-end` and `practice` are card (2) at the end of the free lessons (F-ENT-003 section 3.7):
 * the celebration once per profile and device, then the practice card.
 */
export type MissionCardKind = 'replay' | 'new' | 'daily-test' | 'story' | 'explore' | 'free-end' | 'practice';

/**
 * Keys of `learner.home.mission.subtitle`, plus `explore`, whose words are
 * `learner.storyShelf.home.explore`, and `nextInPlan`, whose words are
 * `learner.routeNext.home.subtitle` (F-ENT-003 section 3.7). A `story` card
 * with a `storyReason` reads `learner.storyShelf.home.subtitle[storyReason]`
 * (`missionCardText`).
 */
export type MissionSubtitle = 'replay' | 'story' | 'new' | 'assigned' | 'dailyTest' | 'explore' | 'nextInPlan' | 'freeEnd' | 'practice';

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
  /** Practice card only: what it opens (a free word topic, a sampler story or a kept replay). */
  practiceKind?: PracticeTarget['kind'];
  /** Practice card of a word topic: the topic it opens ("Food words"). */
  topicKey?: string;
  /** The free-end card only: the learner tested out of the free letters (`routeNext` `placedOut`). */
  placedOut?: boolean;
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
   * May the learner start this quest (`cursorContext` from `useQuestAccess`,
   * F-ENT-003 section 3.6)? The cursor, replays (a finished quest is kept, so a
   * replay always stays) and the explore episode (one open quest at least) are
   * chosen among open quests; story cards follow `stories.isLocked`, which Home
   * builds with `storyLockFor` and the same predicate. Omitted means every
   * quest is open.
   */
  isQuestOpen?: (questId: string) => boolean;
  /**
   * The one next (F-ENT-003 section 3.5, `routeNextInputOf` on the same
   * snapshot, profile and day): card (2) is its quest, "Next in your plan"
   * when it comes from a plan and "New" from the default route; at `rest`
   * (and at `free-end` without `freeEnd`) today's replay fallback stays.
   * Omitted means the bare cursor, as before E3-4.
   */
  route?: RouteNextInput;
  /**
   * The story card's world (F-STORY-004 §3.7): the story index, the profile's
   * bookmarks, the lock (`storyLockFor`, with `isQuestOpen` for book stories) and the fit (`storyFitsFor`,
   * F-STORY-005 §3.4: fitting stories come first among `next`; it only
   * orders). Absent → no story cards.
   */
  stories?: {
    entries: readonly StoryIndexEntry[];
    bookmarks: BookmarkFile;
    isLocked: (entry: StoryIndexEntry) => boolean;
    fits?: (entry: StoryIndexEntry) => boolean;
  };
  /**
   * The end of the free lessons (F-ENT-003 section 3.7, E3-7): when `route` says `free-end`,
   * card (2) is the celebration while `seen` is false (`free-end-seen:<profileId>`), then the
   * practice card (`practiceTarget`). Omitted keeps today's replay fallback at `free-end`.
   */
  freeEnd?: { seen: boolean; practice: PracticeTarget | null };
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
function nextQuest(input: BuildMissionInput): { quest: Quest; subtitle: 'new' | 'nextInPlan' } | undefined {
  const { snapshot, quests, episodes, skipQuestIds, isEntitled, isQuestOpen } = input;
  const offerable = offerableQuests(quests, episodes, isEntitled, isQuestOpen);
  if (input.route) {
    const next = routeNext(input.route);
    const quest = next.kind === 'quest' ? quests.find((q) => q.id === next.questId) : undefined;
    if (next.kind === 'quest' && quest) return { quest, subtitle: next.source === 'cursor' ? 'new' : 'nextInPlan' };
    const last = offerable[offerable.length - 1];
    return last ? { quest: last, subtitle: 'new' } : undefined;
  }
  // A placed-out quest never played comes before a replay of the last quest.
  const quest =
    nextQuestAfter({ snapshot, quests, episodes, isEntitled, isQuestOpen, skipQuestIds }) ??
    (skipQuestIds === undefined ? undefined : nextQuestAfter({ snapshot, quests, episodes, isEntitled, isQuestOpen })) ??
    offerable[offerable.length - 1];
  return quest ? { quest, subtitle: 'new' } : undefined;
}

/** `input.isQuestOpen`, or every quest open when the caller gave none. */
function isOpen(input: BuildMissionInput, questId: string): boolean {
  return !input.isQuestOpen || input.isQuestOpen(questId);
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
      fits: input.stories.fits,
      excludeStoryIds: [...used.stories],
      excludeQuestIds: [...used.quests],
      reasons,
    });
    return pick ? storyCard(slot, pick) : null;
  };
}

/** The best replay not on the plan yet (grid quests only; open ones, and a finished quest is kept, so open). */
const replayLink: Link = (slot, input, used) => {
  const { snapshot, quests, episodes, today } = input;
  for (const candidate of replayCandidates(snapshot, episodes, today)) {
    if (used.quests.has(candidate.questId) || !isOpen(input, candidate.questId)) continue;
    const quest = quests.find((q) => q.id === candidate.questId);
    if (!quest) continue;
    return replayCard(slot, quest, episodeOfQuest(episodes, quest.id)?.id);
  }
  return null;
};

/** The first playable grid episode not on the plan yet, with at least one open quest. */
const exploreLink: Link = (slot, input, used) => {
  const episode = playableEpisodes(input.episodes).find((e) => !used.episodes.has(e.id) && e.questIds.some((id) => isOpen(input, id)));
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

function newCard(quest: Quest, episodes: readonly Episode[], subtitle: 'new' | 'nextInPlan' = 'new'): MissionCard {
  return {
    slot: 2,
    kind: 'new',
    titleEn: quest.titleEn,
    subtitle,
    questId: quest.id,
    episodeId: episodeOfQuest(episodes, quest.id)?.id,
    collected: false,
  };
}

/** The practice card (F-ENT-003 section 3.7): a free word topic, a sampler story or a kept replay, "Keep practicing". */
function practiceCard(target: PracticeTarget): MissionCard {
  const card: MissionCard = { slot: 2, kind: 'practice', titleEn: target.title, subtitle: 'practice', practiceKind: target.kind, collected: false };
  if (target.kind === 'topic') return { ...card, topicKey: target.topicKey };
  if (target.kind === 'story') return { ...card, storyId: target.storyId, questId: target.questId, episodeId: target.episodeId };
  return { ...card, questId: target.questId, episodeId: target.episodeId };
}

/** Card (2) at the end of the free lessons: the celebration once, then the practice card; null when not at `free-end`. */
function freeEndCard(input: BuildMissionInput): MissionCard | null {
  if (!input.route || !input.freeEnd) return null;
  const next = routeNext(input.route);
  if (next.kind !== 'free-end') return null;
  if (!input.freeEnd.seen) return { slot: 2, kind: 'free-end', titleEn: null, subtitle: 'freeEnd', placedOut: next.placedOut, collected: false };
  return input.freeEnd.practice ? practiceCard(input.freeEnd.practice) : null;
}

/** Card (2): the free-end or practice card at `free-end`, else the one next (or today's replay fallback). */
function secondCard(input: BuildMissionInput): MissionCard | null {
  const end = freeEndCard(input);
  if (end) return end;
  const upcoming = nextQuest(input);
  return upcoming ? newCard(upcoming.quest, input.episodes, upcoming.subtitle) : null;
}

/**
 * The end of the free lessons under the day pin: a pinned celebration gives way to the practice
 * card once it was seen, and a pinned celebration or practice card gives way to the one next once
 * something opens (the learner became premium). The practice card's own target stays all day.
 */
function repinFreeEnd(cards: readonly MissionCard[], input: BuildMissionInput): readonly MissionCard[] {
  const pinned = cards.find((card) => card.slot === 2 && (card.kind === 'free-end' || card.kind === 'practice'));
  if (!pinned || !input.route) return cards;
  const fresh = secondCard(input);
  if (!fresh || fresh.kind === pinned.kind) return cards;
  return cards.map((card) => (card === pinned ? fresh : card));
}

/**
 * The exceptions to the day pin (F-ROUTE-001 R-4a, section 3.5; F-ENT-003
 * section 3.6): when a level check places out the quest pinned on the "New"
 * card, or that quest is no longer open (the access tier changed after the
 * pin), and the learner has not played it today, card (2) moves to the
 * cursor, so Home names the same next quest as Results and My route. Cards (1)
 * and (3) move only when they close (`repinClosed`), and the pin stays when the
 * cursor has nothing else to offer.
 */
function repinPlacedOut(cards: readonly MissionCard[], input: BuildMissionInput): readonly MissionCard[] {
  const skip = input.skipQuestIds;
  // Only the system "New" card re-pins; a caregiver or teacher assignment
  // (`subtitle: 'assigned'`, `mergeAssignments`) keeps its slot.
  const pinnedNew = cards.find((card) => card.slot === 2 && card.kind === 'new' && (card.subtitle === 'new' || card.subtitle === 'nextInPlan'));
  if (!pinnedNew?.questId) return cards;
  const placedOut = skip?.has(pinnedNew.questId) ?? false;
  if (!placedOut && isOpen(input, pinnedNew.questId)) return cards;
  if (completedToday(input.snapshot, pinnedNew.questId, input.today)) return cards;
  const upcoming = nextQuest(input);
  // `nextQuest` offers open quests only, so the new card is open too.
  if (!upcoming || skip?.has(upcoming.quest.id) || cards.some((card) => card.questId === upcoming.quest.id)) return cards;
  return cards.map((card) => (card === pinnedNew ? newCard(upcoming.quest, input.episodes, upcoming.subtitle) : card));
}

/** Records a card on the plan; a replay of a book story quest also takes its story. */
function use(used: Used, card: MissionCard, input: BuildMissionInput): void {
  if (card.questId) used.quests.add(card.questId);
  if (card.episodeId) used.episodes.add(card.episodeId);
  const storyId = card.storyId ?? input.stories?.entries.find((e) => e.questId === card.questId)?.storyId;
  if (storyId) used.stories.add(storyId);
}

/**
 * Is a pinned slot (1) or (3) card closed now (F-STORY-004 PR 4.8d)? A story
 * card follows `stories.isLocked`, a replay `input.isQuestOpen`, an explore
 * card needs one open quest in its episode, as their chain links do. A story
 * card whose entry this build cannot find (it left the index, or there is no
 * story world) falls back to `input.isQuestOpen` for its quest. A card with
 * nothing to judge (no quest, an episode gone from the content) and the daily
 * test stay open.
 */
function isClosed(card: MissionCard, input: BuildMissionInput): boolean {
  if (card.kind === 'story') {
    const stories = input.stories;
    const entry = stories?.entries.find((e) => e.questId === card.questId);
    if (stories !== undefined && entry !== undefined) return stories.isLocked(entry);
  }
  if (card.kind === 'story' || card.kind === 'replay') return card.questId !== undefined && !isOpen(input, card.questId);
  if (card.kind === 'explore') {
    const episode = input.episodes.find((e) => e.id === card.episodeId);
    return episode !== undefined && !episode.questIds.some((id) => isOpen(input, id));
  }
  return false;
}

/**
 * The access exception for cards (1) and (3) (F-STORY-004 PR 4.8d, F-ENT-003
 * section 3.6): the pin lasts the app session day (PR 4.8c), so when access
 * drops after the pin (a plan lapses, a space or inbox change), a slot (1) or
 * (3) card the learner has not collected today and can no longer open takes
 * the first open card of its own chain instead, never one the other cards
 * hold. A collected card stays, and so does a closed card whose chain has
 * nothing open to offer. Nothing is closed while gating is off, so the pin
 * comes back as built.
 */
function repinClosed(cards: readonly MissionCard[], input: BuildMissionInput): readonly MissionCard[] {
  const next = [...cards];
  next.forEach((card, index) => {
    if (card.slot === 2 || !isClosed(card, input)) return;
    if (isCollected(card, input.snapshot, input.today, card.collected)) return;
    const used: Used = { quests: new Set(), episodes: new Set(), stories: new Set() };
    // As in a fresh build: card (2) takes its quest and story, not its episode.
    for (const other of next) if (other !== card) use(used, other.slot === 2 ? { ...other, episodeId: undefined } : other, input);
    const replacement = firstOf(card.slot === 1 ? SLOT_1_CHAIN : SLOT_3_CHAIN, card.slot, input, used);
    if (replacement) next[index] = replacement;
  });
  return next;
}

/** An `again` card opens the unscored reader, so it is never collected (§3.7). */
function isCollected(card: MissionCard, snapshot: ProgressSnapshot, today: string, fallback: boolean): boolean {
  if (card.storyMode === 'replay') return false;
  return card.questId ? completedToday(snapshot, card.questId, today) : fallback;
}

/**
 * A pinned story card keeps its story all day; only its reason line may
 * refresh from the story's status: a `next` story the learner left mid-way
 * now reads "Keep reading", and a "Keep reading" story finished today (or
 * whose bookmark is gone) reads "A short story" again, like a collected
 * `next` card. An `again` card keeps its reason.
 */
function refreshedReason(card: MissionCard, input: BuildMissionInput): StoryReason | undefined {
  if (card.storyReason === 'again' || !input.stories) return card.storyReason;
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
      cards: repinClosed(repinFreeEnd(repinPlacedOut(input.pinned.cards, input), input), input).map((card) => {
        const refreshed: MissionCard = { ...card, collected: isCollected(card, snapshot, today, card.collected) };
        if (card.kind === 'story') refreshed.storyReason = refreshedReason(card, input);
        // A plan removed after the pin (unpublished, or the own plan archived): the quest stays, "Next in your plan" goes.
        if (card.subtitle === 'nextInPlan' && card.questId && input.route && !inAPlan(input.route, card.questId)) refreshed.subtitle = 'new';
        return refreshed;
      }),
    };
  }

  const used: Used = { quests: new Set(), episodes: new Set(), stories: new Set() };
  const cards: MissionCard[] = [];

  // ② New — the one next (or, at the end of the free lessons, the celebration or the practice card).
  // Chosen first so slot ①'s story never repeats its quest.
  const second = secondCard(input);
  // It takes its quest and, for a book story quest, its story, so no other card offers that story. Not its
  // episode: the explore card may still name the learner's current episode, so the row keeps three cards.
  if (second) use(used, { ...second, episodeId: undefined }, input);

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

/** The dictionary subtrees a card reads: `learner.home.mission`, `learner.storyShelf.home`, `learner.routeNext.home` and `learner.access`. */
type MissionMessages = {
  home: Pick<Messages['learner']['home'], 'mission'>;
  storyShelf: Pick<Messages['learner']['storyShelf'], 'home'>;
  routeNext: Pick<Messages['learner']['routeNext'], 'home'>;
  access: Pick<Messages['learner']['access'], 'freeEnd' | 'openForYou' | 'practice'>;
};

/** A card's title and subtitle in the UI language (`m` is `messages.learner`). */
export function missionCardText(card: MissionCard, m: MissionMessages): { title: string; subtitle: string } {
  const mission = m.home.mission;
  const storyHome = m.storyShelf.home;
  if (card.subtitle === 'freeEnd') return { title: m.access.freeEnd.title, subtitle: m.access.openForYou };
  if (card.subtitle === 'practice') {
    const name = card.titleEn ?? '';
    return { title: card.practiceKind === 'topic' ? m.access.practice.topicTitle(name) : name, subtitle: m.access.practice.subtitle };
  }
  const title = card.titleEn ?? mission.dailyTest.title;
  if (card.subtitle === 'explore') return { title, subtitle: storyHome.explore };
  if (card.subtitle === 'nextInPlan') return { title, subtitle: m.routeNext.home.subtitle };
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

/**
 * How a tapped story card opens (`planOpenStory` mode): an `again` card reads
 * the story again unscored; otherwise the story's current status decides —
 * finished plays again (scored, as any collected card), a bookmark at its
 * level continues, else it starts.
 */
export function storyCardOpenMode(card: Pick<MissionCard, 'storyMode'>, status: Pick<StoryStatus, 'state'>): OpenStoryMode {
  if (card.storyMode === 'replay') return 'read-again';
  if (status.state === 'finished') return 'play-again';
  return status.state === 'in-progress' ? 'continue' : 'start';
}

/**
 * How Home opens a tapped story card (F-STORY-004 §3.2, §3.7): the one
 * story-open plan for its entry, or null when the card is not a story in the
 * index (Home then opens it as a quest card). "Keep reading" opens as a
 * `continue` with the `QuestPlayer` `resume` param (PR 4.4b), or as a plain
 * `start` when the bookmark is gone (`planOpenStory`).
 */
export function planHomeStoryOpen(input: {
  card: MissionCard;
  entries: readonly StoryIndexEntry[];
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined;
  bookmarks: BookmarkFile;
}): OpenStoryPlan | null {
  const { card } = input;
  const entry = card.kind === 'story' && card.questId ? entryForQuest(input.entries, card.questId) : undefined;
  if (!entry) return null;
  const status = storyStatus(entry, input.snapshot, input.bookmarks);
  return planOpenStory({ entry, status, source: 'home', mode: storyCardOpenMode(card, status) });
}
