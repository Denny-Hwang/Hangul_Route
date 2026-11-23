// Types only: the schemas stay out of the start bundle (the Worker checks every payload against them).
import type { StorageReadCause, StorageRecord, StorageTelemetryName, StorageTelemetryPayload } from '@hangul-route/content-schema/storage-telemetry';
import { track } from '../platform/telemetry';
import { onProfileRemoved } from './profile-removal';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.9 (row DP-3, TELEMETRY-NAMES-2 section W): the storage events. Codes only
 * and never a profile id (the Worker drops one anyway, `STORAGE_PAYLOAD_RULES`): which record, why its read failed,
 * whether the damaged bytes were kept aside, and how many writes a save needed. Best effort, never throws. What was
 * already sent is remembered in this module only, so a new launch starts with nothing remembered.
 */

/** The profile records under the read contract (section 3.1), by their storage key (`profile-store.ts`). */
export const PROFILE_RECORD_OF_KEY: Readonly<Record<string, StorageRecord>> = {
  profiles: 'profiles',
  'profiles:active': 'active',
  'profiles:tombstones': 'tombstones',
};

/** The largest `tries` the schema takes (`STORAGE_WRITE_TRIES_MAX`): four or more writes. */
export const SAVE_TRIES_MAX = 4;

function send<N extends StorageTelemetryName>(name: N, payload: StorageTelemetryPayload<N>): void {
  void track({ name, payload });
}

/** The profile-record failures sent in this launch, as `record cause kept`. */
const recordReadsSent = new Set<string>();
/** The learners whose fresh start was sent in this launch. */
const freshSent = new Set<string>();
/** Per learner whose save did not land: the writes that ran since the failed one. */
const writesSinceFailure = new Map<string, number>();

/**
 * A profile record's `durableRead` ended `failed` (section 3.1). Any other key (the kept copy, its mark) is not a
 * profile record and sends nothing. Once per record, cause and `kept` in a launch, so Try again and the list writes held
 * while the tombstones cannot be read do not send the same failure again.
 */
export function trackProfileRecordReadFailed(key: string, cause: StorageReadCause, kept: boolean): void {
  const record = Object.hasOwn(PROFILE_RECORD_OF_KEY, key) ? PROFILE_RECORD_OF_KEY[key] : undefined;
  if (record === undefined) return;
  const sentAs = `${record} ${cause} ${kept}`;
  if (recordReadsSent.has(sentAs)) return;
  recordReadsSent.add(sentAs);
  send('storage.read_failed', { record, cause, kept });
}

/**
 * A learner's progress entered `loadFailedFor` (section 3.2): the store calls it on the way in only. `kept` is true only
 * when the damaged bytes were kept aside and the fresh start's step then threw.
 */
export function trackProgressReadFailed(cause: StorageReadCause, kept: boolean): void {
  send('storage.read_failed', { record: 'progress', cause, kept });
}

/** AU-3 kept a learner's damaged progress aside and started it fresh (`withStored` answered `fresh`): once per learner per launch. */
export function trackProgressStartedFresh(profileId: string): void {
  if (freshSent.has(profileId)) return;
  freshSent.add(profileId);
  send('storage.read_failed', { record: 'progress', cause: 'parse', kept: true });
}

/** The first progress write of a run that did not land (`unsaved`; the learner enters `saveFailedFor`, section 3.7). */
export function trackSaveFailed(profileId: string): void {
  writesSinceFailure.set(profileId, 0);
  send('storage.write_failed', { record: 'progress' });
}

/** Another write of a learner whose save has not landed did not land either (a step that threw is not counted). */
export function trackSaveTried(profileId: string): void {
  const writes = writesSinceFailure.get(profileId);
  if (writes !== undefined) writesSinceFailure.set(profileId, writes + 1);
}

/**
 * A write landed after `write_failed`: `tries` counts the writes that ran since the failed one, the one that landed
 * included, and 4 stands for four or more (the three timed retries, then a foreground or a new write).
 */
export function trackSaveLanded(profileId: string): void {
  const writes = writesSinceFailure.get(profileId);
  if (writes === undefined) return;
  writesSinceFailure.delete(profileId);
  send('storage.write_recovered', { record: 'progress', tries: Math.min(writes + 1, SAVE_TRIES_MAX) });
}

// A learner removed from this device is forgotten here too (a restore may bring the same id back in this launch).
onProfileRemoved((profileId) => {
  freshSent.delete(profileId);
  writesSinceFailure.delete(profileId);
});

/** Tests only: nothing remembered, as at a new launch. */
export function resetStorageTelemetryForTests(): void {
  recordReadsSent.clear();
  freshSent.clear();
  writesSinceFailure.clear();
}
