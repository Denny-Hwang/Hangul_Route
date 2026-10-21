import { describe, expect, it } from 'vitest';
import type { Slide } from '../deck-builder';
import { initialPresenterState, reduce, type PresenterState } from '../controls';
import {
  TOOL_NAMES,
  firstUses,
  fullscreenToggle,
  gridItems,
  gridKindKey,
  narrationStops,
  optionContent,
  optionLayout,
  optionRomShown,
  presetLabel,
  radioMove,
  sayItShown,
  statusChips,
  timerOpenEvent,
  timerView,
  toolsOpened,
} from '../tools';
import { initialTimer, reduceTimer } from '../timer';

const state = (over: Partial<PresenterState> = {}): PresenterState => ({ ...initialPresenterState({ slides: [{ key: 'a', builds: ['x'] }] }), ...over });

describe('toolsOpened (lecture.tool_used, section 3.14)', () => {
  it('names a covering class tool when it opens', () => {
    expect(toolsOpened(state(), state({ overlay: 'blank' }))).toEqual(['blank']);
    expect(toolsOpened(state({ overlay: 'blank' }), state({ overlay: 'pause' }))).toEqual(['pause']);
    expect(toolsOpened(state(), state({ overlay: 'grid' }))).toEqual(['grid']);
  });

  it('names the timer when it comes on screen, not while it stays', () => {
    expect(toolsOpened(state(), state({ timerOpen: true }))).toEqual(['timer']);
    expect(toolsOpened(state({ timerOpen: true }), state({ timerOpen: true, timerMode: 'full' }))).toEqual([]);
  });

  it('help, exit and closing an overlay are not tools', () => {
    expect(toolsOpened(state(), state({ overlay: 'help' }))).toEqual([]);
    expect(toolsOpened(state(), state({ overlay: 'exit' }))).toEqual([]);
    expect(toolsOpened(state({ overlay: 'grid' }), state())).toEqual([]);
    expect(toolsOpened(state({ overlay: 'grid' }), state({ overlay: 'grid' }))).toEqual([]);
  });

  it('a timer brought forward over the grid counts once', () => {
    expect(toolsOpened(state({ overlay: 'grid' }), state({ timerOpen: true }))).toEqual(['timer']);
  });

  it('follows the reducer: Blank then its Pause button', () => {
    const deck = { slides: [{ key: 'a', builds: ['x'] }] };
    const s0 = initialPresenterState(deck);
    const s1 = reduce(s0, { overlay: 'blank' }, deck).state;
    const s2 = reduce(s1, { overlay: 'pause' }, deck).state;
    expect(toolsOpened(s0, s1)).toEqual(['blank']);
    expect(toolsOpened(s1, s2)).toEqual(['pause']);
  });
});

describe('firstUses', () => {
  it('emits each tool once per lecture', () => {
    const one = firstUses(new Set(), ['timer']);
    expect(one.fresh).toEqual(['timer']);
    const two = firstUses(one.used, ['timer', 'grid']);
    expect(two.fresh).toEqual(['grid']);
    expect([...two.used].sort()).toEqual(['grid', 'timer']);
    expect(firstUses(two.used, ['grid']).fresh).toEqual([]);
  });

  it('sends five tool names: picker stays on the Worker allow-list for cached presenters and is never sent (LV-H)', () => {
    expect([...TOOL_NAMES].sort()).toEqual(['blank', 'fullscreen', 'grid', 'pause', 'timer']);
  });
});

describe('sayItShown (section 3.7)', () => {
  const base = { textPrompt: false, canPlay: true, muted: false, sound: true };
  it('is off with a Korean voice and sound on', () => {
    expect(sayItShown(base)).toBe(false);
  });
  it('is on with no voice, sound off in the deck, muted, or a text prompt', () => {
    expect(sayItShown({ ...base, canPlay: false })).toBe(true);
    expect(sayItShown({ ...base, sound: false })).toBe(true);
    expect(sayItShown({ ...base, muted: true })).toBe(true);
    expect(sayItShown({ ...base, textPrompt: true })).toBe(true);
  });
});

describe('optionRomShown (D2)', () => {
  it('always: with the question; tap: at the answer', () => {
    expect(optionRomShown('always', false)).toBe(true);
    expect(optionRomShown('tap', false)).toBe(false);
    expect(optionRomShown('tap', true)).toBe(true);
    expect(optionRomShown('always', true)).toBe(true);
  });
});

describe('optionContent (slide-quiz.md: one option card for quizzes and story checks)', () => {
  it('a letter or word alone is drawn at display size with its romanization', () => {
    expect(optionContent({ ko: 'ga', romanization: 'ga', correct: true })).toEqual({ ko: { text: 'ga', romanization: 'ga', size: 'display' }, gloss: null });
  });

  it('a gloss alone is drawn at prompt size', () => {
    expect(optionContent({ gloss: 'rice', correct: false })).toEqual({ ko: null, gloss: { text: 'rice', size: 'prompt' } });
  });

  it("a story check's word keeps its gloss under it: the word at prompt size, the gloss at body size", () => {
    expect(optionContent({ ko: 'bap', romanization: 'bap', gloss: 'rice', correct: true })).toEqual({
      ko: { text: 'bap', romanization: 'bap', size: 'prompt' },
      gloss: { text: 'rice', size: 'body' },
    });
  });

  it('a Korean option without romanization draws no romanization line', () => {
    expect(optionContent({ ko: 'ga', correct: false }).ko).toEqual({ text: 'ga', size: 'display' });
  });
});

describe('optionLayout (lecture-v2.md V8, LV-S2): rows for words and sentences, the grid for letters, syllables and pictures', () => {
  const line = { ko: '빵을 먹어요.', romanization: 'ppangeul meogeoyo', gloss: 'I eat bread.', spoken: { text: '빵을 먹어요.', romanization: 'ppangeul meogeoyo' } };
  const sheet = { kind: 'menu' as const, entries: [], alt: 'A menu.', spoken: { text: '', romanization: '' } };
  const text = [{ ko: '빵을 먹어요.', romanization: 'ppangeul meogeoyo', gloss: 'I eat bread.', correct: true }];
  const pictures = [{ picture: 'word:food-milk', gloss: 'milk', correct: true }];

  it('a listen question: rows for a word or sentence round, the grid for a letter or syllable round and for pictures', () => {
    expect(optionLayout({ prompt: { ask: 'listen', line, speech: 'sentence' }, options: text })).toBe('rows');
    expect(optionLayout({ prompt: { ask: 'listen', line, speech: 'word' }, options: text })).toBe('rows');
    expect(optionLayout({ prompt: { ask: 'listen', line, speech: 'sound' }, options: [{ ko: 'ㅓ', romanization: 'eo', correct: true }] })).toBe('grid');
    expect(optionLayout({ prompt: { ask: 'listen', line, speech: 'word' }, options: pictures })).toBe('grid');
  });

  it('a reply or realia question: rows (a realia figure too); pictures keep the grid', () => {
    expect(optionLayout({ prompt: { ask: 'reply', line }, options: text })).toBe('rows');
    expect(optionLayout({ prompt: { ask: 'realia', text: 'How much?', sheet }, options: [{ figure: '1,000 won', correct: true }] })).toBe('rows');
    expect(optionLayout({ prompt: { ask: 'realia', text: 'Which picture?', sheet }, options: pictures })).toBe('grid');
  });

  it('every earlier quiz keeps the grid', () => {
    expect(optionLayout({ prompt: { ask: 'sound', spoken: { text: '가', romanization: 'ga' } }, options: [] })).toBe('grid');
    expect(optionLayout({ prompt: { ask: 'meaning', ko: '밥', romanization: 'bap' }, options: [] })).toBe('grid');
    expect(optionLayout({ prompt: { ask: 'odd-one-out' }, options: [] })).toBe('grid');
    expect(optionLayout({ prompt: { ask: 'check', text: 'Who?' }, options: [] })).toBe('grid');
  });
});

describe('fullscreenToggle (lecture.tool_used, section 3.14)', () => {
  it('enters full screen when not in it, and reports the tool', () => {
    expect(fullscreenToggle(false)).toEqual({ action: 'enter', tools: ['fullscreen'] });
  });

  it('leaves full screen and still reports the tool (Start already entered it; firstUses dedupes)', () => {
    expect(fullscreenToggle(true)).toEqual({ action: 'exit', tools: ['fullscreen'] });
    const first = firstUses(new Set(), fullscreenToggle(true).tools);
    expect(first.fresh).toEqual(['fullscreen']);
    expect(firstUses(first.used, fullscreenToggle(false).tools).fresh).toEqual([]);
  });
});

describe('statusChips (section 3.7, 3.8)', () => {
  const base = { voice: 'ready' as const, muted: false, online: true, updateWaiting: false };
  it('shows nothing when all is well', () => {
    expect(statusChips(base)).toEqual([]);
  });
  it('sound off, offline and a waiting update, in that order; muted replaces the no-voice chip (section 3.7)', () => {
    expect(statusChips({ voice: 'none', muted: true, online: false, updateWaiting: true })).toEqual(['sound-off', 'offline', 'update']);
  });
  it('no voice shows its chip once sound is on', () => {
    expect(statusChips({ ...base, voice: 'none' })).toEqual(['no-voice']);
    expect(statusChips({ ...base, voice: 'none', muted: true })).toEqual(['sound-off']);
  });
  it('an unknown voice (still checking) shows no chip', () => {
    expect(statusChips({ ...base, voice: 'unknown' })).toEqual([]);
  });
});

const slides = [
  { kind: 'title', key: 'q/title', builds: ['title'], source: 'quest', title: 'Meet the letters' },
  { kind: 'letter', key: 'q/l', builds: ['ko'], jamoId: 'jamo:g', char: 'x', romanization: 'g/k', nameEn: 'giyeok', spoken: { text: 'x', romanization: 'ga' }, hasStrokes: false, strokeReviewed: false },
  { kind: 'syllable', key: 'q/s', builds: ['parts'], ko: 'x', romanization: 'ga', split: 'g-a', parts: ['x', 'y'], spoken: { text: 'x', romanization: 'ga' } },
  { kind: 'vocab', key: 'q/v', builds: ['ko'], word: { ko: 'x', romanization: 'bap', gloss: 'rice' } },
  { kind: 'quiz', key: 'q/quiz', builds: ['question', 'answer'], prompt: { ask: 'odd-one-out' }, options: [], textPrompt: false },
  { kind: 'card', key: 'q/c', builds: ['art'], cardId: 'card:hanbok', title: 'Hanbok' },
  { kind: 'activity', key: 'q/a', builds: ['prompt'], preset: 'air-write', minutes: 3 },
  { kind: 'sequence', key: 'q/seq', builds: ['step'], steps: [{ id: 's1', gloss: 'Wake up' }], shuffled: ['s1'] },
  { kind: 'end', key: 'end', builds: ['summary'], letters: [], words: [] },
] as unknown as Slide[];

describe('gridItems (README D13)', () => {
  const names = { activity: (p: string) => `preset:${p}` };
  it('number, kind and title text: no Korean, nothing for a quiz', () => {
    const items = gridItems(slides, state({ slideIdx: 1 }), names);
    expect(items.map((i) => [i.n, i.kind, i.title])).toEqual([
      [1, 'title', 'Meet the letters'],
      [2, 'letter', 'g/k'],
      [3, 'syllable', 'ga'],
      [4, 'vocab', 'rice'],
      [5, 'quiz', ''],
      [6, 'card', 'Hanbok'],
      [7, 'activity', 'preset:air-write'],
      [8, 'sequence', 'Wake up'],
      [9, 'end', ''],
    ]);
    expect(items.map((i) => i.title).join(' ')).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
  });

  it('the reading slides: their meaning, the frame meaning, the first line meaning and the sheet text, never Korean (LV-S1)', () => {
    const line = (ko: string, gloss: string) => ({ ko, romanization: 'x', gloss, spoken: { text: ko, romanization: 'x' } });
    const reading = [
      { kind: 'sentence', key: 'r/s', builds: ['ko'], sentence: line('물을 마셔요.', 'I drink water.') },
      { kind: 'pattern', key: 'r/p', builds: ['frame'], frame: { pieces: ['', '을/를 먹어요.'], romanization: '___eul/reul meogeoyo', gloss: 'I eat ___.' }, examples: [] },
      { kind: 'read-along', key: 'r/r', builds: ['line'], lines: [{ speaker: 'Grandma', ...line('밥 먹었어요?', 'Have you eaten?') }] },
      { kind: 'realia', key: 'r/m', builds: ['sheet'], sheet: { kind: 'menu', entries: [], alt: 'A small menu.', spoken: { text: '메뉴', romanization: 'menyu' } }, keyWords: [] },
      { kind: 'read-along', key: 'r/e', builds: [], lines: [] },
    ] as unknown as Slide[];
    const items = gridItems(reading, state({ slideIdx: 0 }), names);
    expect(items.map((i) => [i.kind, i.title])).toEqual([
      ['sentence', 'I drink water.'],
      ['pattern', 'I eat ___.'],
      ['read-along', 'Have you eaten?'],
      ['realia', 'A small menu.'],
      ['read-along', ''],
    ]);
  });

  it('a sentence build has no title: like a question, its meaning shows only once the room built it (LV-S3)', () => {
    const sentence = { ko: '친구가 학교에 가요.', romanization: 'chinguga hakgyoe gayo', gloss: 'My friend goes to school.', spoken: { text: '친구가 학교에 가요.', romanization: 'chinguga hakgyoe gayo' } };
    const build = [{ kind: 'sentence-build', key: 'b/1', builds: ['bank', 'tile', 'whole'], sentence, tiles: [{ ko: '친구가', romanization: 'chinguga' }], bank: [{ tile: 0 }] }] as unknown as Slide[];
    expect(gridItems(build, state({ slideIdx: 0 }), names).map((i) => [i.kind, i.title])).toEqual([['sentence-build', '']]);
  });

  it('a write-together slide is titled by what its first build shows (a type round by its prompt and cue); a trace word has none, its meaning is the answer (LV-S4)', () => {
    const spoken = (ko: string, romanization: string, gloss: string) => ({ ko, romanization, gloss, spoken: { text: ko, romanization } });
    const frame = { pieces: ['제 이름은 ', '이에요/예요.'], romanization: 'je ireumeun ___ieyo/yeyo', gloss: 'My name is ___.' };
    const write = [
      { kind: 'write-together', key: 'w/1', builds: ['prompt', 'answer'], variant: 'type', prompt: 'Ask for water.', answer: spoken('물 주세요', 'mul juseyo', 'Water, please.') },
      { kind: 'write-together', key: 'w/2', builds: ['prompt', 'answer'], variant: 'trace', word: spoken('아침', 'achim', 'morning') },
      { kind: 'write-together', key: 'w/3', builds: ['frame', 'table'], variant: 'own-name', frame, groups: [[{ ko: '아', romanization: 'a' }]] },
    ] as unknown as Slide[];
    expect(gridItems(write, state({ slideIdx: 0 }), names).map((i) => [i.kind, i.title])).toEqual([
      ['write-together', 'Ask for water. Water, please.'],
      ['write-together', ''],
      ['write-together', 'My name is ___.'],
    ]);
  });

  it('gridKindKey: the dictionary key of each kind (read-along is readAlong, sentence-build is build, write-together is write)', () => {
    expect(gridKindKey('write-together')).toBe('write');
    expect(gridKindKey('sentence-build')).toBe('build');
    expect(gridKindKey('read-along')).toBe('readAlong');
    expect(gridKindKey('sentence')).toBe('sentence');
    expect(gridKindKey('vocab')).toBe('vocab');
  });

  it('marks the open slide, the hidden ones, and never offers Hide on the End slide', () => {
    const items = gridItems(slides, state({ slideIdx: 3, skipped: new Set(['q/c']) }), names);
    expect(items.filter((i) => i.now).map((i) => i.key)).toEqual(['q/v']);
    expect(items.filter((i) => i.hidden).map((i) => i.key)).toEqual(['q/c']);
    expect(items.at(-1)!.canHide).toBe(false);
    expect(items.slice(0, -1).every((i) => i.canHide)).toBe(true);
  });
});

describe('timerView (D12, TD5)', () => {
  it('idle shows the chosen time and an empty ring', () => {
    const idle = { ...initialTimer(), totalMs: 60_000, remainingMs: 60_000 };
    expect(timerView(idle)).toMatchObject({ text: '1:00', fraction: 0, done: false, running: false, preset: 60_000 });
  });

  it('running fills the ring; done is complete', () => {
    const run = reduceTimer(initialTimer(), { type: 'start', ms: 30_000, now: 0 });
    const half = reduceTimer(run, { type: 'tick', now: 15_000 });
    expect(timerView(half)).toMatchObject({ text: '0:15', fraction: 0.5, running: true, done: false });
    const done = reduceTimer(half, { type: 'tick', now: 31_000 });
    expect(timerView(done)).toMatchObject({ text: '0:00', fraction: 1, done: true });
  });

  it('a time that is not a preset has no chosen preset', () => {
    const run = reduceTimer(reduceTimer(initialTimer(), { type: 'start', ms: 60_000, now: 0 }), { type: 'add', now: 0 });
    expect(timerView(run).preset).toBeNull();
  });
});

describe('presetLabel', () => {
  it('seconds under a minute, else minutes', () => {
    expect(presetLabel(30_000)).toEqual({ unit: 's', n: 30 });
    expect(presetLabel(60_000)).toEqual({ unit: 'min', n: 1 });
    expect(presetLabel(300_000)).toEqual({ unit: 'min', n: 5 });
  });
});

describe('radioMove (README D19)', () => {
  const opts = ['a', 'b', 'c'] as const;
  it('arrows move and wrap', () => {
    expect(radioMove(opts, 'a', 'ArrowRight')).toBe('b');
    expect(radioMove(opts, 'c', 'ArrowDown')).toBe('a');
    expect(radioMove(opts, 'a', 'ArrowLeft')).toBe('c');
    expect(radioMove(opts, 'b', 'ArrowUp')).toBe('a');
  });
  it('Home and End jump; other keys do nothing', () => {
    expect(radioMove(opts, 'b', 'Home')).toBe('a');
    expect(radioMove(opts, 'b', 'End')).toBe('c');
    expect(radioMove(opts, 'b', 'p')).toBeNull();
    expect(radioMove([], 'a', 'ArrowRight')).toBeNull();
  });
  it('an unknown selection starts from the first', () => {
    expect(radioMove(opts, 'z' as never, 'ArrowRight')).toBe('a');
  });
});

describe('timerOpenEvent (T and the bar Timer)', () => {
  it('a timer with no time yet opens full screen, where the presets are', () => {
    expect(timerOpenEvent(state(), initialTimer())).toEqual({ timerMode: 'full' });
  });
  it('a timer with a time toggles in its own mode', () => {
    const run = reduceTimer(initialTimer(), { type: 'start', ms: 60_000, now: 0 });
    expect(timerOpenEvent(state(), run)).toEqual({ overlay: 'timer' });
    expect(timerOpenEvent(state({ timerOpen: true }), initialTimer())).toEqual({ overlay: 'timer' });
  });
});

describe('narrationStops (Read-to-me never runs on under a tool)', () => {
  it('stops on a slide change and when a covering overlay opens', () => {
    expect(narrationStops(state(), state({ slideIdx: 1 }))).toBe(true);
    expect(narrationStops(state(), state({ overlay: 'help' }))).toBe(true);
    expect(narrationStops(state(), state({ overlay: 'blank' }))).toBe(true);
  });

  it('stops when the full-screen timer opens, which covers the slide with no overlay', () => {
    const before = state();
    const after = reduce(before, timerOpenEvent(before, initialTimer()), { slides: [{ key: 'a', builds: ['x'] }] }).state;
    expect(after.overlay).toBeNull();
    expect(narrationStops(before, after)).toBe(true);
    expect(narrationStops(state({ timerOpen: true }), state({ timerOpen: true, timerMode: 'full' }))).toBe(true);
  });

  it('keeps playing for the corner timer, a reveal, a closing overlay or a full timer that stays', () => {
    expect(narrationStops(state(), state({ timerOpen: true }))).toBe(false);
    expect(narrationStops(state(), state({ reveal: 1 }))).toBe(false);
    expect(narrationStops(state({ overlay: 'help' }), state())).toBe(false);
    expect(narrationStops(state({ overlay: 'help' }), state({ overlay: 'grid' }))).toBe(false);
    const full = state({ timerOpen: true, timerMode: 'full' });
    expect(narrationStops(full, full)).toBe(false);
    expect(narrationStops(full, state({ timerMode: 'full' }))).toBe(false);
  });
});
