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
 * AMENDMENTS-LECTURE-V2 row LV-5 (sections 3 and 12.1; design/screens/app-shell/lecture-card.md): the Lecture mode
 * nav item and the card on the teacher and family homes. Every key holds the section 12.1 value in en, es and ko in
 * its own dictionary (no English fallback), es and ko never repeat the English, nothing trips the ban lists or frames
 * the card for one age, no Hangul sits in an en or es value (F-I18N-001 section 3.4 rule 5), and no value holds a
 * count or an exclamation.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

const OWN = { en: enOwn, es: esOwn, ko: koOwn } as const;

const cardPaths = leafPaths(enOwn.console.lecture.card).map((path) => `lecture.card.${path}`);
const paths = ['shell.nav.lecture', ...cardPaths];

function own(locale: UiLocale, path: string): string {
  const value = lookup(OWN[locale].console, path);
  expect(value, `${locale}:console.${path} is in its own dictionary`).toBeTypeOf('string');
  return value as string;
}

/** Section 12.1, verbatim. */
const TABLE: Record<string, Record<UiLocale, string>> = {
  'shell.nav.lecture': { en: 'Lecture mode', es: 'Modo proyección', ko: '강의 모드' },
  'lecture.card.title': { en: 'Lecture mode', es: 'Modo proyección', ko: '강의 모드' },
  'lecture.card.tagline': { en: 'Teach on a big screen', es: 'Enseña en una pantalla grande', ko: '큰 화면으로 가르쳐요' },
  'lecture.card.bodyClass': {
    en: "Show a ready lesson on a projector or TV: big letters, sounds and a few questions. Nobody's progress changes.",
    es: 'Muestra una lección lista en un proyector o una TV: letras grandes, sonidos y algunas preguntas. No cambia el progreso de nadie.',
    ko: '준비된 수업을 프로젝터나 TV에 띄워요. 큰 글자와 소리, 질문 몇 개가 나와요. 누구의 진도도 바뀌지 않아요.',
  },
  'lecture.card.bodyFamily': {
    en: "Put a lesson on your TV and learn together at home. No setup needed, and nobody's progress changes.",
    es: 'Pon una lección en tu TV y aprende en familia, en casa. No hace falta preparar nada y no cambia el progreso de nadie.',
    ko: 'TV에 수업을 띄우고 집에서 함께 배워요. 따로 준비할 것이 없고, 누구의 진도도 바뀌지 않아요.',
  },
  'lecture.card.cta': { en: 'Start lecture mode', es: 'Empezar modo proyección', ko: '강의 모드 시작' },
  'lecture.card.chooseClass': { en: 'Which class?', es: '¿Qué clase?', ko: '어느 반인가요?' },
  'lecture.card.chooseFamily': { en: 'Which family?', es: '¿Qué familia?', ko: '어느 가족인가요?' },
  'lecture.card.noSpace': { en: 'No class needed: you can still show a lesson.', es: 'No hace falta una clase: aun así puedes mostrar una lección.', ko: '반이 없어도 수업을 띄울 수 있어요.' },
  'lecture.card.noSpaceFamily': { en: 'You can show a lesson without a family space.', es: 'Puedes mostrar una lección sin un espacio familiar.', ko: '가족 공간이 없어도 수업을 띄울 수 있어요.' },
  'lecture.card.opensTab': { en: 'Opens in a new tab', es: 'Se abre en una pestaña nueva', ko: '새 탭에서 열려요' },
};

describe('console lecture entry strings (LV-5)', () => {
  it('lists every card key of section 12.1 and nothing else', () => {
    expect([...paths].sort()).toEqual(Object.keys(TABLE).sort());
  });

  it.each(LOCALES)('%s: every key has the section 12.1 value in its own dictionary', (locale) => {
    for (const path of paths) expect(own(locale, path), `${locale}:${path}`).toBe(TABLE[path]?.[locale]);
  });

  it('gives every key its own es and ko value, never the English', () => {
    for (const locale of ['es', 'ko'] as const) for (const path of paths) expect(own(locale, path), `${locale}:${path}`).not.toBe(own('en', path));
  });

  it('keeps the nav label short and the Start button within 28 characters', () => {
    for (const locale of LOCALES) {
      const c = getMessages(locale).console;
      expect(c.shell.nav.lecture.length, locale).toBeLessThanOrEqual(16);
      expect(c.lecture.card.cta.length, locale).toBeLessThanOrEqual(28);
    }
  });

  it('passes the ban lists and the audience rule in every locale, with no Hangul in en or es', () => {
    for (const locale of LOCALES) {
      for (const path of paths) {
        const text = own(locale, path);
        expect(findBannedWord(text, locale, 'caregiver'), `${locale}: ${text}`).toBeNull();
        for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(text), `${locale}: ${pattern.name}: ${text}`).toBe(false);
        if (locale !== 'ko') expect(HANGUL.test(text), `${locale}: ${text}`).toBe(false);
      }
    }
  });

  it('holds no count and no exclamation (section 3: no badge, no count, no pressure)', () => {
    for (const locale of LOCALES) {
      for (const path of paths) expect(own(locale, path), `${locale}:${path}`).not.toMatch(/\d|!/u);
    }
  });
});
