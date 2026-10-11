import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mayFlip, nextFace, type FlipFace } from '../flip';

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

const SRC = resolve(__dirname, '../..');
const read = (file: string): string => readFileSync(resolve(SRC, file), 'utf8');

describe('components/FlipCard.tsx (the extracted flip)', () => {
  const flip = read('components/FlipCard.tsx');

  it('exports the component with the spec props', () => {
    expect(flip).toContain('export function FlipCard(');
    expect(flip).toMatch(/face: FlipFace/);
    expect(flip).toMatch(/onFlip: \(\) => void/);
    expect(flip).toMatch(/front: React\.ReactNode/);
    expect(flip).toMatch(/back: React\.ReactNode/);
    expect(flip).toMatch(/disabled\?: boolean/);
    expect(flip).toMatch(/onFlippingChange\?: \(flipping: boolean\) => void/);
    expect(flip).toMatch(/accessibilityLabelFront: string/);
    expect(flip).toMatch(/accessibilityLabelBack: string/);
  });

  it('keeps the two base-duration legs, the edge-on swap and the reduced-motion instant swap', () => {
    expect(flip).toContain('useSharedValue');
    expect(flip).toContain('motion.duration.base');
    expect(flip).toContain('useReducedMotion');
    expect(flip).toContain('mayFlip(');
    // the face changes once, at the midpoint, through the caller's onFlip
    expect(flip).toContain('runOnJS(onFlip)');
  });

  it('uses tokens only: no colour literals', () => {
    expect(flip).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(flip).not.toMatch(/rgba?\(/);
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

  it('keeps the flip labels and the locked label, and only an unlocked card flips', () => {
    expect(view).toContain('messages.a11y.flipToBack');
    expect(view).toContain('messages.a11y.flipToFront');
    expect(view).toContain('messages.a11y.lockedCard');
    expect(view).toContain('disabled={!canFlip}');
  });
});
