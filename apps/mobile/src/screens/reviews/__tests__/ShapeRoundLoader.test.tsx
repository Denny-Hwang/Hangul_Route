import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeRound } from '../../../logic/reviews/review-rounds';
import { byTestId, press, resetPlatform } from '../../../test-support/render';

/**
 * F-CURR-002 row CM-33 (review of #865): a Match Shape review round whose chunk cannot load keeps a way on. It shows
 * Try again, which loads the chunk again, never a bare heading with nothing to press.
 */

const chunkState = vi.hoisted(() => ({ failed: true, retry: vi.fn() }));
vi.mock('../../minigames/match-shape-entry', () => ({
  useMatchShapeChunk: () => ({ chunk: null, failed: chunkState.failed, retry: chunkState.retry }),
}));

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const { ShapeRoundLoader } = await import('../ReviewRounds');

const ROUND: ShapeRound = {
  type: 'shape',
  target: 'jamo:bieup',
  lookAlike: 'jamo:pieup',
  question: { itemId: 'sym:bieup', kind: 'sym', rung: 'produce', format: 'match-shape', theme: 'letters', stretch: false, voiceFallback: false },
  answer: { ko: { ko: 'ㅂ', romanization: 'b/p' } },
};

const mounted: ReactTestRenderer[] = [];

async function mount(): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <ShapeRoundLoader round={ROUND} reducedMotion onFirst={vi.fn()} onSolved={vi.fn()} grade={() => 'miss'} />
      </LayoutProvider>,
    );
  });
  mounted.push(r);
  return r;
}

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  chunkState.failed = true;
  chunkState.retry.mockClear();
  resetPlatform();
});

describe('ShapeRoundLoader (row CM-33)', () => {
  it('offers Try again when the Match Shape chunk failed to load, and it loads the chunk again', async () => {
    const r = await mount();
    const retry = byTestId(r.root, 'daily-review-shape-retry').find((n) => typeof n.props.onClick === 'function');
    expect(retry).toBeDefined();
    await press(retry!);
    expect(chunkState.retry).toHaveBeenCalledTimes(1);
  });

  it('shows no Try again while the chunk is still loading', async () => {
    chunkState.failed = false;
    const r = await mount();
    expect(byTestId(r.root, 'daily-review-shape-retry')).toHaveLength(0);
  });
});
