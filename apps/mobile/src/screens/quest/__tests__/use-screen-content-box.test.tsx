import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenReserveContext } from '../../../components/screen-reserve';
import { byTestId, render, unmount } from '../../../test-support/render';
import { PreviewFrame } from '../../browse/PreviewFrame';
import { useScreenContentBox } from '../use-screen-content-box';

/**
 * [TC] The trace page sizes from the Screen content box. A frame above the screen (the All lessons preview's strip) takes its
 * height off the window, so the box the chooser sees is the real one: at 320 x 568 the canvas must not spill under the strip.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('@react-navigation/native', async () => {
  const { useEffect } = await import('react');
  return { useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]) };
});

const seen: { width: number; height: number }[] = [];
function Probe(): ReactElement {
  const box = useScreenContentBox();
  seen.push(box);
  return <></>;
}
const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  seen.length = 0;
});
const last = (): { width: number; height: number } => seen[seen.length - 1]!;

describe('useScreenContentBox (TC-1b)', () => {
  it('is the window less the gutters: 320 x 568 gives 288 x 536', async () => {
    mounted.push(await render(<LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}><Probe /></LayoutProvider>));
    expect(last()).toEqual({ width: 288, height: 536 });
  });

  it('takes the height a frame above the screen reserves off the height', async () => {
    mounted.push(
      await render(
        <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
          <ScreenReserveContext.Provider value={68}>
            <Probe />
          </ScreenReserveContext.Provider>
        </LayoutProvider>,
      ),
    );
    expect(last()).toEqual({ width: 288, height: 536 - 68 });
  });

  it('keeps one object while the size does not change', async () => {
    const r = await render(<LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}><Probe /></LayoutProvider>);
    mounted.push(r);
    const first = last();
    await act(async () => {
      r.update(<LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}><Probe /></LayoutProvider>);
    });
    expect(last()).toBe(first);
  });

  it('the All lessons preview frame reserves its measured strip for the screen inside it', async () => {
    mounted.push(
      await render(
        <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
          <PreviewFrame>
            <Probe />
          </PreviewFrame>
        </LayoutProvider>,
      ),
    );
    // Before it is measured: the strip's least height, a touch target and its padding and rule.
    const before = last().height;
    expect(before).toBeLessThan(536 - 64);
    const r = mounted[0]!;
    const strip = r.root.findAll((n) => typeof n.type !== 'string' && n.props.testID === 'preview-strip' && typeof n.props.onLayout === 'function')[0]!;
    await act(async () => {
      (strip.props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 110 } } });
    });
    expect(last()).toEqual({ width: 288, height: 536 - 110 });
    expect(byTestId(r.root, 'preview-strip').length).toBeGreaterThan(0);
  });
});
