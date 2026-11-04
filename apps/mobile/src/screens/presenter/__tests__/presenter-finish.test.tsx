import { Dimensions } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyCommand } from '../../../logic/lecture/keymap';
import { byTestId, press, render, textOf } from '../../../test-support/render';

/**
 * Finish at the end of a lecture (F-TCH-004 section 3.5 amendment 2026-11-03, row NB-1; owner report:
 * "After each lecture there is no Finish button. Pressing Exit counts as cancelled, not completed").
 * On the whole presenter: at the last slide Next reads Finish and finishes at once; Exit after the
 * last slide was reached offers Finish and records the lesson as finished; Exit part way keeps the
 * slide for Resume and records `finished: false`. The record is `lecture.complete` and the Recent row
 * on this device (a class run never writes learner progress, section 3.9). Fake timers; storage is
 * an in-memory map.
 */

const page = vi.hoisted(() => ({
  keys: null as ((command: KeyCommand) => boolean | void) | null,
  settle: null as (() => void) | null,
  sent: [] as Array<{ name: string; payload?: Record<string, unknown> }>,
}));
vi.mock('../../../platform/presenter', async (importOriginal) => {
  const { encodeDeck } = await import('@hangul-route/content-schema');
  const deck = { v: 1, id: 'lecture:finish0001', title: 'Finish lesson', createdAt: '2026-10-29T09:00:00Z', seed: 1, blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }] };
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
// The phone rail's kill switch (`EXPO_PUBLIC_PRESENTER_RAIL`, read at build time, row PN-4), set per test.
const railSwitch = vi.hoisted(() => ({ on: true }));
vi.mock('../../../config/flags', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../config/flags')>();
  return {
    ...real,
    flags: new Proxy(real.flags, { get: (target, key) => (key === 'presenterRail' ? railSwitch.on : Reflect.get(target, key)) }),
  };
});
const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../platform/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/storage')>()),
  readJson: async (key: string) => (store.has(key) ? structuredClone(store.get(key)) : null),
  readJsonExact: async (key: string) => (store.has(key) ? structuredClone(store.get(key)) : null),
  writeJson: async (key: string, value: unknown) => {
    store.set(key, structuredClone(value));
  },
}));
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
  store.clear();
  page.sent = [];
  page.settle = null;
  railSwitch.on = true;
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


type RecentRow = { deck: { id: string }; savedAt: string; lastSlideKey?: string; finishedAt?: string };
const recentRow = (): RecentRow | undefined => (store.get('lecture:recent') as { items: RecentRow[] } | undefined)?.items.find((i) => i.deck.id === 'lecture:finish0001');
const completes = (): Array<Record<string, unknown>> => page.sent.filter((e) => e.name === 'lecture.complete').map((e) => e.payload!);
const label = (r: ReactTestRenderer, id: string): string => String(one(r, id).props['aria-label'] ?? '');

/** Steps with Next until it reads Finish (the last slide at its last build). */
async function toTheEnd(r: ReactTestRenderer): Promise<void> {
  for (let i = 0; i < 400 && label(r, 'presenter-next') !== 'Finish'; i += 1) {
    key('next');
    await tick(5);
  }
  expect(label(r, 'presenter-next')).toBe('Finish');
}

const SIZES: Array<[string, Size]> = [
  ['tablet (docked bar)', TABLET],
  ['landscape phone (rail)', PHONE],
  ['small landscape phone 568 x 320 (floating bar)', { width: 568, height: 320, scale: 1, fontScale: 1 }],
];

describe('Finish at the end of a lecture (NB-1)', () => {
  it.each(SIZES)('%s: Next reads Finish only at the end; Finish records the lesson as finished at once, with no confirm', async (_name, size) => {
    Dimensions.set({ window: size, screen: size });
    const r = await lesson();
    await settle();
    expect(label(r, 'presenter-next')).not.toBe('Finish');
    await toTheEnd(r);
    // A key or a clicker at the end never leaves: it shows the hint, and the lesson stays.
    key('next');
    await tick(10);
    expect(byTestId(r.root, 'presenter-stage')).toHaveLength(1);
    expect(completes()).toHaveLength(0);
    await press(one(r, 'presenter-next'));
    await tick(20);
    expect(byTestId(r.root, 'presenter-exit-dialog')).toHaveLength(0);
    expect(byTestId(r.root, 'presenter-stage')).toHaveLength(0);
    expect(completes()).toHaveLength(1);
    expect(completes()[0]).toMatchObject({ finished: true });
    // The Recent row records the finish and offers Start over, not Resume.
    const row = recentRow();
    expect(row?.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row?.lastSlideKey).toBeUndefined();
    expect(byTestId(r.root, 'presenter-recent-resume-lecture:finish0001')).toHaveLength(0);
    expect(byTestId(r.root, 'presenter-recent-startover-lecture:finish0001')).toHaveLength(1);
    expect(textOf(one(r, 'presenter-recent-day-lecture:finish0001'))).toBe('Finished: Today');
  });

  it('Exit after the last slide was reached (also after a step back) asks to Finish and records the lesson as finished', async () => {
    const r = await lesson();
    await settle();
    await toTheEnd(r);
    key('prev');
    await tick(10);
    expect(label(r, 'presenter-next')).not.toBe('Finish');
    key('escape');
    await tick(10);
    const dialog = one(r, 'presenter-exit-dialog');
    expect(textOf(dialog)).toContain('Finish the lesson?');
    expect(textOf(dialog)).toContain('You reached the end of the lesson.');
    expect(label(r, 'presenter-exit-confirm')).toBe('Finish');
    await press(one(r, 'presenter-exit-confirm'));
    await tick(20);
    expect(completes()).toEqual([expect.objectContaining({ finished: true })]);
    expect(recentRow()?.finishedAt).toBeDefined();
  });

  it('Exit part way keeps the slide for Resume and records finished: false; nothing taught is discarded', async () => {
    const r = await lesson();
    await settle();
    await stepped(r, () => key('next'));
    await stepped(r, () => key('next'));
    key('escape');
    await tick(10);
    const dialog = one(r, 'presenter-exit-dialog');
    expect(textOf(dialog)).toContain('Leave the lesson?');
    expect(textOf(dialog)).toContain('Recent lessons keeps this slide, so you can resume later.');
    await press(one(r, 'presenter-exit-confirm'));
    await tick(20);
    expect(completes()).toEqual([expect.objectContaining({ finished: false, slidesShown: expect.any(Number) })]);
    expect(Number(completes()[0]!.slidesShown)).toBeGreaterThanOrEqual(2);
    const row = recentRow();
    expect(row?.lastSlideKey).toBeDefined();
    expect(row?.finishedAt).toBeUndefined();
    expect(byTestId(r.root, 'presenter-recent-resume-lecture:finish0001')).toHaveLength(1);
  });

  it('a finished lesson started again is a new run: its row offers Resume again once it is left part way', async () => {
    const r = await lesson();
    await settle();
    await toTheEnd(r);
    await press(one(r, 'presenter-next'));
    await tick(20);
    await press(one(r, 'presenter-recent-startover-lecture:finish0001'));
    await tick(10);
    await press(one(r, 'presenter-start-button'));
    await tick(10);
    page.settle?.();
    await tick(10);
    await stepped(r, () => key('next'));
    key('escape');
    await tick(10);
    await press(one(r, 'presenter-exit-confirm'));
    await tick(20);
    expect(completes().map((p) => p.finished)).toEqual([true, false]);
    expect(recentRow()?.finishedAt).toBeUndefined();
    expect(recentRow()?.lastSlideKey).toBeDefined();
  });
});
