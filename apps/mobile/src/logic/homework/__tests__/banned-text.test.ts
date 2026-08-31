import { describe, expect, it } from 'vitest';
import {
  BANNED_LEARNER_WORDS,
  findBannedWord,
  isLearnerSafe,
  scanLearnerCopy,
} from '../banned-text';

describe('banned learner words (F-HW-001 §3.3)', () => {
  it('bans exactly the four words the spec names', () => {
    expect([...BANNED_LEARNER_WORDS]).toEqual(['missed', 'incomplete', 'failed', 'overdue']);
  });

  it('catches each banned word regardless of case', () => {
    expect(findBannedWord('You missed one')).toBe('missed');
    expect(findBannedWord('This is INCOMPLETE')).toBe('incomplete');
    expect(findBannedWord('Quest Failed')).toBe('failed');
    expect(findBannedWord('2 overdue')).toBe('overdue');
  });

  it('matches on word boundaries so ordinary copy is not caught', () => {
    // The whole reason the check is not a naive substring scan.
    expect(findBannedWord('Hoya dismissed the idea')).toBeNull();
    expect(findBannedWord('Incompletely drawn is fine')).toBeNull();
    expect(isLearnerSafe('Unfailingly cheerful')).toBe(true);
  });

  it('treats punctuation as a boundary', () => {
    expect(findBannedWord('Oh no — failed!')).toBe('failed');
  });

  it('passes encouraging copy', () => {
    expect(isLearnerSafe('One more go with Hoya')).toBe(true);
    expect(isLearnerSafe('Something new today')).toBe(true);
    expect(isLearnerSafe('Story time')).toBe(true);
  });

  it('scanLearnerCopy reports each distinct word once', () => {
    expect(scanLearnerCopy(['you missed it', 'still missed', 'quest failed'])).toEqual([
      'missed',
      'failed',
    ]);
  });

  it('scanLearnerCopy returns an empty list for safe copy', () => {
    expect(scanLearnerCopy(['Nice work!', 'Try again with Hoya'])).toEqual([]);
  });
});
