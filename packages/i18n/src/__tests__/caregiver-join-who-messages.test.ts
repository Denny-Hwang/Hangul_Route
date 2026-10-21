import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-7b, section 17.4: "Who is joining?" for family codes. Names only, no
// age, no comparison; a refused seat is a calm line, never an error. es and ko follow the F-I18N-001 section 3.10 style
// guide and glossary (learner: estudiante / 학습자; grown-up: adultos / 어른; join: unirse / 들어가다, and 참여 on the consent step,
// the shipped Join verb): Korean never puts a particle on a name or a family name (the colon form), and Spanish counts
// agree with the number.

const LOCALES = ['en', 'es', 'ko'] as const;
const KEYS = ['title', 'hint', 'takesPlace', 'classOnly', 'retry', 'consentSees', 'consentYes', 'notNow'] as const;
const CAP_LINE = 'This family already has 4 learners. Ask a grown-up in your family.';

describe('caregiver.join.who (OA-7b)', () => {
  it('English is the spec text (section 17.4)', () => {
    const m = getMessages('en').caregiver.join.who;
    expect(m.title).toBe('Who is joining?');
    expect(m.hint).toBe('Pick each learner on this device who should join.');
    expect(m.result(2, 3)).toBe('2 of 3 joined.');
    expect(m.joined('Mina')).toBe('Mina joined.');
    expect(m.already('Mina')).toBe('Mina is already in this family.');
    expect(m.refused('Sora', CAP_LINE)).toBe(`Sora: ${CAP_LINE}`);
    expect(m.takesPlace).toBe('Takes a family place.');
    expect(m.classOnly).toBe('Linked for a class on this device.');
    expect(m.retry).toBe('Try again');
    expect(m.consentTitle('Kim family')).toBe('Join Kim family?');
    expect(m.consentLine('Mina')).toBe('Mina: joining saves their progress to the account.');
    expect(m.consentSees).toBe("The family's grown-ups will see each name and their progress.");
    expect(m.consentYes).toBe('Yes, join');
    expect(m.notNow).toBe('Not now');
  });

  it('Spanish and Korean have their own value for every key', () => {
    const en = getMessages('en').caregiver.join.who;
    for (const locale of ['es', 'ko'] as const) {
      const m = getMessages(locale).caregiver.join.who;
      for (const key of KEYS) expect(m[key], `${locale}.${key}`).not.toBe(en[key]);
      expect(m.result(2, 3)).not.toBe(en.result(2, 3));
      expect(m.joined('Mina')).not.toBe(en.joined('Mina'));
      expect(m.already('Mina')).not.toBe(en.already('Mina'));
      expect(m.consentTitle('Kim')).not.toBe(en.consentTitle('Kim'));
      expect(m.consentLine('Mina')).not.toBe(en.consentLine('Mina'));
    }
  });

  it('Try again is the same words as every other Try again in the locale', () => {
    for (const locale of LOCALES) {
      expect(getMessages(locale).caregiver.join.who.retry, locale).toBe(getMessages(locale).common.buttons.tryAgain);
    }
  });

  it('every line about a learner leads with the name, and Korean uses the colon form', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).caregiver.join.who;
      for (const line of [m.joined('Mina'), m.already('Mina'), m.consentLine('Mina'), m.refused('Mina', CAP_LINE)]) {
        expect(line.startsWith('Mina'), `${locale}: ${line}`).toBe(true);
      }
    }
    const ko = getMessages('ko').caregiver.join.who;
    expect(ko.joined('민아')).toBe('민아: 들어갔어요.');
    expect(ko.already('민아')).toBe('민아: 이미 이 가족에 있어요.');
    expect(ko.consentTitle('김 가족')).toBe('김 가족: 참여할까요?');
    expect(ko.consentLine('민아')).toBe('민아: 참여하면 진도가 계정에 저장돼요.');
  });

  it('the spec 17.4 es and ko values decided by the OA-0b language review (round 2)', () => {
    const es = getMessages('es').caregiver.join.who;
    const ko = getMessages('ko').caregiver.join.who;
    expect(es.classOnly).toBe('En este dispositivo, solo es para su clase.');
    expect(ko.consentYes).toBe('네, 참여하기');
    expect(ko.notNow).toBe('지금은 안 함');
  });

  it('the consent uses the Join verb of the running button, and Not now the words of the transfer consent', () => {
    for (const locale of LOCALES) {
      const c = getMessages(locale).caregiver;
      expect(c.join.who.notNow, locale).toBe(c.transfer.actions.notNow.cta);
    }
    const ko = getMessages('ko').caregiver.join;
    // 참여할까요? / 네, 참여하기, then 참여하는 중… on the running button: one verb throughout.
    expect(ko.confirm.joining.cta).toContain('참여');
    for (const s of [ko.who.consentTitle('김 가족'), ko.who.consentLine('민아'), ko.who.consentYes]) expect(s).toContain('참여');
  });

  it('the refused line keeps the cap line whole, in every locale', () => {
    for (const locale of LOCALES) {
      const c = getMessages(locale).caregiver;
      const cap = c.join.errors.familyFull(4);
      expect(c.join.who.refused('Sora', cap)).toBe(`Sora: ${cap}`);
    }
  });

  it('the results heading holds both counts once; Spanish agrees with one', () => {
    for (const locale of LOCALES) {
      const line = getMessages(locale).caregiver.join.who.result(7, 9);
      expect(line.split('7')).toHaveLength(2);
      expect(line.split('9')).toHaveLength(2);
    }
    expect(getMessages('es').caregiver.join.who.result(1, 3)).toBe('Se unió 1 de 3.');
    expect(getMessages('es').caregiver.join.who.result(2, 3)).toBe('Se unieron 2 de 3.');
    expect(getMessages('ko').caregiver.join.who.result(2, 3)).toBe('3명 중 2명이 들어갔어요.');
  });

  it('the consent names the space once and claims nothing the privacy card does not', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).caregiver.join.who;
      expect(m.consentTitle('SPACE').split('SPACE')).toHaveLength(2);
      expect(m.consentLine('NAME').split('NAME')).toHaveLength(2);
      for (const s of [m.consentLine('Mina'), m.consentSees]) expect(s).not.toMatch(/third|terceros|제3자|sell|vend|판매|ads|anuncio|광고/i);
    }
  });
});

describe('Who is joining? copy: anti-shame, no age, no comparison', () => {
  it('passes the caregiver ban list and names no age, child, rank, star, streak, error or failure', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).caregiver.join.who;
      const all = [
        ...KEYS.map((k) => m[k]),
        m.result(2, 3),
        m.joined('Mina'),
        m.already('Mina'),
        m.consentTitle('Kim family'),
        m.consentLine('Mina'),
      ];
      for (const s of all) {
        expect(findBannedWord(s, locale, 'caregiver'), `${locale}: ${s}`).toBeNull();
        expect(s).not.toMatch(/\bage[sd]?\b|\bkids?\b|\bchild(ren)?\b|niñ|아이|나이|\brank|\bstars?\b|\bstreak|\berror|\bfail|estrella|racha|fall|오류|실패|best|mejor|최고/i);
        if (locale === 'en') for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), name).toBe(false);
      }
    }
  });
});
