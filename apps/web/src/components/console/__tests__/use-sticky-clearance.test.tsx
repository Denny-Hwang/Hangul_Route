import { spacing } from '@hangul-route/design-system/tokens';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STICKY_CLEARANCE_VAR, clearanceStyle, useStickyClearance } from '../use-sticky-clearance';

/**
 * The plan builder's sticky bar clearance (AMENDMENTS-LESSON-CHOOSER section 6, WCAG 2.4.11): the bar's measured
 * height (plus a small gap) reaches the picker as a custom property its focusable parts use as scroll-margin-bottom,
 * and it follows the bar when the bar wraps.
 */

function Harness({ onStyle }: { onStyle: (style: Record<string, unknown>) => void }): JSX.Element {
  const [ref, style] = useStickyClearance<HTMLDivElement>();
  onStyle(style as Record<string, unknown>);
  return (
    <section style={style}>
      <div ref={ref} data-testid="bar" />
    </section>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clearanceStyle', () => {
  it('is the bar height rounded up plus spacing.sm, never negative', () => {
    expect(clearanceStyle(81.2)).toEqual({ [STICKY_CLEARANCE_VAR]: `${82 + spacing.sm}px` });
    expect(clearanceStyle(-4)).toEqual({ [STICKY_CLEARANCE_VAR]: `${spacing.sm}px` });
  });
});

describe('useStickyClearance', () => {
  it('measures the bar, follows it when it resizes, and stops on unmount', () => {
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
    const styles: Record<string, unknown>[] = [];
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<Harness onStyle={(s) => styles.push(s)} />, { createNodeMock: () => ({ getBoundingClientRect: () => ({ height }) }) });
    });
    expect(styles.at(-1)).toEqual({ [STICKY_CLEARANCE_VAR]: `${90 + spacing.sm}px` });
    height = 180;
    act(() => resize?.());
    expect(styles.at(-1)).toEqual({ [STICKY_CLEARANCE_VAR]: `${180 + spacing.sm}px` });
    act(() => renderer.unmount());
    expect(disconnect).toHaveBeenCalled();
  });

  it('without ResizeObserver the first measure stays', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const styles: Record<string, unknown>[] = [];
    act(() => {
      create(<Harness onStyle={(s) => styles.push(s)} />, { createNodeMock: () => ({ getBoundingClientRect: () => ({ height: 40 }) }) });
    });
    expect(styles.at(-1)).toEqual({ [STICKY_CLEARANCE_VAR]: `${40 + spacing.sm}px` });
  });
});
