import { spacing } from '@hangul-route/design-system';
import type { MutableRefObject } from 'react';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import {
  traceTouchesDown,
  traceTouchesEnd,
  traceTouchesMove,
  traceTouchesUp,
  type TracePointers,
  type TraceTouchEffect,
  type TraceTouchStep,
  type TouchPoint,
} from '../logic/trace-pointers';

interface TracePanHandlers {
  /** Each effect of `logic/trace-pointers`, in order, in canvas coordinates. */
  onEffect: (effect: TraceTouchEffect) => void;
  /** A finger is on the canvas (the status row holds still until the gesture ends). */
  onFingerDown: () => void;
  onFingerUp: () => void;
}

/**
 * The trace canvas gesture (AMENDMENTS-TOUCH 6.8, KT-D9), shared by Trace and Trace a Word.
 *
 * A Pan that starts after `spacing.xs` and sets no `maxPointers` limit (a limit fails or cancels the
 * gesture when a palm rests or a second finger lands). The stroke comes from the touch callbacks by
 * pointer id (`logic/trace-pointers`): the first finger that travels `spacing.xs` draws, from where it
 * landed; a resting palm or a second touch adds nothing and cancels nothing (a palm that drifted first
 * gives the stroke to the finger while it is under `spacing.sm`); a dot leaves no ink. The
 * pointer state lives in the screen's ref, so it survives the re-render every stroke point causes.
 */
export function tracePanGesture(pointers: MutableRefObject<TracePointers>, handlers: TracePanHandlers): PanGesture {
  const apply = (step: TraceTouchStep): void => {
    pointers.current = step.state;
    for (const effect of step.effects) handlers.onEffect(effect);
  };
  const down = (touches: TouchPoint[]): void => apply(traceTouchesDown(pointers.current, touches));
  const move = (touches: TouchPoint[]): void => apply(traceTouchesMove(pointers.current, touches, spacing.xs, spacing.sm));
  const up = (touches: TouchPoint[]): void => apply(traceTouchesUp(pointers.current, touches));
  const settle = (): void => apply(traceTouchesEnd(pointers.current));
  const { onFingerDown, onFingerUp } = handlers;

  return Gesture.Pan()
    .minDistance(spacing.xs)
    .onBegin(() => {
      runOnJS(onFingerDown)();
    })
    .onTouchesDown((e) => {
      runOnJS(down)(e.changedTouches);
    })
    .onTouchesMove((e) => {
      runOnJS(move)(e.changedTouches);
    })
    .onTouchesUp((e) => {
      runOnJS(up)(e.changedTouches);
    })
    .onTouchesCancelled((e) => {
      runOnJS(up)(e.changedTouches);
    })
    // Every finger is up, or the gesture was cancelled: lift whatever the touch callbacks did not.
    .onFinalize(() => {
      runOnJS(settle)();
      runOnJS(onFingerUp)();
    });
}
