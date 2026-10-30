import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuildRound } from '../../../logic/reviews/review-rounds';
import { byTestId, press, screenTexts } from '../../../test-support/render';
import { BuildRoundLoader } from '../ReviewRounds';

/**
 * F-CURR-002 row CM-32 (Codex review of #855): the review session has already chosen a Syllable Build round, so a
 * chunk that fails to load (a stale cache, a dropped asset) must never leave the round on its heading for good. It
 * shows Hoya's oops line and Try again, and Try again asks for the chunk once more.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const chunkState = vi.hoisted(() => ({ failed: false, retry: vi.fn() }));
vi.mock('../../minigames/syllable-build-entry', () => ({
  useSyllableBuildChunk: () => ({ chunk: null, failed: chunkState.failed, retry: chunkState.retry }),
}));

const ROUND: BuildRound = {
  type: 'build',
  target: { ko: '밥', romanization: 'bap' },
  question: { itemId: 'syl:bap', kind: 'syl', rung: 'produce', format: 'build', theme: 'friends', stretch: false, voiceFallback: false },
  answer: { ko: { ko: '밥', romanization: 'bap' } },
} as unknown as BuildRound;

const mounted: ReactTestRenderer[] = [];

async function mount(): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <BuildRoundLoader round={ROUND} reducedMotion onFirst={() => undefined} onSolved={() => undefined} grade={() => 'miss'} />
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
  chunkState.failed = false;
  chunkState.retry.mockReset();
});

describe('the review build round while its chunk loads', () => {
  it('shows only the heading while the chunk is on its way', async () => {
    const r = await mount();
    expect(screenTexts(r.root)).toContain('Build the block you hear');
    expect(byTestId(r.root, 'daily-review-build-retry')).toHaveLength(0);
  });

  it('offers Try again when the chunk fails, and Try again asks for it once more', async () => {
    chunkState.failed = true;
    const r = await mount();
    const texts = screenTexts(r.root);
    expect(texts).toContain('Build the block you hear');
    expect(texts).toContain('Oops! That was not your fault. Tap the button and we go again.');
    const button = byTestId(r.root, 'daily-review-build-retry').find((n) => typeof n.props.onClick === 'function');
    expect(button).toBeDefined();
    await press(button!);
    expect(chunkState.retry).toHaveBeenCalledTimes(1);
  });
});
