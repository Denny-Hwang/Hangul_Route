import { CATALOG, type PlacementResult, type ProgressSnapshot } from '@hangul-route/content-schema';
import { decodeRetiredItem, decodeReviewItems, type ReviewItem } from '@hangul-route/content-schema/review-items';
import * as chunk from '../../../content/__generated__/review-item-chunks/review-items';
import type { ReviewItemIndex } from '../../reviews/review-items-store';

/**
 * Fixtures of row CM-12 (F-CURR-002 section 4.8): the review items of this build and learner
 * snapshots at the five historical schema points (before `vocab`, before `questDoneAt`, before
 * `placements`, a current one and an empty one), built from the shipped catalogue.
 */

export const ITEMS: readonly ReviewItem[] = decodeReviewItems(chunk);
const RETIRED_ITEMS = chunk.REVIEW_RETIRED.map(decodeRetiredItem);
export const RETIRED: ReadonlySet<string> = new Set(RETIRED_ITEMS.map((r) => r.id));
export const INDEX: ReviewItemIndex = { items: ITEMS, byId: new Map(ITEMS.map((i) => [i.id, i])), retired: RETIRED, retiredById: new Map(RETIRED_ITEMS.map((r) => [r.id, r])) };

export const LESSON_QUESTS = CATALOG.quests.filter((q) => q.kind === 'lesson');

/** The local day of an instant in UTC: the tests inject the local day, so none depends on the machine's time zone. */
export const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

/** A placement result whose route puts ㅂ and final ㄴ first. */
export const PLACEMENT = {
  id: 'placement:1',
  mode: 'short',
  startedAt: '2026-09-01T10:00:00.000Z',
  completedAt: '2026-09-01T10:10:00.000Z',
  responses: [],
  gates: [],
  strands: {},
  level: 'band1',
  oralStage: null,
  beyondContent: false,
  startQuestId: null,
  placedOutQuestIds: [],
  priorityTokens: ['sym:ㅂ', 'sym:ㄴ/final'],
  needsStage: null,
  stopReason: 'done',
} as unknown as PlacementResult;

/**
 * A learner who finished `count` lesson quests in route order, one every 6 hours from 1 September
 * 2026, the third of each cell with 3 stars and the rest with 2.
 */
export function finished(count: number, profileId = 'p1'): ProgressSnapshot {
  const quests = LESSON_QUESTS.slice(0, count).map((q, i) => {
    const at = new Date(Date.UTC(2026, 8, 1, 6 * i)).toISOString();
    return { questId: q.id, episodeId: q.episodeId, startedAt: at, completedAt: at, stars: (i % 3 === 2 ? 3 : 2) as 2 | 3, attempts: 1, accuracy: 0.9 };
  });
  return {
    profileId,
    updatedAt: '2026-10-01T00:00:00.000Z',
    episodes: [],
    quests,
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    placements: [PLACEMENT],
    vocab: { v: 1, items: [], topics: [] },
    questDoneAt: Object.fromEntries(quests.map((q) => [q.questId, q.completedAt])),
  };
}

/** The five historical schema points of a learner with `count` quests done: each older point lacks the key added at it. */
export function historicalPoints(count: number): Record<'beforeVocab' | 'beforeQuestDoneAt' | 'beforePlacements' | 'current' | 'empty', ProgressSnapshot> {
  const current = finished(count);
  const { vocab: _v, ...beforeVocab } = current;
  const { questDoneAt: _q, ...beforeQuestDoneAt } = current;
  const { placements: _p, ...beforePlacements } = current;
  const empty: ProgressSnapshot = { profileId: 'p1', updatedAt: '2026-10-01T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 };
  return { beforeVocab, beforeQuestDoneAt, beforePlacements, current, empty };
}
