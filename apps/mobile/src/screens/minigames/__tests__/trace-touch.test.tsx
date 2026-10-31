import { colors, spacing } from '@hangul-route/design-system';
import type { ReactNode } from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Path } from 'react-native-svg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scopeFor, type MinigameScope } from '../../../logic/minigame-config';
import { TRACE_IDLE_MS } from '../../../logic/trace-evaluator';
import { createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { render, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { TraceStrokeGame } from '../TraceStrokeGame';
import { TraceWordGame } from '../TraceWordGame';

/**
 * AMENDMENTS-TOUCH KT-D9 (6.8), on the screens: the trace pan starts at `spacing.xs` with no pointer
 * limit, and the stroke follows one finger by pointer id (the touch callbacks): a resting palm or a second
 * touch adds nothing and cancels nothing; a touch that never travelled 4 px (a dot) leaves no ink and
 * re-arms the idle check, so a drawing is still scored without the Done button (R1).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => {
  const bound = (await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!);
  return { ...(await importOriginal<object>()), ...bound };
});
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));
// The native gesture handler has no build that loads in Node: a Pan that records its configuration and
// whose callbacks the test calls, a detector that draws its child.
interface Touch {
  id: number;
  x: number;
  y: number;
}
type Handler = (e?: { changedTouches?: Touch[] }) => void;
const pan = vi.hoisted(() => ({
  latest: {} as Record<string, Handler>,
  config: {} as Record<string, number>,
}));
vi.mock('react-native-gesture-handler', () => {
  const Pan = () => {
    const handlers: Record<string, Handler> = {};
    const config: Record<string, number> = {};
    pan.latest = handlers;
    pan.config = config;
    const on = (name: string) => (fn: Handler) => ((handlers[name] = fn), builder);
    const set = (name: string) => (value: number) => ((config[name] = value), builder);
    const builder: Record<string, unknown> = {
      minDistance: set('minDistance'),
      maxPointers: set('maxPointers'),
      onBegin: on('begin'),
      onUpdate: on('update'),
      onEnd: on('end'),
      onFinalize: on('finalize'),
      onTouchesDown: on('touchesDown'),
      onTouchesMove: on('touchesMove'),
      onTouchesUp: on('touchesUp'),
      onTouchesCancelled: on('touchesCancelled'),
    };
    return builder;
  };
  return {
    Gesture: { Pan },
    GestureDetector: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
vi.mock('../../use-practice-session', () => ({ usePracticeSession: () => undefined }));
// Show me's animated demonstration draws with reanimated's animated SVG, which the render lane stands in for.
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

const INK_WIDTH = 8;
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  rig.current = createAudioRig({ voices: [] });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

/** Lets every `onLayout` report a size, as a device does after its first frame (the trace games draw nothing before). */
async function layOut(r: ReactTestRenderer, width = 390, height = 760): Promise<void> {
  for (let pass = 0; pass < 3; pass += 1) {
    const views = r.root.findAll((n) => typeof n.props.onLayout === 'function' && typeof n.type !== 'string');
    await act(async () => {
      for (const v of views) (v.props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
    });
  }
}

const wait = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** The learner's ink on the live canvas (the ghost and the strip draw at other widths). */
const ink = (root: ReactTestInstance): number => root.findAll((n) => n.type === Path && n.props.strokeWidth === INK_WIDTH).length;

const canvasBorder = (root: ReactTestInstance): unknown => {
  const canvas = root.find((n) => typeof n.type !== 'string' && n.props.nativeID === 'trace-canvas');
  return (canvas.props.style as { borderColor?: unknown }).borderColor;
};

const canvasSize = (root: ReactTestInstance): number => {
  const canvas = root.find((n) => typeof n.type !== 'string' && n.props.nativeID === 'trace-canvas');
  return (canvas.props.style as { width: number }).width;
};

/** The touch callbacks, as the gesture handler calls them: one event per changed pointer. */
const fire = async (name: 'touchesDown' | 'touchesMove' | 'touchesUp', touch: Touch): Promise<void> => {
  await act(async () => {
    pan.latest[name]?.({ changedTouches: [touch] });
  });
};
const begin = async (): Promise<void> => {
  await act(async () => {
    pan.latest.begin?.();
  });
};
const finalize = async (): Promise<void> => {
  await act(async () => {
    pan.latest.finalize?.();
  });
};

/** A real stroke with one finger: down, ten moves to `to`, up. */
async function stroke(from: { x: number; y: number }, to: { x: number; y: number }, id = 0): Promise<void> {
  await begin();
  await fire('touchesDown', { id, ...from });
  for (let i = 1; i <= 10; i += 1) {
    await fire('touchesMove', { id, x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 });
  }
  await fire('touchesUp', { id, ...to });
  await finalize();
}

/** A touch that never travelled the activation distance: down, a 3 px wobble, up. */
async function dot(at: { x: number; y: number }, id = 0): Promise<void> {
  await begin();
  await fire('touchesDown', { id, ...at });
  await fire('touchesMove', { id, x: at.x + 3, y: at.y });
  await fire('touchesUp', { id, ...at });
  await finalize();
}

/** The points of the newest ink path, in the canvas's viewBox. */
const lastInk = (root: ReactTestInstance): Array<{ x: number; y: number }> => {
  const paths = root.findAll((n) => n.type === Path && n.props.strokeWidth === INK_WIDTH);
  const d = String(paths[paths.length - 1]!.props.d);
  return d.split(/[ML]/).filter((part) => part.trim() !== '').map((part) => {
    const [x, y] = part.trim().split(' ').map(Number);
    return { x: x!, y: y! };
  });
};

/** A palm rests on the far corner, a finger draws a line, the palm moves while the finger draws. */
async function palmAndFinger(root: ReactTestInstance): Promise<{ fingerY: number; palm: { x: number; y: number } }> {
  const size = canvasSize(root);
  const palm = { x: size * 0.9, y: size * 0.9 };
  const fingerY = size * 0.2;
  await begin();
  await fire('touchesDown', { id: 9, ...palm });
  await fire('touchesDown', { id: 0, x: size * 0.1, y: fingerY });
  for (let i = 1; i <= 8; i += 1) {
    await fire('touchesMove', { id: 0, x: size * 0.1 + i * size * 0.08, y: fingerY });
    // The palm drifts too, more than the activation distance, after the finger owns the stroke.
    await fire('touchesMove', { id: 9, x: palm.x - i * 6, y: palm.y - i * 6 });
  }
  await fire('touchesUp', { id: 0, x: size * 0.74, y: fingerY });
  await fire('touchesUp', { id: 9, x: palm.x - 48, y: palm.y - 48 });
  await finalize();
  return { fingerY, palm };
}

const host = (): MinigameHost => ({ mode: 'quest', answer: () => undefined, complete: () => undefined });

describe('Trace: the pan (AMENDMENTS-TOUCH 6.8)', () => {
  const scope = scopeFor('minigame:s1-letters-q2-apply')!;

  it('starts at spacing.xs and sets no pointer limit (a palm must not fail the gesture)', async () => {
    const r = await render(<TraceStrokeGame scope={scope} onFinish={() => undefined} />);
    mounted.push(r);
    await layOut(r);
    expect(pan.config.minDistance).toBe(spacing.xs);
    expect(pan.config.maxPointers).toBeUndefined();
  });

  it('a resting palm first, then a finger: the finger draws from where it landed; the palm adds nothing', async () => {
    const r = await render(<TraceStrokeGame scope={scope} onFinish={() => undefined} />);
    mounted.push(r);
    await layOut(r);
    const scale = 200 / canvasSize(r.root);
    const { fingerY } = await palmAndFinger(r.root);
    expect(ink(r.root)).toBe(1);
    const points = lastInk(r.root);
    expect(points[0]!.x).toBeCloseTo(canvasSize(r.root) * 0.1 * scale);
    for (const p of points) expect(p.y).toBeCloseTo(fingerY * scale);
  });

  it('a second touch mid-stroke neither cancels nor moves the stroke', async () => {
    const r = await render(<TraceStrokeGame scope={scope} onFinish={() => undefined} />);
    mounted.push(r);
    await layOut(r);
    await begin();
    await fire('touchesDown', { id: 0, x: 20, y: 30 });
    await fire('touchesMove', { id: 0, x: 40, y: 30 });
    await fire('touchesDown', { id: 1, x: 150, y: 150 });
    await fire('touchesMove', { id: 1, x: 120, y: 120 });
    await fire('touchesMove', { id: 0, x: 60, y: 30 });
    await fire('touchesUp', { id: 1, x: 120, y: 120 });
    await fire('touchesMove', { id: 0, x: 80, y: 30 });
    await fire('touchesUp', { id: 0, x: 80, y: 30 });
    await finalize();
    expect(ink(r.root)).toBe(1);
    const scale = 200 / canvasSize(r.root);
    expect(lastInk(r.root).map((p) => Math.round(p.x / scale))).toEqual([20, 40, 60, 80]);
    for (const p of lastInk(r.root)) expect(p.y).toBeCloseTo(30 * scale);
  });

  it('a dot on an empty canvas leaves no ink and scores nothing', async () => {
    const r = await render(<TraceStrokeGame scope={scope} onFinish={() => undefined} />);
    mounted.push(r);
    await layOut(r);
    await dot({ x: 40, y: 40 });
    expect(ink(r.root)).toBe(0);
    await wait(TRACE_IDLE_MS * 2);
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
  });

  it('a dot after a stroke leaves no ink and the drawing is still scored after the idle wait', async () => {
    const r = await render(<TraceStrokeGame scope={scope} onFinish={() => undefined} />);
    mounted.push(r);
    await layOut(r);
    await stroke({ x: 20, y: 20 }, { x: 120, y: 20 });
    expect(ink(r.root)).toBe(1);
    await wait(500);
    await dot({ x: 60, y: 60 });
    expect(ink(r.root)).toBe(1);
    await wait(TRACE_IDLE_MS - 10);
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    await wait(10);
    // Scored: the canvas shows the pass or the nudge.
    expect(canvasBorder(r.root)).not.toBe(colors.brand.primary);
  });

  it('a stroke that activated keeps its ink after the finger lifts', async () => {
    const r = await render(<TraceStrokeGame scope={scope} onFinish={() => undefined} />);
    mounted.push(r);
    await layOut(r);
    await stroke({ x: 20, y: 20 }, { x: 120, y: 20 });
    await stroke({ x: 20, y: 60 }, { x: 120, y: 60 });
    expect(ink(r.root)).toBe(2);
  });
});

describe('Trace a Word: the pan (AMENDMENTS-TOUCH 6.8)', () => {
  const scope: MinigameScope = { kind: 'trace-word', rounds: 1, traceWord: { rounds: [{ id: 'hoya', word: { ko: '호야', romanization: 'hoya', en: 'Hoya' } }] } };

  it('starts at spacing.xs and sets no pointer limit (a palm must not fail the gesture)', async () => {
    const r = await render(<TraceWordGame scope={scope} host={host()} />);
    mounted.push(r);
    await layOut(r);
    expect(pan.config.minDistance).toBe(spacing.xs);
    expect(pan.config.maxPointers).toBeUndefined();
  });

  it('a resting palm first, then a finger: the finger draws; the palm adds nothing', async () => {
    const r = await render(<TraceWordGame scope={scope} host={host()} />);
    mounted.push(r);
    await layOut(r);
    const scale = 200 / canvasSize(r.root);
    const { fingerY } = await palmAndFinger(r.root);
    expect(ink(r.root)).toBe(1);
    for (const p of lastInk(r.root)) expect(p.y).toBeCloseTo(fingerY * scale);
  });

  it('a dot on an empty canvas leaves no ink and scores nothing', async () => {
    const r = await render(<TraceWordGame scope={scope} host={host()} />);
    mounted.push(r);
    await layOut(r);
    const live = canvasBorder(r.root);
    await dot({ x: 40, y: 40 });
    expect(ink(r.root)).toBe(0);
    await wait(TRACE_IDLE_MS * 2);
    expect(canvasBorder(r.root)).toBe(live);
  });

  it('a dot after a stroke leaves no ink and the drawing is still checked after the idle wait', async () => {
    const r = await render(<TraceWordGame scope={scope} host={host()} />);
    mounted.push(r);
    await layOut(r);
    const live = canvasBorder(r.root);
    // Block mode checks by itself once every letter has ink: a line through each half of 호 (ㅎ over ㅗ).
    const size = canvasSize(r.root);
    for (const y of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) await stroke({ x: size * 0.05, y: size * y }, { x: size * 0.95, y: size * y });
    expect(ink(r.root)).toBe(6);
    await wait(500);
    await dot({ x: 60, y: 60 });
    expect(ink(r.root)).toBe(6);
    await wait(TRACE_IDLE_MS - 10);
    expect(canvasBorder(r.root)).toBe(live);
    await wait(10);
    // Checked: the canvas shows the retry or the pass look.
    expect(canvasBorder(r.root)).not.toBe(live);
  });
});
