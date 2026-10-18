import { spacing } from '@hangul-route/design-system/tokens';
import { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stickyClearance, stickyFits, useFittingStickyBar, useStickyClearance } from '../use-sticky-clearance';

/**
 * The plan builder's sticky bar clearance (AMENDMENTS-LESSON-CHOOSER section 6, WCAG 2.4.11): while the bar is on the
 * page, the document's scroll-padding-bottom is the bar's measured height plus a small gap, it follows the bar when
 * the bar wraps, and the previous value comes back when the bar leaves. The repo's web tests have no DOM, so the
 * document is a stub.
 */

let toggle: (on: boolean) => void = () => undefined;

function Harness(): JSX.Element {
  const ref = useStickyClearance<HTMLDivElement>();
  const [on, setOn] = useState(true);
  toggle = setOn;
  return <section>{on ? <div ref={ref} data-testid="bar" /> : null}</section>;
}

const root = { style: { scrollPaddingBottom: 'keep' } };

beforeEach(() => {
  root.style.scrollPaddingBottom = 'keep';
  vi.stubGlobal('document', { documentElement: root });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('stickyClearance', () => {
  it('is the bar height rounded up plus spacing.sm, never negative', () => {
    expect(stickyClearance(81.2)).toBe(`${82 + spacing.sm}px`);
    expect(stickyClearance(-4)).toBe(`${spacing.sm}px`);
  });
});

describe('useStickyClearance', () => {
  it('pads the page by the bar, follows it when it resizes, and gives the old value back when the bar leaves', () => {
    let height = 90;
    let resize: (() => void) | null = null;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe(): void {}
        disconnect(): void {
          disconnect();
        }
      },
    );
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Harness />, { createNodeMock: () => ({ getBoundingClientRect: () => ({ height }) }) });
    });
    expect(root.style.scrollPaddingBottom).toBe(`${90 + spacing.sm}px`);
    height = 180;
    act(() => resize?.());
    expect(root.style.scrollPaddingBottom).toBe(`${180 + spacing.sm}px`);
    act(() => toggle(false));
    expect(root.style.scrollPaddingBottom).toBe('keep');
    expect(disconnect).toHaveBeenCalled();
    act(() => renderer.unmount());
    expect(root.style.scrollPaddingBottom).toBe('keep');
  });

  it('without ResizeObserver the first measure stays; unmounting gives the old value back', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Harness />, { createNodeMock: () => ({ getBoundingClientRect: () => ({ height: 40 }) }) });
    });
    expect(root.style.scrollPaddingBottom).toBe(`${40 + spacing.sm}px`);
    act(() => renderer.unmount());
    expect(root.style.scrollPaddingBottom).toBe('keep');
  });
});

describe('stickyFits', () => {
  it('a bar up to the share of the window stays sticky; a taller one does not; an unknown window keeps it sticky', () => {
    expect(stickyFits(213, 640, 1 / 3)).toBe(true);
    expect(stickyFits(214, 640, 1 / 3)).toBe(false);
    expect(stickyFits(500, 0, 1 / 3)).toBe(true);
    expect(stickyFits(500, Number.NaN, 1 / 3)).toBe(true);
  });
});

describe('useFittingStickyBar', () => {
  let stuckNow: boolean | null = null;
  function Fitting(): JSX.Element {
    const { ref, stuck } = useFittingStickyBar<HTMLDivElement>(1 / 3);
    const [on, setOn] = useState(true);
    toggle = setOn;
    stuckNow = stuck;
    return <section>{on ? <div ref={ref} data-stuck={stuck} /> : null}</section>;
  }
  type Listener = () => void;
  const listeners = new Map<string, Listener>();
  const win = { innerHeight: 640, addEventListener: (type: string, fn: Listener) => listeners.set(type, fn), removeEventListener: (type: string) => listeners.delete(type) };

  beforeEach(() => {
    listeners.clear();
    win.innerHeight = 640;
    stuckNow = null;
    vi.stubGlobal('window', win);
  });

  it('sticky while the bar, less its extra lines, is at most a third of the window; the padding only while sticky', () => {
    let height = 150;
    let extra = 0;
    let resize: (() => void) | null = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
    const node = {
      getBoundingClientRect: () => ({ height }),
      querySelectorAll: () => [{ getBoundingClientRect: () => ({ height: extra }) }],
    };
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Fitting />, { createNodeMock: () => node });
    });
    expect(stuckNow).toBe(true);
    expect(root.style.scrollPaddingBottom).toBe(`${150 + spacing.sm}px`);
    // A status line comes in: the bar grows, it stays where it is, and the padding covers it.
    height = 250;
    extra = 100;
    act(() => resize?.());
    expect(stuckNow).toBe(true);
    expect(root.style.scrollPaddingBottom).toBe(`${250 + spacing.sm}px`);
    // 200 % text: the bar itself is too tall, so it sits at the end of the page and the padding goes.
    extra = 0;
    act(() => resize?.());
    expect(stuckNow).toBe(false);
    expect(root.style.scrollPaddingBottom).toBe('keep');
    // The phone turns upright: the window is tall enough again.
    win.innerHeight = 900;
    act(() => listeners.get('resize')?.());
    expect(stuckNow).toBe(true);
    act(() => toggle(false));
    expect(root.style.scrollPaddingBottom).toBe('keep');
    act(() => renderer.unmount());
    expect(listeners.has('resize')).toBe(false);
  });

  it('without ResizeObserver, querySelectorAll or a window size the first measure stays and the bar stays sticky', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('window', { addEventListener: () => undefined, removeEventListener: () => undefined });
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Fitting />, { createNodeMock: () => ({ getBoundingClientRect: () => ({ height: 900 }) }) });
    });
    expect(stuckNow).toBe(true);
    expect(root.style.scrollPaddingBottom).toBe(`${900 + spacing.sm}px`);
    act(() => renderer.unmount());
    expect(root.style.scrollPaddingBottom).toBe('keep');
  });

  it('with no window at all (a server render) nothing is read', () => {
    vi.stubGlobal('window', undefined);
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Fitting />, { createNodeMock: () => ({ getBoundingClientRect: () => ({ height: 40 }) }) });
    });
    expect(stuckNow).toBe(true);
    act(() => renderer.unmount());
  });
});
