import { askGate, type AskGate } from '../access-copy';
import { entryForQuest, type StoryIndexEntry } from '../story/story-index';
import type { MissionCard } from './mission-builder';

export interface HomeCardAccessInput {
  card: MissionCard;
  /** The story index Home opens story cards through (`planHomeStoryOpen`). */
  entries: readonly StoryIndexEntry[];
  /** `useQuestAccess` (F-ENT-003 section 3.6). */
  isQuestOpen: (questId: string) => boolean;
  /** `storyLockFor`, the same predicate the story card was picked with. */
  isStoryLocked: (entry: StoryIndexEntry) => boolean;
  /** A self-only device with no PIN, or an open grown-up session (`gateOpensDirectlyNow`). */
  opensDirectly: boolean;
}

export interface HomeCardLock {
  /** The grown-up gate: PIN entry then the Plan screen, or the Plan screen directly. */
  gate: AskGate;
  /** The locked story, for `story.locked.tapped`; null for a quest card. */
  storyId: string | null;
}

/**
 * The tap-time access check for a Home card (F-STORY-004 PR 4.8e). The pin
 * lasts the app session day (PR 4.8c) and a closed slot (1) or (3) card whose
 * chain has nothing open stays (PR 4.8d), so a tap checks access again: a
 * story card in the index whose story is locked, or a quest card whose quest
 * closed, goes to the locked path, never to `QuestPlayer` or `StoryReader`.
 * A story in the index is judged by `storyLockFor` alone (it already asks
 * `isQuestOpen` for a grid book), the one rule the Library tile and the
 * mission builder (`isClosed`, PR 4.8d) follow. A story card that left the
 * index is judged by its quest, as Home then opens it as a quest card. Cards that open neither
 * (explore, a word topic, the daily test, the free-end card) return null.
 * Nothing is closed or locked while gating is off, so this returns null then.
 */
export function homeCardLock(input: HomeCardAccessInput): HomeCardLock | null {
  const { card } = input;
  const locked = (storyId: string | null): HomeCardLock => ({ gate: askGate(input.opensDirectly, 'home'), storyId });
  if (card.kind === 'story' && card.questId) {
    const entry = entryForQuest(input.entries, card.questId);
    if (entry) return input.isStoryLocked(entry) ? locked(entry.storyId) : null;
  }
  if (card.kind === 'practice' && card.topicKey) return null;
  if (card.questId && card.episodeId && !input.isQuestOpen(card.questId)) return locked(null);
  return null;
}
