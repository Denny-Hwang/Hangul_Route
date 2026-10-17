import { enUS, esMX, koKR } from '@clerk/localizations';
import { describe, expect, it } from 'vitest';
import { clerkLocalization } from '../clerk-localization';

/** Owner items 6 and 7: the Clerk widget speaks the console's language (enUS, koKR, esMX for es_419). */
describe('clerkLocalization', () => {
  it('maps each UI locale to its Clerk localization', () => {
    expect(clerkLocalization('en')).toBe(enUS);
    expect(clerkLocalization('ko')).toBe(koKR);
    expect(clerkLocalization('es')).toBe(esMX);
  });

  it('the Korean and Spanish widgets really are translated (the sign-in title differs from English)', () => {
    const title = (l: typeof enUS): unknown => (l.signIn as { start?: { title?: unknown } } | undefined)?.start?.title;
    expect(title(koKR)).not.toEqual(title(enUS));
    expect(title(esMX)).not.toEqual(title(enUS));
    expect(koKR.locale).toBe('ko-KR');
    expect(esMX.locale).toBe('es-MX');
  });
});
