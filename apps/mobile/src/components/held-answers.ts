import type { ViewStyle } from 'react-native';

/**
 * Answers that are not shown yet (`!slot.settled`, see `use-prompt-slot.ts`): not drawn at all, so they first show in
 * the place they keep and never move under a finger when "No sound? Read it here." comes in above them
 * (AMENDMENTS-TOUCH). The answer areas on a `TapBoard` use its `held` prop instead.
 */
export const HELD_ANSWERS: ViewStyle = { display: 'none' };

export function heldAnswers(held: boolean): ViewStyle | undefined {
  return held ? HELD_ANSWERS : undefined;
}
