import { clampOffset, type TapScrollerLike } from '@hangul-route/design-system';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

/**
 * A game's own ScrollView as a `TapScroller` (docs/specs/AMENDMENTS-TOUCH.md section 4.1, rule 5): the board inside it
 * drives this scroller, not the `Screen`'s, so a drag past `TAP_TRAVEL` that starts on an answer moves this content
 * along its axis (Hidden Heritage's horizontal scene in the narrow latch, section 6.6; Write Frame's sound panel). The
 * web moves the scroll node itself; native scrolls to an offset it keeps from `onScroll`, clamped to the content it
 * measured. Spread `props` on the ScrollView and pass `scroller` to `TapScroller`.
 */
export interface ScrollViewScroller {
  scroller: TapScrollerLike;
  props: {
    ref: (node: unknown) => void;
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle: number;
    onLayout: (e: LayoutChangeEvent) => void;
    onContentSizeChange: (w: number, h: number) => void;
  };
}

interface WebScrollNode {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}

export function useScrollViewScroller(axis: 'x' | 'y'): ScrollViewScroller {
  const node = useRef<unknown>(null);
  const offset = useRef(0);
  const listeners = useRef(new Set<(offset: number) => void>());
  const [size, setSize] = useState({ viewport: 0, content: 0 });
  const x = axis === 'x';

  const ref = useCallback((v: unknown) => {
    node.current = v;
  }, []);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = x ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y;
      for (const listener of listeners.current) listener(offset.current);
    },
    [x],
  );
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const viewport = x ? e.nativeEvent.layout.width : e.nativeEvent.layout.height;
      setSize((s) => (s.viewport === viewport ? s : { ...s, viewport }));
    },
    [x],
  );
  const onContentSizeChange = useCallback(
    (w: number, h: number) => {
      const content = x ? w : h;
      setSize((s) => (s.content === content ? s : { ...s, content }));
    },
    [x],
  );

  const canScroll = size.content > size.viewport + 1;
  const scroller = useMemo<TapScrollerLike>(
    () => ({
      axis,
      canScroll,
      scrollBy: (delta) => {
        if (Platform.OS === 'web') {
          const el = (node.current as { getScrollableNode?: () => WebScrollNode | null } | null)?.getScrollableNode?.();
          if (el === null || el === undefined) return offset.current;
          if (x) el.scrollLeft = clampOffset(el.scrollLeft, delta, el.scrollWidth, el.clientWidth);
          else el.scrollTop = clampOffset(el.scrollTop, delta, el.scrollHeight, el.clientHeight);
          return x ? el.scrollLeft : el.scrollTop;
        }
        const to = clampOffset(offset.current, delta, size.content, size.viewport);
        (node.current as { scrollTo?: (o: { x?: number; y?: number; animated: boolean }) => void } | null)?.scrollTo?.(x ? { x: to, animated: false } : { y: to, animated: false });
        offset.current = to;
        return to;
      },
      onScroll: (listener) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    [axis, canScroll, size.content, size.viewport, x],
  );

  return { scroller, props: { ref, onScroll, scrollEventThrottle: 16, onLayout, onContentSizeChange } };
}
