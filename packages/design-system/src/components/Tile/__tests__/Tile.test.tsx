import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { borderWidth, colors, shadows } from '../../../tokens';
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
