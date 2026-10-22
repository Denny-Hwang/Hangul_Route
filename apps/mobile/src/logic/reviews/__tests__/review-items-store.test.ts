import { encodeRetiredItem, encodeReviewItems, type ReviewItem, type ReviewItemsChunk } from '@hangul-route/content-schema/review-items';
import { describe, expect, it, vi } from 'vitest';
import { reviewItemsChunk } from '../../../content/review-items';
import { REVIEW_ITEM_COUNT } from '../../../content/__generated__/review-items-index';
import { ReviewItemsChunkMismatch, createReviewItemStore } from '../review-items-store';

const item: ReviewItem = {
  id: 'lex:sagwa',
  kind: 'lex',
  ko: '사과',
  romanization: 'sagwa',
  en: 'apple',
  home: 'life',
  stage: 2,
  volume: 1,
  cells: ['episode:stage2-life'],
  asked: [],
  formats: ['hear-pick', 'read-pick'],
  soundChange: false,
  homophoneOf: [],
};

function chunkOf(hash: string, items: readonly ReviewItem[] = [item], retired: readonly string[] = []): ReviewItemsChunk {
  const { tables, rows } = encodeReviewItems(items);
  const REVIEW_RETIRED = retired.map((id) => encodeRetiredItem({ id, ko: '사과요', romanization: 'sagwayo' }));
  return { CHUNK_HASH: hash, REVIEW_ITEM_TABLES: tables, REVIEW_ITEM_ROWS: rows, REVIEW_RETIRED };
}

describe('the review-item store (F-CURR-002 §4.2, §10)', () => {
  it('loads the chunk on the first ensure only, and decodes its items', async () => {
    const load = vi.fn(async () => chunkOf('h1', [item], ['lex:sagwa-old']));
    const store = createReviewItemStore({ hash: 'h1', load });
    expect(store.current()).toBeUndefined();
    const [a, b] = await Promise.all([store.ensure(), store.ensure()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a.items).toEqual([item]);
    expect(a.byId.get('lex:sagwa')).toEqual(item);
    expect([...a.retired]).toEqual(['lex:sagwa-old']);
    // A retired item keeps its Korean for reports, and is in no row.
    expect(a.retiredById.get('lex:sagwa-old')).toEqual({ id: 'lex:sagwa-old', kind: 'lex', ko: '사과요', romanization: 'sagwayo' });
    expect(a.byId.has('lex:sagwa-old')).toBe(false);
    expect(await store.ensure()).toBe(a);
    expect(store.current()).toBe(a);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('refuses a chunk of another build, and loads again on the next ensure', async () => {
    const load = vi.fn().mockResolvedValueOnce(chunkOf('other')).mockResolvedValueOnce(chunkOf('h1'));
    const store = createReviewItemStore({ hash: 'h1', load });
    await expect(store.ensure()).rejects.toBeInstanceOf(ReviewItemsChunkMismatch);
    expect(store.current()).toBeUndefined();
    expect((await store.ensure()).items).toHaveLength(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('tries again after a failed load (offline before the precache filled)', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(chunkOf('h1'));
    const store = createReviewItemStore({ hash: 'h1', load });
    await expect(store.ensure()).rejects.toThrow('offline');
    expect((await store.ensure()).items).toEqual([item]);
  });

  it('reads the real generated chunk through the build binding: its hash matches and every row decodes', async () => {
    const store = createReviewItemStore(reviewItemsChunk);
    const index = await store.ensure();
    expect(index.items).toHaveLength(REVIEW_ITEM_COUNT);
    expect(index.byId.size).toBe(REVIEW_ITEM_COUNT);
    expect(index.items.every((i) => i.cells.length > 0 && i.formats.length > 0)).toBe(true);
  });
});
