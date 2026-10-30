import { Dimensions } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { KeyCommand } from '../../../logic/lecture/keymap';
import type { InputKind } from '../../../platform/presenter';
import { byTestId, press, render, textOf } from '../../../test-support/render';

/**
 * Pointing at an option on the whole presenter (AMENDMENTS-PRESENTER-NAV section 7.3, owner choice
 * O2, row PN-5): a touch tap or a mouse click on an option, or keys 1 to 4, set `data-pointed="true"`
 * on that option only and change nothing else (the counter, the build, the bar); the same option
 * again clears it; a step (Reveal included) clears it; the live region names the pointed option.
 * With the phone's More sheet open the stage is covered, so neither a tap nor a key points.
 */

const page = vi.hoisted(() => ({
  input: null as ((kind: InputKind) => void) | null,
  key: null as ((command: KeyCommand) => boolean | void) | null,
}));
vi.mock('../../../platform/presenter', async (importOriginal) => {
  const { encodeDeck } = await import('@hangul-route/content-schema');
  const deck = { v: 1, id: 'lecture:point1', title: 'Point', createdAt: '2026-10-29T09:00:00Z', seed: 1, blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }] };
  return {
    ...(await importOriginal<typeof import('../../../platform/presenter')>()),
    takeDeckFragment: () => ({ raw: encodeDeck(deck as never), reloaded: false }),
    subscribeInputKind: (handler: (kind: InputKind) => void) => {
      page.input = handler;
      return () => {
        page.input = null;
      };
    },
    subscribeKeys: (handler: (command: KeyCommand) => boolean | void) => {
      page.key = handler;
      return () => {
        if (page.key === handler) page.key = null;
      };
    },
    touchSeenAtStart: () => true,
  };
});
// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
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
afterEach(() => {
  Dimensions.set({ window: tablet, screen: tablet });
  vi.useRealTimers();
});

const one = (r: ReactTestRenderer, id: string): ReactTestInstance => byTestId(r.root, id)[0]!;
const counter = (r: ReactTestRenderer): string => textOf(one(r, 'presenter-counter'));
const live = (r: ReactTestRenderer): string => textOf(one(r, 'presenter-live'));
/** The host option nodes that carry `data-pointed`, by their number. */
const pointedNow = (r: ReactTestRenderer): number[] =>
  r.root
    .findAll((n) => typeof n.type === 'string' && n.props['data-pointed'] === 'true')
    .map((n) => Number(String(n.props['data-stage-target']).replace('option:', '')));

async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A node inside a content target: `closest('[data-stage-target]')` finds the marker. */
const inside = (marker: string | null) => ({
  closest: (selector: string) => (selector === '[data-stage-target]' && marker !== null ? { getAttribute: (name: string) => (name === 'data-stage-target' ? marker : null) } : null),
});

/** A one-finger tap (or, with `dx`, a swipe) on the stage, on `marker` or on empty area. */
function gesture(r: ReactTestRenderer, type: 'touch' | 'mouse', marker: string | null, dx = 0): void {
  const stage = r.root.find((n) => n.props.testID === 'presenter-stage' && typeof n.props.onResponderGrant === 'function');
  const down = { identifier: 0, pageX: 400, pageY: 300 };
  const up = { ...down, pageX: down.pageX + dx };
  const target = inside(marker);
  const event = (kind: string, at: typeof down, touches: unknown[]) => ({ target, nativeEvent: { type: kind, target, ...at, changedTouches: [at], touches } });
  act(() => {
    (stage.props.onResponderGrant as (e: unknown) => void)(event(type === 'touch' ? 'touchstart' : 'mousedown', down, [down]));
    (stage.props.onResponderRelease as (e: unknown) => void)(event(type === 'touch' ? 'touchend' : 'mouseup', up, []));
  });
}

function key(command: KeyCommand): void {
  act(() => {
    page.key?.(command);
  });
}

/** The presenter with its first quiz slide (four options) on screen at build 0. */
async function onQuiz(): Promise<ReactTestRenderer> {
  vi.useFakeTimers();
  const r = await render(<PresenterApp />);
  await tick(10);
  await press(one(r, 'presenter-start-button'));
  await tick(10);
  for (let i = 0; i < 80 && byTestId(r.root, 'presenter-quiz-option-4').length === 0; i += 1) {
    key('next');
    await tick(10);
  }
  expect(byTestId(r.root, 'presenter-quiz-option-4').length).toBeGreaterThan(0);
  expect(byTestId(r.root, 'presenter-quiz-mark')).toHaveLength(0);
  return r;
}

describe('a tap or click on an option points at it (section 7.3)', () => {
  it('a touch tap sets data-pointed on that option only, changes nothing else and is announced; a second tap clears it', async () => {
    const r = await onQuiz();
    const was = counter(r);
    gesture(r, 'touch', 'option:2');
    await tick(10);
    expect(pointedNow(r)).toEqual([2]);
    expect(counter(r)).toBe(was);
    expect(byTestId(r.root, 'presenter-quiz-mark')).toHaveLength(0);
    expect(live(r)).toBe('Option 2 pointed at');
    // Another option moves it there: one at a time.
    gesture(r, 'touch', 'option:4');
    await tick(10);
    expect(pointedNow(r)).toEqual([4]);
    expect(live(r)).toBe('Option 4 pointed at');
    gesture(r, 'touch', 'option:4');
    await tick(10);
    expect(pointedNow(r)).toEqual([]);
    expect(live(r)).toBe('No option pointed at');
    expect(counter(r)).toBe(was);
  });

  it('a mouse click on an option points at it too, and a click on empty area of a question slide does nothing', async () => {
    const r = await onQuiz();
    const was = counter(r);
    gesture(r, 'mouse', 'option:3');
    await tick(10);
    expect(pointedNow(r)).toEqual([3]);
    gesture(r, 'mouse', null);
    await tick(10);
    expect(pointedNow(r)).toEqual([3]);
    expect(counter(r)).toBe(was);
  });

  it('a step clears it: Reveal shows the answer with nothing outlined, and a swipe on to the next slide too', async () => {
    const r = await onQuiz();
    gesture(r, 'touch', 'option:1');
    await tick(10);
    expect(pointedNow(r)).toEqual([1]);
    await press(one(r, 'presenter-next'));
    await tick(10);
    expect(byTestId(r.root, 'presenter-quiz-mark')).toHaveLength(1);
    expect(pointedNow(r)).toEqual([]);
    expect(live(r)).not.toContain('pointed');
    gesture(r, 'touch', 'option:2');
    await tick(10);
    expect(pointedNow(r)).toEqual([2]);
    const was = counter(r);
    gesture(r, 'touch', 'option:2', -100);
    await tick(10);
    expect(counter(r)).not.toBe(was);
    expect(pointedNow(r)).toEqual([]);
  });
});

describe('keys 1 to 4 (section 7.3)', () => {
  it('key n points at option n, the same key again clears it; Previous clears it', async () => {
    const r = await onQuiz();
    const was = counter(r);
    key({ point: 3 });
    await tick(10);
    expect(pointedNow(r)).toEqual([3]);
    expect(live(r)).toBe('Option 3 pointed at');
    key({ point: 3 });
    await tick(10);
    expect(pointedNow(r)).toEqual([]);
    key({ point: 1 });
    await tick(10);
    expect(pointedNow(r)).toEqual([1]);
    expect(counter(r)).toBe(was);
    key('prev');
    await tick(10);
    expect(pointedNow(r)).toEqual([]);
  });

  it('under a covering overlay (Blank) a key points at nothing', async () => {
    const r = await onQuiz();
    key({ overlay: 'blank' });
    await tick(10);
    key({ point: 2 });
    await tick(10);
    key('escape');
    await tick(10);
    expect(pointedNow(r)).toEqual([]);
  });
});

describe('a phone window with More open (section 5.2: More covers the stage)', () => {
  it('neither a key nor a tap on an option points; the tap closes More', async () => {
    Dimensions.set({ window: phone, screen: phone });
    const r = await onQuiz();
    await press(one(r, 'presenter-more'));
    expect(byTestId(r.root, 'presenter-more-sheet')).toHaveLength(1);
    key({ point: 1 });
    await tick(10);
    expect(pointedNow(r)).toEqual([]);
    gesture(r, 'touch', 'option:1');
    await tick(10);
    expect(pointedNow(r)).toEqual([]);
    expect(byTestId(r.root, 'presenter-more-sheet')).toHaveLength(0);
    // With More closed the same tap points, and the bar is neither shown nor hidden by it.
    const bar = one(r, 'presenter-next');
    gesture(r, 'touch', 'option:1');
    await tick(10);
    expect(pointedNow(r)).toEqual([1]);
    expect(one(r, 'presenter-next')).toBe(bar);
  });
});

describe('Help names pointing (section 9.2)', () => {
  it('the Touch and mouse line for pointing and the key row 1 2 3 4, Point at an answer', async () => {
    const r = await onQuiz();
    key({ overlay: 'help' });
    await tick(10);
    expect(textOf(one(r, 'presenter-help-touch-point'))).toBe('Tap an answer to point at it. It does not show the answer.');
    const help = textOf(one(r, 'presenter-help'));
    expect(help).toContain('Point at an answer');
    expect(help).toMatch(/1\s*2\s*3\s*4\s*Point at an answer/);
    // A key under Help points at nothing (it covers the slide).
    key({ point: 1 });
    await tick(10);
    expect(pointedNow(r)).toEqual([]);
  });
});
