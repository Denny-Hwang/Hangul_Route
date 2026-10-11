import { COLOR_CONFUSION_PAIRS as SOURCE } from '@hangul-route/design-system/word-art';
import { describe, expect, it } from 'vitest';
import { COLOR_CONFUSION_PAIRS } from '../color-confusion';

describe('COLOR_CONFUSION_PAIRS (the app copy of the F-VOC-002 §3.4 list)', () => {
  it('equals the design-system list, which color-science.test.ts recomputes from the tokens', () => {
    // A test-only import: vitest reads package `exports`; the app bundle never loads the subpath.
    expect(COLOR_CONFUSION_PAIRS.map((pair) => [...pair])).toEqual(SOURCE.map((pair) => [...pair]));
  });

  it('is frozen', () => {
    expect(Object.isFrozen(COLOR_CONFUSION_PAIRS)).toBe(true);
  });
});
