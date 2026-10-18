import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { en as enOwn } from '../messages/en';
import { es as esOwn } from '../messages/es';
import { ko as koOwn } from '../messages/ko';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * AMENDMENTS-LECTURE-V2 row LV-4 (sections 6, 12.1, 12.2 and 12.6): the console setup page, presets first. The
 * one-name renames, the neutral intro and title hint, the family wording by space kind, the presets with the same
 * values as the presenter's (`learner.presenter.presets.*`), and Customize's chooser. Every key has the table's value
 * in en, es and ko in its own dictionary (no English fallback), nothing trips the ban lists or frames the page for
 * one age, no Hangul sits in an en or es value (F-I18N-001 section 3.4 rule 5), and the Catalogue heading the
 * chooser replaced is gone.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

const OWN = { en: enOwn, es: esOwn, ko: koOwn } as const;

function rendered(locale: UiLocale, path: string): string[] {
  const value = lookup(OWN[locale].console, path.slice('console.'.length));
  expect(value, `${locale}:${path} is in its own dictionary`).toBeDefined();
  if (typeof value === 'string') return [value];
  const rows = SAMPLES[path];
  expect(rows, `function message ${path} needs a row in SAMPLES`).toBeDefined();
  return (rows ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
}

const en = getMessages('en');
const presetPaths = leafPaths(en.console.lecture.presets).map((p) => `console.lecture.presets.${p}`);
const paths = [
  ...presetPaths,
  'console.lecture.title',
  'console.lecture.titleFor',
  'console.lecture.entry.cta',
  'console.lecture.intro',
  'console.lecture.comingSoon',
  'console.lecture.titleField.hint',
  'console.lecture.check.titleFamily',
  'console.lecture.outline.block.familyCode',
  'console.lecture.outline.block.words',
  'console.lecture.outline.addFamilyCode.cta',
  'console.lecture.copyHasFamilyCode',
];

describe('console lecture setup strings (LV-4)', () => {
  it('has the section 12.1 values in English, neutral for a class and a family', () => {
    const l = en.console.lecture;
    expect(l.title).toBe('Lecture mode');
    expect(l.entry.cta).toBe('Lecture mode');
    expect(l.titleFor('Class 2B')).toBe('Class 2B · lecture mode');
    expect(l.intro).toBe('Show a slide lesson on a projector or TV, in class or at home.');
    expect(l.comingSoon).toBe('Lecture mode is coming soon: slide lessons you can show on a projector or TV.');
    expect(l.titleField.hint).toBe("Do not put anyone's name in the title.");
    expect(l.check.titleFamily).toBe('Check the TV or screen');
    expect(l.outline.block.familyCode).toBe('Family code on the last slide');
    expect(l.outline.addFamilyCode.cta).toBe('+ Family code');
    expect(l.outline.block.words(1)).toBe('1 word');
    expect(l.outline.block.words(10)).toBe('10 words');
    expect(l.copyHasFamilyCode).toBe('This link holds your family join code. Anyone with the link can join until you make a new code. Copy it anyway?');
  });

  it('has the section 12.2 preset values, the same as the presenter where both draw them', () => {
    const p = en.console.lecture.presets;
    expect(p.next.class).toBe('Picks up where your class is.');
    expect(p.next.family).toBe('Picks up where your family is.');
    expect(p.next.plan('Week 3 letters')).toBe("From this week's plan: Week 3 letters");
    for (const locale of LOCALES) {
      const c = getMessages(locale).console.lecture.presets;
      const s = getMessages(locale).learner.presenter.presets;
      for (const key of ['title', 'lead'] as const) expect(c[key], `${locale}:${key}`).toBe(s[key]);
      expect(c.next.title).toBe(s.next.title);
      expect(c.zero).toEqual(s.zero);
      expect({ ...c.stage, chip: c.stage.chip(4) }).toEqual({ ...s.stage, chip: s.stage.chip(4) });
      expect(c.story).toEqual(s.story);
      expect(c.words).toEqual(s.words);
      expect(c.warmup).toEqual(s.warmup);
      expect([c.length.title, c.length.option(20)]).toEqual([s.length.title, s.length.option(20)]);
      expect(c.preview.title).toBe(s.preview.title);
      expect(c.customize).toEqual(s.customize);
      expect(c.fallback).toEqual(s.fallback);
      expect(c.chooser.label).toBe(s.chooser.label);
      expect(c.chooser.tab).toEqual({ lessons: s.chooser.tab.lessons, stories: s.chooser.tab.stories, words: s.chooser.tab.words });
      expect([c.chooser.lessonsIn(1), c.chooser.lessonsIn(3), c.chooser.showMore(8)]).toEqual([s.chooser.lessonsIn(1), s.chooser.lessonsIn(3), s.chooser.showMore(8)]);
    }
  });

  it('has the Spanish and Korean values of sections 12.1 and 12.2', () => {
    const es = getMessages('es').console.lecture;
    const ko = getMessages('ko').console.lecture;
    expect(es.title).toBe('Modo proyección');
    expect(es.titleFor('Clase 2B')).toBe('Clase 2B · modo proyección');
    expect(es.intro).toBe('Muestra una lección con diapositivas en un proyector o una TV, en clase o en casa.');
    expect(es.comingSoon).toBe('El modo proyección llega muy pronto: lecciones con diapositivas para mostrar en un proyector o una TV.');
    expect(es.titleField.hint).toBe('No pongas el nombre de nadie en el título.');
    expect(es.check.titleFamily).toBe('Revisa la TV o la pantalla');
    expect(es.outline.block.familyCode).toBe('Código de familia en la última diapositiva');
    expect(es.outline.addFamilyCode.cta).toBe('+ Código de familia');
    expect(es.outline.block.words(1)).toBe('1 palabra');
    expect(es.outline.block.words(20)).toBe('20 palabras');
    expect(es.presets.next.class).toBe('Sigue desde donde va tu clase.');
    expect(es.presets.next.family).toBe('Sigue desde donde va tu familia.');
    expect(es.presets.next.plan('Semana 3')).toBe('Del plan de esta semana: Semana 3');
    expect(ko.title).toBe('강의 모드');
    expect(ko.titleFor('2반')).toBe('2반 · 강의 모드');
    expect(ko.intro).toBe('프로젝터나 TV에 슬라이드 수업을 띄워요. 교실에서도, 집에서도 돼요.');
    expect(ko.comingSoon).toBe('강의 모드는 곧 열려요: 프로젝터나 TV에 보여 줄 수 있는 슬라이드 수업이에요.');
    expect(ko.titleField.hint).toBe('제목에 이름은 넣지 마세요.');
    expect(ko.check.titleFamily).toBe('TV나 화면을 확인해요');
    expect(ko.outline.block.familyCode).toBe('마지막 슬라이드에 가족 코드');
    expect(ko.outline.addFamilyCode.cta).toBe('+ 가족 코드');
    expect(ko.outline.block.words(10)).toBe('낱말 10개');
    expect(ko.copyHasFamilyCode).toBe('이 링크에는 가족 참여 코드가 들어 있어요. 새 코드를 만들 때까지 링크가 있으면 누구나 참여할 수 있어요. 그래도 복사할까요?');
    expect(ko.presets.next.class).toBe('우리 반이 배우고 있는 곳부터 이어 가요.');
    expect(ko.presets.next.family).toBe('우리 가족이 배우고 있는 곳부터 이어 가요.');
    expect(ko.presets.next.plan('3주차')).toBe('이번 주 계획: 3주차');
  });

  it('gives every key its own es and ko value, never the English', () => {
    // "{n} min" is the same word in Spanish (a unit, section 12.2).
    const same = new Set(['es:console.lecture.presets.length.option']);
    for (const locale of ['es', 'ko'] as const) {
      for (const path of paths) {
        if (same.has(`${locale}:${path}`)) continue;
        expect(rendered(locale, path), `${locale} ${path}`).not.toEqual(rendered('en', path));
      }
    }
  });

  it('keeps every button label within 28 characters', () => {
    for (const locale of LOCALES) {
      const l = getMessages(locale).console.lecture;
      for (const label of [l.entry.cta, l.presets.customize.cta, l.outline.addFamilyCode.cta, l.presets.chooser.showMore(8), l.presets.chooser.lessonsIn(6)]) {
        expect(label.length, `${locale}: ${label}`).toBeLessThanOrEqual(28);
      }
    }
  });

  it('passes the ban lists and the audience rule in every locale, with no Hangul in en or es', () => {
    for (const locale of LOCALES) {
      for (const text of paths.flatMap((p) => rendered(locale, p))) {
        expect(findBannedWord(text, locale, 'caregiver'), `${locale}: ${text}`).toBeNull();
        for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(text), `${locale}: ${pattern.name}: ${text}`).toBe(false);
        if (locale !== 'ko') expect(HANGUL.test(text), `${locale}: ${text}`).toBe(false);
      }
    }
  });

  it('names no student in the shared lines: the intro and the title hint are the same for a class and a family', () => {
    for (const locale of LOCALES) {
      const l = getMessages(locale).console.lecture;
      for (const text of [l.intro, l.titleField.hint]) expect(text, locale).not.toMatch(/student|estudiante|학생|classroom|salón|교실 화면/i);
    }
  });

  it('has no Catalogue section, no helper picker and no copy-without-names line any more', () => {
    for (const locale of LOCALES) {
      const l = OWN[locale].console.lecture as Record<string, unknown>;
      for (const gone of ['catalogue', 'picker', 'copyNoNames']) expect(l[gone], `${locale}:${gone}`).toBeUndefined();
    }
  });
});
