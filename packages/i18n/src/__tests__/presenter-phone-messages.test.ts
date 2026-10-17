import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { getMessages } from '../resolve';

/**
 * Owner report 2026-10-16 items 1 to 4 (lecture mode on phones, a way back on every screen):
 * the presenter strings row LV-M1 adds and changes, exactly as AMENDMENTS-LECTURE-V2 section 12.6
 * lists them (en, es and ko), and the ones it keeps. Every locale has its own value (none falls back
 * to English), button labels stay inside the 28-character budget (F-I18N-001 §3.11), nothing trips a
 * ban list or frames the page for one age, no English or Spanish value holds Hangul, and no value
 * has an emoji.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

type Presenter = ReturnType<typeof getMessages>['learner']['presenter'];

/** Section 12.6 "New, LV-M1" and "Changed, LV-M1", with their en / es / ko values. */
const TABLE: Record<string, { read: (p: Presenter) => string; en: string; es: string; ko: string }> = {
  'start.ready': { read: (p) => p.start.ready, en: 'Ready to start', es: 'Listo para empezar', ko: '시작할 준비가 됐어요' },
  'start.someChecks': {
    read: (p) => p.start.someChecks,
    en: 'Some checks need a look: see Details.',
    es: 'Algunas cosas necesitan revisión: mira los detalles.',
    ko: "확인할 것이 있어요. '자세히'를 눌러 봐요.",
  },
  'start.details.cta': { read: (p) => p.start.details.cta, en: 'Details', es: 'Detalles', ko: '자세히' },
  'start.turnHint': {
    read: (p) => p.start.turnHint,
    en: 'Turn your phone sideways for the lesson.',
    es: 'Gira el teléfono de lado para ver la lección.',
    ko: '휴대폰을 가로로 돌리면 수업이 보여요.',
  },
  'state.rotate.title': { read: (p) => p.state.rotate.title, en: 'Turn your phone sideways', es: 'Gira el teléfono de lado', ko: '휴대폰을 가로로 돌려요' },
  'state.rotate.line': {
    read: (p) => p.state.rotate.line,
    en: 'The lesson shows when the phone is sideways. Nothing is lost.',
    es: 'La lección se ve con el teléfono de lado. No se pierde nada.',
    ko: '휴대폰을 가로로 돌리면 수업이 보여요. 없어지는 것은 없어요.',
  },
  'bar.more.cta': { read: (p) => p.bar.more.cta, en: 'More', es: 'Más', ko: '더 보기' },
  'bar.prev.cta': { read: (p) => p.bar.prev.cta, en: 'Previous', es: 'Anterior', ko: '이전' },
  'help.phoneBar': {
    read: (p) => p.help.phoneBar,
    en: 'On a phone, tap the bottom of the slide to show the controls.',
    es: 'En un teléfono, toca la parte de abajo de la diapositiva para ver los controles.',
    ko: '휴대폰에서는 슬라이드 아래쪽을 누르면 조작 버튼이 보여요.',
  },
  'help.row.back': { read: (p) => p.help.row.back, en: 'Previous', es: 'Anterior', ko: '이전' },
};

/** Button labels (the `cta` budget, F-I18N-001 §3.11). */
const BUTTONS = new Set(['start.details.cta', 'bar.more.cta', 'bar.prev.cta']);

const presenter = (locale: UiLocale): Presenter => getMessages(locale).learner.presenter;

describe('the presenter on phones: section 12.6 strings (owner report 2026-10-16, row LV-M1)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s has the values of the section 12.6 table', (locale) => {
    for (const [path, row] of Object.entries(TABLE)) expect(row.read(presenter(locale)), `${locale} ${path}`).toBe(row[locale]);
  });

  it('the slide step reads Previous on the bars and in Help; Back stays the word for leaving', () => {
    const p = presenter('en');
    expect(p.bar.prev.cta).toBe(p.help.row.back);
    expect(getMessages('en').common.buttons.back).toBe('Back');
    expect(p.bar.prev.cta).not.toBe(getMessages('en').common.buttons.back);
  });

  it('gives every key its own es and ko value', () => {
    for (const locale of ['es', 'ko'] as const) {
      for (const [path, row] of Object.entries(TABLE)) expect(row.read(presenter(locale)), `${locale} ${path}`).not.toBe(row.read(presenter('en')));
    }
  });

  it.each(LOCALES)('%s: short buttons, no ban-list word, no age framing, Hangul only in Korean, no emoji', (locale) => {
    for (const [path, row] of Object.entries(TABLE)) {
      const value = row.read(presenter(locale));
      expect(value.trim().length, `${locale} ${path}`).toBeGreaterThan(0);
      if (BUTTONS.has(path)) expect(value.length, `${locale} ${path}`).toBeLessThanOrEqual(28);
      expect(findBannedWord(value, locale, 'learner'), `${locale} ${path}`).toBeNull();
      expect(findBannedWord(value, locale, 'caregiver'), `${locale} ${path}`).toBeNull();
      for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(value), `${locale} ${pattern.name} ${path}`).toBe(false);
      if (locale !== 'ko') expect(HANGUL.test(value), `${locale} ${path}`).toBe(false);
      expect(value).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('keeps the strings section 12.6 does not remove: the too-small page and the End slide hint', () => {
    for (const locale of LOCALES) {
      const p = presenter(locale);
      expect(p.state.tooSmall.length, locale).toBeGreaterThan(0);
      expect(p.slide.end.exitHint.length, locale).toBeGreaterThan(0);
    }
  });
});
