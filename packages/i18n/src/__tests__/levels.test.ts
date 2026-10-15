import { LEARNER_LEVELS, LEARNER_LEVEL_IDS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { getMessages, levelWords, LOCALES } from '../index';

/**
 * The learner level's words in the UI locale (F-LEARN-001 §3.7; F-I18N-001 §4: level labels add their strings to the
 * dictionary). The level ids are opaque ('5-7' is a level, not an age), so the words are looked up by the level's order.
 */
describe('levelWords', () => {
  it('English is the content-schema table, word for word', () => {
    const en = getMessages('en');
    for (const level of LEARNER_LEVELS) {
      expect(levelWords(en, level.id)).toEqual({ label: level.label, description: level.description });
    }
  });

  it.each(['es', 'ko'] as const)('%s has its own label and description for every level', (locale) => {
    const en = getMessages('en');
    const m = getMessages(locale);
    for (const id of LEARNER_LEVEL_IDS) {
      const words = levelWords(m, id);
      expect(words).not.toBeNull();
      expect(words?.label).not.toBe(levelWords(en, id)?.label);
      expect(words?.description).not.toBe(levelWords(en, id)?.description);
    }
  });

  it('three different labels in every locale, none naming an age or a number', () => {
    for (const locale of LOCALES) {
      const labels = LEARNER_LEVEL_IDS.map((id) => levelWords(getMessages(locale), id)?.label ?? '');
      expect(new Set(labels).size).toBe(3);
      for (const label of labels) {
        expect(label).not.toMatch(/\d/);
        expect(label).not.toMatch(/\bage|edad|나이|살\b/i);
      }
    }
  });

  it('is null for an id this build does not know', () => {
    expect(levelWords(getMessages('en'), '12-14')).toBeNull();
    expect(levelWords(getMessages('ko'), '')).toBeNull();
  });
});
