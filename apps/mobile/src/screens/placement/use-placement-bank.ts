import { useEffect, useState } from 'react';
import { loadPlacementBank, placementBankNow, type LoadedPlacementBank } from '../../content/placement-bank';

/**
 * The level check's bank for a screen (AMENDMENTS-FINISH-2026-11 FN-7): null while its chunk loads (the screen keeps its
 * own loading state), `failed` when it cannot load (the crash screen's Try again calls `retry`), the bank once it is in.
 * A screen opened after the first load has it on its first render.
 */
export function usePlacementBank(): { bank: LoadedPlacementBank | null; failed: boolean; retry: () => void } {
  const [bank, setBank] = useState<LoadedPlacementBank | null>(placementBankNow);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (bank !== null || failed) return undefined;
    let live = true;
    loadPlacementBank().then(
      (loaded) => live && setBank(loaded),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [bank, failed]);
  return { bank, failed, retry: () => setFailed(false) };
}
