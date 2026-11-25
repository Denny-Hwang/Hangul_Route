/**
 * The parts of a review's finish that can be tried again (AMENDMENTS-QUEST-LEAVE-RESUME section 3.5, row LR-4).
 * Pure: no store, no screen. The Daily Review and the Stage Check keep each round's recording by round index, record
 * again the ones that rejected when the learner presses Try again, and finish the same plan once.
 */

/**
 * Keeps a round's recording in `recorded` under its round index and returns it. A rejection is marked as handled here,
 * so a recording that fails mid-session never reports as unhandled before the finish awaits it; the promise itself
 * still rejects for whoever awaits it.
 */
export function keepRecording(recorded: Map<number, Promise<void>>, index: number, recording: Promise<void>): Promise<void> {
  recording.catch(() => undefined);
  recorded.set(index, recording);
  return recording;
}

/**
 * Records again the rounds whose recording rejected: each is replaced, in the same place, by the new recording. A
 * recording that rejects again stays as a rejection for the next try. Resolves once every old recording has settled and
 * every new one has (a new one that rejects does not reject this: the finish that follows reads it from the map).
 */
export async function recordAgain(recorded: Map<number, Promise<void>>, record: (index: number) => Promise<void>): Promise<void> {
  const failed = await Promise.all([...recorded].map(([index, recording]) => recording.then(() => null, () => index)));
  const again = failed.flatMap((index) => (index === null ? [] : [keepRecording(recorded, index, record(index))]));
  await Promise.all(again.map((recording) => recording.catch(() => undefined)));
}

/**
 * A finish runs once per plan: a second call for a plan whose finish is running or has resolved answers that result and
 * runs nothing, so a second Try again never writes a second entry, latch or event. A rejected finish is not kept (the
 * next call runs it again), and neither is a result `keep` refuses (the Stage Check's "nothing to save").
 */
export function finishOnce<K extends object, T>(keep: (result: T) => boolean = () => true): (plan: K, run: () => Promise<T>) => Promise<T> {
  const done = new WeakMap<K, Promise<T>>();
  return (plan, run) => {
    const known = done.get(plan);
    if (known !== undefined) return known;
    const started = run();
    done.set(plan, started);
    started.then(
      (result) => {
        if (!keep(result) && done.get(plan) === started) done.delete(plan);
      },
      () => {
        if (done.get(plan) === started) done.delete(plan);
      },
    );
    return started;
  };
}

/**
 * The writes of a finish, each once per plan: a step that ran is never run again by a later call for the same plan,
 * even when a step after it threw (the entry is written, the latch then threw: the next call writes no second entry).
 * A step that threw is not marked, so the next call runs it again.
 */
export function stepsOnce<K extends object>(): (plan: K, step: string, run: () => void) => void {
  const done = new WeakMap<K, Set<string>>();
  return (plan, step, run) => {
    const steps = done.get(plan) ?? new Set<string>();
    done.set(plan, steps);
    if (steps.has(step)) return;
    run();
    steps.add(step);
  };
}
