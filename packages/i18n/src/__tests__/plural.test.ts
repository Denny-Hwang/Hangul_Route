import { describe, expect, it } from 'vitest';
import { plural } from '../plural';

const forms = { one: 'one day', other: 'many days' };

describe('plural', () => {
  it('en and es: one only for exactly 1', () => {
    for (const locale of ['en', 'es'] as const) {
      expect(plural(locale, 1, forms)).toBe('one day');
      expect(plural(locale, 0, forms)).toBe('many days');
      expect(plural(locale, 2, forms)).toBe('many days');
      expect(plural(locale, 1.5, forms)).toBe('many days');
      expect(plural(locale, -1, forms)).toBe('many days');
      expect(plural(locale, 11, forms)).toBe('many days');
    }
  });

  it('ko: always other, the one form is ignored', () => {
    expect(plural('ko', 1, forms)).toBe('many days');
    expect(plural('ko', 0, forms)).toBe('many days');
    expect(plural('ko', 5, forms)).toBe('many days');
  });
});
