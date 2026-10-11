import { describe, expect, it } from 'vitest';
import { romanizationShown as fromI18n } from '@hangul-route/i18n';
import { romanizationShown } from '../romanization';

describe('romanizationShown (D2)', () => {
  it('always mode shows it whether or not it was revealed', () => {
    expect(romanizationShown('always', false)).toBe(true);
    expect(romanizationShown('always', true)).toBe(true);
  });

  it('tap mode shows it only once revealed', () => {
    expect(romanizationShown('tap', false)).toBe(false);
    expect(romanizationShown('tap', true)).toBe(true);
  });

  it('is the one shared implementation from @hangul-route/i18n', () => {
    expect(romanizationShown).toBe(fromI18n);
  });
});
