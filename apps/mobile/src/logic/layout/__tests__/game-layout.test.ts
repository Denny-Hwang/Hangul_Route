import { layoutClassFor } from '@hangul-route/design-system/layout';
import { spacing, touchTarget } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { answersColumnWidth, gameArrangement, pictureTextArrangement, stickyPromptColumn, tileGridWidth, twoUpFits } from '../game-layout';

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
    expect(tileGridWidth(at(390, 844), tile, gap)).toBeUndefined();
    expect(tileGridWidth(at(320, 568), tile, gap)).toBeUndefined();
  });

  it('holds two tiles and one gap from regular up, so four tiles sit 2 x 2', () => {
    expect(tileGridWidth(at(768, 1024), 115, gap)).toBe(2 * 115 + gap);
    expect(tileGridWidth(at(1180, 820), 134, gap)).toBe(2 * 134 + gap);
  });

  it('leaves a short window alone too: a landscape phone keeps its single row of four, as today', () => {
    expect(at(844, 390).width).toBe('regular');
    expect(tileGridWidth(at(844, 390), tile, gap)).toBeUndefined();
    expect(at(932, 430).width).toBe('wide');
    expect(tileGridWidth(at(932, 430), tile, gap)).toBeUndefined();
  });

  it('fits a 2 x 2 grid of scaled tiles inside the answers column wherever the prompt sits beside it', () => {
    for (const [w, h] of [
      [1180, 820],
      [1024, 768],
      [960, 600],
      [700, 480],
    ] as const) {
      const l = at(w, h);
      const grid = tileGridWidth(l, Math.round(touchTarget.hero * l.mediaScale), gap) ?? 0;
      expect(grid).toBeLessThanOrEqual(answersColumnWidth(l, gameArrangement(l), spacing.xl));
    }
  });
});

describe('answersColumnWidth', () => {
  const gap = spacing.xl;

  it('is the whole reading column when stacked', () => {
    expect(answersColumnWidth(at(390, 844), 'stacked', gap)).toBe(390 - 2 * spacing.lg);
    expect(answersColumnWidth(at(768, 1024), 'stacked', gap)).toBe(720);
  });

  it('is half the reading column, less the gap, beside the prompt', () => {
    expect(answersColumnWidth(at(1180, 820), 'side', gap)).toBe((720 - gap) / 2);
    expect(answersColumnWidth(at(844, 390), 'side', gap)).toBe((720 - gap) / 2);
    expect(answersColumnWidth(at(700, 480), 'side', gap)).toBe((700 - 2 * spacing.xl - gap) / 2);
  });

  it('is 0 while the window size is unknown', () => {
    expect(answersColumnWidth(at(0, 0), 'side', gap)).toBe(0);
    expect(answersColumnWidth(at(0, 0), 'stacked', gap)).toBe(0);
  });
});

describe('twoUpFits', () => {
  it('is true when each of two cards gets at least the minimum width', () => {
    expect(twoUpFits(348, 12, 168)).toBe(true);
    expect(twoUpFits(348, 12, 169)).toBe(false);
  });

  it('is false for an unknown column', () => {
    expect(twoUpFits(0, 12, 100)).toBe(false);
    expect(twoUpFits(Number.NaN, 12, 100)).toBe(false);
  });
});

describe('stickyPromptColumn (Realia Read, D-2 D7)', () => {
  it('sticks the prompt column side by side on the web, only when the game asks', () => {
    expect(stickyPromptColumn('side', true, 'web')).toBe(true);
    expect(stickyPromptColumn('stacked', true, 'web')).toBe(false);
    expect(stickyPromptColumn('side', false, 'web')).toBe(false);
    expect(stickyPromptColumn('side', true, 'ios')).toBe(false);
    expect(stickyPromptColumn('side', true, 'android')).toBe(false);
  });
});
