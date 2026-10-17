import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { getMessages } from '../resolve';

/**
 * Owner report 2026-10-16 items 1 to 4 (lecture mode on phones, a way back on every screen, honest
 * minutes): the presenter strings this row adds, and the ones it removes. Every locale has its own
 * value (none falls back to English), button labels stay inside the 28-character budget
 * (F-I18N-001 §3.11), nothing trips a ban list or frames the page for one age, no English or
 * Spanish value holds Hangul, and no value has an emoji.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

type Presenter = ReturnType<typeof getMessages>['learner']['presenter'];

const NEW: Record<string, (p: Presenter) => string> = {
  'state.rotatePhone': (p) => p.state.rotatePhone,
  'state.rotateLock': (p) => p.state.rotateLock,
  'state.tooSmallWindow': (p) => p.state.tooSmallWindow,
  'home.back.cta': (p) => p.home.back.cta,
  'start.ready': (p) => p.start.ready,
  'start.details': (p) => p.start.details,
  'start.turnSideways': (p) => p.start.turnSideways,
  'start.minutesUnder1': (p) => p.start.minutesUnder1,
  'bar.more': (p) => p.bar.more,
  'slide.end.finish.cta': (p) => p.slide.end.finish.cta,
  'help.touch.title': (p) => p.help.touch.title,
  'help.touch.tap': (p) => p.help.touch.tap,
  'help.touch.swipe': (p) => p.help.touch.swipe,
  'help.touch.bar': (p) => p.help.touch.bar,
};

/** Button labels (the `cta` budget, F-I18N-001 §3.11). */
const BUTTONS = new Set(['home.back.cta', 'start.details', 'bar.more', 'slide.end.finish.cta']);

const presenter = (locale: UiLocale): Presenter => getMessages(locale).learner.presenter;

describe('the presenter on phones: new strings (owner report 2026-10-16)', () => {
  it('has the English values the spec row names', () => {
    const p = presenter('en');
    expect(p.state.tooSmallWindow).toBe('Make the window bigger.');
    expect(p.start.turnSideways).toBe('Turn your phone sideways when you start.');
    expect(p.start.ready).toBe('Ready to start');
    expect(p.help.touch.title).toBe('How to use');
    expect(p.slide.end.finish.cta).toBe('Finish');
    expect(p.start.minutesUnder1).toBe('under 1 minute');
    // The desktop page gives no turn-the-screen advice; the phone page does.
    expect(p.state.tooSmallWindow).not.toMatch(/turn|rotate/i);
    expect(p.state.rotatePhone).toMatch(/sideways/i);
  });

  it('gives every new key its own es and ko value', () => {
    for (const locale of ['es', 'ko'] as const) {
      for (const [path, read] of Object.entries(NEW)) {
        expect(read(presenter(locale)), `${locale} ${path}`).not.toBe(read(presenter('en')));
      }
    }
  });

  it.each(LOCALES)('%s: short buttons, no ban-list word, no age framing, Hangul only in Korean, no emoji', (locale) => {
    for (const [path, read] of Object.entries(NEW)) {
      const value = read(presenter(locale));
      expect(value.trim().length, `${locale} ${path}`).toBeGreaterThan(0);
      if (BUTTONS.has(path)) expect(value.length, `${locale} ${path}`).toBeLessThanOrEqual(28);
      expect(findBannedWord(value, locale, 'learner'), `${locale} ${path}`).toBeNull();
      expect(findBannedWord(value, locale, 'caregiver'), `${locale} ${path}`).toBeNull();
      for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(value), `${locale} ${pattern.name} ${path}`).toBe(false);
      if (locale !== 'ko') expect(HANGUL.test(value), `${locale} ${path}`).toBe(false);
      expect(value).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('the strings the row replaces or removes are gone in every locale', () => {
    for (const locale of LOCALES) {
      const p = presenter(locale);
      expect((p.state as Record<string, unknown>).tooSmall, locale).toBeUndefined();
      expect((p.slide.end as Record<string, unknown>).exitHint, locale).toBeUndefined();
    }
  });
});
