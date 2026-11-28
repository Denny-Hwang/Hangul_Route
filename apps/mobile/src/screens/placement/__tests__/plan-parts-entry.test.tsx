import { describe, expect, it, vi } from 'vitest';

/**
 * AMENDMENTS-START-BUNDLE-2026-11 SB-4d: the plan parts' door. A screen inside `placement-chunk` or `reports-chunk` reads
 * the parts through `usePlanParts()`: a named `PlanPartsMissing` before the door has them, the chunk's exports after.
 * `withPlanParts` loads a screen chunk with the parts and fails with either.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const { PlanPartsMissing, planPartsDoor, usePlanParts, withPlanParts } = await import('../plan-parts-entry');

describe('usePlanParts', () => {
  it('throws the named PlanPartsMissing before the door has the parts, and returns them after', async () => {
    expect(() => usePlanParts()).toThrow(PlanPartsMissing);
    expect(() => usePlanParts()).toThrow(/plan parts are not loaded/);
    try {
      usePlanParts();
    } catch (error) {
      expect((error as Error).name).toBe('PlanPartsMissing');
    }
    const parts = await planPartsDoor.load();
    expect(usePlanParts()).toBe(parts);
    // What both chunks read through the hook.
    for (const name of [
      'PLAN_PARTS_CHUNK',
      'placementRouteCatalog',
      'draftOfOffer',
      'grownUpWarnings',
      'grownUpWarningText',
      'stripLineOf',
      'acceptPlanOffer',
      'applyPlanUpdate',
      'keepPlan',
      'loadPlanOffer',
      'planOfferNow',
      'PaceChips',
      'PlanStrip',
      'PlanUpdateCard',
      'usePlacementBank',
    ]) {
      expect(parts, name).toHaveProperty(name);
    }
    expect(parts.PLAN_PARTS_CHUNK).toBe('screen-chunk:plan-parts');
  });
});

describe('withPlanParts', () => {
  it('resolves with the screen chunk only once both are in', async () => {
    let openParts = (): void => undefined;
    const parts = new Promise<void>((resolve) => {
      openParts = resolve;
    });
    const load = withPlanParts(async () => 'screen', () => parts);
    let done = false;
    const pending = load().then((c) => {
      done = true;
      return c;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(done).toBe(false);
    openParts();
    expect(await pending).toBe('screen');
  });

  it('fails with the plan parts, or with the screen chunk, each time it is asked', async () => {
    const importParts = vi.fn<() => Promise<unknown>>().mockRejectedValueOnce(new Error('parts offline')).mockResolvedValue(undefined);
    const load = withPlanParts(async () => 'screen', importParts);
    await expect(load()).rejects.toThrow('parts offline');
    await expect(load()).resolves.toBe('screen');
    expect(importParts).toHaveBeenCalledTimes(2);

    const importScreen = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('screen offline')).mockResolvedValue('screen');
    const both = withPlanParts(importScreen, async () => undefined);
    await expect(both()).rejects.toThrow('screen offline');
    await expect(both()).resolves.toBe('screen');
  });
});
