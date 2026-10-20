import { isLearnerRoot, type LecturePreset } from '@hangul-route/content-schema';
import { parseHomeSnapshot, type HomeSnapshot } from '../logic/lecture/home-state';
import { bootPlan, entryState, pushPlan, readEntry, stepsToHome, type HistoryEntry } from '../logic/lecture/history';
import { commandForKey, type KeyCommand } from '../logic/lecture/keymap';

/**
 * The presenter's web platform layer (F-TCH-004 sections 3.1, 3.2, 3.5, 3.8). Everything that
 * touches the browser lives here, behind feature detection; every failure is silent, so a
 * classroom screen never shows an error for a feature the device lacks.
 *
 * - **Route and fragment**: `takeDeckFragment` reads the `#d=` deck and replaces the address with
 *   `/present` before the first paint, so the deck leaves the address bar and the session history
 *   entry; `setPresenterDocTitle` writes the fixed catalogue title (never the deck title).
 * - **The way back** (section 3.5 "History", owner report 2026-10-16 item 3): one history entry per
 *   phase, the home (`hrPresenter: 'home'`), the start screen (`'ready'`) and the lesson
 *   (`'running'`), with `hrIndex`, the deck held in the start screen's and the lesson's entries so a
 *   reload still resumes. The plan is pure (`logic/lecture/history.ts`); this layer applies it, runs
 *   the presenter's own steps one at a time and ignores their popstates (`subscribePresenterPop`
 *   reports only the browser's), and decides the home's Back once at boot (`leavePresenter`).
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
  referrer?: string;
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
  location?: { pathname: string; hash: string; search?: string; origin?: string } | null;
  /** `location.reload()`. */
  reload?: () => void;
  /** `location.assign(url)`: leaves for another page of this origin. */
  assign?: (url: string) => void;
  history?: {
    state?: unknown;
    length?: number;
    replaceState: (state: unknown, unused: string, url: string) => void;
    pushState?: (state: unknown, unused: string, url: string) => void;
    go?: (delta: number) => void;
  } | null;
  document?: DocumentLike | null;
  /** The target `keydown` is read from (the document). */
  keyTarget?: EventTargetLike | null;
  /** `document.activeElement`. */
  activeElement?: () => unknown;
  /** The window `hashchange` and activity events arrive on. */
  window?: EventTargetLike | null;
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
    assign: (url) => (g.location as { assign?: (to: string) => void } | undefined)?.assign?.(url),
    history: g.history ?? null,
    document: doc,
    keyTarget: doc && typeof doc.addEventListener === 'function' ? (doc as EventTargetLike) : null,
    activeElement: () => doc?.activeElement ?? null,
    window: win,
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

export interface DeckAddress {
  /** The encoded deck, for `decodeDeck`. */
  raw: string;
  /** True when it came back from this tab's history entry (a reload), not from a link. */
  reloaded: boolean;
  /** A held deck the teacher chose to start over: it does not resume at its saved slide. */
  fresh?: true;
  /** The ready-made lesson a reloaded start screen was resolved from on this presenter (history rule 9). */
  preset?: LecturePreset;
}

export type { HistoryEntry } from '../logic/lecture/history';

/** `/present`, keeping only a `?lang=` hand-off, which the locale store takes (and strips) next. */
function cleanAddress(env: PresenterEnv): string {
  try {
    const lang = new URLSearchParams(env.location?.search ?? '').get('lang');
    return lang === null ? PRESENTER_PATH : `${PRESENTER_PATH}?${new URLSearchParams({ lang }).toString()}`;
  } catch {
    return PRESENTER_PATH;
  }
}

function replaceEntry(env: PresenterEnv, entry: HistoryEntry | null): void {
  try {
    env.history?.replaceState(entry === null ? null : entryState(entry), '', cleanAddress(env));
  } catch {
    // A history that refuses (a sandboxed frame) must not lose the deck.
  }
}

/** Pushes `entry`; without `pushState` (or when it refuses) the entry is written over the current one, so the deck is still held. */
function pushEntry(env: PresenterEnv, entry: HistoryEntry): void {
  if (typeof env.history?.pushState !== 'function') {
    replaceEntry(env, entry);
    return;
  }
  try {
    env.history.pushState(entryState(entry), '', cleanAddress(env));
  } catch {
    replaceEntry(env, entry);
  }
}

/** The presenter entry this tab is on (null: none of the presenter's). */
export function currentPresenterEntry(env: PresenterEnv = browserEnv()): HistoryEntry | null {
  return readEntry(env.history?.state);
}

function referrerSameOrigin(env: PresenterEnv): boolean {
  try {
    const referrer = env.document?.referrer ?? '';
    const origin = env.location?.origin ?? '';
    return referrer !== '' && origin !== '' && new URL(referrer).origin === origin;
  } catch {
    return false;
  }
}

/**
 * Reads the deck and cleans the address to `/present` before the first paint (section 3.2), so
 * neither the deck nor an unknown sub-path stays in the address bar, and lays out this tab's
 * history entries (section 3.5 "History", rules 1, 5 and 6; the plan is `logic/lecture/history.ts`).
 * A `#d=<encoded deck>` link wins: the entry becomes the presenter home and a start-screen entry
 * holding the deck is pushed over it, so the first back lands on the home; a link `accepts` refuses
 * (it does not decode) pushes nothing. A reload reopens the deck its entry holds (`reloaded: true`);
 * a reload in a lesson first steps back to its start-screen entry. The home's Back is decided here,
 * once, from this tab's own history (`presenterHomeBack`). The entries hold only the encoded deck,
 * which carries no name by construction. Null: no deck (the presenter home).
 */
export function takeDeckFragment(env: PresenterEnv = browserEnv(), accepts: (raw: string) => boolean = () => true): DeckAddress | null {
  const location = env.location;
  if (!location) return null;
  const link = location.hash ? deckParam(location.hash) : null;
  const entry = readEntry(env.history?.state);
  const homeBack = referrerSameOrigin(env) && typeof env.history?.length === 'number' && env.history.length > 1;
  const plan = bootPlan({ link, entry, accepts, homeBack });
  if (plan.replace !== null) replaceEntry(env, plan.replace);
  else if (location.hash || location.pathname !== PRESENTER_PATH) replaceEntry(env, entry);
  if (plan.push !== null) pushEntry(env, plan.push);
  if (plan.back) void queue(() => goIgnored(env, -1));
  if (plan.deck === null) return null;
  const { raw, reloaded, fresh, preset } = plan.deck;
  return { raw, reloaded, ...(fresh ? { fresh } : {}), ...(preset !== undefined ? { preset } : {}) };
}

/** The home's kept state in this tab's entry (section 18.2), or null when the entry holds none. */
export function presenterHomeSnapshot(env: PresenterEnv = browserEnv()): HomeSnapshot | null {
  const here = readEntry(env.history?.state);
  return here?.step === 'home' ? (here.home ?? null) : null;
}

/**
 * Keeps the home's state in the home entry (section 18.2; ids and chip values only), so a back
 * onto the home or a reload there shows it as it was. Only while the tab is on the home entry; it
 * goes through the presenter's own queue, so it lands before a push that leaves the home.
 */
export function saveHomeSnapshot(snapshot: HomeSnapshot, env: PresenterEnv = browserEnv()): Promise<void> {
  return queue(() => {
    const here = readEntry(env.history?.state);
    if (here === null || here.step !== 'home') return;
    // The same state already there: no write (browsers throttle `replaceState`).
    if (here.home !== undefined && JSON.stringify(here.home) === JSON.stringify(parseHomeSnapshot(snapshot))) return;
    replaceEntry(env, { ...here, home: snapshot });
  });
}

/**
 * Resolves once every history step the presenter asked for so far (boot's step back, a return to
 * the home) has run, so the entry the tab is on can be read: the home's kept state after a boot
 * on a deck step (section 18.2).
 */
export function afterPresenterHistory(): Promise<void> {
  return queue(() => undefined);
}

/** Whether the home's Back goes back to the page before `/present` (rule 5): a same-origin page before it at boot. */
export function presenterHomeBack(env: PresenterEnv = browserEnv()): boolean {
  return readEntry(env.history?.state)?.homeBack === true;
}

/** Forgets the open deck of this tab's entry (an invalid link): the entry is the home again and a reload shows the home. */
export function forgetOpenDeck(env: PresenterEnv = browserEnv()): void {
  const here = readEntry(env.history?.state);
  replaceEntry(env, { step: 'home', index: here?.index ?? 0, ...(here?.homeBack !== undefined ? { homeBack: here.homeBack } : {}) });
}

/**
 * Holds a deck in this tab's entry as a start screen at the entry's own place (rule 6: the
 * stale-presenter Reload writes `{ ready, hrIndex: 0 }` over the invalid page's home entry, which
 * the next boot opens as a link). `fresh` (Start over) opens it at its first slide on a reload
 * before Start.
 */
export function holdOpenDeck(raw: string, options: { fresh?: boolean } = {}, env: PresenterEnv = browserEnv()): void {
  const here = readEntry(env.history?.state);
  replaceEntry(env, {
    step: 'ready',
    index: here?.index ?? 0,
    fragment: raw,
    ...(options.fresh === true ? { fresh: true as const } : {}),
    ...(here?.homeBack !== undefined ? { homeBack: here.homeBack } : {}),
  });
}

// --- the way back (section 3.5 "History"; owner report 2026-10-16 item 3) --------------------------

/** How long a step the presenter takes itself waits for its own `popstate` before it stops expecting one. */
export const RETURN_WAIT_MS = 1000;
/** How long the home's Back waits for the page to start leaving before it leaves for `/` instead. */
export const LEAVE_WAIT_MS = 1000;

/**
 * The presenter's own history steps run one after another (a push never lands on an entry a step
 * back is still leaving), each after the last one's `popstate`.
 */
let chain: Promise<void> = Promise.resolve();
function queue(op: () => void | Promise<void>): Promise<void> {
  const next = chain.then(op, op);
  chain = next.catch(() => undefined);
  return chain;
}

interface PopHub {
  /** The presenter's own steps still waiting for their `popstate`, oldest first. */
  own: { done: () => void; timer: ReturnType<typeof setTimeout> }[];
  handlers: Set<(landed: HistoryEntry | null) => void>;
}

/** One `popstate` listener per window: it answers the presenter's own steps first, then reports the browser's. */
const hubs = new WeakMap<object, PopHub>();

function hubOf(env: PresenterEnv): PopHub | null {
  const target = env.window;
  if (!target) return null;
  const known = hubs.get(target);
  if (known) return known;
  const hub: PopHub = { own: [], handlers: new Set() };
  hubs.set(target, hub);
  target.addEventListener('popstate', () => {
    const own = hub.own.shift();
    if (own) {
      clearTimeout(own.timer);
      own.done();
      return;
    }
    const landed = readEntry(env.history?.state);
    for (const handler of [...hub.handlers]) handler(landed);
  });
  return hub;
}

/** `history.go(delta)`, resolved on its own `popstate` (never reported as the browser's) or after `RETURN_WAIT_MS`. */
function goIgnored(env: PresenterEnv, delta: number): Promise<void> {
  const history = env.history;
  if (delta === 0 || typeof history?.go !== 'function') return Promise.resolve();
  const hub = hubOf(env);
  return new Promise<void>((resolve) => {
    if (hub === null) {
      try {
        history.go?.(delta);
      } catch {
        // Nothing to wait for.
      }
      resolve();
      return;
    }
    const item = {
      done: resolve,
      timer: setTimeout(() => {
        const at = hub.own.indexOf(item);
        if (at >= 0) hub.own.splice(at, 1);
        resolve();
      }, RETURN_WAIT_MS),
    };
    hub.own.push(item);
    try {
      history.go?.(delta);
    } catch {
      clearTimeout(item.timer);
      hub.own.splice(hub.own.indexOf(item), 1);
      resolve();
    }
  });
}

/**
 * Rule 2: Start on the home pushes the start screen's entry; Start on the start screen pushes the
 * lesson's (both inside the tap). An entry already on that step is written over. `raw`: the deck's
 * fragment (null: a deck too long for a link, which still runs; a reload then shows the home).
 */
export function pushPresenterEntry(
  step: 'ready' | 'running',
  raw: string | null,
  options: { fresh?: boolean; preset?: LecturePreset } = {},
  env: PresenterEnv = browserEnv(),
): Promise<void> {
  return queue(() => {
    const { mode, entry } = pushPlan(readEntry(env.history?.state), step, {
      ...(raw !== null ? { fragment: raw } : {}),
      ...(options.fresh === true ? { fresh: true as const } : {}),
      ...(options.preset !== undefined ? { preset: options.preset } : {}),
    });
    if (mode === 'push') pushEntry(env, entry);
    else replaceEntry(env, entry);
  });
}

/** Rule 7: on the home, a placeholder entry is pushed and stepped back from, so the entries ahead (and their deck) are gone. */
async function clearForward(env: PresenterEnv): Promise<void> {
  const here = readEntry(env.history?.state);
  // The home's kept state stays with it (history rule 9).
  replaceEntry(env, {
    step: 'home',
    index: 0,
    ...(here?.homeBack !== undefined ? { homeBack: here.homeBack } : {}),
    ...(here?.step === 'home' && here.home !== undefined ? { home: here.home } : {}),
  });
  if (typeof env.history?.pushState !== 'function') return;
  try {
    env.history.pushState(entryState({ step: 'home', index: 1, ...(here?.homeBack !== undefined ? { homeBack: here.homeBack } : {}) }), '', cleanAddress(env));
  } catch {
    return;
  }
  await goIgnored(env, -1);
}

/**
 * Back to the home entry from the start screen or the lesson (Back to lessons, the phone footer's
 * Back, Exit, an invalid deck): `history.go(-hrIndex)`, then the entries ahead are cleared (rule 7),
 * so neither the home nor any entry ahead keeps a deck and the browser's Back on the home then
 * leaves the presenter. Its own popstates are not reported to `subscribePresenterPop`.
 */
export function returnToPresenterHome(env: PresenterEnv = browserEnv()): Promise<void> {
  return queue(async () => {
    await goIgnored(env, -stepsToHome(readEntry(env.history?.state)));
    await clearForward(env);
  });
}

/** The browser landed on the home from a deck (a back from the start screen): clear the entries ahead (rule 7). */
export function clearPresenterForward(env: PresenterEnv = browserEnv()): Promise<void> {
  return queue(() => clearForward(env));
}

/** One step back (ignored): a lesson not yet begun back to its start screen, or a Forward onto an entry the screen is not on. */
export function stepBackPresenter(env: PresenterEnv = browserEnv()): Promise<void> {
  return queue(() => goIgnored(env, -1));
}

/** Calls `handler` with the entry the browser's Back (or Forward) landed on; the presenter's own steps are not reported. */
export function subscribePresenterPop(handler: (landed: HistoryEntry | null) => void, env: PresenterEnv = browserEnv()): () => void {
  const hub = hubOf(env);
  if (hub === null) return () => undefined;
  hub.handlers.add(handler);
  return () => {
    hub.handlers.delete(handler);
  };
}

/**
 * The home's Back (rule 5): back to the page before `/present` when the tab came from a page of
 * this origin (`presenterHomeBack`), with a fallback to `/` when the page has not started to leave
 * after `LEAVE_WAIT_MS`; otherwise (every new tab the console, All lessons and E5 open) to `/`.
 */
export function leavePresenter(env: PresenterEnv = browserEnv()): void {
  const toRoot = (): void => env.assign?.('/');
  const history = env.history;
  if (!presenterHomeBack(env) || typeof history?.go !== 'function') {
    toRoot();
    return;
  }
  let left = false;
  const onLeave = (): void => {
    left = true;
  };
  env.window?.addEventListener('pagehide', onLeave);
  env.window?.addEventListener('beforeunload', onLeave);
  setTimeout(() => {
    env.window?.removeEventListener('pagehide', onLeave);
    env.window?.removeEventListener('beforeunload', onLeave);
    if (!left) toRoot();
  }, LEAVE_WAIT_MS);
  try {
    history.go(-(1 + stepsToHome(readEntry(history.state))));
  } catch {
    // The timer leaves by address.
  }
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
 * the other tabs. Offline or with nothing newer, it reloads at once.
 *
 * One deadline covers the whole flow: every stage (registration, update, install, the tab ping,
 * the takeover) gets only what is left of `ms`, so the page reloads exactly once, `ms` after the
 * tap at the latest. Resolves once the reload has been asked for. Never throws.
 *
 * Limit: a background tab the browser has frozen or discarded (tab freezing, the back-forward
 * cache) cannot answer the ping in time and counts as closed, so a takeover can still reach it;
 * that is why the page's line asks to close the other tabs first.
 */
export function reloadForUpdate(raw: string, env: PresenterEnv = browserEnv(), ms: number = UPDATE_WAIT_MS): Promise<void> {
  holdOpenDeck(raw, {}, env);
  const start = Date.now();
  const left = (): number => Math.max(0, ms - (Date.now() - start));
  return new Promise<void>((resolve) => {
    let done = false;
    const once = (): void => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      try {
        env.reload?.();
      } catch {
        // The reload itself is the browser's.
      }
      resolve();
    };
    const deadline = setTimeout(once, ms);
    const flow = async (): Promise<void> => {
      const reg = await registration(env, left());
      if (done) return;
      if (!reg) return once();
      await within(Promise.resolve().then(() => reg.update()), left());
      if (done) return;
      const waiting = reg.waiting ?? (reg.installing ? await installed(reg.installing, left()) : undefined);
      if (done) return;
      if (!waiting) return once();
      const others = await otherTabsOpen(env, Math.min(TABS_WAIT_MS, left()));
      if (done) return;
      if (others) return once();
      env.serviceWorker?.addEventListener?.('controllerchange', once);
      waiting.postMessage({ type: 'SKIP_WAITING' });
    };
    flow().catch(once);
  });
}

/** The fixed tab title (`learner.presenter.docTitle`); the deck title never goes here (section 3.2). */
export function setPresenterDocTitle(title: string, env: PresenterEnv = browserEnv()): void {
  if (env.document) env.document.title = title;
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

/**
 * The kind of the last input on the page: a pointer (mouse, touch, pen) or a key. A focus that
 * follows a pointer press, or that a dialog gives back after one, is the pointer's; one that follows
 * a key is a keyboard or switch user's (the phone bar stays on screen for those, section 3.6).
 */
export function subscribeInputKind(handler: (kind: 'pointer' | 'key') => void, env: PresenterEnv = browserEnv()): () => void {
  const target = env.window;
  if (!target) return () => undefined;
  const onPointer = (): void => handler('pointer');
  const onKey = (): void => handler('key');
  target.addEventListener('pointerdown', onPointer);
  target.addEventListener('touchstart', onPointer);
  target.addEventListener('keydown', onKey);
  return () => {
    target.removeEventListener('pointerdown', onPointer);
    target.removeEventListener('touchstart', onPointer);
    target.removeEventListener('keydown', onKey);
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
