import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { buildsFor, type BuildName, type SlideBody } from '../build-steps';
import { lectureBundle } from '../content';
import { expandDeck, type Slide } from '../deck-builder';
import {
  activityTimerMs,
  cardView,
  markerFor,
  romShown,
  sequenceView,
  shownBuilds,
  slideSound,
  soundFlashFor,
  soundPress,
  soundPrompt,
  syllableView,
  vocabArt,
} from '../slide-view';

/**
 * What the PR 7 slides show at each build (F-TCH-004 section 3.4; design/screens/presenter/
 * slide-syllable.md, slide-vocab.md, slide-sequence.md, slide-card.md, slide-activity.md): pure
 * decisions the slide components draw, tested over real `expandDeck` output.
 */

const SHAPES = ['circle', 'triangle', 'square', 'star'] as const;

function deckOf(blocks: LectureBlock[]) {
  return LectureDeckSchema.parse({ v: 1, id: 'lecture:view001', title: 'Week 3', createdAt: '2026-10-13T09:00:00Z', seed: 7, blocks });
}

function slidesOf(blocks: LectureBlock[]): Slide[] {
  return expandDeck(deckOf(blocks), lectureBundle('en'), { canPlayKorean: true }).slides;
}

function first<K extends Slide['kind']>(slides: Slide[], kind: K): Extract<Slide, { kind: K }> {
  const found = slides.find((s) => s.kind === kind);
  if (!found) throw new Error(`no ${kind} slide`);
  return found as Extract<Slide, { kind: K }>;
}

const tapBuilds = (body: SlideBody): BuildName[] => buildsFor(body, { romanization: 'tap', strokeGuide: true });

describe('shownBuilds', () => {
  it('is build 0 to the current reveal', () => {
    expect([...shownBuilds(['parts', 'join', 'rom', 'sound'], 0)]).toEqual(['parts']);
    expect([...shownBuilds(['parts', 'join', 'rom', 'sound'], 2)]).toEqual(['parts', 'join', 'rom']);
    expect([...shownBuilds(['step', 'step', 'order'], 1)]).toEqual(['step']);
  });
});

describe('romShown', () => {
  it('comes with the Korean by default, at its own build with tap (D2)', () => {
    expect(romShown(['ko', 'gloss'], new Set<BuildName>(['ko']), 'ko')).toBe(true);
    expect(romShown(['ko', 'rom', 'gloss'], new Set<BuildName>(['ko']), 'ko')).toBe(false);
    expect(romShown(['ko', 'rom', 'gloss'], new Set<BuildName>(['ko', 'rom']), 'ko')).toBe(true);
    expect(romShown(['ko', 'gloss'], new Set<BuildName>(), 'ko')).toBe(false);
  });
});

describe('syllableView: the parts become the block (README D5)', () => {
  const syllable = first(slidesOf([{ kind: 'quest', id: 'quest:stage1-letters-q1' }]), 'syllable');

  it('the builder gives a real syllable with its parts and four builds', () => {
    expect(syllable.parts.length).toBeGreaterThanOrEqual(2);
    expect(syllable.builds).toEqual(['parts', 'join', 'rom', 'sound']);
  });

  it('build 0 shows only the parts; join replaces them with the block; rom and sound follow', () => {
    expect(syllableView(syllable, 0)).toEqual({ joined: false, rom: false, sound: false });
    expect(syllableView(syllable, 1)).toEqual({ joined: true, rom: false, sound: false });
    expect(syllableView(syllable, 2)).toEqual({ joined: true, rom: true, sound: false });
    expect(syllableView(syllable, 3)).toEqual({ joined: true, rom: true, sound: true });
  });
});

describe('sequenceView', () => {
  const sequence = first(slidesOf([{ kind: 'quest', id: 'quest:stage1-rites-q3' }]), 'sequence');

  it('reveals the steps in their true order one build at a time, then asks what comes first', () => {
    const n = sequence.steps.length;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(sequenceView(sequence, 0)).toEqual({ mode: 'steps', count: 1, rom: true });
    expect(sequenceView(sequence, n - 1)).toEqual({ mode: 'steps', count: n, rom: true });
    const order = sequenceView(sequence, n);
    expect(order.mode).toBe('order');
    if (order.mode !== 'order') return;
    // The builder's shuffled order, each step once, never the true order (a derangement).
    expect(order.steps.map((s) => s.id)).toEqual(sequence.shuffled);
    expect(new Set(order.steps.map((s) => s.id))).toEqual(new Set(sequence.steps.map((s) => s.id)));
    expect(order.steps.map((s) => s.id)).not.toEqual(sequence.steps.map((s) => s.id));
  });

  it('with tap, every romanization appears at one build before the question', () => {
    const tap = { ...sequence, builds: tapBuilds(sequence) };
    const n = sequence.steps.length;
    expect(tap.builds.at(-2)).toBe('rom');
    expect(sequenceView(tap, n - 1)).toEqual({ mode: 'steps', count: n, rom: false });
    expect(sequenceView(tap, n)).toEqual({ mode: 'steps', count: n, rom: true });
    expect(sequenceView(tap, n + 1).mode).toBe('order');
  });

  it('a shuffled id the steps do not hold is left out', () => {
    const odd = { ...sequence, shuffled: [...sequence.shuffled, 'nope'] };
    const order = sequenceView(odd, odd.builds.length - 1);
    expect(order.mode === 'order' ? order.steps.length : 0).toBe(sequence.steps.length);
  });
});

describe('cardView', () => {
  const card = first(slidesOf([{ kind: 'cards', cardIds: ['card:book'] }]), 'card');

  it('art first with the title and the Korean chip, then the fact', () => {
    expect(card.builds).toEqual(['art', 'fact']);
    expect(cardView(card, 0)).toEqual({ rom: true, fact: false });
    expect(cardView(card, 1)).toEqual({ rom: true, fact: true });
  });

  it('with tap the chip romanization is its own build', () => {
    const tap = { ...card, builds: tapBuilds(card) };
    expect(tap.builds).toEqual(['art', 'rom', 'fact']);
    expect(cardView(tap, 0)).toEqual({ rom: false, fact: false });
    expect(cardView(tap, 1)).toEqual({ rom: true, fact: false });
    expect(cardView(tap, 2)).toEqual({ rom: true, fact: true });
  });
});

describe('vocabArt', () => {
  const supported = ['card:kimchi', 'card:book'];
  const keys = ['food-apple', 'food-milk'];
  const vocab = first(slidesOf([{ kind: 'quest', id: 'quest:stage1-life-q1' }]), 'vocab');

  it('a quest word has no picture: text only', () => {
    expect(vocabArt(vocab, supported, keys)).toBeUndefined();
  });

  it('a word with a drawn card shows that card; an undrawn card shows none', () => {
    expect(vocabArt({ ...vocab, cardId: 'card:kimchi' }, supported, keys)).toEqual({ kind: 'card', cardId: 'card:kimchi' });
    expect(vocabArt({ ...vocab, cardId: 'card:nope' }, supported, keys)).toBeUndefined();
  });

  it('a topic word shows its WordArt when the glyph exists (README D9); an unknown key shows none', () => {
    expect(vocabArt({ ...vocab, wordArt: 'food-apple' }, supported, keys)).toEqual({ kind: 'word', key: 'food-apple' });
    expect(vocabArt({ ...vocab, wordArt: 'food-nope' }, supported, keys)).toBeUndefined();
  });

  it('the Food topic words of the real bundle draw a picture at their art build', () => {
    const slides = slidesOf([{ kind: 'vocab', topicId: 'vocab-topic:food' }]);
    const apple = slides.find((s): s is Extract<Slide, { kind: 'vocab' }> => s.kind === 'vocab' && s.wordId === 'vocab:sagwa-apple')!;
    expect(apple.builds).toEqual(['ko', 'gloss', 'art']);
    expect(vocabArt(apple, supported, [...keys])).toEqual({ kind: 'word', key: 'food-apple' });
  });
});

describe('markerFor', () => {
  it('pairs a shape with a number: circle 1, triangle 2, square 3, star 4', () => {
    expect([0, 1, 2, 3].map((i) => markerFor(i, SHAPES))).toEqual([
      { shape: 'circle', n: 1 },
      { shape: 'triangle', n: 2 },
      { shape: 'square', n: 3 },
      { shape: 'star', n: 4 },
    ]);
  });

  it('past four the shapes repeat and the number keeps counting, so every marker stays distinct', () => {
    expect(markerFor(4, SHAPES)).toEqual({ shape: 'circle', n: 5 });
    expect(markerFor(6, SHAPES)).toEqual({ shape: 'square', n: 7 });
  });
});

describe('activityTimerMs', () => {
  it('is the slide minutes in milliseconds; the timer never starts by itself', () => {
    const activity = first(slidesOf([{ kind: 'activity', preset: 'air-write', minutes: 3 }, { kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]), 'activity');
    expect(activity.builds).toEqual(['prompt']);
    expect(activityTimerMs(activity)).toBe(180_000);
    expect(activityTimerMs({ ...activity, minutes: 1 })).toBe(60_000);
  });
});

describe('slideSound: what Sound, S and a stage speaker play (section 3.4 amendment 2026-10-17)', () => {
  const question = ['question', 'answer'] as const;
  const quiz = (prompt: Extract<Slide, { kind: 'quiz' }>['prompt']): Slide => ({ kind: 'quiz', key: `q/${prompt.ask}`, builds: [...question], prompt, options: [], textPrompt: false });
  const lunch = slidesOf([{ kind: 'quest', id: 'quest:stage2-life-q1' }]);

  it('the owner report: the gimbap word card plays its word at the word rate', () => {
    const gimbap = lunch.find((s) => s.kind === 'vocab' && s.word.ko === '김밥');
    expect(gimbap?.key).toBe('quest:stage2-life-q1/s2/김밥');
    expect(slideSound(gimbap)).toEqual({ spoken: { text: '김밥', romanization: 'gimbap' }, kind: 'word' });
    // At every build of the card, the word is on screen.
    for (let reveal = 0; reveal < gimbap!.builds.length; reveal++) expect(slideSound(gimbap, reveal)?.spoken.text).toBe('김밥');
  });

  it('a word card plays its spoken form at its own rate: a Discover sentence at the sentence rate', () => {
    const word = first(lunch, 'vocab');
    const spoken = { text: '안녕하세요', romanization: 'annyeonghaseyo', audioRef: 'audio/vocab/annyeong.mp3' };
    expect(slideSound({ ...word, spoken, speech: 'sentence' })).toEqual({ spoken, kind: 'sentence' });
  });

  it('a letter, a syllable and a Match Sound question play at the sound rate', () => {
    const slides = slidesOf([{ kind: 'quest', id: 'quest:stage1-letters-q1' }]);
    const letter = first(slides, 'letter');
    const syllable = first(slides, 'syllable');
    expect(slideSound(letter)).toEqual({ spoken: letter.spoken, kind: 'sound' });
    expect(slideSound(syllable)).toEqual({ spoken: { text: syllable.ko, romanization: syllable.romanization }, kind: 'sound' });
    const spoken = { text: '가', romanization: 'ga' };
    expect(slideSound(quiz({ ask: 'sound', spoken }))).toEqual({ spoken, kind: 'sound' });
  });

  it('a heritage card plays its Korean chip; a card without Korean plays nothing', () => {
    const card = first(lunch, 'card');
    expect(card).toMatchObject({ ko: '도시락', romanization: 'dosirak' });
    expect(slideSound(card)).toEqual({ spoken: { text: '도시락', romanization: 'dosirak' }, kind: 'word' });
    expect(slideSound({ kind: 'card', key: 'c/plain', builds: ['art'], cardId: 'card:plain', title: 'Plain' })).toBeUndefined();
  });

  it('a word-to-meaning question plays its word; a story check its target word, none without one', () => {
    const meaning = lunch.find((s) => s.kind === 'quiz' && s.prompt.ask === 'meaning');
    if (meaning?.kind !== 'quiz' || meaning.prompt.ask !== 'meaning') throw new Error('no meaning question');
    expect(slideSound(meaning)).toEqual({ spoken: { text: meaning.prompt.ko, romanization: meaning.prompt.romanization }, kind: 'word' });
    const target = { ko: '해', romanization: 'hae', gloss: 'sun' };
    expect(slideSound(quiz({ ask: 'check', text: 'What is {target}?', target }))).toEqual({ spoken: { text: '해', romanization: 'hae' }, kind: 'word' });
    expect(slideSound(quiz({ ask: 'check', text: 'What happened first?' }))).toBeUndefined();
  });

  it('an order slide plays the last Korean step on screen at the reveal, at the sentence rate', () => {
    const steps = [
      { id: 'a', gloss: 'Wash hands', ko: '손 씻기', romanization: 'son ssitgi' },
      { id: 'b', gloss: 'Set the table', ko: '상 차리기', romanization: 'sang charigi' },
      { id: 'c', gloss: 'Eat together' },
    ];
    const body: SlideBody = { kind: 'sequence', steps, shuffled: ['c', 'a', 'b'] };
    const always: Slide = { ...body, key: 's/1', builds: buildsFor(body, { romanization: 'always', strokeGuide: true }) };
    const tap: Slide = { ...body, key: 's/2', builds: tapBuilds(body) };
    expect(always.builds).toEqual(['step', 'step', 'step', 'order']);
    const said = (slide: Slide, reveal?: number) => slideSound(slide, reveal)?.spoken.text;
    expect([0, 1, 2, 3].map((r) => said(always, r))).toEqual(['손 씻기', '상 차리기', '상 차리기', '상 차리기']);
    expect(said(always)).toBe('상 차리기');
    expect(tap.builds).toEqual(['step', 'step', 'step', 'rom', 'order']);
    expect([0, 1, 4].map((r) => said(tap, r))).toEqual(['손 씻기', '상 차리기', '상 차리기']);
    expect(slideSound(always, 0)).toEqual({ spoken: { text: '손 씻기', romanization: 'son ssitgi' }, kind: 'sentence' });
    // A first step with no Korean: nothing to play until a Korean step is on screen.
    const glossFirst: SlideBody = { kind: 'sequence', steps: [steps[2]!, steps[0]!], shuffled: ['a', 'c'] };
    const late: Slide = { ...glossFirst, key: 's/3', builds: buildsFor(glossFirst, { romanization: 'always', strokeGuide: true }) };
    expect(slideSound(late, 0)).toBeUndefined();
    expect(said(late, 1)).toBe('손 씻기');
  });

  it('a title, a story scene, an activity, the End slide and Odd One Out play nothing; no slide plays nothing', () => {
    const slides = slidesOf([
      { kind: 'quest', id: 'quest:stage1-letters-q1' },
      { kind: 'activity', preset: 'air-write', minutes: 3 },
    ]);
    expect(slideSound(first(slides, 'title'))).toBeUndefined();
    expect(slideSound(first(slides, 'activity'))).toBeUndefined();
    expect(slideSound(first(slides, 'end'))).toBeUndefined();
    expect(slideSound(quiz({ ask: 'odd-one-out' }))).toBeUndefined();
    const story: Slide = { kind: 'story', key: 'st/1', builds: ['art', 'narration'], storyId: 'story:x', sceneId: 's1', narration: [{ text: 'Once.' }], korean: { ko: '해', romanization: 'hae', gloss: 'sun' } };
    expect(slideSound(story)).toBeUndefined();
    expect(slideSound(undefined)).toBeUndefined();
  });
});

describe('soundPress: an explicit press always answers (section 3.7 amendment 2026-10-17)', () => {
  it.each([
    // hasSound, explicit, muted, deckSound -> what happens
    [true, true, false, true, 'play'],
    [true, false, false, true, 'play'],
    [true, true, true, true, 'unmute-then-play'],
    [true, false, true, true, 'skip'],
    [false, true, false, true, 'flash-no-sound'],
    [false, true, true, true, 'flash-no-sound'],
    [false, false, false, true, 'skip'],
    [false, false, true, true, 'skip'],
    [true, true, false, false, 'flash-no-sound'],
    [true, true, true, false, 'flash-no-sound'],
    [true, false, false, false, 'skip'],
    [false, true, false, false, 'flash-no-sound'],
    [false, false, true, false, 'skip'],
  ] as const)('hasSound %s, explicit %s, muted %s, deck sound %s: %s', (hasSound, explicit, muted, deckSound, expected) => {
    expect(soundPress({ hasSound, explicit, muted, deckSound })).toBe(expected);
  });
});

describe('soundFlashFor: the flash after an explicit press that did not play', () => {
  it.each([
    ['played', null, null],
    ['played', 'blocked', null],
    ['muted', 'muted', null],
    ['unavailable', 'no_voice', 'no-voice'],
    ['unavailable', 'blocked', 'failed'],
    ['unavailable', 'error', 'failed'],
    ['unavailable', null, 'failed'],
  ] as const)('%s with %s: %s', (result, reason, expected) => {
    expect(soundFlashFor(result, reason)).toBe(expected);
  });
});

describe('soundPrompt: the playPrompt spec of a slide sound', () => {
  it('carries the clip only when there is one, and the rate kind', () => {
    expect(soundPrompt({ spoken: { text: '김밥', romanization: 'gimbap' }, kind: 'word' })).toEqual({ text: '김밥', kind: 'word' });
    expect(soundPrompt({ spoken: { text: '가', romanization: 'ga', audioRef: 'audio/jamo/giyeok.mp3' }, kind: 'sound' })).toEqual({ text: '가', audioRef: 'audio/jamo/giyeok.mp3', kind: 'sound' });
  });
});
