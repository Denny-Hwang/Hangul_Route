import { storyOrderToSequence, type StoryOrderRound } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';

/**
 * The start-bundle side of Story Order (F-CURR-002 §7.1 F5, §12.2, row CM-34): its switch, the rounds a
 * scope can play, and the Story Sequence scopes those rounds render as while the switch is off. The game
 * itself (`story-order-player.ts`, `StoryOrderGame`) is a screen chunk of its own.
 */

/** Built-in pct 0 (`CURR_KEYED_BUILT_IN_PCT`): the game merges dark and every round plays its fallback. */
export const STORY_ORDER_FLAG = 'game.story-order';

/** A round needs three panels to put in order; a scope with none is the empty state (Continue). */
export function playableStoryOrder(scope: MinigameScope): StoryOrderRound[] {
  return (scope.storyOrder?.rounds ?? []).filter((r) => r.panels.length >= 3);
}

/**
 * Each round as the shipped Story Sequence plays it while `game.story-order` is off (board O3): the same lines
 * as text cards (Story Sequence draws story scene art only, never a panel's card or word picture), each card's
 * gloss as its caption, the same slots and replay. One sequence per round, in order.
 */
export function storyOrderFallbackScopes(scope: MinigameScope): MinigameScope[] {
  return playableStoryOrder(scope).map((round) => ({
    kind: 'story-sequence',
    rounds: 1,
    storySteps: storyOrderToSequence(round).steps.map(({ id, labelEn, labelKo, romanization }) => ({ id, labelEn, labelKo, romanization })),
  }));
}

/** The fallback's slot keys for round `roundId`: the game's own keys (`so:<round>:<slot>`), so two rounds never share one. */
export const storyOrderKeyPrefix = (roundId: string): string => `so:${roundId}:`;
