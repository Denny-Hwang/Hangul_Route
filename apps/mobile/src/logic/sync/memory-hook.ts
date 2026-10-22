import type { MemoryBackup } from '@hangul-route/content-schema';

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
}

let hook: MemoryStoreHook | null = null;

/** Row CM-12 registers its store here (null removes it, for tests). */
export function setMemoryStoreHook(next: MemoryStoreHook | null): void {
  hook = next;
}

const holdsStates = (memory: MemoryBackup | undefined): memory is MemoryBackup => memory !== undefined && Object.keys(memory).length > 0;

/** The `memory` key for a backup file, or undefined: no store, an empty one, or one that failed. */
export async function memoryForBackup(profileId: string): Promise<MemoryBackup | undefined> {
  if (!hook) return undefined;
  try {
    const memory = await hook.backup(profileId);
    return holdsStates(memory) ? memory : undefined;
  } catch {
    return undefined;
  }
}

/** Hands a restored file's `memory` key to the store. The snapshot is already restored, so a failure here only leaves the store as it was. */
export async function restoreMemory(profileId: string, memory: MemoryBackup | undefined): Promise<void> {
  if (!hook || !holdsStates(memory)) return;
  try {
    await hook.restore(profileId, memory);
  } catch {
    // Kept as it was; the next pull from the server brings the states back.
  }
}

/** Starts the store's pull for an adopted learner, without waiting: the claim is done whatever the pull does. */
export function pullMemoryAfterAdopt(learnerId: string): void {
  if (!hook) return;
  hook.pull(learnerId).catch(() => undefined);
}
