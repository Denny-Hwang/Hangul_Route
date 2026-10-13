import { describe, expect, it } from 'vitest';
import { parsePrefs } from '../prefs';

/** F-BROWSE-001 section 5.3 (BR-7): `browse:prefs` holds the Lesson display settings and nothing else. */
describe('parsePrefs', () => {
  it('reads a v1 value with or without a UI language', () => {
    expect(parsePrefs({ v: 1, romanization: 'tap' })).toEqual({ v: 1, romanization: 'tap' });
    expect(parsePrefs({ v: 1, romanization: 'always', uiLocale: 'es' })).toEqual({ v: 1, romanization: 'always', uiLocale: 'es' });
  });

  it('reads anything else as absent: another version, an unknown mode or locale, an extra field, not an object', () => {
    for (const bad of [null, undefined, 'tap', { v: 2, romanization: 'tap' }, { v: 1, romanization: 'never' }, { v: 1, romanization: 'tap', uiLocale: 'fr' }, { v: 1, romanization: 'tap', profileId: 'p1' }]) {
      expect(parsePrefs(bad)).toBeNull();
    }
  });
});
