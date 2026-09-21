import { describe, expect, it } from 'vitest';
import { BANNED_WORDS, findBannedWord, isCaregiverSafe } from '../banned-text';
import { COPY, allCopyStrings } from '../copy';

describe('console copy stays caregiver-safe (F-CONSOLE-001 §3.5)', () => {
  it('flags banned words on word boundaries only', () => {
    expect(findBannedWord('3 students missed it')).toBe('missed');
    expect(findBannedWord('she dismissed the idea')).toBeNull();
    expect(isCaregiverSafe('Falling Behind?')).toBe(false);
    expect(BANNED_WORDS.length).toBeGreaterThan(3);
  });

  it('every string in COPY passes', () => {
    const strings = allCopyStrings();
    expect(strings.length).toBeGreaterThan(10);
    for (const s of strings) expect(isCaregiverSafe(s)).toBe(true);
    expect(COPY.capWarning(16, 20)).toBe('Free plan: 16 / 20 students');
  });
});
