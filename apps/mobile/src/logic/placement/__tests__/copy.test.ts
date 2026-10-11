import { getMessages, LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  AGE_WORDS,
  PLACEMENT_DIGIT_ALLOW_LIST,
  SUCCESS_WORDS,
  bandLabel,
  cheerLine,
  copyProblems,
  modeTileCopy,
  placementCopyEntries,
  stripCopyProblems,
} from '../copy';

const en = getMessages('en');

describe('placement copy scan (F-PLC-001 section 3.12)', () => {
  for (const locale of LOCALES) {
    it(`${locale}: every learner.placement string passes the scan`, () => {
      const m = getMessages(locale);
      expect(placementCopyEntries(m).length).toBeGreaterThan(60);
      expect(copyProblems(m, locale)).toEqual([]);
    });
  }

  it('walks arrays and nested objects, with dotted paths', () => {
    const paths = placementCopyEntries(en).map(([path]) => path);
    expect(paths).toContain('learner.placement.options.mode.short.label');
    expect(paths.filter((p) => p === 'learner.placement.cheerShort')).toHaveLength(3);
  });

  it('only the two duration lines may hold a digit; the invite duration has none', () => {
    expect([...PLACEMENT_DIGIT_ALLOW_LIST]).toEqual([
      'learner.placement.options.mode.standard.duration',
      'learner.placement.options.mode.deep.duration',
    ]);
    expect(en.learner.placement.invite.duration).not.toMatch(/\d/);
    expect(en.learner.placement.options.mode.standard.duration).toMatch(/10/);
  });

  it('flags each kind of problem', () => {
    const bad = (path: string, text: string) => copyProblems(en, 'en', [[path, text]]);
    expect(bad('learner.placement.x', 'You failed')).toEqual(['learner.placement.x: banned word failed']);
    expect(bad('learner.placement.x', 'You missed one')).toEqual(['learner.placement.x: banned word missed']);
    expect(bad('learner.placement.x', '50%')[0]).toMatch(/percent/);
    expect(bad('learner.placement.x', 'Two / three')).toEqual(['learner.placement.x: ratio']);
    expect(bad('learner.placement.x', 'Level three')).toEqual([]);
    expect(bad('learner.placement.x', 'Level 3')).toEqual(['learner.placement.x: digit']);
    expect(bad('learner.placement.x', 'A short test')).toEqual(['learner.placement.x: the word test']);
    expect(bad('learner.placement.x', '한글')).toEqual(['learner.placement.x: Hangul']);
    expect(copyProblems(en, 'ko', [['learner.placement.x', '한글']])).toEqual([]);
    expect(bad('learner.placement.options.mode.short.help', 'Made for kids')).toEqual([
      'learner.placement.options.mode.short.help: age word',
    ]);
    expect(bad('learner.placement.cheerShort', 'That is right!')).toEqual(['learner.placement.cheerShort: success word']);
    expect(bad('learner.placement.handoff.helper', 'Got it!')).toEqual([]);
  });

  it('the word lists cover the spec', () => {
    for (const w of ['kids', 'age', 'young']) expect(AGE_WORDS.test(`a ${w} b`)).toBe(true);
    for (const w of ['right', 'correct', 'got it', 'perfect', 'great job']) expect(SUCCESS_WORDS.test(`so ${w}!`)).toBe(true);
  });

  it('the result strip strings carry no percent, ratio, Premium or speaking words', () => {
    expect(stripCopyProblems(en)).toEqual([]);
    expect(stripCopyProblems(en, ['Say it out loud'])).toEqual(['Say it out loud: speaking word']);
    expect(stripCopyProblems(en, ['Go Premium'])).toEqual(['Go Premium: Premium']);
    expect(stripCopyProblems(en, ['2 / 4 weeks'])).toEqual(['2 / 4 weeks: ratio']);
    expect(stripCopyProblems(en, ['40%'])).toEqual(['40%: percent']);
  });
});

describe('cheerLine', () => {
  it('Standard and Deep cheer every third answer, rotating', () => {
    expect(cheerLine(en, 'standard', 1)).toBeNull();
    expect(cheerLine(en, 'standard', 3)).toBe(en.learner.placement.cheer[0]);
    expect(cheerLine(en, 'deep', 6)).toBe(en.learner.placement.cheer[1]);
    expect(cheerLine(en, 'standard', 12)).toBe(en.learner.placement.cheer[0]);
  });

  it('Short cheers every second answer from the effort-only list', () => {
    expect(cheerLine(en, 'short', 0)).toBeNull();
    expect(cheerLine(en, 'short', 1)).toBeNull();
    expect(cheerLine(en, 'short', 2)).toBe(en.learner.placement.cheerShort[0]);
    expect(cheerLine(en, 'short', 4)).toBe(en.learner.placement.cheerShort[1]);
  });
});

describe('bandLabel (the only words about level)', () => {
  it('maps every row of the level table', () => {
    const b = en.learner.placement.band;
    expect(bandLabel(en, { stage: 'stage1', band: 0 })).toBe(b.beginning);
    expect(bandLabel(en, { stage: 'stage1', band: 1 })).toBe(b.lettersAndSounds);
    expect(bandLabel(en, { stage: 'stage1', band: 2 })).toBe(b.everyLetter);
    expect(bandLabel(en, { stage: 'stage1', band: 3 })).toBe(b.readingWords);
    expect(bandLabel(en, { stage: 'stage2', band: 0 })).toBe(b.firstWords);
    expect(bandLabel(en, { stage: 'stage3', band: 0 })).toBe(b.firstSentences);
    expect(bandLabel(en, { stage: 'stage5', band: 0 })).toBe(b.firstSentences);
  });
});

describe('modeTileCopy', () => {
  it('gives label, help and duration; the duration hides with Take my time', () => {
    expect(modeTileCopy(en, 'deep', false)).toEqual({
      label: 'Deep',
      help: en.learner.placement.options.mode.deep.help,
      duration: 'Usually under 20 minutes.',
    });
    expect(modeTileCopy(en, 'standard', true).duration).toBeNull();
    expect(modeTileCopy(en, 'short', false).duration).toBe('Just a few minutes.');
  });
});
