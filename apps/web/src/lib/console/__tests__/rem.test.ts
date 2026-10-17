import { TEXT_SCALE_CSS_VAR } from '@hangul-route/design-system/text-size';
import { describe, expect, it } from 'vitest';
import { HEAD_RATIO_CSS_VAR, ROOT_FONT_PX, ROOT_FONT_SIZE, headRatio, headRem, rem } from '../rem';

/** Owner items 6 and 7: console type in rem, so the root size (the chosen step) grows it. */
describe('rem', () => {
  it('turns a px token into rem of the 16 px root', () => {
    expect(ROOT_FONT_PX).toBe(16);
    expect(rem(16)).toBe('1rem');
    expect(rem(18)).toBe('1.125rem');
    expect(rem(14)).toBe('0.875rem');
  });

  it('the root rule reads the text scale variable the locale provider sets, 1 when unset', () => {
    expect(ROOT_FONT_SIZE).toBe(`calc(100% * var(${TEXT_SCALE_CSS_VAR}, 1))`);
  });
});

describe('headRem: headings grow half as much (AMENDMENTS-DISPLAY-NAV section 4)', () => {
  it('the ratio is (1 + (f - 1) / 2) / f, 1 at standard or for a bad factor', () => {
    expect(headRatio(1)).toBe(1);
    expect(headRatio(1.5)).toBeCloseTo(1.25 / 1.5);
    expect(headRatio(1.15)).toBeCloseTo(1.075 / 1.15);
    expect(headRatio(0.5)).toBe(1);
    expect(headRatio(Number.NaN)).toBe(1);
  });

  it('a heading size multiplies its rem by the ratio variable (1 when unset)', () => {
    expect(HEAD_RATIO_CSS_VAR).toBe('--hr-head-ratio');
    expect(headRem(28)).toBe('calc(1.75rem * var(--hr-head-ratio, 1))');
  });
});
