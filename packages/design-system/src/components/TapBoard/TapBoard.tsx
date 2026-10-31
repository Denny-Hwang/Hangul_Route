import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Platform, View } from 'react-native';
import type { ViewProps, ViewStyle } from 'react-native';
import { boardTouchAction } from '../../tap-model';
import { useScreenFit } from '../Screen/fit';
import { TapBoardContext, type TapBoardContextValue } from './context';
import { createTapBoardController, type TapBoardController } from './controller';
import { createNativeRects, stampedClock, supportsPinchZoom, tapNow, webHitAt, webRect } from './host';
import { useTapScroller } from './scroller';
import { TapLockContext } from './TapLockProvider';
import type { TapBoardProps } from './types';

/**
 * An answer area that owns its touches (docs/specs/AMENDMENTS-TOUCH.md sections 3 to 5; design/components/TapBoard/
 * spec.md): its `TapTarget`s commit when the finger lifts, a graze within reach or travel still counts, a touch in a gap
 * goes to the nearest target, the latest finger on an answer wins, a bounce never counts twice, a drag past
 * `TAP_TRAVEL` scrolls the page the board sits in, and only a touch that will count shows the press look. The rules
 * are `tap-model.ts`; the responder is `controller.ts`; this component wires the platform in.
 */

const NONE: ReadonlySet<string> = new Set();
/** Native: after the last scroll event of a scroll (a drag or a momentum), measure the targets again. */
const SETTLE_MS = 100;

function windowScroll(): { x: number; y: number } {
  const w = (globalThis as { window?: { scrollX?: number; scrollY?: number } }).window;
  return { x: w?.scrollX ?? 0, y: w?.scrollY ?? 0 };
}

export function TapBoard({ lock, scroll = 'auto', multiTouch = 'latest', disabled = false, testID, children }: TapBoardProps): ReactElement {
  const fit = useScreenFit();
  const scroller = useTapScroller();
  const app = useContext(TapLockContext);
  const web = Platform.OS === 'web';
  const node = useRef<unknown>(null);
  // Read by the controller at each event, so it always sees the current scroller and app lock.
  const live = useRef({ scroller, app });
  live.current = { scroller, app };
  const [pressed, setPressed] = useState<ReadonlySet<string>>(NONE);
  const [locked, setLocked] = useState(false);
  const controllerRef = useRef<TapBoardController | null>(null);
  if (controllerRef.current === null) {
    const nativeRects = createNativeRects();
    controllerRef.current = createTapBoardController(
      {
        now: tapNow,
        // The web reads inputs at their DOM time stamps; native on the board clock (its stamps are on another one).
        timeOf: web ? stampedClock(tapNow) : () => tapNow(),
        rectOf: web ? (target) => webRect(target, windowScroll()) : nativeRects.read,
        ...(web ? {} : { remeasure: nativeRects.remeasure }),
        hitAt: web ? (target, nodes) => webHitAt(target, nodes, node.current) : () => undefined,
        appLock: () => live.current.app,
        scroller: () => live.current.scroller,
        onPressedChange: setPressed,
        onLockChange: setLocked,
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      },
      { lock, multiTouch, disabled, scroll },
    );
  }
  const controller = controllerRef.current;
  controller.configure({ lock, multiTouch, disabled, scroll });
  useEffect(() => () => controller.dispose(), [controller]);
  // Native `scrollEnabled` is opt-in: a Screen turns it off only while it fits and holds a board (section 5).
  const registerBoard = fit.registerBoard;
  useEffect(() => registerBoard(), [registerBoard]);
  // A scroll the board did not drive cancels a live press (rule 7); on native, a scroll that settles re-measures.
  useEffect(() => {
    if (scroller === null) return undefined;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const stopCancel = controller.attachScroller(scroller);
    const stopMeasure = web
      ? () => undefined
      : scroller.onScroll(() => {
          if (settle !== null) clearTimeout(settle);
          settle = setTimeout(() => controller.remeasure(), SETTLE_MS);
        });
    return () => {
      stopCancel();
      stopMeasure();
      if (settle !== null) clearTimeout(settle);
    };
  }, [controller, scroller, web]);
  // Native: a fit change moves things without a layout the targets hear of.
  useEffect(() => {
    if (!web) controller.remeasure();
  }, [controller, fit.fits, web]);

  const value = useMemo<TapBoardContextValue>(
    () => ({
      register: controller.register,
      registerControl: controller.registerControl,
      click: controller.click,
      lock: controller.lock,
      remeasure: controller.remeasure,
      locked,
      pressed,
    }),
    [controller, locked, pressed],
  );
  // Web only: the board pans along its scroller only while it can scroll (KT-D3). Not a native style.
  const scrollState = scroller === null ? null : { axis: scroller.axis, canScroll: scroller.canScroll };
  const style = web ? ({ touchAction: boardTouchAction(scrollState, supportsPinchZoom()) } as unknown as ViewStyle) : undefined;
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
        onLayout={web ? undefined : () => controller.remeasure()}
        {...responder}
      >
        {children}
      </View>
    </TapBoardContext.Provider>
  );
}
