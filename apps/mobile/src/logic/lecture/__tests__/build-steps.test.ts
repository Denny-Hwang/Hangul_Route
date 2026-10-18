import { describe, expect, it } from 'vitest';
import { buildsFor, joinSpoken, partsShown, type BuildOptions, type SlideBody } from '../build-steps';

const ALWAYS: BuildOptions = { romanization: 'always', strokeGuide: true };
const TAP: BuildOptions = { romanization: 'tap', strokeGuide: true };

const letter = (over: Partial<Extract<SlideBody, { kind: 'letter' }>> = {}): SlideBody => ({
  kind: 'letter',
  jamoId: 'jamo:giyeok',
  char: 'ㄱ',
  romanization: 'g/k',
  nameEn: 'giyeok',
  spoken: { text: '가', romanization: 'ga' },
  example: { ko: '가족', romanization: 'gajok', gloss: 'family' },
  hasStrokes: true,
  strokeReviewed: false,
  ...over,
});

describe('buildsFor: one teacher click per build (F-TCH-004 §3.4)', () => {
  it('letter: glyph with romanization, stroke guide, sound, name, example', () => {
    expect(buildsFor(letter(), ALWAYS)).toEqual(['ko', 'stroke', 'sound', 'name', 'example']);
  });

  it("letter with romanization 'tap': romanization is its own build after the glyph (D2)", () => {
    expect(buildsFor(letter(), TAP)).toEqual(['ko', 'rom', 'stroke', 'sound', 'name', 'example']);
  });

  it('strokeGuide off drops the stroke build', () => {
    expect(buildsFor(letter(), { romanization: 'always', strokeGuide: false })).toEqual(['ko', 'sound', 'name', 'example']);
  });

  it('a jamo with no stroke skeleton or no example word has no build for them', () => {
    expect(buildsFor(letter({ hasStrokes: false, example: undefined }), ALWAYS)).toEqual(['ko', 'sound', 'name']);
  });

  it('syllable: parts, join, romanization, sound in both modes', () => {
    const body: SlideBody = { kind: 'syllable', ko: '가', romanization: 'ga', split: 'ga', parts: ['ㄱ', 'ㅏ'], spoken: { text: '가', romanization: 'ga' } };
    expect(buildsFor(body, ALWAYS)).toEqual(['parts', 'join', 'rom', 'sound']);
    expect(buildsFor(body, TAP)).toEqual(['parts', 'join', 'rom', 'sound']);
  });

  it('vocab: a topic word with a WordArt key has the art build after the gloss (README D9)', () => {
    const body: SlideBody = { kind: 'vocab', word: { ko: '사과', romanization: 'sagwa', gloss: 'apple' }, spoken: { text: '사과', romanization: 'sagwa' }, speech: 'word', wordId: 'vocab:sagwa-apple', wordArt: 'food-apple' };
    expect(buildsFor(body, ALWAYS)).toEqual(['ko', 'gloss', 'art']);
    expect(buildsFor(body, { ...ALWAYS, romanization: 'tap' })).toEqual(['ko', 'rom', 'gloss', 'art']);
  });

  it('vocab: word, gloss, art; tap adds romanization; no art = text only', () => {
    const body: SlideBody = { kind: 'vocab', word: { ko: '김치', romanization: 'gimchi', gloss: 'kimchi' }, spoken: { text: '김치', romanization: 'gimchi' }, speech: 'word', cardId: 'card:kimchi' };
    expect(buildsFor(body, ALWAYS)).toEqual(['ko', 'gloss', 'art']);
    expect(buildsFor(body, TAP)).toEqual(['ko', 'rom', 'gloss', 'art']);
    expect(buildsFor({ kind: 'vocab', word: { ko: '물', romanization: 'mul', gloss: 'water' }, spoken: { text: '물', romanization: 'mul' }, speech: 'word' }, ALWAYS)).toEqual(['ko', 'gloss']);
  });

  it('sequence: one build per step, then the order question', () => {
    const body: SlideBody = {
      kind: 'sequence',
      steps: [
        { id: 'a', gloss: 'Wash hands' },
        { id: 'b', gloss: 'Set the table' },
        { id: 'c', gloss: 'Eat' },
      ],
      shuffled: ['c', 'a', 'b'],
    };
    expect(buildsFor(body, ALWAYS)).toEqual(['step', 'step', 'step', 'order']);
  });

  it('story: art, narration, Korean line; tap adds romanization; no Korean line, no build for it', () => {
    const body: SlideBody = {
      kind: 'story',
      storyId: 'story:x',
      sceneId: 's1',
      narration: [{ text: 'Once.' }],
      korean: { ko: '해', romanization: 'hae', gloss: 'sun', speech: 'word' },
    };
    expect(buildsFor(body, ALWAYS)).toEqual(['art', 'narration', 'korean']);
    expect(buildsFor(body, TAP)).toEqual(['art', 'narration', 'korean', 'rom']);
    expect(buildsFor({ ...body, korean: undefined }, TAP)).toEqual(['art', 'narration']);
  });

  it('quiz: question then answer (option romanizations show at the answer in tap mode, no extra build)', () => {
    const body: SlideBody = { kind: 'quiz', prompt: { ask: 'odd-one-out' }, options: [], textPrompt: false };
    expect(buildsFor(body, ALWAYS)).toEqual(['question', 'answer']);
    expect(buildsFor(body, TAP)).toEqual(['question', 'answer']);
  });

  it('card: art then fact; tap reveals the romanization first', () => {
    const body: SlideBody = { kind: 'card', cardId: 'card:book', title: 'Book', ko: '책', romanization: 'chaek', fact: 'A fact.' };
    expect(buildsFor(body, ALWAYS)).toEqual(['art', 'fact']);
    expect(buildsFor(body, TAP)).toEqual(['art', 'rom', 'fact']);
    expect(buildsFor({ kind: 'card', cardId: 'card:x', title: 'X' }, TAP)).toEqual(['art']);
    // No romanization means no chip on the slide, so no romanization build to press through.
    expect(buildsFor({ kind: 'card', cardId: 'card:x', title: 'X', ko: '책', fact: 'A fact.' }, TAP)).toEqual(['art', 'fact']);
  });

  it('title, activity and end are one build', () => {
    expect(buildsFor({ kind: 'title', source: 'quest', title: 'Meet g, n, d, l' }, TAP)).toEqual(['title']);
    expect(buildsFor({ kind: 'activity', preset: 'air-write', minutes: 3 }, TAP)).toEqual(['prompt']);
    expect(buildsFor({ kind: 'end', letters: [], words: [] }, TAP)).toEqual(['summary']);
  });

  it('trace-stroke letter (strokeFirst): the stroke guide comes first, unless it is off or missing', () => {
    expect(buildsFor(letter({ strokeFirst: true }), ALWAYS)).toEqual(['stroke', 'ko', 'sound', 'name', 'example']);
    expect(buildsFor(letter({ strokeFirst: true }), TAP)).toEqual(['stroke', 'ko', 'rom', 'sound', 'name', 'example']);
    expect(buildsFor(letter({ strokeFirst: true }), { romanization: 'always', strokeGuide: false })).toEqual(['ko', 'sound', 'name', 'example']);
    expect(buildsFor(letter({ strokeFirst: true, hasStrokes: false }), ALWAYS)).toEqual(['ko', 'sound', 'name', 'example']);
  });

  it("sequence with 'tap': the steps' romanization gets one build of its own before the order", () => {
    const body: SlideBody = {
      kind: 'sequence',
      steps: [
        { id: 'a', gloss: 'Wash hands', ko: '손 씻기', romanization: 'son ssitgi' },
        { id: 'b', gloss: 'Eat' },
      ],
      shuffled: ['b', 'a'],
    };
    expect(buildsFor(body, TAP)).toEqual(['step', 'step', 'rom', 'order']);
    expect(buildsFor(body, ALWAYS)).toEqual(['step', 'step', 'order']);
    expect(buildsFor({ ...body, steps: [{ id: 'b', gloss: 'Eat' }] }, TAP)).toEqual(['step', 'order']);
  });

  it("story narration keyword chips with 'tap': their romanization gets a build of its own", () => {
    const body: SlideBody = {
      kind: 'story',
      storyId: 'story:x',
      sceneId: 's1',
      narration: [{ text: 'The ' }, { ko: '해', romanization: 'hae', gloss: 'sun' }],
    };
    expect(buildsFor(body, TAP)).toEqual(['art', 'narration', 'rom']);
    expect(buildsFor(body, ALWAYS)).toEqual(['art', 'narration']);
    expect(buildsFor({ ...body, korean: { ko: '해', romanization: 'hae', gloss: 'sun', speech: 'word' } }, TAP)).toEqual(['art', 'narration', 'korean', 'rom']);
  });
});

describe('buildsFor: the reading slides (AMENDMENTS-LECTURE-V2 section 5.2, LV-S1)', () => {
  const line = (ko: string, romanization: string, gloss: string) => ({ ko, romanization, gloss, spoken: { text: ko, romanization } });
  const sentence = (picture?: string): SlideBody => ({ kind: 'sentence', sentence: line('물을 마셔요.', 'mureul masyeoyo', 'I drink water.'), ...(picture ? { picture } : {}) });
  const pattern = (note = true): SlideBody => ({
    kind: 'pattern',
    frame: { pieces: ['', '을/를 먹어요.'], romanization: '___eul/reul meogeoyo', gloss: 'I eat ___.' },
    ...(note ? { note: [{ text: 'Put ' }, { ko: '을', romanization: 'eul' }, { text: ' after a final consonant.' }] } : {}),
    examples: [line('밥을 먹어요.', 'babeul meogeoyo', 'I eat rice.'), line('사과를 먹어요.', 'sagwareul meogeoyo', 'I eat an apple.')],
  });
  const readAlong: SlideBody = {
    kind: 'read-along',
    lines: [
      { speaker: 'Grandma', ...line('밥 먹었어요?', 'bap meogeosseoyo', 'Have you eaten?') },
      { speaker: 'Hoya', ...line('네, 먹었어요.', 'ne meogeosseoyo', 'Yes, I ate.') },
    ],
  };
  const realia: SlideBody = {
    kind: 'realia',
    sheet: { kind: 'menu', entries: [{ id: 'gimbap', text: { ko: '김밥', romanization: 'gimbap' } }], alt: 'A menu.', spoken: { text: '김밥', romanization: 'gimbap' } },
    keyWords: [line('김밥', 'gimbap', 'seaweed rice roll')],
  };

  it("sentence: Korean with its romanization, the meaning, the picture; 'tap' puts the romanization one build after the Korean", () => {
    expect(buildsFor(sentence('word:food-water'), ALWAYS)).toEqual(['ko', 'gloss', 'art']);
    expect(buildsFor(sentence('word:food-water'), TAP)).toEqual(['ko', 'rom', 'gloss', 'art']);
    expect(buildsFor(sentence(), ALWAYS)).toEqual(['ko', 'gloss']);
  });

  it("pattern: frame, note, example 1, example 2; 'tap' gives each its romanization one build later", () => {
    expect(buildsFor(pattern(), ALWAYS)).toEqual(['frame', 'note', 'example', 'example']);
    expect(buildsFor(pattern(), TAP)).toEqual(['frame', 'rom', 'note', 'rom', 'example', 'rom', 'example', 'rom']);
    expect(buildsFor(pattern(false), ALWAYS)).toEqual(['frame', 'example', 'example']);
  });

  it("read along: one build per line; 'tap' puts each line's romanization one build after it", () => {
    expect(buildsFor(readAlong, ALWAYS)).toEqual(['line', 'line']);
    expect(buildsFor(readAlong, TAP)).toEqual(['line', 'rom', 'line', 'rom']);
  });

  it("read along with no Korean voice (together): one build shows every line; 'tap' adds one build for their romanization", () => {
    const together: SlideBody = { ...(readAlong as Extract<SlideBody, { kind: 'read-along' }>), together: true };
    expect(buildsFor(together, ALWAYS)).toEqual(['line']);
    expect(buildsFor(together, TAP)).toEqual(['line', 'rom']);
  });

  it("realia: the sheet, then the key words; 'tap' shows each part's romanization one build after it", () => {
    expect(buildsFor(realia, ALWAYS)).toEqual(['sheet', 'words']);
    expect(buildsFor(realia, TAP)).toEqual(['sheet', 'rom', 'words', 'rom']);
  });
});

describe('partsShown: what a reading slide shows at a build', () => {
  it('each build but rom shows its part; with no rom builds the romanization comes with the part', () => {
    expect(partsShown(['frame', 'note', 'example', 'example'], 0)).toEqual([{ name: 'frame', rom: true }]);
    expect(partsShown(['frame', 'note', 'example', 'example'], 2)).toEqual([
      { name: 'frame', rom: true },
      { name: 'note', rom: true },
      { name: 'example', rom: true },
    ]);
  });

  it("with 'tap', a rom build shows the romanization of the part before it", () => {
    const builds = ['line', 'rom', 'line', 'rom'] as const;
    expect(partsShown(builds, 0)).toEqual([{ name: 'line', rom: false }]);
    expect(partsShown(builds, 1)).toEqual([{ name: 'line', rom: true }]);
    expect(partsShown(builds, 2)).toEqual([{ name: 'line', rom: true }, { name: 'line', rom: false }]);
    expect(partsShown(builds, 3)).toEqual([{ name: 'line', rom: true }, { name: 'line', rom: true }]);
  });

  it('a reveal past the end shows every part; a negative one shows nothing', () => {
    expect(partsShown(['sheet', 'words'], 9)).toHaveLength(2);
    expect(partsShown(['sheet', 'words'], -1)).toEqual([]);
  });
});

describe('joinSpoken: several pieces of Korean read in one go', () => {
  it('joins the text and the romanization with a pause; one piece keeps its clip', () => {
    expect(joinSpoken([{ text: '메뉴', romanization: 'menyu' }, { text: '김밥', romanization: 'gimbap', audioRef: 'a.mp3' }])).toEqual({ text: '메뉴, 김밥', romanization: 'menyu, gimbap' });
    expect(joinSpoken([{ text: '김밥', romanization: 'gimbap', audioRef: 'a.mp3' }])).toEqual({ text: '김밥', romanization: 'gimbap', audioRef: 'a.mp3' });
  });
});
