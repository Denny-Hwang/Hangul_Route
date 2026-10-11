import type { FormFactor } from '@hangul-route/design-system';
import { isStandalone } from './pwa.web';

/**
 * Web orientation wrapper (F-LAYOUT-001 §3.4, LD5). The manifest says
 * `orientation: any`, so phones are kept upright by a best-effort runtime lock
 * (installed app only: browsers refuse a lock in a normal tab) plus the soft
 * guard. Everything is feature-detected and every failure is swallowed: the
 * guard is the safety net.
 */

interface LockableOrientation {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
}

type OrientationWindow = {
  matchMedia?: (query: string) => { matches: boolean };
  screen?: { orientation?: LockableOrientation };
  location?: { pathname?: string };
};

function win(): OrientationWindow | null {
  const w = globalThis as unknown as OrientationWindow | undefined;
  return w ?? null;
}

/** `matchMedia('(pointer: coarse)')`; false when the query is missing or throws (the guard then stays away). */
export function coarsePointer(): boolean {
  try {
    const w = win();
    return typeof w?.matchMedia === 'function' ? w.matchMedia('(pointer: coarse)').matches === true : false;
  } catch {
    return false;
  }
}

/** Lock to portrait only for an installed (standalone) phone app; tabs and tablets are never locked. */
export async function tryLockPortrait(form: FormFactor): Promise<void> {
  if (form !== 'phone') return;
  try {
    if (!isStandalone()) return;
    const orientation = win()?.screen?.orientation;
    if (typeof orientation?.lock !== 'function') return;
    await orientation.lock('portrait-primary');
  } catch {
    // Not supported (iPhone), not allowed (not fullscreen) or aborted: the guard covers it.
  }
}

/** Release a lock: tablets, the presenter and "Keep sideways". */
export function unlock(): void {
  try {
    const orientation = win()?.screen?.orientation;
    if (typeof orientation?.unlock === 'function') orientation.unlock();
  } catch {
    // Nothing was locked, or the API is missing.
  }
}

/** `location.pathname`, for the guard's exempt routes; null when unknown. */
export function currentPath(): string | null {
  const path = win()?.location?.pathname;
  return typeof path === 'string' ? path : null;
}
