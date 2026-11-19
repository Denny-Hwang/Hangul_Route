import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLACEMENT_BANK, PLACEMENT_WARMUP } from '../placement.generated';
import { PlacementBankInvalid, loadPlacementBank, placementBankNow, resetPlacementBankForTests } from '../placement-bank';
import { PLACEMENT_BANK_CHUNK } from '../placement-bank-chunk';

/**
 * AMENDMENTS-FINISH-2026-11 FN-7: the level check's bank loads from its own chunk, once per app session, for the check
 * and its report alike; a load that fails is asked again by the next call, and a bank that does not parse fails the load.
 */

type Chunk = typeof import('../placement-bank-chunk');
const chunk: Chunk = { PLACEMENT_BANK_CHUNK, PLACEMENT_BANK, PLACEMENT_WARMUP };

afterEach(() => resetPlacementBankForTests());

describe('loadPlacementBank (FN-7)', () => {
  it('the chunk module carries the generated bank and warm-up, and its marker', async () => {
    expect(PLACEMENT_BANK_CHUNK).toBe('placement-bank-chunk:bank');
    const loaded = await loadPlacementBank();
    expect(loaded.bank).toBe(PLACEMENT_BANK);
    expect(loaded.warmup).toBe(PLACEMENT_WARMUP);
  });

  it('loads the chunk once: callers share the load, and the bank is there at once after it', async () => {
    const load = vi.fn(async () => chunk);
    expect(placementBankNow()).toBeNull();
    const [a, b] = await Promise.all([loadPlacementBank(load), loadPlacementBank(load)]);
    expect(a).toBe(b);
    expect(await loadPlacementBank(load)).toBe(a);
    expect(load).toHaveBeenCalledTimes(1);
    expect(placementBankNow()).toBe(a);
  });

  it('a load that fails is not kept: the next call asks the chunk again', async () => {
    vi.useFakeTimers();
    try {
      const load = vi.fn<() => Promise<Chunk>>().mockRejectedValue(new Error('offline'));
      const first = loadPlacementBank(load);
      const settled = expect(first).rejects.toThrow('offline');
      // The chunk retry asks twice more (0.4 s, 1.5 s) before it gives up.
      await vi.advanceTimersByTimeAsync(2_000);
      await settled;
      expect(load).toHaveBeenCalledTimes(3);
      expect(placementBankNow()).toBeNull();
      load.mockResolvedValue(chunk);
      await expect(loadPlacementBank(load)).resolves.toEqual({ bank: PLACEMENT_BANK, warmup: PLACEMENT_WARMUP });
      expect(load).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a bank that does not parse fails the load (F-PLC-001 section 3.11: no check with no questions)', async () => {
    const broken = { ...chunk, PLACEMENT_BANK: { version: 1, templates: [] } } as unknown as Chunk;
    await expect(loadPlacementBank(async () => broken)).rejects.toBeInstanceOf(PlacementBankInvalid);
    expect(placementBankNow()).toBeNull();
    await expect(loadPlacementBank(async () => chunk)).resolves.toEqual({ bank: PLACEMENT_BANK, warmup: PLACEMENT_WARMUP });
  });
});
