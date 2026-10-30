import type { WeekDropEntry, WeekDropsChunk } from '@hangul-route/content-schema/week-drops';

/*
 * The week-drop chunk at runtime (F-CURR-002 §5.7 and §10, row CM-48). The start bundle holds only the chunk's hash,
 * the Mondays that have a drop and the loader (`content/week-drops.ts`); the drops are one content-hashed chunk, loaded
 * on demand (a precached web bundle; the native build keeps it in its one bundle). A loaded chunk is checked against
 * the hash the start bundle names, as the lesson and review-item chunks are, so a shell never reads another build's
 * drops. Each load also lays the drops' es and ko word meanings into the content overlays (`install`), so a review round
 * of a drop's word reads its meaning in the UI language (the gloss keys `week:<monday>#items.<id>.gloss`).
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

export type GlossTable = Record<string, Record<string, string>>;

export interface WeekDropStore {
  /** The drops, loading the chunk the first time (and again after a failed load). */
  ensure(): Promise<readonly WeekDropEntry[]>;
  /** The drop of a week (its Monday), loading the chunk; undefined when none. */
  dropOf(week: string): Promise<WeekDropEntry | undefined>;
}

/** The es and ko meanings of every drop's words, as overlay entries (`week:<monday>` -> `items.<id>.gloss`). */
export function weekGlossTables(drops: readonly WeekDropEntry[]): { es: GlossTable; ko: GlossTable } {
  const out: { es: GlossTable; ko: GlossTable } = { es: {}, ko: {} };
  for (const drop of drops) {
    for (const locale of ['es', 'ko'] as const) {
      const entry: Record<string, string> = {};
      for (const item of drop.items) {
        const text = item.gloss[locale];
        if (text !== undefined) entry[`items.${item.id}.gloss`] = text;
      }
      if (Object.keys(entry).length > 0) out[locale][drop.id] = entry;
    }
  }
  return out;
}

export function createWeekDropStore(chunk: { hash: string; load: () => Promise<WeekDropsChunk> }, install: (tables: ReturnType<typeof weekGlossTables>) => void): WeekDropStore {
  let loading: Promise<readonly WeekDropEntry[]> | null = null;
  const ensure = (): Promise<readonly WeekDropEntry[]> => {
    if (loading === null) {
      const next = chunk.load().then((mod) => {
        if (mod.CHUNK_HASH !== chunk.hash) throw new WeekDropsChunkMismatch(chunk.hash, mod.CHUNK_HASH);
        install(weekGlossTables(mod.WEEK_DROPS));
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
