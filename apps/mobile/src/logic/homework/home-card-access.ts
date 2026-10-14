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

/**
 * Whether a Home card shows the locked look (F-STORY-004 PR 4.8f): exactly when a tap would take the
 * locked path of `homeCardLock`, so the tile never looks open and then lands on the gate, and never
 * looks closed and then opens. The gate's route plays no part in the look. False while gating is off.
 */
export function isHomeCardLocked(input: Omit<HomeCardAccessInput, 'opensDirectly'>): boolean {
  return homeCardLock({ ...input, opensDirectly: false }) !== null;
}

export interface HomeTileLookInput {
  /** The card was collected today (F-HW-001 section 3.2). */
  collected: boolean;
  /** `isHomeCardLocked` for the card. */
  locked: boolean;
  /** The card's own label (`a11y.missionCard`). */
  label: string;
  /** `learner.home.lockedCard.a11y`: the label with the Not open yet word. */
  lockedLabel: (label: string) => string;
  /** The ask (`askFor(...).label`), the hint of a tap that opens the grown-up gate. */
  askHint: string;
}

export interface HomeTileLook {
  tone: 'paper' | 'success' | 'sunken';
  /** The dotted ring and the Not open yet word under the card's line. */
  notOpen: boolean;
  /** The collected sparkle. */
  sparkle: boolean;
  accessibilityLabel: string;
  accessibilityHint: string | undefined;
}

/**
 * What a Home mission tile draws (F-STORY-004 PR 4.8f). Collected wins the look: a card the learner
 * finished today keeps the collected tone, sparkle and label (F-HW-001 section 3.2) and never reads
 * "Not open yet", even when its story or quest has closed since; a tap still takes the locked path
 * (`homeCardLock`), so its hint is the ask. A locked card not collected takes the sunken tone, the
 * dotted ring and the Not open yet word, in its label too, with the ask as its hint.
 */
export function homeTileLook(input: HomeTileLookInput): HomeTileLook {
  const hint = input.locked ? input.askHint : undefined;
  if (input.collected) {
    return { tone: 'success', notOpen: false, sparkle: true, accessibilityLabel: input.label, accessibilityHint: hint };
  }
  if (input.locked) {
    return { tone: 'sunken', notOpen: true, sparkle: false, accessibilityLabel: input.lockedLabel(input.label), accessibilityHint: hint };
  }
  return { tone: 'paper', notOpen: false, sparkle: false, accessibilityLabel: input.label, accessibilityHint: undefined };
}
