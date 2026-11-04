import type { WeekDropEntry, WeekDropsChunk } from '@hangul-route/content-schema/week-drops';
import { WEEK_DROPS_HASH, loadWeekDrops } from '../../content/__generated__/week-drops-index';

/*
 * The week-drop chunk for the drop's own card and pages (F-CURR-002 §5.7 and §10, row CM-48). The start bundle holds only
 * the generated index (the chunk's hash, the Mondays that have a drop and the loader); the drops are one content-hashed
 * chunk, loaded on demand (a precached web bundle; the native build keeps it in its one bundle), so the right drop shows
 * with the network off. A loaded chunk is checked against the hash the start bundle names, as the lesson and review-item
 * chunks are, so a shell never reads another build's drops. This module is the week-drop screen chunk's only; the memory
 * chunk reads the drops' word meanings through its own loader (`logic/reviews/week-glosses.ts`), so no module sits in
 * two chunks.
 */

export class WeekDropsChunkMismatch extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`the week-drop chunk carries ${actual}, the start bundle names ${expected}`);
    this.name = 'WeekDropsChunkMismatch';
  }
}

export interface WeekDropStore {
  /** The drops, loading the chunk the first time (and again after a failed load). */
  ensure(): Promise<readonly WeekDropEntry[]>;
  /** The drop of a week (its Monday), loading the chunk; undefined when none. */
  dropOf(week: string): Promise<WeekDropEntry | undefined>;
}

export function createWeekDropStore(chunk: { hash: string; load: () => Promise<WeekDropsChunk> }): WeekDropStore {
  let loading: Promise<readonly WeekDropEntry[]> | null = null;
  const ensure = (): Promise<readonly WeekDropEntry[]> => {
    if (loading === null) {
      const next = chunk.load().then((mod) => {
        if (mod.CHUNK_HASH !== chunk.hash) throw new WeekDropsChunkMismatch(chunk.hash, mod.CHUNK_HASH);
        return mod.WEEK_DROPS;
      });
      loading = next;
      // A failed load (offline before the precache, another build's chunk) is asked for again next time.
      next.catch(() => {
        if (loading === next) loading = null;
      });
    }
    return loading;
  };
  return {
    ensure,
    dropOf: (week) => ensure().then((drops) => drops.find((d) => d.weekOf === week)),
  };
}

/** The drops of this build, for the card and the pages. */
export const weekDrops = createWeekDropStore({ hash: WEEK_DROPS_HASH, load: loadWeekDrops });
