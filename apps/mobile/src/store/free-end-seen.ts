import { freeEndReachedEvent, freeEndSeenKey } from '../logic/free-end';
import { readJsonStrict, writeJson } from '../platform/storage';
import { track } from '../platform/telemetry';

/**
 * "The end of the free lessons was celebrated" for a profile on this device (F-ENT-003 sections
 * 3.7, 3.8 and 3.16): the key `free-end-seen:<profileId>` in `platform/storage.ts`, never synced.
 * Showing the celebration on Home or on Results marks it, sends `access.free_end_reached` once,
 * and keeps it to once in this session even when the write fails. An unreadable key reads as
 * seen, so the learner gets the practice card rather than the celebration twice.
 */
const shownThisSession = new Set<string>();

export async function readFreeEndSeen(profileId: string): Promise<boolean> {
  if (shownThisSession.has(profileId)) return true;
  try {
    return (await readJsonStrict<boolean>(freeEndSeenKey(profileId))) === true;
  } catch {
    return true;
  }
}

export async function markFreeEndSeen(profileId: string, placedOut: boolean): Promise<void> {
  if (shownThisSession.has(profileId)) return;
  shownThisSession.add(profileId);
  void track(freeEndReachedEvent(profileId, placedOut));
  try {
    await writeJson(freeEndSeenKey(profileId), true);
  } catch {
    // The celebration may show once more in a later session (acceptable, section 3.16).
  }
}

/** Tests only: forget what this session showed. */
export function resetFreeEndSessionForTests(): void {
  shownThisSession.clear();
}
