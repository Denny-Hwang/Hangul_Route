import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';

/**
 * The theme word under each Journey cell's glyph and each column label (owner request 2026-10-14;
 * design/components/Icon/theme-glyphs.md "Cell word"). The word is drawn at `typography.size.caption`
 * in a cell about 54 dp wide at 320 px, on one line and never clipped, so each locale's word is one
 * short word inside a width budget. The e2e spec `journey-theme-glyphs` measures the drawn width
 * in the browser (en on every run, es and ko on a build that shows every language).
 */

const THEME_KEYS = ['letters', 'life', 'rites', 'nature', 'crafts'] as const;

/**
 * The width budget for one line of a 320 px cell: 50 dp inside its 2 dp border, at `typography.size.caption`
 * (14). Latin words are measured with the Helvetica advance widths (AFM, units of 1/1000 em; accents take their
 * base letter's width) and no tracking, which reads a little wider than the drawn word ("Comida" estimates
 * 48.2 dp and draws 47, "Holidays" 53.7 and 52, "Naturaleza" 67.7 and 66), so a word that passes here fits;
 * a letter outside the table counts as the widest (W). A Hangul syllable is one em. The e2e spec
 * `journey-theme-glyphs` then measures the drawn word in the browser. Both numbers are pinned to the tokens
 * by apps/mobile/src/logic/__tests__/journey-cell-layout.test.ts, so a token change fails there.
 */
const CAPTION = 14;
const CELL_INNER = 50;
const HANGUL = /[가-힣]/;
const AFM: Record<string, number> = {
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
};
const WIDEST = 944;

/** The estimated drawn width of `word` in dp at the caption size. */
function estimateWidth(word: string): number {
  let em = 0;
  for (const ch of word) {
    if (HANGUL.test(ch)) em += 1000;
    else em += AFM[ch.normalize('NFD')[0] ?? ''] ?? WIDEST;
  }
  return (em / 1000) * CAPTION;
}

describe('learner.journey.themeWord (the Journey cell word)', () => {
  it.each(LOCALES)('%s has one word for every theme', (locale) => {
    const words = getMessages(locale).learner.journey.themeWord;
    expect(Object.keys(words).sort()).toEqual([...THEME_KEYS].sort());
    for (const key of THEME_KEYS) {
      const word = words[key];
      expect(word, `${locale} ${key}`).toBe(word.trim());
      expect(word, `${locale} ${key}`).not.toMatch(/\s/);
      expect(word.length, `${locale} ${key}`).toBeGreaterThan(0);
    }
  });

  it.each(LOCALES)('%s keeps every word inside the one-line cell budget (estimated width, not letter count)', (locale) => {
    const words = getMessages(locale).learner.journey.themeWord;
    for (const key of THEME_KEYS) {
      const word = words[key];
      expect(estimateWidth(word), `${locale} ${key} "${word}"`).toBeLessThanOrEqual(CELL_INNER);
    }
  });

  it('the width estimate reads wide letters as wide: the long forms that do not fit are refused', () => {
    // Seven letters each, but "Mammoth" is far wider than "Holiday"; a letter count could not tell them apart.
    expect(estimateWidth('Holiday')).toBeLessThanOrEqual(CELL_INNER);
    expect(estimateWidth('Mammoth')).toBeGreaterThan(CELL_INNER);
    expect(estimateWidth('Holidays')).toBeGreaterThan(CELL_INNER);
    expect(estimateWidth('Naturaleza')).toBeGreaterThan(CELL_INNER);
    expect(estimateWidth('명절')).toBe(28);
    expect(estimateWidth('자연이야기')).toBeGreaterThan(CELL_INNER);
    expect(estimateWidth('Lección')).toBe(estimateWidth('Leccion'));
    expect(estimateWidth('Ω')).toBe((WIDEST / 1000) * CAPTION);
  });

  it.each(LOCALES)('%s gives the five themes five different words', (locale) => {
    const words = Object.values(getMessages(locale).learner.journey.themeWord);
    expect(new Set(words).size).toBe(THEME_KEYS.length);
  });

  it('English names the theme by the first word of its title, in short form; Korean uses the glossary theme names', () => {
    expect(getMessages('en').learner.journey.themeWord).toEqual({ letters: 'Letters', life: 'Food', rites: 'Holiday', nature: 'Nature', crafts: 'Play' });
    // The Korean words are the first word of the weekly plan's theme names (learner.weeklyPlan.setup.likes.themeNames).
    const ko = getMessages('ko').learner;
    const names = ko.weeklyPlan.setup.likes.themeNames;
    for (const key of THEME_KEYS) expect(names[key].startsWith(ko.journey.themeWord[key]), key).toBe(true);
  });

  it.each(LOCALES)('%s words carry no Hangul outside Korean and no banned word', (locale) => {
    for (const word of Object.values(getMessages(locale).learner.journey.themeWord)) {
      if (locale !== 'ko') expect(word).not.toMatch(HANGUL);
      expect(findBannedWord(word, locale, 'learner')).toBeNull();
    }
  });
});
