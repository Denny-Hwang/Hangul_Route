import { describe, expect, it } from 'vitest';
import {
  initialPresenterState,
  reduce,
  revealsOf,
  type ControlSlide,
  type PresenterEvent,
  type PresenterState,
} from '../controls';

/** Slides only need a key and their builds here; the deck builder (PR 5) adds the rest. */
const slide = (key: string, builds: number): ControlSlide => ({ key, builds: Array.from({ length: builds }, (_, i) => `b${i}`) });

// title (1 build) · letter (5) · quiz (2) · card (2) · end (1)
const DECK = {
  slides: [slide('t', 1), slide('l', 5), slide('q', 2), slide('c', 2), slide('e', 1)],
};

const at = (slideIdx: number, reveal = 0, extra: Partial<PresenterState> = {}): PresenterState => ({
  ...initialPresenterState(DECK),
  slideIdx,
  reveal,
  ...extra,
});

const run = (state: PresenterState, ...events: PresenterEvent[]): PresenterState =>
  events.reduce<PresenterState>((s, e) => reduce(s, e, DECK).state, state);

describe('initialPresenterState', () => {
  it('starts on the first slide, build 0, nothing open, timer in the corner', () => {
    expect(initialPresenterState(DECK)).toEqual({
      slideIdx: 0,
      reveal: 0,
      overlay: null,
      timerOpen: false,
      timerMode: 'corner',
      skipped: new Set(),
      ended: false,
    });
  });

  it('resumes at a saved slide key (Recent, lastSlideKey), and at the first slide for an unknown key', () => {
    expect(initialPresenterState(DECK, 'q').slideIdx).toBe(2);
    expect(initialPresenterState(DECK, 'gone').slideIdx).toBe(0);
  });

  it('a saved key this build no longer makes resumes at its step, else its block (LV-2 drops repeat word cards)', () => {
    const deck = {
      slides: [
        slide('episode:e1/quest:a/s1/가', 1),
        slide('episode:e1/quest:a/s2/나', 1),
        slide('episode:e1/quest:a/s2/quiz/0', 2),
        slide('episode:e1/quest:b/s1/다', 1),
        slide('end', 1),
      ],
    };
    // A repeat card of step s2 that LV-2 removed: the first slide of that step.
    expect(initialPresenterState(deck, 'episode:e1/quest:a/s2/가').slideIdx).toBe(1);
    // A step that is gone altogether: the first slide of its quest.
    expect(initialPresenterState(deck, 'episode:e1/quest:b/s4/라').slideIdx).toBe(3);
    // Nothing of its block left: the first slide.
    expect(initialPresenterState(deck, 'episode:e9/quest:z/s1/마').slideIdx).toBe(0);
  });

  it('resuming on the last slide counts as ended', () => {
    expect(initialPresenterState(DECK, 'e')).toMatchObject({ slideIdx: 4, ended: true });
  });
});

describe('revealsOf', () => {
  it('is builds - 1, never negative', () => {
    expect(revealsOf(slide('x', 5))).toBe(4);
    expect(revealsOf(slide('x', 1))).toBe(0);
    expect(revealsOf(slide('x', 0))).toBe(0);
  });
});

describe('next / prev (F-TCH-004 §3.5)', () => {
  it('next reveals every build before it advances', () => {
    let s = at(1);
    for (let r = 1; r <= 4; r++) {
      s = run(s, 'next');
      expect(s).toMatchObject({ slideIdx: 1, reveal: r });
    }
    s = run(s, 'next');
    expect(s).toMatchObject({ slideIdx: 2, reveal: 0 });
  });

  it('a one-build slide advances on the first next', () => {
    expect(run(at(0), 'next')).toMatchObject({ slideIdx: 1, reveal: 0 });
  });

  it('prev steps back through reveals, then lands on the previous slide at its last reveal', () => {
    expect(run(at(2, 1), 'prev')).toMatchObject({ slideIdx: 2, reveal: 0 });
    expect(run(at(2, 0), 'prev')).toMatchObject({ slideIdx: 1, reveal: 4 });
  });

  it('next at the very end does nothing (no accidental exit) and prev at the start does nothing', () => {
    const end = at(4, 0, { ended: true });
    expect(run(end, 'next')).toEqual(end);
    const start = at(0);
    expect(run(start, 'prev')).toEqual(start);
  });

  it('reaching the last slide marks the lecture ended, and it stays ended when going back', () => {
    const s = run(at(3, 1), 'next');
    expect(s).toMatchObject({ slideIdx: 4, ended: true });
    expect(run(s, 'prev')).toMatchObject({ slideIdx: 3, ended: true });
  });

  it('jumps over skipped slides both ways', () => {
    const skipped = new Set(['q', 'c']);
    expect(run(at(1, 4, { skipped }), 'next')).toMatchObject({ slideIdx: 4, reveal: 0 });
    expect(run(at(4, 0, { skipped }), 'prev')).toMatchObject({ slideIdx: 1, reveal: 4 });
  });

  it('jumps several skipped slides in a row, and prev stays put when everything before is skipped', () => {
    const deck = { slides: [slide('a', 1), slide('b', 1), slide('c', 1), slide('d', 1)] };
    const base = initialPresenterState(deck);
    expect(reduce({ ...base, skipped: new Set(['b', 'c']) }, 'next', deck).state.slideIdx).toBe(3);
    const second: PresenterState = { ...base, slideIdx: 1, skipped: new Set(['a']) };
    expect(reduce(second, 'prev', deck).state).toEqual(second);
  });

  it('a reveal past the slide (builds shrank after a romanization toggle) is clamped before moving', () => {
    // Slide 1 has 5 builds (reveals 4); a stale reveal of 9 behaves like 4.
    expect(run(at(1, 9), 'next')).toMatchObject({ slideIdx: 2, reveal: 0 });
    expect(run(at(1, 9), 'prev')).toMatchObject({ slideIdx: 1, reveal: 3 });
  });
});

describe('first / last / goto', () => {
  it('first and last go to the first and last slide that is not skipped, at build 0', () => {
    expect(run(at(3, 1), 'first')).toMatchObject({ slideIdx: 0, reveal: 0 });
    expect(run(at(1, 2), 'last')).toMatchObject({ slideIdx: 4, reveal: 0, ended: true });
    expect(run(at(3, 1, { skipped: new Set(['t']) }), 'first')).toMatchObject({ slideIdx: 1, reveal: 0 });
  });

  it('first and last stay put if every slide is skipped (a state built by hand)', () => {
    const all = at(2, 1, { skipped: new Set(['t', 'l', 'q', 'c', 'e']) });
    expect(run(all, 'first')).toEqual(all);
    expect(run(all, 'last')).toEqual(all);
  });

  it('goto lands on the slide at build 0 and clamps an index out of range', () => {
    expect(run(at(0), { goto: 3 })).toMatchObject({ slideIdx: 3, reveal: 0 });
    expect(run(at(2), { goto: -5 })).toMatchObject({ slideIdx: 0, reveal: 0 });
    expect(run(at(2), { goto: 99 })).toMatchObject({ slideIdx: 4, reveal: 0, ended: true });
    expect(run(at(2), { goto: 1.7 })).toMatchObject({ slideIdx: 1 });
    expect(run(at(2), { goto: Number.NaN })).toMatchObject({ slideIdx: 0 });
  });

  it('goto from the grid jumps and closes the grid', () => {
    expect(run(at(0, 0, { overlay: 'grid' }), { goto: 2 })).toMatchObject({ slideIdx: 2, overlay: null });
  });

  it('goto to a skipped slide still lands there (the teacher chose it in the grid)', () => {
    expect(run(at(0, 0, { overlay: 'grid', skipped: new Set(['q']) }), { goto: 2 })).toMatchObject({ slideIdx: 2 });
  });
});

describe('overlays swallow navigation', () => {
  it.each(['blank', 'pause'] as const)('%s: the first next / prev only clears the overlay', (overlay) => {
    for (const ev of ['next', 'prev', 'first', 'last', { goto: 3 }] as const) {
      expect(run(at(1, 2, { overlay }), ev)).toMatchObject({ slideIdx: 1, reveal: 2, overlay: null });
    }
  });

  it('timer in the corner lets slides advance and stays open', () => {
    expect(run(at(0, 0, { timerOpen: true, timerMode: 'corner' }), 'next')).toMatchObject({ slideIdx: 1, timerOpen: true });
    expect(run(at(1, 0, { timerOpen: true, timerMode: 'corner' }), { goto: 3 })).toMatchObject({ slideIdx: 3, timerOpen: true });
  });

  it('timer full screen swallows navigation', () => {
    const s = at(1, 1, { timerOpen: true, timerMode: 'full' });
    for (const ev of ['next', 'prev', 'first', 'last', { goto: 3 }] as const) expect(run(s, ev)).toEqual(s);
  });

  it('a covering overlay over the corner timer still swallows navigation; blank over it clears first', () => {
    const grid = at(1, 1, { overlay: 'grid', timerOpen: true, timerMode: 'corner' });
    expect(run(grid, 'next')).toEqual(grid);
    expect(run(at(1, 1, { overlay: 'blank', timerOpen: true }), 'next')).toMatchObject({ slideIdx: 1, reveal: 1, overlay: null, timerOpen: true });
  });

  it.each(['grid', 'help', 'exit'] as const)('%s swallows next / prev / first / last', (overlay) => {
    const s = at(1, 1, { overlay });
    for (const ev of ['next', 'prev', 'first', 'last'] as const) expect(run(s, ev)).toEqual(s);
  });

  it.each(['help', 'exit'] as const)('%s swallows goto too (only the grid jumps)', (overlay) => {
    const s = at(1, 1, { overlay });
    expect(run(s, { goto: 3 })).toEqual(s);
  });
});

describe('opening and closing overlays', () => {
  it('opens an overlay, and the same request again closes it (B toggles blank)', () => {
    const open = run(at(1), { overlay: 'blank' });
    expect(open.overlay).toBe('blank');
    expect(run(open, { overlay: 'blank' }).overlay).toBeNull();
  });

  // The helper picker is gone (LV-H, AMENDMENTS-LECTURE-V2 section 13): an { overlay: 'picker' } from an older caller opens nothing.
  it("{ overlay: 'picker' } leaves the overlay as it was, closed or open, and the slide unchanged", () => {
    const picker = { overlay: 'picker' } as unknown as PresenterEvent;
    for (const overlay of [null, 'blank', 'pause', 'grid', 'help', 'exit'] as const) {
      const before = at(1, 2, { overlay, timerOpen: true, timerMode: 'corner' });
      const out = reduce(before, picker, DECK);
      expect(out.state).toEqual(before);
      expect(out.effect).toBeUndefined();
    }
  });

  it('a new overlay replaces the open one; { overlay: null } closes', () => {
    expect(run(at(1, 0, { overlay: 'grid' }), { overlay: 'help' }).overlay).toBe('help');
    expect(run(at(1, 0, { overlay: 'grid' }), { overlay: null }).overlay).toBeNull();
  });

  it('close and Esc close the open overlay without touching the slide', () => {
    for (const overlay of ['blank', 'pause', 'grid', 'help', 'exit'] as const) {
      expect(run(at(1, 2, { overlay }), 'close')).toMatchObject({ slideIdx: 1, reveal: 2, overlay: null });
      expect(run(at(1, 2, { overlay }), 'escape')).toMatchObject({ slideIdx: 1, reveal: 2, overlay: null });
    }
  });

  it('close and Esc close a full-screen timer; a corner timer closes with close or T, and Esc there asks to exit', () => {
    expect(run(at(1, 0, { timerOpen: true, timerMode: 'full' }), 'escape')).toMatchObject({ timerOpen: false, overlay: null });
    expect(run(at(1, 0, { timerOpen: true, timerMode: 'full' }), 'close')).toMatchObject({ timerOpen: false, overlay: null });
    expect(run(at(1, 0, { timerOpen: true, timerMode: 'corner' }), 'close')).toMatchObject({ timerOpen: false, overlay: null });
    expect(run(at(1, 0, { timerOpen: true, timerMode: 'corner' }), 'escape')).toMatchObject({ timerOpen: true, overlay: 'exit' });
    expect(run(at(1, 0, { timerOpen: true, timerMode: 'corner' }), { overlay: 'timer' })).toMatchObject({ timerOpen: false });
  });

  it('Esc with nothing open asks to exit; close with nothing open does nothing', () => {
    expect(run(at(1), 'escape').overlay).toBe('exit');
    expect(run(at(1), 'close')).toEqual(at(1));
  });

  it('the timer mode switches between corner and full and opens the timer', () => {
    const full = run(at(1), { timerMode: 'full' });
    expect(full).toMatchObject({ timerOpen: true, timerMode: 'full', overlay: null });
    expect(run(full, { timerMode: 'corner' })).toMatchObject({ timerOpen: true, timerMode: 'corner' });
  });

  it('closing the timer keeps its mode for next time', () => {
    expect(run(at(1, 0, { timerOpen: true, timerMode: 'full' }), 'close')).toMatchObject({ timerOpen: false, timerMode: 'full' });
  });

  it('T toggles the timer, and with a covering overlay open it brings the timer forward instead of hiding it', () => {
    const open = run(at(1), { overlay: 'timer' });
    expect(open).toMatchObject({ timerOpen: true, overlay: null });
    expect(run(open, { overlay: 'timer' }).timerOpen).toBe(false);
    expect(run(at(1, 0, { overlay: 'help', timerOpen: true }), { overlay: 'timer' })).toMatchObject({ overlay: null, timerOpen: true });
    expect(run(at(1, 0, { overlay: 'help' }), { overlay: 'timer' })).toMatchObject({ overlay: null, timerOpen: true });
  });

  it.each(['blank', 'pause', 'grid', 'help'] as const)('opening an empty timer full screen over %s brings it forward', (overlay) => {
    expect(run(at(1, 0, { overlay }), { timerMode: 'full' })).toMatchObject({ overlay: null, timerOpen: true, timerMode: 'full' });
  });

  it('switching an open timer between corner and full keeps the covering overlay as it is', () => {
    expect(run(at(1, 0, { timerOpen: true, timerMode: 'full' }), { timerMode: 'corner' })).toMatchObject({ overlay: null, timerMode: 'corner' });
  });
});

describe('a running corner timer survives other overlays (activity slide: Start timer, then G)', () => {
  it.each(['blank', 'pause', 'grid', 'help', 'exit'] as const)('%s opens over the corner timer and closing it shows the timer again', (overlay) => {
    const timing = run(at(3), { startTimer: 180_000 });
    expect(timing).toMatchObject({ timerOpen: true, overlay: null });
    const covered = run(timing, { overlay });
    expect(covered).toMatchObject({ overlay, timerOpen: true });
    expect(run(covered, 'close')).toMatchObject({ overlay: null, timerOpen: true, timerMode: 'corner' });
    expect(run(covered, 'escape')).toMatchObject({ overlay: null, timerOpen: true });
    expect(run(covered, { overlay })).toMatchObject({ overlay: null, timerOpen: true });
  });

  it('Esc closes the covering overlay first, then a full-screen timer, then asks to exit', () => {
    const s = at(1, 0, { overlay: 'help', timerOpen: true, timerMode: 'full' });
    const afterOne = run(s, 'escape');
    expect(afterOne).toMatchObject({ overlay: null, timerOpen: true });
    const afterTwo = run(afterOne, 'escape');
    expect(afterTwo).toMatchObject({ overlay: null, timerOpen: false });
    expect(run(afterTwo, 'escape').overlay).toBe('exit');
  });
});

describe('close-timer: the timer card\'s own Close (PR 9)', () => {
  it('closes the timer and leaves a covering overlay where it is', () => {
    const covered = at(1, 0, { overlay: 'grid', timerOpen: true });
    expect(run(covered, 'close-timer')).toMatchObject({ overlay: 'grid', timerOpen: false });
    expect(run(at(1, 0, { timerOpen: true, timerMode: 'full' }), 'close-timer')).toMatchObject({ overlay: null, timerOpen: false, slideIdx: 1 });
  });

  it('does nothing when the timer is not open', () => {
    const s = at(2, 1);
    expect(reduce(s, 'close-timer', DECK).state).toBe(s);
  });
});

describe('effects stay outside the reducer', () => {
  it('replay sound and replay stroke return an effect and leave the state alone', () => {
    const s = at(1, 2);
    expect(reduce(s, 'replay-sound', DECK)).toEqual({ state: s, effect: { type: 'play-sound', slideKey: 'l' } });
    expect(reduce(s, 'replay-stroke', DECK)).toEqual({ state: s, effect: { type: 'play-stroke', slideKey: 'l' } });
  });

  it('a replay works with the corner timer open but not under a covering overlay', () => {
    expect(reduce(at(1, 0, { timerOpen: true, timerMode: 'corner' }), 'replay-sound', DECK).effect).toEqual({
      type: 'play-sound',
      slideKey: 'l',
    });
    for (const overlay of ['blank', 'pause', 'grid', 'help', 'exit'] as const) {
      expect(reduce(at(1, 0, { overlay }), 'replay-sound', DECK).effect).toBeUndefined();
      expect(reduce(at(1, 0, { overlay }), 'replay-stroke', DECK).effect).toBeUndefined();
    }
    expect(reduce(at(1, 0, { timerOpen: true, timerMode: 'full' }), 'replay-stroke', DECK).effect).toBeUndefined();
    expect(reduce(at(1, 0, { overlay: 'grid', timerOpen: true, timerMode: 'corner' }), 'replay-sound', DECK).effect).toBeUndefined();
  });

  it('start timer opens the timer and returns a start-timer effect with the minutes as ms', () => {
    const r = reduce(at(3), { startTimer: 180_000 }, DECK);
    expect(r.state).toMatchObject({ slideIdx: 3, timerOpen: true, overlay: null });
    expect(r.effect).toEqual({ type: 'start-timer', ms: 180_000 });
  });

  it('a forward step reports the build it revealed, so the screen can play a newly revealed sound or stroke build', () => {
    expect(reduce(at(1, 1), 'next', DECK).effect).toEqual({ type: 'revealed', slideKey: 'l', build: 2 });
    expect(reduce(at(1, 4), 'next', DECK).effect).toEqual({ type: 'revealed', slideKey: 'q', build: 0 });
    expect(reduce(at(0), 'next', DECK).effect).toEqual({ type: 'revealed', slideKey: 'l', build: 0 });
    expect(reduce(at(0, 0, { timerOpen: true }), 'next', DECK).effect).toEqual({ type: 'revealed', slideKey: 'l', build: 0 });
  });

  it('a jump (first, last, goto) reports build 0 of the slide it lands on', () => {
    expect(reduce(at(3, 1), 'first', DECK).effect).toEqual({ type: 'revealed', slideKey: 't', build: 0 });
    expect(reduce(at(1), 'last', DECK).effect).toEqual({ type: 'revealed', slideKey: 'e', build: 0 });
    expect(reduce(at(0, 0, { overlay: 'grid' }), { goto: 2 }, DECK).effect).toEqual({ type: 'revealed', slideKey: 'q', build: 0 });
  });

  it('prev never replays anything: going back lands on the last reveal silently', () => {
    expect(reduce(at(2, 1), 'prev', DECK).effect).toBeUndefined();
    expect(reduce(at(2, 0), 'prev', DECK).effect).toBeUndefined();
  });

  it('no effect when nothing moved: the end of the deck, a swallowed step, or a blank cleared', () => {
    expect(reduce(at(4, 0, { ended: true }), 'next', DECK).effect).toBeUndefined();
    expect(reduce(at(1, 0, { overlay: 'help' }), 'next', DECK).effect).toBeUndefined();
    expect(reduce(at(1, 0, { overlay: 'blank' }), 'next', DECK).effect).toBeUndefined();
    expect(reduce(at(1, 0, { timerOpen: true, timerMode: 'full' }), 'next', DECK).effect).toBeUndefined();
    expect(reduce(at(0), 'first', DECK).effect).toBeUndefined();
    expect(reduce(at(2), { goto: 2 }, DECK).effect).toBeUndefined();
  });
});

describe('toggleSkip (grid, this session only)', () => {
  it('skips and unskips a slide by key without mutating the previous state', () => {
    const before = at(0);
    const after = run(before, { toggleSkip: 'q' });
    expect([...after.skipped]).toEqual(['q']);
    expect(before.skipped.size).toBe(0);
    expect(run(after, { toggleSkip: 'q' }).skipped.size).toBe(0);
  });

  it('the last slide (the End slide) cannot be skipped, nor can an unknown key', () => {
    expect(run(at(0), { toggleSkip: 'e' }).skipped.size).toBe(0);
    expect(run(at(0), { toggleSkip: 'nope' }).skipped.size).toBe(0);
  });

  it('skipping the current slide keeps it on screen; next moves on from it', () => {
    const s = run(at(2), { toggleSkip: 'q' });
    expect(s.slideIdx).toBe(2);
    expect(run(s, 'next')).toMatchObject({ slideIdx: 2, reveal: 1 });
    expect(run(s, 'next', 'next')).toMatchObject({ slideIdx: 3, reveal: 0 });
  });
});

describe('an empty deck', () => {
  it('never moves and never throws', () => {
    const empty = { slides: [] as ControlSlide[] };
    const s = initialPresenterState(empty);
    for (const ev of ['next', 'prev', 'first', 'last', { goto: 2 }, 'replay-sound', { toggleSkip: 'x' }] as const) {
      expect(reduce(s, ev, empty).state).toEqual(s);
    }
    expect(reduce(s, 'replay-sound', empty).effect).toBeUndefined();
  });
});
