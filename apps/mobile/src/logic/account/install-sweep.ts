/**
 * F-AUTH-004 section 6.2 (row NS-2; CS-N7): the install sweep. iOS keeps keychain items after the app is deleted, so a
 * device handed on after an uninstall and a reinstall could inherit a grown-up's sign-in. At the first launch where
 * the storage wrapper has no `grownup:installed` record (a fresh install, or app data cleared), every Clerk item is
 * deleted before anything reads one; the record `{ v: 1, at }` is written only after every delete answered.
 *
 * Pure: the storage reads and writes and the wipe (`TokenCacheController.wipe`) come in as `InstallSweepDeps`.
 *
 * - The record read fails: nothing is known about the install, so nothing is deleted and the sweep is `failed` (the
 *   account stays signed out and Clerk does not mount in this run).
 * - A record that is not a version 1 record reads as absent: the sweep runs (deleting is the safe side).
 * - A delete that fails (for example while the device has not been unlocked since a restart): `failed`, the record
 *   stays unwritten and the sweep runs again next time.
 * - The deletes answered but the record could not be written: `swept` (nothing is left in this run), and the next
 *   launch sweeps again, which deletes nothing more.
 *
 * An Android restore brings `hr:grownup:installed` back with no keystore item (the backup excludes SecureStore), so it
 * reads as signed out and no sweep is needed.
 */

/** Device key (through `platform/storage`, so `hr:grownup:installed`); never ends in a profile id (section 13.1). */
export const INSTALLED_KEY = 'grownup:installed';

export interface InstallRecord {
  v: 1;
  at: number;
}

export function installRecordOf(raw: unknown): InstallRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return r.v === 1 && typeof r.at === 'number' && Number.isFinite(r.at) && r.at >= 0 ? { v: 1, at: r.at } : null;
}

export type InstallSweepResult = 'installed' | 'swept' | 'failed';

export interface InstallSweepDeps {
  /** The stored record, read exactly: throws when the read fails. */
  readRecord: () => Promise<unknown>;
  writeRecord: (record: InstallRecord) => Promise<void>;
  /** Deletes every Clerk item; true when every delete answered success or not-found. */
  wipe: () => Promise<boolean>;
  now: () => number;
}

/** `installed` or `swept`: the sweep is complete for this run, and Clerk may mount. `failed`: it may not. */
export async function runInstallSweep(deps: InstallSweepDeps): Promise<InstallSweepResult> {
  let raw: unknown;
  try {
    raw = await deps.readRecord();
  } catch {
    return 'failed';
  }
  if (installRecordOf(raw) !== null) return 'installed';
  let deleted: boolean;
  try {
    deleted = await deps.wipe();
  } catch {
    deleted = false;
  }
  if (!deleted) return 'failed';
  try {
    await deps.writeRecord({ v: 1, at: deps.now() });
  } catch {
    // Every item is gone in this run; the next launch finds no record and sweeps again (it deletes nothing more).
  }
  return 'swept';
}

/** Whether the account may run in this run after the sweep (section 6.2: until then the rows read as signed out). */
export function sweepComplete(result: InstallSweepResult): boolean {
  return result !== 'failed';
}
