import { savedRunOf, type SavedQuestRun } from '../logic/quest-flow/saved-run';
import { readJsonStrict, removeKey, writeJson } from '../platform/storage';
import { onProfileRemoved } from './profile-removal';
import { useProfileStore } from './profile-store';
import { useQuestRunStore } from './quest-run-store';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-12 (audit FUNC-3): the quest run a learner left by a reload, kept on this device
 * (`hr:quest-run:<profileId>` through `platform/storage.ts`; never synced, never sent). One run per learner: a new
 * quest's run replaces it. The rules of what is stored and what may be resumed are `logic/quest-flow/saved-run.ts`.
 *
 * The learner's quest player (`screens/quest/QuestPlayerScreen.tsx`) reads it before the quest starts, keeps it up to
 * date at each step change (`keepRunSaved`) and clears it when the quest finishes or the learner chooses Leave. The
 * guest run does not use it: a guest's reload reopens quest 1 from step 1 (AMENDMENTS-GUEST-FIRST-LESSON GU-D12), and
 * the All lessons preview saves nothing.
 */
export const QUEST_RUN_KEY = (profileId: string): string => `quest-run:${profileId}`;

/** How long the quest player waits for the saved run before it starts the quest fresh. */
export const SAVED_RUN_READ_MS = 800;

/**
 * Learners removed from this device in this session (row OA-7a, CS-20): a save still on its way never writes a
 * removed learner's run back. A learner restored under the same id is a learner again.
 */
const removedHere = new Set<string>();
const removedNow = (profileId: string): boolean => removedHere.has(profileId) && !useProfileStore.getState().profiles.some((p) => p.id === profileId);

/** Writes and removals, one after another, so a clear asked for after a save lands after it. */
let queue: Promise<unknown> = Promise.resolve();
function queued(work: () => Promise<unknown>): Promise<void> {
  const run = queue.then(work).then(
    () => undefined,
    () => undefined,
  );
  queue = run;
  return run;
}

/**
 * The stored value for `profileId` as it is (`resumableRun` decides whether it may be resumed), or null: nothing
 * stored, storage that cannot be read, or no answer within `timeoutMs` (a stalled read never holds the quest back).
 */
export async function readSavedRun(profileId: string, timeoutMs: number = SAVED_RUN_READ_MS): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  // After the writes already asked for, so a run saved a moment ago is the one read.
  const read = queue.then(() => readJsonStrict<unknown>(QUEST_RUN_KEY(profileId))).catch(() => null);
  try {
    return await Promise.race([read, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Stores the run. A failed write is dropped: the quest plays on, and a reload then starts it from its first step. */
export function saveRun(profileId: string, run: SavedQuestRun): Promise<void> {
  return queued(async () => {
    if (removedNow(profileId)) return;
    await writeJson(QUEST_RUN_KEY(profileId), run);
  });
}

/** Forgets the learner's saved run (the quest finished, or the learner chose Leave). */
export function clearSavedRun(profileId: string): Promise<void> {
  return queued(() => removeKey(QUEST_RUN_KEY(profileId)));
}

type StepsOf = () => Parameters<typeof savedRunOf>[1] | undefined;

/**
 * Keeps the saved run of `profileId` in step with the run of `questId` in `quest-run-store`: stored when the run
 * begins (which replaces a saved run of another quest) and at each step change. `stepsOf` reads the quest's steps
 * when a save is made (a lesson's steps arrive with its chunk). Returns the stop, for the player's unmount; the run
 * stays stored after it, which is what lets a reload go on.
 * [QB] AMENDMENTS-QUEST-SOUND-BACK row QB-4: what is stored is the furthest step the run reached, so a step taken back
 * with Previous stores the same step again and a reload resumes at the furthest step.
 */
export function keepRunSaved(profileId: string, questId: string, stepsOf: StepsOf): () => void {
  const save = (): void => {
    const run = useQuestRunStore.getState();
    const steps = stepsOf();
    if (run.questId !== questId || steps === undefined) return;
    const saved = savedRunOf(run, steps);
    if (saved !== null) void saveRun(profileId, saved);
  };
  save();
  return useQuestRunStore.subscribe((run, before) => {
    if (run.questId !== questId) return;
    if (run.stepIndex !== before.stepIndex || run.questId !== before.questId || run.startedAt !== before.startedAt) save();
  });
}

// A removed learner's saved run goes with the learner (row OA-7a): the key, and any save still on its way.
onProfileRemoved((profileId) => {
  removedHere.add(profileId);
  void queued(() => removeKey(QUEST_RUN_KEY(profileId)));
});

/** Tests only: forget the removals of this session and wait for the writes asked for so far. */
export async function settleSavedRunsForTests(forget = false): Promise<void> {
  if (forget) removedHere.clear();
  await queue;
}
