import { createElement, type FunctionComponent } from 'react';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_RETRY_DELAYS_MS } from '../../../logic/lessons/chunk-retry';
import { buttonsNamed, byTestId, press, render, unmount } from '../../../test-support/render';

/**
 * AMENDMENTS-START-BUNDLE-2026-11 SB-4d, decision D4: the level check's door and the reports' door wait for the plan
 * parts together with their own chunk, under ONE retry level. Neither route draws before both are in (the waiting screen
 * stays), a lasting failure of either reaches the crash screen's Try again after exactly the attempts of
 * `CHUNK_RETRY_DELAYS_MS` (the same wait as before the row, not nested retries), and Try again asks for both again.
 * The chunks are stand-ins whose imports this file controls; the retry's backoff waits are skipped.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const control = vi.hoisted(() => ({
  parts: { imports: 0, failures: 0, gate: null as Promise<void> | null },
  screen: { imports: 0, failures: 0, gate: null as Promise<void> | null },
  retries: 0,
  waits: [] as number[],
}));

/** The stand-in chunks, registered afresh for each test (a mock's result is kept per registration), so every door starts empty. */
function mockChunks(): void {
  vi.doMock('../plan-parts-chunk', async () => {
    control.parts.imports += 1;
    await control.parts.gate;
    if (control.parts.failures > 0) {
      control.parts.failures -= 1;
      throw new Error('offline');
    }
    return { PlanStrip: () => null };
  });
  const screenChunk = (exports: (h: typeof createElement) => Record<string, unknown>) => async () => {
    control.screen.imports += 1;
    await control.screen.gate;
    if (control.screen.failures > 0) {
      control.screen.failures -= 1;
      throw new Error('offline');
    }
    const { createElement: h } = await import('react');
    return exports(h);
  };
  vi.doMock('../placement-chunk', screenChunk((h) => ({ PlacementScreen: () => h('div', { 'data-testid': 'placement-stub' }) })));
  vi.doMock(
    '../../parent/reports-chunk',
    screenChunk((h) => ({
      LearnerReportScreen: () => h('div', { 'data-testid': 'learner-report-stub' }),
      PlacementReportScreen: () => h('div', { 'data-testid': 'placement-report-stub' }),
    })),
  );
  // The real retry, with its backoff waits recorded and skipped; one call per door load.
  vi.doMock('../../../logic/lessons/chunk-retry', async (importOriginal) => {
    const real = await importOriginal<typeof import('../../../logic/lessons/chunk-retry')>();
    return {
      ...real,
      retryLoad: <T,>(load: () => Promise<T>) => {
        control.retries += 1;
        return real.retryLoad(load, real.CHUNK_RETRY_DELAYS_MS, async (ms) => {
          control.waits.push(ms);
        });
      },
    };
  });
}

const mounted: ReactTestRenderer[] = [];
const settle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
async function until(ready: () => boolean): Promise<void> {
  await vi.waitFor(
    async () => {
      await settle();
      if (!ready()) throw new Error('not yet');
    },
    { timeout: 10_000, interval: 10 },
  );
}
const gateOf = (): { gate: Promise<void>; open: () => void } => {
  let open = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { gate, open };
};

/** Fresh doors (their state is module state): the entry modules are imported again for each test. */
async function doors() {
  vi.resetModules();
  mockChunks();
  const placement = await import('../placement-entry');
  const reports = await import('../../parent/reports-entry');
  const parts = await import('../plan-parts-entry');
  // The routes take their own navigation props; the stand-ins here ignore them.
  const routes = {
    PlacementScreen: placement.PlacementScreen,
    PlacementReportRoute: reports.PlacementReportRoute,
    LearnerReportRoute: reports.LearnerReportRoute,
  } as unknown as Record<'PlacementScreen' | 'PlacementReportRoute' | 'LearnerReportRoute', FunctionComponent<object>>;
  return { ...routes, planPartsDoor: parts.planPartsDoor };
}
const props = { navigation: { goBack: vi.fn() }, route: { key: 'k', name: 'x', params: {} } } as never;

beforeEach(() => {
  control.parts = { imports: 0, failures: 0, gate: null };
  control.screen = { imports: 0, failures: 0, gate: null };
  control.retries = 0;
  control.waits = [];
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

const cases = [
  ['the level check door', 'PlacementScreen', 'placement-stub'],
  ['the level-check report door', 'PlacementReportRoute', 'placement-report-stub'],
  ['the learner report door', 'LearnerReportRoute', 'learner-report-stub'],
] as const;

for (const [name, door, stub] of cases) {
  describe(name, () => {
    it('keeps the waiting screen until its chunk AND the plan parts are in, then draws the screen once', async () => {
      const parts = gateOf();
      const screen = gateOf();
      control.parts.gate = parts.gate;
      control.screen.gate = screen.gate;
      const d = await doors();
      const r = await render(createElement(d[door], props));
      mounted.push(r);
      await settle();
      expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
      // The screen chunk alone is not enough ...
      screen.open();
      await settle();
      expect(byTestId(r.root, stub)).toHaveLength(0);
      expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
      expect(d.planPartsDoor.now()).toBeNull();
      // ... the parts complete the load.
      parts.open();
      await until(() => byTestId(r.root, stub).length > 0);
      expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(0);
      expect(d.planPartsDoor.now()).not.toBeNull();
      expect(control.retries).toBe(1);
    });

    it('draws no screen while only the plan parts are late', async () => {
      const parts = gateOf();
      control.parts.gate = parts.gate;
      const d = await doors();
      const r = await render(createElement(d[door], props));
      mounted.push(r);
      await settle();
      await settle();
      expect(control.screen.imports).toBe(1);
      expect(byTestId(r.root, stub)).toHaveLength(0);
      expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
      parts.open();
      await until(() => byTestId(r.root, stub).length > 0);
    });

    it('a lasting plan-parts failure reaches the crash screen after exactly the attempts of CHUNK_RETRY_DELAYS_MS, under one retry level; Try again asks for both again', async () => {
      control.parts.failures = Number.POSITIVE_INFINITY;
      const d = await doors();
      const r = await render(createElement(d[door], props));
      mounted.push(r);
      await until(() => buttonsNamed(r.root, 'Try again').length > 0);
      expect(control.parts.imports).toBe(1 + CHUNK_RETRY_DELAYS_MS.length);
      expect(control.waits).toEqual([...CHUNK_RETRY_DELAYS_MS]);
      // One retry level: not a retry of the parts inside a retry of the screen chunk.
      expect(control.retries).toBe(1);
      expect(byTestId(r.root, stub)).toHaveLength(0);
      expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(0);

      control.parts.failures = 0;
      await press(buttonsNamed(r.root, 'Try again')[0]!);
      await until(() => byTestId(r.root, stub).length > 0);
      expect(control.retries).toBe(2);
    });

    it('a lasting screen-chunk failure waits the same attempts; Try again asks again', async () => {
      control.screen.failures = Number.POSITIVE_INFINITY;
      const d = await doors();
      const r = await render(createElement(d[door], props));
      mounted.push(r);
      await until(() => buttonsNamed(r.root, 'Try again').length > 0);
      expect(control.screen.imports).toBe(1 + CHUNK_RETRY_DELAYS_MS.length);
      expect(control.waits).toEqual([...CHUNK_RETRY_DELAYS_MS]);
      expect(control.retries).toBe(1);
      control.screen.failures = 0;
      await press(buttonsNamed(r.root, 'Try again')[0]!);
      await until(() => byTestId(r.root, stub).length > 0);
    });
  });
}
