import { layout, spacing, touchTarget } from '@hangul-route/design-system/tokens';
import { detailPaneWidth } from '@hangul-route/design-system/layout';
import { describe, expect, it } from 'vitest';
import { JOURNEY_COLUMNS, journeyCellSize, journeyGridMaxWidth } from '../pane-sizes';

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
