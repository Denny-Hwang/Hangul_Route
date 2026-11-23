import type { Profile } from '@hangul-route/content-schema';
import { flags } from '../config/flags';
import type { WhoTrigger } from '../logic/profiles/who';
import { useAccountStore } from './account-store';
import { hydrateLearnerData } from './bootstrap';
import { recoverProfileList, useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS sections 3.4 and 3.5 (row DP-1c): what the read-failed screen holds, decided from
 * store state, never from an error a hydrate threw.
 *
 * - `list`: the profile list could not be read (`useProfileStore.loadFailed`, section 3.3). `cause` and `kept` say
 *   which way out a grown-up has (row DP-1d: `grownUpHelpOffered`).
 * - `learner`: the active learner's progress could not be read (`useProgressStore.loadFailedFor`, section 3.2), or
 *   damaged bytes whose copy could not be kept (AU-3 answers `unread`). A learner who is not active never holds
 *   anything: the chooser marks nothing, and the learner gets the screen when chosen (Home).
 */
export type ReadHold = { variant: 'list'; cause: 'read' | 'parse'; kept: boolean } | { variant: 'learner'; profileId: string };

/** The hold now, or `null` when nothing is held. The list comes first: no learner is known while it cannot be read. */
export function readHold(): ReadHold | null {
  const { loadFailed, listCopyKept, activeId } = useProfileStore.getState();
  if (loadFailed !== null) return { variant: 'list', cause: loadFailed, kept: listCopyKept };
  if (activeId !== null && useProgressStore.getState().loadFailedFor.has(activeId)) return { variant: 'learner', profileId: activeId };
  return null;
}

/**
 * Try again (section 3.5). The list variant reruns `hydrateLearnerData` in full, because every per-profile hydrate of
 * the failed boot was built from an empty list (`bootstrap.ts`); a rejection of another store's hydrate is ignored, as
 * at boot. The learner variant reruns that learner's `progress.hydrate` (AU-3's re-read, which then merges and saves
 * the writes held meanwhile). Resolves with the hold after the try (`null`: the read worked); never rejects.
 */
export async function tryReadAgain(hold: ReadHold, rereadAll: () => Promise<void> = hydrateLearnerData): Promise<ReadHold | null> {
  try {
    if (hold.variant === 'list') await rereadAll();
    else await useProgressStore.getState().hydrate(hold.profileId);
  } catch {
    // Another store's hydrate rejected: the hold below is decided from store state only.
  }
  return readHold();
}

/**
 * Whether the learner variant offers Choose another learner (section 3.5): the device has 2 or more learner profiles
 * (counted as the chooser counts them, `who-chooser.ts` `learnerProfiles`: a legacy grown-up row is not a
 * learner), and the chooser exists (`flags.whoChooserEnabled`; with the kill switch off
 * there is no chooser to open, so the button would lead nowhere).
 */
export function chooseAnotherOffered(profiles: readonly Profile[] = useProfileStore.getState().profiles): boolean {
  return flags.whoChooserEnabled && profiles.filter((p) => p.role === 'learner').length >= 2;
}

/**
 * The launch chooser of a boot left through Choose another learner (`RootNavigator`'s `openChooser`): a chooser the
 * launch already opens (or Who is joining?, which shows its own chooser after) wins; otherwise `manual`. With the
 * chooser switched off there is none.
 */
export function chooserAfterHold(launchTrigger: WhoTrigger | null, openChooser: boolean, batchPending: boolean): WhoTrigger | null {
  if (launchTrigger !== null) return launchTrigger;
  return openChooser && flags.whoChooserEnabled && !batchPending ? 'manual' : null;
}

/**
 * [DP] Sections 3.5 and 3.6 (row DP-1d): whether the screen offers **A grown-up can help**: the list variant only,
 * bytes that do not parse, and a copy of them kept at `profiles-corrupt`. Fail closed when the gate's own record (the
 * PIN hash) could not be read: no gate, no sheet; Try again stays (its full read reads the PIN hash again).
 */
export function grownUpHelpOffered(hold: ReadHold, gateRecordUnread: boolean = useAccountStore.getState().pinHashReadFailed): boolean {
  return hold.variant === 'list' && hold.cause === 'parse' && hold.kept && !gateRecordUnread;
}

/**
 * [DP] Section 3.6 (row DP-1d): **Start fresh on this device**, confirmed on the RecoverRecord sheet. The profile list is
 * written empty (`recoverProfileList`, the one write past the section 3.3 guards), then every store is read again as
 * Try again does (`hydrateLearnerData`: the per-profile reads of the held boot were built from no list). Resolves with
 * the hold after it (`null`: BootGate opens the app, Welcome with Restore, and runs the post-hydrate chain); a recovery
 * that wrote nothing reruns nothing. Never rejects.
 */
export async function startListFresh(
  rereadAll: () => Promise<void> = hydrateLearnerData,
  recover: () => Promise<boolean> = recoverProfileList,
): Promise<ReadHold | null> {
  const wrote = await recover().catch(() => false);
  if (!wrote) return readHold();
  return tryReadAgain({ variant: 'list', cause: 'parse', kept: true }, rereadAll);
}
