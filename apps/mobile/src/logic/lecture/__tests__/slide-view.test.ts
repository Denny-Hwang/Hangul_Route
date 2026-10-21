import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { buildsFor, type BuildName, type SlideBody } from '../build-steps';
import { lectureBundle } from '../content';
import { expandDeck, type Slide } from '../deck-builder';
import {
  activityTimerMs,
  buildMove,
  buildPlaceWidth,
  linePlaceSize,
  cardView,
  frameSpoken,
  markerFor,
  nextFitLevel,
  patternView,
  readAlongView,
  realiaView,
  romShown,
  sentenceBuildView,
  sentenceView,
  sheetRoomy,
  sheetUnits,
  sequenceView,
  shownBuilds,
  slideSound,
  soundFlashFor,
  soundPress,
  soundPrompt,
  syllableView,
  soundTablePage,
  vocabArt,
  writeView,
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

function slidesOf(blocks: LectureBlock[], canPlayKorean = true): Slide[] {
  return expandDeck(deckOf(blocks), lectureBundle('en'), { canPlayKorean }).slides;
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

  it('an order slide plays the last Korean step on screen at the reveal, in the order drawn, at the sentence rate', () => {
    const steps = [
      { id: 'a', gloss: 'Wash hands', ko: '손 씻기', romanization: 'son ssitgi' },
      { id: 'b', gloss: 'Set the table', ko: '상 차리기', romanization: 'sang charigi' },
      { id: 'c', gloss: 'Eat together' },
    ];
    // The order question draws b, a, c: its last Korean step on screen is a, not the story's last (b).
    const body: SlideBody = { kind: 'sequence', steps, shuffled: ['b', 'a', 'c'] };
    const always: Slide = { ...body, key: 's/1', builds: buildsFor(body, { romanization: 'always', strokeGuide: true }) };
    const tap: Slide = { ...body, key: 's/2', builds: tapBuilds(body) };
    expect(always.builds).toEqual(['step', 'step', 'step', 'order']);
    const said = (slide: Slide, reveal?: number) => slideSound(slide, reveal)?.spoken.text;
    expect([0, 1, 2, 3].map((r) => said(always, r))).toEqual(['손 씻기', '상 차리기', '상 차리기', '손 씻기']);
    // The full reveal is the order question.
    expect(said(always)).toBe('손 씻기');
    expect(tap.builds).toEqual(['step', 'step', 'step', 'rom', 'order']);
    expect([0, 1, 3, 4].map((r) => said(tap, r))).toEqual(['손 씻기', '상 차리기', '상 차리기', '손 씻기']);
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
    const story: Slide = { kind: 'story', key: 'st/1', builds: ['art', 'narration'], storyId: 'story:x', sceneId: 's1', narration: [{ text: 'Once.' }], korean: { ko: '해', romanization: 'hae', gloss: 'sun', speech: 'word' } };
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
    // A lesson set up with sound off says so, whatever the slide (it is not "this slide has no sound").
    [true, true, false, false, 'flash-deck-sound-off'],
    [true, true, true, false, 'flash-deck-sound-off'],
    [true, false, false, false, 'skip'],
    [false, true, false, false, 'flash-deck-sound-off'],
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

describe('the reading slides at each build (AMENDMENTS-LECTURE-V2 section 5.2, LV-S1; shipped content)', () => {
  const TAP = { romanization: 'tap', strokeGuide: true } as const;
  const tapped = <S extends Slide>(slide: S): S => ({ ...slide, builds: buildsFor(slide, TAP) });
  const stage3 = slidesOf([{ kind: 'quest', id: 'quest:stage3-life-q1' }]);
  const stage4 = slidesOf([{ kind: 'quest', id: 'quest:stage4-life-q1' }]);
  const stage6 = slidesOf([{ kind: 'quest', id: 'quest:stage6-life-q1' }]);

  it('sentence: the Korean with its romanization, then the meaning, then the picture; tap: the romanization at its own build', () => {
    const slide = first(stage3, 'sentence');
    expect(slide.sentence.ko).toBe('물을 마셔요.');
    expect(sentenceView(slide, 0)).toEqual({ rom: true, gloss: false, art: false });
    expect(sentenceView(slide, 2)).toEqual({ rom: true, gloss: true, art: true });
    expect(sentenceView(tapped(slide), 0)).toEqual({ rom: false, gloss: false, art: false });
    expect(sentenceView(tapped(slide), 1)).toEqual({ rom: true, gloss: false, art: false });
  });

  it('pattern: frame, note, one example per build; tap: each romanization one build later', () => {
    const slide = first(stage3, 'pattern');
    expect(slide.frame.pieces).toEqual(['', '을/를 먹어요.']);
    expect(patternView(slide, 0)).toEqual({ frame: { shown: true, rom: true }, note: { shown: false, rom: false }, examples: [{ shown: false, rom: false }, { shown: false, rom: false }] });
    expect(patternView(slide, 3).examples).toEqual([{ shown: true, rom: true }, { shown: true, rom: true }]);
    const tap = tapped(slide);
    expect(patternView(tap, 0).frame).toEqual({ shown: true, rom: false });
    expect(patternView(tap, 1).frame).toEqual({ shown: true, rom: true });
    expect(patternView(tap, 4).examples[0]).toEqual({ shown: true, rom: false });
    expect(patternView(tap, 5).examples[0]).toEqual({ shown: true, rom: true });
  });

  it('read along: one line per build, the current line is the last one shown; tap: each romanization one build later', () => {
    const slide = first(stage4, 'read-along');
    expect(slide.lines.map((l) => l.speaker)).toHaveLength(2);
    expect(readAlongView(slide, 0)).toEqual({ lines: [{ shown: true, rom: true }, { shown: false, rom: false }], current: 0 });
    expect(readAlongView(slide, 1)).toEqual({ lines: [{ shown: true, rom: true }, { shown: true, rom: true }], current: 1 });
    expect(readAlongView(tapped(slide), 2)).toEqual({ lines: [{ shown: true, rom: true }, { shown: true, rom: false }], current: 1 });
  });

  it('read along with no Korean voice: every line shows at once and none is lit (section 5.1); tap: their romanization one build later', () => {
    const slide = first(slidesOf([{ kind: 'quest', id: 'quest:stage4-life-q1' }], false), 'read-along');
    expect(slide.together).toBe(true);
    expect(slide.builds).toEqual(['line']);
    expect(readAlongView(slide, 0)).toEqual({ lines: [{ shown: true, rom: true }, { shown: true, rom: true }], current: null });
    const tap = tapped(slide);
    expect(tap.builds).toEqual(['line', 'rom']);
    expect(readAlongView(tap, 0)).toEqual({ lines: [{ shown: true, rom: false }, { shown: true, rom: false }], current: null });
    expect(readAlongView(tap, 1)).toEqual({ lines: [{ shown: true, rom: true }, { shown: true, rom: true }], current: null });
  });

  it('realia: the sheet, then the key words; tap: the sheet romanization, then the key words, then theirs', () => {
    const slide = first(stage6, 'realia');
    expect(realiaView(slide, 0)).toEqual({ sheetRom: true, words: false, wordsRom: false });
    expect(realiaView(slide, 1)).toEqual({ sheetRom: true, words: true, wordsRom: true });
    const tap = tapped(slide);
    expect(realiaView(tap, 0)).toEqual({ sheetRom: false, words: false, wordsRom: false });
    expect(realiaView(tap, 1)).toEqual({ sheetRom: true, words: false, wordsRom: false });
    expect(realiaView(tap, 2)).toEqual({ sheetRom: true, words: true, wordsRom: false });
    expect(realiaView(tap, 3)).toEqual({ sheetRom: true, words: true, wordsRom: true });
  });

  it('a sheet of up to four lines puts each romanization under its Korean; a longer one (a five-board trail sign) beside it', () => {
    const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, text: { ko: '강', romanization: 'gang' } }));
    expect(sheetRoomy({ entries: entries(4) })).toBe(true);
    expect(sheetRoomy({ entries: entries(5) })).toBe(false);
    const sign = slidesOf([{ kind: 'quest', id: 'quest:stage6-nature-q1' }]).find((s): s is Extract<Slide, { kind: 'realia' }> => s.kind === 'realia');
    expect(sign?.sheet.kind).toBe('sign');
    expect(sheetRoomy(sign!.sheet)).toBe(false);
    expect(sheetRoomy(first(stage6, 'realia').sheet)).toBe(true);
  });

  it('a sheet is 420 units wide on the stage; price cards side by side take 600', () => {
    expect(sheetUnits({ kind: 'menu' })).toBe(420);
    expect(sheetUnits({ kind: 'sign' })).toBe(420);
    expect(sheetUnits({ kind: 'plain' })).toBe(420);
    expect(sheetUnits({ kind: 'price-card' })).toBe(600);
  });

  it('a sheet grows with its floored text on a small phone, up to 700 units', () => {
    // 568 x 320: a unit of 0.44 px draws the 28-unit caption at the 18 px floor, 1.45 times its units.
    expect(sheetUnits({ kind: 'menu' }, 18 / (0.44375 * 28))).toBe(608);
    expect(sheetUnits({ kind: 'price-card' }, 18 / (0.44375 * 28))).toBe(700);
    expect(sheetUnits({ kind: 'menu' }, 0.5)).toBe(420);
  });

  it('Sound: a sentence its sentence; a pattern the last Korean part on screen: the frame, the note chips, then each example', () => {
    const sentence = first(stage3, 'sentence');
    expect(slideSound(sentence, 0)).toEqual({ spoken: sentence.sentence.spoken, kind: 'sentence' });
    const pattern = first(stage3, 'pattern');
    // The frame's own Korean, a pause at the gap and between the two particles.
    expect(slideSound(pattern, 0)).toEqual({ spoken: { text: '을, 를 먹어요.', romanization: 'eul, reul meogeoyo' }, kind: 'sentence' });
    // The note's Korean chips, each once, at the word rate.
    expect(slideSound(pattern, 1)).toEqual({ spoken: { text: '을, 를', romanization: 'eul, reul' }, kind: 'word' });
    expect(slideSound(pattern, 2)).toEqual({ spoken: pattern.examples[0]!.spoken, kind: 'sentence' });
    expect(slideSound(pattern)).toEqual({ spoken: pattern.examples[1]!.spoken, kind: 'sentence' });
    // tap: the romanization builds keep the part before them.
    const tap = tapped(pattern);
    expect(tap.builds).toEqual(['frame', 'rom', 'note', 'rom', 'example', 'rom', 'example', 'rom']);
    expect(slideSound(tap, 1)?.spoken.text).toBe('을, 를 먹어요.');
    expect(slideSound(tap, 3)?.spoken.text).toBe('을, 를');
    expect(slideSound(tap, 5)).toEqual({ spoken: pattern.examples[0]!.spoken, kind: 'sentence' });
  });

  it('frameSpoken: a gap at the start, the middle or the end is a pause; a piece of only punctuation is dropped', () => {
    expect(frameSpoken({ pieces: ['', '이/가 있어요.'], romanization: '___i/ga isseoyo', gloss: 'There is ___.' })).toEqual({ text: '이, 가 있어요.', romanization: 'i, ga isseoyo' });
    expect(frameSpoken({ pieces: ['먼저 ', '.'], romanization: 'meonjeo ___', gloss: 'First, ___.' })).toEqual({ text: '먼저', romanization: 'meonjeo' });
    expect(frameSpoken({ pieces: ['', '에 ', '을/를 먹었어요.'], romanization: '___e ___eul/reul meogeosseoyo', gloss: 'I ate ___ on ___.' })).toEqual({
      text: '에, 을, 를 먹었어요.',
      romanization: 'e, eul, reul meogeosseoyo',
    });
  });

  it('Sound: read along its current line, or every line in order when they show together (no Korean voice)', () => {
    const readAlong = first(stage4, 'read-along');
    expect(slideSound(readAlong, 0)).toEqual({ spoken: readAlong.lines[0]!.spoken, kind: 'sentence' });
    expect(slideSound(readAlong)).toEqual({ spoken: readAlong.lines[1]!.spoken, kind: 'sentence' });
    const together = first(slidesOf([{ kind: 'quest', id: 'quest:stage4-life-q1' }], false), 'read-along');
    expect(slideSound(together, 0)).toEqual({
      spoken: { text: together.lines.map((l) => l.spoken.text).join(', '), romanization: together.lines.map((l) => l.spoken.romanization).join(', ') },
      kind: 'sentence',
    });
  });

  it('Sound: a realia page its sheet and its caption chips, then its key words once they show', () => {
    const realia = first(stage6, 'realia');
    expect(slideSound(realia, 0)).toEqual({ spoken: realia.sheet.spoken, kind: 'word' });
    // A caption with Korean chips: the sheet, then each chip once, in order.
    const priced = slidesOf([{ kind: 'quest', id: 'quest:stage6-crafts-q1' }]).find(
      (s): s is Extract<Slide, { kind: 'realia' }> => s.kind === 'realia' && s.caption?.some((p) => 'ko' in p) === true,
    );
    expect(priced).toBeDefined();
    const chips = [...new Set(priced!.caption!.flatMap((p) => ('ko' in p ? [p.ko] : [])))];
    expect(slideSound(priced!, 0)?.spoken.text).toBe([priced!.sheet.spoken.text, ...chips].join(', '));
    expect(slideSound(realia)).toEqual({
      spoken: { text: realia.keyWords.map((w) => w.spoken.text).join(', '), romanization: realia.keyWords.map((w) => w.spoken.romanization).join(', ') },
      kind: 'word',
    });
  });
});

describe('the question slides on shipped content (AMENDMENTS-LECTURE-V2 sections 5.1 and 5.2, LV-S2)', () => {
  const stage1 = slidesOf([{ kind: 'quest', id: 'quest:stage1-letters-q1' }]);
  const stage3 = slidesOf([{ kind: 'quest', id: 'quest:stage3-life-q1' }]);
  const stage4 = slidesOf([{ kind: 'quest', id: 'quest:stage4-life-q1' }]);
  const stage6 = slidesOf([{ kind: 'quest', id: 'quest:stage6-life-q3' }]);
  type Quiz = Extract<Slide, { kind: 'quiz' }>;
  const asked = (slides: Slide[], ask: Quiz['prompt']['ask']): Quiz[] => slides.filter((s): s is Quiz => s.kind === 'quiz' && s.prompt.ask === ask);

  it('a Stage 1 Check: a letter round plays its carrier syllable at the sound rate, a word round its word', () => {
    const [sym, word] = asked(stage1, 'listen');
    expect(slideSound(sym)).toEqual({ spoken: { text: '어', romanization: 'eo', audioRef: 'audio/jamo/eo.mp3' }, kind: 'sound' });
    expect(slideSound(word)?.kind).toBe('word');
    expect(slideSound(word)?.spoken.text).toBe((word!.prompt as Extract<Quiz['prompt'], { ask: 'listen' }>).line.ko);
  });

  it('a listen question plays its prompt (a sentence at the sentence rate) at every build: the room hears it before it answers', () => {
    const listen = asked(stage3, 'listen');
    expect(listen.length).toBeGreaterThan(0);
    for (const slide of listen) {
      const prompt = slide.prompt as Extract<Quiz['prompt'], { ask: 'listen' }>;
      expect(slideSound(slide, 0)).toEqual({ spoken: prompt.line.spoken, kind: prompt.speech });
      expect(slideSound(slide, 0)).toEqual(slideSound(slide, 1));
    }
  });

  it("a reply question plays the other speaker's line at the sentence rate", () => {
    const [reply] = asked(stage4, 'reply');
    const prompt = reply!.prompt as Extract<Quiz['prompt'], { ask: 'reply' }>;
    expect(prompt.line.ko).toBe('밥 먹었어요?');
    expect(slideSound(reply)).toEqual({ spoken: prompt.line.spoken, kind: 'sentence' });
  });

  it('a realia question plays its key word, else its sheet line by line, at the word rate', () => {
    const realia = asked(stage6, 'realia');
    expect(realia.length).toBeGreaterThan(0);
    for (const slide of realia) {
      const prompt = slide.prompt as Extract<Quiz['prompt'], { ask: 'realia' }>;
      expect(slideSound(slide)).toEqual({ spoken: prompt.key?.spoken ?? prompt.sheet.spoken, kind: 'word' });
    }
  });
});

describe('the sentence build at each build (AMENDMENTS-LECTURE-V2 section 5.2, LV-S3; V9)', () => {
  type Build = Extract<Slide, { kind: 'sentence-build' }>;
  const builds = slidesOf([{ kind: 'quest', id: 'quest:stage3-life-q3' }, { kind: 'quest', id: 'quest:stage7-life-q2' }]).filter((s): s is Build => s.kind === 'sentence-build');
  const plain = builds.find((s) => s.sentence.ko === '친구가 학교에 가요.')!;
  const particle = builds.find((s) => s.sentence.ko === '저녁에 달걀을 먹어요.')!;
  const bankOf = (slide: Build, reveal: number) => {
    const view = sentenceBuildView(slide, reveal);
    return slide.bank.map((place, i) => [('tile' in place ? slide.tiles[place.tile]!.ko : place.distractor.ko), view.bank[i]]);
  };

  it('the bank: every line place empty, every tile in the bank, the next-word question, no meaning yet', () => {
    expect(sentenceBuildView(plain, 0)).toEqual({ line: ['empty', 'empty', 'empty'], bank: ['tile', 'tile', 'tile', 'tile'], ask: 'next', whole: false });
  });

  it('each tile build moves the next tile to the line and leaves its ghost; the distractor stays in the bank', () => {
    const two = sentenceBuildView(plain, 2);
    expect(two.line).toEqual(['placed', 'placed', 'empty']);
    expect(Object.fromEntries(bankOf(plain, 2))).toEqual({ 친구가: 'ghost', 학교에: 'ghost', 가요: 'tile', 와요: 'tile' });
    expect(two.ask).toBe('next');
  });

  it('the whole build: every tile placed, the meaning shows, no question, and the distractor is set back (never marked)', () => {
    const whole = sentenceBuildView(plain, plain.builds.length - 1);
    expect(whole).toEqual({ line: ['placed', 'placed', 'placed'], bank: expect.any(Array), ask: null, whole: true });
    expect(Object.fromEntries(bankOf(plain, plain.builds.length - 1))).toEqual({ 친구가: 'ghost', 학교에: 'ghost', 가요: 'ghost', 와요: 'set-back' });
    // A reveal past the end is the whole build.
    expect(sentenceBuildView(plain, 99)).toEqual(whole);
  });

  it('a particle tile shows both endings and asks which fits, until its particle build keeps the one that fits', () => {
    expect(particle.builds).toEqual(['bank', 'tile', 'tile', 'particle', 'tile', 'whole']);
    expect(sentenceBuildView(particle, 2)).toMatchObject({ line: ['placed', 'choosing', 'empty'], ask: 'particle', whole: false });
    expect(sentenceBuildView(particle, 3)).toMatchObject({ line: ['placed', 'placed', 'empty'], ask: 'next', whole: false });
    expect(particle.tiles[1]!.particle).toEqual({ stem: '달걀', choices: [{ ko: '을', romanization: 'eul' }, { ko: '를', romanization: 'reul' }], answer: 0 });
  });

  it('what each build moved: nothing at the bank, the tile (a particle tile by its stem, then its word), then the sentence', () => {
    expect(particle.builds.map((_, reveal) => buildMove(particle, reveal))).toEqual([
      null,
      { placed: '저녁에, jeonyeoge' },
      { placed: '달걀' },
      { placed: '달걀을, dalgyareul' },
      { placed: '먹어요, meogeoyo' },
      { whole: '저녁에 달걀을 먹어요., jeonyeoge dalgyareul meogeoyo, In the evening, I eat an egg.' },
    ]);
    expect(buildMove(particle, 99)).toBeNull();
  });

  it('every place on the line is as wide as the widest tile, or the particle tile while both endings show (V9 as built)', () => {
    const sizes = { tile: 80, choice: 56, padX: 24, border: 3, gap: 8, choicePadX: 12 };
    // 친구가 / 학교에 / 가요: three blocks at 80, plus the padding and the border on both sides.
    expect(buildPlaceWidth(plain, sizes)).toBe(3 * 80 + 2 * (24 + 3));
    // 달걀 + 을 / 를 is wider than 저녁에 or 먹어요: the stem, three gaps, the slash and two ending boxes.
    expect(buildPlaceWidth(particle, sizes)).toBe(2 * 80 + 3 * 8 + 56 + 2 * (56 + 2 * (12 + 3)) + 2 * (24 + 3));
    // Smaller text, a smaller place; no tiles, the padding alone.
    expect(buildPlaceWidth(plain, { ...sizes, tile: 40 })).toBe(3 * 40 + 54);
    expect(buildPlaceWidth({ tiles: [] }, sizes)).toBe(54);
  });

  it('a place never leaves the line sideways: wider than the line holds, it takes the line\'s inner width and may grow taller', () => {
    // Fits (or the line not measured yet): the one place size.
    expect(linePlaceSize(294, 120, 1200, 16)).toEqual({ width: 294, height: 120 });
    expect(linePlaceSize(294, 120, 0, 16)).toEqual({ width: 294, height: 120 });
    expect(linePlaceSize(1168, 120, 1200, 16)).toEqual({ width: 1168, height: 120 });
    // An artificially long tile on a phone-sized line: clamped to the inner width, at least a tile tall.
    const long = { tiles: [{ ko: '가나다라마바사아자차카타파하가나다라', romanization: 'ganadara' }] };
    const width = buildPlaceWidth(long, { tile: 80, choice: 56, padX: 24, border: 3, gap: 8, choicePadX: 12 });
    expect(width).toBeGreaterThan(536);
    expect(linePlaceSize(width, 120, 568, 16)).toEqual({ width: 536, minHeight: 120 });
  });

  it('Sound plays the whole sentence at every build (the Hear it of the learner game), at the sentence rate', () => {
    for (const slide of [plain, particle]) {
      for (let reveal = 0; reveal < slide.builds.length; reveal += 1) expect(slideSound(slide, reveal)).toEqual({ spoken: slide.sentence.spoken, kind: 'sentence' });
    }
  });
});

describe('nextFitLevel: a reading slide that fits itself', () => {
  it('steps one level more compact while the content is taller than its room, up to the last level', () => {
    expect(nextFitLevel({ room: 504, content: 560, level: 0, max: 3 })).toBe(1);
    expect(nextFitLevel({ room: 504, content: 560, level: 3, max: 3 })).toBe(3);
    expect(nextFitLevel({ room: 504, content: 505, level: 1, max: 3 })).toBe(1);
    expect(nextFitLevel({ room: 504, content: 400, level: 2, max: 3 })).toBe(2);
  });

  it('waits for both measures', () => {
    expect(nextFitLevel({ room: 0, content: 560, level: 0, max: 3 })).toBe(0);
    expect(nextFitLevel({ room: 504, content: 0, level: 0, max: 3 })).toBe(0);
  });
});

describe('writeView and its sound: the write-together slides (AMENDMENTS-LECTURE-V2 sections 5.2 and 5.3, LV-S4)', () => {
  const line = (ko: string, romanization: string, gloss: string) => ({ ko, romanization, gloss, spoken: { text: ko, romanization } });
  const frame = { pieces: ['아침에 ', '을/를 먹어요.'], romanization: 'achime ___eul/reul meogeoyo', gloss: 'In the morning, I eat ___.' };
  const withBuildsOf = (body: SlideBody): Extract<Slide, { kind: 'write-together' }> =>
    ({ ...body, key: 'w/1', builds: buildsFor(body, { romanization: 'always', strokeGuide: true }) }) as Extract<Slide, { kind: 'write-together' }>;
  const type = withBuildsOf({ kind: 'write-together', variant: 'type', prompt: 'Ask for water.', answer: line('물 주세요', 'mul juseyo', 'Water, please.') });
  const tea = withBuildsOf({ kind: 'write-together', variant: 'type', prompt: 'Type the word for tea', answer: line('차', 'cha', 'tea') });
  const trace = withBuildsOf({ kind: 'write-together', variant: 'trace', word: line('아침', 'achim', 'morning') });
  const filled = withBuildsOf({
    kind: 'write-together',
    variant: 'frame',
    frame,
    banks: [[{ ko: '밥', romanization: 'bap' }, { ko: '빵', romanization: 'ppang' }]],
    example: { ko: '아침에 밥을 먹어요.', romanization: 'achime babeul meogeoyo', spoken: { text: '아침에 밥을 먹어요.', romanization: 'achime babeul meogeoyo' } },
  });
  const groups = Array.from({ length: 7 }, (_, i) => [{ ko: String.fromCharCode(0xac00 + i * 28), romanization: `b${i}` }]);
  const own = withBuildsOf({ kind: 'write-together', variant: 'own-name', frame: { ...frame, pieces: ['제 이름은 ', '이에요/예요.'] }, groups });

  it('type and trace: the answer only at the answer build; its romanization with it, in both modes', () => {
    for (const mode of ['always', 'tap'] as const) {
      expect(writeView(type, 0, mode)).toEqual({ frame: true, bank: false, answer: false, rom: false, page: null });
      expect(writeView(type, 1, mode)).toEqual({ frame: true, bank: false, answer: true, rom: true, page: null });
      expect(writeView(trace, 0, mode).answer).toBe(false);
      expect(writeView(trace, 1, mode)).toMatchObject({ answer: true, rom: true });
    }
  });

  it('frame: the banks, then the example; with tap every romanization waits for the example', () => {
    expect(writeView(filled, 0, 'always')).toEqual({ frame: true, bank: false, answer: false, rom: true, page: null });
    expect(writeView(filled, 1, 'always')).toMatchObject({ bank: true, answer: false, rom: true });
    expect(writeView(filled, 1, 'tap')).toMatchObject({ bank: true, answer: false, rom: false });
    expect(writeView(filled, 2, 'tap')).toMatchObject({ bank: true, answer: true, rom: true });
  });

  it('soundTablePage: five groups a page, and nothing past the last page', () => {
    expect(soundTablePage(groups, 0)).toHaveLength(5);
    expect(soundTablePage(groups, 1)).toEqual(groups.slice(5));
    expect(soundTablePage(groups, 2)).toEqual([]);
  });

  it('the name round: its frame, then each table page in its place; the table always has its romanization', () => {
    expect(writeView(own, 0, 'tap')).toEqual({ frame: true, bank: false, answer: false, rom: true, page: null });
    expect(writeView(own, 1, 'tap')).toEqual({ frame: false, bank: false, answer: false, rom: true, page: 0 });
    expect(writeView(own, 2, 'always')).toMatchObject({ frame: false, page: 1 });
  });

  it('Sound: the Korean on screen and never ahead of it', () => {
    // A type prompt has nothing to play until its answer shows (playing the target would answer it).
    expect(slideSound(type, 0)).toBeUndefined();
    expect(slideSound(type, 1)).toEqual({ spoken: { text: '물 주세요', romanization: 'mul juseyo' }, kind: 'sentence' });
    expect(slideSound(tea, 1)).toEqual({ spoken: { text: '차', romanization: 'cha' }, kind: 'word' });
    expect(slideSound(tea)).toEqual(slideSound(tea, 1));
    expect(slideSound(trace, 0)).toEqual({ spoken: { text: '아침', romanization: 'achim' }, kind: 'word' });
    // A frame says its own Korean with a pause at each gap, then its banks, then the example.
    expect(slideSound(filled, 0)).toEqual({ spoken: { text: '아침에, 을, 를 먹어요.', romanization: 'achime, eul, reul meogeoyo' }, kind: 'sentence' });
    expect(slideSound(filled, 1)).toEqual({ spoken: { text: '밥, 빵', romanization: 'bap, ppang' }, kind: 'word' });
    expect(slideSound(filled, 2)).toEqual({ spoken: { text: '아침에 밥을 먹어요.', romanization: 'achime babeul meogeoyo' }, kind: 'sentence' });
    expect(slideSound(own, 0)?.kind).toBe('sentence');
    expect(slideSound(own, 1)).toEqual({ spoken: { text: groups.slice(0, 5).map((g) => g[0]!.ko).join(', '), romanization: 'b0, b1, b2, b3, b4' }, kind: 'word' });
    expect(slideSound(own, 2)).toEqual({ spoken: { text: groups.slice(5).map((g) => g[0]!.ko).join(', '), romanization: 'b5, b6' }, kind: 'word' });
  });
});
