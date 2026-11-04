import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Keyboard, Platform, ScrollView, View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ViewStyle } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { ALL_SCREEN_EDGES, NO_INSETS, screenFrame } from '../../layout';
import { colors } from '../../tokens';
import { useLayoutClass } from '../Layout';
import { ScreenHeaderSlotContext } from '../ScreenHeader/slot';
import type { TapScrollerLike } from '../TapBoard/controller';
import { TapScrollerContext } from '../TapBoard/scroller';
import { ScreenFitContext, clampOffset, contentFits, nativeScrollEnabled, observeWebFit, type ScreenFit } from './fit';
import type { ScreenProps } from './types';

const toneBg = {
  canvas: colors.surface.canvas,
  paper: colors.surface.paper,
  sunken: colors.surface.sunken,
} as const;

/**
 * `touch-action: manipulation` on the web (docs/specs/AMENDMENTS-TOUCH.md KT-D3): no double-tap zoom and no click delay
 * on any screen, pinch zoom and panning kept. Not in the native style types; native gets nothing.
 */
const MANIPULATION = { touchAction: 'manipulation' } as unknown as ViewStyle;

export function Screen({
  children,
  scrollable = true,
  padded = true,
  tone = 'canvas',
  edges = ALL_SCREEN_EDGES,
  width = 'reading',
  footer,
  header,
  testID,
}: ScreenProps): ReactElement {
  // The nearest provider's context (modal screens get their own, navigation/with-own-safe-area),
  // not useSafeAreaInsets, so a missing SafeAreaProvider degrades
  // to plain padding instead of throwing.
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  // The surface's route-aware header (AMENDMENTS-DISPLAY-NAV section 7.1): first in the content, inside
  // the insets, the gutter and the width cap, on every state of the screen. None without a provider.
  const HeaderSlot = useContext(ScreenHeaderSlotContext);
  const { width: widthClass } = useLayoutClass();
  const hasFooter = footer !== undefined && footer !== null && footer !== false;
  // All the math (gutter, insets, cap, footer padding) is pure: layout.ts `screenFrame`.
  const frame = screenFrame({ width, widthClass, padded, insets, edges, hasFooter });
  const backgroundColor = toneBg[tone];

  // Whether the content fits (AMENDMENTS-TOUCH section 5): a fixed screen always does; a scrolling one is measured
  // again whenever its viewport or content changes (text size, rotation, content that grows). The web reads the DOM
  // (react-native-web's scroll node, so the screen adds no layout callback); native the layout and content size.
  const native = Platform.OS !== 'web';
  const manipulation = native ? {} : MANIPULATION;
  const [measuredFits, setMeasuredFits] = useState(false);
  const size = useRef({ viewport: 0, content: 0 });
  const offset = useRef(0);
  const scrollRef = useRef<unknown>(null);
  const listeners = useRef(new Set<(offset: number) => void>());
  const remeasure = useCallback(() => setMeasuredFits(contentFits(size.current.content, size.current.viewport)), []);
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      size.current.viewport = e.nativeEvent.layout.height;
      remeasure();
    },
    [remeasure],
  );
  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      size.current.content = h;
      remeasure();
    },
    [remeasure],
  );
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
    for (const listener of listeners.current) listener(offset.current);
  }, []);
  // A footer that comes or goes remounts the ScrollView (the root changes), so the fit is observed again on the new node.
  useEffect(() => {
    if (native || !scrollable) return undefined;
    const node = (scrollRef.current as { getScrollableNode?: () => unknown } | null)?.getScrollableNode?.();
    const Observer = (globalThis as { ResizeObserver?: Parameters<typeof observeWebFit>[2] }).ResizeObserver;
    return observeWebFit(node as Parameters<typeof observeWebFit>[0], setMeasuredFits, Observer) ?? undefined;
  }, [native, scrollable, hasFooter]);
  const fits = scrollable ? measuredFits : true;

  // The boards on this screen (native `scrollEnabled` is opt-in) and whether a text field has the keyboard.
  const [boards, setBoards] = useState(0);
  const registerBoard = useCallback(() => {
    setBoards((n) => n + 1);
    return () => setBoards((n) => n - 1);
  }, []);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!native) return undefined;
    const shown = Keyboard.addListener('keyboardDidShow', () => setTyping(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [native]);
  const fit = useMemo<ScreenFit>(() => ({ fits, registerBoard }), [fits, registerBoard]);

  // The scroller its boards drive (rule 5): the content follows a finger that started on an answer.
  const scroller = useMemo<TapScrollerLike>(
    () => ({
      axis: 'y',
      canScroll: scrollable && !fits,
      scrollBy: (delta) => {
        if (!native) {
          const node = (scrollRef.current as { getScrollableNode?: () => { scrollTop: number; scrollHeight: number; clientHeight: number } | null } | null)?.getScrollableNode?.();
          if (node === null || node === undefined) return offset.current;
          node.scrollTop = clampOffset(node.scrollTop, delta, node.scrollHeight, node.clientHeight);
          return node.scrollTop;
        }
        const to = clampOffset(offset.current, delta, size.current.content, size.current.viewport);
        (scrollRef.current as { scrollTo?: (o: { y: number; animated: boolean }) => void } | null)?.scrollTo?.({ y: to, animated: false });
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
    [scrollable, fits, native],
  );

  // The cap sits INSIDE the padded container so insets and gutter stay outside it
  // and the background stays full-bleed.
  const capped = { width: '100%', maxWidth: frame.maxWidth, alignSelf: 'center' } as const;
  // Scrolling content grows to at least the screen height (a bottom-pinned CTA stays put).
  // Fixed content must also SHRINK to the space it is given (`flex: 1`), as its children
  // did when they sat directly in the padded container: a measuring child (Trace) sizes itself from it.
  const content = (
    <View style={{ ...capped, ...(scrollable ? { flexGrow: 1 } : { flex: 1 }) }}>
      {HeaderSlot ? <HeaderSlot options={header} /> : null}
      {children}
    </View>
  );

  const body = scrollable ? (
    <ScrollView
      testID={hasFooter ? undefined : testID}
      style={{ flex: 1, backgroundColor, ...(hasFooter ? {} : manipulation) }}
      // flexGrow keeps short content full-height so bottom-pinned CTAs stay put.
      contentContainerStyle={{ flexGrow: 1, ...frame.body }}
      keyboardShouldPersistTaps="handled"
      ref={(v: unknown) => {
        scrollRef.current = v;
      }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      // Native: measured from the layout and the content size; a screen that fits and holds a board cannot scroll, so a
      // short drag on an answer never becomes a scroll (R6). The web scrolls as the browser decides.
      {...(native ? { onLayout, onContentSizeChange, scrollEnabled: nativeScrollEnabled(fits, boards, typing) } : {})}
    >
      {content}
    </ScrollView>
  ) : (
    <View testID={hasFooter ? undefined : testID} style={{ flex: 1, backgroundColor, ...frame.body, ...(hasFooter ? {} : manipulation) }}>
      {content}
    </View>
  );

  const framed = !hasFooter ? (
    body
  ) : (
    <View testID={testID} style={{ flex: 1, backgroundColor, ...manipulation }}>
      {body}
      <View style={frame.footer ?? undefined}>
        <View style={capped}>{footer}</View>
      </View>
    </View>
  );
  return (
    <ScreenFitContext.Provider value={fit}>
      <TapScrollerContext.Provider value={scrollable ? scroller : null}>{framed}</TapScrollerContext.Provider>
    </ScreenFitContext.Provider>
  );
}
