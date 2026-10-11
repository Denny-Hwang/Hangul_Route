import { describe, expect, it } from 'vitest';
import {
  AUDIO_COPY,
  fallbackActionLabel,
  fallbackMessage,
  matchSoundHeading,
  speakerLabel,
  voiceStatusLine,
} from '../copy';

describe('audio copy (English until F-I18N-001 ships the catalog)', () => {
  const all: string[] = [
    ...Object.values(AUDIO_COPY),
    matchSoundHeading(false),
    matchSoundHeading(true),
    speakerLabel(false),
    speakerLabel(true),
    ...(['muted', 'no_voice', 'error', 'blocked', null] as const).flatMap((r) => fallbackMessage(r) ?? []),
    ...(['turn_on', 'try_again', 'tap_to_hear', 'none'] as const).flatMap((a) => fallbackActionLabel(a) ?? []),
    voiceStatusLine({ state: 'unknown' }),
    voiceStatusLine({ state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' }),
    voiceStatusLine({ state: 'none', reason: 'no_engine' }),
    voiceStatusLine({ state: 'none', reason: 'no_korean_voice' }),
    voiceStatusLine({ state: 'none', reason: 'offline_network_only' }),
  ];

  it('has exactly the spec strings', () => {
    expect(AUDIO_COPY.readHere).toBe('No sound? Read it here.');
    expect(AUDIO_COPY.noKoreanVoice).toBe('No Korean voice on this device');
    expect(AUDIO_COPY.listenAgain).toBe('Listen again. This one says');
    expect(AUDIO_COPY.tapToHear).toBe('Tap to hear');
    expect(AUDIO_COPY.turnSoundOn).toBe('Turn sound on');
    expect(AUDIO_COPY.tryAgain).toBe('Try again');
    expect(AUDIO_COPY.letterName).toBe('Letter name');
    expect(AUDIO_COPY.voiceReady).toBe('Korean voice: ready');
    expect(matchSoundHeading(false)).toBe('Tap the letter you hear');
    expect(matchSoundHeading(true)).toBe('Tap the letter for this sound');
    expect(speakerLabel(false)).toBe('Play sound');
    expect(speakerLabel(true)).toBe('Play sound, sound is off');
  });

  it('maps every fallback reason to a message, and null to none', () => {
    expect(fallbackMessage('muted')).toBe('Sound is off.');
    expect(fallbackMessage('no_voice')).toBe('No Korean voice on this device');
    expect(fallbackMessage('error')).toBe('The sound did not play.');
    expect(fallbackMessage('blocked')).toBe('Tap to hear');
    expect(fallbackMessage(null)).toBeNull();
  });

  it('maps every action to a label, none to null', () => {
    expect(fallbackActionLabel('turn_on')).toBe('Turn sound on');
    expect(fallbackActionLabel('try_again')).toBe('Try again');
    expect(fallbackActionLabel('tap_to_hear')).toBe('Tap to hear');
    expect(fallbackActionLabel('none')).toBeNull();
  });

  it('gives the voice status line for each state', () => {
    expect(voiceStatusLine({ state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' })).toBe('Korean voice: ready');
    expect(voiceStatusLine({ state: 'none', reason: 'no_korean_voice' })).toBe('No Korean voice on this device');
    expect(voiceStatusLine({ state: 'none', reason: 'no_engine' })).toBe('No Korean voice on this device');
    expect(voiceStatusLine({ state: 'none', reason: 'offline_network_only' })).toBe('Korean voice needs the internet');
    expect(voiceStatusLine({ state: 'unknown' })).toBe('Looking for a Korean voice');
  });

  it('is plain English: ASCII only (no emoji, no Hangul in UI copy), no age words, no shame words', () => {
    for (const s of all) {
      expect(s.length).toBeGreaterThan(0);
      expect(/^[\x20-\x7E]+$/.test(s)).toBe(true);
      expect(/\b(kid|kids|child|children|baby|wrong|fail|failed|error|red)\b/i.test(s)).toBe(false);
    }
  });
});
