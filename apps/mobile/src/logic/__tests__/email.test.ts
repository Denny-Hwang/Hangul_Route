import { describe, expect, it } from 'vitest';
import { isValidEmail } from '../email';

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('parent@example.com')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('grand.parent+kids@school.org')).toBe(true);
    expect(isValidEmail('  trimmed@example.com  ')).toBe(true);
  });

  it('rejects empty or malformed addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('   ')).toBe(false);
    expect(isValidEmail('abc')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a@.com')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
    expect(isValidEmail('two@@at.com')).toBe(false);
  });

  it('rejects addresses that are too long', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@b.com`)).toBe(false);
  });
});
