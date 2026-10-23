import { adaptsIn } from '../../logic/quest-flow/pacing-view';
import { currFlagOn } from '../../store/remote-config-store';

/**
 * Adaptive pacing inside a quest in the start bundle (F-CURR-002 section 4.6, row CM-24): only the gate and the
 * loader. The rules, the scaffold round and its view are one chunk of their own (`./quest-pacing-chunk.tsx`), reached
 * only through the literal `import()` below, so the start bundle does not grow by them. With `questAdapt` off
 * (built-in pct 0 until the owner ramps it) the chunk never loads and every quest plays its standard path.
 */

export type QuestPacingChunk = typeof import('./quest-pacing-chunk');

let loading: Promise<QuestPacingChunk> | null = null;

/** The chunk, loaded once (and again after a failed load). */
export function questPacingChunk(): Promise<QuestPacingChunk> {
  loading ??= import('./quest-pacing-chunk').catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Whether this learner's quest adapts: a learner (not a guest or a preview), a lesson cell and `questAdapt` on. */
export function pacingWanted(profileId: string | null, episodeId: string): profileId is string {
  return profileId !== null && adaptsIn(episodeId) && currFlagOn('questAdapt', profileId);
}

/** Tests only: forget the loaded chunk. */
export function resetQuestPacingChunkForTests(): void {
  loading = null;
}
