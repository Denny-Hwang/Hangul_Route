import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { en as enOwn } from '../messages/en';
import { es as esOwn } from '../messages/es';
import { ko as koOwn } from '../messages/ko';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

/**
 * AMENDMENTS-LECTURE-V2 row LV-6 (sections 3 E5 and 12.4; design/screens/lecture-entry/learner-card.md): the Lecture
 * mode card in the learner app's grown-up area. Every key holds the section 12.4 value in en, es and ko in its own
 * dictionary (no English fallback), es and ko never repeat the English, nothing trips the ban lists or frames the card
 * for one age, no Hangul sits in an en or es value (F-I18N-001 section 3.4 rule 5), no value holds a count or an
 * exclamation, and the per-learner row keeps the name as it is given, with no particle attached in Korean.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

const OWN = { en: enOwn, es: esOwn, ko: koOwn } as const;

const paths = leafPaths(enOwn.caregiver.lecture);

function own(locale: UiLocale, path: string): unknown {
  const value = lookup(OWN[locale].caregiver.lecture, path);
  expect(value, `${locale}:caregiver.lecture.${path} is in its own dictionary`).toBeDefined();
  return value;
}

const text = (locale: UiLocale, path: string): string => {
  const value = own(locale, path);
  return typeof value === 'function' ? (value as (name: string) => string)('Mina') : (value as string);
};

/** Section 12.4, verbatim (`next` shown with the name Mina). */
const TABLE: Record<string, Record<UiLocale, string>> = {
  title: { en: 'Lecture mode', es: 'Modo proyección', ko: '강의 모드' },
  body: {
    en: "Show a lesson on a TV or big screen and learn together. Nobody's progress changes.",
    es: 'Muestra una lección en una TV o una pantalla grande y aprende en familia. El progreso de nadie cambia.',
    ko: 'TV나 큰 화면에 수업을 띄우고 함께 배워요. 누구의 진도도 바뀌지 않아요.',
  },
  'open.cta': { en: 'Open lecture mode', es: 'Abrir modo proyección', ko: '강의 모드 열기' },
  next: { en: 'Next lesson for Mina', es: 'Siguiente lección para Mina', ko: '다음 수업: Mina' },
  // Added in LV-6 (section 12.4 as amended): the buttons open the presenter in a new tab (section 7 item 3). The values
  // are the reviewed `console.lecture.card.opensTab` and `caregiver.browse.item.presentBlocked`.
  opensTab: { en: 'Opens in a new tab', es: 'Se abre en una pestaña nueva', ko: '새 탭에서 열려요' },
  blocked: {
    en: 'The new tab did not open. Allow pop-ups for this site, then try again.',
    es: 'La pestaña nueva no se abrió. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.',
    ko: '새 탭이 열리지 않았어요. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.',
  },
};

describe('learner app grown-up card strings (LV-6)', () => {
  it('lists every key of section 12.4 and nothing else', () => {
    expect([...paths].sort()).toEqual(Object.keys(TABLE).sort());
  });

  it.each(LOCALES)('%s: every key has the section 12.4 value in its own dictionary', (locale) => {
    for (const path of paths) expect(text(locale, path), `${locale}:${path}`).toBe(TABLE[path]?.[locale]);
  });

  it('gives every key its own es and ko value, never the English', () => {
    for (const locale of ['es', 'ko'] as const) for (const path of paths) expect(text(locale, path), `${locale}:${path}`).not.toBe(text('en', path));
  });

  it('keeps the name as given in every locale, with no particle attached in Korean (section 12.4)', () => {
    for (const name of ['Mina', '민아', 'Jo Ann', "D'Angelo"]) {
      for (const locale of LOCALES) {
        const line = (OWN[locale].caregiver.lecture.next as (n: string) => string)(name);
        expect(line, `${locale}: ${name}`).toContain(name);
      }
      // The name ends the Korean line: nothing (no particle) is written after it.
      expect(koOwn.caregiver.lecture.next(name).endsWith(name)).toBe(true);
    }
  });

  it('says the same as the console card and All lessons about the new tab, in every locale', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale);
      expect(m.caregiver.lecture.opensTab, locale).toBe(m.console.lecture.card.opensTab);
      expect(m.caregiver.lecture.blocked, locale).toBe(m.caregiver.browse.item.presentBlocked);
    }
  });

  it('keeps the Open button within the 28-character cta budget', () => {
    for (const locale of LOCALES) expect(getMessages(locale).caregiver.lecture.open.cta.length, locale).toBeLessThanOrEqual(28);
  });

  it('names lecture mode with the one name of LV-D2 (the console card title and the presenter home title)', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale);
      expect(m.caregiver.lecture.title, locale).toBe(m.console.lecture.card.title);
      expect(m.caregiver.lecture.title, locale).toBe(m.learner.presenter.home.title);
    }
  });

  it('passes the ban lists and the audience rule in every locale, with no Hangul in en or es', () => {
    for (const locale of LOCALES) {
      for (const path of paths) {
        const value = text(locale, path);
        expect(findBannedWord(value, locale, 'caregiver'), `${locale}: ${value}`).toBeNull();
        for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(value), `${locale}: ${pattern.name}: ${value}`).toBe(false);
        if (locale !== 'ko') expect(HANGUL.test(value), `${locale}: ${value}`).toBe(false);
      }
    }
  });

  it('holds no count and no exclamation (section 3: no badge, no count, no pressure)', () => {
    for (const locale of LOCALES) {
      for (const path of paths) expect(text(locale, path), `${locale}:${path}`).not.toMatch(/\d|!/u);
    }
  });
});
