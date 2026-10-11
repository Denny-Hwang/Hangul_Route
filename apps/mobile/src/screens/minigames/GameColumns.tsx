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
 *
 * Both arrangements render the same tree (only styles change), so a rotation,
 * a Split View resize or a Chromebook window crossing the boundary does not
 * remount the prompt or the answers: focus, a running pulse and an open sheet
 * survive. Only the feedback moves between the columns.
 */
export function GameColumns({ arrangement, prompt, answers, feedback = null, stackedGap = 'xl' }: Props): React.ReactElement {
  const side = arrangement === 'side';
  const column = side ? { flex: 1, minWidth: 0 } : null;
  return (
    <View style={side ? { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl } : null}>
      <View key="prompt" style={column}>
        {prompt}
        {side ? feedback : null}
      </View>
      {side ? null : <Spacer key="gap" size={stackedGap} />}
      <View key="answers" style={column}>
        {answers}
        {side ? null : feedback}
      </View>
    </View>
  );
}
