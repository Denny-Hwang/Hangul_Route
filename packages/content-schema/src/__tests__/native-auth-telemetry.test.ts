import { describe, expect, it } from 'vitest';
import { AccountTrustSchema, NATIVE_CLIENT_HEADER, NATIVE_CLIENT_VALUE, OA_TELEMETRY_PAYLOADS, TELEMETRY_EVENT_NAMES, isTelemetryEventName } from '../index';
import {
  NATIVE_AUTH_OS,
  NATIVE_AUTH_TELEMETRY_NAMES,
  NATIVE_AUTH_TELEMETRY_PAYLOADS,
  NATIVE_HOME_SPACES,
  NATIVE_HOME_USES,
  NATIVE_LOCK_CAUSES,
  NATIVE_SIGNIN_METHODS,
  NATIVE_SIGNIN_RESULTS,
  NATIVE_SIGNOUT_VIAS,
} from '../schemas/native-auth-telemetry';

/** F-AUTH-004 section 15 (row NS-1, TELEMETRY-NAMES-2 section V): four strict, code-only payloads. */
const NAMES = ['auth.native.signin', 'auth.native.signout', 'auth.native.lock', 'auth.native.home'] as const;

const VALID: Record<(typeof NAMES)[number], Record<string, unknown>> = {
  'auth.native.signin': { os: 'ios', method: 'email_code', result: 'ok', second: false },
  'auth.native.signout': { os: 'android', via: 'user' },
  'auth.native.lock': { os: 'ios', cause: 'pin_changed' },
  'auth.native.home': { os: 'android', use: 'family', spaces: '2-4' },
};

describe('auth.native.* names (section 15)', () => {
  it('appends the four names, once each, at the end of the shared list (after app.crash)', () => {
    expect(NATIVE_AUTH_TELEMETRY_NAMES).toEqual([...NAMES]);
    expect(TELEMETRY_EVENT_NAMES.slice(-5)).toEqual(['app.crash', ...NAMES]);
    for (const name of NAMES) {
      expect(isTelemetryEventName(name), name).toBe(true);
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name), name).toHaveLength(1);
    }
    expect(isTelemetryEventName('auth.native.signup')).toBe(false);
  });

  it('documents the codes of each payload', () => {
    expect(NATIVE_AUTH_OS).toEqual(['ios', 'android']);
    expect(NATIVE_SIGNIN_METHODS).toEqual(['none', 'email_code', 'password']);
    expect(NATIVE_SIGNIN_RESULTS).toEqual(['ok', 'wrong_code', 'wrong_password', 'expired', 'refused', 'too_many', 'unsupported', 'offline', 'error', 'cancelled']);
    expect(NATIVE_SIGNOUT_VIAS).toEqual(['user', 'lock']);
    expect(NATIVE_LOCK_CAUSES).toEqual(['unknown', 'needs_pin', 'epoch_zero', 'no_trust', 'pin_changed', 'retrust_password']);
    expect(NATIVE_HOME_USES).toEqual(['family', 'teacher', 'school', 'account']);
    expect(NATIVE_HOME_SPACES).toEqual(['0', '1', '2-4', '5+']);
    expect(Object.keys(NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.signin'].shape)).toEqual(['os', 'method', 'result', 'second']);
    expect(Object.keys(NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.signout'].shape)).toEqual(['os', 'via']);
    expect(Object.keys(NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.lock'].shape)).toEqual(['os', 'cause']);
    expect(Object.keys(NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.home'].shape)).toEqual(['os', 'use', 'spaces']);
  });

  it('every schema takes its example and every listed value', () => {
    for (const name of NAMES) expect(NATIVE_AUTH_TELEMETRY_PAYLOADS[name].safeParse(VALID[name]).success, name).toBe(true);
    const signin = NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.signin'];
    for (const method of NATIVE_SIGNIN_METHODS) for (const result of NATIVE_SIGNIN_RESULTS) expect(signin.safeParse({ ...VALID['auth.native.signin'], method, result, second: true }).success).toBe(true);
    for (const cause of NATIVE_LOCK_CAUSES) expect(NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.lock'].safeParse({ os: 'android', cause }).success).toBe(true);
    for (const use of NATIVE_HOME_USES) for (const spaces of NATIVE_HOME_SPACES) expect(NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.home'].safeParse({ os: 'ios', use, spaces }).success).toBe(true);
    expect(NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.signout'].safeParse({ os: 'ios', via: 'lock' }).success).toBe(true);
  });

  it('refuses a profile id, an email, an extra key, a missing key and an off-list value', () => {
    for (const name of NAMES) {
      const schema = NATIVE_AUTH_TELEMETRY_PAYLOADS[name];
      expect(schema.safeParse({ ...VALID[name], profileId: 'profile:a' }).success, name).toBe(false);
      expect(schema.safeParse({ ...VALID[name], email: 'a@b.c' }).success, name).toBe(false);
      expect(schema.safeParse({ ...VALID[name], os: 'web' }).success, name).toBe(false);
      for (const key of Object.keys(VALID[name])) {
        expect(schema.safeParse({ ...VALID[name], [key]: 'user_2abc' }).success, `${name}.${key}`).toBe(false);
        const { [key]: _dropped, ...missing } = VALID[name];
        expect(schema.safeParse(missing).success, `${name} without ${key}`).toBe(false);
      }
    }
    expect(NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.home'].safeParse({ ...VALID['auth.native.home'], spaces: '3' }).success).toBe(false);
    expect(NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.home'].safeParse({ ...VALID['auth.native.home'], use: 'area' }).success).toBe(false);
    expect(NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.signin'].safeParse({ ...VALID['auth.native.signin'], second: 'true' }).success).toBe(false);
  });
});

describe('who.picked use: account (section 7.1)', () => {
  it('takes the appended account use beside the existing ones', () => {
    const picked = OA_TELEMETRY_PAYLOADS['who.picked'];
    expect(picked.safeParse({ kind: 'grown_up', use: 'account' }).success).toBe(true);
    expect(picked.shape.use.unwrap().options.at(-1)).toBe('account');
    expect(picked.safeParse({ kind: 'grown_up', use: 'accounts' }).success).toBe(false);
  });
});

describe('AccountTrustSchema (sections 7.3 and 13.1)', () => {
  it('holds a version and a real PIN epoch, nothing else', () => {
    expect(AccountTrustSchema.parse({ v: 1, epoch: 1_700_000_000_000 })).toEqual({ v: 1, epoch: 1_700_000_000_000 });
    // Unknown keys (an account id, an email) are stripped, never kept.
    expect(AccountTrustSchema.parse({ v: 1, epoch: 5, accountId: 'user_2abc', email: 'a@b.c' })).toEqual({ v: 1, epoch: 5 });
  });

  it('refuses epoch 0, a negative, fractional or non-finite epoch, a string, and another version', () => {
    for (const epoch of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '5', null]) expect(AccountTrustSchema.safeParse({ v: 1, epoch }).success, String(epoch)).toBe(false);
    expect(AccountTrustSchema.safeParse({ v: 2, epoch: 5 }).success).toBe(false);
    expect(AccountTrustSchema.safeParse({ epoch: 5 }).success).toBe(false);
    expect(AccountTrustSchema.safeParse(null).success).toBe(false);
  });
});

describe('the native client header (sections 9.4 and 13.2)', () => {
  it('is X-HR-Client: native', () => {
    expect(NATIVE_CLIENT_HEADER).toBe('X-HR-Client');
    expect(NATIVE_CLIENT_VALUE).toBe('native');
  });
});
