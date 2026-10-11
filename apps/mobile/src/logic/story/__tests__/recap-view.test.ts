import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { STORY_CHECK_AUDIO_SOURCE } from '../check-game';
import type { RecapWord } from '../recap';
import {
  RECAP_WORD_CELL,
  notePlayed,
  recapChipView,
  recapColumns,
  recapPlayedPayload,
  recapSpeech,
} from '../recap-view';

const en = getMessages('en');
const copy = en.learner.story.recap;
const koreanItem = en.a11y.koreanItem;

const seollal: RecapWord = { id: 'seollal', ko: '설날', romanization: 'seollal', en: "Lunar New Year's Day" };

describe('recapChipView', () => {
  it('always mode: Korean, romanization and gloss, no reveal button, a hear label with the romanization', () => {
    const view = recapChipView(seollal, { romanizationMode: 'always', revealed: new Set() }, copy, koreanItem);
    expect(view).toEqual({
      id: 'seollal',
      ko: '설날',
      romanization: 'seollal',
      gloss: "Lunar New Year's Day",
      revealNeeded: false,
      hearLabel: 'Hear seollal',
      accessibilityLabel: koreanItem({ ko: '설날', romanization: 'seollal', gloss: "Lunar New Year's Day" }),
    });
  });

  it('tap mode: the romanization waits behind a reveal; the gloss stays; screen readers still hear it (as in the reader)', () => {
    const view = recapChipView(seollal, { romanizationMode: 'tap', revealed: new Set() }, copy, koreanItem);
    expect(view.romanization).toBe('');
    expect(view.gloss).toBe("Lunar New Year's Day");
    expect(view.revealNeeded).toBe(true);
    expect(view.hearLabel).toBe('Hear seollal');
    expect(view.accessibilityLabel).toBe(koreanItem({ ko: '설날', romanization: 'seollal', gloss: "Lunar New Year's Day" }));
  });

  it('tap mode, this chip revealed: the romanization shows and stays', () => {
    const view = recapChipView(seollal, { romanizationMode: 'tap', revealed: new Set(['seollal']) }, copy, koreanItem);
    expect(view.romanization).toBe('seollal');
    expect(view.revealNeeded).toBe(false);
    expect(view.hearLabel).toBe('Hear seollal');
  });

  it('tap mode: revealing another chip does not reveal this one', () => {
    const view = recapChipView(seollal, { romanizationMode: 'tap', revealed: new Set(['sebae']) }, copy, koreanItem);
    expect(view.romanization).toBe('');
  });
});

describe('recapSpeech', () => {
  it('Korean TTS of the word, from the story-check surface', () => {
    expect(recapSpeech(seollal)).toEqual({ text: '설날', language: 'ko-KR', kind: 'word', source: STORY_CHECK_AUDIO_SOURCE });
  });

  it('prefers spokenKo and carries the clip', () => {
    expect(recapSpeech({ ...seollal, spokenKo: '설랄', audioRef: 'audio/seollal.mp3' })).toEqual({
      text: '설랄',
      language: 'ko-KR',
      kind: 'word',
      source: STORY_CHECK_AUDIO_SOURCE,
      audioRef: 'audio/seollal.mp3',
    });
  });
});

describe('recapColumns', () => {
  it('one column at 320, two from 360 (wireframe word-recap E), never more', () => {
    expect(recapColumns(320)).toBe(1);
    expect(recapColumns(359)).toBe(1);
    expect(recapColumns(360)).toBe(2);
    expect(recapColumns(1280)).toBe(2);
  });

  it('cells: a full row in one column, a half row that never stretches in two', () => {
    expect(RECAP_WORD_CELL[1]).toEqual({ flexGrow: 1, flexBasis: '100%' });
    expect(RECAP_WORD_CELL[2]).toEqual({ flexGrow: 1, flexBasis: '45%', maxWidth: '50%' });
  });
});

describe('notePlayed (story.recap.word_played once per word per visit)', () => {
  it('the first tap on a word tracks it; the next taps on it do not', () => {
    const first = notePlayed(new Set(), 'seollal');
    expect(first.track).toBe(true);
    expect([...first.played]).toEqual(['seollal']);
    const again = notePlayed(first.played, 'seollal');
    expect(again.track).toBe(false);
    expect(again.played).toBe(first.played);
  });

  it('another word tracks once too, and the input set is never mutated', () => {
    const start: ReadonlySet<string> = new Set(['seollal']);
    const out = notePlayed(start, 'sebae');
    expect(out.track).toBe(true);
    expect([...out.played].sort()).toEqual(['sebae', 'seollal']);
    expect([...start]).toEqual(['seollal']);
  });
});

describe('recapPlayedPayload', () => {
  it('ids only (spec §3.9)', () => {
    expect(recapPlayedPayload('story:seollal-new-year', 'seollal')).toEqual({ storyId: 'story:seollal-new-year', wordId: 'seollal' });
  });
});
