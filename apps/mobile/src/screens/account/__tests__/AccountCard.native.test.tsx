import { ConfirmSheet, type ConfirmSheetProps } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { createElement, type ReactElement } from 'react';
import { Linking } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountDenyHits } from '../../../logic/account/deny-list';
import { useAccountVisit } from '../../../store/account-visit';
import { useLocaleStore } from '../../../store/locale-store';
import { useUiStore } from '../../../store/ui-store';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { AccountHostContext, ClerkMountContext, type AccountHost, type ClerkMountState } from '../account-host';
import { AccountCard } from '../AccountCard.native';

/**
 * F-AUTH-004 sections 6.6, 7.1 and 7.2, design D7 and D8 (`lock.md` boards 8 to 15; row NS-3; CS-N2, CS-N9, CS-N11,
 * CS-N13), in the `native` project: the Grown-up area's account card signed out, signed in (with and without a fresh
 * proof), locked, `unknown` and offline; Sign out clears the records, the keys and the queries, offline too; row
 * NS-4's use rows and its entries through AccountGate (Sign in, a use row, Sign in again); and the deny list of
 * section 9.2 over every state in en, es and ko on iOS and Android (the text tree, every label and hint).
 */

const env = vi.hoisted(() => ({
  enabled: true,
  gate: { state: 'pin', epoch: 7 } as { state: string; epoch?: number },
  trust: { kind: 'trust', trust: { v: 1, epoch: 7 } } as { kind: string; trust?: unknown },
  online: true,
  onlineListener: null as null | ((online: boolean) => void),
  removed: [] as string[],
  tracked: [] as { name: string; payload: unknown }[],
  queries: [] as string[],
  clerk: { isLoaded: true, isSignedIn: true, email: 'dana@example.com' as string | null },
  record: ['family', 'teacher'] as string[] | null,
  spaces: undefined as unknown,
}));
vi.mock('../../../config/native-signin', () => ({ nativeSignInConfig: () => ({ flag: env.enabled, publishableKey: env.enabled ? 'pk_live_x' : null, enabled: env.enabled }) }));
vi.mock('../../../store/native-gate-state', () => ({ nativeGateState: async () => env.gate }));
vi.mock('../../../platform/account-records', () => ({
  readTrust: async () => env.trust,
  readUsesRecord: async () => env.record,
  removeRecord: async (key: string) => void env.removed.push(key),
}));
vi.mock('../../../platform/account-online', () => ({
  readAccountOnline: async () => env.online,
  subscribeAccountOnline: (listener: (online: boolean) => void) => {
    env.onlineListener = listener;
    return () => undefined;
  },
}));
vi.mock('../../../platform/telemetry', () => ({ track: async (event: { name: string; payload: unknown }) => void env.tracked.push(event) }));
const client = vi.hoisted(() => ({
  cancelQueries: async () => void env.queries.push('cancel'),
  removeQueries: () => void env.queries.push('remove'),
  getQueryData: () => env.spaces,
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => client }));
vi.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ isLoaded: env.clerk.isLoaded, isSignedIn: env.clerk.isSignedIn }),
  useUser: () => ({ user: env.clerk.email === null ? null : { primaryEmailAddress: { emailAddress: env.clerk.email } } }),
}));

const en = getMessages('en');
const m = en.caregiver.account;

function makeHost(): AccountHost & { endSession: ReturnType<typeof vi.fn>; wipeTokens: ReturnType<typeof vi.fn>; retry: ReturnType<typeof vi.fn> } {
  return { mount: 'ready', endSession: vi.fn(async () => true), wipeTokens: vi.fn(async () => true), retry: vi.fn() };
}

let host = makeHost();
let focus: (() => void)[] = [];
let navigate = vi.fn();

/** Lets the card's parts load (`import()`) and its decisions answer. */
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
    });
  }
}

async function mount(state: ClerkMountState = 'ready'): Promise<ReactTestRenderer> {
  host = { ...makeHost(), mount: state };
  focus = [];
  navigate = vi.fn();
  const navigation = {
    navigate,
    addListener: (_event: 'focus', listener: () => void) => {
      focus.push(listener);
      return () => undefined;
    },
  };
  const card = createElement(AccountCard, { navigation } as never);
  const element: ReactElement = createElement(AccountHostContext.Provider, { value: host }, createElement(ClerkMountContext.Provider, { value: state }, card));
  const r = await render(element);
  await settle();
  return r;
}

const refocus = async (): Promise<void> => {
  await act(async () => focus.forEach((listener) => listener()));
  await settle();
};
const sheetOf = (root: ReactTestInstance): ConfirmSheetProps => root.findByType(ConfirmSheet).props as ConfirmSheetProps;
const has = (root: ReactTestInstance, id: string): boolean => byTestId(root, id).length > 0;
const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  await press(byTestId(root, id)[0]!);
  await settle();
};

// The card's parts load with `import()` when drawn; loaded once here, so a test never waits on the module graph.
beforeAll(async () => {
  await import('../AccountCardBody.native');
  await import('../AccountCardClerk.native');
});

beforeEach(() => {
  setPlatform('ios');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useAccountVisit.setState({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false, signedOutThisRun: false });
  useUiStore.setState({ lastPinTypedAt: Date.now(), lastPinVerifiedAt: Date.now() });
  env.enabled = true;
  env.gate = { state: 'pin', epoch: 7 };
  env.trust = { kind: 'trust', trust: { v: 1, epoch: 7 } };
  env.online = true;
  env.removed = [];
  env.tracked = [];
  env.queries = [];
  env.clerk = { isLoaded: true, isSignedIn: true, email: 'dana@example.com' };
  env.record = ['family', 'teacher'];
  env.spaces = undefined;
});

afterEach(() => resetPlatform());

describe('CS-N13 and the states that draw nothing', () => {
  it('the native account off: nothing at all', async () => {
    env.enabled = false;
    const r = await mount();
    expect(r.toJSON()).toBeNull();
  });

  it('nopin (the area runs PIN setup first), and while Clerk is not decided: nothing', async () => {
    env.gate = { state: 'nopin' };
    expect((await mount()).toJSON()).toBeNull();
    env.gate = { state: 'pin', epoch: 7 };
    expect((await mount('pending')).toJSON()).toBeNull();
  });
});

describe('cantCheck (board 12)', () => {
  it('gate unknown: the line and Try again (which reads again), no email', async () => {
    env.gate = { state: 'unknown' };
    const r = await mount();
    expect(screenTexts(r.root)).toContain(m.lock.cantCheck);
    expect(screenTexts(r.root).join(' ')).not.toContain('dana@example.com');
    env.gate = { state: 'pin', epoch: 7 };
    await tap(r.root, 'account-card-try-again');
    expect(has(r.root, 'account-card-email')).toBe(true);
  });

  it('no Clerk for this visit: Try again asks the area to decide its provider again', async () => {
    const r = await mount('off');
    expect(screenTexts(r.root)).toContain(m.lock.cantCheck);
    await tap(r.root, 'account-card-try-again');
    expect(host.retry).toHaveBeenCalledTimes(1);
  });
});

describe('signed out (boards 8 and 13)', () => {
  beforeEach(() => {
    env.clerk = { isLoaded: true, isSignedIn: false, email: null };
  });

  it('the line and Sign in; with a fresh typed PIN Sign in opens the sign-in', async () => {
    const r = await mount();
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining([m.card.title, m.card.signedOut, m.signIn.submit.cta]));
    await tap(r.root, 'account-card-sign-in');
    expect(navigate).toHaveBeenCalledWith('SignIn', undefined);
  });

  it('row NS-4: Sign in opens the sign-in whatever the proof: its AccountGate asks the typed PIN (ND-5, CS-N11)', async () => {
    useUiStore.setState({ lastPinTypedAt: null, lastPinVerifiedAt: Date.now() });
    const r = await mount();
    await tap(r.root, 'account-card-sign-in');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('SignIn', undefined);
    expect(navigate).not.toHaveBeenCalledWith('PinEntry', expect.anything());
  });

  it('an open device has no PIN to ask', async () => {
    env.gate = { state: 'open' };
    useUiStore.setState({ lastPinTypedAt: null });
    const r = await mount();
    await tap(r.root, 'account-card-sign-in');
    expect(navigate).toHaveBeenCalledWith('SignIn', undefined);
  });

  it('offline: Sign in waits, with Needs the internet as its reason', async () => {
    const r = await mount();
    await act(async () => env.onlineListener?.(false));
    const button = byTestId(r.root, 'account-card-sign-in')[0]!;
    expect(button.props['aria-disabled']).toBe(true);
    expect(screenTexts(r.root)).toContain(en.learner.welcome.grownUps.needsInternet);
    await tap(r.root, 'account-card-sign-in');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Clerk still loading offline reads as signed out (Sign in waits)', async () => {
    env.clerk = { isLoaded: false, isSignedIn: false, email: null };
    env.online = false;
    const r = await mount();
    expect(screenTexts(r.root)).toContain(m.card.signedOut);
  });
});

describe('signed in (boards 9, 10, 12b, 14)', () => {
  it('row NS-4, board 9: one row per known use, in order, each opening its home through AccountGate', async () => {
    env.record = ['teacher', 'family'];
    const r = await mount();
    const rows = hostNodes(r.root, (n) => String(n.props['data-testid'] ?? '').startsWith('account-card-use-')).map((n) => n.props['data-testid']);
    expect(rows).toEqual(['account-card-use-family', 'account-card-use-teacher']);
    expect(byTestId(r.root, 'account-card-use-family')[0]!.props['aria-label']).toBe(en.a11y.who.grownUpRow(en.learner.who.use.family));
    await tap(r.root, 'account-card-use-teacher');
    expect(navigate).toHaveBeenCalledWith('AccountHome', { use: 'teacher' });
  });

  it('board 10: without a fresh proof the rows stay (each asks the typed PIN in its gate), with no email', async () => {
    useUiStore.setState({ lastPinTypedAt: Date.now() - 3 * 60_000 });
    const r = await mount();
    expect(has(r.root, 'account-card-use-family')).toBe(true);
    expect(has(r.root, 'account-card-email')).toBe(false);
  });

  it('board 12b: an account with no space shows no use row', async () => {
    env.record = [];
    const r = await mount();
    expect(has(r.root, 'account-card-uses')).toBe(false);
    expect(screenTexts(r.root)).toContain(en.console.shell.signOut.cta);
  });

  it('board 14: offline the rows wait with Needs the internet; Sign out stays enabled', async () => {
    const r = await mount();
    await act(async () => env.onlineListener?.(false));
    const row = byTestId(r.root, 'account-card-use-family')[0]!;
    expect(row.props['aria-disabled']).toBe(true);
    expect(screenTexts(row)).toContain(en.learner.welcome.grownUps.needsInternet);
    await press(row);
    expect(navigate).not.toHaveBeenCalled();
    expect(byTestId(r.root, 'account-card-sign-out')[0]!.props['aria-disabled']).not.toBe(true);
  });

  it('an open device: the rows come from this visit’s spaces in memory (no record is kept, ND-9), with no lock glyph', async () => {
    env.gate = { state: 'open' };
    env.trust = { kind: 'none' };
    env.record = ['school'];
    env.spaces = { spaces: [{ space: { kind: 'class' }, role: 'teacher' }] };
    useAccountVisit.getState().markSignedIn(Date.now(), false);
    const r = await mount();
    expect(has(r.root, 'account-card-use-teacher')).toBe(true);
    expect(has(r.root, 'account-card-use-school')).toBe(false);
    expect(byTestId(r.root, 'account-card-use-teacher')[0]!.props['aria-label']).toBe(en.learner.who.use.teacher);
  });

  it('a fresh proof: the email line, the shared-device line, Sign out', async () => {
    const r = await mount();
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining([en.console.adminInvite.signedInAs('dana@example.com'), en.console.billing.help.sharedDevice, en.console.shell.signOut.cta]));
  });

  it('CS-N9: no fresh proof (a face or fingerprint, a PIN older than 2 minutes): no email line', async () => {
    useUiStore.setState({ lastPinTypedAt: Date.now() - 3 * 60_000, lastPinVerifiedAt: Date.now() });
    const r = await mount();
    expect(has(r.root, 'account-card-email')).toBe(false);
    expect(screenTexts(r.root).join(' ')).not.toContain('dana@example.com');
    expect(screenTexts(r.root)).toContain(en.console.shell.signOut.cta);
  });

  it('a native sign-in within 2 minutes is a fresh proof too', async () => {
    useUiStore.setState({ lastPinTypedAt: null });
    useAccountVisit.getState().markSignedIn(Date.now(), false);
    const r = await mount();
    expect(has(r.root, 'account-card-email')).toBe(true);
  });

  it('an open device: only this visit’s sign-in counts (ND-9)', async () => {
    env.gate = { state: 'open' };
    env.trust = { kind: 'none' };
    const signedOut = await mount();
    expect(screenTexts(signedOut.root)).toContain(m.card.signedOut);
    await unmount(signedOut);
    useAccountVisit.getState().markSignedIn(Date.now(), false);
    const r = await mount();
    expect(has(r.root, 'account-card-email')).toBe(true);
  });

  it('section 6.6: Sign out asks (no danger colour, Cancel first), then Clerk, the keys, the records and the queries go', async () => {
    useAccountVisit.getState().markSignedIn(Date.now(), true);
    const r = await mount();
    await tap(r.root, 'account-card-sign-out');
    expect(sheetOf(r.root)).toMatchObject({ visible: true, title: m.signOut.ask, cancelLabel: en.common.buttons.cancel, confirmLabel: en.console.shell.signOut.cta });
    expect(sheetOf(r.root).confirmTone).toBeUndefined();
    await act(async () => sheetOf(r.root).onConfirm());
    await settle();
    expect(host.endSession).toHaveBeenCalledTimes(1);
    expect(host.wipeTokens).toHaveBeenCalledTimes(1);
    expect(env.removed).toEqual(['grownup:deviceUses', 'grownup:trust', 'grownup:retrustNotice']);
    expect(env.queries).toEqual(['cancel', 'remove', 'remove']);
    expect(useAccountVisit.getState()).toMatchObject({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false });
    expect(env.tracked).toEqual([{ name: 'auth.native.signout', payload: { os: 'ios', via: 'user' } }]);
  });

  it('Cancel signs nothing out', async () => {
    const r = await mount();
    await tap(r.root, 'account-card-sign-out');
    await act(async () => sheetOf(r.root).onCancel());
    expect(sheetOf(r.root).visible).toBe(false);
    expect(host.endSession).not.toHaveBeenCalled();
  });

  it('offline: Sign out stays enabled and the local items go at once (R-2)', async () => {
    host = makeHost();
    const r = await mount();
    await act(async () => env.onlineListener?.(false));
    host.endSession.mockResolvedValue(false);
    expect(byTestId(r.root, 'account-card-sign-out')[0]!.props['aria-disabled']).not.toBe(true);
    await tap(r.root, 'account-card-sign-out');
    await act(async () => sheetOf(r.root).onConfirm());
    await settle();
    expect(host.wipeTokens).toHaveBeenCalled();
    expect(env.removed).toContain('grownup:trust');
    // Clerk still holds its session (its sign-out could not reach Clerk): the card reads signed out all the same.
    expect(screenTexts(r.root)).toContain(m.card.signedOut);
    expect(screenTexts(r.root)).not.toContain(en.console.lock.firstSignIn);
  });
});

describe('locked (board 11)', () => {
  it.each([
    ['no_trust', { kind: 'none' }, false, en.console.lock.firstSignIn],
    ['pin_changed', { kind: 'trust', trust: { v: 1, epoch: 3 } }, false, en.console.lock.pinChanged],
    ['retrust_password', { kind: 'trust', trust: { v: 1, epoch: 3 } }, true, m.lock.retrustPassword],
  ] as const)('%s: its line and Sign in again; no email', async (_cause, trust, retrust, line) => {
    env.trust = trust;
    if (retrust) useAccountVisit.getState().markSignedIn(Date.now() - 10 * 60_000, true);
    const r = await mount();
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining([line, en.console.lock.signInAgain.cta]));
    expect(screenTexts(r.root).join(' ')).not.toContain('dana@example.com');
    expect(has(r.root, 'account-card-sign-out')).toBe(false);
  });

  it('epoch 0: the renew line and no button (a sign-in cannot trust it)', async () => {
    env.gate = { state: 'pin', epoch: 0 };
    const r = await mount();
    expect(screenTexts(r.root)).toContain(en.console.lock.pinRenew);
    expect(has(r.root, 'account-card-sign-in-again')).toBe(false);
  });

  it('row NS-4: Sign in again opens the sign-in with `again`; its AccountGate asks the typed PIN, then signs out', async () => {
    env.trust = { kind: 'trust', trust: { v: 1, epoch: 3 } };
    useUiStore.setState({ lastPinTypedAt: Date.now() - 3 * 60_000 });
    const r = await mount();
    await tap(r.root, 'account-card-sign-in-again');
    expect(navigate).toHaveBeenCalledWith('SignIn', { again: true });
    // The card itself signs nothing out: the gate does, after the typed PIN.
    expect(host.endSession).not.toHaveBeenCalled();
    expect(env.removed).toEqual([]);
  });
});

describe('section 9.2: no purchase, price, renewal, web or sign-up word in any state, in en, es and ko, on iOS and Android', () => {
  type Setup = { gate?: { state: string; epoch?: number }; trust?: { kind: string; trust?: unknown }; signedIn?: boolean; mount?: ClerkMountState; online?: boolean; retrust?: boolean; sheet?: boolean; fresh?: boolean; record?: string[] };
  const openURL = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  const STATES: Record<string, Setup> = {
    signedOut: { signedIn: false },
    signedOutOffline: { signedIn: false, online: false },
    signedIn: {},
    signedInOffline: { online: false },
    signedInNoEmail: { fresh: false },
    signedInNoSpace: { record: [] },
    lockedOffline: { trust: { kind: 'none' }, online: false },
    signOutSheet: { sheet: true },
    noTrust: { trust: { kind: 'none' } },
    pinChanged: { trust: { kind: 'trust', trust: { v: 1, epoch: 3 } } },
    retrust: { trust: { kind: 'none' }, retrust: true },
    epochZero: { gate: { state: 'pin', epoch: 0 } },
    unknown: { gate: { state: 'unknown' } },
    off: { mount: 'off' },
  };

  for (const platform of ['ios', 'android'] as const) {
    it(`${platform}: every state, every language`, async () => {
      for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
        for (const [name, s] of Object.entries(STATES)) {
          setPlatform(platform);
          vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
          useLocaleStore.setState({ device: locale, byProfile: {} });
          useAccountVisit.setState({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false, signedOutThisRun: false });
          if (s.retrust === true) useAccountVisit.getState().markSignedIn(Date.now() - 10 * 60_000, true);
          useUiStore.setState({ lastPinTypedAt: s.fresh === false ? Date.now() - 3 * 60_000 : Date.now() });
          env.gate = s.gate ?? { state: 'pin', epoch: 7 };
          env.trust = s.trust ?? { kind: 'trust', trust: { v: 1, epoch: 7 } };
          env.clerk = { isLoaded: true, isSignedIn: s.signedIn ?? true, email: 'dana@example.com' };
          env.online = s.online ?? true;
          env.record = s.record ?? ['family', 'teacher', 'school'];
          const r = await mount(s.mount ?? 'ready');
          if (s.sheet === true) await tap(r.root, 'account-card-sign-out');
          // Every accessible name and description too (react-native-web: `aria-label`; a hint is a described-by caption).
          const labels = hostNodes(r.root, (n) => typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label'] as string);
          const texts = [...screenTexts(r.root), ...labels, ...(s.sheet === true ? [sheetOf(r.root).title, sheetOf(r.root).confirmLabel, sheetOf(r.root).cancelLabel] : [])];
          expect(texts, `${locale} ${name}`).toContain(getMessages(locale).caregiver.account.card.title);
          const hits = texts.flatMap((t) => accountDenyHits(t.replace('dana@example.com', ''), locale).map((h) => `${platform} ${locale} ${name}: "${t}" has ${h}`));
          expect(hits).toEqual([]);
          expect(hostNodes(r.root, (n) => n.props.href !== undefined), `${locale} ${name}: a link`).toEqual([]);
          await unmount(r);
        }
      }
      expect(openURL).not.toHaveBeenCalled();
    });
  }
});
