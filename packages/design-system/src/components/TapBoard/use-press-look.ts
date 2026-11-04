import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { pressLook } from '../../press-look';
import type { PressLook } from '../../press-look';

/**
 * The press look (docs/specs/AMENDMENTS-TOUCH.md section 4.3) for the platform's reduced-motion setting: the outline
 * and the 0.97 shrink, or the outline alone. One subscription to `AccessibilityInfo` for the whole app (it starts with
 * the first card that asks), so a board of many cards adds no listener per card. Until the platform answers, the
 * setting reads as off.
 */
let reduced = false;
let started = false;
const listeners = new Set<() => void>();

function set(value: boolean): void {
  if (value === reduced) return;
  reduced = value;
  for (const listener of listeners) listener();
}

function start(): void {
  if (started) return;
  started = true;
  const info = AccessibilityInfo as Partial<typeof AccessibilityInfo> | undefined;
  info
    ?.isReduceMotionEnabled?.()
    .then((value) => set(value === true))
    .catch(() => undefined);
  info?.addEventListener?.('reduceMotionChanged', (value: boolean) => set(value === true));
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const read = (): boolean => reduced;

export function usePressLook(): PressLook {
  return pressLook(useSyncExternalStore(subscribe, read, read));
}
