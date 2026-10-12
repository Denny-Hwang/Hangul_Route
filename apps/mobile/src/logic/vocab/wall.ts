import type { RuntimeVocabItem, VocabProgress } from '@hangul-route/content-schema';

/**
 * The word wall on the topic page — F-VOC-003 section 3.4. Pure.
 *
 * Every word of the topic in file order. A collected word shows its picture
 * and opens its card; a new word shows a silhouette and no Korean. The order
 * never changes with progress: a stable position is the learner's memory
 * anchor (`design/wireframes/library/gallery.md`).
 */

export type WallTileState = 'collected' | 'new';

export interface WallTile {
  id: string;
  state: WallTileState;
}

export function wallTiles(items: readonly RuntimeVocabItem[], progress: VocabProgress): WallTile[] {
  const known = new Set(progress.items.map((s) => s.id));
  return items.map((item) => ({ id: item.id, state: known.has(item.id) ? 'collected' : 'new' }));
}
