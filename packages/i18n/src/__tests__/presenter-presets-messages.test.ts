import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * AMENDMENTS-LECTURE-V2 row LV-3 (sections 12.2, 12.3 and 12.6): the presenter's ready-made lessons,
 * the preview, Customize's grouped chooser, the one-name title, the neutral End slide code title and
 * the invalid-link page that no longer names Quick lesson. Every key has the table's value in en, es
 * and ko (no English fallback), every button label fits the 28-character budget, nothing trips the
 * ban lists or frames the page for one age, and no Hangul sits in an en or es value (F-I18N-001
 * section 3.4 rule 5).
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

function rendered(locale: UiLocale, path: string): string[] {
  const m = getMessages(locale);
  const [root, ...rest] = path.split('.');
  const tree = root === 'a11y' ? m.a11y : m.learner;
  const value = lookup(tree, rest.join('.'));
  if (typeof value === 'string') return [value];
  const rows = SAMPLES[path];
  expect(rows, `function message ${path} needs a row in SAMPLES`).toBeDefined();
  return (rows ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
}

const en = getMessages('en');
const presetPaths = leafPaths(en.learner.presenter.presets).map((p) => `learner.presenter.presets.${p}`);
const paths = [
  ...presetPaths,
  'learner.presenter.home.title',
  'learner.presenter.docTitle',
  'learner.presenter.slide.end.codeTitle',
  'learner.presenter.state.invalid.line',
  'learner.presenter.state.invalid.cta',
  'a11y.presenter.presetCard',
  'a11y.presenter.chooserRemove',
];

describe('presenter presets strings (LV-3)', () => {
  it('has the section 12.2 values in English', () => {
    const p = en.learner.presenter.presets;
    expect(p.title).toBe('Ready-made lessons');
    expect(p.lead).toBe('Pick a ready lesson. You can look at it before you start.');
    expect(p.next.title).toBe('Next lesson');
    expect(p.next.device).toBe('Picks up after the last lesson shown on this screen.');
    expect(p.zero.title).toBe('Start from zero: Hangul week 1');
    expect(p.zero.short).toBe('Hangul week 1');
    expect(p.stage.chip(3)).toBe('Stage 3');
    expect(p.story.title).toBe('Story time');
    expect(p.words.title).toBe('Word review');
    expect(p.warmup.title).toBe('Quick 10-minute warm-up');
    expect(p.warmup.short).toBe('Quick warm-up');
    expect(p.length.title).toBe('How long?');
    expect(p.length.option(20)).toBe('20 min');
    expect(p.preview.title).toBe("What's in this lesson");
    expect(p.preview.quiz(1)).toBe('Quick quiz: 1 question');
    expect(p.preview.quiz(4)).toBe('Quick quiz: 4 questions');
    expect(p.preview.words(10)).toBe('10 words');
    expect(p.customize.cta).toBe('Customize');
    expect(p.fallback.zero).toBe('Nothing to follow yet, so this starts with Hangul week 1.');
    expect(p.fallback.warmUp).toBe('No words this week yet, so this is the warm-up instead.');
    expect(p.fallback.restart).toBe('Every story was shown here, so this starts again from the first.');
    expect(p.chooser.tab).toEqual({ lessons: 'Lessons', stories: 'Stories', words: 'Word topics', letters: 'Letters' });
    expect(p.chooser.lessonsIn(1)).toBe('1 lesson inside');
    expect(p.chooser.lessonsIn(6)).toBe('6 lessons inside');
    expect(p.chooser.showMore(8)).toBe('Show 8 more');
    expect(p.chooser.tray.title).toBe('Your lesson');
    expect(p.chooser.summary(1, 4)).toBe('1 part · about 4 min');
    expect(p.chooser.summary(3, 33)).toBe('3 parts · about 33 min');
    expect(en.a11y.presenter.presetCard('Story time', 20)).toBe('Story time, about 20 minutes');
    expect(en.a11y.presenter.chooserRemove('Word Builder')).toBe('Remove Word Builder');
    expect(en.learner.presenter.slide.end.codeTitle).toBe('Join with this code');
    expect(en.learner.presenter.state.invalid.line).toBe('Choose a lesson here, or get a new link from the setup page.');
    expect(en.learner.presenter.state.invalid.cta).toBe('Choose a lesson');
  });

  it('has the Spanish and Korean values of sections 12.2, 12.3 and 12.6', () => {
    const es = getMessages('es');
    const ko = getMessages('ko');
    expect(es.learner.presenter.presets.title).toBe('Lecciones listas');
    expect(es.learner.presenter.presets.zero.short).toBe('Semana 1 de hangul');
    expect(es.learner.presenter.presets.stage.chip(2)).toBe('Etapa 2');
    expect(es.learner.presenter.presets.warmup.title).toBe('Calentamiento rápido de 10 minutos');
    expect(es.learner.presenter.presets.chooser.tab.words).toBe('Temas de palabras');
    expect(es.learner.presenter.presets.chooser.summary(1, 4)).toBe('1 parte · unos 4 min');
    expect(es.learner.presenter.presets.chooser.summary(3, 33)).toBe('3 partes · unos 33 min');
    expect(es.learner.presenter.presets.preview.quiz(4)).toBe('Quiz rápido: 4 preguntas');
    expect(es.a11y.presenter.presetCard('Hora del cuento', 20)).toBe('Hora del cuento, unos 20 minutos');
    expect(es.a11y.presenter.chooserRemove('Lecciones')).toBe('Quitar Lecciones');
    expect(es.learner.presenter.slide.end.codeTitle).toBe('Únete con este código');
    expect(es.learner.presenter.state.invalid.cta).toBe('Elegir una lección');
    expect(ko.learner.presenter.presets.title).toBe('준비된 수업');
    expect(ko.learner.presenter.presets.zero.title).toBe('처음부터: 한글 1주차');
    expect(ko.learner.presenter.presets.stage.chip(3)).toBe('3단계');
    expect(ko.learner.presenter.presets.length.option(10)).toBe('10분');
    expect(ko.learner.presenter.presets.customize.cta).toBe('직접 고르기');
    expect(ko.learner.presenter.presets.chooser.lessonsIn(3)).toBe('안에 든 수업 3개');
    expect(ko.learner.presenter.presets.chooser.summary(3, 33)).toBe('3개 · 약 33분');
    expect(ko.a11y.presenter.presetCard('이야기 시간', 20)).toBe('이야기 시간, 약 20분');
    expect(ko.a11y.presenter.chooserRemove('내 수업')).toBe('빼기: 내 수업');
    expect(ko.learner.presenter.slide.end.codeTitle).toBe('이 코드로 들어와요');
    expect(ko.learner.presenter.state.invalid.line).toBe('여기에서 수업을 고르거나 준비 페이지에서 새 링크를 받아요.');
  });

  it('gives every key its own es and ko value, never the English', () => {
    // "{n} min" is the same word in Spanish (a unit, section 12.2).
    const same = new Set(['es:learner.presenter.presets.length.option']);
    for (const locale of ['es', 'ko'] as const) {
      for (const path of paths) {
        if (same.has(`${locale}:${path}`)) continue;
        expect(rendered(locale, path), `${locale} ${path}`).not.toEqual(rendered('en', path));
      }
    }
  });

  it('keeps every button label within 28 characters', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).learner.presenter;
      for (const label of [m.presets.start.cta, m.presets.customize.cta, m.state.invalid.cta, m.home.quick.build.cta, m.presets.chooser.showMore(8)]) {
        expect(label.length, `${locale}: ${label}`).toBeLessThanOrEqual(28);
      }
    }
  });

  it('passes the ban lists and the audience rule in every locale, with no Hangul in en or es', () => {
    for (const locale of LOCALES) {
      for (const text of paths.flatMap((p) => rendered(locale, p))) {
        expect(findBannedWord(text, locale, 'learner'), `${locale}: ${text}`).toBeNull();
        expect(findBannedWord(text, locale, 'caregiver'), `${locale}: ${text}`).toBeNull();
        for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(text), `${locale}: ${pattern.name}: ${text}`).toBe(false);
        if (locale !== 'ko') expect(HANGUL.test(text), `${locale}: ${text}`).toBe(false);
      }
    }
  });

  it('draws no presenter language of its own and no Quick lesson heading (Display (Aa) and Customize replace them)', () => {
    for (const locale of LOCALES) {
      const p = getMessages(locale).learner.presenter;
      expect('language' in p).toBe(false);
      expect('title' in p.home.quick).toBe(false);
    }
  });
});
