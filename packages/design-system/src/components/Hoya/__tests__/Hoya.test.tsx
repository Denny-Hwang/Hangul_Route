import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HOYA_VARIANTS } from '../../../tokens';
import { Hoya } from '../Hoya';
import type { HoyaPose } from '../types';

/**
 * The drawing `Hoya` hands react-native-svg, frozen (F-STORY-002 PR 2.11). The
 * snapshot was written from the hand-drawn JSX component before it was moved
 * onto the `hoya.ts` data, so an identical element tree here is the "no visual
 * change" check: the same svg elements with the same attributes in the same
 * order draw the same pixels on every platform. The element tree is built by
 * calling the component directly with the native hosts replaced by plain tags
 * (as Button.test.tsx does).
 */
vi.mock('react-native', () => ({ AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(true) } }));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'Animated.View' },
  Easing: { bezier: () => (t: number) => t },
  useAnimatedStyle: () => ({ transform: [{ scale: 1 }] }),
  useSharedValue: (v: number) => ({ value: v }),
  withSequence: () => 1,
  withTiming: () => 1,
}));
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Circle: 'Circle',
  Ellipse: 'Ellipse',
  G: 'G',
  Line: 'Line',
  Path: 'Path',
  Polygon: 'Polygon',
  Rect: 'Rect',
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  // Called outside a render here: the ref and effect hooks are plain stand-ins.
  const hooks = { useRef: <T,>(v: T): { current: T } => ({ current: v }), useEffect: (): void => undefined };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});

interface Drawn {
  type: string;
  props: Record<string, unknown>;
  children: Drawn[];
}

/** Host elements only (function components expanded), keys and empty slots dropped, props in name order. */
function drawn(node: React.ReactNode): Drawn[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(drawn);
  if (!React.isValidElement(node)) throw new Error(`unexpected child ${String(node)}`);
  const el = node as React.ReactElement<Record<string, unknown>>;
  if (typeof el.type === 'function') return drawn((el.type as (p: unknown) => React.ReactNode)(el.props));
  const { children, ...rest } = el.props;
  const props = Object.fromEntries(Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)));
  return [{ type: String(el.type), props, children: drawn(children as React.ReactNode) }];
}

const POSES: HoyaPose[] = ['idle', 'cheering', 'thinking', 'reading', 'waving'];

describe('Hoya renders the frozen drawing', () => {
  it('draws every pose and fur variant exactly as the hand-drawn component did', async () => {
    const all: Record<string, Drawn[]> = {};
    for (const variant of HOYA_VARIANTS) {
      for (const pose of POSES) all[`${variant}/${pose}`] = drawn(Hoya({ pose, variant, size: 96, testID: 'hoya' }));
    }
    await expect(`${JSON.stringify(all, null, 1)}\n`).toMatchFileSnapshot('./__snapshots__/hoya-render.json');
  });

  it('keeps the defaults: idle, 96, the gold cub, a pose label', () => {
    const [root] = drawn(Hoya({}));
    expect(root!.type).toBe('Animated.View');
    const [svg] = root!.children;
    expect(svg!.props).toMatchObject({ width: 96, height: 96, viewBox: '0 0 128 128', accessibilityLabel: 'Hoya the tiger, idle' });
    expect(drawn(Hoya({}))).toEqual(drawn(Hoya({ pose: 'idle', size: 96, variant: 'orange' })));
  });

  it('passes the label and size through', () => {
    const [root] = drawn(Hoya({ pose: 'waving', size: 40, accessibilityLabel: 'Your cub' }));
    expect(root!.children[0]!.props).toMatchObject({ width: 40, height: 40, accessibilityLabel: 'Your cub' });
  });

  it('draws an unknown pose as idle without the cheek blush, as the hand-drawn component did', () => {
    const strip = (d: Drawn[]): Drawn[] => d.map((r) => ({ ...r, children: r.children.map((s) => ({ ...s, props: { ...s.props, accessibilityLabel: '' } })) }));
    const isBlush = (el: Drawn) =>
      el.type === 'G' && el.children.length === 2 && el.children.every((c) => c.type === 'Circle' && c.props.cy === 84 && c.props.opacity === 0.6);
    const shapesOf = (d: Drawn[]): Drawn[] => d[0]!.children[0]!.children;
    const idle = strip(drawn(Hoya({ pose: 'idle' })));
    const junk = strip(drawn(Hoya({ pose: 'junk' as never })));
    expect(shapesOf(idle).filter(isBlush)).toHaveLength(1);
    expect(shapesOf(junk).filter(isBlush)).toHaveLength(0);
    // Everything else is the idle drawing: no raised arms, the idle mouth, the pink ear insides.
    expect(shapesOf(junk)).toEqual(shapesOf(idle).filter((el) => !isBlush(el)));
    expect(shapesOf(junk).filter((el) => el.type === 'Path' && el.props.strokeWidth === 10)).toHaveLength(0);
    expect(shapesOf(junk)).toContainEqual(expect.objectContaining({ type: 'Path', props: expect.objectContaining({ d: 'M50 92 Q60 100 70 92' }) }));
    expect(shapesOf(junk).filter((el) => el.type === 'Circle' && el.props.opacity === 0.85)).toHaveLength(2);
  });
});
