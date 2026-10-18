import { describe, expect, it } from 'vitest';
import { koSpeech, promptKindOf } from '../ko-speech';

describe('koSpeech: what the voice says for taught Korean (F-AUDIO-004 §3.5)', () => {
  it('says the Korean as written when the content has no spoken form and no recording', () => {
    const spec = koSpeech({ ko: '김밥' }, 'word', 'card-match');
    expect(spec).toEqual({ text: '김밥', kind: 'word', source: 'card-match' });
    expect('audioRef' in spec).toBe(false);
  });

  it('uses the spoken form and the recording when the content has them', () => {
    expect(koSpeech({ ko: '십', spokenKo: '씹', audioRef: 'audio/vocab/sip.mp3' }, 'word', 'voice-echo')).toEqual({
      text: '씹',
      audioRef: 'audio/vocab/sip.mp3',
      kind: 'word',
      source: 'voice-echo',
    });
  });

  it('keeps the kind, so a dialogue line is read at the sentence rate', () => {
    expect(koSpeech({ ko: '안녕하세요?' }, 'sentence', 'tap-respond').kind).toBe('sentence');
  });
});

describe('promptKindOf: the speech rate of a Listen & Pick prompt', () => {
  it('a one-syllable word is a word, never a sound (only a letter or syllable round is)', () => {
    expect(promptKindOf('집')).toBe('word');
    expect(promptKindOf('달')).toBe('word');
    expect(promptKindOf(' 빵 ')).toBe('word');
  });

  it('a sentence (closing punctuation) or a phrase of several words is a sentence', () => {
    expect(promptKindOf('가방이에요.')).toBe('sentence');
    expect(promptKindOf('어디 가요?')).toBe('sentence');
    expect(promptKindOf('이제 너야!')).toBe('sentence');
    expect(promptKindOf('사과 한 개 주세요')).toBe('sentence');
  });

  it('anything else is a word', () => {
    expect(promptKindOf('김밥')).toBe('word');
    expect(promptKindOf('호랑이')).toBe('word');
    expect(promptKindOf('이천 원')).toBe('word');
  });
});
