import { describe, expect, it } from 'vitest';
import { accountLocaleOf, signInMerge, withAccountLocale } from '../account-locale';

/**
 * Owner items 6 and 7: a signed-in grown-up's language lives in Clerk `unsafeMetadata`. Clerk's
 * update replaces the object, so the adult step's `adultAffirmedAt` must ride along.
 */
const NOW = '2026-10-16T12:00:00.000Z';

describe('accountLocaleOf', () => {
  it('reads the language and its time; nothing or a damaged value is no language', () => {
    expect(accountLocaleOf({ uiLocale: 'ko', uiLocaleAt: NOW, adultAffirmedAt: NOW })).toEqual({ uiLocale: 'ko', uiLocaleAt: NOW });
    expect(accountLocaleOf({ adultAffirmedAt: NOW })).toBeNull();
    expect(accountLocaleOf({ uiLocale: 'fr' })).toBeNull();
    expect(accountLocaleOf(null)).toBeNull();
    expect(accountLocaleOf(undefined)).toBeNull();
  });
});

describe('withAccountLocale', () => {
  it('keeps adultAffirmedAt and every other key, replacing only the language and its time', () => {
    expect(withAccountLocale({ adultAffirmedAt: '2026-10-01T00:00:00.000Z', uiLocale: 'en', other: 1 }, { uiLocale: 'ko', uiLocaleAt: NOW })).toEqual({
      adultAffirmedAt: '2026-10-01T00:00:00.000Z',
      other: 1,
      uiLocale: 'ko',
      uiLocaleAt: NOW,
    });
    expect(withAccountLocale(null, { uiLocale: 'es', uiLocaleAt: NOW })).toEqual({ uiLocale: 'es', uiLocaleAt: NOW });
  });
});

describe('signInMerge (newer wins; a missing time counts as 1970)', () => {
  it('an account language seeds a device that never chose (or could not be read)', () => {
    expect(signInMerge({ textSize: 'large' }, { uiLocale: 'ko', uiLocaleAt: NOW }).device).toEqual({ uiLocale: 'ko', uiLocaleAt: NOW });
    expect(signInMerge(null, { uiLocale: 'ko', uiLocaleAt: NOW }).device).toEqual({ uiLocale: 'ko', uiLocaleAt: NOW });
  });

  it('a device language without a time loses to a stamped account choice', () => {
    expect(signInMerge({ uiLocale: 'en' }, { uiLocale: 'ko', uiLocaleAt: NOW })).toEqual({ device: { uiLocale: 'ko', uiLocaleAt: NOW }, account: null });
  });

  it('a device language without a time goes to an account with none, stamped 1970 (never now)', () => {
    expect(signInMerge({ uiLocale: 'en' }, { adultAffirmedAt: NOW })).toEqual({ device: null, account: { uiLocale: 'en', uiLocaleAt: '1970-01-01T00:00:00.000Z' } });
  });

  it('the newer of two stamped choices wins', () => {
    expect(signInMerge({ uiLocale: 'en', uiLocaleAt: '2026-10-01T00:00:00.000Z' }, { uiLocale: 'es', uiLocaleAt: NOW }).device).toEqual({ uiLocale: 'es', uiLocaleAt: NOW });
  });
});
