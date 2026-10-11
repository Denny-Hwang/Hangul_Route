import type { SpeechLang } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { PLACEMENT_BANK, PLACEMENT_WARMUP } from '../../../content/placement.generated';
import {
  MODE_TILES_ROW_MAX_FONT_SCALE,
  MODE_TILES_ROW_MIN_WIDTH,
  MOTIVATION_CHOICES,
  bankHasClips,
  flowCapability,
  modeTiles,
  placementKoreanAudio,
  modeTilesSideBySide,
  speechLangOf,
} from '../options-view';

const en = getMessages('en');

describe('modeTilesSideBySide (section 3.1 step 3)', () => {
  it('needs 480 pt of content and a font scale of at most 1.3', () => {
    expect(modeTilesSideBySide(MODE_TILES_ROW_MIN_WIDTH, MODE_TILES_ROW_MAX_FONT_SCALE)).toBe(true);
    expect(modeTilesSideBySide(MODE_TILES_ROW_MIN_WIDTH - 1, 1)).toBe(false);
    expect(modeTilesSideBySide(900, 1.31)).toBe(false);
  });
});

describe('modeTiles', () => {
  it('three equal radios in order, one selected, none recommended', () => {
    const tiles = modeTiles({ mode: 'standard', shortAvailable: true, takeMyTime: false }, en);
    expect(tiles.map((t) => [t.mode, t.selected, t.disabled, t.hint])).toEqual([
      ['short', false, false, null],
      ['standard', true, false, null],
      ['deep', false, false, null],
    ]);
    expect(tiles[1]?.copy).toEqual({ label: 'Standard', help: 'Letters, sounds, words and sentences.', duration: 'Usually under 10 minutes.' });
  });

  it('disables Short with its spoken hint when it is unavailable, and hides durations with Take my time', () => {
    const tiles = modeTiles({ mode: 'standard', shortAvailable: false, takeMyTime: true }, en);
    expect(tiles[0]).toMatchObject({ disabled: true, hint: 'The short check needs sound.' });
    expect(tiles.every((t) => t.copy.duration === null)).toBe(true);
  });
});

describe('MOTIVATION_CHOICES', () => {
  it('four icon choices, one per motivation', () => {
    expect(MOTIVATION_CHOICES.map((c) => c.motivation)).toEqual(['heritage', 'kculture', 'curious', 'friends']);
  });
});

describe('placementKoreanAudio (section 3.1 steps 2 and 3, 3.11)', () => {
  const ready = { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'enhanced' } as const;
  const none = { state: 'none', reason: 'no_korean_voice' } as const;

  it('a Korean voice plays every prompt', () => {
    expect(placementKoreanAudio({ tts: ready, clips: false, unlocked: true }, false)).toBe(true);
  });

  it('bundled clips count only when the placement bank carries clips: a bank without them needs a voice', () => {
    expect(placementKoreanAudio({ tts: none, clips: true, unlocked: true }, false)).toBe(false);
    expect(placementKoreanAudio({ tts: none, clips: true, unlocked: true }, true)).toBe(true);
    expect(placementKoreanAudio({ tts: { state: 'unknown' }, clips: false, unlocked: false }, true)).toBe(false);
  });

  it('the shipped bank has no clips yet', () => {
    expect(bankHasClips(PLACEMENT_BANK, PLACEMENT_WARMUP)).toBe(false);
    const withClip = { templates: [{ question: { audioRef: 'a7:clip' } }] };
    expect(bankHasClips(withClip, PLACEMENT_WARMUP)).toBe(true);
    expect(bankHasClips({ templates: [] }, { question: { audioRef: 'a7:warm' } })).toBe(true);
  });
});

describe('flowCapability (the device, read when the options screen opens)', () => {
  it('asks for the test language voice and the Korean voice', () => {
    const asked: SpeechLang[] = [];
    const cap = flowCapability({
      koreanAudio: true,
      hasVoiceFor: (lang) => {
        asked.push(lang);
        return lang !== 'es-US';
      },
      testLocale: 'es',
    });
    expect(cap).toEqual({ koreanAudio: true, instructionVoice: false, koreanInstructionVoice: true });
    expect(asked).toEqual(['es-US', 'ko-KR']);
  });

  it('maps every test language to its speech language', () => {
    expect([speechLangOf('en'), speechLangOf('es'), speechLangOf('ko')]).toEqual(['en-US', 'es-US', 'ko-KR']);
  });
});
