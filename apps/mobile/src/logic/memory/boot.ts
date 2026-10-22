import { setMemoryStoreHook } from '../sync/memory-hook';
import { onProfileRemoved } from '../../store/profile-removal';
import { useProfileStore } from '../../store/profile-store';
import { setVocabRecordHook } from '../../store/progress-store';
import { setFirstRoundAnswerListener } from '../../store/quest-run-store';
import { currFlagOn, useRemoteConfigStore } from '../../store/remote-config-store';
import { onSynced } from '../../store/sync-store';
import type { MemoryAnswer, MemoryRuntime } from './memory-runtime';

/**
 * The memory store's start-bundle half (F-CURR-002 sections 4.8, 4.9 and 12.3, row CM-12): the
 * per-profile key, the gate and the wiring. Everything else is the lazy chunk (`./memory-chunk.ts`),
 * loaded the first time a learner with `memoryRecord` on answers, seeds, syncs or switches away.
 *
 * - Gate: a profile records only while `memoryRecord` is on for it (`currFlagOn`, remote config
 *   bucketed per profile) and it is a learner; a grown-up persona never records (section 4.9).
 *   Off, nothing is recorded and nothing is deleted (section 12.2).
 * - Shadow mode (section 12.3): no learner-visible surface reads the store in this row.
 * - Partition: one stored value per profile (`memory:<profileId>`, in `store/profile-keys.ts`, so
 *   Remove from this device sweeps it); a removed learner's store is forgotten (`onProfileRemoved`).
 * - A switch of the active profile saves the outgoing profile's store and starts its push first.
 */

export { MEMORY_KEY } from './keys';

type MemoryChunk = typeof import('./memory-chunk');
let chunkLoading: Promise<MemoryChunk> | null = null;
/**
 * The memory chunk, loaded once (and again after a failed load): the one literal `import()` of it. The Daily Review
 * (row CM-14) reaches its API here too, so a chunk never imports another chunk.
 */
export function memoryChunk(): Promise<MemoryChunk> {
  chunkLoading ??= import('./memory-chunk').catch((error: unknown) => {
    chunkLoading = null;
    throw error;
  });
  return chunkLoading;
}

let loading: Promise<MemoryRuntime> | null = null;
let loaded: MemoryRuntime | null = null;
/** The runtime, loading its chunk once (and again after a failed load). */
function runtime(): Promise<MemoryRuntime> {
  loading ??= memoryChunk()
    .then((m) => (loaded = m.memoryRuntime()))
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}
const quietly = (work: (r: MemoryRuntime) => Promise<unknown>): Promise<void> =>
  runtime()
    .then(work)
    .then(
      () => undefined,
      () => undefined,
    );

const isLearner = (profileId: string): boolean => useProfileStore.getState().profiles.some((p) => p.id === profileId && (p.role ?? 'learner') === 'learner');

/** Whether answers of this profile are recorded now: a learner, with `memoryRecord` on for it. */
export function memoryRecordsFor(profileId: string | null): profileId is string {
  return profileId !== null && isLearner(profileId) && currFlagOn('memoryRecord', profileId);
}

/**
 * Records answers to review items, for the surfaces that ask them outside a quest round (warm-up,
 * Daily Review, Keep going, the Checks; rows CM-14, CM-15, CM-21, CM-22). Answers to topic words
 * (`vocab:` ids) go to the word slice (F-VOC-005 P7). A no-op unless the profile records.
 */
export function recordAnswers(profileId: string, answers: readonly MemoryAnswer[], at: Date = new Date()): Promise<void> {
  if (answers.length === 0 || !memoryRecordsFor(profileId)) return Promise.resolve();
  return quietly((r) => r.recordAnswers(profileId, answers, at));
}

/** The active learner's start: the one-time seeding and the last day's `memory.daily`, when it records. */
export function activateMemory(profileId: string | null = useProfileStore.getState().activeId): void {
  if (!memoryRecordsFor(profileId)) return;
  void quietly(async (r) => {
    await r.ensureSeeded(profileId);
    await r.sendDailyIfDue(profileId);
  });
}

/** Wires the store into the app (the learner app's boot; the grown-up roots never call it). Returns the unwiring. */
export function startMemory(): () => void {
  setFirstRoundAnswerListener((answer) => {
    const profileId = useProfileStore.getState().activeId;
    if (memoryRecordsFor(profileId)) void quietly((r) => r.recordRound(profileId, answer));
  });
  setVocabRecordHook({
    spacing: (profileId) => memoryRecordsFor(profileId),
    recorded: (profileId, before, events, clock, spacing) => {
      if (spacing) void quietly((r) => r.countVocab(profileId, before, events, clock));
    },
  });
  setMemoryStoreHook({
    backup: (profileId) => runtime().then((r) => r.backup(profileId)),
    restore: (profileId, memory) => runtime().then((r) => r.restore(profileId, memory)),
    pull: (learnerId) => (memoryRecordsFor(learnerId) ? runtime().then((r) => r.pull(learnerId)) : Promise.resolve()),
  });
  const offSynced = onSynced((learnerId) => {
    if (!memoryRecordsFor(learnerId)) return;
    void quietly(async (r) => {
      await r.ensureSeeded(learnerId);
      await r.sync(learnerId);
    });
  });
  let active = useProfileStore.getState().activeId;
  const offProfiles = useProfileStore.subscribe((s) => {
    if (s.activeId === active) return;
    const outgoing = active;
    active = s.activeId;
    // The outgoing profile's answers are saved and pushed before the next one records (section 4.9).
    if (outgoing !== null && loading !== null) void quietly((r) => r.flush(outgoing));
    activateMemory(active);
  });
  // The remote copy arrives after the start: a learner the ramp now includes seeds then.
  const offConfig = useRemoteConfigStore.subscribe((s, prev) => {
    if (s.cache !== prev.cache || s.hydrated !== prev.hydrated) activateMemory(useProfileStore.getState().activeId);
  });
  return () => {
    offSynced();
    offProfiles();
    offConfig();
    setFirstRoundAnswerListener(null);
    setVocabRecordHook(null);
    setMemoryStoreHook(null);
  };
}

// A removed learner's copy in memory goes with it, at once (`./keys.ts` deletes the stored value).
onProfileRemoved((profileId) => loaded?.forget(profileId));

/** Tests only: forget the loaded chunk. */
export function resetMemoryBootForTests(): void {
  chunkLoading = null;
  loading = null;
  loaded = null;
}
