import { Dimensions } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyCommand } from '../../../logic/lecture/keymap';
import { byTestId, press, render, textOf } from '../../../test-support/render';

/**
 * The navigation counts of `lecture.complete` on the whole presenter (AMENDMENTS-PRESENTER-NAV
 * section 12, owner choice O8, row PN-6): each step counts under the source `userDispatch` and the
 * key handler pass (a bar button, a swipe, a key, a mouse click on the stage), a Previous within 2 s
 * of a forward step is a quick back, and `navLayout` is the layout of the first slide shown once
 * Start's fullscreen request settled, not the window of the Start tap. The payload carries those
 * seven keys beside the three it had, and nothing else. Fake timers; the fullscreen request, the
 * keys, the window's resize and `track` are driven by the test.
 */

const page = vi.hoisted(() => ({
  keys: null as ((command: KeyCommand) => boolean | void) | null,
  settle: null as (() => void) | null,
  sent: [] as Array<{ name: string; payload?: Record<string, unknown> }>,
}));
vi.mock('../../../platform/presenter', async (importOriginal) => {
  const { encodeDeck } = await import('@hangul-route/content-schema');
  const deck = { v: 1, id: 'lecture:navcount1', title: 'Counts lesson', createdAt: '2026-10-29T09:00:00Z', seed: 1, blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }] };
  return {
    ...(await importOriginal<typeof import('../../../platform/presenter')>()),
    takeDeckFragment: () => ({ raw: encodeDeck(deck as never), reloaded: false }),
    subscribeKeys: (handler: (command: KeyCommand) => boolean | void) => {
      page.keys = handler;
      return () => {
        if (page.keys === handler) page.keys = null;
      };
    },
    // The Start tap's fullscreen request settles only when the test says so.
    enterFullscreenLandscape: () =>
      new Promise<boolean>((resolve) => {
        page.settle = () => resolve(true);
      }),
    touchSeenAtStart: () => false,
  };
});
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/telemetry')>()),
  track: async (event: { name: string; payload?: Record<string, unknown> }) => {
    page.sent.push(event);
    return true;
  },
  flushQueue: async () => 0,
}));
// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));
vi.mock('react-native-gesture-handler', async () => {
  const { View: Plain } = await import('react-native');
  return { GestureHandlerRootView: Plain };
});
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));

import PresenterApp from '../../../../PresenterApp';

type Size = { width: number; height: number; scale: number; fontScale: number };
const TABLET: Size = { width: 1180, height: 820, scale: 1, fontScale: 1 };
const PHONE: Size = { width: 844, height: 390, scale: 1, fontScale: 1 };

/** The window's `change` listeners (`useWindowDimensions`): the Node lane has no resize of its own. */
const resizeListeners = new Set<(change: { window: Size; screen: Size }) => void>();
const before = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
beforeAll(() => {
  vi.spyOn(Dimensions, 'addEventListener').mockImplementation(((_type: string, listener: (change: { window: Size; screen: Size }) => void) => {
    resizeListeners.add(listener);
    return { remove: () => resizeListeners.delete(listener) };
  }) as never);
});
afterAll(() => {
  vi.restoreAllMocks();
  Dimensions.set(before);
});
beforeEach(() => {
  page.sent = [];
  page.settle = null;
  Dimensions.set({ window: TABLET, screen: TABLET });
});
afterEach(() => {
  vi.useRealTimers();
});

function resize(size: Size): void {
  Dimensions.set({ window: size, screen: size });
  act(() => {
    for (const listener of resizeListeners) listener({ window: size, screen: size });
  });
}

const one = (r: ReactTestRenderer, id: string): ReactTestInstance => byTestId(r.root, id)[0]!;
const counter = (r: ReactTestRenderer): string => textOf(one(r, 'presenter-counter'));

async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function lesson(): Promise<ReactTestRenderer> {
  vi.useFakeTimers();
  const r = await render(<PresenterApp />);
  await tick(10);
  await press(one(r, 'presenter-start-button'));
  await tick(10);
  expect(byTestId(r.root, 'presenter-stage')).toHaveLength(1);
  return r;
}

async function settle(): Promise<void> {
  expect(page.settle).not.toBeNull();
  page.settle?.();
  await tick(10);
}

function key(command: KeyCommand): void {
  act(() => {
    page.keys?.(command);
  });
}

/** A gesture on the stage: a tap (dx 0) or a swipe (dx at least 60 px), by touch or mouse. */
function gesture(r: ReactTestRenderer, type: 'touch' | 'mouse', dx = 0): void {
  const stage = r.root.find((n) => n.props.testID === 'presenter-stage' && typeof n.props.onResponderGrant === 'function');
  const down = { identifier: 0, pageX: 500, pageY: 200 };
  const up = { ...down, pageX: down.pageX + dx };
  const event = (kind: string, at: typeof down, touches: unknown[]) => ({ target: null, nativeEvent: { type: kind, target: null, ...at, changedTouches: [at], touches } });
  act(() => {
    (stage.props.onResponderGrant as (e: unknown) => void)(event(type === 'touch' ? 'touchstart' : 'mousedown', down, [down]));
    (stage.props.onResponderRelease as (e: unknown) => void)(event(type === 'touch' ? 'touchend' : 'mouseup', up, []));
  });
}

/** Where the lesson is: the slide and the build the stage draws. */
function where(r: ReactTestRenderer): string {
  const stage = r.root.find((n) => typeof n.props.onGesture === 'function' && typeof n.props.reveal === 'number');
  return `${String(stage.props.slideIdx)}.${String(stage.props.reveal)}`;
}

/** One step that must move the slide or the build. */
async function stepped(r: ReactTestRenderer, run: () => void | Promise<void>): Promise<void> {
  const was = where(r);
  await run();
  await tick(10);
  expect(where(r)).not.toBe(was);
}

async function exitLesson(r: ReactTestRenderer): Promise<Record<string, unknown>> {
  key('escape');
  await tick(10);
  await press(one(r, 'presenter-exit-confirm'));
  await tick(10);
  const complete = page.sent.filter((e) => e.name === 'lecture.complete');
  expect(complete).toHaveLength(1);
  return complete[0]!.payload!;
}

const KEYS = ['minutes', 'navLayout', 'points', 'quickBacks', 'reveals', 'slidesShown', 'stepsButton', 'stepsClick', 'stepsKey', 'stepsSwipe'];

describe('lecture.complete counts each step by its source (section 12)', () => {
  it('docked: a bar button, a key, a mouse swipe and a mouse click each count under their own source; a quick Previous is a quick back', async () => {
    const r = await lesson();
    await settle();
    await stepped(r, () => press(one(r, 'presenter-next')));
    await stepped(r, () => key('next'));
    await stepped(r, () => gesture(r, 'mouse', -120));
    // The letter slides have no content targets: a mouse click on empty stage goes on.
    await stepped(r, () => gesture(r, 'mouse'));
    // Previous at once after that forward click: a quick back, counted under the bar button.
    await stepped(r, () => press(one(r, 'presenter-back')));
    // A fresh forward step, then a Previous long after it: no second quick back.
    await stepped(r, () => key('next'));
    await tick(5_000);
    await stepped(r, () => key('prev'));
    // A key that is no step (the grid) and a press an overlay swallowed count nothing.
    key({ overlay: 'grid' });
    await tick(10);
    key('next');
    await tick(10);
    key('escape');
    await tick(10);
    const payload = await exitLesson(r);
    expect(Object.keys(payload).sort()).toEqual(KEYS);
    expect(payload).toMatchObject({ navLayout: 'docked', stepsButton: 2, stepsKey: 3, stepsSwipe: 1, stepsClick: 1, quickBacks: 1, points: 0 });
    // Nothing about the deck, a slide or a time rides along.
    expect(JSON.stringify(payload)).not.toMatch(/Counts lesson|lecture:|quest:|stage1/);
  });

  it('a phone (the overlay layout until the rail ships, and with its kill switch off): touch swipes count, touch taps on empty stage never step', async () => {
    Dimensions.set({ window: PHONE, screen: PHONE });
    const r = await lesson();
    await settle();
    await stepped(r, () => gesture(r, 'touch', -120));
    await stepped(r, () => gesture(r, 'touch', -120));
    await stepped(r, () => gesture(r, 'touch', 120));
    // A touch tap on empty stage shows the bar; it never steps.
    const was = counter(r);
    gesture(r, 'touch');
    await tick(10);
    expect(counter(r)).toBe(was);
    await stepped(r, () => key('next'));
    const payload = await exitLesson(r);
    expect(payload).toMatchObject({ navLayout: 'overlay', stepsSwipe: 3, stepsKey: 1, stepsButton: 0, stepsClick: 0, quickBacks: 1, points: 0 });
  });
});

describe('navLayout: the first slide shown after Start settled, not the Start tap (section 12)', () => {
  it('a resize between the Start tap and the settled fullscreen request decides it; a later resize does not', async () => {
    Dimensions.set({ window: PHONE, screen: PHONE });
    const r = await lesson();
    // The Start tap was on a phone window; the fullscreen request brings the window to its full size.
    resize(TABLET);
    await tick(10);
    expect(byTestId(r.root, 'presenter-bar-band')).toHaveLength(1);
    await settle();
    // Back to a phone window later in the lesson (leaving fullscreen): the layout stays the first one.
    resize(PHONE);
    await tick(10);
    await stepped(r, () => key('next'));
    const payload = await exitLesson(r);
    expect(payload.navLayout).toBe('docked');
  });

  it('a lesson left before its start settled reports the layout at Exit, not the Start tap', async () => {
    // The Start tap is on a phone window (overlay); the window is a tablet by Exit (docked).
    Dimensions.set({ window: PHONE, screen: PHONE });
    const r = await lesson();
    resize(TABLET);
    await tick(10);
    await stepped(r, () => key('next'));
    const payload = await exitLesson(r);
    expect(payload).toMatchObject({ navLayout: 'docked', stepsKey: 1 });
  });
});
