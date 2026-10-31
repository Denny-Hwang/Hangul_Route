import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenFitContext, contentFits, observeWebFit, type ScreenFit } from '../fit';
import { Screen } from '../Screen';
import type { ScreenProps } from '../types';

/**
 * `Screen` and the fit a `TapBoard` reads (docs/specs/AMENDMENTS-TOUCH.md KT-D3, section 5): it publishes whether its
 * content fits, measured from the ScrollView's layout and content size; it sets `touch-action: manipulation` on the web;
 * on native a screen that fits cannot scroll and the scroll offset is kept for the boards. Checked on the element tree
 * built by calling the component directly (as Screen.header.test.tsx does), with the state hooks kept across calls.
 */
const platform = vi.hoisted(() => ({ OS: 'web' }));
const hooks = vi.hoisted(() => ({ store: [] as unknown[], at: 0, effects: [] as Array<() => void | (() => void)> }));
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
    useEffect: (fn: () => void | (() => void)) => {
      hooks.effects.push(fn);
    },
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
  hooks.effects = [];
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
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

/** A fake ResizeObserver: records what it watches; `fire()` runs its callback as a resize would. */
class FakeObserver {
  static last: FakeObserver | null = null;
  watched: unknown[] = [];
  stopped = false;
  constructor(private readonly cb: () => void) {
    FakeObserver.last = this;
  }
  observe(target: unknown): void {
    this.watched.push(target);
  }
  disconnect(): void {
    this.stopped = true;
  }
  fire(): void {
    this.cb();
  }
}

describe('observeWebFit', () => {
  it('reads the scroll node, watches it and its content, and reports again on every resize', () => {
    const content = { name: 'content' };
    const node = { scrollHeight: 640, clientHeight: 640, children: [content] };
    const seen: boolean[] = [];
    const stop = observeWebFit(node, (f) => seen.push(f), FakeObserver)!;
    expect(seen).toEqual([true]);
    expect(FakeObserver.last!.watched).toEqual([node, content]);
    node.scrollHeight = 1063;
    FakeObserver.last!.fire();
    expect(seen).toEqual([true, false]);
    stop();
    expect(FakeObserver.last!.stopped).toBe(true);
  });

  it('no node or no ResizeObserver: nothing is observed', () => {
    expect(observeWebFit(null, () => undefined, FakeObserver)).toBeNull();
    expect(observeWebFit({ scrollHeight: 1, clientHeight: 1 }, () => undefined, undefined)).toBeNull();
  });
});

describe('Screen fit (scrolling screen, web)', () => {
  /** Hands the ScrollView a react-native-web-like instance and runs the screen's effect. */
  function mount(tree: El, node: { scrollHeight: number; clientHeight: number; children?: unknown[] }): void {
    ((tree as unknown as { ref: (v: unknown) => void }).ref)({ getScrollableNode: () => node });
    for (const effect of hooks.effects.splice(0)) effect();
  }

  it('starts as not fitting, then follows the DOM: fits, grows past the window, fits again', () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeObserver;
    const node = { scrollHeight: 640, clientHeight: 640, children: [] as unknown[] };
    const tree = render();
    expect(fitOf(tree).fits).toBe(false);
    mount(scrollOf(tree), node);
    expect(fitOf(render()).fits).toBe(true);
    node.scrollHeight = 1063;
    FakeObserver.last!.fire();
    expect(fitOf(render()).fits).toBe(false);
  });

  it('a browser with no ResizeObserver keeps not fitting (the boards keep the vertical pan)', () => {
    const tree = render();
    mount(scrollOf(tree), { scrollHeight: 10, clientHeight: 640 });
    expect(fitOf(render()).fits).toBe(false);
  });

  it('touch-action manipulation on the screen; no layout callbacks and no scrollEnabled on the web', () => {
    const scroll = scrollOf(render());
    expect((scroll.props.style as Record<string, unknown>).touchAction).toBe('manipulation');
    for (const prop of ['scrollEnabled', 'onScroll', 'onLayout', 'onContentSizeChange']) expect(scroll.props[prop], prop).toBeUndefined();
    expect(fitOf(render()).scrollY()).toBe(0);
  });
});

describe('Screen fit (scrolling screen, native)', () => {
  it('measured from the layout and the content size, again whenever either changes', () => {
    platform.OS = 'ios';
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
    // The web effect does nothing on native.
    for (const effect of hooks.effects.splice(0)) expect(effect()).toBeUndefined();
  });

  it('no touch-action; a screen that fits cannot scroll, and scrolls again when the content grows', () => {
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

  it('the scroll offset is published for the boards', () => {
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
