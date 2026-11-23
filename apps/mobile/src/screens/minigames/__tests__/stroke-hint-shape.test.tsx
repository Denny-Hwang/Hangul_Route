import { getMessages } from '@hangul-route/i18n';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strokesForJamo } from '../../../content/jamo-strokes';
import { motion } from '@hangul-route/design-system';
import { shapeHoldMs, StrokeHint } from '../../../components/StrokeHint';
import { render, screenTexts } from '../../../test-support/render';

/**
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §6 test 8 (StrokeHint part): Show me on an untaught letter is a shape reveal
 * (one shared value fades every stroke in together; no walking dot), its reduced-motion still has no numerals and no
 * arrows, its label is `shape(romanization)`, and it draws no caption (the game screen's strip carries it). A taught
 * letter keeps today's demo. Design: `design/screens/minigame-writing/trace-stroke-shape-guide.md`.
 */

/** Every shared value made, and every animated element with the worklet it reads. */
const anim = vi.hoisted(() => ({ shared: [] as { value: unknown }[], timings: [] as unknown[] }));
vi.mock('react-native-reanimated', async () => {
  const { View } = await import('react-native');
  const { useRef } = await import('react');
  const easing = (): ((t: number) => number) => (t: number) => t;
  const Easing = new Proxy({}, { get: () => easing });
  const createAnimatedComponent = (Comp: ComponentType<Record<string, unknown>>) =>
    function Animated(props: Record<string, unknown> & { children?: ReactNode }) {
      return createElement(Comp, { ...props, 'data-animated': true });
    };
  return {
    default: { View, createAnimatedComponent },
    createAnimatedComponent,
    Easing,
    runOnJS: <F,>(fn: F) => fn,
    // The worklet is called by the test; a dependency list (ShapeReveal's `[progress, look]`, read by Reanimated on the
    // web without its Babel plugin) is not checked here.
    useAnimatedProps: (fn: () => object) => ({ worklet: fn }),
    // One value per mounted hint, as Reanimated's: a re-render (a new canvas look) does not make a new one.
    useSharedValue: <T,>(value: T) => {
      const ref = useRef<{ value: T } | null>(null);
      if (ref.current === null) {
        ref.current = { value };
        anim.shared.push(ref.current);
      }
      return ref.current;
    },
    withDelay: <T,>(_ms: number, value: T) => value,
    withSequence: <T,>(...values: T[]) => values[values.length - 1],
    withTiming: <T,>(value: T, config?: unknown) => {
      anim.timings.push(config);
      return value;
    },
  };
});

const O = strokesForJamo('jamo:o')!;
const MIEUM = strokesForJamo('jamo:mieum')!;

let reduced: boolean | 'fails' = false;
beforeEach(() => {
  anim.shared.length = 0;
  anim.timings.length = 0;
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() =>
    reduced === 'fails' ? Promise.reject(new Error('no query')) : Promise.resolve(reduced),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  reduced = false;
});

const animated = (root: ReactTestInstance): ReactTestInstance[] =>
  root.findAll((n) => typeof n.type !== 'string' && n.props['data-animated'] === true);
const paths = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === Path);
const circles = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === Circle);
const numerals = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === SvgText);
const labels = (root: ReactTestInstance): string[] =>
  root.findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel as string);

describe('StrokeHint, untaught letter: the shape reveal', () => {
  it('every stroke sits in one animated group, read from one shared value; no dot walks', async () => {
    const r = await render(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught={false} romanization="m" />);
    const group = animated(r.root);
    expect(group).toHaveLength(1);
    expect(group[0]!.type).toBe(G);
    // The strokes are plain paths inside the group: none animates on its own.
    expect(group[0]!.findAll((n) => n.type === Path)).toHaveLength(MIEUM.length);
    expect(paths(r.root).every((n) => n.props['data-animated'] !== true)).toBe(true);
    expect(circles(r.root)).toHaveLength(0);
    // The group fades to the hint look (0.6) as a whole.
    const props = (group[0]!.props.animatedProps as { worklet: () => { opacity: number } }).worklet();
    expect(props.opacity).toBeCloseTo(0.6);
    expect(paths(r.root).every((n) => n.props.strokeOpacity === undefined && n.props.opacity === undefined)).toBe(true);
  });

  it('fades in over motion.duration.crawl and holds the shape at least 1000 ms (SO-0c timing)', async () => {
    await render(<StrokeHint target={O} size={200} playToken={1} orderTaught={false} romanization="o" />);
    expect(anim.timings[0]).toMatchObject({ duration: motion.duration.crawl });
    expect(shapeHoldMs(1)).toBe(1000);
    expect(shapeHoldMs(2)).toBe(1000);
    expect(shapeHoldMs(3)).toBe(2 * motion.duration.crawl + 100);
  });

  it('reads one label, "o, shape guide.", and shows no caption', async () => {
    const r = await render(<StrokeHint target={O} size={200} playToken={1} orderTaught={false} romanization="o" />);
    expect(labels(r.root)).toEqual(['o, shape guide.']);
    expect(screenTexts(r.root).filter((t) => /shape guide/i.test(t) && t !== 'o, shape guide.')).toEqual([]);
    expect(screenTexts(r.root)).not.toContain('Shape guide');
  });

  it('reads a slash in the romanization as "or"', async () => {
    const r = await render(<StrokeHint target={strokesForJamo('jamo:ieung')!} size={200} playToken={1} orderTaught={false} romanization="silent/ng" />);
    expect(labels(r.root)).toEqual(['silent or ng, shape guide.']);
  });
});

/**
 * [SO] Row SO-1b, OD-SO9: on the retry canvas (`feedback.nudgeLight`) the hint look at 0.6 is about 1.3:1, so while the
 * canvas is in its retry look the shape reveal (and its reduced-motion still) draws the group at full opacity.
 */
describe('StrokeHint, untaught letter: the reveal on the retry canvas (OD-SO9)', () => {
  const groupOpacity = (root: ReactTestInstance): number =>
    (animated(root)[0]!.props.animatedProps as { worklet: () => { opacity: number } }).worklet().opacity;

  it('the group reaches full opacity in the retry look, and the hint look (0.6) otherwise', async () => {
    const retry = await render(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught={false} romanization="m" retryLook />);
    expect(groupOpacity(retry.root)).toBeCloseTo(1);
    const idle = await render(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught={false} romanization="m" retryLook={false} />);
    expect(groupOpacity(idle.root)).toBeCloseTo(0.6);
  });

  it('a reveal that is up when the canvas turns to (or leaves) the retry look follows it, without starting again', async () => {
    const r = await render(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught={false} romanization="m" />);
    expect(groupOpacity(r.root)).toBeCloseTo(0.6);
    const timings = anim.timings.length;
    await act(async () => r.update(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught={false} romanization="m" retryLook />));
    expect(groupOpacity(r.root)).toBeCloseTo(1);
    await act(async () => r.update(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught={false} romanization="m" retryLook={false} />));
    expect(groupOpacity(r.root)).toBeCloseTo(0.6);
    // No new fade-in: the reveal did not restart.
    expect(anim.timings.length).toBe(timings);
  });

  it.each([true, 'fails'] as const)('the still letter is at full opacity in the retry look (reduced motion: %s)', async (mode) => {
    reduced = mode;
    const r = await render(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught={false} romanization="m" retryLook />);
    expect(r.root.findAll((n) => n.type === G).map((g) => g.props.opacity)).toEqual([1]);
    const idle = await render(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught={false} romanization="m" />);
    expect(idle.root.findAll((n) => n.type === G).map((g) => g.props.opacity)).toEqual([0.6]);
  });

  it('a taught letter keeps today\'s demo: the retry look changes nothing in it', async () => {
    const trails = async (retryLook: boolean): Promise<number[]> => {
      const r = await render(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught romanization="m" retryLook={retryLook} />);
      expect(r.root.findAll((n) => n.type === G)).toHaveLength(0);
      return animated(r.root)
        .filter((n) => n.type === Path)
        .map((n) => (n.props.animatedProps as { worklet: () => { opacity: number } }).worklet().opacity);
    };
    expect(await trails(true)).toEqual(await trails(false));
  });
});

/** [SO] Row SO-1b, OD-SO10: the label's "or" is the word of the labels' own language. */
describe('StrokeHint, untaught letter: the "or" of the label (OD-SO10)', () => {
  const IEUNG = strokesForJamo('jamo:ieung')!;
  it.each([
    ['es', 'silent o ng, guía de la forma.'],
    ['ko', 'silent 또는 ng, 모양 안내.'],
  ] as const)('%s labels read the alternatives with their own word', async (locale, want) => {
    const m = getMessages(locale);
    const r = await render(
      <StrokeHint target={IEUNG} size={200} playToken={1} orderTaught={false} romanization="silent/ng" strokeOrder={m.a11y.minigame.strokeOrder} romanizationOr={m.a11y.romanizationOr} />,
    );
    expect(labels(r.root)).toEqual([want]);
  });
});

describe('StrokeHint, untaught letter: reduced motion', () => {
  it.each([true, 'fails'] as const)('the still letter has no numbered badges and no arrows (reduced motion: %s)', async (mode) => {
    reduced = mode;
    const r = await render(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught={false} romanization="m" />);
    expect(numerals(r.root)).toHaveLength(0);
    expect(circles(r.root)).toHaveLength(0);
    // Only the letter's own strokes: no arrow paths.
    expect(paths(r.root)).toHaveLength(MIEUM.length);
    expect(labels(r.root)).toContain('m, shape guide. Tap to close.');
    expect(screenTexts(r.root).join(' ')).not.toMatch(/Stroke order/);
  });
});

describe('StrokeHint, taught letter: today\'s demo', () => {
  it('walks a dot over each stroke in order, one trail per stroke', async () => {
    const r = await render(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught romanization="m" />);
    expect(circles(r.root)).toHaveLength(MIEUM.length);
    expect(animated(r.root).filter((n) => n.type === Path)).toHaveLength(MIEUM.length);
  });
  it('its still keeps the numbered badges and reads the order', async () => {
    reduced = true;
    const r = await render(<StrokeHint target={MIEUM} size={200} playToken={1} orderTaught romanization="m" />);
    expect(numerals(r.root).map((n) => n.props.children)).toEqual(['1', '2', '3']);
    expect(labels(r.root).join(' ')).toMatch(/^Stroke order\. 3 strokes/);
  });
});

describe('StrokeHint ends', () => {
  it('the still closes on a tap and calls onComplete', async () => {
    reduced = true;
    const done = vi.fn();
    const r = await render(<StrokeHint target={O} size={200} playToken={1} orderTaught={false} romanization="o" onComplete={done} />);
    const still = r.root.find((n) => n.props.accessibilityLabel === 'o, shape guide. Tap to close.' && typeof n.props.onPress === 'function');
    await act(async () => {
      (still.props.onPress as () => void)();
    });
    expect(done).toHaveBeenCalledTimes(1);
  });
});
