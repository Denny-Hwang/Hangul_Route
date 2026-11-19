import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { numberInWords } from '../number-words';
import { getMessages } from '../resolve';

// [FN] AMENDMENTS-FINISH-2026-11 FN-1: the check before a new PIN (mock design/screens/profiles/pin-reset-check.md).
// A miss is calm and comes with a new number: never "wrong" or "failed", no count. No "grown-up" word (a self-only
// device's reset screen shows none). es and ko follow the F-I18N-001 section 3.10 style guide; "Casi." / "조금 달라요."
// are the PIN pad's own words for a miss (`entry.triesLeft`).

const LOCALES = ['en', 'es', 'ko'] as const;

describe('caregiver.pin.reset.check', () => {
  it('English is the mock text', () => {
    const c = getMessages('en').caregiver.pin.reset.check;
    expect(c.heading).toBe('One more step');
    expect(c.prompt).toBe('Type this number in digits.');
    expect(c.fieldLabel).toBe('Number in digits');
    expect(c.again).toBe('Not quite. Here is a new number.');
    expect(c.words(347)).toBe('three hundred forty-seven');
  });

  it('Spanish and Korean have their own values, and write the number in their own words', () => {
    const es = getMessages('es').caregiver.pin.reset.check;
    const ko = getMessages('ko').caregiver.pin.reset.check;
    expect([es.heading, es.prompt, es.fieldLabel, es.again]).toEqual(['Un paso más', 'Escribe este número con cifras.', 'Número en cifras', 'Casi. Aquí tienes un número nuevo.']);
    expect([ko.heading, ko.prompt, ko.fieldLabel, ko.again]).toEqual(['한 단계 더', '이 수를 숫자로 적어 주세요.', '숫자로 적기', '번호가 달라요. 새 수를 보여 드릴게요.']);
    expect(es.words(347)).toBe('trescientos cuarenta y siete');
    expect(ko.words(347)).toBe('삼백사십칠');
    for (const locale of LOCALES) {
      const c = getMessages(locale).caregiver.pin.reset.check;
      for (const n of [100, 519, 999]) expect(c.words(n)).toBe(numberInWords(locale, n));
    }
  });

  it('the miss line starts like the PIN pad’s own miss line', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).caregiver.pin;
      expect(m.reset.check.again.split(/[.]/)[0], locale).toBe(m.entry.triesLeft(2).split(/[.]/)[0]);
    }
  });

  it('passes the caregiver ban list; never "wrong" or "failed"; names no grown-up, age or child', () => {
    for (const locale of LOCALES) {
      const c = getMessages(locale).caregiver.pin.reset.check;
      for (const s of [c.heading, c.prompt, c.fieldLabel, c.again]) {
        expect(findBannedWord(s, locale, 'caregiver'), `${locale}: ${s}`).toBeNull();
        expect(s).not.toMatch(/wrong|fail|incorrect|grown|adult|fall[oó]|incorrect|adult|실패|틀렸|어른|\bkids?\b|\bchild(ren)?\b|niñ|아이/i);
        expect(s).not.toMatch(/[0-9]/);
        if (locale === 'en') for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), name).toBe(false);
      }
    }
  });
});
