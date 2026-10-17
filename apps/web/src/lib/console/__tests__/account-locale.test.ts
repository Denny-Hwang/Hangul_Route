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

describe('signInMerge (newer wins; a missing timestamp means the device wins)', () => {
  it('an account language seeds a device that never chose (or could not be read)', () => {
    expect(signInMerge({ textSize: 'large' }, { uiLocale: 'ko', uiLocaleAt: NOW }, NOW).device).toEqual({ textSize: 'large', uiLocale: 'ko', uiLocaleAt: NOW });
    expect(signInMerge(null, { uiLocale: 'ko', uiLocaleAt: NOW }, NOW).device).toEqual({ uiLocale: 'ko', uiLocaleAt: NOW });
  });

  it('a device choice without a time wins and is copied to the account', () => {
    expect(signInMerge({ uiLocale: 'en' }, { uiLocale: 'ko', uiLocaleAt: NOW }, NOW)).toEqual({ device: null, account: { uiLocale: 'en', uiLocaleAt: NOW } });
  });

  it('the newer of two stamped choices wins', () => {
    expect(signInMerge({ uiLocale: 'en', uiLocaleAt: '2026-10-01T00:00:00.000Z' }, { uiLocale: 'es', uiLocaleAt: NOW }, NOW).device).toEqual({ uiLocale: 'es', uiLocaleAt: NOW });
  });
});
