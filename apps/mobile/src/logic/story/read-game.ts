import type { Story, StoryLevel } from '@hangul-route/content-schema';
import { storyById } from '../../content/stories';
import type { MinigameScope } from '../minigame-config';

/**
 * The quest host of the story reader, `StoryReadGame` (F-STORY-002 §3.1,
 * §3.3, §3.6; PR 2.6b). The component only wires these to the stores and the
 * navigator; the rules live here so they are unit tested.
 */

export interface ReadGameTarget {
  /** Undefined (unknown id or a scope without a story) makes the reader show its one-line fallback. */
  story: Story | undefined;
  level: StoryLevel;
}

/**
 * The story and level a `story-read` step plays. `storyScopeFor` already sends
 * a ref with an unknown story or level to "Minigame not found."; anything that
 * still slips through reaches the reader's fallback, whose Continue completes
 * the step so a content error never traps a quest (§3.3).
 */
export function readGameTarget(
  scope: Pick<MinigameScope, 'story'>,
  find: (id: string) => Story | undefined = storyById,
): ReadGameTarget {
  if (!scope.story) return { story: undefined, level: 'listen' };
  return { story: find(scope.story.storyId), level: scope.story.level };
}

export interface ReadGameDeps {
  /** The bookmark seam (`useReaderBookmark().save`). */
  saveBookmark: (index: number) => void;
  /** `useQuestRunStore.answerRound` (checkpoint rounds, `cp:<id>`). */
  answerRound: (roundKey: string, correct: boolean) => void;
  /** `useQuestRunStore.markStepComplete`. */
  markStepComplete: () => void;
  /** The shell's close: `minigame.finished`, then back to the quest step. */
  finish: () => void;
  /** Back to the quest step, the step left not complete. */
  back: () => void;
}

export interface ReadGameHandlers {
  onSceneChange: (index: number) => void;
  onAnswer: (roundKey: string, correct: boolean) => void;
  onFinish: () => void;
  onClose: () => void;
}

/**
 * The reader's callbacks in quest mode. The reader itself decides when to
 * save a bookmark (quest mode, scene 2 on: `planSceneChange`) and reports
 * answers only in quest mode; this host passes them on.
 *
 * - Continue (end page, or the fallback) marks the step complete, then
 *   finishes: the quest player advances when it regains focus.
 * - Close and the back gesture go back with the step not complete: reading
 *   records no score, so nothing is lost and there is no confirm (§3.3).
 */
export function readGameHandlers(deps: ReadGameDeps): ReadGameHandlers {
  return {
    onSceneChange: (index) => deps.saveBookmark(index),
    onAnswer: (roundKey, correct) => deps.answerRound(roundKey, correct),
    onFinish: () => {
      deps.markStepComplete();
      deps.finish();
    },
    onClose: () => deps.back(),
  };
}
