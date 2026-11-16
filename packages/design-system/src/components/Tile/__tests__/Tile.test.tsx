import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { borderWidth, colors, shadows, spacing } from '../../../tokens';
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
    expect(style).toMatchObject({ borderColor: colors.border.subtle, borderWidth: borderWidth.base, ...shadows.card });
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
describe('Tile wrong state (AU-17a)', () => {
  const kids = (el: El): El[] => (Children.toArray(el.props.children as ReactNode) as El[]).filter((k) => isValidElement(k));
  const all = (el: El): El[] => [el, ...kids(el).flatMap((k) => all(k))];
  const icons = (el: El): El[] => all(el).filter((e) => e.type === 'Icon');
  const texts = (el: El): El[] => all(el).filter((e) => e.type === 'Text');

  it('the pure look: the wrong label is text.primary on the amber tint, with the try-another mark; no other state has a mark', () => {
    expect(tileStyle('wrong')).toEqual({
      backgroundColor: colors.feedback.nudgeLight,
      borderColor: colors.feedback.nudge,
      labelColor: colors.text.primary,
      romanizationColor: colors.text.muted,
      mark: { icon: 'replay', color: colors.text.primary },
    });
    for (const state of TILE_STATES.filter((s) => s !== 'wrong')) expect(tileStyle(state).mark, state).toBeNull();
  });

  it('never red: no state uses a danger colour', () => {
    for (const state of TILE_STATES) {
      const values = JSON.stringify(tileStyle(state));
      expect(values).not.toContain(colors.feedback.danger);
      expect(values).not.toContain(colors.feedback.dangerLight);
    }
  });

  it('a wrong tile paints its glyph in text.primary and keeps the muted romanization line', () => {
    const [glyph, romanization] = texts(box({ state: 'wrong', romanization: 'g' }, false));
    expect((glyph!.props.style as Props).color).toBe(colors.text.primary);
    expect((romanization!.props.style as Props).color).toBe(colors.text.muted);
  });

  it('a wrong tile draws the same mark ChoiceCard draws on a miss, hidden from assistive tech', () => {
    const drawn = box({ state: 'wrong', disabled: true }, false);
    const [mark, ...rest] = icons(drawn);
    expect(rest).toEqual([]);
    expect(mark!.props).toMatchObject({ name: 'replay', color: colors.text.primary, size: TILE_MARK.size });
    const corner = kids(drawn).at(-1)!;
    expect(icons(corner)).toEqual([mark]);
    expect(corner.props['aria-hidden']).toBe(true);
    expect(corner.props.pointerEvents).toBe('none');
  });

  it('the mark is out of the flow on the top corner, so the tile keeps its size', () => {
    const wrong = box({ state: 'wrong', size: 'lg' }, false);
    const idle = box({ state: 'idle', size: 'lg' }, false);
    expect(kids(wrong).at(-1)!.props.style).toEqual({ position: 'absolute', top: TILE_MARK.inset, right: TILE_MARK.inset });
    const { backgroundColor: _b, borderColor: _c, ...wrongBox } = wrong.props.style as Props;
    const { backgroundColor: _d, borderColor: _e, ...idleBox } = idle.props.style as Props;
    expect(wrongBox).toEqual(idleBox);
  });

  it('the mark ends inside the padding around the glyph and the romanization line, so it covers neither', () => {
    // Tile padding (spacing.md) plus the text block's own side padding (spacing.sm) keep both lines this far from the edge.
    expect(TILE_MARK.inset + TILE_MARK.size).toBeLessThanOrEqual(spacing.md + spacing.sm);
    const drawn = box({ state: 'wrong', romanization: 'g' }, false);
    expect((drawn.props.style as Props).padding).toBe(spacing.md);
    expect((kids(drawn)[0]!.props.style as Props).paddingHorizontal).toBe(spacing.sm);
  });

  it('a wrong tile with no handler (a plain View) carries the mark too', () => {
    const el = tile({ state: 'wrong', onPress: undefined });
    expect(el.type).toBe('View');
    expect(icons(el).map((i) => i.props.name)).toEqual(['replay']);
  });

  it('idle, correct and disabled tiles draw no mark', () => {
    expect(icons(box({ state: 'idle' }, false))).toEqual([]);
    expect(icons(box({ state: 'correct' }, false))).toEqual([]);
    expect(icons(tile({ state: 'disabled' }))).toEqual([]);
  });
});
