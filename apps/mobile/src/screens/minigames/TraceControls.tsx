import { borderWidth, motion, spacing } from '@hangul-route/design-system';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Platform, ScrollView } from 'react-native';
import { announceForScreenReader } from '../../platform/screen-reader';

/**
 * AMENDMENTS-TRACE-IDLE TI-3b (owner decisions 2026-11-23): the controls under a trace canvas, and how a tip that waits
 * for Next is said, shared by Trace Stroke and Trace a Word. Design: wireframes/minigame/families.md "Trace Stroke
 * states" (decisions 1 and 5, open item 3); screens/minigame-writing/mock/trace-stroke-text200.html.
 */

/** Room for a control's focus ring (`borderWidth.thick` drawn `spacing.xxs` outside it) at the column's edge. */
const FOCUS_RING_ROOM = borderWidth.thick + spacing.xxs;

/**
 * The flexShrink of the prompt (or word) scroll above the controls in the side layout. Flex shares a squeeze by
 * flexShrink x size, so with this weight the prompt gives up its height before the scrolling controls give up any,
 * and the button row stays where it was while a tip shows.
 */
export const GIVES_WAY_FIRST = 1000;

/** How long after Next takes focus the tip enters the live region: the focus move is said first and never cuts it off. */
export const TIP_AFTER_FOCUS_MS = motion.duration.slow;

/**
 * The controls (Show me and Clear, Hoya's line, Done or Next, Skip). OD-TI7: while a pass with Next shows (`scrolls`),
 * they scroll when large text makes them taller than the room the canvas leaves (320 x 568 at 200 %), and they scroll
 * to their end, where Next is; the rest of the time they are a column that never shrinks, as before, and they scroll
 * back to the top. On the web scrolling is never switched off: react-native-web's switch also blocks pinch-zoom on the
 * controls, and a column that never shrinks has nothing to scroll.
 *
 * Always mounted, so the live region inside is never made again (a region made with its line is often not announced).
 * The content keeps room for a focus ring on every side; negative margins of the same size keep the column's size and
 * place.
 */
export function TraceControls({ scrolls, testID, children }: { scrolls: boolean; testID: string; children: ReactNode }): ReactElement {
  const ref = useRef<ScrollView | null>(null);
  const scrolled = useRef(false);
  // Laid out shorter than its content, or its content grew, while Next shows: Next comes into view.
  const reveal = (): void => {
    if (!scrolls) return;
    ref.current?.scrollToEnd({ animated: false });
    ref.current?.flashScrollIndicators();
  };
  // Next is gone: back to the top, so Show me and Clear are not left scrolled away where scrolling is off.
  useEffect(() => {
    if (scrolled.current && !scrolls) ref.current?.scrollTo({ y: 0, animated: false });
    scrolled.current = scrolls;
  }, [scrolls]);
  return (
    <ScrollView
      ref={ref}
      testID={testID}
      scrollEnabled={scrolls || Platform.OS === 'web'}
      style={{ flexGrow: 0, flexShrink: scrolls ? 1 : 0, margin: -FOCUS_RING_ROOM }}
      contentContainerStyle={{ gap: spacing.sm, padding: FOCUS_RING_ROOM }}
      onLayout={reveal}
      onContentSizeChange={reveal}
    >
      {children}
    </ScrollView>
  );
}

/**
 * A tip that waits for Next is said once (TI-3b), after Next takes focus (wireframe decision 1), so the focus move
 * never cuts it off: as the tip shows, Next takes focus (`focusNext`); `TIP_AFTER_FOCUS_MS` later the tip enters the
 * live region (the web, Android) and VoiceOver is told (iOS has no live regions). Next carries no hint repeating it.
 * Returns whether the tip is in the live region yet; until then the line shows outside it, unsaid.
 */
export function useTipAfterFocus(tip: string | null, focusNext: () => void): boolean {
  const [said, setSaid] = useState<string | null>(null);
  const focusRef = useRef(focusNext);
  focusRef.current = focusNext;
  useEffect(() => {
    if (tip === null) {
      setSaid(null);
      return undefined;
    }
    focusRef.current();
    const timer = setTimeout(() => {
      setSaid(tip);
      announceForScreenReader(tip);
    }, TIP_AFTER_FOCUS_MS);
    return () => clearTimeout(timer);
  }, [tip]);
  return tip !== null && said === tip;
}
