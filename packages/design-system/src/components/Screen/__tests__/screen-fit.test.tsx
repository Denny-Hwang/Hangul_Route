import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenFitContext, contentFits, type ScreenFit } from '../fit';
import { Screen } from '../Screen';
import type { ScreenProps } from '../types';

/**
 * `Screen` and the fit a `TapBoard` reads (docs/specs/AMENDMENTS-TOUCH.md KT-D3, section 5): it publishes whether its
 * content fits, measured from the ScrollView's layout and content size; it sets `touch-action: manipulation` on the web;
 * on native a screen that fits cannot scroll and the scroll offset is kept for the boards. Checked on the element tree
 * built by calling the component directly (as Screen.header.test.tsx does), with the state hooks kept across calls.
 */
const platform = vi.hoisted(() => ({ OS: 'web' }));
const hooks = vi.hoisted(() => ({ store: [] as unknown[], at: 0 }));
vi.mock('react-native', () => ({ Platform: platform, ScrollView: 'ScrollView', View: 'View' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaInsetsContext: { name: 'insets' } }));
vi.mock('../../Layout', () => ({ useLayoutClass: () => ({ width: 'compact' }) }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  /** One slot per hook call, in call order, kept across calls of one scenario (as React keeps them). */
  const slot = <T,>(init: () => T): { value: T } => {
    const at = hooks.at++;
    if (hooks.store.length <= at) hooks.store.push({ value: init() });
    return hooks.store[at] as { value: T };
  };
  const stubs = {
    useContext: (): null => null,
    useState: <T,>(initial: T) => {
      const s = slot(() => initial);
      return [s.value, (v: T) => (s.value = v)] as const;
    },
    useRef: <T,>(initial: T) => slot(() => ({ current: initial })).value,
    useCallback: <T,>(fn: T): T => fn,
    useMemo: <T,>(fn: () => T): T => fn(),
  };
  return { ...actual, ...stubs, default: { ...actual, ...stubs } };
});

type El = ReactElement<Record<string, unknown>>;

function all(node: ReactNode): El[] {
  if (!isValidElement(node)) return [];
  const el = node as El;
  const kids = typeof el.props.children === 'function' ? [] : Children.toArray(el.props.children as ReactNode);
  return [el, ...kids.flatMap(all)];
}

function render(props: Partial<ScreenProps> = {}): El[] {
  hooks.at = 0;
  return all(Screen({ children: <span>body</span>, ...props }));
}

const fitOf = (tree: El[]): ScreenFit => tree.find((e) => e.type === ScreenFitContext.Provider)!.props.value as ScreenFit;
const scrollOf = (tree: El[]): El => tree.find((e) => e.type === 'ScrollView')!;
const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 320, height } } });

beforeEach(() => {
  hooks.store = [];
  platform.OS = 'web';
});

describe('contentFits', () => {
  it('fits when the content is no taller than the viewport, give or take a pixel', () => {
    expect(contentFits(640, 640)).toBe(true);
    expect(contentFits(641, 640)).toBe(true);
    expect(contentFits(642, 640)).toBe(false);
    expect(contentFits(0, 0)).toBe(false);
  });
});

describe('Screen fit (scrolling screen)', () => {
  it('starts as not fitting, then follows the measured viewport and content', () => {
    let tree = render();
    expect(fitOf(tree).fits).toBe(false);
    const scroll = scrollOf(tree);
    (scroll.props.onLayout as (e: unknown) => void)(layout(640));
    (scroll.props.onContentSizeChange as (w: number, h: number) => void)(320, 640);
    tree = render();
    expect(fitOf(tree).fits).toBe(true);
    (scrollOf(tree).props.onContentSizeChange as (w: number, h: number) => void)(320, 1063);
    expect(fitOf(render()).fits).toBe(false);
    // A larger text size or a rotation changes the viewport: measured again.
    (scrollOf(render()).props.onLayout as (e: unknown) => void)(layout(1100));
    expect(fitOf(render()).fits).toBe(true);
  });

  it('web: touch-action manipulation on the screen, and the browser keeps scrolling (no scrollEnabled)', () => {
    const scroll = scrollOf(render());
    expect((scroll.props.style as Record<string, unknown>).touchAction).toBe('manipulation');
    expect(scroll.props.scrollEnabled).toBeUndefined();
    expect(scroll.props.onScroll).toBeUndefined();
    expect(fitOf(render()).scrollY()).toBe(0);
  });

  it('native: no touch-action; a screen that fits cannot scroll, and scrolls again when the content grows', () => {
    platform.OS = 'ios';
    let scroll = scrollOf(render());
    expect((scroll.props.style as Record<string, unknown>).touchAction).toBeUndefined();
    expect(scroll.props.scrollEnabled).toBe(true);
    (scroll.props.onLayout as (e: unknown) => void)(layout(640));
    (scroll.props.onContentSizeChange as (w: number, h: number) => void)(320, 600);
    scroll = scrollOf(render());
    expect(scroll.props.scrollEnabled).toBe(false);
    (scroll.props.onContentSizeChange as (w: number, h: number) => void)(320, 900);
    expect(scrollOf(render()).props.scrollEnabled).toBe(true);
  });

  it('native: the scroll offset is published for the boards', () => {
    platform.OS = 'android';
    const tree = render();
    (scrollOf(tree).props.onScroll as (e: unknown) => void)({ nativeEvent: { contentOffset: { x: 0, y: 120 } } });
    expect(fitOf(render()).scrollY()).toBe(120);
    expect(scrollOf(tree).props.scrollEventThrottle).toBe(16);
  });
});

describe('Screen fit (fixed screen and footer)', () => {
  it('a fixed screen always fits and carries manipulation on the web', () => {
    const tree = render({ scrollable: false, testID: 'fixed' });
    expect(fitOf(tree).fits).toBe(true);
    const body = tree.find((e) => e.props.testID === 'fixed')!;
    expect((body.props.style as Record<string, unknown>).touchAction).toBe('manipulation');
  });

  it('with a footer, manipulation sits on the outer frame so the footer has it too', () => {
    const tree = render({ footer: <span>cta</span>, testID: 'framed' });
    const outer = tree.find((e) => e.props.testID === 'framed')!;
    expect((outer.props.style as Record<string, unknown>).touchAction).toBe('manipulation');
    expect((scrollOf(tree).props.style as Record<string, unknown>).touchAction).toBeUndefined();
  });

  it('native with a footer: no touch-action anywhere', () => {
    platform.OS = 'ios';
    const tree = render({ footer: <span>cta</span>, testID: 'framed' });
    expect((tree.find((e) => e.props.testID === 'framed')!.props.style as Record<string, unknown>).touchAction).toBeUndefined();
  });
});
