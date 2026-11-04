import type { ReactElement } from 'react';
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
