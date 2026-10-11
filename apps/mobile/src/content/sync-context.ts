import { scopeFor } from '../logic/minigame-config';
import { questTeaches } from '../logic/stage1/curriculum';
import { jamoAll } from './jamo';
import { stage1Quests } from './quests';

/**
 * Inputs for `logic/sync/summarize` derived from the bundled content:
 * Stage 1 quest ids and the jamo (as characters) each quest teaches.
 */
export const stage1QuestIds: string[] = stage1Quests.map((q) => q.id);

const charById = new Map(jamoAll.map((j) => [j.id, j.char]));

/**
 * A rebuilt quest (F-QUEST-002) is credited with its Discover symbols only, not the review
 * symbols its games also ask; a quest without a Discover step yet falls back to the symbols
 * of its game scopes.
 */
export const questJamo: Record<string, string[]> = Object.fromEntries(
  stage1Quests.map((q) => {
    const taught = questTeaches(q);
    const ids = taught.length > 0
      ? taught
      : q.steps.flatMap((step) => (step.minigameRef ? scopeFor(step.minigameRef)?.jamoIds ?? [] : []));
    const chars = new Set<string>();
    for (const id of ids) {
      const ch = charById.get(id);
      if (ch) chars.add(ch);
    }
    return [q.id, [...chars]];
  }),
);
