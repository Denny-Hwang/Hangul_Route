import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';

/**
 * The theme word under each Journey cell's glyph and each column label (owner request 2026-10-14;
 * design/components/Icon/theme-glyphs.md "Cell word"). The word is drawn at `typography.size.caption`
 * in a cell about 54 dp wide at 320 px, on one line and never clipped, so each locale's word is one
 * short word inside a character budget. The e2e spec `journey-theme-glyphs` measures the drawn width
 * in the browser (en on every run, es and ko on a build that shows every language).
 */

const THEME_KEYS = ['letters', 'life', 'rites', 'nature', 'crafts'] as const;

/**
 * Character budgets for one line of a 320 px cell (about 50 dp inside its border), at the caption size
 * with `tracking.tight`: 7 Latin letters (the widest measured, "Comida", draws 47 dp) and 3 Hangul
 * syllables (each about 12 dp).
 */
const LATIN_MAX = 7;
const HANGUL_MAX = 3;
const HANGUL = /[가-힣]/;

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

  it.each(LOCALES)('%s keeps every word inside the one-line cell budget', (locale) => {
    const words = getMessages(locale).learner.journey.themeWord;
    for (const key of THEME_KEYS) {
      const word = words[key];
      const max = HANGUL.test(word) ? HANGUL_MAX : LATIN_MAX;
      expect([...word].length, `${locale} ${key} "${word}"`).toBeLessThanOrEqual(max);
    }
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
