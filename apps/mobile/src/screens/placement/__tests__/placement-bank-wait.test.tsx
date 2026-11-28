import { act, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PLACEMENT_BANK, PLACEMENT_WARMUP } from '../../../content/placement.generated';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';

/**
 * AMENDMENTS-FINISH-2026-11 FN-7: the level check's bank is a chunk of its own. `usePlacementBank` gives a screen null
 * while it loads, the bank once it is in (at once for a screen opened after the first load), and `failed` with a Try
 * again that asks again when it cannot load. The grown-up report waits on the lesson waiting screen meanwhile.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

/**
 * `gate`, when set, holds every load until the test opens it. `render` resolves only after React's async `act` yields a
 * macrotask, and under CI load a 0 ms timer can fire in that gap, so a test that asserts the loading state right after
 * `render` must hold the load open itself rather than race a timer.
 */
const loader = vi.hoisted(() => ({
  calls: 0,
  next: [] as ('ok' | 'fail')[],
  now: null as unknown,
  gate: null as Promise<void> | null,
}));
vi.mock('../../../content/placement-bank', () => ({
  placementBankNow: () => loader.now,
  loadPlacementBank: async () => {
    loader.calls += 1;
    await (loader.gate ?? new Promise((resolve) => setTimeout(resolve, 0)));
    if (loader.next.shift() === 'fail') throw new Error('offline');
    loader.now = { bank: PLACEMENT_BANK, warmup: PLACEMENT_WARMUP };
    return loader.now;
  },
}));
const { usePlacementBank } = await import('../use-placement-bank');
const { PlacementReportScreen } = await import('../../parent/PlacementReportScreen');
const { planPartsDoor } = await import('../plan-parts-entry');
// The report's door waits for the plan parts before the screen draws (SB-4d); this file's mock of the bank is what they use.
beforeAll(async () => {
  await planPartsDoor.load();
});

const seen: { bank: unknown; failed: boolean }[] = [];
let retryNow: () => void = () => undefined;
function Probe(): ReactElement {
  const { bank, failed, retry } = usePlacementBank();
  seen.push({ bank, failed });
  retryNow = retry;
  return createElement('div', { 'data-testid': bank === null ? (failed ? 'failed' : 'loading') : 'ready' });
}

const mounted: ReactTestRenderer[] = [];
const settle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** Waits until `ready` holds (the loader settles an unknown number of ticks away, more under load). */
async function until(ready: () => boolean): Promise<void> {
  await vi.waitFor(
    async () => {
      await settle();
      if (!ready()) throw new Error('not yet');
    },
    { timeout: 10_000, interval: 10 },
  );
}

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  seen.length = 0;
  loader.calls = 0;
  loader.next = [];
  loader.now = null;
  loader.gate = null;
});

describe('usePlacementBank (FN-7)', () => {
  it('null while the chunk loads, then the bank', async () => {
    const r = await render(createElement(Probe));
    mounted.push(r);
    expect(seen[0]).toEqual({ bank: null, failed: false });
    await until(() => byTestId(r.root, 'ready').length > 0);
    expect(loader.calls).toBe(1);
  });

  it('a screen opened after the first load has the bank on its first render, and loads nothing', async () => {
    loader.now = { bank: PLACEMENT_BANK, warmup: PLACEMENT_WARMUP };
    const r = await render(createElement(Probe));
    mounted.push(r);
    expect(seen[0]?.bank).toEqual({ bank: PLACEMENT_BANK, warmup: PLACEMENT_WARMUP });
    expect(loader.calls).toBe(0);
  });

  it('a load that fails reports failed; Try again asks again', async () => {
    loader.next = ['fail'];
    const r = await render(createElement(Probe));
    mounted.push(r);
    await until(() => byTestId(r.root, 'failed').length > 0);
    await act(async () => retryNow());
    await until(() => byTestId(r.root, 'ready').length > 0);
    expect(loader.calls).toBe(2);
  });
});

describe('the level-check report waits for the bank (FN-7)', () => {
  const props = {
    navigation: { goBack: vi.fn(), replace: vi.fn() },
    route: { key: 'k', name: 'PlacementReport', params: { profileId: 'profile:mina' } },
  } as unknown as Parameters<typeof PlacementReportScreen>[0];

  it('shows the lesson waiting screen until the bank is in, then the report', async () => {
    loader.next = ['fail'];
    let open: () => void = () => undefined;
    loader.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const r = await render(createElement(PlacementReportScreen, props));
    mounted.push(r);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
    expect(loader.calls).toBe(1);
    open();
    await until(() => buttonsNamed(r.root, 'Try again').length > 0);
    // It could not load: the crash screen, whose Try again asks again.
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(0);
    expect(buttonsNamed(r.root, 'Try again')).toHaveLength(1);
    expect(loader.calls).toBe(1);
    await press(buttonsNamed(r.root, 'Try again')[0]!);
    await until(() => screenTexts(r.root).includes('No check taken yet.'));
    expect(loader.calls).toBe(2);
    expect(buttonsNamed(r.root, 'Try again')).toHaveLength(0);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(0);
    // The report itself (no check taken by this learner yet).
    expect(screenTexts(r.root)).toContain('No check taken yet.');
  });
});
