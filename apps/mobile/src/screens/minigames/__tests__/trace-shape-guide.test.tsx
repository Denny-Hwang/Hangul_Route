import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Path } from 'react-native-svg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strokesForJamo, type JamoStrokePoint } from '../../../content/jamo-strokes';
import type { MinigameScope } from '../../../logic/minigame-config';
import { TRACE_IDLE_MS } from '../../../logic/trace-evaluator';
import { TRACE_KEEP_GOING_MS } from '../../../logic/trace-ready';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { render, screenTexts, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { TraceStrokeGame } from '../TraceStrokeGame';
import { TraceWordGame } from '../TraceWordGame';

/**
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §6 test 8 (screen part) and test 7 (Trace a Word label), on the shipped list
 * (no letter taught): Show me gets `orderTaught` false and the letter's romanization; the strip shows "Shape guide" in
 * place of the idle line while the hint is up, and never in place of a miss, pass or keep-going line; the ghost steps
 * aside. Design: `design/wireframes/minigame/trace-stroke-shape-guide.md` §3-§5.
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
interface Touch {
  id: number;
  x: number;
  y: number;
}
type Handler = (e?: { changedTouches?: Touch[] }) => void;
const pan = vi.hoisted(() => ({ latest: {} as Record<string, Handler> }));
vi.mock('react-native-gesture-handler', () => {
  const Pan = () => {
    const handlers: Record<string, Handler> = {};
    pan.latest = handlers;
    const on = (name: string) => (fn: Handler) => ((handlers[name] = fn), builder);
    const set = () => () => builder;
    const builder: Record<string, unknown> = {
      minDistance: set(),
      maxPointers: set(),
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
  return { Gesture: { Pan }, GestureDetector: ({ children }: { children: ReactNode }) => children };
});
/** Show me stands in as a recorder of its props (the real one is checked in stroke-hint-shape.test.tsx). */
interface HintProps {
  target: unknown;
  orderTaught: boolean;
  romanization: string;
  orderLabel?: string;
  retryLook?: boolean;
  onComplete?: () => void;
}
const hint = vi.hoisted(() => ({ last: null as HintProps | null }));
vi.mock('../../../components/StrokeHint', () => ({
  StrokeHint: (props: HintProps) => {
    hint.last = props;
    return null;
  },
}));

/** The reviewed list the gate reads: empty as shipped; a test may mark some jamo taught. */
const gate = vi.hoisted(() => ({ reviewed: [] as string[] }));
vi.mock('../../../logic/stroke-order-taught', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../logic/stroke-order-taught')>();
  return {
    strokeOrderTaught: (id: string) => real.strokeOrderTaught(id, gate.reviewed),
    unitOrderTaught: (letters: readonly { jamoIds?: readonly string[] }[]) => real.unitOrderTaught(letters, gate.reviewed),
  };
});

const GHOST_WIDTH = 18;
const IDLE_LINE = 'Draw each line slowly. Tap Done when you finish.';
const KEEP_GOING_LINE = 'Keep going. Tap Done when you finish.';
const RETRY_LINE = 'Try again — start at the top!';
const SHAPE_GUIDE = 'Shape guide';
const CLEAN = 'Beautiful! That looks like the letter.';
const LOOP_TIP = 'Nice! Next time, try going around the other way.';

const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  rig.current = createAudioRig({ voices: [] });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  useQuestRunStore.getState().reset();
  hint.last = null;
  gate.reviewed = [];
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useQuestRunStore.getState().reset();
  vi.useRealTimers();
});

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
const fire = async (name: string, touch?: Touch): Promise<void> => {
  await act(async () => {
    pan.latest[name]?.(touch ? { changedTouches: [touch] } : undefined);
  });
};
const canvasSize = (root: ReactTestInstance): number =>
  (root.find((n) => typeof n.type !== 'string' && n.props.nativeID === 'trace-canvas').props.style as { width: number }).width;
const ghosts = (root: ReactTestInstance): number => root.findAll((n) => n.type === Path && n.props.strokeWidth === GHOST_WIDTH).length;
const texts = (root: ReactTestInstance): string[] => screenTexts(root);
const press = async (root: ReactTestInstance, label: string): Promise<void> => {
  const b = root.findAll((n) => n.props.label === label && typeof n.props.onPress === 'function')[0];
  expect(b, label).toBeDefined();
  await act(async () => {
    (b!.props.onPress as () => void)();
  });
};
const endHint = async (): Promise<void> => {
  await act(async () => {
    hint.last?.onComplete?.();
  });
};

/**
 * One stroke through viewBox points: down, each segment walked in `movesPerSegment` moves, up. Every move is its own
 * act() and re-renders the screen, so a sampled loop (ㅇ: 64 chords of about 5.6 units, `LOOP_SEGMENTS` in
 * content/jamo-strokes) is drawn one move per chord: split twelve ways it is 768 renders, which timed out on a busy runner.
 */
async function draw(root: ReactTestInstance, points: readonly JamoStrokePoint[], movesPerSegment = 12): Promise<void> {
  const k = canvasSize(root) / 200;
  const at = (p: JamoStrokePoint): { x: number; y: number } => ({ x: p.x * k, y: p.y * k });
  const n = movesPerSegment;
  await fire('begin');
  await fire('touchesDown', { id: 0, ...at(points[0]!) });
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    for (let j = 1; j <= n; j += 1) await fire('touchesMove', { id: 0, ...at({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n }) });
  }
  await fire('touchesUp', { id: 0, ...at(points[points.length - 1]!) });
  await fire('finalize');
}

async function playStroke(...jamoIds: string[]): Promise<ReactTestRenderer> {
  return playStrokeWith(false, ...jamoIds);
}

async function playStrokeWith(strictMode: boolean, ...jamoIds: string[]): Promise<ReactTestRenderer> {
  const scope: MinigameScope = { kind: 'trace-stroke', jamoIds, rounds: jamoIds.length };
  const r = await render(<TraceStrokeGame scope={scope} onFinish={() => undefined} strictMode={strictMode} />);
  mounted.push(r);
  await layOut(r);
  return r;
}

describe('Trace Stroke, untaught letter: Show me is a shape guide (§6 test 8)', () => {
  it('Show me gets orderTaught false and the romanization; the strip reads "Shape guide" and the ghost steps aside until it ends', async () => {
    const r = await playStroke('jamo:o');
    const ghostCount = ghosts(r.root);
    expect(ghostCount).toBe(strokesForJamo('jamo:o')!.length);
    expect(texts(r.root)).toContain(IDLE_LINE);
    await press(r.root, 'Show me');
    expect(hint.last).toMatchObject({ orderTaught: false, romanization: 'o' });
    expect(texts(r.root)).toContain(SHAPE_GUIDE);
    expect(texts(r.root)).not.toContain(IDLE_LINE);
    expect(ghosts(r.root)).toBe(0);
    await endHint();
    expect(texts(r.root)).toContain(IDLE_LINE);
    expect(texts(r.root)).not.toContain(SHAPE_GUIDE);
    expect(ghosts(r.root)).toBe(ghostCount);
  });

  it('a final passes its own romanization', async () => {
    const r = await playStroke('jamo:ieung-batchim');
    expect(hint.last).toBeNull();
    await press(r.root, 'Show me');
    expect(hint.last).toMatchObject({ orderTaught: false, romanization: 'ng' });
  });

  it('the keep-going line wins over the caption', async () => {
    const r = await playStroke('jamo:bieup');
    const [s1] = strokesForJamo('jamo:bieup')!;
    await draw(r.root, s1!);
    await wait(TRACE_KEEP_GOING_MS);
    expect(texts(r.root)).toContain(KEEP_GOING_LINE);
    await press(r.root, 'Show me');
    expect(texts(r.root)).toContain(KEEP_GOING_LINE);
    expect(texts(r.root)).not.toContain(SHAPE_GUIDE);
  });

  it('the miss line wins over the caption, and its look stays', async () => {
    const r = await playStroke('jamo:o');
    await draw(r.root, [{ x: 10, y: 190 }, { x: 30, y: 190 }]);
    await press(r.root, 'Done');
    expect(texts(r.root)).toContain(RETRY_LINE);
    await press(r.root, 'Show me');
    expect(texts(r.root)).toContain(RETRY_LINE);
    expect(texts(r.root)).not.toContain(SHAPE_GUIDE);
  });

  // [SO] Row SO-1b, OD-SO9: the reveal is told when the canvas is in its retry look (it then draws at full opacity).
  it('Show me is told the canvas look: not the retry look while drawing, the retry look after a miss, and back', async () => {
    const r = await playStroke('jamo:o');
    await press(r.root, 'Show me');
    expect(hint.last!.retryLook).toBe(false);
    await endHint();
    await draw(r.root, [{ x: 10, y: 190 }, { x: 30, y: 190 }]);
    await press(r.root, 'Done');
    expect(texts(r.root)).toContain(RETRY_LINE);
    await press(r.root, 'Show me');
    expect(hint.last!.retryLook).toBe(true);
    // The first real ink after a miss turns the canvas back to drawing; the reveal still up follows it.
    const [tick] = strokesForJamo('jamo:o')!;
    await draw(r.root, tick!);
    expect(texts(r.root)).not.toContain(RETRY_LINE);
    expect(hint.last!.retryLook).toBe(false);
  });

  it('a pass line wins over the caption; ㅗ bar first passes clean (no order line)', async () => {
    const r = await playStroke('jamo:o');
    await press(r.root, 'Show me');
    expect(texts(r.root)).toContain(SHAPE_GUIDE);
    const [tick, bar] = strokesForJamo('jamo:o')!;
    await draw(r.root, bar!);
    await draw(r.root, tick!);
    await press(r.root, 'Done');
    expect(texts(r.root)).toContain(CLEAN);
    expect(texts(r.root)).not.toContain(SHAPE_GUIDE);
  });

  it('strict mode on: ㅗ bar first passes on coverage while untaught (§6 test 6); taught, it asks for the order', async () => {
    const [tick, bar] = strokesForJamo('jamo:o')!;
    const r = await playStrokeWith(true, 'jamo:o');
    await draw(r.root, bar!);
    await draw(r.root, tick!);
    await press(r.root, 'Done');
    expect(texts(r.root)).toContain(CLEAN);
    gate.reviewed = ['jamo:o'];
    const t = await playStrokeWith(true, 'jamo:o');
    await draw(t.root, bar!);
    await draw(t.root, tick!);
    await press(t.root, 'Done');
    expect(texts(t.root)).not.toContain(CLEAN);
    expect(texts(t.root)).toContain(getMessages('en').learner.minigame.trace.retry.order);
  });

  it('ㅇ drawn clockwise keeps the loop tip (and Next) while untaught', async () => {
    const r = await playStroke('jamo:ieung');
    const [ring] = strokesForJamo('jamo:ieung')!;
    await draw(r.root, [...ring!].reverse(), 1);
    await wait(TRACE_IDLE_MS);
    expect(texts(r.root)).toContain(LOOP_TIP);
    expect(r.root.findAll((n) => n.props.label === 'Next' && typeof n.props.onPress === 'function')).toHaveLength(1);
  });
});

describe('Trace a Word, untaught unit: Show me is a shape guide (§6 tests 7, 8)', () => {
  const host = (): MinigameHost => ({ mode: 'quest', answer: () => undefined, complete: () => undefined });
  const scope = (mode?: 'letter'): MinigameScope => ({
    kind: 'trace-word',
    rounds: 1,
    traceWord: { rounds: [{ id: 'hoya', word: { ko: '호야', romanization: 'hoya', en: 'Hoya' }, ...(mode ? { mode } : {}) }] },
  });

  it('block mode: the unit is untaught, labelled by the block; the strip reads "Shape guide"; the ghost steps aside', async () => {
    const r = await render(<TraceWordGame scope={scope()} host={host()} />);
    mounted.push(r);
    await layOut(r);
    const ghostCount = ghosts(r.root);
    expect(ghostCount).toBeGreaterThan(0);
    await press(r.root, 'Show me');
    expect(hint.last).toMatchObject({ orderTaught: false, romanization: 'ho' });
    expect(hint.last!.orderLabel).toBeUndefined();
    expect(texts(r.root)).toContain(SHAPE_GUIDE);
    expect(ghosts(r.root)).toBe(0);
    await endHint();
    expect(texts(r.root)).not.toContain(SHAPE_GUIDE);
    expect(ghosts(r.root)).toBe(ghostCount);
  });

  it('a unit with one untaught jamo is untaught: shape label, no order label (§6 test 7)', async () => {
    gate.reviewed = ['jamo:o'];
    const r = await render(<TraceWordGame scope={scope()} host={host()} />);
    mounted.push(r);
    await layOut(r);
    await press(r.root, 'Show me');
    expect(hint.last).toMatchObject({ orderTaught: false, romanization: 'ho' });
    expect(hint.last!.orderLabel).toBeUndefined();
    // Every jamo taught: the order label and today's demo come back.
    await endHint();
    gate.reviewed = ['jamo:o', 'jamo:hieut'];
    const t = await render(<TraceWordGame scope={scope()} host={host()} />);
    mounted.push(t);
    await layOut(t);
    await press(t.root, 'Show me');
    expect(hint.last).toMatchObject({ orderTaught: true });
    expect(hint.last!.orderLabel).toMatch(/^Letter 1 of 2\. Stroke order/);
    expect(texts(t.root)).not.toContain(SHAPE_GUIDE);
  });

  it('the retry line wins over the caption', async () => {
    const r = await render(<TraceWordGame scope={scope()} host={host()} />);
    mounted.push(r);
    await layOut(r);
    await press(r.root, 'Show me');
    expect(texts(r.root)).toContain(SHAPE_GUIDE);
    await draw(r.root, [{ x: 10, y: 190 }, { x: 30, y: 190 }]);
    await press(r.root, 'Done');
    expect(texts(r.root)).toContain(RETRY_LINE);
    expect(texts(r.root)).not.toContain(SHAPE_GUIDE);
  });

  // [SO] Row SO-1b, OD-SO9: Show me on the retry look is told so (the reveal then draws at full opacity).
  it('Show me is told the canvas look: drawing, then the retry look after a miss', async () => {
    const r = await render(<TraceWordGame scope={scope()} host={host()} />);
    mounted.push(r);
    await layOut(r);
    await press(r.root, 'Show me');
    expect(hint.last!.retryLook).toBe(false);
    await endHint();
    await draw(r.root, [{ x: 10, y: 190 }, { x: 30, y: 190 }]);
    await press(r.root, 'Done');
    expect(texts(r.root)).toContain(RETRY_LINE);
    await press(r.root, 'Show me');
    expect(hint.last!.retryLook).toBe(true);
  });

  // StrokeHint plays again when its target changes: the unit's strokes keep their identity across a re-render (ink
  // drawn while the shape is up, the canvas leaving the retry look), so the reveal follows the look without restarting.
  it.each([undefined, 'letter'] as const)('Show me keeps one target while the learner draws during it (mode: %s)', async (mode) => {
    const r = await render(<TraceWordGame scope={scope(mode)} host={host()} />);
    mounted.push(r);
    await layOut(r);
    await draw(r.root, [{ x: 10, y: 190 }, { x: 30, y: 190 }]);
    await press(r.root, 'Done');
    expect(texts(r.root)).toContain(RETRY_LINE);
    await press(r.root, 'Show me');
    const target = hint.last!.target;
    expect(hint.last!.retryLook).toBe(true);
    await draw(r.root, [{ x: 100, y: 40 }, { x: 100, y: 80 }]);
    expect(texts(r.root)).not.toContain(RETRY_LINE);
    expect(hint.last!.retryLook).toBe(false);
    expect(hint.last!.target).toBe(target);
  });

  it('letter mode: the one letter, labelled by its own romanization; only its ghost steps aside', async () => {
    const r = await render(<TraceWordGame scope={scope('letter')} host={host()} />);
    mounted.push(r);
    await layOut(r);
    const ghostCount = ghosts(r.root);
    await press(r.root, 'Show me');
    expect(hint.last).toMatchObject({ orderTaught: false, romanization: 'h' });
    expect(ghosts(r.root)).toBe(ghostCount - strokesForJamo('jamo:hieut')!.length);
    expect(texts(r.root)).toContain(SHAPE_GUIDE);
  });
});
