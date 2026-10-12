import { touchTarget, typography } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { BROWSE_ACTION_MAX_WIDTH, BROWSE_TEXT_SCALE_CAP, PREVIEW_STRIP_MAX_HEIGHT } from '../layout';

/** The few All lessons sizes that are not tokens (design/screens/browse/README.md, Constants), each from its source. */
describe('browse layout constants', () => {
  it('the strip and section labels stop growing at 1.3 x body (23.4)', () => {
    expect(BROWSE_TEXT_SCALE_CAP).toBe(1.3);
    expect(typography.size.body * BROWSE_TEXT_SCALE_CAP).toBeCloseTo(23.4);
  });

  it('the strip ceiling is the height measured at 320 with 200 % text, and holds a 64 target', () => {
    expect(PREVIEW_STRIP_MAX_HEIGHT).toBe(135);
    expect(PREVIEW_STRIP_MAX_HEIGHT).toBeGreaterThan(touchTarget.min);
  });

  it('full-width actions are capped at 26rem from the regular class', () => {
    expect(BROWSE_ACTION_MAX_WIDTH).toBe(26 * 16);
  });
});
