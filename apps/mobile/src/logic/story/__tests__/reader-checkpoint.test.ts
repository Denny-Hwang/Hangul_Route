import { getMessages } from '@hangul-route/i18n';
import type { StoryCheck } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { checkpointRoundKey } from '../../round-keys';
import { HIGHLIGHT_AFTER_WRONG } from '../check-player';
import { buildCheckView } from '../check-view';
import { initReader, reduceReader, type ReaderAction, type ReaderState } from '../reader-state';
import {
  NO_CHECKPOINT_CARDS,
  cardsAfterReader,
  checkpointAnnouncement,
  checkpointAnswered,
  checkpointCard,
  checkpointHeading,
  checkpointItem,
  checkpointNext,
  checkpointRevealId,
  checkpointSkip,
  checkpointSpeech,
  tapCheckpoint,
  type CheckpointCards,
} from '../reader-checkpoint';
import { STORY_READER_AUDIO_SOURCE } from '../scene-audio';
import { readyStory } from './story-fixture';

const readerCopy = getMessages('en').learner.story.reader;

function listenTier() {
  const story = readyStory();
  return { story, tier: story.tiers.find((t) => t.level === 'listen')! };
}

const pickCheck: StoryCheck = {
  id: 'cp2',
  kind: 'pick-meaning',
  promptEn: 'What does {target} mean?',
  target: { ko: '한글', romanization: 'hangeul', en: 'the Korean alphabet' },
  options: [
    { id: 'a', en: 'the Korean alphabet', isCorrect: true },
    { id: 'b', en: 'a king', isCorrect: false },
    { id: 'c', en: 'a holiday', isCorrect: false },
  ],
  explainEn: 'It names the alphabet.',
  factIds: ['f1'],
};

describe('checkpointItem (§3.7: the open checkpoint as a check view)', () => {
  it('builds the tier checkpoint with the shared check view, seeded by the story id', () => {
    const { story, tier } = listenTier();
    const item = checkpointItem(story, tier, 'cp1');
    expect(item).toEqual(buildCheckView(tier.checkpoints[0]!, story.id));
    expect(item?.kind).toBe('true-false');
    // True-false keeps the authored order.
    expect(item?.options.map((o) => o.id)).toEqual(['t', 'f']);
  });

  it('is null with no open checkpoint or an id the tier does not define', () => {
    const { story, tier } = listenTier();
    expect(checkpointItem(story, tier, null)).toBeNull();
    expect(checkpointItem(story, tier, 'nope')).toBeNull();
  });
});

describe('checkpoint cards (first try, amber nudge, highlight: F-STORY-003 §3.4)', () => {
  const { story, tier } = listenTier();
  const tf = checkpointItem(story, tier, 'cp1')!;
  const pick = buildCheckView(pickCheck, story.id);

  it('a card starts fresh: answering, nothing tapped', () => {
    expect(checkpointCard(NO_CHECKPOINT_CARDS, tf)).toEqual({ index: 0, phase: 'answering', wrong: [], taps: 0 });
    expect(checkpointAnswered(NO_CHECKPOINT_CARDS, tf)).toBe(false);
  });

  it('a right first tap resolves the card; the answer is reported when the page turns', () => {
    const tap = tapCheckpoint(NO_CHECKPOINT_CARDS, tf, 't');
    expect(tap.outcome).toBe('correct');
    expect(tap.reader).toBeNull();
    expect(checkpointCard(tap.cards, tf)).toMatchObject({ phase: 'explained', wrong: [], taps: 1 });
    expect(checkpointAnswered(tap.cards, tf)).toBe(true);
    expect(checkpointNext(tap.cards, tf)).toEqual({ type: 'resolveCheckpoint', correct: true });
  });

  it('a miss is reported at once, locks that card amber and keeps the question open', () => {
    const tap = tapCheckpoint(NO_CHECKPOINT_CARDS, tf, 'f');
    expect(tap.outcome).toBe('wrong');
    expect(tap.reader).toEqual({ type: 'resolveCheckpoint', correct: false });
    expect(checkpointCard(tap.cards, tf)).toMatchObject({ phase: 'answering', wrong: ['f'], taps: 1 });
    expect(checkpointAnswered(tap.cards, tf)).toBe(false);
    expect(checkpointNext(tap.cards, tf)).toBeNull();
    // A locked card does nothing on a second tap.
    const again = tapCheckpoint(tap.cards, tf, 'f');
    expect(again).toEqual({ cards: tap.cards, reader: null, outcome: null });
  });

  it('after two misses the right card is ringed; the right tap then resolves it', () => {
    let cards: CheckpointCards = NO_CHECKPOINT_CARDS;
    cards = tapCheckpoint(cards, pick, 'b').cards;
    const second = tapCheckpoint(cards, pick, 'c');
    expect(second.reader).toEqual({ type: 'resolveCheckpoint', correct: false });
    expect(checkpointCard(second.cards, pick).wrong).toHaveLength(HIGHLIGHT_AFTER_WRONG);
    const right = tapCheckpoint(second.cards, pick, 'a');
    expect(right.outcome).toBe('correct');
    expect(checkpointCard(right.cards, pick)).toMatchObject({ phase: 'explained', taps: 3 });
    // Taps on a resolved card change nothing.
    expect(tapCheckpoint(right.cards, pick, 'b')).toEqual({ cards: right.cards, reader: null, outcome: null });
  });

  it('an unknown option changes nothing', () => {
    expect(tapCheckpoint(NO_CHECKPOINT_CARDS, tf, 'zz')).toEqual({ cards: NO_CHECKPOINT_CARDS, reader: null, outcome: null });
  });

  it('each checkpoint keeps its own card', () => {
    const cards = tapCheckpoint(NO_CHECKPOINT_CARDS, tf, 'f').cards;
    expect(checkpointCard(cards, pick).wrong).toEqual([]);
    expect(Object.keys(tapCheckpoint(cards, pick, 'a').cards).sort()).toEqual(['cp1', 'cp2']);
  });

  it('Skip is always there: unanswered it records nothing, answered it carries the answer on like Next', () => {
    expect(checkpointSkip(NO_CHECKPOINT_CARDS, tf)).toEqual({ type: 'skipCheckpoint' });
    const missed = tapCheckpoint(NO_CHECKPOINT_CARDS, tf, 'f').cards;
    expect(checkpointSkip(missed, tf)).toEqual({ type: 'skipCheckpoint' });
    const answered = tapCheckpoint(NO_CHECKPOINT_CARDS, tf, 't').cards;
    expect(checkpointSkip(answered, tf)).toEqual({ type: 'resolveCheckpoint', correct: true });
  });

  it('a fresh read (Read again) asks every checkpoint again; other page turns keep the cards', () => {
    const cards = tapCheckpoint(NO_CHECKPOINT_CARDS, tf, 'f').cards;
    expect(cardsAfterReader(cards, { type: 'restart' })).toBe(NO_CHECKPOINT_CARDS);
    const kept: ReaderAction[] = [{ type: 'back' }, { type: 'next' }, { type: 'goTo', index: 1 }, { type: 'skipCheckpoint' }];
    for (const action of kept) expect(cardsAfterReader(cards, action)).toBe(cards);
  });
});

describe('the reader with a checkpoint card (reader-state + cards, §3.7)', () => {
  const { story, tier } = listenTier();
  const item = checkpointItem(story, tier, 'cp1')!;
  const atCheckpoint = (): ReaderState => {
    let s = initReader(5, 2, [null, null, 'cp1', null, null]);
    s = reduceReader(s, { type: 'next' }).state;
    return s;
  };

  it('a first-try right answer scores once, as the page turns (scene-changed, then answer)', () => {
    const s = atCheckpoint();
    expect(s.phase).toBe('checkpoint');
    const tap = tapCheckpoint(NO_CHECKPOINT_CARDS, item, 't');
    const step = reduceReader(s, checkpointNext(tap.cards, item)!);
    expect(step.state).toMatchObject({ phase: 'scene', index: 3 });
    expect(step.effects).toEqual([
      { type: 'scene-changed', index: 3, via: 'next' },
      { type: 'answer', roundKey: checkpointRoundKey('cp1'), correct: true },
    ]);
  });

  it('a miss first: the miss is the first answer, the later right answer only a retry', () => {
    const s = atCheckpoint();
    const miss = tapCheckpoint(NO_CHECKPOINT_CARDS, item, 'f');
    const missStep = reduceReader(s, miss.reader!);
    expect(missStep.state.phase).toBe('checkpoint');
    expect(missStep.effects).toEqual([{ type: 'answer', roundKey: 'cp:cp1', correct: false }]);
    const right = tapCheckpoint(miss.cards, item, 't');
    expect(reduceReader(missStep.state, checkpointNext(right.cards, item)!).effects.map((e) => e.type)).toEqual([
      'scene-changed',
      'answer',
    ]);
  });

  it('Back from an answered card and Next again reopens it answered, never asking twice', () => {
    const s = atCheckpoint();
    const cards = tapCheckpoint(NO_CHECKPOINT_CARDS, item, 't').cards;
    const scene = reduceReader(s, { type: 'back' }).state;
    expect(scene.phase).toBe('scene');
    const reopened = reduceReader(scene, { type: 'next' }).state;
    expect(reopened.phase).toBe('checkpoint');
    expect(checkpointAnswered(cardsAfterReader(cards, { type: 'next' }), item)).toBe(true);
  });
});

describe('copy and announcements', () => {
  it('heads the card "Quick question" in a quest and "Try it" in a replay (unscored)', () => {
    expect(checkpointHeading('quest', readerCopy)).toBe('Quick question');
    expect(checkpointHeading('replay', readerCopy)).toBe('Try it');
  });

  it('announces the heading, then the question with its Korean', () => {
    const { story, tier } = listenTier();
    expect(checkpointAnnouncement('Quick question', checkpointItem(story, tier, 'cp1')!)).toBe(
      'Quick question. Was the alphabet made to be easy to learn?',
    );
    expect(checkpointAnnouncement('Try it', buildCheckView(pickCheck, story.id))).toBe('Try it. What does 한글 mean?');
  });

  it('keeps the romanization reveal of a card apart from the scene items', () => {
    expect(checkpointRevealId('cp1')).toBe('cp:cp1');
  });
});

describe('checkpointSpeech (the card speaks through the reader, §3.4)', () => {
  const { story } = listenTier();
  const pick = buildCheckView(pickCheck, story.id);

  it('reads the question (its Korean in a Korean voice), then the options, as the reader surface', () => {
    const speech = checkpointSpeech(pick, pick, 'en-US');
    expect(speech.question.map((s) => [s.text, s.language, s.kind])).toEqual([
      ['What does ', 'en-US', 'sentence'],
      ['한글', 'ko-KR', 'word'],
      [' mean?', 'en-US', 'sentence'],
    ]);
    expect(speech.options.map((s) => s.text)).toEqual(pick.options.map((o) => o.en));
    expect(speech.target).toMatchObject({ text: '한글', language: 'ko-KR', kind: 'word' });
    const all = [...speech.question, ...speech.options, speech.target!];
    expect(all.every((s) => s.source === STORY_READER_AUDIO_SOURCE)).toBe(true);
  });

  it('a translated prompt is read in the UI voice; English stays English; no target, no target step', () => {
    const shown = { ...pick, promptParts: [{ text: '¿Qué significa ' }, ...pick.promptParts.slice(1)] };
    expect(checkpointSpeech(shown, pick, 'es-US').question[0]).toMatchObject({ language: 'es-US' });
    expect(checkpointSpeech(pick, pick, 'es-US').question[0]).toMatchObject({ language: 'en-US' });
    const { tier } = listenTier();
    expect(checkpointSpeech(checkpointItem(story, tier, 'cp1')!, undefined, 'en-US').target).toBeNull();
  });
});
