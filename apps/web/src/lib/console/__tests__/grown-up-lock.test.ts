import { GROWN_UP_IDLE_MS, type DeviceGateMarker, type GrownUpUnlock } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  decideGrownUpLock,
  learnerHome,
  pinPathUrl,
  signInAgainUrl,
  signInHome,
  trustableEpoch,
  type DeviceGateRead,
  type LockDecision,
  type LockLine,
} from '../grown-up-lock';

/**
 * The decision table of F-APP-001 section 3.9, row by row. `decideGrownUpLock` is pure:
 * the component reads the marker, the `hr:profiles` presence, the trusted epoch and the
 * unlock, then asks this function what to render.
 */
const NOW = 1_800_000_000_000;
const EPOCH = 1_790_000_000_000;

const OPEN: LockDecision = { state: 'open' };
const locked = (pinPath: boolean, line: LockLine): LockDecision => ({ state: 'locked', pinPath, line });

const pin = (pinEpoch = EPOCH): DeviceGateMarker => ({ v: 1, gate: 'pin', pinEpoch });
const nopin: DeviceGateMarker = { v: 1, gate: 'nopin' };
const none: DeviceGateMarker = { v: 1, gate: 'none' };

const device = (marker: DeviceGateMarker | null, hasProfiles = false): DeviceGateRead => ({ readable: true, marker, hasProfiles });
/** No IndexedDB API at all: such a browser cannot keep learner profiles either. */
const unavailable: DeviceGateRead = { readable: false, reason: 'unavailable' };
/** The API exists but the read failed (connection lost, backing store error) or timed out. */
const failed: DeviceGateRead = { readable: false, reason: 'failed' };

const signinUnlock = (seenAgo = 0): GrownUpUnlock => ({ v: 1, at: NOW - seenAgo - 1000, seen: NOW - seenAgo, src: 'signin' });
const pinUnlock = (pinEpoch = EPOCH, seenAgo = 0): GrownUpUnlock => ({ v: 1, at: NOW - seenAgo - 1000, seen: NOW - seenAgo, src: 'pin', pinEpoch });
const expired = GROWN_UP_IDLE_MS;

function decide(d: DeviceGateRead, unlock: GrownUpUnlock | null, trustedEpoch: number | null, exempt = false): LockDecision {
  return decideGrownUpLock({ device: d, unlock, trustedEpoch, now: NOW, exempt });
}

describe('decideGrownUpLock: exempt and open rows', () => {
  it('any marker on /signin is open (exempt)', () => {
    for (const d of [device(pin()), device(nopin), device(null, true), unavailable, failed]) expect(decide(d, null, null, true)).toEqual(OPEN);
  });

  it('absent marker and no hr:profiles list is open (a teacher laptop)', () => {
    expect(decide(device(null, false), null, null)).toEqual(OPEN);
  });

  it('marker none is open, with or without an unlock (self-only device, or no learner profile)', () => {
    expect(decide(device(none), null, null)).toEqual(OPEN);
    expect(decide(device(none, true), signinUnlock(expired), EPOCH)).toEqual(OPEN);
  });

  it('no IndexedDB API is open: a browser without IndexedDB cannot keep learner profiles either', () => {
    expect(decide(unavailable, null, null)).toEqual(OPEN);
  });
});

describe('decideGrownUpLock: a device read that failed (A-4a review, 2026-10-12)', () => {
  // The API exists, so this browser may hold learner profiles: a lost connection or a backing
  // store error must not open the page. It locks like a learner app older than A-6.
  it('opens only with an active sign-in unlock', () => {
    expect(decide(failed, signinUnlock(), null)).toEqual(OPEN);
  });

  it('is sign-in only with the plain sign-in line otherwise, a PIN unlock included (no epoch to check)', () => {
    expect(decide(failed, null, null)).toEqual(locked(false, 'signInOnly'));
    expect(decide(failed, null, EPOCH)).toEqual(locked(false, 'signInOnly'));
    expect(decide(failed, pinUnlock(), EPOCH)).toEqual(locked(false, 'signInOnly'));
    expect(decide(failed, signinUnlock(expired), EPOCH)).toEqual(locked(false, 'signInOnly'));
  });
});

describe('decideGrownUpLock: absent marker with learner profiles (a learner app older than A-6)', () => {
  it('opens with an active sign-in unlock', () => {
    expect(decide(device(null, true), signinUnlock(), null)).toEqual(OPEN);
  });

  it('is locked to sign-in only otherwise, a PIN unlock included (no epoch to check), with the plain sign-in line', () => {
    // A sign-in cannot turn a PIN path on here (only A-6 writes a pin marker), so the line promises none.
    expect(decide(device(null, true), null, null)).toEqual(locked(false, 'signInOnly'));
    expect(decide(device(null, true), signinUnlock(expired), null)).toEqual(locked(false, 'signInOnly'));
    expect(decide(device(null, true), pinUnlock(), EPOCH)).toEqual(locked(false, 'signInOnly'));
  });
});

describe('decideGrownUpLock: marker pin', () => {
  it('opens with an active sign-in unlock, whatever the epochs', () => {
    expect(decide(device(pin()), signinUnlock(), null)).toEqual(OPEN);
    expect(decide(device(pin()), signinUnlock(), EPOCH + 1)).toEqual(OPEN);
  });

  it('opens with an active PIN unlock when unlock, marker and trusted epoch are the same', () => {
    expect(decide(device(pin()), pinUnlock(), EPOCH)).toEqual(OPEN);
  });

  it('a PIN unlock whose epoch differs is sign-in only with the PIN-changed line', () => {
    // a child reset the PIN after the grown-up signed in: the marker moved on
    expect(decide(device(pin(EPOCH + 5)), pinUnlock(EPOCH + 5), EPOCH)).toEqual(locked(false, 'pinChanged'));
    // the unlock carries an older epoch than the marker
    expect(decide(device(pin()), pinUnlock(EPOCH - 5), EPOCH)).toEqual(locked(false, 'pinChanged'));
  });

  it('a PIN unlock with no trusted epoch is sign-in only with the "sign in once" line: nothing changed, nobody signed in here yet', () => {
    // a parent already signed in to Clerk (carried over from the site) enters the PIN first
    expect(decide(device(pin()), pinUnlock(), null)).toEqual(locked(false, 'firstSignIn'));
  });

  it('no unlock with a trusted epoch: the PIN path and sign-in, with the default line', () => {
    expect(decide(device(pin()), null, EPOCH)).toEqual(locked(true, 'default'));
  });

  it('an expired unlock (PIN or sign-in) falls to the no-unlock row', () => {
    expect(decide(device(pin()), pinUnlock(EPOCH, expired), EPOCH)).toEqual(locked(true, 'default'));
    expect(decide(device(pin()), signinUnlock(expired), EPOCH)).toEqual(locked(true, 'default'));
    expect(decide(device(pin()), signinUnlock(expired + 1), null)).toEqual(locked(false, 'firstSignIn'));
  });

  it('the unlock is active up to 14:59 idle and not at 15:00 or with a clock that ran backwards', () => {
    expect(decide(device(pin()), signinUnlock(expired - 1), null)).toEqual(OPEN);
    expect(decide(device(pin()), signinUnlock(expired), null)).toEqual(locked(false, 'firstSignIn'));
    expect(decide(device(pin()), signinUnlock(-1), null)).toEqual(locked(false, 'firstSignIn'));
  });

  it('no unlock and no trusted epoch: sign-in only, "sign in once" line', () => {
    expect(decide(device(pin()), null, null)).toEqual(locked(false, 'firstSignIn'));
  });

  it('no unlock and a trusted epoch that differs from the marker: sign-in only, PIN-changed line', () => {
    expect(decide(device(pin(EPOCH + 1)), null, EPOCH)).toEqual(locked(false, 'pinChanged'));
  });

  it('marker epoch 0 (a PIN set before A-6) is never trusted, even if a 0 was somehow stored; the line says to set the PIN again', () => {
    // A sign-in never stores epoch 0, so "sign in once" would promise a PIN path that cannot come.
    expect(decide(device(pin(0)), null, 0)).toEqual(locked(false, 'pinRenew'));
    expect(decide(device(pin(0)), pinUnlock(0), 0)).toEqual(locked(false, 'pinRenew'));
    expect(decide(device(pin(0)), null, null)).toEqual(locked(false, 'pinRenew'));
    expect(decide(device(pin(0)), null, EPOCH)).toEqual(locked(false, 'pinRenew'));
    expect(decide(device(pin(0)), pinUnlock(EPOCH), EPOCH)).toEqual(locked(false, 'pinRenew'));
    // a sign-in still opens it
    expect(decide(device(pin(0)), signinUnlock(), null)).toEqual(OPEN);
  });

  it('a trusted epoch that is not a finite positive number counts as none', () => {
    expect(decide(device(pin()), null, Number.NaN)).toEqual(locked(false, 'firstSignIn'));
    expect(decide(device(pin()), null, -EPOCH)).toEqual(locked(false, 'firstSignIn'));
    expect(decide(device(pin()), null, Number.POSITIVE_INFINITY)).toEqual(locked(false, 'firstSignIn'));
  });
});

describe('decideGrownUpLock: marker nopin (a family device without a PIN)', () => {
  it('opens with an active sign-in unlock', () => {
    expect(decide(device(nopin, true), signinUnlock(), null)).toEqual(OPEN);
  });

  it('is sign-in only with the no-PIN line otherwise, a PIN unlock included', () => {
    expect(decide(device(nopin, true), null, EPOCH)).toEqual(locked(false, 'noPin'));
    expect(decide(device(nopin, true), pinUnlock(), EPOCH)).toEqual(locked(false, 'noPin'));
    expect(decide(device(nopin, true), signinUnlock(expired), EPOCH)).toEqual(locked(false, 'noPin'));
  });
});

describe('trustableEpoch: what a secret-proving sign-in may store as the trusted epoch', () => {
  it('is the marker epoch of a pin marker', () => {
    expect(trustableEpoch(pin())).toBe(EPOCH);
  });

  it('is never epoch 0, and nothing for nopin, none or an absent marker', () => {
    expect(trustableEpoch(pin(0))).toBeNull();
    expect(trustableEpoch(nopin)).toBeNull();
    expect(trustableEpoch(none)).toBeNull();
    expect(trustableEpoch(null)).toBeNull();
  });
});

describe('lock screen targets', () => {
  it('Use the grown-up PIN opens the learner app gate with this page as next, encoded once', () => {
    expect(pinPathUrl('/parent')).toBe('/?gate=grown-up&next=%2Fparent');
    expect(pinPathUrl('/teach/space?id=sp_1&tab=plan')).toBe('/?gate=grown-up&next=%2Fteach%2Fspace%3Fid%3Dsp_1%26tab%3Dplan');
    const next = new URL(pinPathUrl('/teach/space?id=sp%3A1'), 'https://app.hangulroute.com').searchParams.get('next');
    expect(next).toBe('/teach/space?id=sp%3A1');
  });

  it('Sign in again goes to /signin with this page as next and the console language', () => {
    expect(signInAgainUrl('/parent/space?id=sp_1', 'en')).toBe('/signin?next=%2Fparent%2Fspace%3Fid%3Dsp_1&lang=en');
  });

  it('a path that safeNextPath refuses falls back to the router (/signin) or no next, the language kept', () => {
    expect(pinPathUrl('//evil.example')).toBe('/?gate=grown-up&next=%2Fsignin');
    expect(signInAgainUrl('https://evil.example', 'en')).toBe('/signin?lang=en');
    expect(signInAgainUrl('/', 'ko')).toBe('/signin?lang=ko');
  });

  // AMENDMENTS-DISPLAY-NAV section 6: Sign out to /signin and Sign in again carry ?lang=, English included.
  it.each(['en', 'es', 'ko'] as const)('Sign out and Sign in again carry lang=%s', (locale) => {
    expect(signInHome(locale)).toBe(`/signin?lang=${locale}`);
    const url = new URL(signInAgainUrl('/teach/space?id=sp_1', locale), 'https://app.hangulroute.com');
    expect(url.pathname).toBe('/signin');
    expect(url.searchParams.get('lang')).toBe(locale);
    expect(url.searchParams.get('next')).toBe('/teach/space?id=sp_1');
  });

  it('the fragment is dropped', () => {
    expect(signInAgainUrl('/account/billing?checkout=success#top', 'es')).toBe('/signin?next=%2Faccount%2Fbilling%3Fcheckout%3Dsuccess&lang=es');
  });

  it('learnerHome is the app host only while the console is still served on the site (hangulroute.com, www)', () => {
    expect(learnerHome('https://hangulroute.com', 'en')).toBe('https://app.hangulroute.com/?lang=en');
    expect(learnerHome('https://www.hangulroute.com', 'ko')).toBe('https://app.hangulroute.com/?lang=ko');
  });

  it('learnerHome is / on the app host and on every other origin, so previews and local builds never leave for production', () => {
    expect(learnerHome('https://app.hangulroute.com', 'en')).toBe('/?lang=en');
    expect(learnerHome('https://hangul-route-app-preview.example.workers.dev', 'en')).toBe('/?lang=en');
    expect(learnerHome('http://localhost:4173', 'es')).toBe('/?lang=es');
    expect(learnerHome('http://127.0.0.1:3000', 'en')).toBe('/?lang=en');
    expect(learnerHome('', 'en')).toBe('/?lang=en');
  });

  it('[OA] learnerHome with who adds the chooser intent after the language (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.3)', () => {
    expect(learnerHome('https://app.hangulroute.com', 'ko', { who: true })).toBe('/?lang=ko&who=1');
    expect(learnerHome('https://hangulroute.com', 'en', { who: true })).toBe('https://app.hangulroute.com/?lang=en&who=1');
    expect(learnerHome('https://app.hangulroute.com', 'en', { who: false })).toBe('/?lang=en');
  });

  it('learnerHome always carries the console language, English included (AMENDMENTS-DISPLAY-NAV section 6)', () => {
    for (const locale of ['en', 'es', 'ko'] as const) expect(learnerHome('https://app.hangulroute.com', locale)).toBe(`/?lang=${locale}`);
  });
});
