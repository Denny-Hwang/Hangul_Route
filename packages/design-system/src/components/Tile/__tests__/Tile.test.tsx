import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MARK_DISC, MARK_MIN } from '../../../answer-mark';
import { borderWidth, colors, radii, shadows, spacing } from '../../../tokens';
import { TILE_MARK, TILE_STATES, tileStyle } from '../style';
import { Tile } from '../Tile';
import type { TileProps } from '../types';

/**
 * Tile takes a touch through `TapTarget` and paints the press look (docs/specs/AMENDMENTS-TOUCH.md sections 4.3 and
 * 4.4, row KT-2), checked on the element tree built by calling the component directly with react-native's hosts as
 * plain tags (as ChoiceCard.test.tsx does). Inside a `TapBoard` the board decides the tap; outside one it is a plain
 * button with the press guard. The press look replaces the old 1.04 grow: a thick `border.shape` outline and a 0.97
 * shrink on the drawn box (none under reduced motion), so the hit area the board measures never changes.
 */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
vi.mock('../../Icon', () => ({ Icon: 'Icon' }));
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('../../TapBoard', async () => {
  const { pressLook } = await import('../../../press-look');
  return { TapTarget: 'TapTarget', usePressLook: () => pressLook(motion.reduced) };
});
vi.mock('../../TextSize', async () => {
  const { typeScale } = await import('../../../text-size');
  return { useTypeScale: () => typeScale(1) };
});

type Props = Record<string, unknown>;
type El = ReactElement<Props>;

const tile = (props: Partial<TileProps>): El => Tile({ label: 'ㄱ', onPress: () => undefined, ...props }) as El;
/** The drawn box inside the TapTarget (its children are a render function of `{ pressed }`). */
const box = (props: Partial<TileProps>, pressed: boolean): El => (tile(props).props.children as (s: { pressed: boolean }) => El)({ pressed });

describe('Tile (AMENDMENTS-TOUCH 4.4, row KT-2)', () => {
  it('a pressable tile is one TapTarget with its label and testID, committing onPress, with no web-dead hitSlop', () => {
    const presses: string[] = [];
    const el = tile({ testID: 'tile-0', accessibilityLabel: 'giyeok', onPress: () => presses.push('ㄱ') });
    expect(el.type).toBe('TapTarget');
    expect(el.props.accessibilityLabel).toBe('giyeok');
    expect(el.props.testID).toBe('tile-0');
    expect('hitSlop' in el.props).toBe(false);
    (el.props.onCommit as () => void)();
    expect(presses).toEqual(['ㄱ']);
  });

  it('keeps its default accessible name', () => {
    expect(tile({}).props.accessibilityLabel).toBe('Korean letter ㄱ, tap to select');
  });

  it('a tile with no handler, or disabled, stays a plain View (no button)', () => {
    expect(tile({ onPress: undefined }).type).toBe('View');
    expect(tile({ state: 'disabled' }).type).toBe('View');
  });

  it('disabled (a locked wrong tile, AMENDMENTS-TOUCH R3, row KT-3): still one TapTarget the board claims, but disabled, with the same wrong look and no press look', () => {
    const presses: string[] = [];
    const el = tile({ state: 'wrong', disabled: true, onPress: () => presses.push('ㄱ') });
    expect(el.type).toBe('TapTarget');
    expect(el.props.disabled).toBe(true);
    const style = box({ state: 'wrong', disabled: true }, true).props.style as Props;
    expect(style.borderColor).toBe(colors.feedback.nudge);
    expect(style.backgroundColor).toBe(colors.feedback.nudgeLight);
    expect(style.borderWidth).toBe(borderWidth.base);
    expect(style.transform).toBeUndefined();
    expect(tile({ state: 'wrong' }).props.disabled).toBe(false);
  });

  it('at rest: the state border and no transform, with the card shadow', () => {
    const style = box({ state: 'idle' }, false).props.style as Props;
    expect(style).toMatchObject({ borderColor: colors.border.shape, borderWidth: borderWidth.base, ...shadows.card });
    expect(style.transform).toBeUndefined();
    expect((box({ state: 'wrong' }, false).props.style as Props).borderColor).toBe(colors.feedback.nudge);
  });

  it('pressed: a thick border.shape outline and a 0.97 shrink, never the old 1.04 grow', () => {
    motion.reduced = false;
    const style = box({ state: 'idle' }, true).props.style as Props;
    expect(style.borderColor).toBe(colors.border.shape);
    expect(style.borderWidth).toBe(borderWidth.thick);
    expect(style.transform).toEqual([{ scale: 0.97 }]);
  });

  it('pressed: the thicker outline comes off the padding, so the tile keeps its size', () => {
    const rest = box({ state: 'idle' }, false).props.style as Props;
    const down = box({ state: 'idle' }, true).props.style as Props;
    expect((down.padding as number) + (down.borderWidth as number)).toBe((rest.padding as number) + (rest.borderWidth as number));
  });

  it('pressed under reduced motion: the outline alone', () => {
    motion.reduced = true;
    const style = box({ state: 'idle' }, true).props.style as Props;
    expect(style.borderColor).toBe(colors.border.shape);
    expect(style.transform).toBeUndefined();
    motion.reduced = false;
  });

  it('the hit area is the TapTarget with no style of its own: the shrink is on the drawn box inside it', () => {
    expect(tile({}).props.style).toBeUndefined();
    expect(box({ size: 'lg' }, true).props.style).toMatchObject({ minWidth: 96, minHeight: 96 });
  });
});

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-17a (audit A11Y-1): a miss reads without colour. The wrong label is `text.primary`
 * (the old literal amber was 2.85:1 on the nudge tint) and the tile carries ChoiceCard's "try another" mark on its top
 * corner, out of the flow, clear of the glyph and the romanization line.
 */
describe('Tile result marks (AU-17a; F-A11Y-001 AF-1)', () => {
  const kids = (el: El): El[] => (Children.toArray(el.props.children as ReactNode) as El[]).filter((k) => isValidElement(k));
  const all = (el: El): El[] => [el, ...kids(el).flatMap((k) => all(k))];
  const icons = (el: El): El[] => all(el).filter((e) => e.type === 'Icon');
  const texts = (el: El): El[] => all(el).filter((e) => e.type === 'Text');

  it('the pure look: a miss is text.primary on the amber tint with the try-another mark on its light disc', () => {
    expect(tileStyle('wrong')).toEqual({
      backgroundColor: colors.feedback.nudgeLight,
      borderColor: colors.feedback.nudge,
      labelColor: colors.text.primary,
      romanizationColor: colors.text.muted,
      mark: { icon: 'replay', color: colors.text.primary, disc: colors.feedback.nudgeLight },
    });
  });

  it('the pure look: a right answer has the check in the success colour on its light disc (F-A11Y-001 §3.1)', () => {
    expect(tileStyle('correct').mark).toEqual({ icon: 'check', color: colors.feedback.success, disc: colors.feedback.successLight });
    expect(tileStyle('idle').mark).toBeNull();
    expect(tileStyle('disabled').mark).toBeNull();
  });

  it('never red and never an X: no state uses a danger colour or the close icon', () => {
    for (const state of TILE_STATES) {
      const values = JSON.stringify(tileStyle(state));
      expect(values).not.toContain(colors.feedback.danger);
      expect(values).not.toContain(colors.feedback.dangerLight);
      expect(tileStyle(state).mark?.icon).not.toBe('close');
    }
  });

  it('a wrong tile paints its glyph in text.primary and keeps the muted romanization line', () => {
    const [glyph, romanization] = texts(box({ state: 'wrong', romanization: 'g' }, false));
    expect((glyph!.props.style as Props).color).toBe(colors.text.primary);
    expect((romanization!.props.style as Props).color).toBe(colors.text.muted);
  });

  it.each([
    ['wrong', 'replay', colors.text.primary, colors.feedback.nudgeLight],
    ['correct', 'check', colors.feedback.success, colors.feedback.successLight],
  ] as const)('a %s tile draws its mark at MARK_MIN on a cased disc, hidden from assistive tech', (state, icon, color, disc) => {
    const drawn = box({ state, locked: true }, false);
    const [mark, ...rest] = icons(drawn);
    expect(rest).toEqual([]);
    expect(mark!.props).toMatchObject({ name: icon, color, size: MARK_MIN });
    const corner = kids(drawn).at(-1)!;
    expect(icons(corner)).toEqual([mark]);
    expect(corner.props['aria-hidden']).toBe(true);
    expect(corner.props.accessibilityElementsHidden).toBe(true);
    expect(corner.props.pointerEvents).toBe('none');
    expect(corner.props.style).toMatchObject({
      padding: spacing.xxs,
      borderRadius: radii.circle,
      borderWidth: borderWidth.thin,
      borderColor: colors.text.primary,
      backgroundColor: disc,
    });
  });

  it('the disc is 26 (MARK_MIN + 2 x spacing.xxs + 2 x borderWidth.thin) and MARK_MIN is 20 (AnswerFeedback D1)', () => {
    expect(MARK_MIN).toBe(20);
    expect(MARK_MIN).toBe(spacing.lg + spacing.xs);
    expect(MARK_DISC.size).toBe(26);
    expect(TILE_MARK.disc).toBe(TILE_MARK.size + 2 * TILE_MARK.padding + 2 * TILE_MARK.casing);
    expect(TILE_MARK.size).toBe(MARK_MIN);
  });

  it('the disc straddles the top-end corner, 4 outside the border, out of the flow, so the tile keeps its size (D2)', () => {
    const wrong = box({ state: 'wrong', size: 'lg' }, false);
    const idle = box({ state: 'idle', size: 'lg' }, false);
    const style = kids(wrong).at(-1)!.props.style as Props;
    expect(style).toMatchObject({ position: 'absolute', top: TILE_MARK.offset, right: TILE_MARK.offset });
    // The offset is from the tile's inner edge: the border, then spacing.xs beyond it.
    expect(-TILE_MARK.offset - borderWidth.base).toBe(spacing.xs);
    const { backgroundColor: _b, borderColor: _c, ...wrongBox } = wrong.props.style as Props;
    const { backgroundColor: _d, borderColor: _e, ...idleBox } = idle.props.style as Props;
    expect(wrongBox).toEqual(idleBox);
  });

  it('inside the border the disc reaches no further than the glyph column starts (tile padding + its side padding)', () => {
    const inside = TILE_MARK.disc - MARK_DISC.outside - borderWidth.base;
    expect(inside).toBeLessThanOrEqual(spacing.md + spacing.sm);
    const drawn = box({ state: 'wrong', romanization: 'g' }, false);
    expect((drawn.props.style as Props).padding).toBe(spacing.md);
    expect((kids(drawn)[0]!.props.style as Props).paddingHorizontal).toBe(spacing.sm);
  });

  it('a marked tile with no handler (a plain View) carries the mark too', () => {
    expect(icons(tile({ state: 'wrong', onPress: undefined })).map((i) => i.props.name)).toEqual(['replay']);
    expect(icons(tile({ state: 'correct', onPress: undefined })).map((i) => i.props.name)).toEqual(['check']);
  });

  it('idle and disabled tiles draw no mark', () => {
    expect(icons(box({ state: 'idle' }, false))).toEqual([]);
    expect(icons(tile({ state: 'disabled' }))).toEqual([]);
  });
});

/**
 * F-A11Y-001 §3.1 "Locked is not disabled" (row AF-1): an answered tile takes no tap but is never announced as dimmed or
 * disabled. It reaches TapTarget as `inactive`, as ChoiceCard passes a locked card.
 */
describe('Tile locked (F-A11Y-001 AF-1)', () => {
  it('reaches TapTarget as inactive, not disabled, so it stays a focusable button', () => {
    const el = tile({ state: 'wrong', locked: true });
    expect(el.type).toBe('TapTarget');
    expect(el.props.inactive).toBe(true);
    expect(el.props.disabled).toBe(false);
    expect((el.props.accessibilityState as Props | undefined)?.disabled).not.toBe(true);
  });

  it('a locked tile never shows the press look', () => {
    const pressed = box({ state: 'correct', locked: true, size: 'lg' }, true);
    const rest = box({ state: 'correct', locked: true, size: 'lg' }, false);
    expect(pressed.props.style).toEqual(rest.props.style);
  });

  it('an unlocked tile is not inactive; disabled stays for a tile out of play', () => {
    expect(tile({}).props.inactive).toBe(false);
    expect(tile({ disabled: true }).props).toMatchObject({ disabled: true, inactive: false });
  });
});
