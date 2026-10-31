import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Platform, View } from 'react-native';
import type { ViewProps, ViewStyle } from 'react-native';
import { boardTouchAction } from '../../tap-model';
import { useScreenFit } from '../Screen/fit';
import { TapBoardContext, type TapBoardContextValue } from './context';
import { createTapBoardController, type TapBoardController } from './controller';
import { createNativeRects, stampedClock, webHitAt, webRect } from './host';
import type { TapBoardProps } from './types';

/**
 * An answer area that owns its touches (docs/specs/AMENDMENTS-TOUCH.md sections 3 and 4.1; design/components/TapBoard/
 * spec.md): its `TapTarget`s commit when the finger lifts, a graze within reach or travel still counts, a touch in a gap
 * goes to the nearest target, a second finger and a bounce never count twice, and only a touch that will count shows
 * the press look. The rules are `tap-model.ts`; the responder is `controller.ts`; this component wires the platform in.
 */

const NONE: ReadonlySet<string> = new Set();

/** `touch-action: pinch-zoom` is newer than `none` (older iOS Safari lacks it): assumption U1. */
function supportsPinchZoom(): boolean {
  const css = (globalThis as { CSS?: { supports?: (property: string, value: string) => boolean } }).CSS;
  return typeof css?.supports === 'function' && css.supports('touch-action', 'pinch-zoom');
}

/** The web's input clock: `performance.now()`, the clock of DOM event time stamps. */
function webNow(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof perf?.now === 'function' ? perf.now() : Date.now();
}

function windowScroll(): { x: number; y: number } {
  const w = (globalThis as { window?: { scrollX?: number; scrollY?: number } }).window;
  return { x: w?.scrollX ?? 0, y: w?.scrollY ?? 0 };
}

export function TapBoard({ lock, scroll = 'auto', multiTouch = 'first', disabled = false, testID, children }: TapBoardProps): ReactElement {
  const fit = useScreenFit();
  const web = Platform.OS === 'web';
  const node = useRef<unknown>(null);
  const fitNow = useRef(fit);
  fitNow.current = fit;
  const [pressed, setPressed] = useState<ReadonlySet<string>>(NONE);
  const [locked, setLocked] = useState(false);
  const controllerRef = useRef<TapBoardController | null>(null);
  if (controllerRef.current === null) {
    const nativeRects = createNativeRects(() => fitNow.current.scrollY());
    // The web runs on the clock of its events' time stamps; native on the wall clock (its stamps are on another one).
    const now = web ? webNow : Date.now;
    controllerRef.current = createTapBoardController(
      {
        now,
        timeOf: web ? stampedClock(now) : () => now(),
        rectOf: web ? (target) => webRect(target, windowScroll()) : nativeRects,
        hitAt: web ? (target, nodes) => webHitAt(target, nodes, node.current) : () => undefined,
        onPressedChange: setPressed,
        onLockChange: setLocked,
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      },
      { lock, multiTouch, disabled },
    );
  }
  const controller = controllerRef.current;
  controller.configure({ lock, multiTouch, disabled });
  useEffect(() => () => controller.dispose(), [controller]);

  const value = useMemo<TapBoardContextValue>(
    () => ({ register: controller.register, click: controller.click, lock: controller.lock, locked, pressed }),
    [controller, locked, pressed],
  );
  // Web only: a board that must not pan stops the browser from cancelling a graze (KT-D3). Not a native style.
  const style = web ? ({ touchAction: boardTouchAction(scroll, fit.fits, supportsPinchZoom()) } as unknown as ViewStyle) : undefined;
  // The responder events of both platforms carry what the controller reads (`changedTouches`, `pageX`, `pageY`).
  const responder = controller.handlers as unknown as ViewProps;

  return (
    <TapBoardContext.Provider value={value}>
      <View
        ref={(v) => {
          node.current = v;
        }}
        testID={testID}
        style={style}
        {...responder}
      >
        {children}
      </View>
    </TapBoardContext.Provider>
  );
}
