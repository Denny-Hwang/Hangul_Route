import { describe, expect, it, vi } from 'vitest';
import type { DeviceGateRead } from '../grown-up-lock';
import {
  CLERK_LOAD_TIMEOUT_MS,
  DEVICE_READ_TIMEOUT_MS,
  REVERIFY_CONFIG,
  SIGNIN_PROOF_MS,
  acceptedNext,
  clerkUnreachable,
  createModeUrl,
  deviceCanLock,
  finishReverify,
  grantSignInUnlock,
  isSecretFactor,
  isStandaloneDisplay,
  oauthRedirectStarted,
  oauthSignUpStarted,
  personasOfSpaces,
  planAfterSignIn,
  proofAtSignIn,
  proofFromSignIn,
  proofFromSignUp,
  resolveDestination,
  reverifyOnce,
  routerDestination,
  secretVerifiedHere,
  settleSignIn,
  signInReturnUrl,
  signedOutTarget,
  showStandaloneFinish,
  signedInHere,
  withTimeout,
  type SignInIo,
  type SpacesResult,
} from '../signin-flow';

/**
 * F-APP-001 A-4b (sections 3.5, 3.7, 3.9, 3.11, 3.19): the pure parts of `/signin`, the `/teach`
 * router and the shared grown-up layout. The pages wire these to Clerk and the browser.
 */
const NONE: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: true };
const NO_DATA: DeviceGateRead = { readable: true, marker: null, hasProfiles: false };
const PIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: 1_700 }, hasProfiles: true };
const PIN_ZERO: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: 0 }, hasProfiles: true };
const NOPIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true };
const OLD_APP: DeviceGateRead = { readable: true, marker: null, hasProfiles: true };
const FAILED: DeviceGateRead = { readable: false, reason: 'failed' };
const NO_IDB: DeviceGateRead = { readable: false, reason: 'unavailable' };

const params = (query: string): URLSearchParams => new URLSearchParams(query);

describe('secret-proving first factors (section 3.9)', () => {
  it.each(['password', 'email_code', 'phone_code', 'passkey', 'reset_password_email_code', 'reset_password_phone_code'])('%s proves a secret', (strategy) => {
    expect(isSecretFactor(strategy)).toBe(true);
  });

  it.each(['oauth_google', 'oauth_apple', 'enterprise_sso', 'saml', 'google_one_tap', 'ticket', 'email_link', 'web3_metamask_signature', '', null, undefined])('%s does not count on its own', (strategy) => {
    expect(isSecretFactor(strategy)).toBe(false);
  });
});

describe('proofFromSignIn: the completed sign-in of this tab', () => {
  it('a complete password or email-code sign-in proves a secret for the session it created', () => {
    expect(proofFromSignIn({ status: 'complete', createdSessionId: 'sess_1', firstFactorVerification: { strategy: 'password' } })).toEqual({ sessionId: 'sess_1', secret: true });
    expect(proofFromSignIn({ status: 'complete', createdSessionId: 'sess_1', firstFactorVerification: { strategy: 'email_code' } })).toEqual({ sessionId: 'sess_1', secret: true });
  });

  it('a complete Google sign-in is a proof without a secret', () => {
    expect(proofFromSignIn({ status: 'complete', createdSessionId: 'sess_2', firstFactorVerification: { strategy: 'oauth_google' } })).toEqual({ sessionId: 'sess_2', secret: false });
    expect(proofFromSignIn({ status: 'complete', createdSessionId: 'sess_2', firstFactorVerification: null })).toEqual({ sessionId: 'sess_2', secret: false });
  });

  it('an unfinished or empty sign-in is no proof', () => {
    expect(proofFromSignIn({ status: 'needs_first_factor', createdSessionId: null, firstFactorVerification: { strategy: 'password' } })).toBeNull();
    expect(proofFromSignIn({ status: 'complete', createdSessionId: null })).toBeNull();
    expect(proofFromSignIn(null)).toBeNull();
    expect(proofFromSignIn(undefined)).toBeNull();
  });
});

describe('proofFromSignUp: the account the adult step created', () => {
  it('an email sign-up (verified by a code) proves a secret', () => {
    const code = { strategy: 'email_code', status: 'verified' };
    expect(proofFromSignUp({ status: 'complete', createdSessionId: 'sess_3', verifications: { externalAccount: { status: 'unverified' }, emailAddress: code } })).toEqual({ sessionId: 'sess_3', secret: true });
    expect(proofFromSignUp({ status: 'complete', createdSessionId: 'sess_3', verifications: { emailAddress: code } })).toEqual({ sessionId: 'sess_3', secret: true });
    expect(proofFromSignUp({ status: 'complete', createdSessionId: 'sess_3', verifications: { phoneNumber: { strategy: 'phone_code', status: 'verified' } } })).toEqual({ sessionId: 'sess_3', secret: true });
  });

  it('an email-link sign-up, or one that names no verified code, does not (section 3.9)', () => {
    expect(proofFromSignUp({ status: 'complete', createdSessionId: 'sess_5', verifications: { emailAddress: { strategy: 'email_link', status: 'verified' } } })).toEqual({ sessionId: 'sess_5', secret: false });
    expect(proofFromSignUp({ status: 'complete', createdSessionId: 'sess_5', verifications: { emailAddress: { strategy: 'email_code', status: 'unverified' } } })).toEqual({ sessionId: 'sess_5', secret: false });
    expect(proofFromSignUp({ status: 'complete', createdSessionId: 'sess_5', verifications: null })).toEqual({ sessionId: 'sess_5', secret: false });
  });

  it('a Google sign-up does not', () => {
    expect(proofFromSignUp({ status: 'complete', createdSessionId: 'sess_4', verifications: { externalAccount: { status: 'verified' } } })).toEqual({ sessionId: 'sess_4', secret: false });
    expect(proofFromSignUp({ status: 'complete', createdSessionId: 'sess_4', verifications: { externalAccount: { status: 'verified' }, emailAddress: { strategy: 'email_code', status: 'verified' } } })).toEqual({ sessionId: 'sess_4', secret: false });
  });

  it('an unfinished sign-up is no proof', () => {
    expect(proofFromSignUp({ status: 'missing_requirements', createdSessionId: null })).toBeNull();
    expect(proofFromSignUp(null)).toBeNull();
  });
});

describe('oauthRedirectStarted: an OAuth hand-off left this window (OD-15)', () => {
  it('is true while a Google or SSO first factor waits for its redirect', () => {
    expect(oauthRedirectStarted({ status: 'needs_first_factor', firstFactorVerification: { strategy: 'oauth_google', status: 'unverified', externalVerificationRedirectURL: new URL('https://accounts.example') } })).toBe(true);
    expect(oauthRedirectStarted({ status: 'needs_identifier', firstFactorVerification: { strategy: 'enterprise_sso', status: 'unverified', externalVerificationRedirectURL: 'https://idp.example' } })).toBe(true);
  });

  it('is false for a secret factor, a finished sign-in, or no redirect yet', () => {
    expect(oauthRedirectStarted({ status: 'needs_first_factor', firstFactorVerification: { strategy: 'email_code', status: 'unverified', externalVerificationRedirectURL: null } })).toBe(false);
    expect(oauthRedirectStarted({ status: 'complete', firstFactorVerification: { strategy: 'oauth_google', status: 'verified', externalVerificationRedirectURL: 'https://x' } })).toBe(false);
    expect(oauthRedirectStarted({ status: 'needs_first_factor', firstFactorVerification: { strategy: 'oauth_google', status: 'unverified', externalVerificationRedirectURL: null } })).toBe(false);
    expect(oauthRedirectStarted(null)).toBe(false);
  });
});

describe('showStandaloneFinish: "Finish signing in here with an email code"', () => {
  const now = 100_000;
  it('shows in an installed PWA, signed out, after an OAuth redirect started in this tab', () => {
    expect(showStandaloneFinish({ standalone: true, signedIn: false, record: { v: 1, kind: 'oauth', at: now - 1_000 }, now })).toBe(true);
  });

  it('never in a browser tab, when signed in, without a started redirect, or once the record is stale', () => {
    expect(showStandaloneFinish({ standalone: false, signedIn: false, record: { v: 1, kind: 'oauth', at: now }, now })).toBe(false);
    expect(showStandaloneFinish({ standalone: true, signedIn: true, record: { v: 1, kind: 'oauth', at: now }, now })).toBe(false);
    expect(showStandaloneFinish({ standalone: true, signedIn: false, record: null, now })).toBe(false);
    expect(showStandaloneFinish({ standalone: true, signedIn: false, record: { v: 1, kind: 'proof', sessionId: 's', secret: false, at: now }, now })).toBe(false);
    expect(showStandaloneFinish({ standalone: true, signedIn: false, record: { v: 1, kind: 'oauth', at: now - SIGNIN_PROOF_MS }, now })).toBe(false);
  });
});

describe('deviceCanLock: whether the grown-up lock can close on this device (section 3.9 table)', () => {
  it('a device with learner profiles behind a gate, an older learner app or a failed read can lock', () => {
    for (const device of [PIN, PIN_ZERO, NOPIN, OLD_APP, FAILED]) expect(deviceCanLock(device)).toBe(true);
  });

  it('marker none, no learner data, or no IndexedDB API never locks', () => {
    for (const device of [NONE, NO_DATA, NO_IDB]) expect(deviceCanLock(device)).toBe(false);
  });
});

describe('planAfterSignIn: what a sign-in completed in this tab earns (section 3.9)', () => {
  const now = 1_000_000;
  const proof = (secret: boolean, sessionId = 'sess_1', at = now - 1_000) => ({ v: 1 as const, kind: 'proof' as const, sessionId, secret, at });

  it('a secret-proving sign-in writes the unlock on every device', () => {
    for (const device of [PIN, NOPIN, OLD_APP, FAILED, NONE, NO_DATA]) expect(planAfterSignIn({ record: proof(true), sessionId: 'sess_1', device, now })).toBe('unlock');
  });

  it('an OAuth sign-in on a device that can lock runs reverification first', () => {
    for (const device of [PIN, NOPIN, OLD_APP, FAILED]) expect(planAfterSignIn({ record: proof(false), sessionId: 'sess_1', device, now })).toBe('reverify');
  });

  it('an OAuth sign-in on a device without a lock asks for nothing more', () => {
    for (const device of [NONE, NO_DATA, NO_IDB]) expect(planAfterSignIn({ record: proof(false), sessionId: 'sess_1', device, now })).toBe('none');
  });

  it('no sign-in in this tab (a visitor already signed in), another session or a stale record earn nothing', () => {
    expect(planAfterSignIn({ record: null, sessionId: 'sess_1', device: PIN, now })).toBe('none');
    expect(planAfterSignIn({ record: proof(true, 'sess_other'), sessionId: 'sess_1', device: PIN, now })).toBe('none');
    expect(planAfterSignIn({ record: proof(true), sessionId: null, device: PIN, now })).toBe('none');
    expect(planAfterSignIn({ record: proof(true, 'sess_1', now - SIGNIN_PROOF_MS), sessionId: 'sess_1', device: PIN, now })).toBe('none');
    expect(planAfterSignIn({ record: proof(true, 'sess_1', now + 1), sessionId: 'sess_1', device: PIN, now })).toBe('none');
  });

  it('a secret-attempt record never turned into a proof counts as OAuth (fail closed)', () => {
    expect(planAfterSignIn({ record: { v: 1, kind: 'secret', at: now - 1 }, sessionId: 'sess_1', device: PIN, now })).toBe('reverify');
    expect(planAfterSignIn({ record: { v: 1, kind: 'secret', at: now - 1 }, sessionId: 'sess_1', device: NONE, now })).toBe('none');
  });

  it('an OAuth hand-off from this tab with no seen completion counts as OAuth: reverify where the lock can close', () => {
    expect(planAfterSignIn({ record: { v: 1, kind: 'oauth', at: now - 1 }, sessionId: 'sess_1', device: PIN, now })).toBe('reverify');
    expect(planAfterSignIn({ record: { v: 1, kind: 'oauth', at: now - 1 }, sessionId: 'sess_1', device: NONE, now })).toBe('none');
    expect(planAfterSignIn({ record: { v: 1, kind: 'oauth', at: now - SIGNIN_PROOF_MS }, sessionId: 'sess_1', device: PIN, now })).toBe('none');
    expect(planAfterSignIn({ record: { v: 1, kind: 'oauth', at: now - 1 }, sessionId: null, device: PIN, now })).toBe('none');
  });
});

describe('signedInHere: this page saw the tab go from signed out to signed in', () => {
  it('only a known signed-out state followed by a session', () => {
    expect(signedInHere(null, 'sess_1')).toBe(true);
    expect(signedInHere(undefined, 'sess_1')).toBe(false);
    expect(signedInHere('sess_0', 'sess_1')).toBe(false);
    expect(signedInHere(null, null)).toBe(false);
    expect(signedInHere(null, '')).toBe(false);
    expect(signedInHere(null, undefined)).toBe(false);
  });
});

describe('proofAtSignIn: what the sign-in this page saw complete proved', () => {
  const now = 50_000;
  it("uses Clerk's completed sign-in or sign-up when it names this session", () => {
    expect(proofAtSignIn({ sessionId: 's1', signIn: { status: 'complete', createdSessionId: 's1', firstFactorVerification: { strategy: 'oauth_google' } }, record: null, now })).toEqual({ sessionId: 's1', secret: false });
    expect(proofAtSignIn({ sessionId: 's1', signIn: { status: 'complete', createdSessionId: 's1', firstFactorVerification: { strategy: 'password' } }, record: { v: 1, kind: 'oauth', at: now }, now })).toEqual({ sessionId: 's1', secret: true });
    expect(proofAtSignIn({ sessionId: 's2', signUp: { status: 'complete', createdSessionId: 's2', verifications: { externalAccount: { status: 'verified' } } }, record: null, now })).toEqual({ sessionId: 's2', secret: false });
    expect(proofAtSignIn({ sessionId: 's3', signIn: { status: 'complete', createdSessionId: 's3', firstFactorVerification: { strategy: 'email_link' } }, record: { v: 1, kind: 'secret', at: now - 1 }, now })).toEqual({ sessionId: 's3', secret: false });
  });

  it('otherwise only a secret factor verified in this tab before the session appeared proves a secret', () => {
    expect(proofAtSignIn({ sessionId: 's1', signIn: { status: null }, record: { v: 1, kind: 'secret', at: now - 1 }, now })).toEqual({ sessionId: 's1', secret: true });
    expect(proofAtSignIn({ sessionId: 's1', signIn: { status: 'complete', createdSessionId: 'other', firstFactorVerification: { strategy: 'password' } }, record: { v: 1, kind: 'secret', at: now - 1 }, now })).toEqual({ sessionId: 's1', secret: true });
  });

  it('no evidence is never secret-proving: unknown errs to OAuth (sections 3.7, 3.17)', () => {
    // No record and no exact proof: a session from another tab, a missed hand-off record.
    expect(proofAtSignIn({ sessionId: 's1', record: null, now })).toEqual({ sessionId: 's1', secret: false });
    expect(proofAtSignIn({ sessionId: 's1', signIn: { status: null }, record: null, now })).toEqual({ sessionId: 's1', secret: false });
    expect(proofAtSignIn({ sessionId: 's1', signIn: { status: null }, record: { v: 1, kind: 'oauth', at: now - 1 }, now })).toEqual({ sessionId: 's1', secret: false });
    expect(proofAtSignIn({ sessionId: 's1', signIn: { status: 'complete', createdSessionId: 'other', firstFactorVerification: { strategy: 'password' } }, record: { v: 1, kind: 'oauth', at: now - 1 }, now })).toEqual({ sessionId: 's1', secret: false });
    expect(proofAtSignIn({ sessionId: 's1', record: { v: 1, kind: 'secret', at: now - SIGNIN_PROOF_MS }, now })).toEqual({ sessionId: 's1', secret: false });
    expect(proofAtSignIn({ sessionId: 's1', record: { v: 1, kind: 'proof', sessionId: 's0', secret: true, at: now - 1 }, now })).toEqual({ sessionId: 's1', secret: false });
  });
});

describe('secretVerifiedHere: positive evidence of a secret factor while still signed out', () => {
  it('a sign-in first factor verified with a password, a code or a passkey (a second factor may follow)', () => {
    expect(secretVerifiedHere({ status: 'complete', firstFactorVerification: { strategy: 'password', status: 'verified' } }, null)).toBe(true);
    expect(secretVerifiedHere({ status: 'needs_second_factor', firstFactorVerification: { strategy: 'email_code', status: 'verified' } }, null)).toBe(true);
    expect(secretVerifiedHere({ status: 'complete', firstFactorVerification: { strategy: 'passkey', status: 'verified' } }, undefined)).toBe(true);
  });

  it('a sign-up whose address was verified with a code', () => {
    expect(secretVerifiedHere(null, { status: 'missing_requirements', verifications: { emailAddress: { strategy: 'email_code', status: 'verified' } } })).toBe(true);
  });

  it('an attempt not yet verified, OAuth, an email link or nothing does not count', () => {
    expect(secretVerifiedHere({ status: 'needs_first_factor', firstFactorVerification: { strategy: 'email_code', status: 'unverified' } }, null)).toBe(false);
    expect(secretVerifiedHere({ status: 'complete', firstFactorVerification: { strategy: 'oauth_google', status: 'verified' } }, null)).toBe(false);
    expect(secretVerifiedHere({ status: 'complete', firstFactorVerification: { strategy: 'email_link', status: 'verified' } }, null)).toBe(false);
    expect(secretVerifiedHere(null, { status: 'missing_requirements', verifications: { emailAddress: { strategy: 'email_link', status: 'verified' } } })).toBe(false);
    expect(secretVerifiedHere(null, { status: 'missing_requirements', verifications: { externalAccount: { status: 'verified' }, emailAddress: { strategy: 'email_code', status: 'verified' } } })).toBe(false);
    expect(secretVerifiedHere(null, null)).toBe(false);
    expect(secretVerifiedHere(undefined, undefined)).toBe(false);
  });
});

describe('oauthSignUpStarted: a Google sign-up is leaving this window', () => {
  it('is true while the external account waits for its redirect', () => {
    expect(oauthSignUpStarted({ status: 'missing_requirements', verifications: { externalAccount: { status: 'unverified', externalVerificationRedirectURL: 'https://accounts.example' } } })).toBe(true);
  });

  it('is false for an email sign-up, a finished one, or none', () => {
    expect(oauthSignUpStarted({ status: 'missing_requirements', verifications: { externalAccount: null } })).toBe(false);
    expect(oauthSignUpStarted({ status: 'missing_requirements', verifications: { externalAccount: { status: 'unverified', externalVerificationRedirectURL: null } } })).toBe(false);
    expect(oauthSignUpStarted({ status: 'complete', verifications: { externalAccount: { status: 'verified', externalVerificationRedirectURL: 'https://x' } } })).toBe(false);
    expect(oauthSignUpStarted(null)).toBe(false);
  });
});

describe('grantSignInUnlock: the sign-in unlock and the trusted PIN epoch', () => {
  it('writes the sign-in unlock and trusts the epoch of a pin marker', async () => {
    const writeUnlock = vi.fn(() => true);
    const writeEpoch = vi.fn(async () => true);
    await grantSignInUnlock(PIN, 42, { writeUnlock, writeEpoch });
    expect(writeUnlock).toHaveBeenCalledWith(42);
    expect(writeEpoch).toHaveBeenCalledWith(1_700);
  });

  it('forgets an earlier epoch on a device whose marker has none to trust (epoch 0, nopin, none)', async () => {
    for (const device of [PIN_ZERO, NOPIN, NONE, OLD_APP]) {
      const writeEpoch = vi.fn(async () => true);
      await grantSignInUnlock(device, 1, { writeUnlock: () => true, writeEpoch });
      expect(writeEpoch).toHaveBeenCalledWith(null);
    }
  });

  it('leaves the trusted epoch alone when the device could not be read', async () => {
    for (const device of [FAILED, NO_IDB]) {
      const writeUnlock = vi.fn(() => true);
      const writeEpoch = vi.fn(async () => true);
      await grantSignInUnlock(device, 1, { writeUnlock, writeEpoch });
      expect(writeUnlock).toHaveBeenCalledWith(1);
      expect(writeEpoch).not.toHaveBeenCalled();
    }
  });

  it('uses the browser stores by default (none in node: nothing throws)', async () => {
    await expect(grantSignInUnlock(PIN, 1)).resolves.toBeUndefined();
  });
});

describe('personasOfSpaces: personas from GET /api/spaces (section 3.5)', () => {
  it('maps memberships to personas, Family first', () => {
    expect(
      personasOfSpaces([
        { space: { kind: 'class' }, role: 'teacher' },
        { space: { kind: 'family' }, role: 'caregiver' },
      ]),
    ).toEqual(['parent', 'teacher']);
    expect(personasOfSpaces([{ space: { kind: 'school' }, role: 'admin' }])).toEqual(['teacher']);
    expect(personasOfSpaces([])).toEqual([]);
  });

  it('ignores a kind this bundle does not know', () => {
    expect(personasOfSpaces([{ space: { kind: 'guild' as never }, role: 'owner' }])).toEqual([]);
  });
});

describe('acceptedNext: a deep link the router may follow (section 3.11)', () => {
  it('takes a grown-up path with its query', () => {
    expect(acceptedNext('/teach/space?id=sp_1')).toBe('/teach/space?id=sp_1');
    expect(acceptedNext('/account/billing?checkout=success')).toBe('/account/billing?checkout=success');
  });

  it.each(['https://evil.example', '//evil.example', '/', '/browse', '', null, '/signin', '/signin?next=/teach', '/signin/', '/signin.html'])('refuses %s (other origins, learner paths and the sign-in page itself)', (raw) => {
    expect(acceptedNext(raw)).toBeNull();
  });
});

describe('routerDestination: one location.replace after sign-in (sections 3.5, 3.7)', () => {
  it('follows an accepted next first', () => {
    expect(routerDestination({ next: '/teach/space?id=sp_1', personas: ['teacher'], last: null, hint: null })).toBe('/teach/space?id=sp_1');
  });

  it('a refused next falls back to the persona home (behaviour 14)', () => {
    for (const next of ['https://evil.example', '//evil.example', '/']) expect(routerDestination({ next, personas: ['teacher'], last: null, hint: null })).toBe('/teach/home');
  });

  it('an account with no space goes to /start, the hint kept (behaviour 5)', () => {
    expect(routerDestination({ next: null, personas: [], last: null, hint: 'parent' })).toBe('/start?persona=parent');
    expect(routerDestination({ next: null, personas: [], last: null, hint: null })).toBe('/start');
  });

  it('a teacher lands on /teach/home (behaviour 3)', () => {
    expect(routerDestination({ next: null, personas: ['teacher'], last: null, hint: null })).toBe('/teach/home');
  });

  // The /parent page is the demo on mock data until A-5b replaces it with the real family home, so the
  // Family persona's home is the existing console home (which lists Family spaces) until then.
  it('the Family home is /teach/home until A-5b ships the real /parent', () => {
    expect(routerDestination({ next: null, personas: ['parent', 'teacher'], last: null, hint: null })).toBe('/teach/home');
    expect(routerDestination({ next: null, personas: ['teacher'], last: null, hint: 'parent' })).toBe('/teach/home');
    expect(routerDestination({ next: null, personas: ['parent'], last: 'parent', hint: null })).toBe('/teach/home');
  });

  // A-5b removes this: until then a next into the /parent demo (mock data) never takes a real account there.
  it('a next into the /parent demo falls back to the home until A-5b', () => {
    expect(routerDestination({ next: '/parent', personas: ['parent'], last: null, hint: null })).toBe('/teach/home');
    expect(routerDestination({ next: '/parent/child-1', personas: ['parent'], last: null, hint: null })).toBe('/teach/home');
    expect(routerDestination({ next: '/parent?tab=week', personas: ['teacher'], last: null, hint: null })).toBe('/teach/home');
  });
});

describe('signedOutTarget: a signed-out visitor on a grown-up page (sections 3.7, 3.11)', () => {
  it('sends any grown-up page to /signin with the page and its query as next', () => {
    expect(signedOutTarget('/teach/space', '?id=sp_1')).toBe(`/signin?next=${encodeURIComponent('/teach/space?id=sp_1')}`);
    expect(signedOutTarget('/start', '')).toBe(`/signin?next=${encodeURIComponent('/start')}`);
    expect(signedOutTarget('/teach/home', 'x=1')).toBe(`/signin?next=${encodeURIComponent('/teach/home?x=1')}`);
  });

  it('the /teach router carries its hint, and a next only when the URL has a query', () => {
    expect(signedOutTarget('/teach', '')).toBe('/signin');
    expect(signedOutTarget('/teach/', '')).toBe('/signin');
    expect(signedOutTarget('/teach', '?persona=teacher')).toBe(`/signin?persona=teacher&next=${encodeURIComponent('/teach?persona=teacher')}`);
    expect(signedOutTarget('/teach', '?as=parent')).toBe(`/signin?persona=parent&next=${encodeURIComponent('/teach?as=parent')}`);
    expect(signedOutTarget('/teach', '?x=1')).toBe(`/signin?next=${encodeURIComponent('/teach?x=1')}`);
  });

  it('carries ?lang= so /signin opens in the language the link asked for', () => {
    expect(signedOutTarget('/teach', '?lang=es')).toBe(`/signin?lang=es&next=${encodeURIComponent('/teach?lang=es')}`);
    expect(signedOutTarget('/teach/home', '?lang=ko')).toBe(`/signin?lang=ko&next=${encodeURIComponent('/teach/home?lang=ko')}`);
  });

  it('a page safeNextPath refuses (not a grown-up path) goes to /signin alone', () => {
    expect(signedOutTarget('/somewhere', '?a=1')).toBe('/signin');
  });
});

describe('signInReturnUrl and createModeUrl: the /signin links keep the hint, next and lang', () => {
  it('Clerk returns to the router with persona, as, next and lang, never mode', () => {
    expect(signInReturnUrl(params('persona=parent&mode=create&next=%2Fteach%2Fhome&lang=es&utm=x'))).toBe(`/signin?persona=parent&next=${encodeURIComponent('/teach/home')}&lang=es`);
    expect(signInReturnUrl(params('as=teacher'))).toBe('/signin?as=teacher');
    expect(signInReturnUrl(params(''))).toBe('/signin');
  });

  it('opens and leaves mode=create with the same keys', () => {
    expect(createModeUrl(params('persona=teacher&next=%2Fstart'), true)).toBe(`/signin?mode=create&persona=teacher&next=${encodeURIComponent('/start')}`);
    expect(createModeUrl(params('mode=create&persona=teacher'), false)).toBe('/signin?persona=teacher');
    expect(createModeUrl(params('mode=create'), false)).toBe('/signin');
  });
});

describe('isStandaloneDisplay: an installed PWA (OD-15)', () => {
  it('reads display-mode standalone, or iOS navigator.standalone', () => {
    expect(isStandaloneDisplay({ matchMedia: (q: string) => ({ matches: q === '(display-mode: standalone)' }) })).toBe(true);
    expect(isStandaloneDisplay({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })).toBe(true);
    expect(isStandaloneDisplay({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false);
  });

  it('is false without a window or when matchMedia throws', () => {
    expect(isStandaloneDisplay(null)).toBe(false);
    expect(isStandaloneDisplay(undefined)).toBe(false);
    expect(
      isStandaloneDisplay({
        matchMedia: () => {
          throw new Error('nope');
        },
      }),
    ).toBe(false);
  });
});

describe('clerkUnreachable: the widget cannot load (section 3.19)', () => {
  it('an error status is unreachable at once', () => {
    expect(clerkUnreachable({ status: 'error', loaded: false, waitedMs: 0 })).toBe(true);
  });

  it('still loading after the wait is unreachable; before it, not yet', () => {
    expect(clerkUnreachable({ status: 'loading', loaded: false, waitedMs: CLERK_LOAD_TIMEOUT_MS })).toBe(true);
    expect(clerkUnreachable({ status: 'loading', loaded: false, waitedMs: CLERK_LOAD_TIMEOUT_MS - 1 })).toBe(false);
  });

  it('loaded (ready or degraded) is reachable', () => {
    expect(clerkUnreachable({ status: 'ready', loaded: true, waitedMs: CLERK_LOAD_TIMEOUT_MS * 2 })).toBe(false);
    expect(clerkUnreachable({ status: 'degraded', loaded: true, waitedMs: CLERK_LOAD_TIMEOUT_MS * 2 })).toBe(false);
  });
});

describe('reverifyOnce: the fetcher behind Clerk useReverification', () => {
  it('asks for a first-factor reverification once, then reports success', async () => {
    const fetcher = reverifyOnce();
    expect(await fetcher()).toEqual({ clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: REVERIFY_CONFIG } } });
    expect(REVERIFY_CONFIG).toEqual({ level: 'first_factor', afterMinutes: 10 });
    expect(await fetcher()).toEqual({ verified: true });
    expect(await fetcher()).toEqual({ verified: true });
  });
});

describe('withTimeout', () => {
  it('gives the value, or the fallback when the read throws, rejects or hangs', async () => {
    expect(await withTimeout(async () => 1, 0, 50)).toBe(1);
    expect(
      await withTimeout(
        () => {
          throw new Error('x');
        },
        0,
        50,
      ),
    ).toBe(0);
    expect(await withTimeout(() => Promise.reject(new Error('x')), 0, 50)).toBe(0);
    expect(await withTimeout(() => new Promise<number>(() => undefined), 7, 10)).toBe(7);
  });
});

describe('settleSignIn and finishReverify: the router spends the sign-in record of this tab', () => {
  const now = 2_000_000;
  function io(record: Parameters<typeof planAfterSignIn>[0]['record'], device: DeviceGateRead | (() => Promise<DeviceGateRead>)) {
    const calls = { cleared: 0, granted: [] as Array<[DeviceGateRead, number]> };
    const value: SignInIo = {
      now: () => now,
      readRecord: () => record,
      clearRecord: () => {
        calls.cleared += 1;
      },
      readDevice: typeof device === 'function' ? device : async () => device,
      grant: async (d, at) => {
        calls.granted.push([d, at]);
      },
    };
    return { io: value, calls };
  }
  const proof = (secret: boolean) => ({ v: 1 as const, kind: 'proof' as const, sessionId: 'sess_1', secret, at: now - 10 });

  it('no record: nothing read, nothing written', async () => {
    const readDevice = vi.fn(async () => PIN);
    const { io: value, calls } = io(null, readDevice);
    expect(await settleSignIn(value, 'sess_1')).toBeNull();
    expect(readDevice).not.toHaveBeenCalled();
    expect(calls).toEqual({ cleared: 0, granted: [] });
  });

  it('a secret proof grants the unlock, then spends the record', async () => {
    const { io: value, calls } = io(proof(true), PIN);
    expect(await settleSignIn(value, 'sess_1')).toBeNull();
    expect(calls.granted).toEqual([[PIN, now]]);
    expect(calls.cleared).toBe(1);
  });

  it('an OAuth proof on a device that can lock asks for reverification and keeps the record', async () => {
    const { io: value, calls } = io(proof(false), NOPIN);
    expect(await settleSignIn(value, 'sess_1')).toEqual({ reverify: NOPIN });
    expect(calls).toEqual({ cleared: 0, granted: [] });
  });

  it('a device read that hangs counts as failed (the lock can close): reverification', async () => {
    vi.useFakeTimers();
    const { io: value } = io(proof(false), () => new Promise<DeviceGateRead>(() => undefined));
    const pending = settleSignIn(value, 'sess_1');
    await vi.advanceTimersByTimeAsync(DEVICE_READ_TIMEOUT_MS);
    expect(await pending).toEqual({ reverify: { readable: false, reason: 'failed' } });
    vi.useRealTimers();
  });

  it('an OAuth proof on a device without a lock, or a record of another session, spends the record and asks nothing', async () => {
    for (const [record, device, session] of [
      [proof(false), NONE, 'sess_1'],
      [proof(true), PIN, 'sess_other'],
    ] as const) {
      const { io: value, calls } = io(record, device);
      expect(await settleSignIn(value, session)).toBeNull();
      expect(calls).toEqual({ cleared: 1, granted: [] });
    }
  });

  it('a finished reverification grants the unlock; a cancelled one only spends the record', async () => {
    const ok = io(proof(false), PIN);
    await finishReverify(ok.io, PIN, true);
    expect(ok.calls).toEqual({ cleared: 1, granted: [[PIN, now]] });
    const cancelled = io(proof(false), PIN);
    await finishReverify(cancelled.io, PIN, false);
    expect(cancelled.calls).toEqual({ cleared: 1, granted: [] });
  });
});

describe('resolveDestination: spaces, then the last persona, then routerDestination', () => {
  const spaces = (data: SpacesResult) => async () => data;
  it('lands a teacher on /teach/home and honours an accepted next', async () => {
    const io = { listSpaces: spaces({ ok: true, data: [{ space: { kind: 'class' }, role: 'owner' }] }), readLastPersona: async () => null };
    expect(await resolveDestination(io, { next: null, hint: null })).toBe('/teach/home');
    expect(await resolveDestination(io, { next: '/teach/space?id=sp_1', hint: null })).toBe('/teach/space?id=sp_1');
  });

  it('sends an account with no space to /start with the hint', async () => {
    const io = { listSpaces: spaces({ ok: true, data: [] }), readLastPersona: async () => 'teacher' as const };
    expect(await resolveDestination(io, { next: null, hint: 'parent' })).toBe('/start?persona=parent');
  });

  it('a failed or throwing spaces fetch gives no destination (no wrong home)', async () => {
    expect(await resolveDestination({ listSpaces: spaces({ ok: false }), readLastPersona: async () => null }, { next: null, hint: null })).toBeNull();
    expect(
      await resolveDestination(
        {
          listSpaces: async () => {
            throw new Error('offline');
          },
          readLastPersona: async () => null,
        },
        { next: null, hint: null },
      ),
    ).toBeNull();
  });

  it('a last-persona read that fails counts as none', async () => {
    const io = {
      listSpaces: spaces({ ok: true, data: [{ space: { kind: 'family' }, role: 'owner' }, { space: { kind: 'class' }, role: 'owner' }] }),
      readLastPersona: () => Promise.reject(new Error('blocked')),
    };
    // Both personas, no last: Family first (OD-11), which is /teach/home until A-5b.
    expect(await resolveDestination(io, { next: null, hint: 'teacher' })).toBe('/teach/home');
  });
});
