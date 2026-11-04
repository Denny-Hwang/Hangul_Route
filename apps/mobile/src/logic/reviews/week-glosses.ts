import type { WeekDropEntry, WeekDropsChunk } from '@hangul-route/content-schema/week-drops';
import { WEEK_DROPS_HASH, loadWeekDrops } from '../../content/__generated__/week-drops-index';
import { CONTENT_OVERLAYS } from '../content-locale';
import { mergeOverlaysInto } from '../lessons/lesson-store';

/*
 * The "This week in Korea" word meanings for the review rounds (F-CURR-002 §5.7, row CM-48): a drop's word that review
 * asks (the Daily Review, Keep going, the warm-up, the drop's own practice) is glossed at `week:<monday>#items.<id>.gloss`,
 * which the week-drop chunk holds. This loader is the memory chunk's (`logic/memory/memory-chunk.ts` builds it): it loads
 * that chunk once, checks its hash against the start bundle's, and lays the es and ko meanings into the content overlays
 * the rounds read (`CONTENT_OVERLAYS`). The drop's own screen chunk reads the same chunk through its store
 * (`logic/week-drop/drop-store.ts`); the two never share a module.
 */

export type GlossTable = Record<string, Record<string, string>>;

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

/** Loads the drops' meanings once (again after a failed load) and lays them in with `install`; rejects on another build's chunk. */
export function createWeekGlossLoader(chunk: { hash: string; load: () => Promise<WeekDropsChunk> }, install: (tables: ReturnType<typeof weekGlossTables>) => void): () => Promise<void> {
  let loading: Promise<void> | null = null;
  return () => {
    if (loading === null) {
      const next = chunk.load().then((mod) => {
        if (mod.CHUNK_HASH !== chunk.hash) throw new Error(`the week-drop chunk carries ${mod.CHUNK_HASH}, the start bundle names ${chunk.hash}`);
        install(weekGlossTables(mod.WEEK_DROPS));
      });
      loading = next;
      next.catch(() => {
        if (loading === next) loading = null;
      });
    }
    return loading;
  };
}

/** This build's loader: the memory chunk's Daily Review, warm-up and week practice read the meanings through it. */
export const weekGlosses = createWeekGlossLoader({ hash: WEEK_DROPS_HASH, load: loadWeekDrops }, (tables) =>
  mergeOverlaysInto(CONTENT_OVERLAYS as Parameters<typeof mergeOverlaysInto>[0], tables),
);
