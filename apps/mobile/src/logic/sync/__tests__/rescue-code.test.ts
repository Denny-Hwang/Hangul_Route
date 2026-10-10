import { normalizeRescueCode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { RESCUE_INPUT_MAX, claimErrorMessage, cleanRescueInput, rescueCodeHint, rescueCodeLines, rescueInputRows } from '../rescue-code';

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

  it('lays a code out one word per row, the number last, so no word breaks mid-way on a narrow phone', () => {
    expect(rescueCodeLines('TIGER-MOON-RIVER-APPLE-482139')).toEqual(['TIGER', 'MOON', 'RIVER', 'APPLE', '482139']);
    expect(rescueCodeLines('PADDLE-GLACIER-4992')).toEqual(['PADDLE', 'GLACIER', '4992']);
    expect(rescueCodeLines('tiger moon 4821')).toEqual(['TIGER', 'MOON', '4821']); // stored as typed, shown tidy
    expect(rescueCodeLines('not a code')).toEqual(['not a code']); // never hide what is stored
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

describe('rescueInputRows', () => {
  it('plans one row per typed word or number, between two and five', () => {
    expect(rescueInputRows('')).toBe(2);
    expect(rescueInputRows('PADDLE')).toBe(2);
    expect(rescueInputRows('PADDLE GLACIER 4992')).toBe(3);
    expect(rescueInputRows('TIGER MOON RIVER APPLE')).toBe(4);
    expect(rescueInputRows('TIGER MOON RIVER APPLE 482139')).toBe(5);
    expect(rescueInputRows('  TIGER   MOON  ')).toBe(2);
    expect(rescueInputRows('A B C D E F G')).toBe(5);
  });
});
