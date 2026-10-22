import { describe, expect, it } from 'vitest';
import {
  GATED_REVIEW_KINDS,
  RETAINED_REVIEW_KINDS,
  REVIEW_RETENTION_DAYS,
  ReviewEntrySchema,
  pruneReviews,
  reviewsForReader,
  type ReviewEntry,
} from '../index';

/**
 * F-CURR-002 section 13 (row CM-15): the first row that writes a `warmup` review gates it on the app version.
 * A build from before CM-3b reads `reviews[]` strictly, so a copy holding one fails whole; the reader declares
 * the kinds it reads (`?cap=warmup`) and every other reader gets the copy without them.
 */

const entry = (id: string, kind: ReviewEntry['kind'], scope: string, extra: Partial<ReviewEntry> = {}): ReviewEntry =>
  ReviewEntrySchema.parse({ id, kind, generatedAt: `${scope}T10:00:00.000Z`, scope, itemIds: ['lex:bap'], ...extra });

describe('the gated review kinds', () => {
  it('names warmup, the kind row CM-15 writes first', () => {
    expect(GATED_REVIEW_KINDS).toEqual(['warmup']);
  });

  it('keeps the warm-up entries out of a copy for a reader that does not declare them, and returns the list itself otherwise', () => {
    const list = [entry('feedback:2026-10-20', 'feedback', '2026-10-20', { resultStars: 2 }), entry('warmup:2026-10-20', 'warmup', '2026-10-20')];
    expect(reviewsForReader(list, new Set<string>()).map((r) => r.id)).toEqual(['feedback:2026-10-20']);
    expect(reviewsForReader(list, new Set(['curriculum'])).map((r) => r.id)).toEqual(['feedback:2026-10-20']);
    expect(reviewsForReader(list, new Set(['warmup']))).toBe(list);
    const plain = [entry('feedback:2026-10-20', 'feedback', '2026-10-20')];
    expect(reviewsForReader(plain, new Set<string>())).toBe(plain);
  });
});

describe('the 14-day retention of warm-up and Try these again entries', () => {
  it('covers warmup and feedback only, 14 local days', () => {
    expect(RETAINED_REVIEW_KINDS).toEqual(['warmup', 'feedback']);
    expect(REVIEW_RETENTION_DAYS).toBe(14);
  });

  it('keeps the entries within 14 local days of the newest entry of the same kind, each kind on its own', () => {
    const list = [
      entry('warmup:2026-10-01', 'warmup', '2026-10-01'),
      entry('warmup:2026-10-02', 'warmup', '2026-10-02'),
      entry('warmup:2026-10-15', 'warmup', '2026-10-15'),
      entry('feedback:2026-10-02', 'feedback', '2026-10-02', { resultStars: 1 }),
      entry('stage-certificate:old', 'stage-certificate', 'stage1', { resultStars: 3 }),
    ];
    // 2026-10-15 is the newest warm-up: 10-02 is the 14th day back, 10-01 the 15th. The lone feedback entry is its own newest.
    expect(pruneReviews(list).map((r) => r.id)).toEqual(['warmup:2026-10-02', 'warmup:2026-10-15', 'feedback:2026-10-02', 'stage-certificate:old']);
  });

  it('gives the same result whatever the order and on a list it already pruned, so a union never brings an entry back', () => {
    const list = [entry('warmup:2026-09-01', 'warmup', '2026-09-01'), entry('warmup:2026-10-20', 'warmup', '2026-10-20')];
    const once = pruneReviews(list);
    expect(once.map((r) => r.id)).toEqual(['warmup:2026-10-20']);
    expect(pruneReviews([...list].reverse()).map((r) => r.id)).toEqual(['warmup:2026-10-20']);
    expect(pruneReviews(once)).toBe(once);
  });

  it('keeps an entry whose scope is not a local day, and never prunes the kinds that carry best results', () => {
    const list = [
      entry('feedback:legacy', 'feedback', 'quest:x'),
      entry('feedback:2026-10-20', 'feedback', '2026-10-20'),
      entry('cell-check:a', 'cell-check', '2025-01-01', { resultStars: 3 }),
      entry('cell-check:b', 'cell-check', '2026-10-20', { resultStars: 2 }),
    ];
    expect(pruneReviews(list)).toBe(list);
  });
});
