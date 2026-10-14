import { HOYA_POSES } from '@hangul-route/design-system/scene-art';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';

/**
 * `a11y.hoya(pose)` reads its pose word from `a11y.hoyaPose` (review of #594). The i18n package has no
 * design-system dependency, so this lane pins the two lists equal: a new Hoya pose needs its word in
 * every locale before it ships, or es and ko would fall back to a label with no pose word.
 */
describe('Hoya pose words cover the design-system poses', () => {
  for (const locale of ['en', 'es', 'ko'] as const) {
    it(`${locale} names every pose and no other`, () => {
      expect(Object.keys(getMessages(locale).a11y.hoyaPose).sort()).toEqual([...HOYA_POSES].sort());
    });
  }
});
