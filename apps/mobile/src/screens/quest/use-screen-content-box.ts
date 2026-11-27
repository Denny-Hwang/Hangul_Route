import { ALL_SCREEN_EDGES, NO_INSETS, screenFrame, useLayoutClass } from '@hangul-route/design-system';
import { useContext, useMemo } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { ScreenReserveContext } from '../../components/screen-reserve';

/**
 * [TC] The Screen content box of a window (AMENDMENTS-STAGE1-TRACE-COVERAGE §3.4): the window less the gutters and the
 * safe-area insets the `Screen` pads its content by, before the reading cap, as `traceLayoutMode` reads it. A pure function
 * of the window, so the trace page's arrangement never depends on the column it changes (no loop, no flicker). With no
 * SafeAreaProvider the insets are 0, as `Screen` treats it. A frame above the screen (the All lessons preview's strip) reserves
 * its height through `ScreenReserveContext`, which is taken off the height. The object is the same until the box changes size.
 */
export function useScreenContentBox(): { width: number; height: number } {
  const layout = useLayoutClass();
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const reserved = useContext(ScreenReserveContext);
  const body = screenFrame({ width: 'reading', widthClass: layout.width, padded: true, insets, edges: ALL_SCREEN_EDGES, hasFooter: false }).body;
  const width = Math.max(0, layout.windowWidth - body.paddingLeft - body.paddingRight);
  const height = Math.max(0, layout.windowHeight - body.paddingTop - body.paddingBottom - reserved);
  return useMemo(() => ({ width, height }), [width, height]);
}
