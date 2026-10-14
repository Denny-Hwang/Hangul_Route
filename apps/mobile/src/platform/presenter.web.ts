import { isLearnerRoot, type LectureDeck } from '@hangul-route/content-schema';
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
  location?: { pathname: string; hash: string; search?: string } | null;
  /** `location.reload()`. */
  reload?: () => void;
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
    reload: () => (g.location as { reload?: () => void } | undefined)?.reload?.(),
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

/** The history-state key holding the open deck's encoded fragment (ids, a seed and options; never a name). */
const DECK_STATE = 'hrLectureFragment';

export interface DeckAddress {
  /** The encoded deck, for `decodeDeck`. */
  raw: string;
  /** True when it came back from this tab's history entry (a reload), not from a link. */
  reloaded: boolean;
}

function stateFragment(env: PresenterEnv): string | null {
  const state = env.history?.state;
  if (state === null || typeof state !== 'object') return null;
  const raw = (state as Record<string, unknown>)[DECK_STATE];
  return typeof raw === 'string' ? raw : null;
}

/** `/present`, keeping only a `?lang=` hand-off, which the locale store takes (and strips) next. */
function cleanAddress(env: PresenterEnv): string {
  try {
    const lang = new URLSearchParams(env.location?.search ?? '').get('lang');
    return lang === null ? PRESENTER_PATH : `${PRESENTER_PATH}?${new URLSearchParams({ lang }).toString()}`;
  } catch {
    return PRESENTER_PATH;
  }
}

function replaceAddress(env: PresenterEnv, state: unknown): void {
  try {
    env.history?.replaceState(state, '', cleanAddress(env));
  } catch {
    // A history that refuses (a sandboxed frame) must not lose the deck.
  }
}

/**
 * Reads the deck and cleans the address to `/present` before the first paint (section 3.2), so
 * neither the deck nor an unknown sub-path stays in the address bar. A `#d=<encoded deck>` link
 * wins; its value moves into this tab's history-entry state, which a reload keeps and a new tab
 * or a typed address does not, so a reload reopens the same lesson (`reloaded: true`) and the
 * console can hand the names over again (section 3.2 step 2). The state holds only the encoded
 * deck, which carries no name by construction (TD3). Null: no deck (the presenter home).
 */
export function takeDeckFragment(env: PresenterEnv = browserEnv()): DeckAddress | null {
  const location = env.location;
  if (!location) return null;
  const linked = location.hash ? deckParam(location.hash) : null;
  if (linked !== null) {
    replaceAddress(env, { [DECK_STATE]: linked });
    return { raw: linked, reloaded: false };
  }
  const kept = stateFragment(env);
  if (location.hash || location.pathname !== PRESENTER_PATH) replaceAddress(env, kept === null ? null : { [DECK_STATE]: kept });
  return kept === null ? null : { raw: kept, reloaded: true };
}

/** Forgets the open deck of this tab (Exit, an invalid link): a reload then shows the presenter home. */
export function forgetOpenDeck(env: PresenterEnv = browserEnv()): void {
  replaceAddress(env, null);
}

/**
 * A new deck link typed into this tab while it is open (`hashchange` with `#d=`) reloads the page,
 * so the boot reads it like any link; the console always opens a new tab, so this is rare.
 */
export function reloadOnDeckLink(env: PresenterEnv = browserEnv()): () => void {
  const target = env.window;
  if (!target) return () => undefined;
  const onHash = (): void => {
    if (env.location?.hash && deckParam(env.location.hash) !== null) env.reload?.();
  };
  target.addEventListener('hashchange', onHash);
  return () => target.removeEventListener('hashchange', onHash);
}

/** The fixed tab title (`learner.presenter.docTitle`); the deck title never goes here (section 3.2). */
export function setPresenterDocTitle(title: string, env: PresenterEnv = browserEnv()): void {
  if (env.document) env.document.title = title;
}

// --- roster hand-off --------------------------------------------------------------------------

/** The shared console origins plus the build-time preview list (`EXPO_PUBLIC_CONSOLE_ORIGINS`). */
export function presenterConsoleOrigins(extraCsv: string | undefined): readonly string[] {
  return consoleOrigins(extraCsv ?? null);
}

type DeckPick = Pick<LectureDeck, 'id' | 'picker'>;

/** A console tab opened this one (`window.opener`); a copied, typed or bookmarked link has none. */
export function hasOpener(env: PresenterEnv = browserEnv()): boolean {
  return env.opener !== null && env.opener !== undefined;
}

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

/**
 * Keeps Tab and Shift+Tab inside a modal dialog (the Exit confirm, section 3.13): focus cycles
 * through `items` (in order), and a focus that is outside them comes back to the first (or, with
 * Shift, the last). Other keys keep their meaning.
 */
export function trapFocus(items: () => readonly unknown[], env: PresenterEnv = browserEnv()): () => void {
  const target = env.keyTarget;
  if (!target) return () => undefined;
  const onKey = (event: KeyEventLike): void => {
    if (event.key !== 'Tab' || event.ctrlKey === true || event.metaKey === true || event.altKey === true) return;
    const list = items().filter((item): item is { focus: () => void } => typeof (item as { focus?: unknown } | null)?.focus === 'function');
    if (list.length === 0) return;
    const at = list.indexOf(env.activeElement?.() as { focus: () => void });
    const back = event.shiftKey === true;
    const next = at === -1 ? (back ? list.length - 1 : 0) : (at + (back ? list.length - 1 : 1)) % list.length;
    event.preventDefault();
    list[next]!.focus();
  };
  target.addEventListener('keydown', onKey as Listener);
  return () => target.removeEventListener('keydown', onKey as Listener);
}

/**
 * Pointer, touch and key activity anywhere on the page: the control bar comes back on any of them
 * and hides `presenter.autoHideMs` after the last (section 3.5).
 */
export function subscribeActivity(handler: () => void, env: PresenterEnv = browserEnv()): () => void {
  const target = env.window;
  if (!target) return () => undefined;
  const onActivity = (): void => handler();
  const types = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel'];
  for (const type of types) target.addEventListener(type, onActivity);
  return () => {
    for (const type of types) target.removeEventListener(type, onActivity);
  };
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
/** False once the lesson released the lock, so a request still in flight lets its lock go. */
let wanted = false;

export function wakeLockSupported(env: PresenterEnv = browserEnv()): boolean {
  return typeof env.navigator?.wakeLock?.request === 'function';
}

async function requestLock(env: PresenterEnv): Promise<void> {
  try {
    const lock = await env.navigator?.wakeLock?.request('screen');
    if (!lock) return;
    if (!wanted) {
      await lock.release();
      return;
    }
    sentinel = lock;
  } catch {
    // Refused (battery saver, a hidden page): the screen may sleep; the start screen said how to stop it.
  }
}

/** Keeps the screen on for the lesson; a lock the browser drops when the tab hides is taken again on return. */
export async function keepScreenAwake(env: PresenterEnv = browserEnv()): Promise<void> {
  if (!wakeLockSupported(env)) return;
  wanted = true;
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
  wanted = false;
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
 * Waits for the bundled Hangul face `family` (`presenter.font`; `@font-face` in the PWA shell, PR 3) for at most `timeoutMs`.
 * True when it loaded; false on a timeout, a failure or a browser without the Font Loading API,
 * and the system stack draws the Korean (section 3.6).
 */
export function waitForPresenterFont(timeoutMs: number, family: string, env: PresenterEnv = browserEnv()): Promise<boolean> {
  const load = env.document?.fonts?.load;
  if (typeof load !== 'function') return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    load
      .call(env.document?.fonts, `700 1em "${family}"`)
      .then((faces) => resolve(faces.length > 0))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(timer));
  });
}
