import { describe, expect, it } from 'vitest';
import { resolveRomanizationMode } from '../romanization-mode';

/**
 * F-BROWSE-001 §4.9 (BR-5c): one rule for the romanization mode a screen shows.
 * An override (the All lessons display setting, given by a provider) wins; else
 * the profile's own setting; else `always`, as every screen did before.
 */
describe('resolveRomanizationMode', () => {
  it('falls back to always with no override and no profile settings', () => {
    expect(resolveRomanizationMode(null, undefined)).toBe('always');
  });

  it('reads the profile setting when there is no override', () => {
    expect(resolveRomanizationMode(null, { romanizationMode: 'tap' })).toBe('tap');
    expect(resolveRomanizationMode(null, { romanizationMode: 'always' })).toBe('always');
  });

  it('lets the override win over the profile setting', () => {
    expect(resolveRomanizationMode('tap', { romanizationMode: 'always' })).toBe('tap');
    expect(resolveRomanizationMode('always', { romanizationMode: 'tap' })).toBe('always');
    expect(resolveRomanizationMode('tap', undefined)).toBe('tap');
  });
});
