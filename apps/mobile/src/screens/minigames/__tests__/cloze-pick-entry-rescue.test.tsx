import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clozeFixtureScope } from '../../../logic/cloze-pick/e2e-rounds';
import { tileId } from '../../../logic/cloze-pick/round';
import { LISTEN_PICK_TIMING } from '../../../logic/listen-pick-flow';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { ClozePickStep, type ClozePickRendered } from '../cloze-pick-entry';

/**
 * F-CURR-002 row CM-30, section 12.2 (no switch bricks a quest): the Listen & Pick fallback is in the start bundle with
 * the door, never in the Cloze Pick chunk. With `game.cloze-pick` off nothing is loaded, so a chunk that cannot load
 * (offline before the app was cached, a bad build) never touches the step; with it on, such a chunk plays the fallback
 * too, never the crash screen and never a blank step.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const flag = vi.hoisted(() => ({ value: false as boolean | null }));
const chunk = vi.hoisted(() => ({ asked: 0 }));
vi.mock('../../../store/remote-config-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCurrFlagDecided: () => flag.value,
}));
vi.mock('../cloze-pick-chunk', () => {
  chunk.asked += 1;
  throw new Error('offline: the chunk is not cached');
});
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: vi.fn(() => Promise.resolve('played' as const)),
  stop: vi.fn(),
  hasClip: vi.fn(() => false),
}));

const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

async function playToTheEnd(on: boolean) {
  flag.value = on;
  const rendered: ClozePickRendered[] = [];
  const h = { mode: 'quest' as const, answers: [] as Array<[string | number, boolean]>, completes: 0, answer: (k: string | number, c: boolean) => void h.answers.push([k, c]), complete: () => void (h.completes += 1) };
  const r = await render(<ClozePickStep scope={clozeFixtureScope(['word', 'value'])} host={h} onRendered={(k) => rendered.push(k)} />);
  mounted.push(r);
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await vi.dynamicImportSettled();
    });
  }
  expect(screenTexts(r.root)).not.toContain(getMessages('en').learner.oops.title);
  for (const id of ['e2e-cloze-word', 'e2e-cloze-value']) {
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    const node = byTestId(r.root, `listen-pick-option-${tileId(id, 0)}`).find((n) => typeof n.props.onClick === 'function');
    expect(node, id).toBeDefined();
    await press(node!);
    await act(async () => {
      vi.advanceTimersByTime(LISTEN_PICK_TIMING.advanceDelayMs);
    });
  }
  return { rendered, h };
}

describe('the Cloze Pick chunk cannot load', () => {
  it('switch off: nothing is loaded and the fallback plays every round to the end', async () => {
    const asked = chunk.asked;
    const { rendered, h } = await playToTheEnd(false);
    expect(chunk.asked).toBe(asked);
    expect(rendered.at(-1)).toBe('listen-pick');
    expect(h.answers).toEqual([
      [0, true],
      [1, true],
    ]);
    expect(h.completes).toBe(1);
  });

  it('switch on: the fallback plays instead of the crash screen, every round to the end', async () => {
    const { rendered, h } = await playToTheEnd(true);
    expect(rendered).toEqual(['listen-pick']);
    expect(h.answers).toEqual([
      [0, true],
      [1, true],
    ]);
    expect(h.completes).toBe(1);
  });
});
