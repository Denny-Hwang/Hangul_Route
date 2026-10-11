import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { borderWidth, colors, radii, spacing } from '../../../tokens';
import { SPARK_FILL_MS, sparkLayout } from '../../../spark';

/**
 * The element trees of SparkMeter (component-skill section 3.1), built by
 * calling the components directly: react-native, react-native-svg and
 * reanimated are replaced by plain host tags and spies, and React's
 * useRef/useEffect by a tiny stand-in, so the accessibility contract, the
 * slot shapes and the entrance of a newly lit spark are checked without a
 * renderer.
 */
const effects: Array<() => void> = [];
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useRef = <T,>(initial: T) => ({ current: initial });
  const useEffect = (fn: () => void) => {
    effects.push(fn);
  };
  return { ...actual, default: { ...actual, useRef, useEffect }, useRef, useEffect };
});
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Svg: 'Svg', Circle: 'Circle', Path: 'Path' }));
// A regular-class window: every media size is scaled by 1.5 (useMediaSize rounds base x mediaScale).
vi.mock('../../Layout/LayoutProvider', () => ({ useMediaSize: (base: number) => Math.round(base * 1.5) }));

/** Every value written to a spark's progress, so a test can prove it was never hidden. */
const writes: unknown[] = [];
const reanimated = vi.hoisted(() => ({ reduced: false }));
const withTiming = vi.fn((to: number, _config: unknown) => to);
vi.mock('react-native-reanimated', () => ({
  default: { View: 'Animated.View' },
  Easing: { out: (f: unknown) => f, quad: 'quad' },
  useReducedMotion: () => reanimated.reduced,
  useSharedValue: (initial: number) => {
    let value = initial;
    writes.push(initial);
    return {
      get value() {
        return value;
      },
      set value(next: number) {
        writes.push(next);
        value = next;
      },
    };
  },
  useAnimatedStyle: (fn: () => unknown) => fn(),
  withTiming: (to: number, config: unknown) => withTiming(to, config),
}));

const { EmptySlot, LitSpark, SparkMeter, SparkMeterBody } = await import('../SparkMeter');

type Props = Record<string, unknown>;
type El = React.ReactElement<Props>;
const kids = (el: El): El[] => React.Children.toArray(el.props.children as React.ReactNode) as El[];
const SIZE = 24;
const GAP = 6;

function body(value: number, extra: Partial<React.ComponentProps<typeof SparkMeterBody>> = {}): El {
  const layout = sparkLayout(value);
  return SparkMeterBody({
    layout,
    previousFilled: layout.filled,
    reducedMotion: false,
    size: SIZE,
    gap: GAP,
    accessibilityLabel: `${value} sparks`,
    ...extra,
  }) as El;
}
const rowsOf = (meter: El): El[] => kids(meter);
const slotsOf = (meter: El): El[] => rowsOf(meter).flatMap(kids);

beforeEach(() => {
  effects.length = 0;
  writes.length = 0;
  withTiming.mockClear();
  reanimated.reduced = false;
});

describe('SparkMeterBody: one image with the caller label', () => {
  it('is a single accessible image node carrying the caller label', () => {
    const meter = body(3, { testID: 'meter' });
    expect(meter.type).toBe('View');
    expect(meter.props).toMatchObject({ testID: 'meter', accessible: true, accessibilityRole: 'image', accessibilityLabel: '3 sparks' });
  });

  it('hides every row from assistive technology on native and on web', () => {
    for (const row of rowsOf(body(15))) {
      expect(row.props).toMatchObject({ importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true, 'aria-hidden': true });
      expect(row.props.style).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap', gap: GAP });
    }
  });

  it('draws rows x slots slots, as many lit sparks as sparkLayout fills, and no text', () => {
    for (const value of [0, 1, 3, 10, 11, 29, 30, 45]) {
      const meter = body(value);
      const layout = sparkLayout(value);
      expect(rowsOf(meter)).toHaveLength(layout.rows.length);
      const slots = slotsOf(meter);
      expect(slots).toHaveLength(layout.rows.length * layout.slots);
      expect(slots.filter((s) => s.type === LitSpark)).toHaveLength(layout.filled);
      expect(slots.filter((s) => s.type === EmptySlot)).toHaveLength(layout.rows.length * layout.slots - layout.filled);
      // No digits, no copy: every child is a slot element.
      expect(slots.every((s) => s.type === LitSpark || s.type === EmptySlot)).toBe(true);
    }
  });

  it('shows the soft backdrop only when full of sparks, with the row-count radius', () => {
    expect(body(29).props.style).toMatchObject({ backgroundColor: undefined, borderRadius: radii.lg, padding: GAP, gap: GAP });
    expect(body(3).props.style).toMatchObject({ backgroundColor: undefined, borderRadius: radii.pill });
    expect(body(30).props.style).toMatchObject({ backgroundColor: colors.brand.primaryLight, borderRadius: radii.lg });
  });

  it('holds the height of the reserved rows from the start, so content below never moves', () => {
    expect(body(3).props.style).toMatchObject({ minHeight: undefined });
    const held = 3 * SIZE + 2 * GAP + 2 * GAP;
    expect(body(3, { reservedRows: 3 }).props.style).toMatchObject({ minHeight: held, borderRadius: radii.lg });
    expect(body(25, { reservedRows: 3 }).props.style).toMatchObject({ minHeight: held });
  });
});

describe('SparkMeterBody: which sparks play the fill', () => {
  const newly = (meter: El): boolean[] => slotsOf(meter).filter((s) => s.type === LitSpark).map((s) => s.props.newlyLit as boolean);

  it('nothing plays when the meter appears', () => {
    expect(newly(body(5))).toEqual([false, false, false, false, false]);
  });

  it('only the spark just earned plays', () => {
    expect(newly(body(4, { previousFilled: 3 }))).toEqual([false, false, false, true]);
  });

  it('the first spark of a new row plays like any other (10 to 11)', () => {
    const meter = body(11, { previousFilled: 10 });
    const second = kids(rowsOf(meter)[1]!);
    expect(second[0]!.type).toBe(LitSpark);
    expect(second[0]!.props.newlyLit).toBe(true);
    expect(kids(rowsOf(meter)[0]!).every((s) => s.props.newlyLit === false)).toBe(true);
  });

  it('passes reduced motion and the size to every lit spark', () => {
    const [spark] = slotsOf(body(1, { previousFilled: 0, reducedMotion: true }));
    expect(spark!.props).toMatchObject({ size: SIZE, newlyLit: true, reducedMotion: true });
  });
});

describe('slot shapes', () => {
  it('an empty slot is a quiet circle with a hairline (borderWidth.thin on screen) outline', () => {
    const svg = EmptySlot({ size: SIZE }) as El;
    expect(svg.props).toMatchObject({ width: SIZE, height: SIZE, viewBox: '0 0 24 24' });
    const [circle] = kids(svg);
    expect(circle!.type).toBe('Circle');
    expect(circle!.props).toMatchObject({ fill: colors.surface.sunken, stroke: colors.border.strong });
    // The stroke is in viewBox units: drawn at SIZE px it is exactly borderWidth.thin on screen.
    expect(((circle!.props.strokeWidth as number) * SIZE) / 24).toBeCloseTo(borderWidth.thin);
    expect(((EmptySlot({ size: spacing.lg }) as El).props.children as El).props.strokeWidth).toBeCloseTo((borderWidth.thin * 24) / spacing.lg);
  });

  it('a lit spark is a brand.primary spark shape inside an animated view', () => {
    const view = LitSpark({ size: SIZE, newlyLit: false, reducedMotion: false }) as El;
    expect(view.type).toBe('Animated.View');
    const [svg] = kids(view);
    expect(svg!.props).toMatchObject({ width: SIZE, height: SIZE });
    const [path] = kids(svg!);
    expect(path!.type).toBe('Path');
    expect(path!.props).toMatchObject({ fill: colors.brand.primary });
  });
});

describe('LitSpark entrance (no blink, WCAG 2.3.1)', () => {
  const runEffects = () => effects.splice(0).forEach((fn) => fn());

  it('a newly lit spark is first drawn hidden, then plays one 300 ms fill', () => {
    const view = LitSpark({ size: SIZE, newlyLit: true, reducedMotion: false }) as El;
    expect(view.props.style).toMatchObject({ opacity: 0, transform: [{ scale: 0.6 }] });
    runEffects();
    expect(withTiming).toHaveBeenCalledTimes(1);
    expect(withTiming.mock.calls[0]![0]).toBe(1);
    expect(withTiming.mock.calls[0]![1]).toMatchObject({ duration: SPARK_FILL_MS });
    // Never full, then hidden: the only values are 0 and the animation to 1.
    expect(writes).toEqual([0, 1]);
  });

  it('under reduced motion a newly lit spark is shown at once and is never set to 0', () => {
    const view = LitSpark({ size: SIZE, newlyLit: true, reducedMotion: true }) as El;
    expect(view.props.style).toMatchObject({ opacity: 1, transform: [{ scale: 1 }] });
    runEffects();
    expect(withTiming).not.toHaveBeenCalled();
    expect(writes).not.toContain(0);
  });

  it('a spark lit when the meter appears is drawn as it is, with no animation', () => {
    LitSpark({ size: SIZE, newlyLit: false, reducedMotion: false });
    runEffects();
    expect(withTiming).not.toHaveBeenCalled();
    expect(writes).toEqual([1]);
  });
});

describe('SparkMeter: sizes through useMediaSize, reduced motion and the previous count', () => {
  it('passes the scaled slot and gap, the label and the reduced-motion flag to the body', () => {
    reanimated.reduced = true;
    const el = SparkMeter({ value: 3, accessibilityLabel: '3 sparks', testID: 'meter' }) as El;
    expect(el.type).toBe(SparkMeterBody);
    expect(el.props).toMatchObject({
      layout: sparkLayout(3),
      size: Math.round(spacing.lg * 1.5),
      gap: Math.round(spacing.xs * 1.5),
      reducedMotion: true,
      accessibilityLabel: '3 sparks',
      testID: 'meter',
      reservedRows: undefined,
    });
  });

  it('seeds the previous count with the first value, so nothing animates at mount', () => {
    const el = SparkMeter({ value: 7, accessibilityLabel: '7 sparks' }) as El;
    expect(el.props.previousFilled).toBe(7);
  });

  it('reserves maxRows rows when asked (default 3)', () => {
    expect((SparkMeter({ value: 0, reserveRows: true, accessibilityLabel: '0' }) as El).props.reservedRows).toBe(3);
    expect((SparkMeter({ value: 0, reserveRows: true, maxRows: 2, accessibilityLabel: '0' }) as El).props.reservedRows).toBe(2);
  });
});
