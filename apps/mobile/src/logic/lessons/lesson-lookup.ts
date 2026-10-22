import type { Episode, Quest } from '@hangul-route/content-schema';

/**
 * The order the quest cursor walks the upper-stage lesson quests in (F-CURR-001 §3.12). Their
 * content loads on demand through `lesson-store.ts` (F-CURR-002 §10).
 */

const STAGE_RANK = (q: Quest, stageOf: ReadonlyMap<string, string>): number => Number((stageOf.get(q.id) ?? 'stage9').slice(5));

/**
 * The lesson quest list in cursor order (the cursor offers quests in list order):
 * the hand-written quests up to Stage 4 and the lesson quests of Stages 2-4 by stage,
 * then the stories and books, then the lesson quests of Stages 6-7. Within a stage
 * the hand-written quests keep their place and the lesson quests follow in index order.
 */
export function questsInCursorOrder(i: {
  early: readonly Quest[];
  lessons: readonly Quest[];
  middle: readonly Quest[];
  episodes: readonly Pick<Episode, 'stage' | 'questIds'>[];
}): Quest[] {
  const stageOf = new Map<string, string>();
  for (const e of i.episodes) for (const id of e.questIds) stageOf.set(id, e.stage);
  const tagged = [...i.early, ...i.lessons].map((q, index) => ({ q, index, rank: STAGE_RANK(q, stageOf) }));
  const upTo4 = tagged.filter((t) => t.rank <= 4).sort((a, b) => a.rank - b.rank || a.index - b.index);
  const late = tagged.filter((t) => t.rank > 4).sort((a, b) => a.rank - b.rank || a.index - b.index);
  return [...upTo4.map((t) => t.q), ...i.middle, ...late.map((t) => t.q)];
}
