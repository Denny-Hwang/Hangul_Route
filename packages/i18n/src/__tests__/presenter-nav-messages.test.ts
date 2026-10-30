import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { getMessages } from '../resolve';

/**
 * AMENDMENTS-PRESENTER-NAV section 13, row PN-3: Help's Touch and mouse group and the start hint, exactly as
 * the table gives them in en, es and ko (es: neutral Latin-American, tú, "mouse"; ko: 해요체, the glossary's
 * 이전 and 다음). Every locale has its own value, nothing trips a ban list or frames the page for one age,
 * Hangul appears only in Korean, and no value has an emoji. The hint lines' width at 568 x 320 is held in
 * `length-budget.test.ts`.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

type Presenter = ReturnType<typeof getMessages>['learner']['presenter'];

const TABLE: Record<string, { read: (p: Presenter) => string; en: string; es: string; ko: string }> = {
  'help.touch.title': { read: (p) => p.help.touch.title, en: 'Touch and mouse', es: 'Pantalla táctil y mouse', ko: '터치와 마우스' },
  'help.touch.swipe': {
    read: (p) => p.help.touch.swipe,
    en: 'Swipe left to go on, right to go back.',
    es: 'Desliza a la izquierda para avanzar y a la derecha para volver.',
    ko: '왼쪽으로 밀면 다음으로, 오른쪽으로 밀면 이전으로 가요.',
  },
  'help.touch.buttons': { read: (p) => p.help.touch.buttons, en: 'Or tap Previous and Next.', es: 'O toca Anterior y Siguiente.', ko: '이전, 다음 버튼을 눌러도 돼요.' },
  'help.touch.click': {
    read: (p) => p.help.touch.click,
    en: 'With a mouse, click the slide to go on (not on question slides).',
    es: 'Con el mouse, haz clic en la diapositiva para avanzar (no en las preguntas).',
    ko: '마우스로 슬라이드를 클릭하면 다음으로 가요. 문제 슬라이드에서는 안 돼요.',
  },
  'help.touch.keep': {
    read: (p) => p.help.touch.keep,
    en: 'Keep controls visible shows every button all the time.',
    es: 'Con «Dejar los controles a la vista» activado, todos los botones se ven siempre.',
    ko: "'조작 버튼 계속 보이기'를 켜면 모든 버튼이 계속 보여요.",
  },
  'nav.hint': { read: (p) => p.nav.hint, en: 'Swipe, or tap Previous and Next.', es: 'Desliza o toca Anterior y Siguiente.', ko: '화면을 밀거나 이전, 다음 버튼을 눌러요.' },
  'nav.hintOverlay': {
    read: (p) => p.nav.hintOverlay,
    en: 'Swipe to move. Tap the slide to show the controls.',
    es: 'Desliza para avanzar o volver. Toca la diapositiva para ver los controles.',
    ko: '화면을 밀어서 넘겨요. 슬라이드를 누르면 조작 버튼이 보여요.',
  },
};

const presenter = (locale: UiLocale): Presenter => getMessages(locale).learner.presenter;

describe('presenter navigation: section 13 strings of row PN-3', () => {
  it.each(['en', 'es', 'ko'] as const)('%s has the values of the section 13 table', (locale) => {
    for (const [path, row] of Object.entries(TABLE)) expect(row.read(presenter(locale)), `${locale} ${path}`).toBe(row[locale]);
  });

  it('gives every key its own es and ko value', () => {
    for (const locale of ['es', 'ko'] as const) {
      for (const [path, row] of Object.entries(TABLE)) expect(row.read(presenter(locale)), `${locale} ${path}`).not.toBe(row.read(presenter('en')));
    }
  });

  it('names the buttons and the switch by their shipped labels (Previous, Next, Keep controls visible)', () => {
    for (const locale of LOCALES) {
      const all = getMessages(locale);
      const p = all.learner.presenter;
      const next = all.common.buttons.next;
      for (const line of [p.help.touch.buttons, p.nav.hint]) {
        expect(line, locale).toContain(p.bar.prev.cta);
        expect(line, locale).toContain(next);
      }
      expect(p.help.touch.keep, locale).toContain(p.help.keepVisible);
    }
  });

  it.each(LOCALES)('%s: no ban-list word, no age framing, Hangul only in Korean, no emoji', (locale) => {
    for (const [path, row] of Object.entries(TABLE)) {
      const value = row.read(presenter(locale));
      expect(value.trim().length, `${locale} ${path}`).toBeGreaterThan(0);
      expect(findBannedWord(value, locale, 'learner'), `${locale} ${path}`).toBeNull();
      expect(findBannedWord(value, locale, 'caregiver'), `${locale} ${path}`).toBeNull();
      for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(value), `${locale} ${pattern.name} ${path}`).toBe(false);
      if (locale !== 'ko') expect(HANGUL.test(value), `${locale} ${path}`).toBe(false);
      expect(value).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
