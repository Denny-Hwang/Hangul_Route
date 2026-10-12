import { describe, expect, it } from 'vitest';
import { FOUR_TAB_LABEL_FIT, TAB_ICON, mainTabs } from '../tab';

/**
 * The learner tab bar (AMENDMENTS-ROUTE-LEARNING-ROUTE section 5.1, LR-OD-2,
 * section 10; design/screens/learning-route/tab-bar.md).
 */
describe('mainTabs: the tab order', () => {
  it('flag on: Today, Route, Journey, Library (LR-OD-2)', () => {
    expect(mainTabs(true)).toEqual(['Home', 'Route', 'Journey', 'Library']);
  });

  it('flag off: the three tabs of today, exactly', () => {
    expect(mainTabs(false)).toEqual(['Home', 'Journey', 'Library']);
  });
});

describe('TAB_ICON: drawn glyphs only', () => {
  it('the Route tab draws the route glyph, the others keep theirs', () => {
    expect(TAB_ICON).toEqual({ Home: 'home', Route: 'route', Journey: 'journey', Library: 'library' });
  });
});

describe('FOUR_TAB_LABEL_FIT: the native label cap of the four-tab bar (tab-bar.md, assumption a)', () => {
  it('grows up to 1.3 x caption, stays on one line and shrinks to fit instead of being cut off', () => {
    expect(FOUR_TAB_LABEL_FIT).toEqual({ maxFontSizeMultiplier: 1.3, numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 1 / 1.3 });
  });

  it('a capped label never shrinks below the caption size (minimumFontScale x the cap = 1)', () => {
    expect(FOUR_TAB_LABEL_FIT.minimumFontScale * FOUR_TAB_LABEL_FIT.maxFontSizeMultiplier).toBeCloseTo(1, 10);
  });
});
