import { describe, expect, it } from 'vitest';
import { HEAR_FAILURES_TO_SEE, HEAR_HOLD_MS, afterFailedPlay, hearAnswerHinted, hearOpening, hearSpeech, typedTolerance } from '../hear-mode';

const target = { ko: '사과', romanization: 'sagwa', en: 'apple' };

describe('hearOpening: decided before the round opens (W11)', () => {
  it('opens as hear when the word can be heard', () => {
    expect(hearOpening({ tts: 'ready', hasClip: false, muted: false, held: false })).toEqual({ kind: 'hear' });
    // A bundled recording plays with no device voice.
    expect(hearOpening({ tts: 'none', hasClip: true, muted: false, held: false })).toEqual({ kind: 'hear' });
    expect(hearOpening({ tts: 'unknown', hasClip: true, muted: false, held: false })).toEqual({ kind: 'hear' });
  });

  it('opens as see with the notice with no Korean voice, or with sound off', () => {
    expect(hearOpening({ tts: 'none', hasClip: false, muted: false, held: false })).toEqual({ kind: 'see', reason: 'no_voice' });
    expect(hearOpening({ tts: 'ready', hasClip: true, muted: true, held: true })).toEqual({ kind: 'see', reason: 'muted' });
  });

  it('holds while the voice list is unknown, and opens as hear once the hold has run', () => {
    expect(hearOpening({ tts: 'unknown', hasClip: false, muted: false, held: false })).toEqual({ kind: 'hold' });
    expect(hearOpening({ tts: 'unknown', hasClip: false, muted: false, held: true })).toEqual({ kind: 'hear' });
    expect(HEAR_HOLD_MS).toBe(1500);
  });

  it('turns a hear round into see on the second failed play', () => {
    expect(HEAR_FAILURES_TO_SEE).toBe(2);
    expect(afterFailedPlay(1)).toEqual({ kind: 'hear' });
    expect(afterFailedPlay(2)).toEqual({ kind: 'see', reason: 'error' });
  });
});

describe('hearSpeech', () => {
  it('plays the round recording first, then the target recording, else the device voice on the spoken form', () => {
    expect(hearSpeech({ target })).toEqual({ text: '사과' });
    expect(hearSpeech({ target: { ...target, spokenKo: '사과요', audioRef: 'audio/vocab/sagwa.mp3' } })).toEqual({ text: '사과요', audioRef: 'audio/vocab/sagwa.mp3' });
    expect(hearSpeech({ target: { ...target, audioRef: 'audio/vocab/x.mp3' }, audioRef: 'audio/vocab/sagwa.mp3' })).toEqual({ text: '사과', audioRef: 'audio/vocab/sagwa.mp3' });
  });
});

describe('typedTolerance and the hinted answer (section 4.3)', () => {
  it('is right for the same letters, spaces and NFC aside', () => {
    expect(typedTolerance('사과', '사과')).toBe('right');
    expect(typedTolerance('김밥 하나', '김밥하나')).toBe('right');
    expect(typedTolerance('사과', '사과')).toBe('right');
    expect(typedTolerance('사과.', '사과')).toBe('right');
  });

  it('is hinted one letter away (a missing final, a wrong vowel) and a miss two away or empty', () => {
    expect(typedTolerance('밥', '바')).toBe('hinted');
    expect(typedTolerance('사과', '사가')).toBe('hinted');
    expect(typedTolerance('사과', '사ㄱ')).toBe('hinted');
    expect(typedTolerance('사과', '가가')).toBe('miss');
    expect(typedTolerance('사과', '  ')).toBe('miss');
    expect(typedTolerance('사과', '!')).toBe('miss');
  });

  it('records a right answer after the hint, or a one-letter slip, as hinted; nothing else', () => {
    expect(hearAnswerHinted('사과', '사과', false)).toBe(false);
    expect(hearAnswerHinted('사과', '사과', true)).toBe(true);
    expect(hearAnswerHinted('사과', '사가', false)).toBe(true);
    expect(hearAnswerHinted('사과', '가가', true)).toBe(false);
  });
});
