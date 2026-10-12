import type { VocabProgress } from '@hangul-route/content-schema';
import { codePoint, type VocabEvent } from './progress';
import { isDue } from './srs';

/**
 * The review hook for F-RVW-001's Daily Test — F-VOC-005 section 3.6. Pure.
 *
 * The review engine reads the due words through `vocabPools` and records its
 * answers with `recordReviewAnswer` through `progress-store.recordVocab`, so
 * the Daily Test and the Speed Round share one scheduler and one box per word
 * (P7). Pool C (the last test's misses) is not derived here: the engine takes
 * it from its own `ReviewEntry.missedItemIds`. Excluding yesterday's items and
 * weighting the pools are the engine's job too.
 */

export interface VocabPools {
  /** Due words in box 1. */
  a: string[];
  /** Due words in box 2. */
  b: string[];
  /** Due words in box 3 and up. */
  d: string[];
}

/** The due word ids per pool, each list oldest due first, then by id. */
export function vocabPools(v: VocabProgress, today: string): VocabPools {
  const due = v.items
    .filter((s) => isDue(s, today))
    .sort((x, y) => codePoint(x.due!, y.due!) || codePoint(x.id, y.id));
  return {
    a: due.filter((s) => s.box === 1).map((s) => s.id),
    b: due.filter((s) => s.box === 2).map((s) => s.id),
    d: due.filter((s) => s.box >= 3).map((s) => s.id),
  };
}

/** A Daily Test answer for a `vocab:*` id, recorded through the one scheduler. */
export function recordReviewAnswer(id: string, correct: boolean): VocabEvent {
  return { type: 'answer', id, correct, source: 'review' };
}
