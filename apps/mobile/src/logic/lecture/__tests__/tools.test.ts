import { describe, expect, it } from 'vitest';
import type { Slide } from '../deck-builder';
import { initialPresenterState, reduce, type PresenterState } from '../controls';
import {
  TOOL_NAMES,
  firstUses,
  gridItems,
  optionRomShown,
  pickerModes,
  presetLabel,
  radioMove,
  sayItShown,
  statusChips,
  timerView,
  toolsOpened,
} from '../tools';
import { initialTimer, reduceTimer } from '../timer';

const state = (over: Partial<PresenterState> = {}): PresenterState => ({ ...initialPresenterState({ slides: [{ key: 'a', builds: ['x'] }] }), ...over });

describe('toolsOpened (lecture.tool_used, section 3.14)', () => {
  it('names a covering class tool when it opens', () => {
    expect(toolsOpened(state(), state({ overlay: 'picker' }))).toEqual(['picker']);
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
    expect(toolsOpened(state({ overlay: 'picker' }), state())).toEqual([]);
    expect(toolsOpened(state({ overlay: 'picker' }), state({ overlay: 'picker' }))).toEqual([]);
  });

  it('a timer brought forward over the picker counts once', () => {
    expect(toolsOpened(state({ overlay: 'picker' }), state({ timerOpen: true }))).toEqual(['timer']);
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

  it('only knows the six tool names of the telemetry payload', () => {
    expect([...TOOL_NAMES].sort()).toEqual(['blank', 'fullscreen', 'grid', 'pause', 'picker', 'timer']);
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
  });
});

describe('statusChips (section 3.7, 3.8)', () => {
  const base = { voice: 'ready' as const, muted: false, online: true, updateWaiting: false };
  it('shows nothing when all is well', () => {
    expect(statusChips(base)).toEqual([]);
  });
  it('no voice, sound off, offline and a waiting update, in that order', () => {
    expect(statusChips({ voice: 'none', muted: true, online: false, updateWaiting: true })).toEqual(['sound-off', 'no-voice', 'offline', 'update']);
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

describe('pickerModes (README D11)', () => {
  it('the received mode and numbers; names only when names arrived', () => {
    expect(pickerModes('names', true)).toEqual(['names', 'numbers']);
    expect(pickerModes('initials', true)).toEqual(['initials', 'numbers']);
    expect(pickerModes('names', false)).toEqual(['numbers']);
    expect(pickerModes('numbers', false)).toEqual(['numbers']);
  });
});
