import { colors } from '@hangul-route/design-system';
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
import { TraceStrokeGame } from '../TraceStrokeGame';

/**
 * AMENDMENTS-TRACE-IDLE TI-2 on the Trace Stroke screen (§6 tests 8–12): a pause shows the keep-going line and
 * scores nothing; a miss keeps the ink until the learner draws again or taps Clear; a pass with a tip waits for
 * Next. Design: `design/wireframes/minigame/families.md` ("Trace Stroke states"),
 * `design/screens/minigame-writing/trace-stroke.md`.
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
  return {
    Gesture: { Pan },
    GestureDetector: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));
const announce = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  announceForScreenReader: (text: string) => void announce.calls.push(text),
}));

const INK_WIDTH = 8;
const GHOST_WIDTH = 18;
const IDLE_LINE = 'Draw each line slowly. Tap Done when you finish.';
const KEEP_GOING_LINE = 'Keep going. Tap Done when you finish.';
const RETRY_LINE = 'Try again — start at the top!';
const OPEN_TIP = 'Nice! Try drawing left-to-right next time.';

/** Every host node's focus() call, by the node's accessible name (react-test-renderer has no DOM). */
const focused: string[] = [];
const nodeMock = (element: { props: Record<string, unknown> }): object => ({
  focus: () => void focused.push(String(element.props['aria-label'] ?? element.props.role ?? '')),
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  nodeType: 1,
  getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
});

type Answer = [string | number, boolean];
const answers: Answer[] = [];
const realAnswerRound = useQuestRunStore.getState().answerRound;
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  rig.current = createAudioRig({ voices: [] });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  useQuestRunStore.getState().reset();
  answers.length = 0;
  focused.length = 0;
  announce.calls.length = 0;
  useQuestRunStore.setState({
    answerRound: (key, correct, asked, hinted) => {
      answers.push([key, correct]);
      realAnswerRound(key, correct, asked, hinted);
    },
  });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useQuestRunStore.setState({ answerRound: realAnswerRound });
  useQuestRunStore.getState().reset();
  vi.useRealTimers();
});

const scopeOf = (...jamoIds: string[]): MinigameScope => ({ kind: 'trace-stroke', jamoIds, rounds: jamoIds.length });

/** Mounts the game and lays it out in a content box of `size` (390 x 760 is the roomy layout, 320 x 480 compact). */
async function play(
  scope: MinigameScope,
  onFinish: () => void = () => undefined,
  size: { width: number; height: number } = { width: 390, height: 760 },
): Promise<ReactTestRenderer> {
  const r = await render(<TraceStrokeGame scope={scope} onFinish={onFinish} />, { createNodeMock: nodeMock });
  mounted.push(r);
  for (let pass = 0; pass < 3; pass += 1) {
    const views = r.root.findAll((n) => typeof n.props.onLayout === 'function' && typeof n.type !== 'string');
    await act(async () => {
      for (const v of views) (v.props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { x: 0, y: 0, ...size } } });
    });
  }
  return r;
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

const canvas = (root: ReactTestInstance): ReactTestInstance =>
  root.find((n) => typeof n.type !== 'string' && n.props.nativeID === 'trace-canvas');
const canvasSize = (root: ReactTestInstance): number => (canvas(root).props.style as { width: number }).width;
const canvasBorder = (root: ReactTestInstance): unknown => (canvas(root).props.style as { borderColor?: unknown }).borderColor;
const ink = (root: ReactTestInstance): number => root.findAll((n) => n.type === Path && n.props.strokeWidth === INK_WIDTH).length;
/** The first guide stroke's path: tells the round's letter apart (the order of the rounds is shuffled). */
const firstGhost = (root: ReactTestInstance): string =>
  String(root.findAll((n) => n.type === Path && n.props.strokeWidth === GHOST_WIDTH)[0]!.props.d);
const texts = (root: ReactTestInstance): string[] => screenTexts(root);
const button = (root: ReactTestInstance, label: string): ReactTestInstance | undefined =>
  root.findAll((n) => n.props.label === label && typeof n.props.onPress === 'function')[0];
const press = async (root: ReactTestInstance, label: string): Promise<void> => {
  const b = button(root, label);
  expect(b, label).toBeDefined();
  await act(async () => {
    (b!.props.onPress as () => void)();
  });
};

/** One stroke through viewBox points (the canvas is 200 units across), walked in small moves, then lifted. */
async function draw(root: ReactTestInstance, points: readonly JamoStrokePoint[]): Promise<void> {
  const k = canvasSize(root) / 200;
  const at = (p: JamoStrokePoint): { x: number; y: number } => ({ x: p.x * k, y: p.y * k });
  await fire('begin');
  await fire('touchesDown', { id: 0, ...at(points[0]!) });
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    for (let j = 1; j <= 12; j += 1) await fire('touchesMove', { id: 0, ...at({ x: a.x + ((b.x - a.x) * j) / 12, y: a.y + ((b.y - a.y) * j) / 12 }) });
  }
  await fire('touchesUp', { id: 0, ...at(points[points.length - 1]!) });
  await fire('finalize');
}

/** A finger that lands and lifts without moving: a `hold`, no ink. */
async function holdNoInk(root: ReactTestInstance): Promise<void> {
  const at = { x: canvasSize(root) / 2, y: canvasSize(root) / 2 };
  await fire('begin');
  await fire('touchesDown', { id: 0, ...at });
  await fire('touchesUp', { id: 0, ...at });
  await fire('finalize');
}

const strokesOf = (id: string): JamoStrokePoint[][] => strokesForJamo(id)!;
const reversed = (stroke: readonly JamoStrokePoint[]): JamoStrokePoint[] => [...stroke].reverse();

describe('Trace Stroke: a pause on an unfinished letter (§3.2, test 8)', () => {
  it('ㅂ strokes 1–2: nothing is scored on a pause; the keep-going line shows after 3 s and Done is enabled; Done scores', async () => {
    const r = await play(scopeOf('jamo:bieup'));
    expect(texts(r.root)).toContain(IDLE_LINE);
    const [s1, s2] = strokesOf('jamo:bieup');
    await draw(r.root, s1!);
    await draw(r.root, s2!);
    await wait(TRACE_KEEP_GOING_MS - 10);
    expect(texts(r.root)).not.toContain(KEEP_GOING_LINE);
    await wait(10);
    expect(texts(r.root)).toContain(KEEP_GOING_LINE);
    // The canvas keeps its idle look: the learner did nothing wrong.
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    expect(button(r.root, 'Done')!.props.disabled).toBe(false);
    await wait(10_000);
    expect(answers).toEqual([]);
    expect(texts(r.root)).toContain(KEEP_GOING_LINE);
    await press(r.root, 'Done');
    // 0.73 coverage passes on Done.
    expect(answers).toEqual([[0, true]]);
  });

  it.each([
    ['ㅁ strokes 1–2 (0.82)', 'jamo:mieum', 2],
    ['ㅗ tick alone (0.67)', 'jamo:o', 1],
  ])('%s: no score on a pause', async (_name, id, n) => {
    const r = await play(scopeOf(id));
    for (const s of strokesOf(id).slice(0, n)) await draw(r.root, s);
    await wait(10_000);
    expect(answers).toEqual([]);
    expect(texts(r.root)).toContain(KEEP_GOING_LINE);
  });

  it('the next stroke puts the idle line back; a finger landing cancels the countdown', async () => {
    const r = await play(scopeOf('jamo:bieup'));
    const [s1, s2, s3] = strokesOf('jamo:bieup');
    await draw(r.root, s1!);
    await wait(TRACE_KEEP_GOING_MS);
    expect(texts(r.root)).toContain(KEEP_GOING_LINE);
    await draw(r.root, s2!);
    expect(texts(r.root)).toContain(IDLE_LINE);
    // A finger down (no ink yet) stops the countdown; the lift starts it again.
    await wait(TRACE_KEEP_GOING_MS - 500);
    await fire('begin');
    await fire('touchesDown', { id: 0, x: 10, y: 10 });
    await wait(TRACE_KEEP_GOING_MS);
    expect(texts(r.root)).not.toContain(KEEP_GOING_LINE);
    await fire('touchesUp', { id: 0, x: 10, y: 10 });
    await fire('finalize');
    // The lift (a release on ink) arms it again.
    await wait(TRACE_KEEP_GOING_MS);
    expect(texts(r.root)).toContain(KEEP_GOING_LINE);
    await draw(r.root, s3!);
    await wait(TRACE_KEEP_GOING_MS);
    expect(texts(r.root)).toContain(KEEP_GOING_LINE);
    expect(answers).toEqual([]);
  });

  it('the status strip\'s live region is always polite; the idle line sits outside it, the keep-going line inside', async () => {
    const r = await play(scopeOf('jamo:bieup'));
    /** The strip's live region (always mounted, so a line inserted into it is announced). */
    const region = (): ReactTestInstance =>
      r.root.find((n) => typeof n.type === 'string' && n.props['data-testid'] === 'trace-stroke-live-line');
    expect(region().props['aria-live']).toBe('polite');
    expect(texts(r.root)).toContain(IDLE_LINE);
    expect(screenTexts(region())).toEqual([]);
    await draw(r.root, strokesOf('jamo:bieup')[0]!);
    await wait(TRACE_KEEP_GOING_MS);
    expect(region().props['aria-live']).toBe('polite');
    expect(screenTexts(region())).toEqual([KEEP_GOING_LINE]);
    // iOS has no live regions: the line is also told to VoiceOver, once per pause.
    expect(announce.calls).toEqual([KEEP_GOING_LINE]);
    await press(r.root, 'Done');
    expect(screenTexts(region())).toEqual([RETRY_LINE]);
  });
});

describe('Trace Stroke: a finished letter (test 9)', () => {
  it('ㅂ, all strokes: scored as a pass TRACE_IDLE_MS after the last lift', async () => {
    const r = await play(scopeOf('jamo:bieup'));
    for (const s of strokesOf('jamo:bieup')) await draw(r.root, s);
    await wait(TRACE_IDLE_MS - 10);
    expect(answers).toEqual([]);
    await wait(10);
    expect(answers).toEqual([[0, true]]);
    expect(texts(r.root)).not.toContain(KEEP_GOING_LINE);
  });
});

describe('Trace Stroke: a miss keeps the ink (§3.3, test 10)', () => {
  it('scribble, Done: a miss; the ink and the retry line stay; a hold changes nothing; a new stroke adds to the ink; finishing passes', async () => {
    const r = await play(scopeOf('jamo:bieup'));
    const [s1, s2, s3, s4] = strokesOf('jamo:bieup');
    await draw(r.root, s1!);
    await draw(r.root, [{ x: 170, y: 170 }, { x: 190, y: 190 }]);
    await press(r.root, 'Done');
    expect(answers).toEqual([[0, false]]);
    expect(canvasBorder(r.root)).toBe(colors.feedback.nudge);
    expect(canvasBorder(r.root)).not.toBe(colors.feedback.danger);
    await wait(10_000);
    expect(ink(r.root)).toBe(2);
    expect(texts(r.root)).toContain(RETRY_LINE);
    expect(canvasBorder(r.root)).toBe(colors.feedback.nudge);
    expect(button(r.root, 'Done')!.props.disabled).toBe(true);

    await holdNoInk(r.root);
    await wait(10_000);
    expect(ink(r.root)).toBe(2);
    expect(texts(r.root)).toContain(RETRY_LINE);
    expect(canvasBorder(r.root)).toBe(colors.feedback.nudge);

    await draw(r.root, s2!);
    expect(ink(r.root)).toBe(3);
    expect(texts(r.root)).toContain(IDLE_LINE);
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    await draw(r.root, s3!);
    await draw(r.root, s4!);
    await wait(TRACE_IDLE_MS);
    expect(answers).toEqual([[0, false], [0, true]]);
    // The first try stays the miss: the pass is a retry, not a second first-try entry.
    const run = useQuestRunStore.getState();
    expect(run.tries).toHaveLength(1);
    expect(run.tries[0]!.correct).toBe(false);
    expect(run.totalCount).toBe(1);
  });
});

describe('Trace Stroke: Clear after a result opens the check again (§3.3, test 11)', () => {
  it('miss, Clear, draw the full letter, lift: a pass after TRACE_IDLE_MS', async () => {
    const r = await play(scopeOf('jamo:bieup'));
    await draw(r.root, [{ x: 170, y: 170 }, { x: 190, y: 190 }]);
    await press(r.root, 'Done');
    expect(answers).toEqual([[0, false]]);
    await press(r.root, 'Clear');
    expect(ink(r.root)).toBe(0);
    expect(texts(r.root)).toContain(IDLE_LINE);
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    for (const s of strokesOf('jamo:bieup')) await draw(r.root, s);
    await wait(TRACE_IDLE_MS);
    expect(answers).toEqual([[0, false], [0, true]]);
  });

  it('miss, Clear, draw, Done: scored', async () => {
    const r = await play(scopeOf('jamo:bieup'));
    await draw(r.root, [{ x: 170, y: 170 }, { x: 190, y: 190 }]);
    await press(r.root, 'Done');
    await press(r.root, 'Clear');
    await draw(r.root, [{ x: 10, y: 10 }, { x: 30, y: 10 }]);
    expect(button(r.root, 'Done')!.props.disabled).toBe(false);
    await press(r.root, 'Done');
    expect(answers).toEqual([[0, false], [0, false]]);
  });

  it('Clear during the keep-going line puts the idle line back', async () => {
    const r = await play(scopeOf('jamo:bieup'));
    await draw(r.root, strokesOf('jamo:bieup')[0]!);
    await wait(TRACE_KEEP_GOING_MS);
    await press(r.root, 'Clear');
    expect(texts(r.root)).toContain(IDLE_LINE);
    expect(texts(r.root)).not.toContain(KEEP_GOING_LINE);
  });
});

describe('Trace Stroke: a tip waits for Next (§3.4, test 12)', () => {
  /** Draws the round's one-stroke letter (ㄱ or ㄴ), backwards when `tip`. */
  async function drawRound(r: ReactTestRenderer, tip: boolean): Promise<string> {
    const ghost = firstGhost(r.root);
    const id = ghost.startsWith('M 40 50') ? 'jamo:giyeok' : 'jamo:nieun';
    const [stroke] = strokesOf(id);
    await draw(r.root, tip ? reversed(stroke!) : stroke!);
    return ghost;
  }

  it('a pass with pass.open: no advance; Next in Done\'s place, focused, carrying the tip; tap → next round; a clean pass advances after 1.1 s', async () => {
    const onFinish = vi.fn();
    const r = await play(scopeOf('jamo:giyeok', 'jamo:nieun'), onFinish);
    const first = await drawRound(r, true);
    await wait(TRACE_IDLE_MS);
    expect(answers).toEqual([[0, true]]);
    expect(texts(r.root)).toContain(OPEN_TIP);
    expect(button(r.root, 'Done')).toBeUndefined();
    const next = button(r.root, 'Next');
    expect(next).toBeDefined();
    expect(next!.props.accessibilityHint).toBe(OPEN_TIP);
    expect(focused).toContain('Next');
    await wait(10_000);
    expect(firstGhost(r.root)).toBe(first);
    expect(button(r.root, 'Next')).toBeDefined();

    await press(r.root, 'Next');
    expect(firstGhost(r.root)).not.toBe(first);
    expect(button(r.root, 'Next')).toBeUndefined();
    expect(button(r.root, 'Done')).toBeDefined();
    expect(texts(r.root)).toContain(IDLE_LINE);

    await drawRound(r, false);
    await wait(TRACE_IDLE_MS);
    expect(answers).toEqual([[0, true], [1, true]]);
    expect(button(r.root, 'Next')).toBeUndefined();
    await wait(1_090);
    expect(onFinish).not.toHaveBeenCalled();
    await wait(10);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['roomy', { width: 390, height: 760 }, 'lg'],
    ['compact', { width: 320, height: 480 }, 'md'],
  ])('Next has Done\'s size (%s: %s)', async (_mode, size, expected) => {
    const r = await play(scopeOf('jamo:giyeok'), undefined, size);
    const doneSize = button(r.root, 'Done')!.props.size;
    expect(doneSize).toBe(expected);
    await drawRound(r, true);
    await wait(TRACE_IDLE_MS);
    expect(button(r.root, 'Next')!.props.size).toBe(doneSize);
  });

  it('a clean pass mid-run advances after 1.1 s and focus goes to the new heading', async () => {
    const r = await play(scopeOf('jamo:giyeok', 'jamo:nieun'));
    const first = await drawRound(r, false);
    await wait(TRACE_IDLE_MS);
    expect(button(r.root, 'Next')).toBeUndefined();
    focused.length = 0;
    await wait(1_090);
    expect(firstGhost(r.root)).toBe(first);
    await wait(10);
    expect(firstGhost(r.root)).not.toBe(first);
    expect(focused.some((f) => f.startsWith('Trace'))).toBe(true);
  });

  it('Clear during a clean pass drops the advance: the round stays, open to a new try', async () => {
    const r = await play(scopeOf('jamo:giyeok', 'jamo:nieun'));
    const first = await drawRound(r, false);
    await wait(TRACE_IDLE_MS);
    await press(r.root, 'Clear');
    await wait(5_000);
    expect(firstGhost(r.root)).toBe(first);
    expect(ink(r.root)).toBe(0);
    await drawRound(r, false);
    await wait(TRACE_IDLE_MS + 1_100);
    expect(firstGhost(r.root)).not.toBe(first);
  });

  it('Clear during a tip empties the canvas and brings Done back; the check opens again', async () => {
    const r = await play(scopeOf('jamo:giyeok'));
    await drawRound(r, true);
    await wait(TRACE_IDLE_MS);
    await press(r.root, 'Clear');
    expect(ink(r.root)).toBe(0);
    expect(button(r.root, 'Next')).toBeUndefined();
    expect(button(r.root, 'Done')).toBeDefined();
    await drawRound(r, false);
    await wait(TRACE_IDLE_MS);
    expect(answers).toEqual([[0, true], [0, true]]);
  });

  it('after Next, focus goes to the new round\'s heading', async () => {
    const r = await play(scopeOf('jamo:giyeok', 'jamo:nieun'));
    await drawRound(r, true);
    await wait(TRACE_IDLE_MS);
    focused.length = 0;
    await press(r.root, 'Next');
    expect(focused.some((f) => f.startsWith('Trace'))).toBe(true);
  });
});
