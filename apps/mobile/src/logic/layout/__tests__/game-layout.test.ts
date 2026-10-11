import { layoutClassFor } from '@hangul-route/design-system/layout';
import { spacing, touchTarget } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { gameArrangement, pictureTextArrangement, tileGridWidth } from '../game-layout';

const at = (width: number, height: number) => layoutClassFor({ width, height });

/** F-LAYOUT-001 §3.6, the six viewports of §3.1 plus the boundary windows a game can meet. */
describe('gameArrangement (Match Sound, Culture Quiz, Odd One Out)', () => {
  it('stacks on phones in portrait and on a portrait tablet', () => {
    expect(gameArrangement(at(320, 568))).toBe('stacked');
    expect(gameArrangement(at(375, 553))).toBe('stacked');
    expect(gameArrangement(at(390, 844))).toBe('stacked');
    expect(gameArrangement(at(768, 1024))).toBe('stacked');
  });

  it('puts the prompt beside the tiles on a wide landscape window', () => {
    expect(gameArrangement(at(1180, 820))).toBe('side');
    expect(gameArrangement(at(1024, 768))).toBe('side');
    expect(gameArrangement(at(960, 600))).toBe('side');
  });

  it('opts out of sideBySide on a short window, so a landscape phone stays as today', () => {
    expect(at(844, 390).sideBySide).toBe(true);
    expect(gameArrangement(at(844, 390))).toBe('stacked');
    expect(gameArrangement(at(932, 430))).toBe('stacked');
  });

  it('follows sideBySide at its 700 boundary when the window is not short', () => {
    expect(gameArrangement(at(699, 480))).toBe('stacked');
    expect(gameArrangement(at(700, 480))).toBe('side');
  });

  it('stacks while the window size is still unknown (first web frame)', () => {
    expect(gameArrangement(at(0, 0))).toBe('stacked');
  });
});

describe('pictureTextArrangement (Listen & Pick, picture or sound left, answers right)', () => {
  it('follows sideBySide at any height: a landscape phone gets two columns too', () => {
    expect(pictureTextArrangement(at(844, 390))).toBe('side');
    expect(pictureTextArrangement(at(1180, 820))).toBe('side');
  });

  it('stacks in portrait and on a narrow landscape window', () => {
    expect(pictureTextArrangement(at(390, 844))).toBe('stacked');
    expect(pictureTextArrangement(at(768, 1024))).toBe('stacked');
    expect(pictureTextArrangement(at(699, 400))).toBe('stacked');
  });
});

describe('tileGridWidth', () => {
  const tile = touchTarget.hero;
  const gap = spacing.md;

  it('leaves the phone grid alone: tiles wrap as they always did', () => {
    expect(tileGridWidth('compact', tile, gap)).toBeUndefined();
  });

  it('holds two tiles and one gap from regular up, so four tiles sit 2 x 2', () => {
    expect(tileGridWidth('regular', 115, gap)).toBe(2 * 115 + gap);
    expect(tileGridWidth('wide', 134, gap)).toBe(2 * 134 + gap);
  });

  it('never makes a tile narrower than the touch-target floor', () => {
    const width = tileGridWidth('regular', touchTarget.min, gap) ?? 0;
    expect((width - gap) / 2).toBeGreaterThanOrEqual(touchTarget.min);
  });
});
