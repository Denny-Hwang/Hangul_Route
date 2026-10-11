import type { FormFactor } from '@hangul-route/design-system';
import { isStandalone } from './pwa.web';

/**
 * Web orientation wrapper (F-LAYOUT-001 §3.4, LD5). The manifest says
 * `orientation: any`, so phones are kept upright by a best-effort runtime lock
 * (installed app only: browsers refuse a lock in a normal tab) plus the soft
 * guard. Everything is feature-detected and every failure is swallowed: the
 * guard is the safety net.
 */

type Listener = () => void;

interface LockableOrientation {
  type?: string;
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
  addEventListener?: (type: 'change', listener: Listener) => void;
  removeEventListener?: (type: 'change', listener: Listener) => void;
}

interface FocusedElement {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

type OrientationWindow = {
  matchMedia?: (query: string) => { matches: boolean };
  screen?: { orientation?: LockableOrientation; width?: number; height?: number };
  location?: { pathname?: string };
  orientation?: number;
  document?: { activeElement?: FocusedElement | null };
  addEventListener?: (type: 'orientationchange', listener: Listener) => void;
  removeEventListener?: (type: 'orientationchange', listener: Listener) => void;
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

/**
 * The device's own orientation, never the window shape: react-native-web's window is the visual
 * viewport, which a soft keyboard on an upright phone makes wider than tall. Screen Orientation
 * API first, then the legacy `window.orientation` (older iOS), then the orientation media query
 * (the layout viewport, which the keyboard does not resize on iOS or Chrome 108+); null when none answers.
 */
export function deviceOrientation(): 'portrait' | 'landscape' | null {
  try {
    const w = win();
    const type = w?.screen?.orientation?.type;
    if (typeof type === 'string' && type.startsWith('landscape')) return 'landscape';
    if (typeof type === 'string' && type.startsWith('portrait')) return 'portrait';
    const angle = w?.orientation;
    if (typeof angle === 'number') return Math.abs(angle) === 90 ? 'landscape' : 'portrait';
    if (typeof w?.matchMedia === 'function') return w.matchMedia('(orientation: landscape)').matches === true ? 'landscape' : 'portrait';
    return null;
  } catch {
    return null;
  }
}

/** The physical screen in CSS px; page zoom, a Stage Manager window or Slide Over do not change it. Null when unknown. */
export function deviceScreen(): { width: number; height: number } | null {
  const s = win()?.screen;
  const width = s?.width;
  const height = s?.height;
  return typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 ? { width, height } : null;
}

/** Input types that take no typing (no keyboard comes up). */
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

/** A text field has focus: the learner is typing, so the guard stays out of the way. */
export function editingText(): boolean {
  const el = win()?.document?.activeElement;
  if (!el) return false;
  if (el.isContentEditable === true) return true;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA') return true;
  return tag === 'INPUT' && !NON_TEXT_INPUTS.has(String(el.type ?? 'text').toLowerCase());
}

/** Calls back when the device turns (`screen.orientation` change, else `orientationchange`); returns the unsubscribe. */
export function subscribeDeviceOrientation(callback: Listener): () => void {
  const w = win();
  const orientation = w?.screen?.orientation;
  if (typeof orientation?.addEventListener === 'function') {
    orientation.addEventListener('change', callback);
    return () => orientation.removeEventListener?.('change', callback);
  }
  if (typeof w?.addEventListener === 'function') {
    w.addEventListener('orientationchange', callback);
    return () => w.removeEventListener?.('orientationchange', callback);
  }
  return () => undefined;
}
