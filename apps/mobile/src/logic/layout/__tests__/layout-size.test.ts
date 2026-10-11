import { layout, spacing, touchTarget } from '@hangul-route/design-system/tokens';
import { detailPaneWidth, layoutClassFor } from '@hangul-route/design-system/layout';
import { describe, expect, it } from 'vitest';
import {
  JOURNEY_COLUMNS,
  cardGalleryColumns,
  cardThumbArtSize,
  contentWidth,
  galleryGridWidth,
  gridCellWidth,
  gridRows,
  journeyCellSize,
  journeyGridMaxWidth,
} from '../pane-sizes';

const cell = (gridWidth: number): number => journeyCellSize(gridWidth, spacing.xs, layout.columns.journeyCellMax);

/** F-LAYOUT-001 §3.7 "Sizes check out" and §3.8: tappable sizes never go below the 64 floor. */
describe('journeyCellSize', () => {
  it('is (400 - 4 gaps) / 5 = 76 at the master pane width, above the touch target floor', () => {
    expect(cell(layout.pane.master)).toBe(76);
    expect(cell(layout.pane.master)).toBeGreaterThanOrEqual(touchTarget.min);
  });

  it('keeps the master pane at 400 in the narrowest pane window (900 wide), so cells stay at 76', () => {
    // Only the detail pane gives way at 900; it still has room.
    expect(detailPaneWidth(layout.breakpoint.wide)).toBeGreaterThan(0);
    expect(cell(layout.pane.master)).toBeGreaterThanOrEqual(touchTarget.min);
  });

  it('is capped at layout.columns.journeyCellMax', () => {
    expect(cell(1000)).toBe(layout.columns.journeyCellMax);
  });

  it('uses five columns', () => {
    expect(JOURNEY_COLUMNS).toBe(5);
  });
});

describe('journeyGridMaxWidth', () => {
  it('is five capped cells and four gaps', () => {
    expect(journeyGridMaxWidth(spacing.xs, layout.columns.journeyCellMax)).toBe(5 * 112 + 4 * spacing.xs);
  });
});

describe('detail pane width (§3.7)', () => {
  it('is 412 at 900 and 536 at 1024, and the 1120 cap binds from 1184', () => {
    expect(detailPaneWidth(900)).toBe(412);
    expect(detailPaneWidth(1024)).toBe(536);
    expect(detailPaneWidth(1184)).toBe(detailPaneWidth(1600));
  });
});

/** The Library gallery (F-LAYOUT-001 §3.6, §3.7): 3 columns in the 400 master pane and on regular, 2 on phones and short windows. */
describe('card gallery', () => {
  const lc = (width: number, height: number) => layoutClassFor({ width, height });
  const columns = (width: number, height: number): number => cardGalleryColumns(lc(width, height), layout.columns.cards.compact);

  it('has the class columns: 2 on a phone, 3 on regular and wide windows', () => {
    expect(columns(390, 844)).toBe(2);
    expect(columns(768, 1024)).toBe(3);
    expect(columns(1180, 820)).toBe(3);
  });

  it('keeps the phone 2 columns on a short window (844x390 and 932x430)', () => {
    expect(columns(844, 390)).toBe(2);
    expect(columns(932, 430)).toBe(2);
  });

  it('cells in the 400 master pane are (400 - 2 gaps) / 3 = 128, above the touch target floor', () => {
    expect(gridCellWidth(layout.pane.master, 3, spacing.sm)).toBe(128);
    expect(gridCellWidth(layout.pane.master, 3, spacing.sm)).toBeGreaterThanOrEqual(touchTarget.min);
  });

  it('cells on the narrowest regular window (600) stay above the floor', () => {
    const grid = contentWidth(layout.breakpoint.regular, layout.gutter.regular, layout.maxWidth.full);
    expect(grid).toBe(600 - 2 * layout.gutter.regular);
    expect(gridCellWidth(grid, 3, spacing.sm)).toBeGreaterThanOrEqual(touchTarget.min);
  });

  it('a cell is never negative, and a grid with no columns has no cells', () => {
    expect(gridCellWidth(4, 3, spacing.sm)).toBe(0);
    expect(gridCellWidth(400, 0, spacing.sm)).toBe(0);
  });

  it('the content width is the window less two gutters, capped at the full width, never negative', () => {
    expect(contentWidth(768, 24, 1120)).toBe(720);
    expect(contentWidth(1600, 32, 1120)).toBe(1120);
    expect(contentWidth(0, 16, 1120)).toBe(0);
    expect(contentWidth(Number.NaN, 16, 1120)).toBe(0);
  });

  it('card art scales with the window but shrinks to fit the cell less its padding and border', () => {
    // 96 x 1.4 = 134 does not fit a 128 cell with 2 x 12 padding and 2 x 3 border: 98.
    expect(cardThumbArtSize(134, 128, 30)).toBe(98);
    // Regular (96 x 1.2 = 115) in a 229 cell: fits as scaled.
    expect(cardThumbArtSize(115, 229, 30)).toBe(115);
    expect(cardThumbArtSize(96, 10, 30)).toBe(0);
  });

  it('a master pane narrowed by a classic scrollbar (383 measured) shrinks the art to fit: 122 cell, 92 art', () => {
    const cellWidth = gridCellWidth(383, 3, spacing.sm);
    expect(cellWidth).toBe(122);
    expect(cardThumbArtSize(134, cellWidth, 30)).toBe(92);
  });

  it('the grid width is the measured one for the current gallery, else the computed fallback', () => {
    expect(galleryGridWidth({ mode: 'pane', width: 383 }, 'pane', 400)).toBe(383);
    // A measurement from the other gallery (before a rotation) is stale until the new one is measured.
    expect(galleryGridWidth({ mode: 'row', width: 720 }, 'pane', 400)).toBe(400);
    expect(galleryGridWidth(null, 'row', 720)).toBe(720);
    expect(galleryGridWidth({ mode: 'row', width: Number.NaN }, 'row', 720)).toBe(720);
  });
});

describe('gridRows', () => {
  it('splits into rows of `columns` and pads the last row with null so cells keep one width', () => {
    expect(gridRows(['a', 'b', 'c', 'd'], 3)).toEqual([
      ['a', 'b', 'c'],
      ['d', null, null],
    ]);
    expect(gridRows(['a', 'b', 'c'], 3)).toEqual([['a', 'b', 'c']]);
  });

  it('has no rows for no items or no columns', () => {
    expect(gridRows([], 3)).toEqual([]);
    expect(gridRows(['a'], 0)).toEqual([]);
  });
});
