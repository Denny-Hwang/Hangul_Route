import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4a, sections 17.1 and 17.2: "Who is using this?", the device's one
// chooser. Names only, nothing that compares learners, no age, no progress words; the pending-wait line names no one
// and counts no tries. es and ko follow the F-I18N-001 section 3.10 style guide and glossary (grown-up: adultos /
// 어른; learner: estudiante / 학습자; Grown-up area: Zona de adultos / 어른 공간; join: unirse / 참여하기).

const LOCALES = ['en', 'es', 'ko'] as const;
const KEYS = ['title', 'learning', 'grownUps', 'add', 'switch', 'profileRow', 'switchUser', 'joinCaption', 'nopinCaption', 'resetCancel'] as const;

describe('learner.who (OA-4a)', () => {
  it('English is the spec text (section 17.1)', () => {
    const m = getMessages('en').learner.who;
    expect(m.title).toBe('Who is using this?');
    expect(m.learning).toBe('Learning');
    expect(m.grownUps).toBe('Grown-ups');
    expect(m.add).toBe('Add a learner');
    expect(m.switch).toBe('Switch');
    expect(m.profileRow).toBe('Who is using this?');
    expect(m.switchUser).toBe('Switch user');
    expect(m.joinCaption).toBe('Pick who is joining.');
    expect(m.nopinCaption).toBe('A grown-up sets a PIN here.');
    expect(m.resetPending('6:40 PM')).toBe('A new grown-up PIN can be set after 6:40 PM. Enter the PIN to cancel.');
    expect(m.resetCancel).toBe('Cancel the wait');
  });

  it('Spanish and Korean have their own value for every key', () => {
    const en = getMessages('en').learner.who;
    for (const locale of ['es', 'ko'] as const) {
      const m = getMessages(locale).learner.who;
      for (const key of KEYS) expect(m[key], `${locale}.${key}`).not.toBe(en[key]);
      expect(m.resetPending('18:40')).not.toBe(en.resetPending('18:40'));
    }
  });

  it('the glossary: the Grown-ups heading is the grown-up word, the title and the Profile row are one question', () => {
    expect(getMessages('es').learner.who.grownUps).toBe('Adultos');
    expect(getMessages('ko').learner.who.grownUps).toBe('어른');
    for (const locale of LOCALES) {
      const m = getMessages(locale).learner.who;
      expect(m.profileRow, locale).toBe(m.title);
    }
  });

  it('the pending line holds the time once and the word PIN, and no number of tries', () => {
    for (const locale of LOCALES) {
      const line = getMessages(locale).learner.who.resetPending('TIME');
      expect(line.split('TIME')).toHaveLength(2);
      expect(line).toContain('PIN');
      expect(line).not.toMatch(/\d/);
    }
  });

  it('Spanish keeps the gender-neutral spec word for Switch user (section 17)', () => {
    expect(getMessages('es').learner.who.switchUser).toBe('Cambiar de persona');
  });

  it('the end of the wait is a date and time; a Spanish time ending in "p.m." never takes a second period', () => {
    expect(getMessages('es').learner.who.resetPending('22 oct 2026, 6:40 p.m.')).toBe(
      'Se podrá crear un PIN de adultos nuevo a partir del 22 oct 2026, 6:40 p.m. Escribe el PIN para cancelar la espera.',
    );
    expect(getMessages('es').learner.who.resetPending('22 oct 2026, 18:40')).toBe(
      'Se podrá crear un PIN de adultos nuevo a partir del 22 oct 2026, 18:40. Escribe el PIN para cancelar la espera.',
    );
  });

  it('Korean puts no particle on the time', () => {
    expect(getMessages('ko').learner.who.resetPending('오후 6:40')).toMatch(/^오후 6:40 이후에 /);
  });
});

describe('a11y.who (OA-4a, section 17.2)', () => {
  it('English is the spec text', () => {
    const a = getMessages('en').a11y.who;
    expect(a.tile('Mina')).toBe('Mina. Tap to start learning.');
    expect(a.grownUpRow('Grown-up area')).toBe('Grown-up area, for grown-ups, needs the PIN');
  });

  it('every locale leads with the name or label, and Korean uses the colon form', () => {
    for (const locale of LOCALES) {
      const a = getMessages(locale).a11y.who;
      expect(a.tile('Mina').startsWith('Mina'), locale).toBe(true);
      expect(a.grownUpRow('Zona').startsWith('Zona'), locale).toBe(true);
      expect(a.grownUpRow('Zona'), locale).toContain('PIN');
    }
    expect(getMessages('ko').a11y.who.tile('민아')).toBe('민아: 눌러서 배우기 시작해요.');
    expect(getMessages('ko').a11y.who.grownUpRow('어른 공간')).toBe('어른 공간: 어른용, PIN 필요');
  });
});

describe('chooser copy: anti-shame, no age, no comparison (CS-6)', () => {
  it('passes the learner ban list and names no age, child, rank, star, streak or level', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).learner.who;
      const a = getMessages(locale).a11y.who;
      const all = [...KEYS.map((k) => m[k]), m.resetPending('6:40'), a.tile('Mina'), a.grownUpRow('Family')];
      for (const s of all) {
        expect(findBannedWord(s, locale, 'learner'), `${locale}: ${s}`).toBeNull();
        expect(s).not.toMatch(/\bage[sd]?\b|\bkids?\b|\bchild(ren)?\b|niñ|아이|나이|\brank|\bstars?\b|\bstreak|\blevel|estrella|racha|nivel|별|연속|레벨|best|mejor|최고/i);
        if (locale === 'en') for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), name).toBe(false);
      }
    }
  });
});
