import * as ReactModule from 'react';
import type { ReactElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TAP_LOCK_MS } from '@hangul-route/design-system/tap-model';
import { GuardedTabButton } from '../tab-button';

/**
 * The learner tab button (AMENDMENTS-TOUCH 6.9, row KT-9), checked on the element tree built by calling it directly with
 * the hosts replaced by plain tags: a bounce switches once, the app-level tap lock is read and set, and on the web a
 * plain click always prevents the link's own navigation, so a dropped bounce never reloads the page.
 */
const platform = vi.hoisted(() => ({ OS: 'web' }));
vi.mock('react-native', () => ({ Pressable: 'Pressable', View: 'View', Text: 'Text', Platform: platform }));
vi.mock('@react-navigation/native', () => ({ Link: 'Link' }));
const app = vi.hoisted(() => ({ clock: null as null | { until: () => number; lock: (ms: number) => void } }));
vi.mock('@hangul-route/design-system', async () => {
  const { usePressGuard } = await import('../../../../../packages/design-system/src/components/TapBoard/use-press-guard');
  return { usePressGuard, NO_PRESS_DELAY: { delayPressIn: 0, unstable_pressDelay: 0 } };
});
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useRef = <T,>(v: T): { current: T } => ({ current: v });
  const useCallback = <T,>(fn: T): T => fn;
  const useContext = (): unknown => app.clock;
  const hooks = { useRef, useCallback, useContext };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});

type El = ReactElement<Record<string, unknown>>;
type Click = { button?: number; metaKey?: boolean; preventDefault: () => void };

function tab(onPress: (e: unknown) => void, to?: string): El {
  return GuardedTabButton({ children: null, onPress, to, accessibilityRole: 'tab' } as never) as El;
}

describe('GuardedTabButton (AMENDMENTS-TOUCH 6.9, row KT-9)', () => {
  // This (node) project compiles JSX with the classic runtime, which reads a global React.
  beforeAll(() => {
    (globalThis as { React?: unknown }).React = ReactModule;
  });

  afterEach(() => {
    app.clock = null;
    platform.OS = 'web';
    vi.useRealTimers();
  });

  it('web: the tab is the navigator link; a bounce switches once but both clicks keep the browser from navigating', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const onPress = vi.fn();
    const el = tab(onPress, '/library');
    expect(el.type).toBe('Link');
    expect(el.props.to).toBe('/library');
    const click = el.props.onPress as (e: Click) => void;
    const first = { button: 0, preventDefault: vi.fn() };
    const bounce = { button: 0, preventDefault: vi.fn() };
    click(first);
    vi.setSystemTime(1_150);
    click(bounce);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(first.preventDefault).toHaveBeenCalled();
    expect(bounce.preventDefault).toHaveBeenCalled();
  });

  it('web: a modified click is left to the browser (a new tab) and switches nothing', () => {
    const onPress = vi.fn();
    const click = tab(onPress, '/home').props.onPress as (e: Click) => void;
    const modified = { button: 0, metaKey: true, preventDefault: vi.fn() };
    click(modified);
    expect(onPress).not.toHaveBeenCalled();
    expect(modified.preventDefault).not.toHaveBeenCalled();
  });

  it('native: a Pressable with no press delay; a tap during the app lock is dropped and a switch sets the lock', () => {
    platform.OS = 'ios';
    vi.useFakeTimers();
    vi.setSystemTime(2_000);
    let until = 2_200;
    const lock = vi.fn((ms: number) => {
      until = Date.now() + ms;
    });
    app.clock = { until: () => until, lock };
    const onPress = vi.fn();
    const el = tab(onPress);
    expect(el.type).toBe('Pressable');
    expect(el.props.delayPressIn).toBe(0);
    expect(el.props.accessibilityRole).toBe('tab');
    const press = el.props.onPress as () => void;
    press();
    expect(onPress).not.toHaveBeenCalled();
    vi.setSystemTime(2_200);
    press();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledWith(TAP_LOCK_MS);
  });
});
