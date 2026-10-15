import { Spacer, spacing } from '@hangul-route/design-system';
import React, { useEffect, useRef } from 'react';
import { Platform, ScrollView, View, type ViewStyle } from 'react-native';
import { stickyPromptMode } from '../../logic/layout/game-layout';
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
  /**
   * Side by side, keep the prompt column in view while a taller answer column scrolls (Realia
   * Read, D-2 D7: the realia stays readable beside long options). The web uses CSS sticky inside
   * the page's scroll. Native has no sticky, so each column scrolls on its own there and the
   * caller's `Screen` must not scroll in that arrangement (`scrollable={screenScrollsWithColumns(...)}`
   * with the same arguments), giving this view a bounded height to fill. Stacked windows are unchanged on every platform.
   */
  stickyPrompt?: boolean;
  /**
   * Native `columns` mode only (the other modes scroll with the page). `resetKey`: changes with the
   * round, and both columns go back to the top, so a new question never opens part-way down.
   * `feedbackKey`: set while feedback shows and changed with each new nudge; the prompt column
   * then scrolls to its end, so Hoya's line under a tall sheet comes into view beside the answers.
   */
  resetKey?: string;
  feedbackKey?: string;
}

/** CSS sticky: a react-native-web position value the native ViewStyle type does not list. */
const STICKY: ViewStyle = { position: 'sticky' as ViewStyle['position'], top: 0 };

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
 * survive. Only the feedback moves between the columns. The one exception is
 * `stickyPrompt` on native side by side, where each column becomes its own
 * scroll view (the caller's `Screen` stops scrolling too, so it remounts there
 * anyway); the game's state lives above this view and is kept.
 */
export function GameColumns({
  arrangement,
  prompt,
  answers,
  feedback = null,
  stackedGap = 'xl',
  stickyPrompt = false,
  resetKey,
  feedbackKey,
}: Props): React.ReactElement {
  const side = arrangement === 'side';
  const column = side ? { flex: 1, minWidth: 0 } : null;
  const mode = stickyPromptMode(arrangement, stickyPrompt, Platform.OS);
  const promptScroll = useRef<ScrollView | null>(null);
  const answersScroll = useRef<ScrollView | null>(null);
  // The feedback is laid out after this effect runs, so the scroll to it also runs once its size lands.
  const revealPending = useRef(false);

  useEffect(() => {
    if (mode !== 'columns') return;
    // A nudge whose size never changed leaves its reveal pending; the new round must not inherit it.
    revealPending.current = false;
    promptScroll.current?.scrollTo({ y: 0, animated: false });
    answersScroll.current?.scrollTo({ y: 0, animated: false });
  }, [mode, resetKey]);

  useEffect(() => {
    if (mode !== 'columns' || !feedbackKey) return;
    revealPending.current = true;
    promptScroll.current?.scrollToEnd({ animated: true });
  }, [mode, feedbackKey]);

  if (mode === 'columns') {
    // Native D7: the row fills the screen's height; the prompt column stays put (it scrolls only if
    // it is itself taller than the window) while the answers scroll beside it.
    return (
      <View style={{ flex: 1, flexDirection: 'row', gap: spacing.xl }} testID="game-columns-pinned">
        <ScrollView
          key="prompt"
          ref={promptScroll}
          style={{ flex: 1, minWidth: 0 }}
          testID="game-columns-prompt-scroll"
          onContentSizeChange={() => {
            if (!revealPending.current) return;
            revealPending.current = false;
            promptScroll.current?.scrollToEnd({ animated: true });
          }}
        >
          {prompt}
          {feedback}
        </ScrollView>
        <ScrollView key="answers" ref={answersScroll} style={{ flex: 1, minWidth: 0 }} testID="game-columns-answers-scroll">
          {answers}
        </ScrollView>
      </View>
    );
  }
  const sticky = mode === 'css' ? STICKY : null;
  return (
    <View style={side ? { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl } : null}>
      <View key="prompt" style={sticky ? [column, sticky] : column}>
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
