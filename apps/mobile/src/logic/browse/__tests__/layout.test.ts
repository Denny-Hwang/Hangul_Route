import { touchTarget, typography } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { BROWSE_TEXT_SCALE_CAP, PREVIEW_STRIP_MAX_HEIGHT } from '../layout';

/**
 * The All lessons sizes that are not tokens (design/screens/browse/README.md, Constants), checked against
 * the tokens they are derived from. The values themselves are the mock's; BR-8's browse.spec measures the
 * mounted strip against PREVIEW_STRIP_MAX_HEIGHT.
 */
describe('browse layout constants', () => {
  it('the strip and section labels stop growing at 23.4, the mock cap, from the body token', () => {
    expect(typography.size.body * BROWSE_TEXT_SCALE_CAP).toBeCloseTo(23.4);
  });

  it('the strip ceiling holds a 64 target with room for its text', () => {
    expect(PREVIEW_STRIP_MAX_HEIGHT).toBeGreaterThan(touchTarget.min);
  });
});
