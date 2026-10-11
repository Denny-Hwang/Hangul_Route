import type { Messages } from '@hangul-route/i18n';

/**
 * The one-line cloud status under "Progress backup" and on sync/save-progress
 * (F-SYNC-002 §3.3). Calm: an old timestamp or an error never reads as alarm.
 * The words are `caregiver.sync`, passed in by the screen so this stays pure and
 * testable per locale (F-I18N-001 §3.4 rule 3).
 */
export interface CloudStatusInput {
  status: 'off' | 'idle' | 'syncing' | 'synced' | 'error';
  lastError: string | null;
  lastSyncedAt: string | null;
}

type SyncMessages = Messages['caregiver']['sync'];

export function cloudStatusLine(state: CloudStatusInput | undefined, now: Date, m: SyncMessages): string {
  if (!state || state.status === 'off') return m.status.deviceOnly;
  // 403: this device may not save this learner — e.g. it was linked by a class (SEC-4) until a rescue code is entered here.
  if (state.status === 'error' && state.lastError === 'http_403') return m.status.needsRescueCode;
  if (state.status === 'error') return m.status.retrying;
  if (state.status === 'syncing') return m.status.saving;
  if (!state.lastSyncedAt) return m.status.waiting;
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(state.lastSyncedAt).getTime()) / 60_000));
  return minutes < 1 ? m.status.justNow : m.status.minutesAgo(minutes);
}

/**
 * What the screen says once "Save now" has run (sync/save-progress). Same
 * terms as the status line: a device a class linked (403) is told it needs a
 * rescue code, not that the cloud is down.
 */
export function saveNowNote(after: CloudStatusInput | undefined, m: SyncMessages): string {
  if (after?.status === 'synced') return m.saveNow.saved;
  if (after?.status === 'off') return m.saveNow.off;
  if (after?.status === 'error' && after.lastError === 'http_403') return m.saveNow.needsRescueCode;
  return m.saveNow.unreachable;
}
