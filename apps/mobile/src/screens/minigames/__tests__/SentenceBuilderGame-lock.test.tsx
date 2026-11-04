import { TAP_LOCK_MS, TapLockProvider, motion } from '@hangul-route/design-system';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EAT_RICE } from '../../../logic/sentence-builder/__tests__/fixtures';
import { byTestId, render, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { SentenceBuilderGame } from '../SentenceBuilderGame';

/**
 * AMENDMENTS-TOUCH row KT-5, section 6.3 (F5; KT-D5, KT-D10): the tray is one `board` TapBoard, Skip sits outside it
 * and reads the app-level lock (`useTapLock()`), and a missed tile's slide back (`RETURN_MS`, 520 ms) extends that lock.
 * So a bounce off a tile is never a second tile 200 ms later, nor Skip 100 ms later. The taps go straight to the host
 * click handler (the click path of rule 9, which takes the same lock), with fake timers driving the boards' clock.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: vi.fn(() => Promise.resolve('played' as const)),
  warmClips: vi.fn(() => Promise.resolve()),
  stop: vi.fn(),
}));

// Full motion: the slide back runs (under reduced motion a missed tile is back at once and holds no lock).
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));

/** The slide back of a missed tile: slide, hold, slide (SentenceBuilderGame's `RETURN_MS`). */
const RETURN_MS = 2 * motion.duration.base + motion.duration.fast;

interface Log {
  answers: Array<[number, boolean]>;
  completes: number;
}

function hostOf(log: Log): MinigameHost {
  return { mode: 'quest', answer: (key, correct) => void log.answers.push([Number(key), correct]), complete: () => void (log.completes += 1) };
}

const clickable = (root: ReactTestInstance, testId: string): ReactTestInstance | undefined =>
  byTestId(root, testId).find((n) => typeof n.props.onClick === 'function');

/** A click as react-native-web's press responder gets it, straight to the host's handler: the tap clock is not moved. */
async function click(root: ReactTestInstance, testId: string): Promise<void> {
  const target = clickable(root, testId);
  if (target === undefined) throw new Error(`no ${testId}`);
  const currentTarget = { getAttribute: (name: string): unknown => target.props[name] ?? null, tagName: String(target.type) };
  await act(async () => {
    (target.props.onClick as (e: unknown) => void)({ altKey: false, currentTarget, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined });
  });
}

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const placed = (root: ReactTestInstance): number => byTestId(root, 'sentence-builder-placed').length;

const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

async function mount(log: Log): Promise<ReactTestRenderer> {
  const r = await render(
    <TapLockProvider>
      <SentenceBuilderGame scope={{ kind: 'order-it', rounds: 1, orderIt: { rounds: [EAT_RICE] } }} host={hostOf(log)} />
    </TapLockProvider>,
  );
  mounted.push(r);
  await tick(TAP_LOCK_MS);
  return r;
}

describe('Sentence Builder on a board: a bounce is never a second tile or a Skip (AMENDMENTS-TOUCH KT-5, F5)', () => {
  it('a Skip press 100 ms after a tray commit is ignored; one after the lock completes the step once', async () => {
    const log: Log = { answers: [], completes: 0 };
    const r = await mount(log);
    await click(r.root, 'sentence-builder-tile-w0');
    expect(placed(r.root)).toBe(1);
    await tick(100);
    await click(r.root, 'sentence-builder-skip');
    expect(log.completes).toBe(0);
    // Nothing changed on the screen: Skip is still there, the tray still waits for the next word.
    expect(clickable(r.root, 'sentence-builder-skip')).toBeDefined();
    expect(clickable(r.root, 'sentence-builder-tile-w1')).toBeDefined();
    await tick(TAP_LOCK_MS);
    await click(r.root, 'sentence-builder-skip');
    expect(log.completes).toBe(1);
    expect(log.answers).toEqual([]);
  });

  it('a bounce 200 ms after a right tile, on the tile that slid under the finger, is no miss', async () => {
    const log: Log = { answers: [], completes: 0 };
    const r = await mount(log);
    await click(r.root, 'sentence-builder-tile-w0');
    await tick(200);
    await click(r.root, 'sentence-builder-tile-d0');
    expect(log.answers).toEqual([]);
    expect(byTestId(r.root, 'sentence-builder-returning')).toHaveLength(0);
    // Past the lock, a deliberate tap counts.
    await tick(TAP_LOCK_MS);
    await click(r.root, 'sentence-builder-tile-w1');
    expect(placed(r.root)).toBe(2);
    expect(log.answers).toEqual([[0, true]]);
  });

  it('a missed tile slides back under the app lock: a tile or Skip pressed past TAP_LOCK_MS but inside RETURN_MS waits', async () => {
    expect(RETURN_MS).toBe(520);
    const log: Log = { answers: [], completes: 0 };
    const r = await mount(log);
    await click(r.root, 'sentence-builder-tile-d0');
    expect(log.answers).toEqual([[0, false]]);
    await tick(TAP_LOCK_MS + 50);
    await click(r.root, 'sentence-builder-skip');
    await click(r.root, 'sentence-builder-tile-w0');
    expect(log.completes).toBe(0);
    expect(placed(r.root)).toBe(0);
    // The tile is back and the lock is over: both count again.
    await tick(RETURN_MS - TAP_LOCK_MS);
    expect(byTestId(r.root, 'sentence-builder-returning')).toHaveLength(0);
    await click(r.root, 'sentence-builder-tile-w0');
    expect(placed(r.root)).toBe(1);
    await tick(TAP_LOCK_MS);
    await click(r.root, 'sentence-builder-skip');
    expect(log.completes).toBe(1);
  });
});
