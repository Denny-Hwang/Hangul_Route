import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAP_LOCK_MS } from '../../../tap-model';
import { KoreanText } from '../KoreanText';

/**
 * The KoreanText speaker's press handling (AMENDMENTS-TOUCH 6.9, row KT-9), checked on the element tree built by calling
 * the component directly with react-native's hosts replaced by plain tags. The speaker replays a sound and moves
 * nothing: it drops its own bounce and waits for the app-level tap lock, but never sets that lock.
 */
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
vi.mock('../../Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../TextSize', async () => {
  const { typeScale } = await import('../../../text-size');
  return { useTypeScale: () => typeScale(1) };
});
const app = vi.hoisted(() => ({ clock: null as null | { until: () => number; lock: (ms: number) => void } }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useRef = <T,>(v: T): { current: T } => ({ current: v });
  const useCallback = <T,>(fn: T): T => fn;
  const useContext = (): unknown => app.clock;
  const hooks = { useRef, useCallback, useContext };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});

type El = ReactElement<Record<string, unknown>>;

const speaker = (onPress?: () => void): El => KoreanText({ ko: '나무', romanization: 'namu', onPress }) as El;

describe('KoreanText speaker press guard (AMENDMENTS-TOUCH 6.9, row KT-9)', () => {
  afterEach(() => {
    app.clock = null;
    vi.useRealTimers();
  });

  it('a pressable KoreanText has no press delay and a 64 floor; a plain one is not a button', () => {
    const el = speaker(() => undefined);
    expect(el.type).toBe('Pressable');
    expect(el.props.delayPressIn).toBe(0);
    expect(el.props.unstable_pressDelay).toBe(0);
    const style = (el.props.style as (s: { pressed: boolean }) => Record<string, unknown>)({ pressed: false });
    expect(style.minWidth).toBe(64);
    expect(style.minHeight).toBe(64);
    expect(speaker().type).toBe('View');
  });

  it('a bounce within TAP_LOCK_MS plays once; a tap after it plays again', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const onPress = vi.fn();
    const press = speaker(onPress).props.onPress as () => void;
    press();
    vi.setSystemTime(1_100);
    press();
    expect(onPress).toHaveBeenCalledTimes(1);
    vi.setSystemTime(1_000 + TAP_LOCK_MS);
    press();
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('waits for the app lock but never sets it, so the answers beside it stay live', () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000);
    const lock = vi.fn();
    app.clock = { until: () => 2_250, lock };
    const onPress = vi.fn();
    const press = speaker(onPress).props.onPress as () => void;
    press();
    expect(onPress).not.toHaveBeenCalled();
    vi.setSystemTime(2_250);
    press();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(lock).not.toHaveBeenCalled();
  });
});
