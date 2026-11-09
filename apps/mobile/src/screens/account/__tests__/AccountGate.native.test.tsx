import { ScreenHeaderSlotContext, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { createElement, type ReactElement } from 'react';
import { AppState, Keyboard, Linking } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountDenyHits } from '../../../logic/account/deny-list';
import { useAccountVisit } from '../../../store/account-visit';
import { useLocaleStore } from '../../../store/locale-store';
import { useUiStore } from '../../../store/ui-store';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { AccountHostContext, ClerkMountContext, type AccountHost, type ClerkMountState } from '../account-host';
import { AccountGate } from '../AccountGate.native';
import { AccountHomeScreen } from '../AccountHomeScreen.native';

/**
 * F-AUTH-004 sections 7.2, 7.3, 7.4 and 15, design `lock.md` boards 1 to 7, 16 and 17, D6 (row NS-4; CS-N2, CS-N3,
 * CS-N11, CS-N12, CS-N14), in the `native` project: AccountGate over every row of the 7.2 table, on mount, focus and
 * the return to `active`; the typed PIN within 2 minutes (and face or fingerprint never counting); Sign in again after
 * the typed PIN; `auth.native.lock` once per mount; capture protection and the covers; the interim home of row NS-4;
 * and the deny list of section 9.2 over every lock in en, es and ko on iOS and Android.
 */

const env = vi.hoisted(() => ({
  gate: { state: 'pin', epoch: 7 } as { state: string; epoch?: number },
  trust: { kind: 'trust', trust: { v: 1, epoch: 7 } } as { kind: string; trust?: unknown },
  online: true,
  onlineListener: null as null | ((online: boolean) => void),
  removed: [] as string[],
  tracked: [] as { name: string; payload: unknown }[],
  clerk: { isLoaded: true, isSignedIn: true },
  holds: 0,
  releases: 0,
  gateRead: null as null | Promise<void>,
}));
vi.mock('../../../store/native-gate-state', () => ({
  nativeGateState: async () => {
    if (env.gateRead !== null) await env.gateRead;
    return env.gate;
  },
}));
vi.mock('../../../platform/account-records', () => ({
  readTrust: async () => env.trust,
  removeRecord: async (key: string) => void env.removed.push(key),
}));
vi.mock('../../../platform/account-online', () => ({
  readAccountOnline: async () => env.online,
  subscribeAccountOnline: (listener: (online: boolean) => void) => {
    env.onlineListener = listener;
    return () => undefined;
  },
}));
vi.mock('../../../platform/account-capture', () => ({
  holdAccountCapture: () => {
    env.holds += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      env.releases += 1;
    };
  },
}));
vi.mock('../../../platform/telemetry', () => ({ track: async (event: { name: string; payload: unknown }) => void env.tracked.push(event) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ cancelQueries: async () => undefined, removeQueries: () => undefined }) }));
vi.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ isLoaded: env.clerk.isLoaded, isSignedIn: env.clerk.isSignedIn }) }));
// react-native-web's Image needs a browser window: the cover stands in as a host node that says whether it draws the splash.
vi.mock('../AccountCover', async () => {
  const { createElement: h } = await import('react');
  return { AccountCover: ({ image = true }: { image?: boolean }) => h('account-cover', { 'data-testid': 'account-cover', image }) };
});

const en = getMessages('en');
const m = en.caregiver.account;

interface Nav {
  navigate: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  goBack: ReturnType<typeof vi.fn>;
  parentReplace: ReturnType<typeof vi.fn>;
  getState: () => { routes: { key: string; name: string }[] };
  getParent: () => { replace: ReturnType<typeof vi.fn> };
  addListener: (event: 'focus' | 'blur', listener: () => void) => () => void;
}

let nav: Nav;
let listeners: Record<'focus' | 'blur', (() => void)[]>;
let appListeners: ((state: string) => void)[];
let appState = 'active';
let host: AccountHost & { retry: ReturnType<typeof vi.fn>; endSession: ReturnType<typeof vi.fn>; wipeTokens: ReturnType<typeof vi.fn> };

function makeNav(below: string | null): Nav {
  listeners = { focus: [], blur: [] };
  const routes = [...(below === null ? [] : [{ key: 'below', name: below }]), { key: 'me', name: 'AccountHome' }];
  const parentReplace = vi.fn();
  return {
    navigate: vi.fn(),
    replace: vi.fn(),
    goBack: vi.fn(),
    parentReplace,
    getState: () => ({ routes }),
    getParent: () => ({ replace: parentReplace }),
    addListener: (event, listener) => {
      listeners[event].push(listener);
      return () => {
        listeners[event] = listeners[event].filter((l) => l !== listener);
      };
    },
  };
}

function HeaderTitle({ options }: ScreenHeaderSlotProps): ReactElement {
  return createElement('header-title', null, options?.title ?? null);
}

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
  }
}

interface MountOptions {
  screen?: 'home' | 'sign_in';
  use?: 'family' | 'teacher' | 'school' | 'account';
  again?: boolean;
  mount?: ClerkMountState;
  below?: string | null;
}

async function mountGate(o: MountOptions = {}): Promise<ReactTestRenderer> {
  nav = makeNav(o.below === undefined ? 'ParentDashboard' : o.below);
  host = { mount: o.mount ?? 'ready', endSession: vi.fn(async () => true), wipeTokens: vi.fn(async () => true), retry: vi.fn() };
  const gate = (): ReactElement => createElement(AccountGate, {
    screen: o.screen ?? 'home',
    use: 'use' in o ? o.use : 'family',
    again: o.again,
    navigation: nav as never,
    routeKey: 'me',
    children: createElement('open-content', { testID: 'gate-open' }, 'the account'),
  });
  const build = (): ReactElement =>
    createElement(
      ScreenHeaderSlotContext.Provider,
      { value: HeaderTitle },
      createElement(AccountHostContext.Provider, { value: host }, createElement(ClerkMountContext.Provider, { value: o.mount ?? 'ready' }, gate())),
    );
  rebuild = build;
  const r = await render(build());
  await settle();
  return r;
}

/** A new element tree for the last mount (a re-render with what the mocks answer now). */
let rebuild: () => ReactElement;

const opened = (r: ReactTestRenderer): boolean => r.root.findAll((n) => (n.type as unknown) === 'open-content').length > 0;
const has = (root: ReactTestInstance, id: string): boolean => byTestId(root, id).length > 0;
const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  await press(byTestId(root, id)[0]!);
  await settle();
};
const focus = async (): Promise<void> => {
  await act(async () => listeners.focus.forEach((l) => l()));
  await settle();
};
const blur = async (): Promise<void> => {
  await act(async () => listeners.blur.forEach((l) => l()));
};
const toApp = async (state: string): Promise<void> => {
  appState = state;
  await act(async () => appListeners.forEach((l) => l(state)));
};
const locks = (): unknown[] => env.tracked.filter((e) => e.name === 'auth.native.lock');

beforeEach(() => {
  setPlatform('ios');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useAccountVisit.setState({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false, signedOutThisRun: false });
  useUiStore.setState({ lastPinTypedAt: Date.now(), lastPinVerifiedAt: Date.now() });
  env.gate = { state: 'pin', epoch: 7 };
  env.trust = { kind: 'trust', trust: { v: 1, epoch: 7 } };
  env.online = true;
  env.removed = [];
  env.tracked = [];
  env.clerk = { isLoaded: true, isSignedIn: true };
  env.holds = 0;
  env.releases = 0;
  env.gateRead = null;
  appListeners = [];
  appState = 'active';
  vi.spyOn(AppState, 'currentState', 'get').mockImplementation(() => appState as never);
  vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appListeners.push(listener as (state: string) => void);
    return { remove: () => void (appListeners = appListeners.filter((l) => l !== listener)) } as never;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  resetPlatform();
});

describe('section 7.2: every row of the table', () => {
  it('pin, signed in, trust equal, typed PIN within 2 minutes: the screen opens', async () => {
    const r = await mountGate();
    expect(opened(r)).toBe(true);
    expect(locks()).toEqual([]);
  });

  it('unknown (CS-N14): the cantCheck lock, Try again and Back, no account; Try again reads again', async () => {
    env.gate = { state: 'unknown' };
    const r = await mountGate();
    expect(opened(r)).toBe(false);
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining([m.lock.cantCheck, en.common.buttons.tryAgain, en.common.buttons.back]));
    expect(locks()).toEqual([{ name: 'auth.native.lock', payload: { os: 'ios', cause: 'unknown' } }]);
    env.gate = { state: 'pin', epoch: 7 };
    await tap(r.root, 'account-lock-try-again');
    expect(opened(r)).toBe(true);
  });

  it('unknown, Back goes back', async () => {
    env.gate = { state: 'unknown' };
    const r = await mountGate();
    await tap(r.root, 'account-lock-back');
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  it('no Clerk for this visit: the cantCheck lock; Try again asks the area to decide its provider again', async () => {
    const r = await mountGate({ mount: 'off' });
    expect(screenTexts(r.root)).toContain(m.lock.cantCheck);
    await tap(r.root, 'account-lock-try-again');
    expect(host.retry).toHaveBeenCalledTimes(1);
    expect(opened(r)).toBe(false);
  });

  it('nopin (ND-7): the Grown-up area gives way to PIN setup, never an account screen', async () => {
    env.gate = { state: 'nopin' };
    const r = await mountGate();
    expect(opened(r)).toBe(false);
    expect(nav.parentReplace).toHaveBeenCalledWith('PinEntry', { next: 'ParentDashboard' });
    expect(locks()).toEqual([{ name: 'auth.native.lock', payload: { os: 'ios', cause: 'needs_pin' } }]);
  });

  it('open, not signed in during this visit: a home goes to the sign-in (Clerk’s own state is not enough, ND-9)', async () => {
    env.gate = { state: 'open' };
    env.trust = { kind: 'none' };
    useUiStore.setState({ lastPinTypedAt: null });
    const r = await mountGate({ use: 'teacher' });
    expect(opened(r)).toBe(false);
    expect(nav.replace).toHaveBeenCalledWith('SignIn', { use: 'teacher' });
  });

  it('open, signed in during this visit: the screen opens, no PIN asked (there is none)', async () => {
    env.gate = { state: 'open' };
    env.trust = { kind: 'none' };
    useUiStore.setState({ lastPinTypedAt: null });
    useAccountVisit.getState().markSignedIn(Date.now() - 10 * 60_000, false);
    const r = await mountGate();
    expect(opened(r)).toBe(true);
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('pin, epoch 0: the renew line and Back only', async () => {
    env.gate = { state: 'pin', epoch: 0 };
    const r = await mountGate();
    expect(screenTexts(r.root)).toContain(en.console.lock.pinRenew);
    expect(has(r.root, 'account-lock-sign-in-again')).toBe(false);
    expect(has(r.root, 'account-lock-back')).toBe(true);
    expect(locks()).toEqual([{ name: 'auth.native.lock', payload: { os: 'ios', cause: 'epoch_zero' } }]);
  });

  it('pin, not signed in: a home goes to the sign-in; the sign-in screen opens', async () => {
    env.clerk = { isLoaded: true, isSignedIn: false };
    const home = await mountGate();
    expect(nav.replace).toHaveBeenCalledWith('SignIn', { use: 'family' });
    await unmount(home);
    const signIn = await mountGate({ screen: 'sign_in', use: undefined });
    expect(opened(signIn)).toBe(true);
  });

  it.each([
    ['no_trust', { kind: 'none' }, false, en.console.lock.firstSignIn],
    ['no_trust (damaged record, CS-N3)', { kind: 'damaged' }, false, en.console.lock.firstSignIn],
    ['pin_changed', { kind: 'trust', trust: { v: 1, epoch: 3 } }, false, en.console.lock.pinChanged],
    ['retrust_password', { kind: 'trust', trust: { v: 1, epoch: 3 } }, true, m.lock.retrustPassword],
  ] as const)('pin, signed in, %s: its line and Sign in again; no account', async (_name, trust, retrust, line) => {
    env.trust = trust;
    if (retrust) useAccountVisit.setState({ retrustPending: true });
    const r = await mountGate();
    expect(opened(r)).toBe(false);
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining([line, en.console.lock.signInAgain.cta]));
  });

  it('the sign-in screen, already signed in and trusted at its mount: the home in its place', async () => {
    const r = await mountGate({ screen: 'sign_in', use: 'school' });
    expect(opened(r)).toBe(false);
    expect(nav.replace).toHaveBeenCalledWith('AccountHome', { use: 'school' });
  });

  it('Clerk still loading: nothing of the account; it decides once Clerk has loaded', async () => {
    env.clerk = { isLoaded: false, isSignedIn: false };
    const r = await mountGate();
    expect(opened(r)).toBe(false);
    expect(screenTexts(r.root)).not.toContain(m.lock.cantCheck);
    env.clerk = { isLoaded: true, isSignedIn: true };
    await act(async () => r.update(rebuild()));
    await settle();
    expect(opened(r)).toBe(true);
  });
});

describe('ND-5, CS-N11: the typed PIN within 2 minutes', () => {
  it('entered from outside the account routes without a fresh proof: the typed PIN first, titled with the use', async () => {
    useUiStore.setState({ lastPinTypedAt: Date.now() - 3 * 60_000 });
    const r = await mountGate({ use: 'teacher' });
    expect(opened(r)).toBe(false);
    expect(nav.navigate).toHaveBeenCalledWith('PinEntry', { next: 'FreshPin', typedOnly: true, use: 'teacher' });
    useUiStore.getState().markPinVerified('pin');
    await focus();
    expect(opened(r)).toBe(true);
  });

  it('CS-N11: face or fingerprint on the way back is no typed PIN: the screen leaves', async () => {
    useUiStore.setState({ lastPinTypedAt: null, lastPinVerifiedAt: null });
    const r = await mountGate();
    expect(nav.navigate).toHaveBeenCalledTimes(1);
    useUiStore.getState().markPinVerified('biometric');
    await focus();
    expect(opened(r)).toBe(false);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledTimes(1);
  });

  it('Cancel on the PIN screen (back without a PIN): the screen leaves, it never asks again in a loop', async () => {
    useUiStore.setState({ lastPinTypedAt: null });
    await mountGate();
    await focus();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledTimes(1);
  });

  it('a native sign-in within 2 minutes is a fresh proof too', async () => {
    useUiStore.setState({ lastPinTypedAt: null });
    useAccountVisit.getState().markSignedIn(Date.now(), false);
    expect(opened(await mountGate())).toBe(true);
  });

  it('an open 15-minute session alone is no proof (a PIN typed 3 minutes ago, the gate still open)', async () => {
    useUiStore.setState({ lastPinTypedAt: Date.now() - 3 * 60_000, parentGateOpenedAt: Date.now() - 3 * 60_000 });
    const r = await mountGate();
    expect(opened(r)).toBe(false);
    expect(nav.navigate).toHaveBeenCalledWith('PinEntry', expect.objectContaining({ next: 'FreshPin', typedOnly: true }));
  });

  it('entered from inside the account routes (OA-D5b): no PIN asked', async () => {
    useUiStore.setState({ lastPinTypedAt: Date.now() - 10 * 60_000 });
    const r = await mountGate({ below: 'SignIn' });
    expect(opened(r)).toBe(true);
  });

  it('a screen first in its stack (opened from the chooser) counts as entered from outside', async () => {
    useUiStore.setState({ lastPinTypedAt: Date.now() - 3 * 60_000 });
    await mountGate({ below: null });
    expect(nav.navigate).toHaveBeenCalledWith('PinEntry', expect.objectContaining({ next: 'FreshPin' }));
  });

  it('once open, a later focus past the 2 minutes keeps it open (the 15-minute session holds inside)', async () => {
    const r = await mountGate();
    expect(opened(r)).toBe(true);
    useUiStore.setState({ lastPinTypedAt: Date.now() - 5 * 60_000 });
    await focus();
    expect(opened(r)).toBe(true);
  });
});

describe('decides on mount, every focus and every return to active', () => {
  it('a PIN changed while the home was below another screen: the focus locks it', async () => {
    const r = await mountGate();
    expect(opened(r)).toBe(true);
    env.gate = { state: 'pin', epoch: 8 };
    await focus();
    expect(opened(r)).toBe(false);
    expect(screenTexts(r.root)).toContain(en.console.lock.pinChanged);
  });

  it('the return to active decides again, and a lock then never shows the content first (the cover stays until it answers)', async () => {
    const r = await mountGate();
    await toApp('background');
    expect(has(r.root, 'account-cover')).toBe(true);
    let release: () => void = () => undefined;
    env.gateRead = new Promise<void>((resolve) => {
      release = resolve;
    });
    env.gate = { state: 'unknown' };
    await toApp('active');
    await settle();
    // Still deciding: the cover is up over the content.
    expect(has(r.root, 'account-cover')).toBe(true);
    release();
    await settle();
    expect(has(r.root, 'account-cover')).toBe(false);
    expect(opened(r)).toBe(false);
    expect(screenTexts(r.root)).toContain(m.lock.cantCheck);
  });

  it('a decision on focus over an open screen hides it at once (the canvas alone, no splash)', async () => {
    const r = await mountGate();
    let release: () => void = () => undefined;
    env.gateRead = new Promise<void>((resolve) => {
      release = resolve;
    });
    await act(async () => listeners.focus.forEach((l) => l()));
    const cover = byTestId(r.root, 'account-cover');
    expect(cover.length).toBe(1);
    expect(cover[0]!.props.image).toBe(false);
    release();
    await settle();
    expect(has(r.root, 'account-cover')).toBe(false);
    expect(opened(r)).toBe(true);
  });

  it('auth.native.lock at most once per mount', async () => {
    env.trust = { kind: 'none' };
    await mountGate();
    await focus();
    await toApp('active');
    await settle();
    expect(locks()).toHaveLength(1);
  });
});

describe('Sign in again (7.2, 7.3; lock.md board 11)', () => {
  it('with a fresh typed PIN: signs out on this device (keeping the other epoch’s trust), then the sign-in in the home’s place', async () => {
    env.trust = { kind: 'trust', trust: { v: 1, epoch: 3 } };
    const r = await mountGate({ use: 'family' });
    await tap(r.root, 'account-lock-sign-in-again');
    expect(host.endSession).toHaveBeenCalledTimes(1);
    expect(host.wipeTokens).toHaveBeenCalledTimes(1);
    expect(env.removed).toEqual(['grownup:deviceUses', 'grownup:retrustNotice']);
    expect(env.tracked).toContainEqual({ name: 'auth.native.signout', payload: { os: 'ios', via: 'lock' } });
    expect(nav.replace).toHaveBeenCalledWith('SignIn', { use: 'family' });
  });

  it('without a fresh proof: the typed PIN first, nothing signed out before it; a typed PIN goes on', async () => {
    env.trust = { kind: 'none' };
    useUiStore.setState({ lastPinTypedAt: Date.now() - 3 * 60_000 });
    const r = await mountGate();
    await tap(r.root, 'account-lock-sign-in-again');
    expect(nav.navigate).toHaveBeenCalledWith('PinEntry', { next: 'FreshPin', typedOnly: true, use: 'family' });
    expect(host.endSession).not.toHaveBeenCalled();
    useUiStore.getState().markPinVerified('pin');
    await focus();
    expect(host.endSession).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith('SignIn', { use: 'family' });
  });

  it('the PIN not typed (Cancel, or face or fingerprint): the lock stays, nothing signed out', async () => {
    env.trust = { kind: 'none' };
    useUiStore.setState({ lastPinTypedAt: null });
    const r = await mountGate();
    await tap(r.root, 'account-lock-sign-in-again');
    useUiStore.getState().markPinVerified('biometric');
    await focus();
    expect(host.endSession).not.toHaveBeenCalled();
    expect(nav.goBack).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).toContain(en.console.lock.firstSignIn);
  });

  it('the account card’s Sign in again (`SignIn { again }`): the typed PIN, then the sign-out, then the sign-in opens in place', async () => {
    env.trust = { kind: 'trust', trust: { v: 1, epoch: 3 } };
    useUiStore.setState({ lastPinTypedAt: Date.now() - 3 * 60_000 });
    const r = await mountGate({ screen: 'sign_in', use: undefined, again: true });
    expect(nav.navigate).toHaveBeenCalledWith('PinEntry', { next: 'FreshPin', typedOnly: true });
    expect(host.endSession).not.toHaveBeenCalled();
    useUiStore.getState().markPinVerified('pin');
    env.clerk = { isLoaded: true, isSignedIn: true };
    await focus();
    expect(host.endSession).toHaveBeenCalledTimes(1);
    // Signed out this run: the account reads as signed out, so the sign-in opens in place.
    expect(opened(r)).toBe(true);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('offline: Sign in again waits, with Needs the internet', async () => {
    env.trust = { kind: 'none' };
    const r = await mountGate();
    await act(async () => env.onlineListener?.(false));
    expect(byTestId(r.root, 'account-lock-sign-in-again')[0]!.props['aria-disabled']).toBe(true);
    expect(screenTexts(r.root)).toContain(en.learner.welcome.grownUps.needsInternet);
    await tap(r.root, 'account-lock-sign-in-again');
    expect(host.endSession).not.toHaveBeenCalled();
  });
});

describe('section 7.4 (CS-N12): capture protection and the covers', () => {
  it('held while focused, released on blur, held again on focus, released on unmount', async () => {
    const r = await mountGate();
    expect(env.holds).toBe(1);
    await blur();
    expect(env.releases).toBe(1);
    await focus();
    expect(env.holds).toBe(2);
    await unmount(r);
    expect(env.releases).toBe(2);
  });

  it('held on a lock too (the screen is an account screen whatever it shows)', async () => {
    env.gate = { state: 'unknown' };
    await mountGate();
    expect(env.holds).toBe(1);
  });

  it('the JS cover while the app is not active: the splash (D12); the keyboard goes (its window is beyond the covers)', async () => {
    const dismiss = vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const r = await mountGate();
    await toApp('inactive');
    expect(byTestId(r.root, 'account-cover')[0]!.props.image).toBe(true);
    expect(dismiss).toHaveBeenCalledTimes(1);
    // On a lock too.
    env.gate = { state: 'unknown' };
    await unmount(r);
    const locked = await mountGate();
    await toApp('background');
    expect(byTestId(locked.root, 'account-cover')[0]!.props.image).toBe(true);
  });
});

describe('D6: titled with the use the grown-up came for', () => {
  it.each([
    ['family', en.learner.who.use.family],
    ['teacher', en.learner.who.use.teacher],
    ['school', en.learner.who.use.school],
    ['account', m.card.title],
    [undefined, m.card.title],
  ] as const)('%s', async (use, title) => {
    env.gate = { state: 'unknown' };
    const r = await mountGate({ use: use as never });
    expect(screenTexts(r.root)).toContain(title);
  });
});

describe('row NS-4: the interim home lands on the Grown-up area', () => {
  async function mountHome(below: string | null): Promise<ReactTestRenderer> {
    nav = makeNav(below);
    host = { mount: 'ready', endSession: vi.fn(async () => true), wipeTokens: vi.fn(async () => true), retry: vi.fn() };
    const screen = createElement(AccountHomeScreen, { navigation: nav, route: { key: 'me', name: 'AccountHome', params: { use: 'family' } } } as never);
    const r = await render(
      createElement(ScreenHeaderSlotContext.Provider, { value: HeaderTitle }, createElement(AccountHostContext.Provider, { value: host }, createElement(ClerkMountContext.Provider, { value: 'ready' }, screen))),
    );
    await settle();
    return r;
  }

  it('the dashboard under it: back to it', async () => {
    await mountHome('ParentDashboard');
    expect(nav.navigate).toHaveBeenCalledWith('ParentDashboard');
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('first in its stack (a chooser row): the dashboard in its place, so Back still goes to the chooser', async () => {
    useUiStore.setState({ lastPinTypedAt: Date.now() });
    await mountHome(null);
    expect(nav.replace).toHaveBeenCalledWith('ParentDashboard');
  });

  it('locked: no landing', async () => {
    env.trust = { kind: 'none' };
    await mountHome('ParentDashboard');
    expect(nav.navigate).not.toHaveBeenCalledWith('ParentDashboard');
  });
});

describe('section 9.2: no purchase, price, renewal, web or sign-up word on any lock, in en, es and ko, on iOS and Android', () => {
  const openURL = vi.fn();
  const STATES: Record<string, { gate?: { state: string; epoch?: number }; trust?: { kind: string; trust?: unknown }; retrust?: boolean; mount?: ClerkMountState; online?: boolean }> = {
    unknown: { gate: { state: 'unknown' } },
    off: { mount: 'off' },
    epochZero: { gate: { state: 'pin', epoch: 0 } },
    noTrust: { trust: { kind: 'none' } },
    noTrustOffline: { trust: { kind: 'none' }, online: false },
    pinChanged: { trust: { kind: 'trust', trust: { v: 1, epoch: 3 } } },
    retrust: { trust: { kind: 'trust', trust: { v: 1, epoch: 3 } }, retrust: true },
  };

  for (const platform of ['ios', 'android'] as const) {
    it(`${platform}: every lock, every language, every use`, async () => {
      vi.spyOn(Linking, 'openURL').mockImplementation(openURL as never);
      for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
        for (const use of ['family', 'teacher', 'school', 'account'] as const) {
          for (const [name, s] of Object.entries(STATES)) {
            setPlatform(platform);
            vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
            useLocaleStore.setState({ device: locale, byProfile: {} });
            useAccountVisit.setState({ retrustPending: s.retrust === true, signedOutThisRun: false, signedInThisVisit: false, lastAccountSignInAt: null });
            env.gate = s.gate ?? { state: 'pin', epoch: 7 };
            env.trust = s.trust ?? { kind: 'trust', trust: { v: 1, epoch: 7 } };
            env.online = s.online ?? true;
            const r = await mountGate({ use, mount: s.mount ?? 'ready' });
            const labels = hostNodes(r.root, (n) => typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label'] as string);
            const texts = [...screenTexts(r.root), ...labels];
            expect(has(r.root, 'gate-open'), `${locale} ${use} ${name}`).toBe(false);
            const hits = texts.flatMap((t) => accountDenyHits(t, locale).map((h) => `${platform} ${locale} ${use} ${name}: "${t}" has ${h}`));
            expect(hits).toEqual([]);
            expect(hostNodes(r.root, (n) => n.props.href !== undefined), `${locale} ${name}: a link`).toEqual([]);
            await unmount(r);
          }
        }
      }
      expect(openURL).not.toHaveBeenCalled();
    });
  }
});
