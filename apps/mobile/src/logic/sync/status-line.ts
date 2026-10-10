/**
 * The one-line cloud status under "Progress backup" and on sync/save-progress
 * (F-SYNC-002 §3.3). Calm: an old timestamp or an error never reads as alarm.
 */
export interface CloudStatusInput {
  status: 'off' | 'idle' | 'syncing' | 'synced' | 'error';
  lastError: string | null;
  lastSyncedAt: string | null;
}

export function cloudStatusLine(state: CloudStatusInput | undefined, now: Date): string {
  if (!state || state.status === 'off') return 'Saved on this device only.';
  // 403: this device may not save this learner — e.g. it was linked by a class (SEC-4) until a rescue code is entered here.
  if (state.status === 'error' && state.lastError === 'http_403') return 'Saved on this device. A rescue code turns on cloud saving here.';
  if (state.status === 'error') return "Couldn't reach the cloud — will retry.";
  if (state.status === 'syncing') return 'Saving to the cloud…';
  if (!state.lastSyncedAt) return 'Waiting for the first cloud save.';
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(state.lastSyncedAt).getTime()) / 60_000));
  return minutes < 1 ? 'Saved to the cloud · just now' : `Saved to the cloud · ${minutes} min ago`;
}

/**
 * What the screen says once "Save now" has run (sync/save-progress). Same
 * terms as the status line: a device a class linked (403) is told it needs a
 * rescue code, not that the cloud is down.
 */
export function saveNowNote(after: CloudStatusInput | undefined): string {
  if (after?.status === 'synced') return 'Saved to the cloud.';
  if (after?.status === 'off') return 'Cloud saving is not set up on this build.';
  if (after?.status === 'error' && after.lastError === 'http_403') return "This device can't save to the cloud yet. A rescue code turns it on.";
  return "Couldn't reach the cloud — try again later.";
}
