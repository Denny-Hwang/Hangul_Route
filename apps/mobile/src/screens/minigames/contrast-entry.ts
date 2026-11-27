import { useEffect, useState } from 'react';

/*
 * The start bundle's door to the contrast chunk (AMENDMENTS-MINIMAL-PAIRS row MP-2a): the catalogue of contrast sets, the
 * draw and the compare row live in `contrast-chunk.tsx`, reached only through the literal `import()` below, so the start
 * bundle carries this file only. Like `dictation-entry.ts`.
 */

export type ContrastKit = typeof import('./contrast-chunk');

let loading: Promise<ContrastKit> | null = null;
let loaded: ContrastKit | null = null;

/** The contrast chunk, loaded once; a failed load (offline before the precache) is tried again on the next call. */
export function loadContrastKit(): Promise<ContrastKit> {
  loading ??= import('./contrast-chunk').then(
    (chunk) => {
      loaded = chunk;
      return chunk;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

/**
 * The chunk when `needed` (null while it loads), `'failed'` when it could not load; null when not needed. A failure stands
 * for the life of the hook (the step's mount), so a step never changes under the learner; the next step's mount tries again.
 */
export function useContrastKit(needed: boolean): ContrastKit | 'failed' | null {
  const [kit, setKit] = useState<ContrastKit | 'failed' | null>(loaded);
  useEffect(() => {
    if (!needed || kit !== null) return undefined;
    let live = true;
    loadContrastKit().then(
      (chunk) => {
        if (live) setKit(chunk);
      },
      () => {
        if (live) setKit('failed');
      },
    );
    return () => {
      live = false;
    };
  }, [needed, kit]);
  return needed ? kit : null;
}
