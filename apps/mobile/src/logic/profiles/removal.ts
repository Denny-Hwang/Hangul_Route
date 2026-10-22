import type { GateEvent } from './gate-events';

/**
 * [OA] Remove from this device (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D13, section 10.4, row OA-7a). Pure rules: the
 * store (`store/remove-from-device.ts`) reads the records and does the removal; the screen paints the steps.
 */

/** The part of a learner's sync record (`sync:<id>`) that says whether the server holds everything. */
export interface SavedSyncFacts {
  /** The device secret: set once the learner is registered. */
  secret: string | null;
  /** A name, level or avatar edit not yet confirmed by the server. */
  pendingProfile: unknown;
  /** The last acknowledged push (ISO time), or null when none. */
  lastSyncedAt: string | null;
  /** The learner's Rescue Code on this device, or null when none was issued (or it is not stored here). */
  rescueCode?: string | null;
}

const timeOf = (iso: string): number => Date.parse(iso);

/**
 * Section 10.4: a learner is *saved* only when it is registered (`sync:<id>` has a secret) **and** nothing is
 * waiting to be pushed: no `pendingProfile`, and the last acknowledged push is at or after the progress store's last
 * local write (`lastLocalWrite`, the snapshot's `updatedAt`; null when nothing was ever written). A time that does
 * not parse counts as not saved (the safe side: the grown-up gets the second step, never a silent loss).
 */
export function isSaved(sync: SavedSyncFacts | null, lastLocalWrite: string | null): boolean {
  if (sync === null || !sync.secret) return false;
  if (sync.pendingProfile !== null && sync.pendingProfile !== undefined) return false;
  if (lastLocalWrite === null) return true;
  if (sync.lastSyncedAt === null) return false;
  const pushed = timeOf(sync.lastSyncedAt);
  const written = timeOf(lastLocalWrite);
  if (Number.isNaN(pushed) || Number.isNaN(written)) return false;
  return pushed >= written;
}

/**
 * Section 10.4 (row OA-7a review): the one-step Remove needs more than a saved learner: the learner's Rescue Code is on
 * this device, so the sheet can show it before Remove deletes the only copy here (the sync check may have just
 * registered the learner and issued it, unseen). A saved learner without a code goes the unsaved way (two steps).
 */
export function savedWithCode(sync: SavedSyncFacts | null, lastLocalWrite: string | null): boolean {
  return isSaved(sync, lastLocalWrite) && typeof sync?.rescueCode === 'string' && sync.rescueCode.length > 0;
}

/**
 * The steps of the Remove ConfirmSheet (mock `design/screens/profiles/people-on-device.md`, boards 6 to 9):
 * `checking` while `syncNow` runs (only Cancel), `saved` (Cancel, Remove), `unsaved` (Save progress first, Cancel,
 * Remove anyway) and `anyway`, the second explicit step of an unsaved removal (Keep, Remove in the danger tone).
 */
export type RemoveStep = 'checking' | 'saved' | 'unsaved' | 'anyway';

/** The step the sheet opens on: a saved learner goes straight to `saved`; any other first tries to sync. */
export function openingStep(saved: boolean): RemoveStep {
  return saved ? 'saved' : 'checking';
}

/** The step after the sync attempt: saved now, or unsaved (the sync failed, the device is offline, or sync is off). */
export function checkedStep(savedNow: boolean): RemoveStep {
  return savedNow ? 'saved' : 'unsaved';
}

/** What the removal of `step` records: only an unsaved learner removed through the second step is `anyway`. */
export function removalFacts(step: RemoveStep): { saved: boolean; anyway: boolean } | null {
  if (step === 'saved') return { saved: true, anyway: false };
  if (step === 'anyway') return { saved: false, anyway: true };
  // `checking` and `unsaved` never remove: the unsaved sheet's Remove anyway opens the second step first.
  return null;
}

/** Where the app goes after a removal: Welcome when no learner is left, the chooser when the active one went. */
export type AfterRemoval = 'welcome' | 'chooser' | 'stay';

export function afterRemoval(input: { wasActive: boolean; learnersLeft: number }): AfterRemoval {
  if (input.learnersLeft <= 0) return 'welcome';
  return input.wasActive ? 'chooser' : 'stay';
}

/** `profile.removed` (section 15): three booleans; no `profileId`, no name. */
export function removedEvent(facts: { saved: boolean; wasActive: boolean; anyway: boolean }): GateEvent {
  return { name: 'profile.removed', payload: { saved: facts.saved, wasActive: facts.wasActive, anyway: facts.anyway } };
}
