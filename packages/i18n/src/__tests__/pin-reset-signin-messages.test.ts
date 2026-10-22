import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-6 (sections 8.5, 17.3 and 17.5): reset the grown-up PIN by signing in.
 * The learner app's Forgot PIN? card and new-PIN title (`caregiver.pin.reset.signIn.*`) and the console page
 * `/account/pin-reset` (`console.pinReset.*`), in English, Spanish and Korean in the same PR, to the F-I18N-001
 * section 3.10 style guide and glossary (grown-up: adultos / 어른; Rescue Code: código de rescate / 복구 코드; the
 * 24-hour wait keeps the reset screen's own words). A child may read these on a shared device: no age, no name, no
 * number but the 24 hours, never "failed", never shaming.
 */
const LOCALES = ['en', 'es', 'ko'] as const;

const pinOf = (locale: (typeof LOCALES)[number]) => getMessages(locale).caregiver.pin;
const consoleOf = (locale: (typeof LOCALES)[number]) => getMessages(locale).console;

const appStrings = (locale: (typeof LOCALES)[number]): string[] => {
  const s = pinOf(locale).reset.signIn;
  return [s.heading, s.caption, s.button, s.newPinTitle, s.expired];
};
const consoleStrings = (locale: (typeof LOCALES)[number]): string[] => {
  const r = consoleOf(locale).pinReset;
  return [r.title, r.going, r.notOwner, r.firstSignIn, r.noPin, r.unavailable];
};

describe('caregiver.pin.reset.signIn and console.pinReset (row OA-6)', () => {
  it('English is the spec text (tables 17.3 and 17.5)', () => {
    const s = pinOf('en').reset.signIn;
    expect(s.heading).toBe('Sign in to the account');
    expect(s.caption).toBe('Sign in as the grown-up who uses this device. Then choose a new PIN.');
    expect(s.button).toBe('Sign in');
    expect(s.newPinTitle).toBe('Choose a new grown-up PIN');
    expect(s.expired).toBe('That took a while. Sign in again to set a new PIN.');
    const r = consoleOf('en').pinReset;
    expect(r.title).toBe('New grown-up PIN');
    expect(r.going).toBe('Opening the app so you can choose a new PIN.');
    expect(r.notOwner).toBe('Only the grown-up account that last used this PIN here can do this. In the app, use the Rescue Code or the 24-hour wait.');
    expect(r.firstSignIn).toBe('This works after a grown-up has opened the grown-up pages here with the PIN. In the app, use the Rescue Code or the 24-hour wait.');
    expect(r.noPin).toBe('This device has no grown-up PIN to reset.');
    expect(r.unavailable).toBe("This isn't available right now. Use Forgot PIN? in the app.");
  });

  it('Spanish and Korean have their own value for every key (no English fallback)', () => {
    for (const locale of ['es', 'ko'] as const) {
      appStrings(locale).forEach((value, i) => expect(value, `${locale} app ${i}`).not.toBe(appStrings('en')[i]));
      consoleStrings(locale).forEach((value, i) => expect(value, `${locale} console ${i}`).not.toBe(consoleStrings('en')[i]));
    }
  });

  it('the sign-in button is the reset screen’s and the console’s own word for signing in', () => {
    // es "Entrar" and ko "로그인", as the Restore screen's sign-in row says.
    for (const locale of LOCALES) expect(pinOf(locale).reset.signIn.button).toBe(getMessages(locale).caregiver.audience.shared.restoreSignInLabel);
  });

  it('the unavailable line names the Forgot PIN? button by its own label', () => {
    for (const locale of LOCALES) expect(consoleOf(locale).pinReset.unavailable, locale).toContain(pinOf(locale).entry.forgot.cta);
  });

  it('the refusals point at the other two ways by the reset screen’s glossary words', () => {
    expect(consoleOf('es').pinReset.notOwner).toContain('código de rescate');
    expect(consoleOf('es').pinReset.firstSignIn).toContain('la espera de 24 horas');
    expect(consoleOf('ko').pinReset.notOwner).toContain('복구 코드');
    expect(consoleOf('ko').pinReset.firstSignIn).toContain(pinOf('ko').reset.wait.heading);
  });

  it('use the glossary for the grown-up PIN: "PIN de adultos" and "어른용 PIN"', () => {
    for (const text of [pinOf('es').reset.signIn.newPinTitle, consoleOf('es').pinReset.title, consoleOf('es').pinReset.noPin]) expect(text).toContain('PIN de adultos');
    for (const text of [pinOf('ko').reset.signIn.newPinTitle, consoleOf('ko').pinReset.title, consoleOf('ko').pinReset.noPin]) expect(text).toContain('어른용 PIN');
  });

  it('Korean sentences are 해요체 and Spanish uses tú (no usted)', () => {
    const ko = [pinOf('ko').reset.signIn.caption, pinOf('ko').reset.signIn.expired, ...consoleStrings('ko').slice(1)];
    for (const text of ko) expect(text, text).toMatch(/(요|세요)\.$/);
    for (const text of [...appStrings('es'), ...consoleStrings('es')]) expect(text).not.toMatch(/\busted\b/i);
  });

  it('pass the caregiver ban list; no age, no child, no name, no "failed", no number but the 24 hours', () => {
    for (const locale of LOCALES) {
      for (const text of [...appStrings(locale), ...consoleStrings(locale)]) {
        expect(findBannedWord(text, locale, 'caregiver'), `${locale}: ${text}`).toBeNull();
        expect(text).not.toMatch(/fail|fall[oó]|실패|\bkids?\b|\bchild(ren)?\b|niñ|아이|@|\$|premium/i);
        expect(text.replace(/24/g, '')).not.toMatch(/\d/);
        if (locale === 'en') for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(text), `${text} matches ${name}`).toBe(false);
      }
    }
  });
});
