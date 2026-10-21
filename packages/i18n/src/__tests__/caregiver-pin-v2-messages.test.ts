import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-2, section 17.3: the longer pauses (minutes from one minute on),
// the help line on the Grown-up area destination, and the notice after a PIN set by the 24-hour wait. A pause is a
// pause: calm words, never "failed", no count of tries. es and ko follow the F-I18N-001 section 3.10 style guide
// and glossary (grown-up: adultos / 어른; the Forgot PIN? button keeps its own label in each language).

const LOCALES = ['en', 'es', 'ko'] as const;

describe('caregiver.pin OA-2 keys', () => {
  it('English is the spec text', () => {
    const m = getMessages('en').caregiver.pin;
    expect(m.cooldownMinutes(5)).toBe("Let's take a short break. Try again in 5 min.");
    expect(m.cooldownHelp).toBe('You can also set a new PIN with Forgot PIN?');
    expect(m.resetByWaitNotice).toBe('The grown-up PIN was changed after the 24-hour wait. If that was not you, change it now.');
    expect(m.resetByWaitChange).toBe('Change PIN');
  });

  it('Spanish and Korean have their own values, with the number in place', () => {
    const es = getMessages('es').caregiver.pin;
    const ko = getMessages('ko').caregiver.pin;
    expect(es.cooldownMinutes(15)).toBe('Tomemos un descanso corto. Reintenta en 15 min.');
    expect(ko.cooldownMinutes(15)).toBe('잠깐 쉬어요. 15분 뒤에 다시 해 보세요.');
    expect(es.resetByWaitChange).toBe('Cambiar el PIN');
    expect(ko.resetByWaitChange).toBe('PIN 바꾸기');
    for (const locale of ['es', 'ko'] as const) {
      const m = getMessages(locale).caregiver.pin;
      const en = getMessages('en').caregiver.pin;
      expect(m.cooldownHelp).not.toBe(en.cooldownHelp);
      expect(m.resetByWaitNotice).not.toBe(en.resetByWaitNotice);
    }
  });

  it('the minutes line starts like the seconds line, so the two read as one pause', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).caregiver.pin;
      const lead = m.cooldown(30).split(/[.。]/)[0]!;
      expect(m.cooldownMinutes(60).startsWith(lead), locale).toBe(true);
    }
  });

  it('the help line names the Forgot PIN? button by its own label', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).caregiver.pin;
      expect(m.cooldownHelp, locale).toContain(m.entry.forgot.cta);
    }
  });

  it('passes the caregiver ban list, never says failed, names no age and no child', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).caregiver.pin;
      for (const s of [m.cooldownMinutes(5), m.cooldownHelp, m.resetByWaitNotice, m.resetByWaitChange]) {
        expect(findBannedWord(s, locale, 'caregiver'), `${locale}: ${s}`).toBeNull();
        expect(s).not.toMatch(/fail|fall[oó]|실패|\bkids?\b|\bchild(ren)?\b|niñ|아이/i);
        if (locale === 'en') for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), name).toBe(false);
      }
    }
  });
});
