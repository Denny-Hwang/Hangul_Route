import { describe, expect, it } from 'vitest';
import { CHOICE_CARD_STATES, choiceCardStyle, choiceCardTileWidth } from '../components/ChoiceCard/style';
import type { ChoiceCardState } from '../components/ChoiceCard/types';
import { borderWidth, colors, radii, spacing, touchTarget } from '../tokens';

describe('choiceCardStyle (F-STORY-003 PR 3.3)', () => {
  it('lists the five states of the spec, in order', () => {
    expect(CHOICE_CARD_STATES).toEqual(['idle', 'correct', 'wrong', 'hint', 'disabled']);
  });

  it('shares the radius, min height and text colour across every state', () => {
    for (const state of CHOICE_CARD_STATES) {
      const s = choiceCardStyle(state);
      expect(s.borderRadius).toBe(radii.lg);
      expect(s.minHeight).toBe(touchTarget.child);
      expect(s.minHeight).toBe(80);
      expect(s.textColor).toBe(colors.text.primary);
    }
  });

  it('idle: paper fill, subtle border, base width, tappable, no mark', () => {
    const s = choiceCardStyle('idle');
    expect(s.backgroundColor).toBe(colors.surface.paper);
    expect(s.borderColor).toBe(colors.border.subtle);
    expect(s.borderWidth).toBe(borderWidth.base);
    expect(s.interactive).toBe(true);
    expect(s.selected).toBe(false);
    expect(s.disabled).toBe(false);
    expect(s.mark).toBeNull();
  });

  it('correct: success tint and border, check mark, selected, locked', () => {
    const s = choiceCardStyle('correct');
    expect(s.backgroundColor).toBe(colors.feedback.successLight);
    expect(s.borderColor).toBe(colors.feedback.success);
    expect(s.borderWidth).toBe(borderWidth.base);
    expect(s.mark).toEqual({ icon: 'check', color: colors.feedback.success });
    expect(s.selected).toBe(true);
    expect(s.disabled).toBe(false);
    expect(s.interactive).toBe(false);
  });

  it('wrong: amber nudge tint and border (never red), try-another mark, selected, locked', () => {
    const s = choiceCardStyle('wrong');
    expect(s.backgroundColor).toBe(colors.feedback.nudgeLight);
    expect(s.borderColor).toBe(colors.feedback.nudge);
    expect(s.borderWidth).toBe(borderWidth.base);
    expect(s.mark).toEqual({ icon: 'replay', color: colors.text.primary });
    expect(s.selected).toBe(true);
    expect(s.disabled).toBe(false);
    expect(s.interactive).toBe(false);
    // Anti-shame (CLAUDE.md s1): nothing on a miss uses the danger colour or an X.
    expect(JSON.stringify(s)).not.toContain(colors.feedback.danger);
    expect(s.mark?.icon).not.toBe('close');
  });

  it('hint: paper fill with a thick focus ring, still tappable, not selected', () => {
    const s = choiceCardStyle('hint');
    expect(s.backgroundColor).toBe(colors.surface.paper);
    expect(s.borderColor).toBe(colors.border.focus);
    expect(s.borderWidth).toBe(borderWidth.thick);
    expect(s.interactive).toBe(true);
    expect(s.selected).toBe(false);
    expect(s.disabled).toBe(false);
    expect(s.mark).toBeNull();
  });

  it('disabled: sunken fill, subtle border, not tappable, accessibility disabled', () => {
    const s = choiceCardStyle('disabled');
    expect(s.backgroundColor).toBe(colors.surface.sunken);
    expect(s.borderColor).toBe(colors.border.subtle);
    expect(s.interactive).toBe(false);
    expect(s.disabled).toBe(true);
    expect(s.selected).toBe(false);
    expect(s.mark).toBeNull();
  });

  it('only idle and hint can be pressed; only disabled is accessibility-disabled', () => {
    const pressable = CHOICE_CARD_STATES.filter((st) => choiceCardStyle(st).interactive);
    expect(pressable).toEqual(['idle', 'hint']);
    const disabled = CHOICE_CARD_STATES.filter((st) => choiceCardStyle(st).disabled);
    expect(disabled).toEqual(['disabled']);
  });

  it('every state reads differently without colour: fill, border width or mark differ from idle', () => {
    const idle = choiceCardStyle('idle');
    for (const state of CHOICE_CARD_STATES.filter((st) => st !== 'idle')) {
      const s = choiceCardStyle(state);
      const cue = s.mark !== null || s.borderWidth !== idle.borderWidth || s.disabled;
      expect(cue, state).toBe(true);
    }
  });

  it('reads an unknown state (persisted junk) as idle', () => {
    expect(choiceCardStyle('bogus' as unknown as ChoiceCardState)).toEqual(choiceCardStyle('idle'));
  });

  it('is pure: the same state gives an equal result and callers cannot corrupt the next call', () => {
    const a = choiceCardStyle('correct');
    expect(choiceCardStyle('correct')).toEqual(a);
    expect(choiceCardStyle('correct')).not.toBe(a);
  });

  it('wrongMark "dash": a locked miss with no retry carries the short dash instead of the try-another mark', () => {
    const s = choiceCardStyle('wrong', { wrongMark: 'dash' });
    expect(s.mark).toEqual({ icon: 'dash', color: colors.text.primary });
    expect(s.backgroundColor).toBe(colors.feedback.nudgeLight);
    expect(s.borderColor).toBe(colors.feedback.nudge);
    expect(JSON.stringify(s)).not.toContain(colors.feedback.danger);
    expect(choiceCardStyle('wrong', { wrongMark: 'replay' })).toEqual(choiceCardStyle('wrong'));
  });

  it('wrongMark changes only the wrong state', () => {
    for (const state of CHOICE_CARD_STATES.filter((st) => st !== 'wrong')) {
      expect(choiceCardStyle(state, { wrongMark: 'dash' }), state).toEqual(choiceCardStyle(state));
    }
  });
});

describe('choiceCardTileWidth (the tile layout: a picture card whose mark sits on the corner)', () => {
  it('is the art plus the horizontal padding and the thickest border, with no room kept for the mark', () => {
    expect(choiceCardTileWidth(touchTarget.hero)).toBe(touchTarget.hero + 2 * spacing.lg + 2 * borderWidth.thick);
    expect(choiceCardTileWidth(96)).toBe(134);
  });

  it('two 96 dp tiles and an 8 dp gap fit the 288 dp column of a 320 wide phone', () => {
    expect(2 * choiceCardTileWidth(touchTarget.hero) + spacing.sm).toBeLessThanOrEqual(320 - 2 * 16);
  });
});
