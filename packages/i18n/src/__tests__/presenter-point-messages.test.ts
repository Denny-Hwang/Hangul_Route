import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { getMessages } from '../resolve';

/**
 * Pointing at an option in lecture mode (AMENDMENTS-PRESENTER-NAV section 7.3, owner choice O2, row
 * PN-5): the four strings section 13 lists for the row, exactly, in en, es and ko. Every locale has
 * its own value (none falls back to English), the Help row label stays inside the 28-character
 * button budget (F-I18N-001 §3.11), nothing trips a ban list or frames the page for one age, no
 * English or Spanish value holds Hangul, no value has an emoji, and no line says a pick was wrong.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

type Messages = ReturnType<typeof getMessages>;

const TABLE: Record<string, { read: (m: Messages) => string; en: string; es: string; ko: string }> = {
  'learner.presenter.help.touch.point': {
    read: (m) => m.learner.presenter.help.touch.point,
    en: 'Tap an answer to point at it. It does not show the answer.',
    es: 'Toca una opción para señalarla. No muestra la respuesta.',
    ko: '선택지를 누르면 표시만 돼요. 정답은 보여 주지 않아요.',
  },
  'learner.presenter.help.row.point': {
    read: (m) => m.learner.presenter.help.row.point,
    en: 'Point at an answer',
    es: 'Señalar una opción',
    ko: '선택지 표시하기',
  },
  'a11y.presenter.pointed(3)': {
    read: (m) => m.a11y.presenter.pointed(3),
    en: 'Option 3 pointed at',
    es: 'Opción 3 señalada',
    ko: '3번 선택지를 표시했어요',
  },
  'a11y.presenter.unpointed': {
    read: (m) => m.a11y.presenter.unpointed,
    en: 'No option pointed at',
    es: 'Ninguna opción señalada',
    ko: '표시한 선택지가 없어요',
  },
};

/** Short labels (the `cta` budget, F-I18N-001 §3.11): a Help row beside its key caps. */
const SHORT = new Set(['learner.presenter.help.row.point']);

/** Words that would read a pick as wrong (CLAUDE.md §1 anti-shame). */
const JUDGING: Record<UiLocale, RegExp> = {
  en: /\b(wrong|incorrect|mistake|fail)/i,
  es: /\b(incorrect|equivocad|error|mal\b|fall)/i,
  ko: /틀|오답|실패/,
};

const messages = (locale: UiLocale): Messages => getMessages(locale);

describe('pointing at an option: section 13 strings (row PN-5)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s has the values of the section 13 table', (locale) => {
    for (const [path, row] of Object.entries(TABLE)) expect(row.read(messages(locale)), `${locale} ${path}`).toBe(row[locale]);
  });

  it('gives every key its own es and ko value', () => {
    for (const locale of ['es', 'ko'] as const) {
      for (const [path, row] of Object.entries(TABLE)) expect(row.read(messages(locale)), `${locale} ${path}`).not.toBe(row.read(messages('en')));
    }
  });

  it.each(LOCALES)('%s: the option number is in the announcement, for every option 1 to 4', (locale) => {
    for (const n of [1, 2, 3, 4]) expect(messages(locale).a11y.presenter.pointed(n), `${locale} ${n}`).toContain(String(n));
  });

  it.each(LOCALES)('%s: short labels, no ban-list word, no age framing, nothing that judges, Hangul only in Korean, no emoji', (locale) => {
    for (const [path, row] of Object.entries(TABLE)) {
      const value = row.read(messages(locale));
      expect(value.trim().length, `${locale} ${path}`).toBeGreaterThan(0);
      if (SHORT.has(path)) expect(value.length, `${locale} ${path}`).toBeLessThanOrEqual(28);
      expect(findBannedWord(value, locale, 'learner'), `${locale} ${path}`).toBeNull();
      expect(findBannedWord(value, locale, 'caregiver'), `${locale} ${path}`).toBeNull();
      for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(value), `${locale} ${pattern.name} ${path}`).toBe(false);
      expect(JUDGING[locale].test(value), `${locale} ${path}`).toBe(false);
      if (locale !== 'ko') expect(HANGUL.test(value), `${locale} ${path}`).toBe(false);
      expect(value).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
