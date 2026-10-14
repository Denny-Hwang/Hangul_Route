import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-TCH-004 PR 8 (section 3.12; design/screens/presenter/home.md and the README
 * "Strings" table): the presenter home and the session language chips. Every
 * locale has its own value (no English fallback), nothing trips the learner or
 * caregiver ban lists, nothing frames the page for one age, no Hangul in an
 * English or Spanish message (F-I18N-001 section 3.4 rule 5), and no line asks
 * for a name.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

function rendered(locale: UiLocale, root: 'learner.presenter' | 'a11y.presenter', path: string): string[] {
  const m = getMessages(locale);
  const tree = root === 'learner.presenter' ? m.learner.presenter : m.a11y.presenter;
  const value = lookup(tree, path);
  if (typeof value === 'string') return [value];
  const rows = SAMPLES[`${root}.${path}`];
  expect(rows, `function message ${root}.${path} needs a row in SAMPLES`).toBeDefined();
  return (rows ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
}

const en = getMessages('en');
// The keys this PR adds (PR 6 owns the rest of the presenter tree, such as the `1 / 12` counter shared by every locale).
const learnerPaths = leafPaths(en.learner.presenter).filter((p) => p.startsWith('home.') || p.startsWith('language.') || p === 'start.back.cta');
const a11yPaths = leafPaths(en.a11y.presenter).filter((p) => p === 'removeRecent');

describe('learner.presenter home strings (F-TCH-004 PR 8)', () => {
  it('has the README keys with their English values', () => {
    const p = en.learner.presenter;
    expect(p.home.title).toBe('Lecture');
    expect(p.home.help.cta).toBe('Keys and help');
    expect(p.home.recent.empty).toBe('Lessons you open appear here. Names are never saved.');
    expect(p.home.quick.chosen(1)).toBe('1 chosen');
    expect(p.home.quick.chosen(3)).toBe('3 chosen');
    expect(p.home.quick.letters(1)).toBe('1 letter');
    expect(p.home.quick.letters(14)).toBe('14 letters');
    expect(p.home.quick.minutes(15)).toBe('about 15 min');
    expect(p.home.quick.full).toBe('This lesson is full. Remove one to add another.');
    expect(p.start.back.cta).toBe('Back to lessons');
    expect(p.language.title).toBe('Presenter language');
    expect(en.a11y.presenter.removeRecent('Week 3 letters')).toBe('Remove: Week 3 letters');
  });

  it('has the Spanish and Korean values of the README table', () => {
    const es = getMessages('es').learner.presenter;
    const ko = getMessages('ko').learner.presenter;
    expect(es.home.title).toBe('Proyección');
    expect(es.home.quick.chosen(1)).toBe('Elegiste 1');
    expect(es.home.quick.letters(1)).toBe('1 letra');
    expect(es.home.recent.startOver.cta).toBe('Desde el inicio');
    expect(es.start.back.cta).toBe('Volver a las lecciones');
    expect(ko.home.title).toBe('강의');
    expect(ko.home.quick.chosen(3)).toBe('3개 골랐어요');
    expect(ko.home.quick.letters(14)).toBe('글자 14개');
    expect(ko.start.back.cta).toBe('수업 목록으로');
    expect(getMessages('ko').a11y.presenter.removeRecent('Food')).toBe('지우기: Food');
  });

  it('gives every key its own es and ko value, never the English', () => {
    for (const locale of ['es', 'ko'] as const) {
      for (const path of learnerPaths) {
        if (path === 'home.quick.minutes' && locale === 'es') continue;
        expect(rendered(locale, 'learner.presenter', path), `${locale} learner.presenter.${path}`).not.toEqual(rendered('en', 'learner.presenter', path));
      }
      for (const path of a11yPaths) {
        expect(rendered(locale, 'a11y.presenter', path), `${locale} a11y.presenter.${path}`).not.toEqual(rendered('en', 'a11y.presenter', path));
      }
    }
  });

  it('passes the ban lists and the audience rule in every locale, with no Hangul in en or es', () => {
    for (const locale of LOCALES) {
      const texts = [
        ...learnerPaths.flatMap((p) => rendered(locale, 'learner.presenter', p)),
        ...a11yPaths.flatMap((p) => rendered(locale, 'a11y.presenter', p)),
      ];
      for (const text of texts) {
        expect(findBannedWord(text, locale, 'learner'), `${locale}: ${text}`).toBeNull();
        expect(findBannedWord(text, locale, 'caregiver'), `${locale}: ${text}`).toBeNull();
        for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(text), `${locale}: ${pattern.name}: ${text}`).toBe(false);
        if (locale !== 'ko') expect(HANGUL.test(text), `${locale}: ${text}`).toBe(false);
      }
    }
  });
});
