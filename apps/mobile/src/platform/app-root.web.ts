import { isLearnerRoot } from '@hangul-route/content-schema';
import { parseBootIntent, type BootIntent } from '../logic/shell/boot-intent';
import { bounceFor } from '../logic/shell/bounce';
import { clearGrownUpTab, forgetFreshPin, sessionArea, trackThenLeave, type SessionArea } from './grown-up-handoff.web';
import { track, type TelemetryEvent } from './telemetry';

/**
 * Which root of the learner web build mounts, and what it does first (F-APP-001 sections 3.4,
 * 3.9 and 3.11; F-BROWSE-001 section 4.1). `index.ts` calls `bootRoot()` before anything mounts,
 * so a root other than the app runs none of the learner boot. Order: `/present` (F-TCH-004 PR 6
 * adds its branch), `/browse`, the grown-up bounce, else the app.
 *
 * - **app**: reads the boot intent once and takes it out of the address (`history.replaceState`,
 *   keeping every other key, `?lang=` included). It removes the grown-up unlock and the console
 *   session of this tab, with a `gate=grown-up` intent too: the lock that sent the tab here
 *   already removed the console session, and the unlock it could not use is replaced after the
 *   PIN, so nothing of value is lost and an intent typed by hand keeps nothing either. A page
 *   restored from the back/forward cache clears them again and forgets the fresh PIN and the
 *   parent gate session held in memory, so a tab handed back to a learner is locked again however
 *   it came back.
 * - **browse**: `/browse` mounts `BrowseApp` (F-BROWSE-001 BR-6), which runs none of the learner
 *   boot here: it reads no boot intent, and this chooser clears neither the unlock nor the console
 *   session (F-BROWSE-001 BD1 and section 4.10: in a tab that can go back, [ Close ] returns to the
 *   console page that opened it, which still needs both; F-APP-001 section 6.4 as amended by
 *   F-BROWSE-001 BR-0b). `BrowseApp` does its own boot, and removes both itself in a tab with no
 *   earlier page to go back to (`platform/browse-start.ts`); otherwise it touches `sessionStorage`
 *   only for its pass.
 * - **grown-up-bounce**: the host's single-page fallback answered a grown-up URL that has no
 *   file. Nothing mounts; `shell.path_bounced` names the prefix and the tab moves to the persona
 *   entry (`logic/shell/bounce.ts`). It clears nothing: the tab stays in the grown-up area.
 */
export type AppRoot = 'browse' | 'grown-up-bounce' | 'app';

const BROWSE_ROOT = '/browse';

/** Roots that mount the learner `App`, and so boot as it does. `browse` mounts `BrowseApp` instead. */
const LEARNER_APP_ROOTS: ReadonlySet<AppRoot> = new Set<AppRoot>(['app']);

export function pickRoot(location: { pathname: string }): AppRoot {
  const { pathname } = location;
  // `isLearnerRoot` owns the prefix rule (end, `/`, `?` or `.` after the root), so `/browsex` stays the app.
  if (pathname.startsWith(BROWSE_ROOT) && isLearnerRoot(pathname)) return 'browse';
  if (bounceFor(pathname) !== null) return 'grown-up-bounce';
  return 'app';
}

export interface RootEnv {
  location: { pathname: string; search: string; hash: string; replace: (url: string) => void } | null;
  history: { state: unknown; replaceState: (state: unknown, unused: string, url: string) => void } | null;
  area: () => SessionArea | null;
  track: (event: TelemetryEvent) => Promise<boolean>;
  wait?: (ms: number) => Promise<void>;
  /** Calls `handler` when the page comes back from the back/forward cache. */
  onRestore?: (handler: () => void) => void;
  /** Forgets this tab's in-memory fresh PIN and parent gate session (on a restore). */
  forgetPin?: () => void;
}

let intent: BootIntent | null = null;

function onPageRestore(handler: () => void): void {
  try {
    const target = globalThis as { addEventListener?: (type: string, listener: (event: { persisted?: boolean }) => void) => void };
    target.addEventListener?.('pageshow', (event) => {
      if (event.persisted === true) handler();
    });
  } catch {
    // No window events: nothing is restored from a cache either.
  }
}

function browserEnv(): RootEnv {
  const w = globalThis as { location?: RootEnv['location']; history?: RootEnv['history'] };
  return {
    location: w.location ?? null,
    history: w.history ?? null,
    area: sessionArea,
    track: (event) => track(event),
    onRestore: onPageRestore,
    forgetPin: forgetFreshPin,
  };
}

function readIntent(env: RootEnv, location: NonNullable<RootEnv['location']>): void {
  const parsed = parseBootIntent(location.search);
  intent = parsed.intent;
  if (!parsed.changed) return;
  try {
    env.history?.replaceState(env.history.state, '', `${location.pathname}${parsed.search}${location.hash}`);
  } catch {
    // A history that refuses (a sandboxed frame) must not lose the intent.
  }
}

function bootLearnerApp(env: RootEnv, location: NonNullable<RootEnv['location']>, root: AppRoot): void {
  if (root === 'app') readIntent(env, location);
  clearGrownUpTab(env.area());
  // A restored page also forgets the PIN it saw before it left: Back from a grown-up page within
  // 2 minutes of a PIN must not let the next tap skip the PIN (A-6 review).
  env.onRestore?.(() => {
    clearGrownUpTab(env.area());
    env.forgetPin?.();
  });
}

/** Picks the root and runs its boot step; call once, before anything mounts. */
export function bootRoot(env: RootEnv = browserEnv()): AppRoot {
  intent = null;
  const { location } = env;
  if (!location) return 'app';
  const root = pickRoot(location);
  if (LEARNER_APP_ROOTS.has(root)) {
    bootLearnerApp(env, location, root);
  } else if (root === 'grown-up-bounce') {
    const bounce = bounceFor(location.pathname, location.search);
    if (bounce) {
      void trackThenLeave({ name: 'shell.path_bounced', payload: { prefix: bounce.prefix } }, () => location.replace(bounce.target), env);
    }
  }
  return root;
}

/** The boot intent the app root read, until the navigator acts on it (`consumeBootIntent`). */
export function peekBootIntent(): BootIntent | null {
  return intent;
}

export function consumeBootIntent(): void {
  intent = null;
}
