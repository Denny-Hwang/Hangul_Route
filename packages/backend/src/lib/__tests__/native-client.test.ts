import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { hasNativeHeader, isNativeRequest, nativeAccountEnabled, nativeMoneyGuardEnabled } from '../native-client';

/** F-AUTH-004 section 9.4 (row NS-1): the two Worker switches and what makes a request native. */
function ctx(headers: Record<string, string>, env: Record<string, unknown> = { ENVIRONMENT: 'test' }): Context {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { req: { header: (k: string) => lower[k.toLowerCase()] }, env } as unknown as Context;
}

describe('nativeMoneyGuardEnabled', () => {
  it('is on unless the variable is an off word (trimmed, any case); a typo keeps it on', () => {
    expect(nativeMoneyGuardEnabled(undefined)).toBe(true);
    expect(nativeMoneyGuardEnabled({})).toBe(true);
    for (const on of ['', 'on', 'true', '1', 'enabled', 'of', 'no', 'disable']) expect(nativeMoneyGuardEnabled({ NATIVE_MONEY_GUARD: on }), on).toBe(true);
    for (const off of ['false', '0', 'off', 'disabled', 'FALSE', ' Off ', 'Disabled']) expect(nativeMoneyGuardEnabled({ NATIVE_MONEY_GUARD: off }), off).toBe(false);
  });
});

describe('nativeAccountEnabled', () => {
  it('is on when unset, empty or an on word (trimmed, any case); any other value, a typo included, is off', () => {
    expect(nativeAccountEnabled(undefined)).toBe(true);
    expect(nativeAccountEnabled({})).toBe(true);
    for (const on of ['', ' ', 'enabled', 'on', 'true', '1', 'ENABLED', ' On ']) expect(nativeAccountEnabled({ NATIVE_ACCOUNT: on }), on).toBe(true);
    for (const off of ['disabled', 'off', 'false', '0', 'no', 'enable', 'typo']) expect(nativeAccountEnabled({ NATIVE_ACCOUNT: off }), off).toBe(false);
    // A non-text value (a [vars] boolean or number) is not an on word either: off.
    for (const off of [false, true, 0, 1, null]) expect(nativeAccountEnabled({ NATIVE_ACCOUNT: off as unknown as string }), String(off)).toBe(false);
    // The money guard reads a non-text value as on (its closed side).
    for (const on of [false, 0, null]) expect(nativeMoneyGuardEnabled({ NATIVE_MONEY_GUARD: on as unknown as string }), String(on)).toBe(true);
  });
});

describe('hasNativeHeader and isNativeRequest', () => {
  it('reads X-HR-Client: native in any case, alone or in a combined value', () => {
    for (const value of ['native', 'NATIVE', ' native ', 'web,native', 'native, web']) expect(hasNativeHeader(ctx({ 'X-HR-Client': value })), value).toBe(true);
    for (const value of ['', 'web', 'natives', 'not-native']) expect(hasNativeHeader(ctx({ 'X-HR-Client': value })), value).toBe(false);
    expect(hasNativeHeader(ctx({}))).toBe(false);
  });

  it('is native with the header, whatever the bearer; without it, not on the dev fallback or with no bearer', async () => {
    expect(await isNativeRequest(ctx({ 'X-HR-Client': 'native' }))).toBe(true);
    expect(await isNativeRequest(ctx({ authorization: 'Bearer user_mom' }))).toBe(false);
    expect(await isNativeRequest(ctx({}))).toBe(false);
  });
});
