/**
 * Web variant of the haptics wrapper: `navigator.vibrate` where it exists
 * (Android Chrome); iOS Safari ignores it, and the app already treats
 * haptics as optional feedback.
 */
let enabled = true;

function vibrate(pattern: number | number[]): void {
  if (!enabled) return;
  const nav = globalThis.navigator as (Navigator & { vibrate?: (p: number | number[]) => boolean }) | undefined;
  try {
    nav?.vibrate?.(pattern);
  } catch {
    // never let a missing API throw into a game
  }
}

export function setHapticsEnabled(v: boolean): void {
  enabled = v;
}

export function tapLight(): void {
  vibrate(8);
}

export function tapMedium(): void {
  vibrate(15);
}

export function success(): void {
  vibrate([10, 40, 10]);
}

export function nudge(): void {
  vibrate(6);
}
