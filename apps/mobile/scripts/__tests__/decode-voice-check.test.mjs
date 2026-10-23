import { describe, expect, it } from 'vitest';
import { MAX_S, MIN_S, soundKey, voiceProblems } from '../decode-voice-check.mjs';

/** F-CURR-002 section 19 assumption 5, row CM-32: the rules the device-voice check of the Block Sprint's blocks applies. */
describe('decode-voice-check', () => {
  it('keys blocks by how they sound alone (밥 and 밮 alike, 밥 and 반 not)', () => {
    expect(soundKey('밥')).toBe(soundKey('밮'));
    expect(soundKey('낫')).toBe(soundKey('낮'));
    expect(soundKey('밥')).not.toBe(soundKey('반'));
    expect(soundKey('가')).toBe('가');
  });

  it('passes one syllable each; flags a block read too long or too short, and different sounds with the same audio', () => {
    expect(voiceProblems([{ block: '가', seconds: 0.3, hash: 'a' }, { block: '밥', seconds: 0.25, hash: 'b' }, { block: '밮', seconds: 0.25, hash: 'b' }])).toEqual([]);
    expect(voiceProblems([{ block: '가', seconds: MAX_S + 0.2, hash: 'a' }])).toHaveLength(1);
    expect(voiceProblems([{ block: '가', seconds: MIN_S / 2, hash: 'a' }])).toHaveLength(1);
    expect(voiceProblems([{ block: '가', seconds: 0.3, hash: 'x' }, { block: '나', seconds: 0.3, hash: 'x' }])).toEqual(['가, 나: the same audio for blocks that sound different']);
  });
});
