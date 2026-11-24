import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Quest } from '@hangul-route/content-schema';
import { questById } from '../../content';
import { lessonContent } from '../../content/lessons';
import { resumableRun, resumeCandidate } from '../../logic/quest-flow/saved-run';
import { clearSavedRun, readSavedRun } from '../../store/quest-run-saved';

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-2 (section 3.2): whether Home's hero lesson goes on from where a run stopped.
 *
 * Home reads the saved run each time it comes into focus (`readSavedRun`, section 3.3) and forgets it when it leaves focus,
 * then decides in two steps:
 *
 * 1. A candidate, from the stored value alone (`resumeCandidate`): a run of the hero's quest, begun within a day, past
 *    its first step, not a story quest. No candidate: nothing else happens, and no lesson chunk is asked for.
 * 2. Only for a candidate, the quest's steps. A lesson quest's steps come with its cell's chunk. This hook never uses
 *    `useLessonQuestState`, which throws a failed load (the crash screen) and may reload the page for a newer build:
 *    it asks the lesson store directly (`isQuestReady`, else `ensureCells` with its rejection swallowed) and decides
 *    once the store says the quest is ready. Then `resumableRun` must not be null (a changed step list drops it). A load
 *    that fails or never ends leaves the plain hero: no crash, no reload.
 *
 * The answer is the step the player opens (`stepIndex` + 1, the furthest step reached, QB-4) and the quest's step count.
 */

/** What the hero says: the player opens on step `step` of `total`. */
export interface HeroResume {
  step: number;
  total: number;
}

/** The lesson store's part this hook asks (`logic/lessons/lesson-store.ts`). */
export interface LessonStepsStore {
  subscribe: (listener: () => void) => () => void;
  isQuestReady: (questId: string) => boolean;
  cellOfQuest: (questId: string) => string | undefined;
  ensureCells: (cellIds: readonly string[]) => Promise<void>;
}

export interface HeroResumeDeps {
  store?: LessonStepsStore;
  questOf?: (questId: string) => Pick<Quest, 'id' | 'steps'> | undefined;
  read?: (profileId: string) => Promise<unknown>;
  clear?: (profileId: string) => Promise<void>;
  now?: () => number;
}

/**
 * The hero's resume line for `questId`, and Start again: the saved run is cleared first, and only once that has run
 * (the player's own read waits for the same queue, so it reads nothing) the lesson is opened by `open`, on its first step
 * (OD-LR6). The line goes at once. `resume` is `null` while the read or the steps are not in, and for every case that has
 * no resume variant.
 */
export function useHeroResume(
  profileId: string | null,
  questId: string | null,
  { store = lessonContent, questOf = questById, read = readSavedRun, clear = clearSavedRun, now = Date.now }: HeroResumeDeps = {},
): { resume: HeroResume | null; startAgain: (open: () => void) => void } {
  const [saved, setSaved] = useState<{ profileId: string; value: unknown } | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (profileId === null) return undefined;
      let alive = true;
      void read(profileId).then((value) => {
        if (alive) setSaved({ profileId, value });
      });
      return () => {
        alive = false;
        // Leaving Home forgets what it read: coming back, no old Continue line shows while the saved run is read again
        // (the run may have been finished or gone on in the player), and the candidate flips from none to one once the
        // read is in, which is also what asks a chunk that failed to load again.
        setSaved(null);
      };
    }, [profileId, read]),
  );

  const value = saved !== null && saved.profileId === profileId ? saved.value : null;
  const quest = questId === null ? undefined : questOf(questId);
  const candidate = useMemo(() => quest !== undefined && resumeCandidate(value, quest, now()), [value, quest, now]);

  // The steps of a lesson quest arrive with its cell's chunk; the store tells when they are in.
  const ready = useSyncExternalStore(store.subscribe, () => questId === null || store.isQuestReady(questId));
  useEffect(() => {
    if (!candidate || ready || questId === null) return;
    const cell = store.cellOfQuest(questId);
    if (cell === undefined) return;
    // A failed load is not told: the hero stays plain. It asks again when Home comes back into focus (the saved run is
    // read again, so the candidate flips off and on), not on a timer.
    store.ensureCells([cell]).catch(() => undefined);
  }, [candidate, ready, questId, store]);

  const resume = useMemo((): HeroResume | null => {
    if (!candidate || !ready || quest === undefined) return null;
    const restored = resumableRun(value, quest, now());
    // The steps are in now: the candidate check is asked again over them (a story quest has a story-read step).
    if (restored === null || !resumeCandidate(value, quest, now())) return null;
    return { step: restored.stepIndex + 1, total: quest.steps.length };
  }, [candidate, ready, quest, value, now]);

  const startAgain = useCallback(
    (open: () => void): void => {
      if (profileId === null) return;
      // A clear that fails still opens the lesson: the player resumes only what it can read, and nothing is worse than a stuck button.
      void clear(profileId)
        .catch(() => undefined)
        .then(() => {
          setSaved(null);
          open();
        });
    },
    [profileId, clear],
  );
  return { resume, startAgain };
}
