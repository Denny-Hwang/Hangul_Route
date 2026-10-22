import type { MemoryBackup, MemorySummary } from '@hangul-route/content-schema';

/**
 * The memory store's side of the backup file (F-SYNC-002) and of a Rescue Code restore (F-RESTORE-001),
 * F-CURR-002 section 4.8, row CM-11. Row CM-12's memory store registers the hook; until then none is
 * registered, so a backup file carries no `memory` key and a restore reads none, exactly as before.
 *
 * Every call is best effort: the memory store can never fail a backup, a file restore or a claim. The
 * file stays at `BACKUP_VERSION` 1, and its `memory` key is read leniently (`BackupFileSchema`), so an
 * unreadable key never fails the file.
 */
export interface MemoryStoreHook {
  /** The profile's answered item states (`n` of 1 or more) for a backup file; undefined or empty when it holds none. */
  backup(profileId: string): Promise<MemoryBackup | undefined>;
  /** Folds a restored file's states into the profile's store with the shared merge; never replaces the store. */
  restore(profileId: string, memory: MemoryBackup): Promise<void>;
  /** After a Rescue Code claim or a re-link adopted the learner here: pull the shards (`GET .../memory?since=0`). */
  pull(learnerId: string): Promise<void>;
  /**
   * The summary's `memory` block (F-CURR-002 section 4.8, row CM-16): undefined while the profile does not record
   * (`memoryRecord` off, a grown-up persona) or its store cannot be read, so no block is sent and reports show none.
   */
  summary?(profileId: string): Promise<MemorySummary | undefined>;
}

let hook: MemoryStoreHook | null = null;

/** Row CM-12 registers its store here (null removes it, for tests). */
export function setMemoryStoreHook(next: MemoryStoreHook | null): void {
  hook = next;
}

/**
 * How long a backup or a file restore waits for the store before it goes on without it: a store that
 * hangs (an IndexedDB open blocked by another tab) must never stop the file from being saved or the
 * restore from finishing.
 */
export const MEMORY_HOOK_TIMEOUT_MS = 3000;

/** The store's answer, or a rejection once `MEMORY_HOOK_TIMEOUT_MS` has passed. */
function withinTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('memory store timed out')), MEMORY_HOOK_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

const holdsStates = (memory: MemoryBackup | undefined): memory is MemoryBackup => memory !== undefined && Object.keys(memory).length > 0;

/** The `memory` key for a backup file, or undefined: no store, an empty one, or one that failed or did not answer in time. */
export async function memoryForBackup(profileId: string): Promise<MemoryBackup | undefined> {
  if (!hook) return undefined;
  try {
    const memory = await withinTimeout(hook.backup(profileId));
    return holdsStates(memory) ? memory : undefined;
  } catch {
    return undefined;
  }
}

/** Hands a restored file's `memory` key to the store. The snapshot is already restored, so a failure here only leaves the store as it was. */
export async function restoreMemory(profileId: string, memory: MemoryBackup | undefined): Promise<void> {
  if (!hook || !holdsStates(memory)) return;
  try {
    await withinTimeout(hook.restore(profileId, memory));
  } catch {
    // Kept as it was; the next pull from the server brings the states back.
  }
}

/** Starts the store's pull for an adopted learner, without waiting: the claim is done whatever the pull does. */
export function pullMemoryAfterAdopt(learnerId: string): void {
  if (!hook) return;
  hook.pull(learnerId).catch(() => undefined);
}

/**
 * The last `memory` block per profile, read synchronously by the summary the sync uploads (`summarizeFor`) and by the
 * in-app report. Filled by `refreshMemorySummary` before each snapshot sync and when a report opens; a profile with
 * no block (the store does not answer, or answers none) has no entry, so its summary carries no `memory` key.
 */
const summaries = new Map<string, MemorySummary>();

/** The profile's last `memory` block, or undefined. */
export function memorySummaryFor(profileId: string): MemorySummary | undefined {
  return summaries.get(profileId);
}

/**
 * Asks the store for the profile's `memory` block now, within `MEMORY_HOOK_TIMEOUT_MS`. A store that answers none
 * removes the entry; one that fails or does not answer in time keeps the last block, so a slow store never sends a
 * summary without it (the Worker keeps the stored block when a summary lacks one, row CM-3b).
 */
export async function refreshMemorySummary(profileId: string): Promise<void> {
  if (!hook?.summary) {
    summaries.delete(profileId);
    return;
  }
  try {
    const memory = await withinTimeout(hook.summary(profileId));
    if (memory) summaries.set(profileId, memory);
    else summaries.delete(profileId);
  } catch {
    // Kept as it was.
  }
}

/** A removed profile's block goes with it. */
export function forgetMemorySummary(profileId: string): void {
  summaries.delete(profileId);
}
