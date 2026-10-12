import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { motion } from '@hangul-route/design-system/tokens';
import { cubicBezierPoints, flipAction, mayFlip, nextFace, swapAtEdge, type FlipFace } from '../flip';

/**
 * F-VOC-003 PR C-2 (section 3.5): the flip of CardDetailView is extracted into
 * components/FlipCard.tsx so flashcards can reuse it; the pure part lives in
 * logic/flip.ts. The component has no renderer harness here (node vitest), so
 * its contract is read from the source, like detail-views-extraction.test.ts.
 */

describe('nextFace', () => {
  it('turns front to back and back to front', () => {
    expect(nextFace('front')).toBe('back');
    expect(nextFace('back')).toBe('front');
  });

  it('two flips return to the start', () => {
    for (const face of ['front', 'back'] as const satisfies readonly FlipFace[]) {
      expect(nextFace(nextFace(face))).toBe(face);
    }
  });
});

describe('mayFlip (taps are ignored while disabled or mid-flip, F-MOTION-002 section 3.3)', () => {
  it('allows a flip only when enabled and not already flipping', () => {
    expect(mayFlip({ flipping: false })).toBe(true);
    expect(mayFlip({ disabled: false, flipping: false })).toBe(true);
    expect(mayFlip({ disabled: true, flipping: false })).toBe(false);
    expect(mayFlip({ disabled: false, flipping: true })).toBe(false);
    expect(mayFlip({ disabled: true, flipping: true })).toBe(false);
  });
});

describe('flipAction (what a press does, F-MOTION-002 section 3.3)', () => {
  it('ignores a press while disabled or already turning, whatever the motion setting', () => {
    for (const reducedMotion of [false, true]) {
      expect(flipAction({ disabled: true, flipping: false, reducedMotion })).toBe('ignore');
      expect(flipAction({ disabled: false, flipping: true, reducedMotion })).toBe('ignore');
      expect(flipAction({ disabled: true, flipping: true, reducedMotion })).toBe('ignore');
    }
  });

  it('swaps at once under reduced motion (no turn, so onFlippingChange is never called)', () => {
    expect(flipAction({ disabled: false, flipping: false, reducedMotion: true })).toBe('instant');
  });

  it('otherwise animates the turn (bracketed by onFlippingChange true then false)', () => {
    expect(flipAction({ disabled: false, flipping: false, reducedMotion: false })).toBe('animate');
    expect(flipAction({ flipping: false, reducedMotion: false })).toBe('animate');
  });
});

describe('swapAtEdge (the midpoint swap only flips the card the learner tapped)', () => {
  it('swaps when the first leg finished on the face it started from', () => {
    expect(swapAtEdge({ finished: true, startFace: 'front', currentFace: 'front' })).toBe(true);
    expect(swapAtEdge({ finished: true, startFace: 'back', currentFace: 'back' })).toBe(true);
  });

  it('does not swap when the caller changed the face mid-turn (e.g. moved on to the next card)', () => {
    expect(swapAtEdge({ finished: true, startFace: 'back', currentFace: 'front' })).toBe(false);
    expect(swapAtEdge({ finished: true, startFace: 'front', currentFace: 'back' })).toBe(false);
  });

  it('does not swap when the first leg was cancelled', () => {
    expect(swapAtEdge({ finished: false, startFace: 'front', currentFace: 'front' })).toBe(false);
  });
});

describe('cubicBezierPoints (the flip eases on the motion.easing.standard token)', () => {
  it('reads a CSS cubic-bezier string', () => {
    expect(cubicBezierPoints('cubic-bezier(0.2, 0, 0, 1)')).toEqual([0.2, 0, 0, 1]);
    expect(cubicBezierPoints('cubic-bezier(0.34,1.56,0.64,1)')).toEqual([0.34, 1.56, 0.64, 1]);
    expect(cubicBezierPoints('cubic-bezier(-0.1, -2, .5, 1e0)')).toEqual([-0.1, -2, 0.5, 1]);
  });

  it('parses every easing token', () => {
    for (const value of Object.values(motion.easing)) {
      expect(cubicBezierPoints(value)).toHaveLength(4);
    }
    expect(cubicBezierPoints(motion.easing.standard)).toEqual([0.2, 0, 0, 1]);
  });

  it('returns null for anything else', () => {
    for (const value of ['ease-in', 'cubic-bezier(0.2, 0, 0)', 'cubic-bezier(a, b, c, d)', 'cubic-bezier(0.2, 0, 0, 1, 2)', '']) {
      expect(cubicBezierPoints(value)).toBeNull();
    }
  });
});

const SRC = resolve(__dirname, '../..');
const read = (file: string): string => readFileSync(resolve(SRC, file), 'utf8');

describe('components/FlipCard.tsx wires the tested decisions', () => {
  const flip = read('components/FlipCard.tsx');

  it('switches on flipAction and guards the midpoint with swapAtEdge', () => {
    expect(flip).toContain('flipAction(');
    expect(flip).toContain('swapAtEdge(');
    expect(flip).toContain('motion.duration.base');
    expect(flip).toContain('motion.easing.standard');
  });

  it('uses tokens only: no colour literals and no inline easing curve', () => {
    expect(flip).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(flip).not.toMatch(/rgba?\(/);
    expect(flip).not.toMatch(/Easing\.bezier\(\s*\d/);
  });
});

describe('CardDetailView uses FlipCard (behaviour unchanged)', () => {
  const view = read('screens/library/CardDetailView.tsx');

  it('renders FlipCard and no longer inlines the animation', () => {
    expect(view).toContain('<FlipCard');
    expect(view).not.toContain('useSharedValue');
    expect(view).not.toContain('withTiming');
  });

  it('gates Share mid-flip through onFlippingChange (F-CARD-003 section 8)', () => {
    expect(view).toContain('onFlippingChange={setIsFlipping}');
    expect(view).toContain('disabled={isFlipping}');
  });

  it('a card that cannot flip says it is locked on either face, shows no flip hint and returns to the front', () => {
    expect(view).toContain('disabled={!canFlip}');
    // F-STORY-006 PR 6.5b: the locked label carries the earn hint ("Locked card. Finish the episode: ...").
    expect(view).toContain('accessibilityLabelFront={canFlip ? messages.a11y.flipToBack : lockedLabel}');
    expect(view).toContain('accessibilityLabelBack={canFlip ? messages.a11y.flipToFront : lockedLabel}');
    expect(view).toContain('flipHint={canFlip ? m.flip.back : null}');
    expect(view).toMatch(/if \(!canFlip\) setFace\('front'\)/);
  });
});
