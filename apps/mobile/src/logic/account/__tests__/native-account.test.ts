import { describe, expect, it } from 'vitest';
import { NATIVE_SIGNIN_LAUNCH_DEFAULT, nativeAccountEnabled, nativeSignInSwitch, publishableKeyFor } from '../native-account';

/**
 * F-AUTH-004 section 6.1 (row NS-2; CS-N13): whether a native build offers the grown-up account, and which publishable
 * key it may hand to Clerk.
 */

/** A well-formed key: the prefix, then base64 of the Frontend API host and `$`. */
const keyFor = (mode: 'live' | 'test', host = 'clerk.hangulroute.com'): string => `pk_${mode}_${btoa(`${host}$`)}`;
const LIVE = keyFor('live');
const TEST = keyFor('test', 'neat-gull-12.clerk.accounts.dev');

describe('nativeSignInSwitch: parseKillSwitch words, off by default until NS-8', () => {
  it('unset or an unknown word is the launch default, which is off', () => {
    expect(NATIVE_SIGNIN_LAUNCH_DEFAULT).toBe(false);
    expect(nativeSignInSwitch(undefined)).toBe(false);
    expect(nativeSignInSwitch('maybe')).toBe(false);
    expect(nativeSignInSwitch('')).toBe(false);
    expect(nativeSignInSwitch('enabled')).toBe(false);
  });

  it('on words, trimmed and in any case', () => {
    for (const on of ['true', '1', 'on', 'yes', ' ON ', 'True', 'YES']) expect(nativeSignInSwitch(on), on).toBe(true);
  });

  it('off words win over an on default', () => {
    for (const off of ['false', '0', 'off', 'no', ' OFF ', 'No']) expect(nativeSignInSwitch(off, true), off).toBe(false);
    expect(nativeSignInSwitch('typo', true)).toBe(true);
    expect(nativeSignInSwitch(undefined, true)).toBe(true);
  });
});

describe('publishableKeyFor: pk_live_ in a release build, pk_test_ too in a development build', () => {
  it('a release build takes only a live key', () => {
    expect(publishableKeyFor(LIVE, true)).toBe(LIVE);
    expect(publishableKeyFor(TEST, true)).toBeNull();
  });

  it('a development build takes a live or a test key', () => {
    expect(publishableKeyFor(LIVE, false)).toBe(LIVE);
    expect(publishableKeyFor(TEST, false)).toBe(TEST);
  });

  it('a secret key is ignored, whatever the build', () => {
    const secret = `sk_live_${btoa('clerk.hangulroute.com$')}`;
    expect(publishableKeyFor(secret, true)).toBeNull();
    expect(publishableKeyFor(secret, false)).toBeNull();
    expect(publishableKeyFor(`sk_test_${btoa('x.clerk.accounts.dev$')}`, false)).toBeNull();
  });

  it('unset, blank, padded or malformed values are ignored', () => {
    for (const raw of [undefined, '', ' ', ` ${LIVE}`, `${LIVE} `, 'pk_live_', 'pk_live_!!!', 'pk_prod_abc', 'PK_LIVE_' + btoa('a.com$'), `${LIVE}\n`]) {
      expect(publishableKeyFor(raw, false), JSON.stringify(raw)).toBeNull();
    }
  });

  it('a key that does not decode to a Frontend API host followed by $ is ignored', () => {
    expect(publishableKeyFor(`pk_live_${btoa('clerk.hangulroute.com')}`, true)).toBeNull();
    expect(publishableKeyFor(`pk_live_${btoa('not a host$')}`, true)).toBeNull();
    expect(publishableKeyFor('pk_live_abc', true)).toBeNull();
    // Base64 of a length no encoder writes: the decoder refuses it.
    expect(publishableKeyFor('pk_live_a', true)).toBeNull();
  });
});

describe('nativeAccountEnabled({ os, flag, key, release }) (CS-N13)', () => {
  const on = { os: 'ios', flag: true, key: LIVE, release: true } as const;

  it('on iOS and Android with the switch on and a key the build accepts', () => {
    expect(nativeAccountEnabled(on)).toBe(true);
    expect(nativeAccountEnabled({ ...on, os: 'android' })).toBe(true);
  });

  it('never on the web, in tests or scripts (no platform)', () => {
    expect(nativeAccountEnabled({ ...on, os: 'web' })).toBe(false);
    expect(nativeAccountEnabled({ ...on, os: undefined })).toBe(false);
    expect(nativeAccountEnabled({ ...on, os: 'windows' })).toBe(false);
  });

  it('off with the switch off, whatever the key', () => {
    expect(nativeAccountEnabled({ ...on, flag: false })).toBe(false);
  });

  it('off without a key the build accepts: none, a secret key, a test key in a release build', () => {
    expect(nativeAccountEnabled({ ...on, key: undefined })).toBe(false);
    expect(nativeAccountEnabled({ ...on, key: `sk_live_${btoa('clerk.hangulroute.com$')}` })).toBe(false);
    expect(nativeAccountEnabled({ ...on, key: TEST })).toBe(false);
    expect(nativeAccountEnabled({ ...on, key: TEST, release: false })).toBe(true);
  });
});
