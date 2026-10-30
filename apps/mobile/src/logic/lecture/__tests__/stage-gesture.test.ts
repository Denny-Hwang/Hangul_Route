import { spacing } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { SWIPE_MIN, SWIPE_RATIO } from '../stage-constants';
import {
  EDGE_GUARD_MIN,
  EDGE_GUARD_PAD,
  NUDGE_MS,
  TAP_SLOP,
  edgeGuard,
  gesturePointer,
  optionTarget,
  parseStageTarget,
  stageGesture,
  stageStepSource,
  type StageGesture,
} from '../stage-gesture';

/**
 * The stage gesture rule (AMENDMENTS-PRESENTER-NAV sections 6 and 7.2, row PN-2): every rule in
 * order, each at its boundary. Replaces the `gestureCommand` (thirds) and `inBarStrip` (the phone
 * bar's strip) cases of shell.test.ts.
 */

const W = 1280;
const guard = edgeGuard({ left: 0, right: 0 });

/** A one-finger touch tap on empty stage area of a target-free slide on a docked window. */
function g(over: Partial<StageGesture> = {}): StageGesture {
  return {
    pointer: 'touch',
    dx: 0,
    dy: 0,
    startX: W / 2,
    windowWidth: W,
    edgeGuard: guard,
    touches: 1,
    target: { kind: 'none' },
    slideHasTargets: false,
    layout: 'docked',
    covering: 'none',
    pointing: true,
    ...over,
  };
}

describe('the constants are the tokens the spec names', () => {
  it('TAP_SLOP is spacing.md, the edge guard spacing.xl or the inset plus spacing.sm, the ring 1 s', () => {
    expect(TAP_SLOP).toBe(spacing.md);
    expect(EDGE_GUARD_MIN).toBe(spacing.xl);
    expect(EDGE_GUARD_PAD).toBe(spacing.sm);
    expect(NUDGE_MS).toBe(1000);
    expect(SWIPE_MIN).toBe(60);
    expect(SWIPE_RATIO).toBe(1.5);
  });

  it('edgeGuard: 24 px a side, or the side inset + 8 when larger; a bad inset counts as none', () => {
    expect(edgeGuard({ left: 0, right: 0 })).toEqual({ left: 24, right: 24 });
    expect(edgeGuard({ left: 47, right: 16 })).toEqual({ left: 55, right: 24 });
    expect(edgeGuard({ left: 16, right: 17 })).toEqual({ left: 24, right: 25 });
    expect(edgeGuard({ left: Number.NaN, right: -10 })).toEqual({ left: 24, right: 24 });
  });
});

describe('rule 0: a covering overlay swallows the gesture', () => {
  it('another covering overlay (grid, Help, Blank, pause, the full timer): nothing, tap or swipe', () => {
    expect(stageGesture(g({ covering: 'other' }))).toBeNull();
    expect(stageGesture(g({ covering: 'other', dx: -200 }))).toBeNull();
    expect(stageGesture(g({ covering: 'other', target: { kind: 'option', index: 1 } }))).toBeNull();
    expect(stageGesture(g({ covering: 'other', pointer: 'mouse' }))).toBeNull();
  });

  it('the More sheet: a tap closes it (on an option too, never pointing), a swipe or a drag does nothing', () => {
    expect(stageGesture(g({ covering: 'more' }))).toBe('close-more');
    expect(stageGesture(g({ covering: 'more', pointer: 'mouse' }))).toBe('close-more');
    expect(stageGesture(g({ covering: 'more', target: { kind: 'option', index: 3 } }))).toBe('close-more');
    expect(stageGesture(g({ covering: 'more', dx: -200 }))).toBeNull();
    expect(stageGesture(g({ covering: 'more', dx: 200 }))).toBeNull();
    expect(stageGesture(g({ covering: 'more', dy: 30 }))).toBeNull();
  });
});

describe('rule 1: two or more touches at any time do nothing', () => {
  it('a two-finger swipe either way and a two-finger tap: nothing, whichever finger lifted first', () => {
    // The tracked finger's travel is the same whatever the lift order; only the count decides.
    for (const dx of [-200, 200, 0]) {
      expect(stageGesture(g({ touches: 2, dx }))).toBeNull();
      expect(stageGesture(g({ touches: 3, dx, layout: 'overlay' }))).toBeNull();
    }
    expect(stageGesture(g({ touches: 2, target: { kind: 'option', index: 1 } }))).toBeNull();
  });
});

describe('rule 2: a swipe (section 6)', () => {
  it('left is next, right is previous, at exactly 60 px and a ratio of exactly 1.5', () => {
    expect(stageGesture(g({ dx: -60, dy: 0 }))).toBe('next');
    expect(stageGesture(g({ dx: 60, dy: 0 }))).toBe('prev');
    expect(stageGesture(g({ dx: -60, dy: 40 }))).toBe('next');
    expect(stageGesture(g({ dx: 90, dy: -60 }))).toBe('prev');
  });

  it('59 px, or a ratio of 1.49, is no swipe and no tap: nothing', () => {
    expect(stageGesture(g({ dx: -59 }))).toBeNull();
    expect(stageGesture(g({ dx: 59 }))).toBeNull();
    expect(stageGesture(g({ dx: -149, dy: 100 }))).toBeNull();
    expect(stageGesture(g({ dx: 149, dy: -100 }))).toBeNull();
    // A vertical drag and a diagonal at 1.2.
    expect(stageGesture(g({ dx: 30, dy: 120 }))).toBeNull();
    expect(stageGesture(g({ dx: -120, dy: 100 }))).toBeNull();
  });

  it('a swipe over a content target steps (targets never claim a swipe), with any pointer and layout', () => {
    expect(stageGesture(g({ dx: -80, target: { kind: 'option', index: 1 } }))).toBe('next');
    expect(stageGesture(g({ dx: 80, target: { kind: 'other' }, slideHasTargets: true }))).toBe('prev');
    expect(stageGesture(g({ dx: -80, layout: 'overlay' }))).toBe('next');
    expect(stageGesture(g({ dx: -80, layout: 'rail' }))).toBe('next');
    expect(stageGesture(g({ dx: -80, pointer: 'mouse', slideHasTargets: true }))).toBe('next');
  });

  it('a touch swipe starting inside either edge guard does nothing: 23 px in is inside, 24 px out', () => {
    expect(stageGesture(g({ startX: 23, dx: -100 }))).toBeNull();
    expect(stageGesture(g({ startX: 24, dx: -100 }))).toBe('next');
    expect(stageGesture(g({ startX: 0, dx: 100 }))).toBeNull();
    expect(stageGesture(g({ startX: W - 23, dx: -100 }))).toBeNull();
    expect(stageGesture(g({ startX: W - 24, dx: -100 }))).toBe('next');
    expect(stageGesture(g({ startX: W - 1, dx: 100 }))).toBeNull();
  });

  it('with a 47 px inset the guard is 55: 54 px in is inside, 55 px out, on both edges', () => {
    const notch = edgeGuard({ left: 47, right: 47 });
    expect(stageGesture(g({ edgeGuard: notch, startX: 54, dx: 100 }))).toBeNull();
    expect(stageGesture(g({ edgeGuard: notch, startX: 55, dx: 100 }))).toBe('prev');
    expect(stageGesture(g({ edgeGuard: notch, startX: W - 54, dx: -100 }))).toBeNull();
    expect(stageGesture(g({ edgeGuard: notch, startX: W - 55, dx: -100 }))).toBe('next');
  });

  it('the edge guard is touch only: a mouse drag from the edge still swipes', () => {
    expect(stageGesture(g({ pointer: 'mouse', startX: 2, dx: 100 }))).toBe('prev');
    expect(stageGesture(g({ pointer: 'mouse', startX: W - 2, dx: -100 }))).toBe('next');
  });

  it('a tap at the edge is still a tap (the guard is for swipes)', () => {
    expect(stageGesture(g({ startX: 3 }))).toBe('nudge-next');
  });
});

describe('rule 3: anything between a tap and a swipe does nothing', () => {
  it('a move of 11 px is a tap; 12 px on either axis is not', () => {
    expect(stageGesture(g({ dx: 11, dy: -11 }))).toBe('nudge-next');
    expect(stageGesture(g({ dx: -12 }))).toBeNull();
    expect(stageGesture(g({ dy: 12 }))).toBeNull();
    expect(stageGesture(g({ pointer: 'mouse', dx: 11 }))).toBe('next');
    expect(stageGesture(g({ pointer: 'mouse', dx: 12 }))).toBeNull();
    expect(stageGesture(g({ dy: 11, target: { kind: 'option', index: 2 } }))).toEqual({ point: 2 });
    expect(stageGesture(g({ dy: 12, target: { kind: 'option', index: 2 } }))).toBeNull();
  });
});

describe('rule 4: a tap on a content target never steps', () => {
  it('on an option it points (owner choice O2), or does nothing without pointing', () => {
    for (const index of [1, 2, 3, 4]) {
      expect(stageGesture(g({ target: { kind: 'option', index }, slideHasTargets: true }))).toEqual({ point: index });
      expect(stageGesture(g({ target: { kind: 'option', index }, slideHasTargets: true, pointing: false }))).toBeNull();
      expect(stageGesture(g({ target: { kind: 'option', index }, slideHasTargets: true, pointer: 'mouse', pointing: false }))).toBeNull();
      expect(stageGesture(g({ target: { kind: 'option', index }, slideHasTargets: true, layout: 'overlay', pointing: false }))).toBeNull();
    }
  });

  it('on a step, a tile or a chip it does nothing, with any pointer and layout', () => {
    for (const marker of ['step', 'tile', 'chip']) {
      const target = parseStageTarget(marker);
      expect(target).toEqual({ kind: 'other' });
      for (const pointer of ['mouse', 'touch'] as const) {
        for (const layout of ['docked', 'rail', 'overlay'] as const) {
          expect(stageGesture(g({ target, pointer, layout, slideHasTargets: true }))).toBeNull();
        }
      }
    }
  });
});

describe('rule 5: a tap on empty stage area', () => {
  it('a mouse click on a target-free slide goes on (owner choice O4), anywhere on it: no left-third back', () => {
    for (const startX of [10, W * 0.1, W / 2, W * 0.8, W - 10]) {
      expect(stageGesture(g({ pointer: 'mouse', startX }))).toBe('next');
    }
  });

  it('a mouse click on a slide with targets does nothing, beside an option included', () => {
    expect(stageGesture(g({ pointer: 'mouse', slideHasTargets: true }))).toBeNull();
    expect(stageGesture(g({ pointer: 'mouse', slideHasTargets: true, layout: 'overlay' }))).toBeNull();
  });

  it('a touch tap on a docked window or the rail rings Next and never steps (owner choice O5)', () => {
    expect(stageGesture(g({ layout: 'docked' }))).toBe('nudge-next');
    expect(stageGesture(g({ layout: 'rail' }))).toBe('nudge-next');
    expect(stageGesture(g({ layout: 'docked', slideHasTargets: true }))).toBe('nudge-next');
    expect(stageGesture(g({ layout: 'rail', slideHasTargets: true }))).toBe('nudge-next');
  });

  it('a touch tap in the overlay layout shows or hides the bar, on any slide', () => {
    expect(stageGesture(g({ layout: 'overlay' }))).toBe('toggle-bar');
    expect(stageGesture(g({ layout: 'overlay', slideHasTargets: true }))).toBe('toggle-bar');
  });

  it('no tap ever gives previous, whatever the input', () => {
    const results = new Set<unknown>();
    for (const pointer of ['mouse', 'touch'] as const)
      for (const layout of ['docked', 'rail', 'overlay'] as const)
        for (const covering of ['none', 'more', 'other'] as const)
          for (const slideHasTargets of [false, true])
            for (const pointing of [false, true])
              for (const touches of [1, 2])
                for (const target of [parseStageTarget(null), parseStageTarget('option:1'), parseStageTarget('step')])
                  for (const startX of [0, 10, W / 2, W - 10, W])
                    for (const [dx, dy] of [[0, 0], [11, 11], [-11, 5], [5, -11]] as const) {
                      results.add(JSON.stringify(stageGesture({ pointer, dx, dy, startX, windowWidth: W, edgeGuard: guard, touches, target, slideHasTargets, layout, covering, pointing })));
                    }
    expect(results.has(JSON.stringify('prev'))).toBe(false);
    expect(results.has(JSON.stringify('next'))).toBe(true);
  });
});

describe('the target and the pointer of a gesture', () => {
  it('parseStageTarget reads option:1 to option:4 as an option, step / tile / chip as another target, else none', () => {
    expect(parseStageTarget('option:1')).toEqual({ kind: 'option', index: 1 });
    expect(parseStageTarget('option:4')).toEqual({ kind: 'option', index: 4 });
    expect(parseStageTarget(optionTarget(2))).toEqual({ kind: 'option', index: 3 });
    expect(parseStageTarget('tile')).toEqual({ kind: 'other' });
    expect(parseStageTarget('chip')).toEqual({ kind: 'other' });
    expect(parseStageTarget(null)).toEqual({ kind: 'none' });
    expect(parseStageTarget(undefined)).toEqual({ kind: 'none' });
    expect(parseStageTarget('option:0')).toEqual({ kind: 'none' });
    expect(parseStageTarget('option:x')).toEqual({ kind: 'none' });
    expect(parseStageTarget('something')).toEqual({ kind: 'none' });
  });

  it('gesturePointer: a touch event is touch; a mouse event after a touch or pen pointerdown is touch; else mouse', () => {
    expect(gesturePointer('touchstart', null)).toBe('touch');
    expect(gesturePointer('touchstart', 'mouse')).toBe('touch');
    expect(gesturePointer('mousedown', 'touch')).toBe('touch');
    expect(gesturePointer('mousedown', 'mouse')).toBe('mouse');
    expect(gesturePointer('mousedown', null)).toBe('mouse');
    expect(gesturePointer(undefined, null)).toBe('mouse');
  });
});

describe('the source of a stage step, for lecture.complete (section 12, row PN-6)', () => {
  it('a step from a tap is a mouse click; a step from a swipe or a mouse drag is a swipe', () => {
    // A mouse click on empty area of a target-free slide steps forward: a click.
    const click = g({ pointer: 'mouse', dx: TAP_SLOP - 1, dy: -(TAP_SLOP - 1) });
    expect(stageGesture(click)).toBe('next');
    expect(stageStepSource(click)).toBe('click');
    for (const pointer of ['touch', 'mouse'] as const) {
      const left = g({ pointer, dx: -SWIPE_MIN, dy: 0 });
      const right = g({ pointer, dx: SWIPE_MIN, dy: 0 });
      expect([stageGesture(left), stageStepSource(left)], pointer).toEqual(['next', 'swipe']);
      expect([stageGesture(right), stageStepSource(right)], pointer).toEqual(['prev', 'swipe']);
    }
    // A touch tap never steps, so its source is never read.
    expect(stageGesture(g({ pointer: 'touch' }))).toBe('nudge-next');
  });
});
