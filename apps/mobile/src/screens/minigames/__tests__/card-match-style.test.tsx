import { MARK_MIN, borderWidth, colors, spacing } from '@hangul-route/design-system';
import { describe, expect, it } from 'vitest';
import { WCAG_AA_LARGE, WCAG_AA_NORMAL, contrastRatio } from '../../../../../../packages/design-system/src/contrast';
import { CARD_MATCH_STATES, CARD_MARK, PICK_RING, cardMatchStyle, cardTopPadding } from '../card-match-style';

/**
 * F-A11Y-001 row AF-3 (§6 test 10: "if AF-3 draws Card Match's card from a pure style, the same rules cover it"): each
 * state's look, the marks and their contrast, and the room kept for the mark.
 */
describe('cardMatchStyle', () => {
  it('a right pair has a check, a miss a replay, and nothing else has a mark', () => {
    expect(cardMatchStyle('matched').mark?.icon).toBe('check');
    expect(cardMatchStyle('wrong').mark?.icon).toBe('replay');
    expect(cardMatchStyle('idle').mark).toBeNull();
    expect(cardMatchStyle('picked').mark).toBeNull();
  });

  it('colour rule: check is feedback.success, replay is text.primary; never danger', () => {
    expect(cardMatchStyle('matched').mark?.color).toBe(colors.feedback.success);
    expect(cardMatchStyle('wrong').mark?.color).toBe(colors.text.primary);
    for (const state of CARD_MATCH_STATES) {
      const look = cardMatchStyle(state);
      expect([look.backgroundColor, look.borderColor, look.mark?.color]).not.toContain(colors.feedback.danger);
    }
  });

  it('a mark reads on its card fill (>= 3:1, non-text): check 4.28:1, replay 14.02:1', () => {
    for (const state of ['matched', 'wrong'] as const) {
      const look = cardMatchStyle(state);
      expect(contrastRatio(look.mark!.color, look.backgroundColor), state).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    }
  });

  it('every state keeps its text readable: text.primary on its fill >= 4.5:1 (the 0.5 fade is gone)', () => {
    for (const state of CARD_MATCH_STATES) {
      expect(contrastRatio(colors.text.primary, cardMatchStyle(state).backgroundColor), state).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    }
  });

  it('every state differs from idle by more than its border colour: a fill, a mark or a ring', () => {
    const idle = cardMatchStyle('idle');
    for (const state of CARD_MATCH_STATES.filter((s) => s !== 'idle')) {
      const look = cardMatchStyle(state);
      expect(look.backgroundColor !== idle.backgroundColor || look.mark !== null || look.ring, state).toBe(true);
    }
  });

  it('only the picked card has the solid ring, and it reads on the canvas (non-text)', () => {
    expect(CARD_MATCH_STATES.filter((s) => cardMatchStyle(s).ring)).toEqual(['picked']);
    expect(contrastRatio(PICK_RING.color, colors.surface.canvas)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  it('every colour a state paints is a colour token (no literal)', () => {
    const tokenValues = new Set(Object.values(colors).flatMap((group) => Object.values(group as Record<string, string>)));
    for (const state of CARD_MATCH_STATES) {
      const look = cardMatchStyle(state);
      for (const value of [look.backgroundColor, look.borderColor, look.mark?.color]) {
        if (value !== undefined) expect(tokenValues.has(value), `${state}: ${value}`).toBe(true);
      }
    }
  });

  it('an unknown state reads as idle', () => {
    expect(cardMatchStyle('junk' as never)).toEqual(cardMatchStyle('idle'));
  });
});

describe('the room for the mark and the ring', () => {
  it('the mark is MARK_MIN (20) and sits spacing.xs in from the corner', () => {
    expect(CARD_MARK).toEqual({ size: 20, inset: spacing.xs });
    expect(CARD_MARK.size).toBe(MARK_MIN);
  });

  it('the top band is max(spacing.xl, cardPadding) and always covers the mark and its inset', () => {
    expect(cardTopPadding(spacing.md)).toBe(spacing.xl);
    expect(cardTopPadding(17)).toBe(spacing.xl);
    expect(cardTopPadding(spacing.xl + 6)).toBe(spacing.xl + 6);
    for (const padding of [0, spacing.md, 17, 40]) expect(cardTopPadding(padding)).toBeGreaterThanOrEqual(CARD_MARK.inset + CARD_MARK.size);
  });

  it('the pick ring is 5 dp outside the card (a canvas gap, then a thick ring), 3 dp clear of the next card in the 8 dp gap', () => {
    expect(PICK_RING.gap).toBe(spacing.xxs);
    expect(PICK_RING.width).toBe(borderWidth.thick);
    expect(PICK_RING.total).toBe(5);
    expect(spacing.sm - PICK_RING.total).toBe(3);
  });
});
