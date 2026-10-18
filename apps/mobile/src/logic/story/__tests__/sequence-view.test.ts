import { getMessages, pseudoLocalize } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { SequenceCard } from '../sequence-cards';
import { initSequenceState, reduceSequence, type SequenceAction, type SequenceState } from '../sequence-player';
import {
  SEQUENCE_LINE_GAP_MS,
  SEQUENCE_REPLAY_MS,
  SEQUENCE_WRONG_FLASH_MS,
  autoAdvanceDue,
  replayAdvanceDelay,
  longestKoreanGlyphs,
  sequenceCardLabel as sequenceCardLabelWith,
  sequenceCardRomanization,
  sequenceColumns,
  sequenceFinishedPayload,
  sequenceSeed,
  sequenceSummary,
  slotViews,
} from '../sequence-view';

// The words are learner.story.sequence (F-I18N-001 PR 7b); these tests read the dictionary.
const COPY = getMessages('en').learner.story.sequence;
const sequenceCardLabel = (
  card: Parameters<typeof sequenceCardLabelWith>[0],
  romanization: string,
  outcome: Parameters<typeof sequenceCardLabelWith>[2],
): string => sequenceCardLabelWith(card, romanization, outcome, COPY);

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `s${i + 1}`);
const cards = (xs: readonly string[]): Array<{ id: string }> => xs.map((id) => ({ id }));

function run(start: SequenceState, actions: SequenceAction[]): SequenceState {
  return actions.reduce((state, action) => reduceSequence(state, action).state, start);
}
const tap = (cardId: string): SequenceAction => ({ type: 'tap', cardId });

const legacyCard: SequenceCard = {
  id: 'a',
  caption: 'Wash hands',
  ko: { ko: '손 씻기', romanization: 'son ssitgi', en: 'Wash hands' },
};
const plainCard: SequenceCard = { id: 'b', caption: 'Eat' };

describe('timings', () => {
  it('replays about every 2.5 s and flashes a wrong card for about 600 ms', () => {
    expect(SEQUENCE_REPLAY_MS).toBe(2500);
    expect(SEQUENCE_WRONG_FLASH_MS).toBe(600);
  });
});

describe('sequenceColumns', () => {
  it('is one column on a 320 dp phone, two from 360 dp, three or four on tablets', () => {
    expect(sequenceColumns(320)).toBe(1);
    expect(sequenceColumns(359)).toBe(1);
    expect(sequenceColumns(360)).toBe(2);
    expect(sequenceColumns(414)).toBe(2);
    expect(sequenceColumns(768)).toBe(3);
    expect(sequenceColumns(1024)).toBe(4);
  });
});

describe('sequenceColumns with long Korean', () => {
  it('goes to one column on a phone and two on a tablet when a Korean text would break', () => {
    expect(sequenceColumns(393, 3)).toBe(2);
    expect(sequenceColumns(393, 4)).toBe(1);
    expect(sequenceColumns(320, 7)).toBe(1);
    expect(sequenceColumns(768, 5)).toBe(3);
    expect(sequenceColumns(768, 6)).toBe(2);
    expect(sequenceColumns(1024, 9)).toBe(2);
  });
});

describe('longestKoreanGlyphs', () => {
  it('counts glyphs without spaces over the cards that have Korean', () => {
    expect(longestKoreanGlyphs([plainCard])).toBe(0);
    expect(longestKoreanGlyphs([])).toBe(0);
    expect(longestKoreanGlyphs([plainCard, legacyCard])).toBe(3);
    expect(
      longestKoreanGlyphs([legacyCard, { id: 'c', caption: 'Thanks', ko: { ko: '잘 먹었습니다', romanization: 'x', en: 'y' } }]),
    ).toBe(6);
  });
});

describe('sequenceSeed', () => {
  it('is deterministic per ref and nonce, and differs when either changes', () => {
    expect(sequenceSeed('minigame:a', 7)).toBe(sequenceSeed('minigame:a', 7));
    expect(sequenceSeed('minigame:a', 7)).not.toBe(sequenceSeed('minigame:a', 8));
    expect(sequenceSeed('minigame:a', 7)).not.toBe(sequenceSeed('minigame:b', 7));
    expect(Number.isInteger(sequenceSeed('x', 1))).toBe(true);
  });
});

describe('slotViews', () => {
  it('has one numbered slot per card, filled left to right', () => {
    const s = initSequenceState(cards(ids(4)), 3);
    expect(slotViews(s)).toEqual([
      { number: 1, cardId: null },
      { number: 2, cardId: null },
      { number: 3, cardId: null },
      { number: 4, cardId: null },
    ]);
    expect(slotViews(run(s, [tap('s1'), tap('s2')]))).toEqual([
      { number: 1, cardId: 's1' },
      { number: 2, cardId: 's2' },
      { number: 3, cardId: null },
      { number: 4, cardId: null },
    ]);
  });
});

describe('sequenceCardRomanization', () => {
  it('is empty for a card with no Korean', () => {
    expect(sequenceCardRomanization(plainCard, 'always', false)).toBe('');
  });
  it('shows in always mode, and in tap mode only once revealed', () => {
    expect(sequenceCardRomanization(legacyCard, 'always', false)).toBe('son ssitgi');
    expect(sequenceCardRomanization(legacyCard, 'tap', false)).toBe('');
    expect(sequenceCardRomanization(legacyCard, 'tap', true)).toBe('son ssitgi');
  });
});

describe('sequenceCardLabel', () => {
  it('reads Korean, romanization and caption for a card with Korean', () => {
    expect(sequenceCardLabel(legacyCard, 'son ssitgi', null)).toBe('손 씻기, son ssitgi. Wash hands');
  });
  it('leaves the romanization out when hidden', () => {
    expect(sequenceCardLabel(legacyCard, '', null)).toBe('손 씻기. Wash hands');
  });
  it('reads the caption alone for a card without Korean', () => {
    expect(sequenceCardLabel(plainCard, '', null)).toBe('Eat');
  });
  it('names the outcome of a wrong tap and of a highlight, in words', () => {
    expect(sequenceCardLabel(plainCard, '', 'wrong')).toBe('Eat. Try another');
    expect(sequenceCardLabel(plainCard, '', 'hint')).toBe('Eat. This one comes next.');
    // The outcome words come from the subtree it is given (en-XA).
    const pseudo = pseudoLocalize(getMessages('en')).learner.story.sequence;
    expect(sequenceCardLabelWith(plainCard, '', 'wrong', pseudo)).toBe(`Eat. ${pseudo.tryAnother}`);
    expect(sequenceCardLabelWith(plainCard, '', 'hint', pseudo)).toBe(`Eat. ${pseudo.lookHere}`);
  });
});

describe('replayAdvanceDelay: the replay waits for the line, then a short gap (F-AUDIO-004 §3.5)', () => {
  it('a line that ends after the replay interval is followed by the gap only', () => {
    expect(replayAdvanceDelay(4000)).toBe(SEQUENCE_LINE_GAP_MS);
    expect(SEQUENCE_LINE_GAP_MS).toBe(600);
  });

  it('a short or silent line never moves on sooner than the replay interval from its start', () => {
    expect(replayAdvanceDelay(0)).toBe(SEQUENCE_REPLAY_MS);
    expect(replayAdvanceDelay(1000)).toBe(SEQUENCE_REPLAY_MS - 1000);
    expect(replayAdvanceDelay(SEQUENCE_REPLAY_MS - SEQUENCE_LINE_GAP_MS)).toBe(SEQUENCE_LINE_GAP_MS);
  });

  it('a clock that went backwards counts as no time elapsed', () => {
    expect(replayAdvanceDelay(-50)).toBe(SEQUENCE_REPLAY_MS);
  });
});

describe('autoAdvanceDue', () => {
  const replaying = (n = 3): SequenceState => run(initSequenceState(cards(ids(n)), 4), ids(n).map(tap));

  it('is true while replaying, unpaused, with motion allowed and cards left', () => {
    expect(autoAdvanceDue(replaying(), false)).toBe(true);
  });
  it('is false when paused, with reduced motion, on the last card, or outside the replay', () => {
    const paused = run(replaying(), [{ type: 'togglePause' }]);
    expect(autoAdvanceDue(paused, false)).toBe(false);
    expect(autoAdvanceDue(replaying(), true)).toBe(false);
    const last = run(replaying(3), [{ type: 'replayNext' }, { type: 'replayNext' }]);
    expect(autoAdvanceDue(last, false)).toBe(false);
    expect(autoAdvanceDue(initSequenceState(cards(ids(3)), 1), false)).toBe(false);
  });
});

describe('sequenceSummary and payload', () => {
  it('counts first-try slots, retries and whether the replay was watched', () => {
    const s = initSequenceState(cards(ids(4)), 2);
    // Slot 1: one miss. Slot 2: two misses. Slots 3-4: clean.
    const state = run(s, [tap('s3'), tap('s1'), tap('s4'), tap('s3'), tap('s2'), tap('s3'), tap('s4')]);
    expect(state.phase).toBe('replay');
    expect(sequenceSummary(state)).toEqual({ slots: 4, firstTryCorrect: 2, retries: 3, replayed: false });
    const watched = run(state, [{ type: 'replayNext' }, { type: 'replayNext' }, { type: 'replayNext' }]);
    expect(sequenceSummary(watched).replayed).toBe(true);
  });

  it('counts only the slots reached when the learner skipped early', () => {
    const state = run(initSequenceState(cards(ids(4)), 2), [tap('s1'), tap('s4')]);
    expect(sequenceSummary(state)).toEqual({ slots: 4, firstTryCorrect: 1, retries: 1, replayed: false });
  });

  it('builds the story.sequence.finished payload for a story and for a legacy scope', () => {
    const summary = { slots: 4, firstTryCorrect: 3, retries: 1, replayed: true };
    expect(sequenceFinishedPayload({ storyId: 'story:seollal', sequenceId: 'minigame:story-seq-listen-seollal' }, summary, false)).toEqual({
      storyId: 'story:seollal',
      sequenceId: 'minigame:story-seq-listen-seollal',
      slots: 4,
      firstTryCorrect: 3,
      retries: 1,
      replayed: true,
      skipped: false,
    });
    expect(sequenceFinishedPayload({ storyId: null, sequenceId: 'minigame:s1-rites-q3-apply' }, summary, true)).toMatchObject({
      storyId: null,
      sequenceId: 'minigame:s1-rites-q3-apply',
      skipped: true,
    });
  });
});
