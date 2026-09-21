import { scopeFor } from '../logic/minigame-config';
import { jamoAll } from './jamo';
import { stage1Quests } from './quests';

/**
 * Inputs for `logic/sync/summarize` derived from the bundled content:
 * Stage 1 quest ids and the jamo (as characters) each quest teaches.
 */
export const stage1QuestIds: string[] = stage1Quests.map((q) => q.id);

const charById = new Map(jamoAll.map((j) => [j.id, j.char]));

export const questJamo: Record<string, string[]> = Object.fromEntries(
  stage1Quests.map((q) => {
    const chars = new Set<string>();
    for (const step of q.steps) {
      const scope = step.minigameRef ? scopeFor(step.minigameRef) : undefined;
      for (const id of scope?.jamoIds ?? []) {
        const ch = charById.get(id);
        if (ch) chars.add(ch);
      }
    }
    return [q.id, [...chars]];
  }),
);
