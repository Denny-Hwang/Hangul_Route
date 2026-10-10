import { normalizeRescueCode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { RESCUE_INPUT_MAX, claimErrorMessage, cleanRescueInput, rescueCodeHint } from '../rescue-code';

describe('rescue code helpers (F-RESTORE-001)', () => {
  it('cleans the one code field while typing: upper case, letters, digits and single separators', () => {
    expect(cleanRescueInput('tiger moon')).toBe('TIGER MOON');
    expect(cleanRescueInput('  tiger\n\nmoon-river ')).toBe('TIGER MOON-RIVER ');
    expect(cleanRescueInput('tiger.moon!4821')).toBe('TIGERMOON4821');
    expect(cleanRescueInput('x'.repeat(100))).toHaveLength(RESCUE_INPUT_MAX);
    // the longest code (four 10-letter words + six digits) fits with room for spaces
    expect(RESCUE_INPUT_MAX).toBeGreaterThanOrEqual('LIGHTHOUSE-SUNFLOWER-LIGHTHOUSE-SUNFLOWER-482139'.length + 8);
  });

  it('a pasted or typed code of either shape normalizes after cleaning (SEC-5 + codes already issued)', () => {
    expect(normalizeRescueCode(cleanRescueInput('Tiger Moon River Apple 482139'))).toBe('TIGER-MOON-RIVER-APPLE-482139');
    expect(normalizeRescueCode(cleanRescueInput('tiger-moon-4821'))).toBe('TIGER-MOON-4821');
    expect(normalizeRescueCode(cleanRescueInput('tiger moon'))).toBeNull();
  });

  it('describes the shape of the code a parent is looking at', () => {
    expect(rescueCodeHint('TIGER-MOON-RIVER-APPLE-482139')).toBe('four words + 6 digits');
    expect(rescueCodeHint('TIGER-MOON-4821')).toBe('two words + 4 digits');
    expect(rescueCodeHint('not a code')).toBeNull();
  });

  it('has calm copy for every error', () => {
    for (const c of ['code_not_found', 'too_many_attempts', 'network', 'invalid', 'unknown'] as const) {
      expect(claimErrorMessage(c).length).toBeGreaterThan(10);
    }
    expect(claimErrorMessage('code_not_found')).not.toMatch(/wrong|fail/i);
    // the format hint shows the new shape and still names the older one
    expect(claimErrorMessage('invalid')).toContain('TIGER-MOON-RIVER-APPLE-482139');
    expect(claimErrorMessage('invalid')).toContain('TIGER-MOON-4821');
  });
});
