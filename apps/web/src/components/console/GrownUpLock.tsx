'use client';

import { GROWN_UP_LOCK_CHANNEL, unlockActive, type GrownUpUnlock, type UiLocale } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { lockPasskeyEnabled } from '@/lib/console/config';
import { readDeviceGate } from '@/lib/console/device-marker';
import { decideGrownUpLock, learnerHome, pinPathUrl, signInAgainUrl, type DeviceGateRead, type LockDecision } from '@/lib/console/grown-up-lock';
import { hiddenTooLong, isGrownUpLockMessage, passkeyButtonShown, pinOwnerFingerprint, pinOwnerRefresh, platformAuthenticatorAvailable, realPinEpoch } from '@/lib/console/one-account';
import { clearSession } from '@/lib/console/session';
import { readPinOwner, readTrustedEpoch, writePinOwner } from '@/lib/console/shell-store';
import { clearGrownUpTab, clearUnlock, readHiddenAt, readUnlock, touchUnlock, writeHiddenAt, writeSignInUnlock } from '@/lib/console/unlock';
import { useLocale, useMessages } from '@/lib/i18n/locale-context';
import { DisplayButton } from './DisplaySheet';
import { headRem, rem } from '@/lib/console/rem';

/**
 * The grown-up lock (F-APP-001 section 3.9, OD-3; wireframe design/wireframes/shell/grown-up-lock.md).
 * Wraps every grown-up page except `/signin`. Before the decision it renders no page content;
 * locked, it renders the lock screen and removes the console session from this tab; open, it
 * renders the page. The decision itself is `lib/console/grown-up-lock.ts`.
 *
 * Contract for the layouts that mount it (A-4b, A-5a): every provider that calls the API
 * (`useConsole`, the frame's spaces fetch for the persona switch) and every frame data fetch must
 * sit inside `GrownUpLock`. Only its children wait for the decision, so anything outside it would
 * call the API, and could show grown-up data, before the lock decides.
 *
 * Re-checks:
 * - a new pathname (a client navigation to another page) decides again before that page renders;
 *   a query-only change (a page's own `router.replace`) keeps the page mounted and re-checks in
 *   the background;
 * - a back/forward-cache restore covers the page before the next paint and decides again;
 * - on a page that only an unlock keeps open (a device that can lock), leaving the tab covers it
 *   and the return decides again; a pointer, key, click or wheel refreshes `seen` within the 15
 *   idle minutes, and after them is stopped, covers the page and decides again.
 * The page is covered, never collapsed, so its layout, scroll position and focus survive a
 * re-check that opens it again (A-4a review 2026-10-12).
 *
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 7.2, 7.4 and 7.6 (row OA-3):
 * - a tab hidden for at least 5 minutes drops its unlock when it is shown again (wall clock, not a timer; CS-14); the
 *   hidden time is also kept in this tab's `sessionStorage` (`hr:grownup:hiddenAt`), so a background tab the browser
 *   discarded, or a page loaded while hidden, still drops it when it is shown (a page left by a navigation keeps none);
 * - a `{ v: 1, kind: 'lock' }` on the `hr-grownup` BroadcastChannel (the learner app's chooser opened) drops the
 *   unlock and shows the lock (CS-2); anything else on the channel is ignored;
 * - a page opened through the PIN path refreshes the PIN owner's epoch, for the same owner only (moment 2);
 * - **Use a passkey** shows where the browser offers a platform authenticator and the marker is not `pin` (CS-17).
 */

/** How long a device or trusted-epoch read may take before the lock decides without it. */
export const LOCK_READ_TIMEOUT_MS = 3_000;

/** Everything the lock touches in the browser, injectable for tests. */
export interface GrownUpLockEnvironment {
  now: () => number;
  readDevice: () => Promise<DeviceGateRead>;
  readTrustedEpoch: () => Promise<number | null>;
  readUnlock: () => GrownUpUnlock | null;
  touchUnlock: (now: number) => void;
  clearConsoleSession: () => void;
  clearGrownUpTab: () => void;
  origin: () => string;
  assign: (url: string) => void;
  window: EventTarget | null;
  document: (EventTarget & { visibilityState: DocumentVisibilityState }) | null;
  /** [OA] Drops this tab's unlock only (the 5-minute hidden rule, the `hr-grownup` message). */
  clearUnlock?: () => void;
  /** [OA] Listens on `hr-grownup`; returns the way to stop. Null where the browser has no BroadcastChannel. */
  listenLock?: (onMessage: (data: unknown) => void) => (() => void) | null;
  /** [OA] Moment 2 of section 7.2: the page opened through the PIN path at `epoch` for `accountId`. */
  refreshPinOwner?: (accountId: string, epoch: number) => Promise<void>;
  /** [OA] Whether the browser offers a user-verifying platform authenticator. */
  passkeyAvailable?: () => Promise<boolean>;
  /** [OA] The `signin` unlock a passkey success writes. */
  writeSignInUnlock?: (now: number) => void;
  /** [OA] The hidden time kept in this tab's `sessionStorage` (the 5-minute rule across a discard and reload). */
  readHiddenAt?: () => number | null;
  /** [OA] Stores the hidden time; `null` removes it. */
  writeHiddenAt?: (at: number | null) => void;
}

/** [OA] The browser's `hr-grownup` channel, or null without BroadcastChannel. */
function listenLockChannel(onMessage: (data: unknown) => void): (() => void) | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    const channel = new BroadcastChannel(GROWN_UP_LOCK_CHANNEL);
    channel.onmessage = (event: MessageEvent) => onMessage(event.data);
    return () => channel.close();
  } catch {
    return null;
  }
}

/** [OA] Moment 2: refreshes the stored owner's epoch when this account is that owner; writes nothing otherwise. */
export async function refreshPinOwnerHere(accountId: string, epoch: number): Promise<void> {
  const [stored, owner] = await Promise.all([readPinOwner(), pinOwnerFingerprint(accountId)]);
  const next = pinOwnerRefresh({ stored, owner, epoch });
  if (next) await writePinOwner(next);
}

export function browserLockEnvironment(): GrownUpLockEnvironment {
  const win = typeof window === 'undefined' ? null : window;
  const doc = typeof document === 'undefined' ? null : document;
  return {
    now: () => Date.now(),
    readDevice: () => readDeviceGate(),
    readTrustedEpoch: () => readTrustedEpoch(),
    readUnlock: () => readUnlock(),
    touchUnlock: (now) => {
      touchUnlock(now);
    },
    clearConsoleSession: () => clearSession(),
    clearGrownUpTab: () => clearGrownUpTab(),
    origin: () => win?.location.origin ?? '',
    assign: (url) => win?.location.assign(url),
    window: win,
    document: doc,
    clearUnlock: () => clearUnlock(),
    listenLock: listenLockChannel,
    refreshPinOwner: refreshPinOwnerHere,
    passkeyAvailable: () => platformAuthenticatorAvailable(win as unknown as Parameters<typeof platformAuthenticatorAvailable>[0]),
    writeSignInUnlock: (now) => {
      writeSignInUnlock(now);
    },
    readHiddenAt: () => readHiddenAt(),
    writeHiddenAt: (at) => writeHiddenAt(at),
  };
}

/** A decision, the pathname it was made for, and whether the page is covered while a re-check runs. */
export interface LockState {
  path: string;
  decision: LockDecision;
  hidden: boolean;
}

export interface GrownUpLockController {
  /** Listens for back/forward-cache restores, tab switches and interaction. */
  start: () => void;
  /** Reads and decides for the current path; only the latest check reports. */
  check: () => void;
  stop: () => void;
}

/**
 * A device read that failed or hung (WebKit can hang the first IndexedDB open) counts as a
 * device that may hold learner profiles: a sign-in opens it, nothing else does.
 */
const FAILED_READ: DeviceGateRead = { readable: false, reason: 'failed' };

/** The read's value, or `fallback` when it throws, rejects or takes longer than `ms`. */
function settle<T>(read: () => Promise<T>, fallback: T, ms: number): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    const done = (value: T): void => {
      clearTimeout(timer);
      resolve(value);
    };
    try {
      read().then(done, () => done(fallback));
    } catch {
      done(fallback);
    }
  });
}

const CAPTURE: AddEventListenerOptions = { capture: true };
const PASSIVE_CAPTURE: AddEventListenerOptions = { capture: true, passive: true };
/** Interaction that can be stopped before it reaches the page, and the one that cannot (wheel is passive). */
const STOPPABLE_INPUT = ['pointerdown', 'keydown', 'click'] as const;

export function createGrownUpLockController(options: {
  env: GrownUpLockEnvironment;
  getPath: () => string;
  /** [OA] `device`: the read this decision used (the passkey button reads its marker). */
  onState: (state: LockState, device?: DeviceGateRead) => void;
  /** Must cover the page before the next paint (the component flushes synchronously). */
  onHide: () => void;
  readTimeoutMs?: number;
  /** [OA] The page opened through the PIN path (a `pin` unlock, all three epochs equal) at this epoch. */
  onPinOpen?: (epoch: number) => void;
}): GrownUpLockController {
  const { env, getPath, onState, onHide, readTimeoutMs = LOCK_READ_TIMEOUT_MS, onPinOpen } = options;
  /** [OA] When the tab was last hidden (wall clock), for the 5-minute rule. */
  let hiddenAt: number | null = null;
  /** [OA] The page is being left (`pagehide`): its hidden time is not kept for the next page of this tab. */
  let leaving = false;
  const storeHiddenAt = (at: number | null): void => {
    try {
      env.writeHiddenAt?.(at);
    } catch {
      // Storage refused: the in-memory time still applies to this page.
    }
  };
  const storedHiddenAt = (): number | null => {
    try {
      return env.readHiddenAt?.() ?? null;
    } catch {
      return null;
    }
  };
  let stopLockChannel: (() => void) | null = null;
  const dropUnlock = (): void => {
    try {
      (env.clearUnlock ?? env.clearGrownUpTab)();
    } catch {
      // Storage refused: the decision that follows reads whatever is left.
    }
  };
  let latest = 0;
  let stopped = false;
  /** The page is open. */
  let open = false;
  /** The page is open only because of an unlock: without it the device would be locked. */
  let guarded = false;
  /** The open page is covered while a re-check runs. */
  let covered = false;

  const readUnlockSafely = (): GrownUpUnlock | null => {
    try {
      return env.readUnlock();
    } catch {
      return null;
    }
  };

  const run = async (): Promise<void> => {
    const id = ++latest;
    const path = getPath();
    const [device, trustedEpoch] = await Promise.all([settle(env.readDevice, FAILED_READ, readTimeoutMs), settle(env.readTrustedEpoch, null, readTimeoutMs)]);
    if (stopped || id !== latest) return;
    const now = env.now();
    const input = { device, unlock: readUnlockSafely(), trustedEpoch, now };
    const decision = decideGrownUpLock(input);
    open = decision.state === 'open';
    guarded = open && decideGrownUpLock({ ...input, unlock: null }).state === 'locked';
    covered = false;
    if (decision.state === 'locked') env.clearConsoleSession();
    else env.touchUnlock(now);
    // [OA] Moment 2 (section 7.2): only the PIN path, never a sign-in unlock, refreshes the owner's epoch.
    const epoch = realPinEpoch(device);
    if (open && onPinOpen && epoch !== null && input.unlock?.src === 'pin' && unlockActive(input.unlock, now) && input.unlock.pinEpoch === epoch && trustedEpoch === epoch) onPinOpen(epoch);
    onState({ path, decision, hidden: false }, device);
  };

  const cover = (): void => {
    if (open) covered = true;
    onHide();
  };
  const recheck = (): void => {
    cover();
    void run();
  };
  const onPageShow = (event: Event): void => {
    leaving = false;
    if ((event as PageTransitionEvent).persisted) recheck();
  };
  // Covered before the page enters the back/forward cache, so a restore never paints it.
  const onPageHide = (event: Event): void => {
    // [OA] A navigation away (a same-tab round trip, Stripe Checkout included) keeps no hidden time for the next page;
    // a back/forward-cache restore still has the in-memory one.
    leaving = true;
    storeHiddenAt(null);
    if ((event as PageTransitionEvent).persisted) cover();
  };
  const onVisibility = (): void => {
    const visibility = env.document?.visibilityState;
    // Covered before the tab switcher takes its picture; a page that cannot lock is left as it is.
    if (visibility === 'hidden') {
      hiddenAt = env.now();
      if (!leaving) storeHiddenAt(hiddenAt);
      if (guarded) cover();
      return;
    }
    if (visibility !== 'visible') return;
    // [OA] OA-D16, CS-14: hidden for 5 minutes or more (wall clock) drops the unlock before the decision.
    const dropped = hiddenTooLong(hiddenAt ?? storedHiddenAt(), env.now());
    hiddenAt = null;
    storeHiddenAt(null);
    if (dropped) dropUnlock();
    if (guarded || dropped) recheck();
    else void run();
  };
  // [OA] Section 7.6, CS-2: the learner app's chooser opened in another tab.
  const onLockMessage = (data: unknown): void => {
    if (stopped || !isGrownUpLockMessage(data)) return;
    dropUnlock();
    recheck();
  };
  const interact = (event: Event, stoppable: boolean): void => {
    const stop = (): void => {
      if (!stoppable) return;
      event.preventDefault();
      event.stopPropagation();
    };
    // A re-check is covering the page: nothing reaches it until the decision.
    if (covered) {
      stop();
      return;
    }
    if (!guarded) return;
    const now = env.now();
    if (unlockActive(readUnlockSafely(), now)) {
      env.touchUnlock(now);
      return;
    }
    // The 15 idle minutes ran out while the page stayed open: stop this action, cover, decide again.
    stop();
    recheck();
  };
  const onInput = (event: Event): void => interact(event, true);
  const onWheel = (event: Event): void => interact(event, false);

  return {
    start: () => {
      // [OA] A tab the browser discarded while hidden (or restored after a crash) reloads with its unlock but without
      // the in-memory time: the stored one decides before the first check. A page loaded while hidden starts its clock.
      const stored = storedHiddenAt();
      if (env.document?.visibilityState === 'hidden') {
        hiddenAt = stored ?? env.now();
        storeHiddenAt(hiddenAt);
      } else if (stored !== null) {
        if (hiddenTooLong(stored, env.now())) dropUnlock();
        storeHiddenAt(null);
      }
      env.window?.addEventListener('pageshow', onPageShow);
      env.window?.addEventListener('pagehide', onPageHide);
      env.document?.addEventListener('visibilitychange', onVisibility);
      for (const type of STOPPABLE_INPUT) env.window?.addEventListener(type, onInput, CAPTURE);
      env.window?.addEventListener('wheel', onWheel, PASSIVE_CAPTURE);
      stopLockChannel = env.listenLock?.(onLockMessage) ?? null;
    },
    check: () => {
      if (!stopped) void run();
    },
    stop: () => {
      stopped = true;
      env.window?.removeEventListener('pageshow', onPageShow);
      env.window?.removeEventListener('pagehide', onPageHide);
      env.document?.removeEventListener('visibilitychange', onVisibility);
      for (const type of STOPPABLE_INPUT) env.window?.removeEventListener(type, onInput, CAPTURE);
      env.window?.removeEventListener('wheel', onWheel, PASSIVE_CAPTURE);
      stopLockChannel?.();
      stopLockChannel = null;
    },
  };
}

/**
 * [OA] Section 7.6 (CS-2, CS-14) on an exempt page (`/signin`), where no lock controller runs: the tab still drops its
 * unlock on the `hr-grownup` lock message and after 5 minutes hidden (wall clock), so a fresh PIN unlock carried into
 * the sign-in (moment 1 of section 7.2) cannot outlive the chooser opening in another tab or a long absence. It decides
 * nothing and covers nothing; the page it returns to decides as usual. Returns the way to stop.
 */
export function startExemptGuard(env: GrownUpLockEnvironment): () => void {
  let stopped = false;
  let hiddenAt: number | null = env.document?.visibilityState === 'hidden' ? env.now() : null;
  const drop = (): void => {
    try {
      (env.clearUnlock ?? env.clearGrownUpTab)();
    } catch {
      // Storage refused: nothing else to drop.
    }
  };
  const onVisibility = (): void => {
    const visibility = env.document?.visibilityState;
    if (visibility === 'hidden') {
      hiddenAt = env.now();
      return;
    }
    if (visibility !== 'visible') return;
    const dropped = hiddenTooLong(hiddenAt, env.now());
    hiddenAt = null;
    if (dropped) drop();
  };
  env.document?.addEventListener('visibilitychange', onVisibility);
  const stopChannel =
    env.listenLock?.((data) => {
      if (!stopped && isGrownUpLockMessage(data)) drop();
    }) ?? null;
  return () => {
    stopped = true;
    env.document?.removeEventListener('visibilitychange', onVisibility);
    stopChannel?.();
  };
}

type LockedDecision = Extract<LockDecision, { state: 'locked' }>;

export type LockView = { kind: 'pending' } | { kind: 'open'; hidden: boolean } | { kind: 'locked'; decision: LockedDecision; device?: DeviceGateRead };

/** Pending until a decision exists for this very pathname; the lock screen shows no data, so it stays during a re-check. */
export function lockView(state: LockState | null, path: string, device?: DeviceGateRead): LockView {
  if (!state || state.path !== path) return { kind: 'pending' };
  if (state.decision.state === 'open') return { kind: 'open', hidden: state.hidden };
  return device ? { kind: 'locked', decision: state.decision, device } : { kind: 'locked', decision: state.decision };
}

/** The page the lock returns to: the pathname and its query (with or without a leading `?`). */
export function returnPath(pathname: string, search = ''): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  return query ? `${pathname}?${query}` : pathname;
}

interface LockHandlers {
  onUsePin: () => void;
  onSignInAgain: () => void;
  onBackToLearning: () => void;
  /** [OA] Use a passkey (section 7.4); absent, the button is not drawn. */
  onUsePasskey?: () => void;
  /** [OA] A passkey check is running: the button is `aria-disabled` and `aria-busy`. */
  passkeyBusy?: boolean;
}

/** The three lock buttons for the page at `path` (pathname and query); Sign in again and Back to learning carry the console's language. */
export function lockActions(env: GrownUpLockEnvironment, path: string, onSignInAgain: (signInUrl: string) => void, locale: UiLocale): LockHandlers {
  return {
    onUsePin: () => env.assign(pinPathUrl(path)),
    onSignInAgain: () => onSignInAgain(signInAgainUrl(path, locale)),
    onBackToLearning: () => {
      env.clearGrownUpTab();
      env.assign(learnerHome(env.origin(), locale));
    },
  };
}

/** Above every layer of the design system, opaque, over the whole viewport. */
const coverStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: Math.max(...Object.values(z)),
  backgroundColor: colors.surface.canvas,
};

export function GrownUpLockGate({ view, children, passkeyShown, ...handlers }: LockHandlers & { view: LockView; children: ReactNode; passkeyShown?: (device: DeviceGateRead | undefined) => boolean }): JSX.Element {
  if (view.kind === 'pending') return <div aria-busy="true" data-testid="grown-up-lock-pending" />;
  if (view.kind === 'locked') {
    // [OA] Use a passkey only off `pin` browsers (section 7.4, CS-17).
    const { onUsePasskey, ...rest } = handlers;
    return <GrownUpLockScreen decision={view.decision} {...rest} onUsePasskey={onUsePasskey && passkeyShown?.(view.device) ? onUsePasskey : undefined} />;
  }
  // One wrapper in both states: covering during a re-check keeps the page mounted, laid out and
  // focused where it was (a half-typed form survives, the scroll position does not jump).
  return (
    <>
      <div aria-hidden={view.hidden || undefined} data-testid="grown-up-content">
        {children}
      </div>
      {view.hidden ? <div aria-hidden="true" data-testid="grown-up-cover" style={coverStyle} /> : null}
    </>
  );
}

export interface GrownUpLockProps {
  children: ReactNode;
  /** This page's pathname, the decision key: a new one (a client navigation to another page) decides again before that page renders. */
  pathname: string;
  /** This page's query, with or without `?`: a change keeps the page mounted and re-checks in the background; the lock's return targets carry it. */
  search?: string;
  /** `/signin` is exempt (section 3.7). */
  exempt?: boolean;
  /** Sign in again: sign out, then go to `signInUrl` (`/signin?next=…`). */
  onSignInAgain: (signInUrl: string) => void;
  environment?: GrownUpLockEnvironment;
  /** [OA] The signed-in account (fingerprinted for moment 2 of section 7.2, never shown or stored). */
  accountId?: string | null;
  /** [OA] Clerk reverification with the passkey first factor; true on success. Absent outside Clerk mode: no button. */
  verifyPasskey?: () => Promise<boolean>;
  /** [OA] `NEXT_PUBLIC_LOCK_PASSKEY`, read once by default. */
  passkeyFlag?: boolean;
}

export function GrownUpLock({ children, pathname, search = '', exempt = false, onSignInAgain, environment, accountId = null, verifyPasskey, passkeyFlag }: GrownUpLockProps): JSX.Element {
  const locale = useLocale();
  const [state, setState] = useState<LockState | null>(null);
  const [passkeyOffered, setPasskeyOffered] = useState(false);
  const [device, setDevice] = useState<DeviceGateRead | undefined>(undefined);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const accountRef = useRef(accountId);
  accountRef.current = accountId;
  const flag = passkeyFlag ?? lockPasskeyEnabled();
  const pathRef = useRef(pathname);
  const decidedPathRef = useRef<string | null>(null);
  const envRef = useRef<GrownUpLockEnvironment | null>(environment ?? null);
  const controllerRef = useRef<GrownUpLockController | null>(null);
  const envOf = (): GrownUpLockEnvironment => (envRef.current ??= browserLockEnvironment());

  useEffect(() => {
    // [OA] An exempt page still drops the unlock on the lock message and after 5 minutes hidden (section 7.6).
    if (exempt) return startExemptGuard(envOf());
    const controller = createGrownUpLockController({
      env: envOf(),
      getPath: () => pathRef.current,
      onState: (next, read) => {
        setDevice(read);
        setState(next);
      },
      onHide: () => flushSync(() => setState((s) => (s && !s.hidden ? { ...s, hidden: true } : s))),
      onPinOpen: (epoch) => {
        const account = accountRef.current;
        const refresh = envOf().refreshPinOwner;
        if (account && refresh) void refresh(account, epoch).catch(() => undefined);
      },
    });
    controllerRef.current = controller;
    controller.start();
    return () => {
      controller.stop();
      controllerRef.current = null;
      // A return from an exempt page (/signin) decides again before the page renders.
      setState(null);
    };
    // The controller lives as long as the exemption does; envOf and the path are read through refs.
  }, [exempt]);

  useEffect(() => {
    pathRef.current = pathname;
    if (decidedPathRef.current !== pathname) {
      decidedPathRef.current = pathname;
      // A decision from an earlier visit to a pathname is never reused (X, then Y, then X again).
      setState(null);
    }
    controllerRef.current?.check();
  }, [pathname, search, exempt]);

  // [OA] Section 7.4: asked once per mount, only where a passkey could be offered at all.
  const askPasskey = !exempt && flag && !!verifyPasskey;
  useEffect(() => {
    if (!askPasskey) return undefined;
    let live = true;
    const available = envOf().passkeyAvailable;
    if (available) void available().then((yes) => live && setPasskeyOffered(yes === true), () => undefined);
    return () => {
      live = false;
    };
  }, [askPasskey]);

  const onUsePasskey =
    askPasskey && verifyPasskey
      ? () => {
          if (passkeyBusy) return;
          setPasskeyBusy(true);
          void verifyPasskey()
            .catch(() => false)
            .then((verified) => {
              setPasskeyBusy(false);
              // A refusal returns to the lock with its existing line; a success is a secret-proving sign-in here.
              if (!verified) return undefined;
              const env = envOf();
              // [OA] CS-17: the marker is read again, so a PIN set in another tab while the passkey ran keeps this lock.
              return settle(env.readDevice, FAILED_READ, LOCK_READ_TIMEOUT_MS).then((fresh) => {
                if (passkeyButtonShown({ flag, available: passkeyOffered, device: fresh })) env.writeSignInUnlock?.(env.now());
                controllerRef.current?.check();
              });
            });
        }
      : undefined;

  if (exempt) return <>{children}</>;
  return (
    <GrownUpLockGate
      view={lockView(state, pathname, device)}
      {...lockActions(envOf(), returnPath(pathname, search), onSignInAgain, locale)}
      onUsePasskey={onUsePasskey}
      passkeyBusy={passkeyBusy}
      passkeyShown={(device) => passkeyButtonShown({ flag, available: passkeyOffered, device: device ?? null })}
    >
      {children}
    </GrownUpLockGate>
  );
}

const TITLE_ID = 'grown-up-lock-title';

/** [OA] Shared with `/account/pin-reset` (row OA-6), which draws the lock's single card. */
export const pageStyle: CSSProperties = {
  minHeight: '100vh',
  boxSizing: 'border-box',
  padding: spacing.lg,
  backgroundColor: colors.surface.canvas,
  color: colors.text.primary,
};

export const columnStyle: CSSProperties = { maxWidth: layout.maxWidth.reading, margin: '0 auto' };

export const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: spacing.md,
  marginTop: spacing.xl,
  padding: `${spacing.xxl}px ${spacing.lg}px`,
  textAlign: 'center',
  backgroundColor: colors.surface.paper,
  borderRadius: radii.lg,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
};

const buttonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.sm,
  minHeight: touchTarget.min,
  boxSizing: 'border-box',
  padding: `${spacing.sm}px ${spacing.xl}px`,
  borderRadius: radii.pill,
  fontSize: rem(typography.size.body),
  fontWeight: typography.weight.bold,
  cursor: 'pointer',
};

const TONE: Readonly<Record<'primary' | 'secondary' | 'quiet', CSSProperties>> = {
  primary: { width: '100%', maxWidth: layout.pane.master, backgroundColor: colors.brand.primary, color: colors.text.onPrimary, border: `${borderWidth.thin}px solid ${colors.brand.primary}` },
  secondary: { width: '100%', maxWidth: layout.pane.master, backgroundColor: colors.surface.paper, color: colors.text.primary, border: `${borderWidth.thin}px solid ${colors.border.strong}` },
  quiet: { paddingLeft: spacing.sm, backgroundColor: 'transparent', color: colors.text.secondary, border: 'none' },
};

export function LockButton({ tone, onClick, testId, busy, children }: { tone: keyof typeof TONE; onClick: () => void; testId: string; busy?: boolean; children: ReactNode }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...buttonBase, ...TONE[tone], ...(busy ? { cursor: 'progress' } : {}) }}
      data-tone={tone}
      data-testid={testId}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
    >
      {children}
    </button>
  );
}

/**
 * Panel A (PIN path available) and Panel B (sign-in only). No frame navigation, no name, no
 * number, no countdown; the same single column at every width. Focus moves to the heading (a
 * reading start point for screen readers, not a control, so it draws no focus ring).
 */
export function GrownUpLockScreen({ decision, onUsePin, onSignInAgain, onBackToLearning, onUsePasskey, passkeyBusy }: LockHandlers & { decision: LockedDecision }): JSX.Element {
  const lock = useMessages().console.lock;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const line = decision.line === 'default' ? lock.line : lock[decision.line];
  return (
    <main style={{ ...pageStyle, position: 'relative' }}>
      {/* The column starts below the Aa row, so Back to learning never runs under the button. */}
      <div style={{ ...columnStyle, marginTop: touchTarget.min + spacing.sm }}>
        <LockButton tone="quiet" onClick={onBackToLearning} testId="grown-up-lock-back">
          <IconSvg name="arrow-left" size={spacing.xl} color={colors.text.secondary} />
          {lock.backToLearning.cta}
        </LockButton>
        <section role="region" aria-labelledby={TITLE_ID} data-testid="grown-up-lock" style={sectionStyle}>
          <IconSvg name="lock" size={spacing.xxxl} color={colors.text.secondary} />
          <h1 id={TITLE_ID} tabIndex={-1} ref={headingRef} style={{ margin: 0, fontSize: headRem(typography.size.title), fontWeight: typography.weight.bold, lineHeight: typography.leading.tight, outline: 'none' }}>
            {lock.title}
          </h1>
          <p style={{ margin: 0, marginBottom: spacing.sm, fontSize: rem(typography.size.body), lineHeight: typography.leading.relaxed, color: colors.text.secondary }}>{line}</p>
          {decision.pinPath ? (
            <LockButton tone="primary" onClick={onUsePin} testId="grown-up-lock-pin">
              {lock.usePin.cta}
            </LockButton>
          ) : null}
          <LockButton tone={decision.pinPath ? 'secondary' : 'primary'} onClick={onSignInAgain} testId="grown-up-lock-signin">
            {lock.signInAgain.cta}
          </LockButton>
          {/* [OA] Design D15: a secondary button under the last one, only off `pin` browsers. */}
          {onUsePasskey ? (
            <LockButton tone="secondary" onClick={onUsePasskey} testId="grown-up-lock-passkey" busy={passkeyBusy}>
              {lock.passkey.cta}
            </LockButton>
          ) : null}
        </section>
      </div>
      {/* The Aa button (owner items 6 and 7): the device's language and text size, drawn top right; last in the
          tab order, after the lock's own actions. */}
      <div style={{ position: 'absolute', top: spacing.lg, right: layout.gutter.compact }}>
        <DisplayButton testId="grown-up-lock-display" />
      </div>
    </main>
  );
}
