import { spacing } from '@hangul-route/design-system';
import { useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ScrollView } from 'react-native';

/** Room for the keyboard focus ring of a control at the column's edge, which the scroll container would clip. */
const FOCUS_RING_ROOM = spacing.xs;

/**
 * The controls under a trace canvas (Show me and Clear, Hoya's line, Done or Next, Skip) in Trace Stroke and Trace a
 * Word. AMENDMENTS-TRACE-IDLE TI-3b, owner decision OD-TI7 (design: wireframes/minigame/families.md "Trace Stroke
 * states", open item 3; screens/minigame-writing/mock/trace-stroke-text200.html): while a pass with Next shows
 * (`scrolls`), they scroll when large text makes them taller than the room the canvas leaves (320 x 568 at 200 %), and
 * they scroll to their end, where Next is; the rest of the time they are a plain column that never shrinks, as before.
 *
 * Always mounted, so the live region inside is never made again (a region made with its line is often not announced).
 * The content keeps room for a focus ring on every side, and negative margins of the same size keep the column's size
 * and place.
 */
export function TraceControls({ scrolls, testID, children }: { scrolls: boolean; testID: string; children: ReactNode }): ReactElement {
  const ref = useRef<ScrollView | null>(null);
  // Laid out shorter than its content, or its content grew, while Next shows: Next comes into view.
  const reveal = (): void => {
    if (scrolls) ref.current?.scrollToEnd({ animated: false });
  };
  return (
    <ScrollView
      ref={ref}
      testID={testID}
      scrollEnabled={scrolls}
      style={{ flexGrow: 0, flexShrink: scrolls ? 1 : 0, margin: -FOCUS_RING_ROOM }}
      contentContainerStyle={{ gap: spacing.sm, padding: FOCUS_RING_ROOM }}
      onLayout={reveal}
      onContentSizeChange={reveal}
    >
      {children}
    </ScrollView>
  );
}
