import { describe, expect, it } from 'vitest';
import { romanizationShown } from '../romanization';

describe('romanizationShown', () => {
  it('truth table', () => {
    expect(romanizationShown('always', false)).toBe(true);
    expect(romanizationShown('always', true)).toBe(true);
    expect(romanizationShown('tap', false)).toBe(false);
    expect(romanizationShown('tap', true)).toBe(true);
  });
});
