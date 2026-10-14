import { isLearnerRoot, type LectureDeck } from '@hangul-route/content-schema';
import { presenter } from '@hangul-route/design-system/tokens';
import { commandForKey, type KeyCommand } from '../logic/lecture/keymap';
import { receiveRoster } from '../logic/lecture/picker-labels';
import { consoleOrigins, readyMessage, readyTargets, wantsRoster } from '../logic/lecture/roster-message';

/**
 * The presenter's web platform layer (F-TCH-004 sections 3.1, 3.2, 3.5, 3.8). Everything that
 * touches the browser lives here, behind feature detection; every failure is silent, so a
 * classroom screen never shows an error for a feature the device lacks.
 *
 * - **Route and fragment**: `takeDeckFragment` reads the `#d=` deck and replaces the address with
 *   `/present` before the first paint, so the deck leaves the address bar and the session history
 *   entry; `setPresenterDocTitle` writes the fixed catalogue title (never the deck title).
 * - **Roster hand-off** (TD3): `announceReady` posts `ready` to `window.opener` once per allowed
 *   console origin; `listenForRoster` holds a roster's labels in memory (`picker-labels.ts`) only
 *   when it comes from the opener, from an allowed origin, and matches the open deck.
 * - **Keys**: `subscribeKeys` turns a `keydown` into a key-map command and prevents the browser
 *   default only for a mapped key.
 * - **Start tap**: fullscreen, the screen wake lock (re-requested when the page is shown again),
 *   landscape lock; and the font wait of the start screen.
 *
 * Browser globals are read through `PresenterEnv`, which tests inject.
 */

export const PRESENTER_PATH = '/present';

type Listener = (event: never) => void;

interface EventTargetLike {
  addEventListener(type: string, fn: Listener): void;
  removeEventListener(type: string, fn: Listener): void;
}

interface ElementLike {
  tagName?: unknown;
  isContentEditable?: unknown;
  getAttribute?: (name: string) => string | null;
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface DocumentLike extends Partial<EventTargetLike> {
  title?: string;
  documentElement?: ElementLike;
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: unknown;
  webkitFullscreenElement?: unknown;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  visibilityState?: string;
  fonts?: { load?: (font: string) => Promise<readonly unknown[]> };
}

interface WakeLockSentinelLike {
  release(): Promise<void> | void;
}

export interface PresenterEnv {
  location?: { pathname: string; hash: string } | null;
  history?: { state?: unknown; replaceState: (state: unknown, unused: string, url: string) => void } | null;
  document?: DocumentLike | null;
  /** The target `keydown` is read from (the document). */
  keyTarget?: EventTargetLike | null;
  /** `document.activeElement`. */
  activeElement?: () => unknown;
  /** The window `message` events arrive on. */
  window?: EventTargetLike | null;
  opener?: unknown;
  consoleOrigins?: readonly string[];
  navigator?: { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } } | null;
  screen?: { orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void } } | null;
}

type Globals = {
  location?: PresenterEnv['location'];
  history?: PresenterEnv['history'];
  document?: DocumentLike & { activeElement?: unknown };
  opener?: unknown;
  navigator?: PresenterEnv['navigator'];
  screen?: PresenterEnv['screen'];
  addEventListener?: EventTargetLike['addEventListener'];
  removeEventListener?: EventTargetLike['removeEventListener'];
};

function browserEnv(): PresenterEnv {
  const g = globalThis as Globals;
  const doc = g.document ?? null;
  const win = typeof g.addEventListener === 'function' ? (g as EventTargetLike) : null;
  return {
    location: g.location ?? null,
    history: g.history ?? null,
    document: doc,
    keyTarget: doc && typeof doc.addEventListener === 'function' ? (doc as EventTargetLike) : null,
    activeElement: () => doc?.activeElement ?? null,
    window: win,
    opener: g.opener ?? null,
    consoleOrigins: presenterConsoleOrigins(process.env.EXPO_PUBLIC_CONSOLE_ORIGINS),
    navigator: g.navigator ?? null,
    screen: g.screen ?? null,
  };
}

// --- route and address ----------------------------------------------------------------------

export function isPresenterRoute(location: { pathname: string }): boolean {
  return location.pathname.startsWith(PRESENTER_PATH) && isLearnerRoot(location.pathname);
}

/** The value of `d=` in a `#a=1&d=...` fragment, or null. */
function deckParam(hash: string): string | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const part of body.split('&')) {
    if (part === 'd') return '';
    if (part.startsWith('d=')) return part.slice(2);
  }
  return null;
}

/**
 * Reads the deck fragment (`#d=<encoded deck>`) and cleans the address to `/present`
 * (`history.replaceState(null, '', '/present')`), so neither the deck nor an unknown sub-path stays
 * in the address bar or the history entry. Returns the raw value for `decodeDeck`, or null.
 */
export function takeDeckFragment(env: PresenterEnv = browserEnv()): string | null {
  const location = env.location;
  if (!location) return null;
  const raw = location.hash ? deckParam(location.hash) : null;
  if (location.hash || location.pathname !== PRESENTER_PATH) {
    try {
      env.history?.replaceState(null, '', PRESENTER_PATH);
    } catch {
      // A history that refuses (a sandboxed frame) must not lose the deck.
    }
  }
  return raw;
}

/** The fixed tab title (`learner.presenter.docTitle`); the deck title never goes here (section 3.2). */
export function setPresenterDocTitle(title: string, env: PresenterEnv = browserEnv()): void {
  if (env.document) env.document.title = title;
}

/** The history-state key that marks the open lesson of this tab (a deck id, never a name). */
const OPEN_DECK_STATE = 'hrLectureDeck';

/**
 * Marks the lesson open in this tab in the history entry's state (`null` clears it on Exit). A
 * reload keeps the state but not the fragment (already stripped), so the presenter can reopen the
 * lesson from Recent at the slide that was open (section 3.5); a new tab or a typed address has
 * none. Nothing else is written, and the deck id is all it holds.
 */
export function markOpenDeck(deckId: string | null, env: PresenterEnv = browserEnv()): void {
  try {
    env.history?.replaceState(deckId === null ? null : { [OPEN_DECK_STATE]: deckId }, '', PRESENTER_PATH);
  } catch {
    // A refusing history: a reload shows the home instead.
  }
}

/** The deck id `markOpenDeck` left in this tab's history entry, or null. */
export function openDeckId(env: PresenterEnv = browserEnv()): string | null {
  const state = env.history?.state;
  if (state === null || typeof state !== 'object') return null;
  const id = (state as Record<string, unknown>)[OPEN_DECK_STATE];
  return typeof id === 'string' ? id : null;
}

// --- roster hand-off --------------------------------------------------------------------------

/** The shared console origins plus the build-time preview list (`EXPO_PUBLIC_CONSOLE_ORIGINS`). */
export function presenterConsoleOrigins(extraCsv: string | undefined): readonly string[] {
  return consoleOrigins(extraCsv ?? null);
}

type DeckPick = Pick<LectureDeck, 'id' | 'picker'>;

/** Posts `ready` to the opener, once per allowed origin; returns how many posts went out. */
export function announceReady(deck: DeckPick, env: PresenterEnv = browserEnv()): number {
  const opener = env.opener as { postMessage?: (message: unknown, targetOrigin: string) => void } | null | undefined;
  const targets = readyTargets(deck, opener, env.consoleOrigins ?? consoleOrigins(null));
  let sent = 0;
  for (const origin of targets) {
    try {
      opener?.postMessage?.(readyMessage(deck.id), origin);
      sent += 1;
    } catch {
      // A closed or cross-origin opener: nothing to deliver to.
    }
  }
  return sent;
}

/**
 * Listens for the console's `roster` answer. A message that passes every check is held in memory
 * (`picker-labels.ts`) and `onRoster` runs; anything else is ignored without a trace.
 */
export function listenForRoster(deck: DeckPick, onRoster: () => void, env: PresenterEnv = browserEnv()): () => void {
  const target = env.window;
  if (!target || env.opener === null || env.opener === undefined || !wantsRoster(deck)) return () => undefined;
  const ctx = { opener: env.opener, allowedOrigins: env.consoleOrigins ?? consoleOrigins(null), deck };
  const onMessage = (event: { origin: string; source: unknown; data: unknown }): void => {
    if (receiveRoster(event, ctx)) onRoster();
  };
  target.addEventListener('message', onMessage as Listener);
  return () => target.removeEventListener('message', onMessage as Listener);
}

// --- keys -------------------------------------------------------------------------------------

const FIELDS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const ACTIVATABLE_TAGS: ReadonlySet<string> = new Set(['BUTTON', 'A', 'SUMMARY']);
const ACTIVATABLE_ROLES: ReadonlySet<string> = new Set(['button', 'link', 'checkbox', 'menuitem', 'switch', 'radio', 'tab']);

function asElement(value: unknown): ElementLike | null {
  return value !== null && typeof value === 'object' ? (value as ElementLike) : null;
}

function inTextField(el: ElementLike | null): boolean {
  return el !== null && ((typeof el.tagName === 'string' && FIELDS.has(el.tagName)) || el.isContentEditable === true);
}

function activatable(el: ElementLike | null): boolean {
  if (el === null) return false;
  if (typeof el.tagName === 'string' && ACTIVATABLE_TAGS.has(el.tagName)) return true;
  const role = el.getAttribute?.('role');
  return typeof role === 'string' && ACTIVATABLE_ROLES.has(role);
}

interface KeyEventLike {
  key: string;
  code?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  preventDefault(): void;
}

/** Calls `handler` with the key-map command of each `keydown`; unmapped keys keep their browser meaning. */
export function subscribeKeys(handler: (command: KeyCommand) => void, env: PresenterEnv = browserEnv()): () => void {
  const target = env.keyTarget;
  if (!target) return () => undefined;
  const onKey = (event: KeyEventLike): void => {
    if (event.defaultPrevented) return;
    const focused = asElement(env.activeElement?.());
    const command = commandForKey({
      key: event.key,
      code: event.code,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      repeat: event.repeat,
      isComposing: event.isComposing,
      inTextInput: inTextField(focused),
      onActivatable: activatable(focused),
    });
    if (command === null) return;
    event.preventDefault();
    handler(command);
  };
  target.addEventListener('keydown', onKey as Listener);
  return () => target.removeEventListener('keydown', onKey as Listener);
}

// --- fullscreen -------------------------------------------------------------------------------

export function fullscreenSupported(env: PresenterEnv = browserEnv()): boolean {
  const doc = env.document;
  const root = doc?.documentElement;
  if (!doc || !root) return false;
  return (
    (doc.fullscreenEnabled === true && typeof root.requestFullscreen === 'function') ||
    (doc.webkitFullscreenEnabled === true && typeof root.webkitRequestFullscreen === 'function')
  );
}

export function isFullscreen(env: PresenterEnv = browserEnv()): boolean {
  const doc = env.document;
  if (!doc) return false;
  return (doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null) !== null;
}

/** Asks for fullscreen (from a user gesture); false when unsupported or refused. */
export async function enterFullscreen(env: PresenterEnv = browserEnv()): Promise<boolean> {
  const root = env.document?.documentElement;
  try {
    if (typeof root?.requestFullscreen === 'function') {
      await root.requestFullscreen();
      return true;
    }
    if (typeof root?.webkitRequestFullscreen === 'function') {
      await root.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // Refused (no gesture, a policy): the lesson runs in the window.
  }
  return false;
}

export async function exitFullscreen(env: PresenterEnv = browserEnv()): Promise<void> {
  const doc = env.document;
  if (!doc || !isFullscreen(env)) return;
  try {
    if (typeof doc.exitFullscreen === 'function') await doc.exitFullscreen();
    else if (typeof doc.webkitExitFullscreen === 'function') await doc.webkitExitFullscreen();
  } catch {
    // Already out.
  }
}

export function subscribeFullscreen(handler: () => void, env: PresenterEnv = browserEnv()): () => void {
  const doc = env.document;
  if (!doc || typeof doc.addEventListener !== 'function' || typeof doc.removeEventListener !== 'function') return () => undefined;
  const add = doc.addEventListener.bind(doc);
  const remove = doc.removeEventListener.bind(doc);
  const onChange = (): void => handler();
  add('fullscreenchange', onChange);
  add('webkitfullscreenchange', onChange);
  return () => {
    remove('fullscreenchange', onChange);
    remove('webkitfullscreenchange', onChange);
  };
}

// --- wake lock --------------------------------------------------------------------------------

let sentinel: WakeLockSentinelLike | null = null;
let onVisible: (() => void) | null = null;

export function wakeLockSupported(env: PresenterEnv = browserEnv()): boolean {
  return typeof env.navigator?.wakeLock?.request === 'function';
}

async function requestLock(env: PresenterEnv): Promise<void> {
  try {
    const lock = await env.navigator?.wakeLock?.request('screen');
    if (lock) sentinel = lock;
  } catch {
    // Refused (battery saver, a hidden page): the screen may sleep; the start screen said how to stop it.
  }
}

/** Keeps the screen on for the lesson; a lock the browser drops when the tab hides is taken again on return. */
export async function keepScreenAwake(env: PresenterEnv = browserEnv()): Promise<void> {
  if (!wakeLockSupported(env)) return;
  await requestLock(env);
  const doc = env.document;
  if (onVisible === null && doc && typeof doc.addEventListener === 'function') {
    onVisible = () => {
      if (doc.visibilityState === 'visible') void requestLock(env);
    };
    doc.addEventListener('visibilitychange', onVisible);
  }
}

export async function releaseScreenAwake(env: PresenterEnv = browserEnv()): Promise<void> {
  const doc = env.document;
  if (onVisible !== null && doc && typeof doc.removeEventListener === 'function') doc.removeEventListener('visibilitychange', onVisible);
  onVisible = null;
  const lock = sentinel;
  sentinel = null;
  try {
    await lock?.release();
  } catch {
    // Already released.
  }
}

// --- orientation ------------------------------------------------------------------------------

export async function lockLandscape(env: PresenterEnv = browserEnv()): Promise<void> {
  try {
    await env.screen?.orientation?.lock?.('landscape');
  } catch {
    // Most desktop browsers and iPadOS Safari refuse outside fullscreen: the stage letterboxes instead.
  }
}

export function unlockOrientation(env: PresenterEnv = browserEnv()): void {
  try {
    env.screen?.orientation?.unlock?.();
  } catch {
    // Nothing was locked.
  }
}

// --- the presenter font -------------------------------------------------------------------------

/**
 * Waits for the bundled Hangul face (`@font-face` in the PWA shell, PR 3) for at most `timeoutMs`.
 * True when it loaded; false on a timeout, a failure or a browser without the Font Loading API,
 * and the system stack draws the Korean (section 3.6).
 */
export function waitForPresenterFont(timeoutMs: number, env: PresenterEnv = browserEnv()): Promise<boolean> {
  const load = env.document?.fonts?.load;
  if (typeof load !== 'function') return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    load
      .call(env.document?.fonts, `700 1em "${presenter.font}"`)
      .then((faces) => resolve(faces.length > 0))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(timer));
  });
}
