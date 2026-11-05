import { useTapScroller, type TapScrollerLike } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { ScrollView } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, resetPlatform, setPlatform, unmount } from '../../../test-support/render';
import { ChoiceScroller } from '../parts';

/**
 * AMENDMENTS-TOUCH row KT-5 (section 6.4, KT-D3 rule 5): Short in a small landscape window keeps the choices in their own
 * ScrollView, which `ChoiceScroller` hands to the choices' board as its scroller. It can scroll only when the content is
 * taller than the column; `scrollBy` clamps to the content (on the web from the node's own `scrollTop`, so it never
 * drifts after a content change); every scroll reaches the listeners (rule 7 cancels a press on a scroll it did not drive).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  resetPlatform();
});

interface WebNode {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  scroll: () => void;
  scrollTo: () => void;
}

async function mount(node: WebNode): Promise<{ r: ReactTestRenderer; scroller: () => TapScrollerLike }> {
  let seen: TapScrollerLike | null = null;
  function Probe(): ReactElement | null {
    seen = useTapScroller();
    return null;
  }
  const r = await render(
    <ChoiceScroller>
      <Probe />
    </ChoiceScroller>,
    { createNodeMock: (el) => ((el.props as Record<string, unknown>)['data-testid'] === 'placement-choice-scroller' ? node : null) },
  );
  mounted.push(r);
  return {
    r,
    scroller: () => {
      if (seen === null) throw new Error('no scroller');
      return seen;
    },
  };
}

const scrollView = (r: ReactTestRenderer) => r.root.findByType(ScrollView);

async function size(r: ReactTestRenderer, viewport: number, content: number): Promise<void> {
  await act(async () => {
    scrollView(r).props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: viewport } } });
    scrollView(r).props.onContentSizeChange(300, content);
  });
}

const fakeNode = (): WebNode => ({ scrollTop: 0, scrollHeight: 500, clientHeight: 200, scroll: vi.fn(), scrollTo: vi.fn() });

describe('ChoiceScroller: the Short landscape column as the choices board\'s scroller (AMENDMENTS-TOUCH KT-5)', () => {
  it('can scroll only when the content is taller than the column', async () => {
    const { r, scroller } = await mount(fakeNode());
    expect(scroller().axis).toBe('y');
    expect(scroller().canScroll).toBe(false);
    await size(r, 200, 200);
    expect(scroller().canScroll).toBe(false);
    await size(r, 200, 500);
    expect(scroller().canScroll).toBe(true);
  });

  it('web: scrollBy moves the node\'s own scrollTop, clamped to the content', async () => {
    const node = fakeNode();
    const { r, scroller } = await mount(node);
    await size(r, 200, 500);
    expect(scroller().scrollBy(120)).toBe(120);
    expect(node.scrollTop).toBe(120);
    // The page scrolled the node itself (a content change, a wheel): the next drag starts from there, not from a copy.
    node.scrollTop = 250;
    expect(scroller().scrollBy(1000)).toBe(300);
    expect(scroller().scrollBy(-1000)).toBe(0);
  });

  it('native: scrollBy clamps the offset to the measured content and column', async () => {
    setPlatform('ios');
    const { r, scroller } = await mount(fakeNode());
    await size(r, 200, 500);
    expect(scroller().scrollBy(1000)).toBe(300);
    expect(scroller().scrollBy(-120)).toBe(180);
    expect(scroller().scrollBy(-1000)).toBe(0);
  });

  it('every scroll reaches the listeners until they stop listening', async () => {
    const { r, scroller } = await mount(fakeNode());
    const heard: number[] = [];
    const stop = scroller().onScroll((offset) => heard.push(offset));
    await act(async () => {
      scrollView(r).props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 64 } } });
    });
    stop();
    await act(async () => {
      scrollView(r).props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 96 } } });
    });
    expect(heard).toEqual([64]);
  });
});
