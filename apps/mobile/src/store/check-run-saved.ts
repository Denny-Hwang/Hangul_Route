import { savedHangulCheck, type SavedCheckRun } from '../logic/reviews/saved-check';
import { removeKey, writeJson } from '../platform/storage';
import { durableRead, type DurableRead } from './durable-read';
import { onProfileRemoved } from './profile-removal';
import { useProfileStore } from './profile-store';
import { useReviewRunStore } from './review-run-store';

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-3a (section 3.4): the check a learner stopped, or an app kill, a call or a
 * discarded tab interrupted, kept on this device (`hr:check-run:<profileId>` through `platform/storage.ts`; never synced,
 * never sent). One stored check per learner, either check: a check's save replaces the other check's. The rules of what
 * is stored and what may be resumed are `logic/reviews/saved-check.ts`.
 *
 * The Hangul Check's screen reads it before its intro (a bounded `reading` phase), keeps it up to date after every
 * answer (`keepReviewRunSaved`, OD-LR9 (b)) and clears it when the result is recorded and when a new check starts. Stop
 * keeps it (OD-LR1 (c)). Guests take neither check. Row LR-3b adds the Stage Check's own save beside it, on the same
 * key, through `saveCheck`, `readSavedCheck` and `clearSavedCheck`.
 */
export const CHECK_RUN_KEY = (profileId: string): string => `check-run:${profileId}`;

/** How long a check waits for the stored run before it shows its intro (section 3.3: the limit of the saved quest run). */
export const SAVED_CHECK_READ_MS = 800;

/** Learners removed from this device in this session (row OA-7a, CS-20): a save still on its way never writes them back. */
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

/** What a read answers: the value, or null for nothing stored and for a read that failed (either cause). */
const valueOf = (read: DurableRead): unknown => (read.kind === 'value' ? read.value : null);

/**
 * The stored value for `profileId` as it is (`resumableHangulCheck` decides whether it may be resumed), or null:
 * nothing stored, storage that cannot be read (section 3.3: one retry on a fresh connection, then no resume and nothing
 * else; the copy key is null, a stored check holds nothing earned), or no answer within `limitMs`. A read that lands
 * after the limit is handed to `onLate` (a non-null value only), so the intro that was shown meanwhile can offer the
 * resume page while nothing has started. Never rejects.
 */
export async function readSavedCheck(profileId: string, options: { limitMs?: number; onLate?: (value: unknown) => void } = {}): Promise<unknown> {
  const limitMs = options.limitMs ?? SAVED_CHECK_READ_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, limitMs);
  });
  // After the writes already asked for, so a check saved a moment ago is the one read.
  const read = queue.then(() => durableRead(CHECK_RUN_KEY(profileId), null)).then(valueOf, () => null);
  void read.then((value) => {
    if (timedOut && value !== null) options.onLate?.(value);
  });
  try {
    return await Promise.race([read, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Stores the check. A failed write is dropped: the check plays on, and an interruption then starts it again. */
export function saveCheck(profileId: string, run: SavedCheckRun): Promise<void> {
  return queued(async () => {
    if (removedNow(profileId)) return;
    await writeJson(CHECK_RUN_KEY(profileId), run);
  });
}

/** Forgets the learner's stored check (its result is recorded, or a new check starts). */
export function clearSavedCheck(profileId: string): Promise<void> {
  return queued(() => removeKey(CHECK_RUN_KEY(profileId)));
}

/** What a Hangul Check run is stored with besides its answers. */
export interface ReviewRunSaveContext {
  seed: number;
  hideRomanization: boolean;
  startedAt: string;
}

/**
 * Keeps the stored Hangul Check of `profileId` in step with the run in `review-run-store` (OD-LR9 (b), owner decision
 * 2026-11-24): stored after every answer, the answers only (a first try, or a retry of an item already answered; a
 * game's own state is never kept). Nothing is stored for a run with no answer yet, or after a reset. Returns the stop;
 * the run stays stored after it, which is what lets an interruption, or a Stop, go on.
 */
export function keepReviewRunSaved(profileId: string, context: ReviewRunSaveContext): () => void {
  return useReviewRunStore.subscribe((run, before) => {
    if (run.answers === before.answers || run.itemIds.length === 0 || Object.keys(run.answers).length === 0) return;
    void saveCheck(profileId, savedHangulCheck({ ...context, items: run.itemIds, answers: run.answers }));
  });
}

// A removed learner's stored check goes with the learner (row OA-7a): the key, and any save still on its way.
onProfileRemoved((profileId) => {
  removedHere.add(profileId);
  void queued(() => removeKey(CHECK_RUN_KEY(profileId)));
});

/** Tests only: forget the removals of this session and wait for the writes asked for so far. */
export async function settleSavedChecksForTests(forget = false): Promise<void> {
  if (forget) removedHere.clear();
  await queue;
}
