import { motion, presenter } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { Dimensions } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_HINT_KEY } from '../../../logic/lecture/nav-hint';
import type { InputKind } from '../../../platform/presenter';
import { byTestId, press, render, textOf } from '../../../test-support/render';

/**
 * The start hint (AMENDMENTS-PRESENTER-NAV section 9.3, O7, row PN-3) on the whole presenter with fake
 * timers: on touch, at the top of a lesson's first slide (the quest's title) for 2 x presenter.autoHideMs,
 * `nav.hint` on a docked window and `nav.hintOverlay` on a phone (the overlay layout until PN-4); it takes
 * no taps and is drawn only; it goes with its slide and fades on the first bar button or swipe step, which
 * writes `done` so it never shows again; a touch tap on empty stage is no such step; it shows on at most three
 * lessons (`lecture:navHint` counts them) and never on a mouse-only window. The record goes through the
 * storage wrapper (`platform/storage`, mocked here in memory).
 */

const page = vi.hoisted(() => ({ input: null as ((kind: InputKind) => void) | null, touchAtStart: false }));
const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../platform/presenter', async (importOriginal) => {
  const { encodeDeck } = await import('@hangul-route/content-schema');
  const deck = { v: 1, id: 'lecture:navhint1', title: 'Hint', createdAt: '2026-10-29T09:00:00Z', seed: 1, blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }] };
  return {
    ...(await importOriginal<typeof import('../../../platform/presenter')>()),
    takeDeckFragment: () => ({ raw: encodeDeck(deck as never), reloaded: false }),
    subscribeInputKind: (handler: (kind: InputKind) => void) => {
      page.input = handler;
      return () => {
        page.input = null;
      };
    },
    touchSeenAtStart: () => page.touchAtStart,
  };
});
vi.mock('../../../platform/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/storage')>()),
  readJson: async (key: string) => store.get(key) ?? null,
  readJsonExact: async (key: string) => store.get(key) ?? null,
  writeJson: async (key: string, value: unknown) => {
    store.set(key, value);
  },
}));
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));
vi.mock('react-native-gesture-handler', async () => {
  const { View: Plain } = await import('react-native');
  return { GestureHandlerRootView: Plain };
});
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));

import PresenterApp from '../../../../PresenterApp';

const tablet = { width: 1180, height: 820, scale: 1, fontScale: 1 };
const phone = { width: 844, height: 390, scale: 1, fontScale: 1 };
const before = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
beforeAll(() => {
  Dimensions.set({ window: tablet, screen: tablet });
});
afterAll(() => {
  Dimensions.set(before);
});
beforeEach(() => {
  store.clear();
});
afterEach(() => {
  vi.useRealTimers();
  Dimensions.set({ window: tablet, screen: tablet });
});

const en = getMessages('en').learner.presenter;
const one = (r: ReactTestRenderer, id: string): ReactTestInstance => byTestId(r.root, id)[0]!;
const hint = (r: ReactTestRenderer): ReactTestInstance | undefined => byTestId(r.root, 'presenter-nav-hint')[0];
const counter = (r: ReactTestRenderer): string => textOf(one(r, 'presenter-counter'));

async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function lesson(touchAtStart: boolean): Promise<ReactTestRenderer> {
  page.touchAtStart = touchAtStart;
  vi.useFakeTimers();
  const r = await render(<PresenterApp />);
  await tick(10);
  await press(one(r, 'presenter-start-button'));
  await tick(10);
  expect(byTestId(r.root, 'presenter-stage')).toHaveLength(1);
  return r;
}

/** A one-finger tap (or, with `dx`, a swipe) on empty stage area, through the stage's responder handlers. */
function gesture(r: ReactTestRenderer, dx = 0): void {
  const stage = r.root.find((n) => n.props.testID === 'presenter-stage' && typeof n.props.onResponderGrant === 'function');
  const down = { identifier: 0, pageX: 400, pageY: 200 };
  const up = { ...down, pageX: down.pageX + dx };
  const event = (kind: string, at: typeof down, touches: unknown[]) => ({ target: null, nativeEvent: { type: kind, target: null, ...at, changedTouches: [at], touches } });
  act(() => {
    (stage.props.onResponderGrant as (e: unknown) => void)(event('touchstart', down, [down]));
    (stage.props.onResponderRelease as (e: unknown) => void)(event('touchend', up, []));
  });
}

describe('the start hint on touch (section 9.3)', () => {
  it('shows nav.hint at the top of the first slide on a docked window, takes no taps, is drawn only, and counts the lesson', async () => {
    const r = await lesson(true);
    const pill = hint(r)!;
    expect(pill).toBeDefined();
    expect(textOf(pill)).toBe(en.nav.hint);
    expect(pill.props['data-line']).toBe('hint');
    expect(pill.props['aria-hidden']).toBe(true);
    expect(String(pill.props.className ?? '')).toMatch(/r-pointerEvents-/);
    expect(counter(r)).toMatch(/^1 \//);
    expect(store.get(NAV_HINT_KEY)).toBe('1');
  });

  it('fades after 2 x presenter.autoHideMs and is gone; nothing steps', async () => {
    const r = await lesson(true);
    const was = counter(r);
    await tick(2 * presenter.autoHideMs - 100);
    expect(hint(r)).toBeDefined();
    await tick(100 + motion.duration.base + 100);
    expect(hint(r)).toBeUndefined();
    expect(counter(r)).toBe(was);
    expect(store.get(NAV_HINT_KEY)).toBe('1');
  });

  it('a bar Next step takes it away with its slide and writes done; the next lesson shows none', async () => {
    const r = await lesson(true);
    await press(one(r, 'presenter-next'));
    await tick(10);
    expect(counter(r)).toMatch(/^2 \//);
    expect(hint(r)).toBeUndefined();
    expect(store.get(NAV_HINT_KEY)).toBe('done');
    const again = await lesson(true);
    expect(hint(again)).toBeUndefined();
  });

  it('a swipe step ends it too; a touch tap on empty stage (the Next ring) does not', async () => {
    const r = await lesson(true);
    gesture(r);
    await tick(10);
    expect(hint(r)).toBeDefined();
    expect(store.get(NAV_HINT_KEY)).toBe('1');
    gesture(r, -100);
    await tick(10);
    expect(counter(r)).toMatch(/^2 \//);
    expect(hint(r)).toBeUndefined();
    expect(store.get(NAV_HINT_KEY)).toBe('done');
  });

  it('shows on at most three lessons', async () => {
    store.set(NAV_HINT_KEY, '2');
    const third = await lesson(true);
    expect(hint(third)).toBeDefined();
    expect(store.get(NAV_HINT_KEY)).toBe('3');
    const fourth = await lesson(true);
    expect(hint(fourth)).toBeUndefined();
    expect(store.get(NAV_HINT_KEY)).toBe('3');
  });

  it('says nav.hintOverlay on a phone (the overlay layout)', async () => {
    Dimensions.set({ window: phone, screen: phone });
    const r = await lesson(true);
    expect(byTestId(r.root, 'presenter-bar-band')).toHaveLength(0);
    expect(textOf(hint(r)!)).toBe(en.nav.hintOverlay);
    expect(hint(r)!.props['data-line']).toBe('hintOverlay');
  });
});

describe('never on a mouse-only window', () => {
  it('shows nothing and writes nothing, even after a bar step', async () => {
    const r = await lesson(false);
    act(() => page.input?.('mouse'));
    await tick(10);
    expect(hint(r)).toBeUndefined();
    expect(store.has(NAV_HINT_KEY)).toBe(false);
    // A touch seen after the first slide shows no hint for this lesson.
    act(() => page.input?.('touch'));
    await tick(10);
    expect(hint(r)).toBeUndefined();
  });
});
