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
  /** Makes the Web Audio context the timer chime plays on; null without Web Audio. */
  createAudioContext?: (() => ChimeContextLike) | null;
  /** `navigator.serviceWorker`; null without one (the stale-presenter Reload then only reloads). */
  serviceWorker?: ServiceWorkerContainerLike | null;
  /**
   * The page's `BroadcastChannel('hr-tabs')` (`window.__hrTabs`, made by the PWA shell script),
   * which every open tab of the app answers; null without one.
   */
  tabs?: TabsChannelLike | null;
}

/** The slice of `BroadcastChannel` the stale-presenter Reload uses to find other open tabs. */
export interface TabsChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', fn: (event: { data?: unknown }) => void): void;
  removeEventListener(type: 'message', fn: (event: { data?: unknown }) => void): void;
}

interface ServiceWorkerLike {
  state?: string;
  postMessage(message: unknown): void;
  addEventListener?(type: 'statechange', fn: () => void): void;
}

interface ServiceWorkerRegistrationLike {
  update(): Promise<unknown>;
  waiting?: ServiceWorkerLike | null;
  installing?: ServiceWorkerLike | null;
}

/** The slice of `navigator.serviceWorker` the stale-presenter Reload uses. */
export interface ServiceWorkerContainerLike {
  getRegistration(): Promise<ServiceWorkerRegistrationLike | undefined>;
  addEventListener?(type: 'controllerchange', fn: () => void): void;
}

interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, at: number): void;
  linearRampToValueAtTime(value: number, at: number): void;
  exponentialRampToValueAtTime(value: number, at: number): void;
}

interface AudioNodeLike {
  connect(target: unknown): unknown;
}

/** The slice of `AudioContext` the chime uses. */
export interface ChimeContextLike {
  state?: string;
  currentTime: number;
  destination: unknown;
  resume?: () => Promise<void>;
  createOscillator(): AudioNodeLike & { type: string; frequency: { value: number }; start(at: number): void; stop(at: number): void };
  createGain(): AudioNodeLike & { gain: AudioParamLike };
}

type Globals = {
  location?: PresenterEnv['location'];
  history?: PresenterEnv['history'];
  document?: DocumentLike & { activeElement?: unknown };
  opener?: unknown;
  navigator?: PresenterEnv['navigator'] & { serviceWorker?: ServiceWorkerContainerLike };
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
    createAudioContext: browserAudioContext,
    serviceWorker: g.navigator?.serviceWorker ?? null,
    tabs: (g as { __hrTabs?: TabsChannelLike }).__hrTabs ?? null,
  };
}

/** One factory for the page, so the context it makes is found again (`chimeContexts`). */
function browserAudioContext(): ChimeContextLike {
  const g = globalThis as { AudioContext?: new () => ChimeContextLike; webkitAudioContext?: new () => ChimeContextLike };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) throw new Error('no Web Audio');
  return new Ctor();
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
/** Set by Start over from the home: a reload before Start opens the deck fresh, not at its saved slide. */
const FRESH_STATE = 'hrLectureFresh';

export interface DeckAddress {
  /** The encoded deck, for `decodeDeck`. */
  raw: string;
  /** True when it came back from this tab's history entry (a reload), not from a link. */
  reloaded: boolean;
  /** A held deck the teacher chose to start over: it does not resume at its saved slide. */
  fresh?: true;
}

function freshState(env: PresenterEnv): boolean {
  const state = env.history?.state;
  return state !== null && typeof state === 'object' && (state as Record<string, unknown>)[FRESH_STATE] === true;
}

function heldState(raw: string, fresh: boolean): Record<string, unknown> {
  return fresh ? { [DECK_STATE]: raw, [FRESH_STATE]: true } : { [DECK_STATE]: raw };
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
  const fresh = kept !== null && freshState(env);
  if (location.hash || location.pathname !== PRESENTER_PATH) replaceAddress(env, kept === null ? null : heldState(kept, fresh));
  if (kept === null) return null;
  return fresh ? { raw: kept, reloaded: true, fresh: true } : { raw: kept, reloaded: true };
}

/** Forgets the open deck of this tab (Exit, an invalid link): a reload then shows the presenter home. */
export function forgetOpenDeck(env: PresenterEnv = browserEnv()): void {
  replaceAddress(env, null);
}

/**
 * Holds a deck started from the presenter home (Resume, Start over, Build lesson) in this tab's
 * history entry, the same state a `#d=` link leaves, so a reload reopens that lesson; the address
 * stays `/present` and the state holds only the encoded deck (no name, TD3). `fresh` (Start over)
 * marks it to open at its first slide on a reload before Start; Start holds it again without the mark.
 */
export function holdOpenDeck(raw: string, options: { fresh?: boolean } = {}, env: PresenterEnv = browserEnv()): void {
  replaceAddress(env, heldState(raw, options.fresh === true));
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

// --- stale presenter (AMENDMENTS-LECTURE-V2 section 4.5) ------------------------------------------

/** How long Reload waits for a newer presenter to install and take over before it reloads anyway. */
export const UPDATE_WAIT_MS = 8000;
/** How long Reload waits for another open tab of the app to answer the `hr-tabs` ping. */
export const TABS_WAIT_MS = 300;

/**
 * Whether another tab of the app is open: pings `hr-tabs` and waits `ms` for an answer. A channel
 * never delivers a message to the object that sent it, so this tab's own answer never counts.
 * False without a channel or on any fault.
 */
export function otherTabsOpen(env: PresenterEnv = browserEnv(), ms: number = TABS_WAIT_MS): Promise<boolean> {
  const tabs = env.tabs;
  if (!tabs) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (open: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        tabs.removeEventListener('message', onMessage);
      } catch {
        // Nothing to remove.
      }
      resolve(open);
    };
    const onMessage = (event: { data?: unknown }): void => {
      if ((event.data as { type?: unknown } | null | undefined)?.type === 'hr-tab-here') finish(true);
    };
    const timer = setTimeout(() => finish(false), ms);
    try {
      tabs.addEventListener('message', onMessage);
      tabs.postMessage({ type: 'hr-tab-ping' });
    } catch {
      finish(false);
    }
  });
}

/** `promise`'s value, or undefined once `ms` pass or it fails. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

async function registration(env: PresenterEnv, ms: number): Promise<ServiceWorkerRegistrationLike | undefined> {
  const container = env.serviceWorker;
  if (!container) return undefined;
  try {
    return await within(container.getRegistration(), ms);
  } catch {
    return undefined;
  }
}

/** The worker that installs after an update, once it is installed (it then waits); undefined after `ms`. */
function installed(worker: ServiceWorkerLike, ms: number): Promise<ServiceWorkerLike | undefined> {
  return within(
    new Promise<ServiceWorkerLike>((resolve) => {
      if (worker.state === 'installed') resolve(worker);
      worker.addEventListener?.('statechange', () => {
        if (worker.state === 'installed') resolve(worker);
      });
    }),
    ms,
  );
}

/**
 * A link this presenter cannot read (`unsupported_version`) usually comes from a newer one: asks
 * the service worker to look for it now, so a Reload finds it installed. Never throws.
 */
export async function checkForUpdate(env: PresenterEnv = browserEnv(), ms: number = UPDATE_WAIT_MS): Promise<void> {
  const reg = await registration(env, ms);
  if (reg) await within(Promise.resolve().then(() => reg.update()), ms);
}

/**
 * The invalid-link page's Reload: holds the link in this tab again (the invalid page let it go),
 * so the reload opens it; asks the service worker for a newer presenter and, when one installed
 * and no other tab of the app is open (`otherTabsOpen`), lets it take over (`SKIP_WAITING`) and
 * reloads on `controllerchange`. With another tab open (a learner mid-quest, a second presenter
 * mid-lecture) it only reloads: taking over would switch that tab to the new worker and delete the
 * precache it runs on (`clientsClaim`, `cleanupOutdatedCaches`), and the page's line asks to close
 * the other tabs. Offline or with nothing newer, it reloads at once. Reloads after `ms` at the
 * latest. Never throws.
 */
export async function reloadForUpdate(raw: string, env: PresenterEnv = browserEnv(), ms: number = UPDATE_WAIT_MS): Promise<void> {
  holdOpenDeck(raw, {}, env);
  const reload = (): void => env.reload?.();
  const reg = await registration(env, ms);
  if (!reg) return reload();
  await within(Promise.resolve().then(() => reg.update()), ms);
  const waiting = reg.waiting ?? (reg.installing ? await installed(reg.installing, ms) : undefined);
  if (!waiting) return reload();
  if (await otherTabsOpen(env)) return reload();
  let done = false;
  const once = (): void => {
    if (done) return;
    done = true;
    reload();
  };
  env.serviceWorker?.addEventListener?.('controllerchange', once);
  try {
    waiting.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    return once();
  }
  setTimeout(once, ms);
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

/**
 * Calls `handler` with the key-map command of each `keydown`; unmapped keys keep their browser
 * meaning. A handler that returns `false` did not use the key, so it keeps its browser meaning too
 * (the home's Help overlay leaves the scroll keys alone).
 */
export function subscribeKeys(handler: (command: KeyCommand) => boolean | void, env: PresenterEnv = browserEnv()): () => void {
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
    if (handler(command) !== false) event.preventDefault();
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

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="radio"]';

interface FocusableLike {
  focus?: () => void;
  disabled?: boolean;
  getAttribute?: (name: string) => string | null;
}

/**
 * The tabbable controls inside an overlay's own element, in document order (disabled and
 * tabindex -1 ones left out): what `trapFocus` cycles when the overlay names no list itself.
 */
export function focusablesIn(root: unknown): readonly unknown[] {
  const query = (root as { querySelectorAll?: (selector: string) => ArrayLike<unknown> } | null)?.querySelectorAll;
  if (typeof query !== 'function') return [];
  return Array.from(query.call(root, FOCUSABLE)).filter((node) => {
    const el = node as FocusableLike;
    if (typeof el.focus !== 'function' || el.disabled === true) return false;
    return el.getAttribute?.('aria-disabled') !== 'true' && el.getAttribute?.('tabindex') !== '-1';
  });
}

/**
 * Notes the focused control when an overlay opens; the returned function gives focus back to it
 * when the overlay closes, if it is still on the page.
 */
export function rememberFocus(env: PresenterEnv = browserEnv()): () => void {
  const opener = env.activeElement?.() as { focus?: () => void; isConnected?: boolean } | null | undefined;
  return () => {
    if (opener && opener.isConnected !== false && typeof opener.focus === 'function') opener.focus();
  };
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

/**
 * Fullscreen, then landscape (the Start tap and the fullscreen key or button): the fullscreen
 * request is made at once, inside the gesture, and the orientation lock only after it settles,
 * since Android Chrome refuses the lock outside fullscreen. The lock is still tried after a
 * refusal (some browsers lock without it); either refusal is tolerated. True when fullscreen began.
 */
export async function enterFullscreenLandscape(env: PresenterEnv = browserEnv()): Promise<boolean> {
  const entered = await enterFullscreen(env);
  await lockLandscape(env);
  return entered;
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

// --- the timer chime ----------------------------------------------------------------------------

/**
 * The class timer's chime at zero (section 3.5, TD5): two soft sine notes, rising, under a second
 * in all; never speech synthesis, never an alarm, and silent while the device is muted. The
 * context is made inside the Start tap (`unlockChime`), so a browser that needs a gesture for
 * audio lets it play when the timer ends minutes later.
 */
const CHIME_NOTES_HZ = [660, 880] as const;
/** Seconds between the two notes, and each note's length. */
const CHIME_GAP_S = 0.22;
const CHIME_NOTE_S = 0.6;
/** Peak loudness of a note (0..1): soft. */
const CHIME_PEAK = 0.12;
const CHIME_FLOOR = 0.0001;
const CHIME_ATTACK_S = 0.02;

const chimeContexts = new WeakMap<() => ChimeContextLike, ChimeContextLike>();

function chimeContext(env: PresenterEnv, make: boolean): ChimeContextLike | null {
  const factory = env.createAudioContext;
  if (!factory) return null;
  const existing = chimeContexts.get(factory);
  if (existing || !make) return existing ?? null;
  try {
    const ctx = factory();
    chimeContexts.set(factory, ctx);
    return ctx;
  } catch {
    return null;
  }
}

/** Makes (once) and resumes the chime's context; call inside a gesture. Failures are silent. */
export function unlockChime(env: PresenterEnv = browserEnv()): void {
  const ctx = chimeContext(env, true);
  if (ctx?.state === 'suspended') void ctx.resume?.().catch(() => undefined);
}

/** Plays the chime; false when muted, without an unlocked context, or when Web Audio refuses. */
export function playChime(muted: boolean, env: PresenterEnv = browserEnv()): boolean {
  if (muted) return false;
  const ctx = chimeContext(env, false);
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') void ctx.resume?.().catch(() => undefined);
    CHIME_NOTES_HZ.forEach((hz, i) => {
      const at = ctx.currentTime + i * CHIME_GAP_S;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(CHIME_FLOOR, at);
      gain.gain.linearRampToValueAtTime(CHIME_PEAK, at + CHIME_ATTACK_S);
      gain.gain.exponentialRampToValueAtTime(CHIME_FLOOR, at + CHIME_NOTE_S);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + CHIME_NOTE_S);
    });
    return true;
  } catch {
    return false;
  }
}
