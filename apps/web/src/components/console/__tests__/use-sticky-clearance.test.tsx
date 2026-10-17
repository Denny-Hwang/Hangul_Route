import { spacing } from '@hangul-route/design-system/tokens';
import { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stickyClearance, useStickyClearance } from '../use-sticky-clearance';

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
