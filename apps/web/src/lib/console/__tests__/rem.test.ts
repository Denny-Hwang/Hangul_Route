import { TEXT_SCALE_CSS_VAR } from '@hangul-route/design-system/text-size';
import { describe, expect, it } from 'vitest';
import { ROOT_FONT_PX, ROOT_FONT_SIZE, rem } from '../rem';

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
