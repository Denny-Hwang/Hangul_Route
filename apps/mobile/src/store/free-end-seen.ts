import { freeEndReachedEvent, freeEndSeenKey } from '../logic/free-end';
import { readJsonStrict, removeKey, writeJson } from '../platform/storage';
import { track } from '../platform/telemetry';
import { onProfileRemoved } from './profile-removal';

/**
 * "The end of the free lessons was celebrated" for a profile on this device (F-ENT-003 sections
 * 3.7, 3.8 and 3.16): the key `free-end-seen:<profileId>` in `platform/storage.ts`, never synced.
 * Showing the celebration on Home or on Results marks it, sends `access.free_end_reached` once,
 * and keeps it to once in this session even when the write fails. An unreadable key reads as
 * seen, so the learner gets the practice card rather than the celebration twice; so does a read
 * that has not answered within `READ_TIMEOUT_MS` (a stalled storage read never leaves Home or
 * Results without their buttons).
 */
const shownThisSession = new Set<string>();

/** How long Home and Results wait for the key before they read it as seen. */
export const READ_TIMEOUT_MS = 800;

export async function readFreeEndSeen(profileId: string, timeoutMs: number = READ_TIMEOUT_MS): Promise<boolean> {
  if (shownThisSession.has(profileId)) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs);
  });
  const read = readJsonStrict<boolean>(freeEndSeenKey(profileId)).then(
    (seen) => seen === true,
    () => true,
  );
  try {
    return await Promise.race([read, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
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

// A removed profile leaves no key behind (F-PROF-001 section 3.3).
onProfileRemoved((profileId) => {
  shownThisSession.delete(profileId);
  void removeKey(freeEndSeenKey(profileId)).catch(() => undefined);
});

/** Tests only: forget what this session showed. */
export function resetFreeEndSessionForTests(): void {
  shownThisSession.clear();
}
