import type { PlacementBank, PlacementTemplate } from '@hangul-route/content-schema';
import { retryLoad } from '../logic/lessons/chunk-retry';
import { placementBankReady } from '../logic/placement/entry';

/**
 * The level check's bank, loaded from its chunk (AMENDMENTS-FINISH-2026-11 FN-7; `./placement-bank-chunk.ts`). One load
 * per app session, shared by the check and its report; a failed load is asked again by the next call (the screens' Try
 * again). The bank is parsed once it is in (F-PLC-001 section 3.11): a bank that does not parse fails the load, as a
 * chunk that cannot load does, and the screen shows the crash screen instead of a check with no questions.
 */

export interface LoadedPlacementBank {
  bank: PlacementBank;
  warmup: PlacementTemplate;
}

type BankChunk = typeof import('./placement-bank-chunk');

/** The load's error when the bank does not parse (a development error: the content tests and the build catch it first). */
export class PlacementBankInvalid extends Error {
  override name = 'PlacementBankInvalid';
}

let loading: Promise<LoadedPlacementBank> | null = null;
let loaded: LoadedPlacementBank | null = null;

/** Loads the bank chunk, once; a failure is not kept, so the next call asks again. */
export function loadPlacementBank(load: () => Promise<BankChunk> = () => import('./placement-bank-chunk')): Promise<LoadedPlacementBank> {
  if (loading === null) {
    const pending = retryLoad(load).then((chunk) => {
      if (!placementBankReady(chunk.PLACEMENT_BANK, chunk.PLACEMENT_WARMUP)) throw new PlacementBankInvalid('the placement bank does not parse');
      loaded = { bank: chunk.PLACEMENT_BANK, warmup: chunk.PLACEMENT_WARMUP };
      return loaded;
    });
    pending.catch(() => {
      if (loading === pending) loading = null;
    });
    loading = pending;
  }
  return loading;
}

/** The bank when it is already in (a screen that opens after the first load draws at once), else null. */
export function placementBankNow(): LoadedPlacementBank | null {
  return loaded;
}

/** Tests: forget the load. */
export function resetPlacementBankForTests(): void {
  loading = null;
  loaded = null;
}
