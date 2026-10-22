import { decodeRetiredItem, decodeReviewItems, type ReviewItem, type ReviewItemsChunk } from '@hangul-route/content-schema/review-items';

/**
 * The review items at runtime (F-CURR-002 §4.2, §10, row CM-10). The start bundle holds only the
 * chunk's hash and its loader (`content/review-items.ts`, bound to the generated
 * `__generated__/review-items-index.ts`); the items themselves are one content-hashed chunk,
 * loaded on demand (the web build makes it a precached bundle, the native build keeps it in its
 * one bundle). The review engine (row CM-13) is the first reader.
 *
 * Pure over the injected loader, so the lazy path is testable without Metro. A loaded chunk is
 * checked against the hash the start bundle names, as the lesson chunks are (`lesson-store.ts`),
 * so a shell never reads the items of another build.
 */

/** The chunk that loaded carries another hash than the start bundle names (an older shell, a newer chunk). */
export class ReviewItemsChunkMismatch extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`the review-item chunk carries ${actual}, the start bundle names ${expected}`);
    this.name = 'ReviewItemsChunkMismatch';
  }
}

export interface ReviewItemIndex {
  items: readonly ReviewItem[];
  byId: ReadonlyMap<string, ReviewItem>;
  /** Never selected for review, out of every mastery denominator; their learner state stays. */
  retired: ReadonlySet<string>;
  /** A retired item's Korean by its id, so a report can name the item its kept state belongs to. */
  retiredById: ReadonlyMap<string, ReturnType<typeof decodeRetiredItem>>;
}

export interface ReviewItemStore {
  /** The index, loading the chunk the first time (and again after a failed load). */
  ensure(): Promise<ReviewItemIndex>;
  /** The index once it has loaded; undefined before. */
  current(): ReviewItemIndex | undefined;
}

export function createReviewItemStore(chunk: { hash: string; load: () => Promise<ReviewItemsChunk> }): ReviewItemStore {
  let index: ReviewItemIndex | undefined;
  let pending: Promise<ReviewItemIndex> | undefined;
  const loadOnce = async (): Promise<ReviewItemIndex> => {
    const loaded = await chunk.load();
    if (loaded.CHUNK_HASH !== chunk.hash) throw new ReviewItemsChunkMismatch(chunk.hash, loaded.CHUNK_HASH);
    const items = decodeReviewItems(loaded);
    const retired = loaded.REVIEW_RETIRED.map(decodeRetiredItem);
    index = {
      items,
      byId: new Map(items.map((item) => [item.id, item])),
      retired: new Set(retired.map((r) => r.id)),
      retiredById: new Map(retired.map((r) => [r.id, r])),
    };
    return index;
  };
  return {
    ensure() {
      if (index !== undefined) return Promise.resolve(index);
      pending ??= loadOnce().finally(() => {
        pending = undefined;
      });
      return pending;
    },
    current: () => index,
  };
}
