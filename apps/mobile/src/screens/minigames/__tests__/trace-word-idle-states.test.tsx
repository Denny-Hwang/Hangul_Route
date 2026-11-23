import { colors } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Path } from 'react-native-svg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strokesForJamo, type JamoStrokePoint } from '../../../content/jamo-strokes';
import type { MinigameScope } from '../../../logic/minigame-config';
import { TRACE_IDLE_MS } from '../../../logic/trace-evaluator';
import { TRACE_KEEP_GOING_MS } from '../../../logic/trace-ready';
import { BLOCK_VIEWBOX, placeBlockStrokes, type PlacedBlock } from '../../../logic/trace-word/block-strokes';
import { createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { render, screenTexts, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { TraceWordGame } from '../TraceWordGame';

/**
 * AMENDMENTS-TRACE-IDLE TI-3 on the Trace a Word screen: letter mode and block mode on the §3.1 rule (a pause
 * scores only a finished letter or block), the keep-going line (§3.2), a miss keeps the ink with no `RETRY_MS`
 * wipe (§3.3), a pass with a tip waits for Next (§3.4). Design: `design/wireframes/minigame/families.md`
 * ("Trace Stroke states": "TI-3 applies the same states to Trace a Word").
 *
 * TI-3b (owner decisions 2026-11-23, §10): a tip on the last letter or block of a word waits for Next too and the
 * word-done line follows (OD-TI6); while Next shows, the controls under the canvas scroll (OD-TI7); a tip is
 * announced once (the live region carries it, Next has no hint repeating it).
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
// [SO] AMENDMENTS-STROKE-ORDER-STANDARD SO-1: only a unit whose every jamo a person has checked coaches order (none is
// yet). These TI-3 cases play units as taught, the way they will be after SO-3, so the order tip is still there to wait
// for Next; the untaught screen is checked in trace-shape-guide.test.tsx.
vi.mock('../../../logic/stroke-order-taught', () => ({ strokeOrderTaught: () => true, unitOrderTaught: () => true }));
const announce = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  announceForScreenReader: (text: string) => void announce.calls.push(text),
}));

const copy = getMessages('en').learner.minigame;
const INK_WIDTH = 8;
const BLOCK_IDLE = copy.traceWord.idle;
const LETTER_IDLE = copy.traceWord.letterIdle;
const KEEP_GOING = copy.trace.keepGoing;
const RETRY = copy.trace.retry.start;
const ORDER_TIP = copy.trace.pass.order;
const WORD_DONE = copy.traceWord.wordDone;
/** The word-done view's pause before the next word (`WORD_DONE_MS`). */
const WORD_DONE_MS = 1_600;
/** The traced word drawn small in a done chip (`CHIP_INK_WIDTH`). */
const CHIP_INK_WIDTH = 14;
/** The content height the controls' scroll node reports (react-test-renderer has no layout). */
const CONTROLS_SCROLL_HEIGHT = 900;

/** Every host node's focus() call, by the node's accessible name (react-test-renderer has no DOM). */
const focused: string[] = [];
/** Every scroll of a host node, by its test id: a ScrollView's scrollToEnd lands here on the web. */
const scrolls: Array<{ id: string; top: number }> = [];
/** Every host node made, by its test id: a live region made twice would be a new region (its first line unsaid). */
const made: string[] = [];
const nodeMock = (element: { props: Record<string, unknown> }): object => {
  made.push(String(element.props['data-testid'] ?? ''));
  return {
    focus: () => void focused.push(String(element.props['aria-label'] ?? element.props.role ?? '')),
    scroll: ({ top }: { top: number }) => void scrolls.push({ id: String(element.props['data-testid'] ?? ''), top }),
    scrollHeight: CONTROLS_SCROLL_HEIGHT,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    nodeType: 1,
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
  };
};

const answers: Array<[string | number, boolean]> = [];
let completed = 0;
const host: MinigameHost = {
  mode: 'quest',
  answer: (key, correct) => void answers.push([key, correct]),
  complete: () => void (completed += 1),
};
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  rig.current = createAudioRig({ voices: [] });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  answers.length = 0;
  completed = 0;
  focused.length = 0;
  scrolls.length = 0;
  made.length = 0;
  announce.calls.length = 0;
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

const scopeOf = (ko: string, mode: 'block' | 'letter'): MinigameScope => ({
  kind: 'trace-word',
  rounds: 1,
  traceWord: { rounds: [{ id: 'w', word: { ko, romanization: 'w', en: 'w' }, mode }] },
});

async function play(scope: MinigameScope, size: { width: number; height: number } = { width: 390, height: 760 }): Promise<ReactTestRenderer> {
  const r = await render(<TraceWordGame scope={scope} host={host} />, { createNodeMock: nodeMock });
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
const canvasLabel = (root: ReactTestInstance): string => String(canvas(root).props.accessibilityLabel);
/** The learner's ink on the live canvas. */
const ink = (root: ReactTestInstance): number =>
  canvas(root).findAll((n) => n.type === Path && n.props.strokeWidth === INK_WIDTH).length;
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

/** One stroke through block viewBox points, walked in small moves, then lifted. */
async function draw(root: ReactTestInstance, points: readonly JamoStrokePoint[]): Promise<void> {
  const k = canvasSize(root) / BLOCK_VIEWBOX;
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
const drawAll = async (root: ReactTestInstance, strokes: readonly JamoStrokePoint[][]): Promise<void> => {
  for (const s of strokes) await draw(root, s);
};

/** A finger that lands and lifts without moving: a `hold`, no ink. */
async function holdNoInk(root: ReactTestInstance): Promise<void> {
  const at = { x: canvasSize(root) / 2, y: canvasSize(root) / 2 };
  await fire('begin');
  await fire('touchesDown', { id: 0, ...at });
  await fire('touchesUp', { id: 0, ...at });
  await fire('finalize');
}

const place = (syllable: string): PlacedBlock => placeBlockStrokes(syllable, strokesForJamo)!;
/** 바: ㅂ (4 strokes) then ㅏ (2). */
const BA = place('바');
const BIEUP = BA.letters[0]!.strokes;
const A = BA.letters[1]!.strokes;

describe('Trace a Word, letter mode: a pause on an unfinished letter (§3.1, §3.2)', () => {
  it('ㅂ strokes 1–2: nothing is scored on a pause; the keep-going line shows after 3 s and Done is enabled; Done scores', async () => {
    const r = await play(scopeOf('바', 'letter'));
    expect(texts(r.root)).toContain(LETTER_IDLE);
    await drawAll(r.root, BIEUP.slice(0, 2));
    await wait(TRACE_KEEP_GOING_MS - 10);
    expect(texts(r.root)).not.toContain(KEEP_GOING);
    await wait(10);
    expect(texts(r.root)).toContain(KEEP_GOING);
    expect(announce.calls).toEqual([KEEP_GOING]);
    // The canvas keeps its live look: the learner did nothing wrong.
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    expect(button(r.root, 'Done')!.props.disabled).toBe(false);
    await wait(10_000);
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    expect(canvasLabel(r.root)).toContain('letter 1 of 2');
    expect(texts(r.root)).toContain(KEEP_GOING);
    // Done scores it: half a ㅂ does not pass at block size, so the amber retry.
    await press(r.root, 'Done');
    expect(texts(r.root)).toContain(RETRY);
    expect(canvasBorder(r.root)).toBe(colors.feedback.nudge);
  });

  it('ㅂ, every stroke: scored as a pass TRACE_IDLE_MS after the last lift; no keep-going line', async () => {
    const r = await play(scopeOf('바', 'letter'));
    await drawAll(r.root, BIEUP);
    await wait(TRACE_IDLE_MS - 10);
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    await wait(10);
    expect(canvasBorder(r.root)).toBe(colors.feedback.success);
    expect(texts(r.root)).not.toContain(KEEP_GOING);
    // A clean letter pass moves to the next letter after the pass pause.
    await wait(1_100);
    expect(canvasLabel(r.root)).toContain('letter 2 of 2');
    expect(texts(r.root)).toContain(LETTER_IDLE);
  });

  it('a finished ㅂ with a stray stroke beside it: a pause never records the miss; the keep-going line names Done', async () => {
    const r = await play(scopeOf('바', 'letter'));
    await drawAll(r.root, BIEUP);
    await draw(r.root, [{ x: 150, y: 175 }, { x: 195, y: 195 }]);
    await wait(10_000);
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    expect(texts(r.root)).not.toContain(RETRY);
    expect(texts(r.root)).toContain(KEEP_GOING);
    expect(button(r.root, 'Done')!.props.disabled).toBe(false);
  });

  it('a clean letter pass moves on by itself and focus goes to the heading', async () => {
    const r = await play(scopeOf('바', 'letter'));
    await drawAll(r.root, BIEUP);
    await wait(TRACE_IDLE_MS);
    focused.length = 0;
    await wait(1_100);
    expect(canvasLabel(r.root)).toContain('letter 2 of 2');
    expect(focused.some((f) => f.startsWith('Trace the word'))).toBe(true);
  });

  it('the next stroke puts the idle line back; the idle line sits outside the polite live region', async () => {
    const r = await play(scopeOf('바', 'letter'));
    const region = (): ReactTestInstance =>
      r.root.find((n) => typeof n.type === 'string' && n.props['data-testid'] === 'trace-word-live-line');
    expect(region().props['aria-live']).toBe('polite');
    expect(screenTexts(region())).toEqual([]);
    await draw(r.root, BIEUP[0]!);
    await wait(TRACE_KEEP_GOING_MS);
    expect(screenTexts(region())).toEqual([KEEP_GOING]);
    await draw(r.root, BIEUP[1]!);
    expect(texts(r.root)).toContain(LETTER_IDLE);
    expect(screenTexts(region())).toEqual([]);
    // A finger down stops the countdown.
    await wait(TRACE_KEEP_GOING_MS - 500);
    await fire('begin');
    await fire('touchesDown', { id: 0, x: 10, y: 10 });
    await wait(TRACE_KEEP_GOING_MS);
    expect(texts(r.root)).not.toContain(KEEP_GOING);
    await fire('touchesUp', { id: 0, x: 10, y: 10 });
    await fire('finalize');
    await wait(TRACE_KEEP_GOING_MS);
    expect(texts(r.root)).toContain(KEEP_GOING);
  });
});

describe('Trace a Word, block mode: every letter finished, not only inked (§3.1)', () => {
  it('바 with half a ㅂ and the whole ㅏ: every zone has ink, yet a pause scores nothing; finishing ㅂ scores it', async () => {
    const r = await play(scopeOf('바', 'block'));
    expect(texts(r.root)).toContain(BLOCK_IDLE);
    await drawAll(r.root, BIEUP.slice(0, 2));
    await drawAll(r.root, A);
    await wait(10_000);
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    expect(texts(r.root)).toContain(KEEP_GOING);
    expect(answers).toEqual([]);
    await drawAll(r.root, BIEUP.slice(2));
    await wait(TRACE_IDLE_MS);
    // Strokes out of writing order still pass (order only coaches), so the word is done: one first-try answer.
    expect(answers).toEqual([[0, true]]);
  });
});

describe('Trace a Word: a miss keeps the ink (§3.3)', () => {
  it('letter mode: Done on half a ㅂ; the ink and the retry line stay; a hold changes nothing; a new stroke adds; finishing passes', async () => {
    const r = await play(scopeOf('바', 'letter'));
    await drawAll(r.root, BIEUP.slice(0, 2));
    await press(r.root, 'Done');
    expect(canvasBorder(r.root)).toBe(colors.feedback.nudge);
    expect(canvasBorder(r.root)).not.toBe(colors.feedback.danger);
    await wait(10_000);
    expect(ink(r.root)).toBe(2);
    expect(texts(r.root)).toContain(RETRY);
    expect(canvasBorder(r.root)).toBe(colors.feedback.nudge);
    expect(button(r.root, 'Done')!.props.disabled).toBe(true);
    expect(button(r.root, 'Clear')!.props.disabled).toBe(false);
    expect(button(r.root, 'Show me')!.props.disabled).toBe(false);

    await holdNoInk(r.root);
    await wait(10_000);
    expect(ink(r.root)).toBe(2);
    expect(texts(r.root)).toContain(RETRY);

    await draw(r.root, BIEUP[2]!);
    expect(ink(r.root)).toBe(3);
    expect(texts(r.root)).toContain(LETTER_IDLE);
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    await draw(r.root, BIEUP[3]!);
    await wait(TRACE_IDLE_MS);
    expect(canvasBorder(r.root)).toBe(colors.feedback.success);
    await wait(1_100);
    await drawAll(r.root, A);
    await wait(TRACE_IDLE_MS);
    // The round answers once, when the word is done: not first try.
    expect(answers).toEqual([[0, false]]);
  });

  it('block mode: miss, Clear, draw the whole block, lift: a pass after TRACE_IDLE_MS', async () => {
    const r = await play(scopeOf('바', 'block'));
    await draw(r.root, [{ x: 170, y: 170 }, { x: 190, y: 190 }]);
    await press(r.root, 'Done');
    expect(texts(r.root)).toContain(RETRY);
    await press(r.root, 'Clear');
    expect(ink(r.root)).toBe(0);
    expect(texts(r.root)).toContain(BLOCK_IDLE);
    expect(canvasBorder(r.root)).toBe(colors.brand.primary);
    await drawAll(r.root, [...BIEUP, ...A]);
    await wait(TRACE_IDLE_MS);
    expect(answers).toEqual([[0, false]]);
  });

  it('miss, Clear, draw, Done: scored again', async () => {
    const r = await play(scopeOf('바', 'block'));
    await draw(r.root, [{ x: 170, y: 170 }, { x: 190, y: 190 }]);
    await press(r.root, 'Done');
    await press(r.root, 'Clear');
    await draw(r.root, [{ x: 10, y: 10 }, { x: 30, y: 10 }]);
    expect(button(r.root, 'Done')!.props.disabled).toBe(false);
    await press(r.root, 'Done');
    expect(texts(r.root)).toContain(RETRY);
  });
});

describe('Trace a Word: a tip waits for Next (§3.4)', () => {
  it('letter mode: ㅂ drawn out of order passes with the order tip; Next in Done\'s place, focused; no advance; tap → next letter', async () => {
    const r = await play(scopeOf('바', 'letter'));
    await drawAll(r.root, [...BIEUP].reverse());
    await wait(TRACE_IDLE_MS);
    expect(canvasBorder(r.root)).toBe(colors.feedback.success);
    expect(texts(r.root)).toContain(ORDER_TIP);
    expect(button(r.root, 'Done')).toBeUndefined();
    const next = button(r.root, 'Next');
    expect(next).toBeDefined();
    // TI-3b: the live region carries the tip; Next has no hint repeating it.
    expect(next!.props.accessibilityHint).toBeUndefined();
    expect(focused).toContain('Next');
    await wait(10_000);
    expect(canvasLabel(r.root)).toContain('letter 1 of 2');
    expect(texts(r.root)).toContain(ORDER_TIP);

    focused.length = 0;
    await press(r.root, 'Next');
    expect(canvasLabel(r.root)).toContain('letter 2 of 2');
    expect(button(r.root, 'Next')).toBeUndefined();
    expect(button(r.root, 'Done')).toBeDefined();
    expect(texts(r.root)).toContain(LETTER_IDLE);
    expect(focused.some((f) => f.startsWith('Trace the word'))).toBe(true);
    // The first letter's ink stays on the canvas under the second.
    expect(ink(r.root)).toBe(4);
  });

  it.each([
    ['roomy', { width: 390, height: 760 }, 'lg'],
    ['compact', { width: 320, height: 480 }, 'md'],
  ])('Next has Done\'s size (%s)', async (_mode, size, expected) => {
    const r = await play(scopeOf('바', 'letter'), size);
    expect(button(r.root, 'Done')!.props.size).toBe(expected);
    await drawAll(r.root, [...BIEUP].reverse());
    await wait(TRACE_IDLE_MS);
    expect(button(r.root, 'Next')!.props.size).toBe(expected);
  });

  it('block mode, a two-block word: a block pass with a tip waits for Next; a clean last block shows the word and moves on', async () => {
    const r = await play(scopeOf('바바', 'block'));
    await drawAll(r.root, [...A, ...BIEUP]);
    await wait(TRACE_IDLE_MS);
    expect(texts(r.root)).toContain(ORDER_TIP);
    await wait(10_000);
    expect(canvasLabel(r.root)).toContain('block 1 of 2');
    await press(r.root, 'Next');
    expect(canvasLabel(r.root)).toContain('block 2 of 2');
    await drawAll(r.root, [...BIEUP, ...A]);
    await wait(TRACE_IDLE_MS);
    expect(answers).toEqual([[0, true]]);
    expect(texts(r.root)).toContain(WORD_DONE);
    expect(button(r.root, 'Next')).toBeUndefined();
    await wait(WORD_DONE_MS);
    expect(completed).toBe(1);
  });
});

/** Two one-block words in one step, so the word after the word-done view can be told apart by its heading. */
const twoWords = (mode: 'block' | 'letter'): MinigameScope => ({
  kind: 'trace-word',
  rounds: 2,
  traceWord: {
    rounds: [
      { id: 'w1', word: { ko: '바', romanization: 'ba', en: 'first' }, mode },
      { id: 'w2', word: { ko: '바', romanization: 'ba', en: 'second' }, mode },
    ],
  },
});
/** The word heading's accessible name (it names the word's English gloss). */
const heading = (root: ReactTestInstance): string =>
  String(
    root.findAll((n) => typeof n.type !== 'string' && n.props.accessibilityRole === 'header' && typeof n.props.accessibilityLabel === 'string')[0]!
      .props.accessibilityLabel,
  );
/** The learner's strokes drawn small in the strip's done chips: only the word-done view shows them. */
const chipInk = (root: ReactTestInstance): number => root.findAll((n) => n.type === Path && n.props.strokeWidth === CHIP_INK_WIDTH).length;

describe('Trace a Word: a tip on the last letter or block also waits for Next (TI-3b, OD-TI6)', () => {
  it('block mode: the last block passes with the order tip; Next, focused; no word-done line and no advance; Next → the word-done line, then the next word', async () => {
    const r = await play(twoWords('block'));
    expect(heading(r.root)).toContain('first');
    await drawAll(r.root, [...A, ...BIEUP]);
    await wait(TRACE_IDLE_MS);
    // The pass is recorded at once; the tip waits for Next.
    expect(answers).toEqual([[0, true]]);
    expect(texts(r.root)).toContain(ORDER_TIP);
    expect(texts(r.root)).not.toContain(WORD_DONE);
    expect(button(r.root, 'Next')).toBeDefined();
    expect(button(r.root, 'Done')).toBeUndefined();
    expect(focused).toContain('Next');
    // The strip shows the word traced only with the word-done line.
    expect(chipInk(r.root)).toBe(0);
    expect(canvasBorder(r.root)).toBe(colors.feedback.success);
    await wait(10_000);
    expect(heading(r.root)).toContain('first');
    expect(texts(r.root)).toContain(ORDER_TIP);
    // OD-TI5 (a recorded departure): Clear stays off while Next shows in Trace a Word.
    expect(button(r.root, 'Clear')!.props.disabled).toBe(true);

    focused.length = 0;
    await press(r.root, 'Next');
    expect(texts(r.root)).toContain(WORD_DONE);
    expect(texts(r.root)).not.toContain(ORDER_TIP);
    expect(button(r.root, 'Next')).toBeUndefined();
    expect(chipInk(r.root)).toBe(BIEUP.length + A.length);
    // Next is gone: focus goes to the word's heading, not lost.
    expect(focused.some((f) => f.startsWith('Trace the word'))).toBe(true);
    await wait(WORD_DONE_MS - 10);
    expect(heading(r.root)).toContain('first');
    await wait(10);
    expect(heading(r.root)).toContain('second');
    expect(texts(r.root)).toContain(BLOCK_IDLE);
    expect(chipInk(r.root)).toBe(0);
    // One answer for the first word: the tip and Next record nothing more.
    expect(answers).toEqual([[0, true]]);
  });

  it('letter mode: a tip on the last letter of the word waits for Next; the word-done line follows; the last word then completes the step', async () => {
    const r = await play(scopeOf('바', 'letter'));
    await drawAll(r.root, BIEUP);
    await wait(TRACE_IDLE_MS + 1_100);
    expect(canvasLabel(r.root)).toContain('letter 2 of 2');
    await drawAll(r.root, [...A].reverse());
    await wait(TRACE_IDLE_MS);
    expect(answers).toEqual([[0, true]]);
    expect(texts(r.root)).toContain(ORDER_TIP);
    expect(texts(r.root)).not.toContain(WORD_DONE);
    expect(button(r.root, 'Next')).toBeDefined();
    await wait(10_000);
    expect(completed).toBe(0);

    await press(r.root, 'Next');
    expect(texts(r.root)).toContain(WORD_DONE);
    await wait(WORD_DONE_MS - 10);
    expect(completed).toBe(0);
    await wait(10);
    expect(completed).toBe(1);
  });

  it('Skip while the last tip shows ends the step; the word\'s answer is already recorded', async () => {
    const r = await play(scopeOf('바', 'block'));
    await drawAll(r.root, [...A, ...BIEUP]);
    await wait(TRACE_IDLE_MS);
    expect(button(r.root, 'Next')).toBeDefined();
    await press(r.root, copy.skip.cta);
    expect(completed).toBe(1);
    expect(answers).toEqual([[0, true]]);
    await wait(10_000);
    expect(completed).toBe(1);
  });
});

describe('Trace a Word: a tip is announced once (TI-3b)', () => {
  const region = (root: ReactTestInstance): ReactTestInstance =>
    root.find((n) => typeof n.type === 'string' && n.props['data-testid'] === 'trace-word-live-line');

  it.each([
    ['a letter tip', 'letter' as const],
    ['the last block\'s tip', 'block' as const],
  ])('%s: the live region carries it, Next has no hint, VoiceOver is told once', async (_name, mode) => {
    const r = await play(scopeOf('바', mode));
    await drawAll(r.root, mode === 'letter' ? [...BIEUP].reverse() : [...A, ...BIEUP]);
    await wait(TRACE_IDLE_MS);
    expect(screenTexts(region(r.root))).toEqual([ORDER_TIP]);
    expect(button(r.root, 'Next')!.props.accessibilityHint).toBeUndefined();
    // Once on screen and to a screen reader: not again as a hint.
    expect(texts(r.root).filter((t) => t === ORDER_TIP)).toHaveLength(1);
    // iOS has no live regions: VoiceOver is told the tip once (a no-op elsewhere).
    expect(announce.calls).toEqual([ORDER_TIP]);
    await wait(10_000);
    expect(announce.calls).toEqual([ORDER_TIP]);
    // The live region is the one made at mount: it was never made again, so the tip inserted into it is said.
    expect(made.filter((id) => id === 'trace-word-live-line')).toHaveLength(1);
  });

  it('a clean pass tells VoiceOver nothing extra', async () => {
    const r = await play(scopeOf('바', 'letter'));
    await drawAll(r.root, BIEUP);
    await wait(TRACE_IDLE_MS);
    expect(texts(r.root)).toContain(copy.trace.pass.clean);
    expect(announce.calls).toEqual([]);
  });
});

describe('Trace a Word: the controls under the canvas scroll while Next shows (TI-3b, OD-TI7)', () => {
  const controls = (root: ReactTestInstance): ReactTestInstance =>
    root.find((n) => n.type === ScrollView && n.props.testID === 'trace-word-controls');
  const flat = (style: unknown): Record<string, unknown> =>
    Object.assign({}, ...[style].flat(Infinity as 1).filter((s): s is object => typeof s === 'object' && s !== null));
  /** The canvas's place in the column: the slot, or the row of the slot and the helpers beside it on a short phone. */
  const canvasRow = (root: ReactTestInstance): ReactTestInstance =>
    root.findAll((n) => typeof n.type !== 'string' && n.props.testID === 'trace-word-canvas-row')[0] ??
    root.find((n) => typeof n.type !== 'string' && n.props.testID === 'trace-word-canvas-slot');
  const liveLine = (root: ReactTestInstance): ReactTestInstance =>
    root.find((n) => typeof n.type === 'string' && n.props['data-testid'] === 'trace-word-live-line');
  const layOut = async (node: ReactTestInstance, height: number): Promise<void> => {
    await act(async () => {
      (node.props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height } } });
    });
  };

  it.each([
    ['roomy', { width: 390, height: 760 }],
    ['compact', { width: 320, height: 568 }],
    ['compact, helpers beside the canvas', { width: 320, height: 480 }],
    ['side', { width: 568, height: 320 }],
  ])('%s: still while drawing; a pass with a tip scrolls them, Next and Skip inside, the canvas keeps its size, a layout scrolls to Next', async (_name, size) => {
    const r = await play(scopeOf('바', 'letter'), size);
    const regionBefore = liveLine(r.root);
    expect(controls(r.root).props.scrollEnabled).toBe(false);
    expect(flat(controls(r.root).props.style).flexShrink).toBe(0);
    expect(flat(canvasRow(r.root).props.style).minHeight).toBe(0);
    // Drawing: a layout of the controls scrolls nothing.
    await layOut(controls(r.root), 100);
    expect(scrolls).toEqual([]);

    await drawAll(r.root, [...BIEUP].reverse());
    await wait(TRACE_IDLE_MS);
    const c = controls(r.root);
    expect(c.props.scrollEnabled).toBe(true);
    expect(flat(c.props.style).flexShrink).toBe(1);
    // Room for a focus ring the scroll container would clip at its edges; negative margins keep the column's size.
    expect(flat(c.props.contentContainerStyle).padding).toBeGreaterThan(0);
    expect(flat(c.props.style).margin).toBe(-(flat(c.props.contentContainerStyle).padding as number));
    expect(c.findAll((n) => n.props.label === 'Next' && typeof n.props.onPress === 'function')).toHaveLength(1);
    expect(c.findAll((n) => n.props.label === copy.skip.cta && typeof n.props.onPress === 'function')).toHaveLength(1);
    expect(screenTexts(c)).toContain(ORDER_TIP);
    // The canvas does not give up its size to the controls: they scroll instead.
    expect(flat(canvasRow(r.root).props.style).minHeight).toBe(canvasSize(r.root));
    // The controls scroll to their end (Next) when they lay out short, and when their content grows.
    await layOut(c, 100);
    expect(scrolls).toEqual([{ id: 'trace-word-controls', top: CONTROLS_SCROLL_HEIGHT }]);
    await act(async () => {
      (c.props.onContentSizeChange as (w: number, h: number) => void)(300, 400);
    });
    expect(scrolls).toHaveLength(2);
    // The live region is the same node all along (the scroll container never remounts it).
    expect(liveLine(r.root)).toBe(regionBefore);

    await press(r.root, 'Next');
    expect(controls(r.root).props.scrollEnabled).toBe(false);
    expect(flat(controls(r.root).props.style).flexShrink).toBe(0);
    expect(flat(canvasRow(r.root).props.style).minHeight).toBe(0);
    await layOut(controls(r.root), 100);
    expect(scrolls).toHaveLength(2);
    expect(liveLine(r.root)).toBe(regionBefore);
  });

  it('the last unit\'s tip scrolls them too; the word-done line after Next does not', async () => {
    const r = await play(scopeOf('바', 'block'), { width: 320, height: 568 });
    await drawAll(r.root, [...A, ...BIEUP]);
    await wait(TRACE_IDLE_MS);
    expect(controls(r.root).props.scrollEnabled).toBe(true);
    await press(r.root, 'Next');
    expect(texts(r.root)).toContain(WORD_DONE);
    expect(controls(r.root).props.scrollEnabled).toBe(false);
  });
});

