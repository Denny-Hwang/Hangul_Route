import { describe, expect, it } from 'vitest';
import { koTokenParts } from '../ko-tokens';

describe('koTokenParts (F-CURR-001 §3.4)', () => {
  it('splits a note around its tokens, each with its romanization', () => {
    expect(koTokenParts('Use {ko:이} after a final consonant, {ko:가} after a vowel.')).toEqual([
      { text: 'Use ' },
      { ko: '이', romanization: 'i' },
      { text: ' after a final consonant, ' },
      { ko: '가', romanization: 'ga' },
      { text: ' after a vowel.' },
    ]);
  });

  it('keeps plain text, drops an empty token, and leaves a romanization out when it cannot be read', () => {
    expect(koTokenParts('Plain line.')).toEqual([{ text: 'Plain line.' }]);
    expect(koTokenParts('{ko:}x')).toEqual([{ text: 'x' }]);
    expect(koTokenParts('{ko: 을 }')).toEqual([{ ko: '을', romanization: 'eul' }]);
    expect(koTokenParts('{ko:A1}')).toEqual([{ ko: 'A1', romanization: '' }]);
    expect(koTokenParts('')).toEqual([]);
  });
});
