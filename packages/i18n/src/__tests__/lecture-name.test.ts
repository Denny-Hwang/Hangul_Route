import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import { lookup } from '../tree';

/**
 * One plain name for lecture mode in every locale (AMENDMENTS-LECTURE-V2 LV-D2, section 14). The keys below must
 * exist in each locale's own dictionary (an English fallback does not count) and hold the same value there. The list
 * is explicit: a key that goes missing fails here, nothing is skipped as "not present yet". LV-4 lists the console
 * page title and its entry button with the presenter home's title (renamed in LV-3); LV-5 appends
 * `console.shell.nav.lecture` and `console.lecture.card.title`, LV-6 `caregiver.lecture.title`.
 */
const LECTURE_NAME_KEYS = [
  'console.lecture.title',
  'console.lecture.entry.cta',
  'learner.presenter.home.title',
  // LV-5: the nav item and the home card (section 3, E1 to E3).
  'console.shell.nav.lecture',
  'console.lecture.card.title',
  // LV-6: the learner app's grown-up card (section 3, E5).
  'caregiver.lecture.title',
] as const;

/** The name itself, per locale (section 12, LV-D2). */
const NAME = { en: 'Lecture mode', es: 'Modo proyección', ko: '강의 모드' } as const;

const OWN = { en, es, ko } as const;

describe('lecture mode has one name (AMENDMENTS-LECTURE-V2 LV-D2)', () => {
  it('covers every UI locale', () => {
    expect(Object.keys(OWN).sort()).toEqual([...LOCALES].sort());
  });

  it.each(LOCALES)('%s: every listed key is in its own dictionary and reads the one name', (locale) => {
    for (const key of LECTURE_NAME_KEYS) {
      const value = lookup(OWN[locale], key);
      expect(value, `${locale}:${key} missing`).toBeTypeOf('string');
      expect(value, `${locale}:${key}`).toBe(NAME[locale]);
    }
  });

  it.each(LOCALES)('%s: the console tab title names it too', (locale) => {
    const titleFor = lookup(OWN[locale], 'console.lecture.titleFor');
    expect(titleFor).toBeTypeOf('function');
    const tab = (titleFor as (space: string) => string)('Class 2B');
    expect(tab).toContain('Class 2B');
    expect(tab.toLowerCase()).toContain(NAME[locale].toLowerCase());
  });
});
