import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clozeFixtureScope } from '../../../logic/cloze-pick/e2e-rounds';
import { byTestId, cleanup, render, screenTexts } from '../../../test-support/render';
import { ClozePickStep, type ClozePickRendered } from '../cloze-pick-entry';
import { getMessages } from '@hangul-route/i18n';

/**
 * F-CURR-002 row CM-30: the game and its fallback are one precached chunk; one that cannot load (offline before the
 * app was cached) shows the crash screen's Try again, as the Cell Check does, never a blank step.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../store/remote-config-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCurrFlagDecided: () => true,
}));
vi.mock('../cloze-pick-chunk', () => {
  throw new Error('offline: the chunk is not cached');
});

afterEach(cleanup);

describe('the Cloze Pick chunk cannot load', () => {
  it('shows Try again instead of a blank step', async () => {
    const rendered: ClozePickRendered[] = [];
    const h = { mode: 'quest' as const, answer: () => undefined, complete: () => undefined };
    const r = await render(<ClozePickStep scope={clozeFixtureScope(['word'])} host={h} onRendered={(k) => rendered.push(k)} />);
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(rendered).toEqual([]);
    expect(byTestId(r.root, 'listen-pick-options')).toHaveLength(0);
    expect(screenTexts(r.root)).toContain(getMessages('en').learner.oops.title);
  });
});
