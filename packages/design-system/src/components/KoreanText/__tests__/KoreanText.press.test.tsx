import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { KoreanText } from '../KoreanText';

/**
 * The KoreanText speaker's press handling (AMENDMENTS-TOUCH 6.9, row KT-9), checked on the element tree built by calling
 * the component directly with the hosts replaced by plain tags. The speaker replays a sound and moves nothing: it is a
 * `GuardedPressable` that drops its own bounce and waits for the app-level tap lock, but never sets that lock
 * (`setsLock={false}`; the guard itself is tested in TapBoard/__tests__/GuardedPressable.test.tsx).
 */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
vi.mock('../../TapBoard/GuardedPressable', () => ({ GuardedPressable: 'GuardedPressable' }));
vi.mock('../../Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../TextSize', async () => {
  const { typeScale } = await import('../../../text-size');
  return { useTypeScale: () => typeScale(1) };
});

type El = ReactElement<Record<string, unknown>>;

const speaker = (onPress?: () => void): El => KoreanText({ ko: '나무', romanization: 'namu', onPress }) as El;

describe('KoreanText speaker press guard (AMENDMENTS-TOUCH 6.9, row KT-9)', () => {
  it('a pressable KoreanText is a guarded speaker that never sets the lock, with a 64 floor', () => {
    const onPress = vi.fn();
    const el = speaker(onPress);
    expect(el.type).toBe('GuardedPressable');
    expect(el.props.setsLock).toBe(false);
    expect(el.props.onPress).toBe(onPress);
    const style = (el.props.style as (s: { pressed: boolean }) => Record<string, unknown>)({ pressed: false });
    expect(style.minWidth).toBe(64);
    expect(style.minHeight).toBe(64);
  });

  it('a KoreanText with no handler is not a button', () => {
    expect(speaker().type).toBe('View');
  });
});

/** Every element of a tree, depth first. */
function all(el: El): El[] {
  const kids = Children.toArray(el.props.children as ReactNode).filter((k): k is El => isValidElement(k));
  return [el, ...kids.flatMap((k) => all(k))];
}

const romanizationLine = (el: El): El | undefined => all(el).find((e) => e.type === 'Text' && e.props.children === 'namu');

describe('KoreanText reserved romanization line (AMENDMENTS-AUDIT-2026-11 AU-8)', () => {
  it('shown: the line is drawn and announced', () => {
    const line = romanizationLine(KoreanText({ ko: '나무', romanization: 'namu' }) as El);
    expect((line?.props.style as Record<string, unknown>).opacity).toBe(1);
    expect(line?.props['aria-hidden']).toBeUndefined();
  });

  it('hidden: no line at all', () => {
    expect(romanizationLine(KoreanText({ ko: '나무', romanization: 'namu', romanizationShown: false }) as El)).toBeUndefined();
  });

  it('reserved: the same line keeps its room, invisible and off the accessibility tree', () => {
    const line = romanizationLine(KoreanText({ ko: '나무', romanization: 'namu', romanizationShown: false, romanizationReserved: true }) as El);
    expect(line).toBeDefined();
    expect((line?.props.style as Record<string, unknown>).opacity).toBe(0);
    expect(line?.props).toMatchObject({ 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no', selectable: false });
  });
});
