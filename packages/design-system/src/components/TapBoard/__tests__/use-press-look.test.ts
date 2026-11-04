import { beforeEach, describe, expect, it, vi } from 'vitest';
import { borderWidth, colors } from '../../../tokens';

/**
 * `usePressLook` (docs/specs/AMENDMENTS-TOUCH.md section 4.3): the press look follows the platform's reduced-motion
 * setting through one app-wide `AccessibilityInfo` subscription. React's `useSyncExternalStore` is a stand-in that
 * subscribes on the first call and reads the snapshot, so the hook runs without a renderer.
 */
const a11y = vi.hoisted(() => ({
  answer: Promise.resolve(false) as Promise<boolean>,
  asked: 0,
  listeners: [] as Array<(value: boolean) => void>,
}));
const store = vi.hoisted(() => ({ notified: 0, subscribed: 0 }));

vi.mock('react-native', () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: () => {
      a11y.asked += 1;
      return a11y.answer;
    },
    addEventListener: (_name: string, fn: (value: boolean) => void) => {
      a11y.listeners.push(fn);
      return { remove: () => undefined };
    },
  },
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useSyncExternalStore = <T,>(subscribe: (l: () => void) => () => void, read: () => T): T => {
    store.subscribed += 1;
    subscribe(() => {
      store.notified += 1;
    });
    return read();
  };
  return { ...actual, useSyncExternalStore, default: { ...actual, useSyncExternalStore } };
});

async function load(): Promise<typeof import('../use-press-look')> {
  vi.resetModules();
  return import('../use-press-look');
}

const outline = { borderColor: colors.border.shape, borderWidth: borderWidth.thick };

beforeEach(() => {
  a11y.asked = 0;
  a11y.listeners = [];
  store.notified = 0;
  store.subscribed = 0;
});

describe('usePressLook', () => {
  it('starts with the shrink, then drops it once the platform says reduced motion is on', async () => {
    a11y.answer = Promise.resolve(true);
    const { usePressLook } = await load();
    expect(usePressLook()).toEqual({ ...outline, scale: 0.97 });
    await a11y.answer;
    await Promise.resolve();
    expect(store.notified).toBe(1);
    expect(usePressLook()).toEqual({ ...outline, scale: 1 });
  });

  it('asks the platform once for every card, and follows a later change', async () => {
    a11y.answer = Promise.resolve(false);
    const { usePressLook } = await load();
    usePressLook();
    usePressLook();
    usePressLook();
    expect(a11y.asked).toBe(1);
    expect(a11y.listeners).toHaveLength(1);
    await a11y.answer;
    expect(store.notified).toBe(0);
    a11y.listeners[0]!(true);
    expect(usePressLook().scale).toBe(1);
    a11y.listeners[0]!(true);
    a11y.listeners[0]!(false);
    expect(usePressLook().scale).toBe(0.97);
  });

  it('a platform that cannot answer leaves the shrink on', async () => {
    const failed = Promise.reject(new Error('no a11y'));
    failed.catch(() => undefined);
    a11y.answer = failed;
    const { usePressLook } = await load();
    expect(usePressLook().scale).toBe(0.97);
    await failed.catch(() => undefined);
    await Promise.resolve();
    expect(usePressLook().scale).toBe(0.97);
  });
});
