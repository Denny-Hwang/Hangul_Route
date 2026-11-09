import { ScreenHeaderSlotContext, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { createElement, type ReactElement } from 'react';
import { AccessibilityInfo, Linking, TextInput } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountDenyHits } from '../../../logic/account/deny-list';
import { byTestId, buttonsNamed, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { useAccountVisit } from '../../../store/account-visit';
import { useLocaleStore } from '../../../store/locale-store';
import { AccountHostContext, ClerkMountContext, OFF_HOST, type ClerkMountState } from '../account-host';
import { SignInScreen } from '../SignInScreen.native';

/**
 * F-AUTH-004 sections 6.3, 6.5 and 15, design `sign-in.md` boards 1 to 18 (row NS-3), in the `native` project: every
 * step and error state, offline, Cancel, the records a completed sign-in writes (with the re-trust rule), one
 * `auth.native.signin` per flow, and the deny list of section 9.2 over every state in en, es and ko on iOS and Android.
 * Clerk is mocked at its hooks.
 */

type View = { status: string | null; supportedFirstFactors: unknown[] | null; supportedSecondFactors: unknown[] | null; clientTrustState?: string; createdSessionId: string | null };
type Step = (params: unknown) => Promise<View>;

const clerk = vi.hoisted(() => ({
  calls: [] as string[],
  answers: {} as Record<string, (params: unknown) => Promise<unknown>>,
  setActive: vi.fn(async (_p: { session: string }) => undefined),
  getToken: vi.fn(async () => 'token'),
  loaded: true,
  signedIn: false,
  hook: null as unknown,
}));

vi.mock('@clerk/clerk-expo', () => {
  const resource = (view: unknown): unknown => {
    const call = (name: string) => async (params: unknown) => {
      clerk.calls.push(`${name}:${JSON.stringify(params)}`);
      const answer = clerk.answers[name];
      if (answer === undefined) throw new Error(`no answer for ${name}`);
      return resource(await answer(params));
    };
    return { ...(view as object), create: call('create'), prepareFirstFactor: call('prepareFirstFactor'), attemptFirstFactor: call('attemptFirstFactor'), prepareSecondFactor: call('prepareSecondFactor'), attemptSecondFactor: call('attemptSecondFactor') };
  };
  clerk.hook = { isLoaded: true, signIn: resource({ status: null, supportedFirstFactors: null, supportedSecondFactors: null, createdSessionId: null }), setActive: clerk.setActive };
  return {
    useSignIn: () => (clerk.loaded ? clerk.hook : { isLoaded: false, signIn: undefined, setActive: clerk.setActive }),
    useAuth: () => ({ isLoaded: true, isSignedIn: clerk.signedIn, getToken: clerk.getToken }),
  };
});

const env = vi.hoisted(() => ({
  gate: { state: 'pin', epoch: 7 } as { state: string; epoch?: number },
  trust: { kind: 'none' } as { kind: string; trust?: unknown },
  pinResetByWait: null as unknown,
  retrustRequired: false,
  spacesGate: null as null | Promise<void>,
  trustGate: null as null | Promise<void>,
  online: true,
  onlineListener: null as null | ((online: boolean) => void),
  writes: [] as string[],
  spaces: { ok: true, data: { spaces: [{ space: { kind: 'family' }, role: 'owner' }, { space: { kind: 'class' }, role: 'teacher' }] } } as unknown,
  tracked: [] as { name: string; payload: unknown }[],
  cached: [] as unknown[],
}));
vi.mock('../../../store/native-gate-state', () => ({ nativeGateState: async () => env.gate }));
vi.mock('../../../store/account-store', () => ({ useAccountStore: { getState: () => ({ pinResetByWait: env.pinResetByWait }) } }));
vi.mock('../../../platform/account-records', () => ({
  readTrust: async () => {
    if (env.trustGate !== null) await env.trustGate;
    return env.trust;
  },
  writeTrust: async (r: unknown) => void env.writes.push(`trust ${JSON.stringify(r)}`),
  writeDeviceUses: async (r: { uses: unknown }) => void env.writes.push(`uses ${JSON.stringify(r.uses)}`),
  writeRetrustNotice: async () => void env.writes.push('notice'),
  readRetrustRequired: async () => env.retrustRequired,
  clearRetrustRequired: async () => void env.writes.push('clear retrustRequired'),
}));
vi.mock('../../../platform/account-online', () => ({
  readAccountOnline: async () => env.online,
  subscribeAccountOnline: (listener: (online: boolean) => void) => {
    env.onlineListener = listener;
    return () => undefined;
  },
}));
vi.mock('../../../platform/telemetry', () => ({ track: async (event: { name: string; payload: unknown }) => void env.tracked.push(event) }));
vi.mock('../../../logic/account/api', () => ({
  createAccountApi: () => ({
    spaces: async () => {
      if (env.spacesGate !== null) await env.spacesGate;
      return env.spaces;
    },
  }),
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ setQueryData: (key: unknown, data: unknown) => void env.cached.push({ key, data }) }) }));

const view = (over: Partial<View> = {}): View => ({
  status: 'needs_first_factor',
  supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'ea_1' }, { strategy: 'password' }],
  supportedSecondFactors: null,
  createdSessionId: null,
  ...over,
});
const clerkError = (code: string, status = 422): Error => Object.assign(new Error(`Clerk English for ${code}`), { clerkError: true, status, errors: [{ code, message: `Clerk English for ${code}` }] });
const answer = (name: string, fn: Step): void => {
  clerk.answers[name] = fn;
};

function navigation(): { goBack: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn>; addListener: () => () => void } {
  return { goBack: vi.fn(), navigate: vi.fn(), addListener: () => () => undefined };
}

let nav = navigation();
const endSession = vi.fn(async () => true);

function HeaderTitle({ options }: ScreenHeaderSlotProps): ReactElement {
  return createElement('header-title', null, options?.title ?? null);
}

async function mount(state: ClerkMountState = 'ready'): Promise<ReactTestRenderer> {
  nav = navigation();
  const screen = createElement(SignInScreen, { navigation: nav, route: { key: 'SignIn-1', name: 'SignIn', params: undefined } } as never);
  // The route's header slot (App provides LearnerScreenHeader): here a stand-in that draws the title the screen passes.
  const host = { ...OFF_HOST, mount: state, endSession };
  const element: ReactElement = createElement(
    ScreenHeaderSlotContext.Provider,
    { value: HeaderTitle },
    createElement(AccountHostContext.Provider, { value: host }, createElement(ClerkMountContext.Provider, { value: state }, screen)),
  );
  const r = await render(element);
  await settle();
  return r;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const field = (root: ReactTestInstance, kind: string): ReactTestInstance => root.findAll((n) => n.type === TextInput && n.props.testID === `sign-in-field-${kind}`)[0]!;
const type = async (root: ReactTestInstance, kind: string, text: string): Promise<void> => {
  await act(async () => {
    field(root, kind).props.onChangeText(text);
  });
};
const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  await press(byTestId(root, id)[0]!);
  await settle();
};
const softDisabled = (root: ReactTestInstance, id: string): boolean => byTestId(root, id)[0]!.props['aria-disabled'] === true;
const step = (root: ReactTestInstance): string => {
  const node = root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('sign-in-step-'))[0];
  return String(node?.props.testID).replace('sign-in-step-', '');
};

const en = getMessages('en');
const m = en.caregiver.account;

async function toCode(r: ReactTestRenderer, email = 'dana@example.com'): Promise<void> {
  await type(r.root, 'email', email);
  await tap(r.root, 'sign-in-submit');
}

beforeEach(() => {
  // react-native-web's TextInput reads `document.activeElement` when it mounts; Node has no document.
  vi.stubGlobal('document', { activeElement: null });
  setPlatform('ios');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useAccountVisit.setState({ lastAccountSignInAt: null, signedInThisVisit: false, retrustPending: false, signedOutThisRun: false });
  clerk.calls = [];
  clerk.loaded = true;
  clerk.answers = {};
  clerk.setActive.mockClear();
  answer('create', async () => view());
  answer('prepareFirstFactor', async () => view());
  answer('attemptFirstFactor', async () => view({ status: 'complete', createdSessionId: 'sess_1' }));
  answer('prepareSecondFactor', async () => view({ status: 'needs_second_factor' }));
  answer('attemptSecondFactor', async () => view({ status: 'complete', createdSessionId: 'sess_2' }));
  env.gate = { state: 'pin', epoch: 7 };
  env.trust = { kind: 'none' };
  env.pinResetByWait = null;
  env.retrustRequired = false;
  env.spacesGate = null;
  env.trustGate = null;
  clerk.signedIn = false;
  endSession.mockClear();
  env.online = true;
  env.onlineListener = null;
  env.writes = [];
  env.tracked = [];
  env.cached = [];
  env.spaces = { ok: true, data: { spaces: [{ space: { kind: 'family' }, role: 'owner' }, { space: { kind: 'class' }, role: 'teacher' }] } };
});

afterEach(() => {
  resetPlatform();
});

describe('the email step (board 1 to 6)', () => {
  it('the title, the intro, the visible Email label, Continue waiting for an @, the two quiet lines and nothing else', async () => {
    const r = await mount();
    const texts = screenTexts(r.root);
    for (const line of [m.signIn.title, m.signIn.intro, m.signIn.email, en.common.buttons.continue, m.signIn.learners, m.signIn.noNewAccounts]) expect(texts, line).toContain(line);
    expect(field(r.root, 'email').props).toMatchObject({ textContentType: 'emailAddress', autoComplete: 'email', keyboardType: 'email-address', autoCorrect: false, accessibilityLabel: m.signIn.email });
    expect(softDisabled(r.root, 'sign-in-submit')).toBe(true);
    await type(r.root, 'email', 'dana');
    expect(softDisabled(r.root, 'sign-in-submit')).toBe(true);
    await type(r.root, 'email', 'dana@example.com');
    expect(softDisabled(r.root, 'sign-in-submit')).toBe(false);
  });

  it.each([
    [clerkError('form_identifier_not_found'), 'cantSignIn'],
    [clerkError('too_many_requests', 429), 'tooMany'],
    [new Error('boom'), 'generic'],
  ] as const)('%s: the line under the field, announced and tied to it; the email kept; Clerk’s English never shows', async (error, line) => {
    const announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility');
    answer('create', async () => Promise.reject(error));
    const r = await mount();
    await toCode(r);
    expect(step(r.root)).toBe('email');
    expect(screenTexts(r.root)).toContain(m.errors[line]);
    expect(field(r.root, 'email').props.accessibilityHint).toBe(m.errors[line]);
    expect(field(r.root, 'email').props.value).toBe('dana@example.com');
    expect(announce).toHaveBeenCalledWith(m.errors[line]);
    expect(screenTexts(r.root).join(' ')).not.toMatch(/Clerk English/);
  });
});

describe('the code step (boards 7 to 9)', () => {
  it('the address the code went to, the code field, and four actions for a password account', async () => {
    const r = await mount();
    await toCode(r);
    expect(clerk.calls).toEqual(['create:{"identifier":"dana@example.com"}', 'prepareFirstFactor:{"strategy":"email_code","emailAddressId":"ea_1"}']);
    expect(step(r.root)).toBe('code');
    expect(screenTexts(r.root)).toContain(m.signIn.codeSent('dana@example.com'));
    expect(field(r.root, 'code').props).toMatchObject({ textContentType: 'oneTimeCode', autoComplete: 'one-time-code', keyboardType: 'number-pad', accessibilityLabel: en.a11y.account.codeField });
    for (const id of ['sign-in-submit', 'sign-in-resend', 'sign-in-use-password', 'sign-in-change-email']) expect(byTestId(r.root, id), id).toHaveLength(1);
  });

  it('the code field reads its digits one by one, and takes digits only', async () => {
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '48 21a3');
    expect(field(r.root, 'code').props.value).toBe('48213');
    expect(field(r.root, 'code').props.accessibilityValue).toEqual({ text: '4 8 2 1 3' });
  });

  it('a wrong code: the line, the field cleared', async () => {
    answer('attemptFirstFactor', async () => Promise.reject(clerkError('form_code_incorrect')));
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482130');
    await tap(r.root, 'sign-in-submit');
    expect(screenTexts(r.root)).toContain(m.errors.wrongCode);
    expect(field(r.root, 'code').props.value).toBe('');
    expect(field(r.root, 'code').props['aria-invalid']).toBe(true);
  });

  it('an expired code says so; Send a new code sends it again and clears the line', async () => {
    answer('attemptFirstFactor', async () => Promise.reject(clerkError('verification_expired')));
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482130');
    await tap(r.root, 'sign-in-submit');
    expect(screenTexts(r.root)).toContain(m.errors.codeExpired);
    await tap(r.root, 'sign-in-resend');
    expect(clerk.calls.filter((c) => c.startsWith('prepareFirstFactor'))).toHaveLength(2);
    expect(screenTexts(r.root)).not.toContain(m.errors.codeExpired);
  });

  it('an email-code-only account has no Use my password', async () => {
    answer('create', async () => view({ supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'ea_1' }] }));
    const r = await mount();
    await toCode(r);
    expect(byTestId(r.root, 'sign-in-use-password')).toHaveLength(0);
  });

  it('Use another email: back to the email step with the email kept', async () => {
    const r = await mount();
    await toCode(r);
    await tap(r.root, 'sign-in-change-email');
    expect(step(r.root)).toBe('email');
    expect(field(r.root, 'email').props.value).toBe('dana@example.com');
  });
});

describe('the password step (boards 10 to 12)', () => {
  it('Use my password: the password field (secure), Email me a code, a wrong password’s line', async () => {
    answer('attemptFirstFactor', async () => Promise.reject(clerkError('form_password_incorrect')));
    const r = await mount();
    await toCode(r);
    await tap(r.root, 'sign-in-use-password');
    expect(step(r.root)).toBe('password');
    expect(field(r.root, 'password').props).toMatchObject({ textContentType: 'password', secureTextEntry: true, accessibilityLabel: m.signIn.password });
    expect(field(r.root, 'password').props.accessibilityValue).toBeUndefined();
    await type(r.root, 'password', 'hunter2');
    await tap(r.root, 'sign-in-submit');
    expect(screenTexts(r.root)).toContain(m.errors.wrongPassword);
    expect(field(r.root, 'password').props.value).toBe('');
    await tap(r.root, 'sign-in-use-code');
    expect(step(r.root)).toBe('code');
  });

  it('a password-only account goes straight to the password step, with no Email me a code', async () => {
    answer('create', async () => view({ supportedFirstFactors: [{ strategy: 'password' }] }));
    const r = await mount();
    await toCode(r);
    expect(step(r.root)).toBe('password');
    expect(byTestId(r.root, 'sign-in-use-code')).toHaveLength(0);
    expect(clerk.calls.some((c) => c.startsWith('prepareFirstFactor'))).toBe(false);
  });

  it('D21: while a re-trust is pending, Continue opens the password step first and sends no code', async () => {
    env.trust = { kind: 'trust', trust: { v: 1, epoch: 3 } };
    const r = await mount();
    await toCode(r);
    expect(step(r.root)).toBe('password');
    expect(clerk.calls).toEqual(['create:{"identifier":"dana@example.com"}']);
    expect(byTestId(r.root, 'sign-in-use-code')).toHaveLength(1);
  });
});

describe('the second step, the device check, backup codes and unsupported (boards 13 to 16)', () => {
  it('an authenticator with backup codes: the second-step line, Use a backup code, then a plain field named Code (D4)', async () => {
    answer('attemptFirstFactor', async () => view({ status: 'needs_second_factor', supportedSecondFactors: [{ strategy: 'totp' }, { strategy: 'backup_code' }] }));
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482139');
    await tap(r.root, 'sign-in-submit');
    expect(step(r.root)).toBe('second');
    expect(screenTexts(r.root)).toContain(m.signIn.secondStep);
    expect(byTestId(r.root, 'sign-in-resend')).toHaveLength(0);
    await tap(r.root, 'sign-in-use-backup');
    expect(byTestId(r.root, 'sign-in-use-backup')).toHaveLength(0);
    const backup = field(r.root, 'backup');
    expect(backup.props.accessibilityLabel).toBe(m.signIn.code);
    expect(backup.props.keyboardType).toBeUndefined();
    expect(backup.props.textContentType).toBeUndefined();
    await type(r.root, 'backup', 'abcd-1234');
    await tap(r.root, 'sign-in-submit');
    expect(clerk.calls).toContain('attemptSecondFactor:{"strategy":"backup_code","code":"abcd-1234"}');
  });

  it('the new-device check (needs_second_factor, clientTrustState new): its own line and Send a new code', async () => {
    answer('attemptFirstFactor', async () => view({ status: 'needs_second_factor', clientTrustState: 'new', supportedSecondFactors: [{ strategy: 'email_code', emailAddressId: 'ea_1' }] }));
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482139');
    await tap(r.root, 'sign-in-submit');
    expect(screenTexts(r.root)).toContain(m.signIn.deviceCheck);
    expect(byTestId(r.root, 'sign-in-resend')).toHaveLength(1);
    await tap(r.root, 'sign-in-resend');
    expect(clerk.calls.filter((c) => c.startsWith('prepareSecondFactor'))).toHaveLength(2);
  });

  it('a status this app does not have: the unsupported strip and Use another email only', async () => {
    answer('attemptFirstFactor', async () => view({ status: 'needs_new_password' }));
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482139');
    await tap(r.root, 'sign-in-submit');
    expect(step(r.root)).toBe('unsupported');
    expect(screenTexts(r.root)).toContain(m.errors.unsupported);
    expect(byTestId(r.root, 'sign-in-submit')).toHaveLength(0);
    await tap(r.root, 'sign-in-change-email');
    expect(step(r.root)).toBe('email');
  });
});

describe('offline (boards 17 and 18, D2)', () => {
  it('the strip; the buttons that call Clerk wait, the ones that change the step stay; all back on the network', async () => {
    const r = await mount();
    await toCode(r);
    await act(async () => env.onlineListener?.(false));
    expect(byTestId(r.root, 'sign-in-offline')).toHaveLength(1);
    expect(screenTexts(r.root)).toContain(en.learner.welcome.grownUps.needsInternet);
    await type(r.root, 'code', '482139');
    expect(softDisabled(r.root, 'sign-in-submit')).toBe(true);
    expect(softDisabled(r.root, 'sign-in-resend')).toBe(true);
    expect(softDisabled(r.root, 'sign-in-use-password')).toBe(false);
    await tap(r.root, 'sign-in-submit');
    expect(clerk.calls.some((c) => c.startsWith('attemptFirstFactor'))).toBe(false);
    expect(field(r.root, 'code').props.value).toBe('482139');
    await act(async () => env.onlineListener?.(true));
    expect(softDisabled(r.root, 'sign-in-submit')).toBe(false);
  });

  it('a request that fails for the network shows the offline line', async () => {
    answer('create', async () => Promise.reject(Object.assign(new Error('x'), { code: 'network_error' })));
    const r = await mount();
    await toCode(r);
    expect(byTestId(r.root, 'sign-in-error')).toHaveLength(1);
    expect(screenTexts(r.root)).toContain(en.learner.welcome.grownUps.needsInternet);
  });
});

describe('section 6.5: a completed sign-in', () => {
  it('on a pin device: the session, the trust and the uses records, the sign-in time, ok once, then back', async () => {
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482139');
    await tap(r.root, 'sign-in-submit');
    expect(clerk.setActive).toHaveBeenCalledWith({ session: 'sess_1' });
    expect(env.writes).toEqual(['trust {"v":1,"epoch":7}', 'uses ["family","teacher"]']);
    expect(env.cached).toEqual([{ key: ['account', 'spaces'], data: env.spaces && (env.spaces as { data: unknown }).data }]);
    expect(useAccountVisit.getState()).toMatchObject({ signedInThisVisit: true, retrustPending: false });
    expect(useAccountVisit.getState().lastAccountSignInAt).not.toBeNull();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    await unmount(r);
    expect(env.tracked).toEqual([{ name: 'auth.native.signin', payload: { os: 'ios', method: 'email_code', result: 'ok', second: false } }]);
  });

  it('after a PIN change an email code alone writes no trust: the lock stays for the password (7.3, R-1)', async () => {
    env.pinResetByWait = { v: 1, at: 1 };
    answer('create', async () => view());
    const r = await mount();
    // D21 sends Continue to the password step; the grown-up asks for a code instead.
    await toCode(r);
    await tap(r.root, 'sign-in-use-code');
    await type(r.root, 'code', '482139');
    await tap(r.root, 'sign-in-submit');
    expect(env.writes).toEqual([]);
    expect(useAccountVisit.getState().retrustPending).toBe(true);
  });

  it('R-1: the wait’s record, gone from the store once the area’s notice showed, still holds through the account’s copy', async () => {
    // The notice deleted `account:pinResetByWait`; the area copied it first (grown-up-stack.native.tsx).
    env.pinResetByWait = null;
    env.retrustRequired = true;
    answer('create', async () => view());
    const r = await mount();
    await toCode(r);
    // D21: the password step first, no code sent.
    expect(step(r.root)).toBe('password');
    await tap(r.root, 'sign-in-use-code');
    await type(r.root, 'code', '482139');
    await tap(r.root, 'sign-in-submit');
    expect(env.writes).toEqual([]);
    expect(useAccountVisit.getState().retrustPending).toBe(true);
  });

  it('a password sign-in after the wait trusts the new PIN and deletes the account’s copy', async () => {
    env.retrustRequired = true;
    const r = await mount();
    await toCode(r);
    await type(r.root, 'password', 'hunter2');
    await tap(r.root, 'sign-in-submit');
    expect(env.writes).toEqual(['trust {"v":1,"epoch":7}', 'notice', 'clear retrustRequired', 'uses ["family","teacher"]']);
  });

  it('the password re-trusts and leaves the home’s notice', async () => {
    env.trust = { kind: 'trust', trust: { v: 1, epoch: 3 } };
    const r = await mount();
    await toCode(r);
    await type(r.root, 'password', 'hunter2');
    await tap(r.root, 'sign-in-submit');
    expect(env.writes).toEqual(['trust {"v":1,"epoch":7}', 'notice', 'uses ["family","teacher"]']);
    expect(useAccountVisit.getState().retrustPending).toBe(false);
  });

  it('a device that is not pin keeps nothing (ND-9); a failed spaces read still completes', async () => {
    env.gate = { state: 'open' };
    env.spaces = { ok: false, error: 'offline', status: -1 };
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482139');
    await tap(r.root, 'sign-in-submit');
    expect(env.writes).toEqual([]);
    expect(env.cached).toEqual([]);
    expect(useAccountVisit.getState().signedInThisVisit).toBe(true);
    expect(nav.goBack).toHaveBeenCalled();
  });
});

describe('the review round (row NS-3)', () => {
  it('D21: Continue waits until the re-trust state is read', async () => {
    let release: () => void = () => undefined;
    env.trustGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const r = await mount();
    await type(r.root, 'email', 'dana@example.com');
    expect(softDisabled(r.root, 'sign-in-submit')).toBe(true);
    release();
    await settle();
    expect(softDisabled(r.root, 'sign-in-submit')).toBe(false);
  });

  it('the submit is announced busy with the same words while Clerk answers; every other button waits (D2)', async () => {
    let release: (v: unknown) => void = () => undefined;
    answer('attemptFirstFactor', () => new Promise((resolve) => {
      release = resolve as (v: unknown) => void;
    }) as never);
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482139');
    await press(byTestId(r.root, 'sign-in-submit')[0]!);
    const submit = byTestId(r.root, 'sign-in-submit')[0]!;
    expect(submit.props['aria-busy']).toBe(true);
    expect(submit.props['aria-disabled']).toBe(true);
    expect(screenTexts(submit)).toContain(m.signIn.submit.cta);
    for (const id of ['sign-in-resend', 'sign-in-use-password', 'sign-in-change-email']) expect(softDisabled(r.root, id), id).toBe(true);
    await act(async () => release(view({ status: 'complete', createdSessionId: 'sess_1' })));
    await settle();
  });

  it('m5: once done, the step stays drawn, waiting, while the records are written', async () => {
    let release: () => void = () => undefined;
    env.spacesGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482139');
    await tap(r.root, 'sign-in-submit');
    expect(step(r.root)).toBe('code');
    expect(byTestId(r.root, 'sign-in-submit')[0]!.props['aria-busy']).toBe(true);
    // The trust is written before the spaces read answers (m8).
    expect(env.writes).toEqual(['trust {"v":1,"epoch":7}']);
    release();
    await settle();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  it('M1: leaving while the records are written sends ok once, never twice', async () => {
    let release: () => void = () => undefined;
    env.spacesGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482139');
    await tap(r.root, 'sign-in-submit');
    await unmount(r);
    release();
    await settle();
    expect(env.tracked).toEqual([{ name: 'auth.native.signin', payload: { os: 'ios', method: 'email_code', result: 'ok', second: false } }]);
    expect(nav.goBack).not.toHaveBeenCalled();
  });

  it('M1: leaving while Clerk answers a sign-in that completes still records it (one ok, the sign-in time)', async () => {
    let release: (v: unknown) => void = () => undefined;
    answer('attemptFirstFactor', () => new Promise((resolve) => {
      release = resolve as (v: unknown) => void;
    }) as never);
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '482139');
    await press(byTestId(r.root, 'sign-in-submit')[0]!);
    await unmount(r);
    expect(env.tracked).toEqual([]);
    await act(async () => release(view({ status: 'complete', createdSessionId: 'sess_1' })));
    await settle();
    expect(clerk.setActive).toHaveBeenCalledWith({ session: 'sess_1' });
    expect(useAccountVisit.getState().signedInThisVisit).toBe(true);
    expect(env.writes[0]).toBe('trust {"v":1,"epoch":7}');
    expect(env.tracked).toEqual([{ name: 'auth.native.signin', payload: { os: 'ios', method: 'email_code', result: 'ok', second: false } }]);
    expect(nav.goBack).not.toHaveBeenCalled();
  });

  it('leaving while Clerk answers a refusal sends that refusal once', async () => {
    let fail: (e: unknown) => void = () => undefined;
    answer('attemptFirstFactor', () => new Promise((_resolve, reject) => {
      fail = reject;
    }) as never);
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '1');
    await press(byTestId(r.root, 'sign-in-submit')[0]!);
    await unmount(r);
    await act(async () => fail(clerkError('form_code_incorrect')));
    await settle();
    expect(env.tracked).toEqual([{ name: 'auth.native.signin', payload: { os: 'ios', method: 'email_code', result: 'wrong_code', second: false } }]);
  });

  it('ND-14: a session Clerk still holds (its sign-out could not reach Clerk) is ended before a new sign-in', async () => {
    clerk.signedIn = true;
    const r = await mount();
    await toCode(r);
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(clerk.calls[0]).toBe('create:{"identifier":"dana@example.com"}');
  });

  it('the same line twice is announced twice; unsupported and going offline are announced', async () => {
    const announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility');
    answer('create', async () => Promise.reject(clerkError('too_many_requests', 429)));
    const r = await mount();
    await toCode(r);
    await tap(r.root, 'sign-in-submit');
    expect(announce.mock.calls.filter(([t]) => t === m.errors.tooMany)).toHaveLength(2);
    await act(async () => env.onlineListener?.(false));
    expect(announce).toHaveBeenCalledWith(en.learner.welcome.grownUps.needsInternet);
    answer('create', async () => view({ supportedFirstFactors: [] }));
    await act(async () => env.onlineListener?.(true));
    await tap(r.root, 'sign-in-submit');
    expect(announce).toHaveBeenCalledWith(m.errors.unsupported);
  });

  it('button looks: the submit is the filled one, the others paper, Use another email quiet', async () => {
    const r = await mount();
    await toCode(r);
    const tones = (id: string): string => String(r.root.findAll((n) => n.props.testID === id && typeof n.props.tone === 'string')[0]?.props.tone);
    expect(tones('sign-in-submit')).toBe('primary');
    expect(tones('sign-in-resend')).toBe('paper');
    expect(tones('sign-in-use-password')).toBe('paper');
    expect(tones('sign-in-change-email')).toBe('quiet');
  });
});

describe('section 15: one auth.native.signin per flow', () => {
  it('leaving with no attempt is cancelled', async () => {
    const r = await mount();
    await unmount(r);
    expect(env.tracked).toEqual([{ name: 'auth.native.signin', payload: { os: 'ios', method: 'none', result: 'cancelled', second: false } }]);
  });

  it('leaving after a refusal sends the last result once, with the method of the last attempt', async () => {
    setPlatform('android');
    answer('attemptFirstFactor', async () => Promise.reject(clerkError('form_code_incorrect')));
    const r = await mount();
    await toCode(r);
    await type(r.root, 'code', '1');
    await tap(r.root, 'sign-in-submit');
    await unmount(r);
    expect(env.tracked).toEqual([{ name: 'auth.native.signin', payload: { os: 'android', method: 'email_code', result: 'wrong_code', second: false } }]);
  });

  it('a render of another platform sends nothing', async () => {
    setPlatform('web');
    const r = await mount();
    await unmount(r);
    expect(env.tracked).toEqual([]);
  });
});

describe('without Clerk for this visit', () => {
  it.each(['off', 'pending'] as const)('%s: cantCheck and Back, and no Clerk call', async (state) => {
    const r = await mount(state);
    expect(screenTexts(r.root)).toContain(m.lock.cantCheck);
    await press(buttonsNamed(r.root, en.common.buttons.back)[0]!);
    expect(nav.goBack).toHaveBeenCalled();
    expect(clerk.calls).toEqual([]);
  });

  it('Clerk not loaded yet: Continue waits', async () => {
    clerk.loaded = false;
    const r = await mount();
    await type(r.root, 'email', 'dana@example.com');
    expect(softDisabled(r.root, 'sign-in-submit')).toBe(true);
  });
});

describe('section 9.2: no purchase, price, renewal, web or sign-up word in any state, in en, es and ko, on iOS and Android', () => {
  /** Every state of the screen, reached the way a grown-up reaches it. */
  const STATES: Record<string, (r: ReactTestRenderer) => Promise<void>> = {
    email: async () => undefined,
    cantSignIn: async (r) => {
      answer('create', async () => Promise.reject(clerkError('form_identifier_not_found')));
      await toCode(r);
    },
    tooMany: async (r) => {
      answer('create', async () => Promise.reject(clerkError('too_many_requests', 429)));
      await toCode(r);
    },
    generic: async (r) => {
      answer('create', async () => Promise.reject(new Error('x')));
      await toCode(r);
    },
    code: async (r) => toCode(r),
    wrongCode: async (r) => {
      answer('attemptFirstFactor', async () => Promise.reject(clerkError('form_code_incorrect')));
      await toCode(r);
      await type(r.root, 'code', '1');
      await tap(r.root, 'sign-in-submit');
    },
    codeExpired: async (r) => {
      answer('attemptFirstFactor', async () => Promise.reject(clerkError('verification_expired')));
      await toCode(r);
      await type(r.root, 'code', '1');
      await tap(r.root, 'sign-in-submit');
    },
    wrongPassword: async (r) => {
      answer('attemptFirstFactor', async () => Promise.reject(clerkError('form_password_incorrect')));
      await toCode(r);
      await tap(r.root, 'sign-in-use-password');
      await type(r.root, 'password', 'p');
      await tap(r.root, 'sign-in-submit');
    },
    second: async (r) => {
      answer('attemptFirstFactor', async () => view({ status: 'needs_second_factor', supportedSecondFactors: [{ strategy: 'totp' }, { strategy: 'backup_code' }] }));
      await toCode(r);
      await type(r.root, 'code', '1');
      await tap(r.root, 'sign-in-submit');
    },
    backup: async (r) => {
      await STATES.second!(r);
      await tap(r.root, 'sign-in-use-backup');
    },
    device: async (r) => {
      answer('attemptFirstFactor', async () => view({ status: 'needs_client_trust', supportedSecondFactors: [{ strategy: 'email_code' }] }));
      await toCode(r);
      await type(r.root, 'code', '1');
      await tap(r.root, 'sign-in-submit');
    },
    unsupported: async (r) => {
      answer('create', async () => view({ supportedFirstFactors: [{ strategy: 'oauth_google' }] }));
      await toCode(r);
    },
    offline: async (r) => {
      await toCode(r);
      await act(async () => env.onlineListener?.(false));
    },
    networkFail: async (r) => {
      answer('create', async () => Promise.reject(Object.assign(new Error('x'), { code: 'network_error' })));
      await toCode(r);
    },
    busy: async (r) => {
      answer('attemptFirstFactor', () => new Promise(() => undefined) as never);
      await toCode(r);
      await type(r.root, 'code', '1');
      await press(byTestId(r.root, 'sign-in-submit')[0]!);
    },
  };
  /** The states drawn without Clerk for this visit (`lock.cantCheck` and Back). */
  const WITHOUT_CLERK: ClerkMountState[] = ['off', 'pending'];

  for (const platform of ['ios', 'android'] as const) {
    it(`${platform}: every state, every language`, async () => {
      for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
        for (const [name, reach] of Object.entries(STATES)) {
          setPlatform(platform);
          vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
          useLocaleStore.setState({ device: locale, byProfile: {} });
          answer('create', async () => view());
          answer('attemptFirstFactor', async () => view({ status: 'complete', createdSessionId: 's' }));
          env.online = true;
          const r = await mount();
          await reach(r);
          await expectClean(r, platform, locale, name);
          await unmount(r);
        }
        for (const state of WITHOUT_CLERK) {
          setPlatform(platform);
          vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
          useLocaleStore.setState({ device: locale, byProfile: {} });
          const r = await mount(state);
          await expectClean(r, platform, locale, `unavailable ${state}`);
          await unmount(r);
        }
      }
      expect(openURL).not.toHaveBeenCalled();
    });
  }

  const openURL = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);

  /** No denied word in the text tree or any label, hint or value; no link (no host node with an href). */
  async function expectClean(r: ReactTestRenderer, platform: string, locale: UiLocale, name: string): Promise<void> {
    const texts = screenTexts(r.root);
    expect(texts, `${locale} ${name}`).toContain(getMessages(locale).caregiver.account.signIn.title);
    // The fixture's email is typed by a grown-up (section 9.2: not checked).
    const hits = texts.flatMap((t) => accountDenyHits(t.replace('dana@example.com', ''), locale).map((h) => `${platform} ${locale} ${name}: "${t}" has ${h}`));
    expect(hits).toEqual([]);
    expect(hostNodes(r.root, (n) => n.props.href !== undefined), `${locale} ${name}: a link`).toEqual([]);
  }
});
