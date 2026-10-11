import { Spacer, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import type { GameArrangement } from '../../logic/layout/game-layout';

interface Props {
  /** From `gameArrangement` / `pictureTextArrangement` (logic/layout/game-layout). */
  arrangement: GameArrangement;
  /** The question: heading, sound or picture, prompt text. */
  prompt: React.ReactNode;
  /** The tiles, cards or answer buttons. */
  answers: React.ReactNode;
  /** Hoya's feedback after a miss: under the prompt beside the answers, or under the answers when stacked. */
  feedback?: React.ReactNode;
  /** Space between the prompt and the answers when stacked (the game's phone layout). */
  stackedGap?: 'md' | 'lg' | 'xl';
}

/**
 * A game's prompt and its answers, stacked (the phone layout, unchanged) or side
 * by side with the prompt on the left (F-LAYOUT-001 §3.6, wireframe
 * `design/wireframes/layout/wide.md` A: "controls beside the content"). The two
 * columns share the width and are top-aligned: Hoya's feedback grows the prompt
 * column, and the answers must not move under the learner's finger when it does.
 */
export function GameColumns({ arrangement, prompt, answers, feedback = null, stackedGap = 'xl' }: Props): React.ReactElement {
  if (arrangement === 'side') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {prompt}
          {feedback}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>{answers}</View>
      </View>
    );
  }
  return (
    <>
      {prompt}
      <Spacer size={stackedGap} />
      {answers}
      {feedback}
    </>
  );
}
