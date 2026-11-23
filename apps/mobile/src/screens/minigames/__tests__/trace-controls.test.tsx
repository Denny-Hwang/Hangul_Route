import { borderWidth, spacing } from '@hangul-route/design-system';
import { ScrollView, Text } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, resetPlatform, setPlatform, unmount } from '../../../test-support/render';
import { TIP_AFTER_FOCUS_MS, TraceControls, useTipAfterFocus } from '../TraceControls';

/**
 * AMENDMENTS-TRACE-IDLE TI-3b: the controls under a trace canvas (OD-TI7) and a tip said once, after Next takes focus.
 * The two games' screens test them in place (`trace-idle-states.test.tsx`, `trace-word-idle-states.test.tsx`); these
 * cases cover the parts a screen test cannot reach: native scrolling, the scroll back to the top, a tip left early.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const announce = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  announceForScreenReader: (text: string) => void announce.calls.push(text),
}));

const scrolls: number[] = [];
const nodeMock = (): object => ({ scroll: ({ top }: { top: number }) => void scrolls.push(top), scrollHeight: 500 });
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  scrolls.length = 0;
  announce.calls.length = 0;
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  resetPlatform();
  vi.useRealTimers();
});

const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(Infinity as 1).filter((s): s is object => typeof s === 'object' && s !== null));
const scrollOf = (r: ReactTestRenderer): ReactTestInstance => r.root.find((n) => n.type === ScrollView);

async function controls(scrolls: boolean): Promise<ReactTestRenderer> {
  const r = await render(
    <TraceControls scrolls={scrolls} testID="controls">
      <Text>Next</Text>
    </TraceControls>,
    { createNodeMock: nodeMock },
  );
  mounted.push(r);
  return r;
}
const update = async (r: ReactTestRenderer, scrolls: boolean): Promise<void> => {
  await act(async () => {
    r.update(
      <TraceControls scrolls={scrolls} testID="controls">
        <Text>Next</Text>
      </TraceControls>,
    );
  });
};
const layOut = async (r: ReactTestRenderer): Promise<void> => {
  await act(async () => {
    (scrollOf(r).props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 100 } } });
  });
};

describe('TraceControls (OD-TI7)', () => {
  it('native: scrolling is on only while Next shows; the column shrinks only then', async () => {
    setPlatform('ios');
    const r = await controls(false);
    expect(scrollOf(r).props.scrollEnabled).toBe(false);
    expect(flat(scrollOf(r).props.style).flexShrink).toBe(0);
    await update(r, true);
    expect(scrollOf(r).props.scrollEnabled).toBe(true);
    expect(flat(scrollOf(r).props.style).flexShrink).toBe(1);
  });

  it('web: scrolling is never switched off (the switch also blocks pinch-zoom there); the column that never shrinks has nothing to scroll', async () => {
    const r = await controls(false);
    expect(scrollOf(r).props.scrollEnabled).toBe(true);
    expect(flat(scrollOf(r).props.style).flexShrink).toBe(0);
  });

  it('room for a focus ring at every edge, and negative margins that keep the column in place', async () => {
    const r = await controls(true);
    const ring = borderWidth.thick + spacing.xxs;
    expect(flat(scrollOf(r).props.contentContainerStyle).padding).toBe(ring);
    expect(flat(scrollOf(r).props.style).margin).toBe(-ring);
  });

  it('scrolls to Next on a layout only while Next shows; back to the top when Next goes, not on the first layout', async () => {
    const r = await controls(false);
    await layOut(r);
    expect(scrolls).toEqual([]);
    await update(r, true);
    await layOut(r);
    expect(scrolls).toEqual([500]);
    await update(r, false);
    expect(scrolls).toEqual([500, 0]);
    await layOut(r);
    await update(r, false);
    expect(scrolls).toEqual([500, 0]);
  });
});

/** A host of the hook: what it returns, and every focus move it asks for. */
function TipHost({ tip, onFocus, onSaid }: { tip: string | null; onFocus: () => void; onSaid: (said: boolean) => void }): null {
  onSaid(useTipAfterFocus(tip, onFocus));
  return null;
}

describe('useTipAfterFocus: a tip is said once, after Next takes focus (TI-3b)', () => {
  const log: string[] = [];
  let said = false;
  const host = (tip: string | null) => <TipHost tip={tip} onFocus={() => void log.push('focus')} onSaid={(s) => void (said = s)} />;
  beforeEach(() => {
    log.length = 0;
    said = false;
  });

  it('focus first; the tip is in the region and told to VoiceOver TIP_AFTER_FOCUS_MS later, once', async () => {
    const r = await render(host('tip'));
    mounted.push(r);
    expect(log).toEqual(['focus']);
    expect(said).toBe(false);
    expect(announce.calls).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TIP_AFTER_FOCUS_MS);
    });
    expect(said).toBe(true);
    expect(announce.calls).toEqual(['tip']);
    await act(async () => {
      r.update(host('tip'));
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(log).toEqual(['focus']);
    expect(announce.calls).toEqual(['tip']);
  });

  it('no tip: no focus move, nothing said; a tip gone before its time is never said; the same tip again is said again', async () => {
    const r = await render(host(null));
    mounted.push(r);
    expect(log).toEqual([]);
    await act(async () => {
      r.update(host('tip'));
    });
    await act(async () => {
      r.update(host(null));
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(announce.calls).toEqual([]);
    expect(said).toBe(false);
    await act(async () => {
      r.update(host('tip'));
      await vi.advanceTimersByTimeAsync(TIP_AFTER_FOCUS_MS);
    });
    expect(log).toEqual(['focus', 'focus']);
    expect(announce.calls).toEqual(['tip']);
    expect(said).toBe(true);
  });

  it('leaving the screen before the tip is said says nothing', async () => {
    const r = await render(host('tip'));
    await unmount(r);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(announce.calls).toEqual([]);
  });
});
