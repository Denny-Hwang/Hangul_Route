import { describe, expect, it } from 'vitest';
import { cardById } from '../heritage-cards';

/**
 * The words of a Stage 1 card say what its picture shows (AMENDMENTS-STAGE1-CONTENT-FIXES
 * CF-1a #8; the kite picture was redrawn by AMENDMENTS-PICTURES-2026-11 PX-2).
 */
describe('Stage 1 card text', () => {
  it('the kite card describes the shield kite of its picture, not a diamond kite with a tiger face', () => {
    const kite = cardById('card:kite');
    expect(kite?.blurbEn).toBe('A paper kite on bamboo sticks, with a red circle at the top.');
    expect(kite?.blurbEn).not.toMatch(/diamond|tiger/i);
    expect(kite?.factEn).toContain('Bangpaeyeon');
  });
});
