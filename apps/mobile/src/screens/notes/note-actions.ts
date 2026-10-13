import type { NoteDevicePrefsPut, NoteReportReason } from '@hangul-route/content-schema';
import { hideOutcome, prefsOutcome, reportOutcome, type ReportAnswer } from '../../logic/notes/grown-up';
import type { NoteAttest } from '../../logic/notes/types';
import { deviceCredentialsFor } from '../../store/membership-store';
import { useNotesStore } from '../../store/notes-store';
import { syncApi } from '../../store/sync-store';

/**
 * The grown-up zone's calls to the device routes (F-FEEDBACK-001 sections 6.9, 6.10, 7.6; FB-9).
 * Hide and the class-notes setting need a connection (never queued: they act on every device). A
 * report is queued first, so the note is hidden here at once, then sent now when it can be.
 */

/** Hide on every device. The note leaves this device as soon as the Worker says it is hidden or gone. */
export async function hideNoteNow(profileId: string, noteId: string): Promise<ReturnType<typeof hideOutcome>> {
  const client = syncApi();
  const creds = client === null ? null : await deviceCredentialsFor(profileId);
  const outcome = hideOutcome(client === null || creds === null ? null : await client.hideNote(profileId, noteId, creds));
  if (outcome === 'hidden' || outcome === 'alreadyGone') await useNotesStore.getState().forgetNote(profileId, noteId);
  return outcome;
}

/** Save the class-notes setting (and the one-time card's acknowledgement); the local copy follows only what the Worker accepted. */
export async function putNotePrefsNow(profileId: string, body: NoteDevicePrefsPut): Promise<ReturnType<typeof prefsOutcome>> {
  const client = syncApi();
  const creds = client === null ? null : await deviceCredentialsFor(profileId);
  const outcome = prefsOutcome(client === null || creds === null ? null : await client.putNotePrefs(profileId, body, creds));
  if (outcome === 'saved') {
    const acknowledged = body.acknowledge === true || (useNotesStore.getState().byProfile[profileId]?.prefs?.acknowledged ?? false);
    await useNotesStore.getState().setPrefs(profileId, { classes: body.classes, acknowledged });
  }
  return outcome;
}

/** Report and hide: queued with a local hide, then sent with the rest of the queue when this device can reach the Worker. */
export async function reportNoteNow(profileId: string, noteId: string, reason: NoteReportReason, attest: NoteAttest): Promise<ReportAnswer> {
  await useNotesStore.getState().queueReport(profileId, noteId, reason, attest);
  const client = syncApi();
  const creds = client === null ? null : await deviceCredentialsFor(profileId);
  if (client === null || creds === null) return 'queued';
  const results = await useNotesStore.getState().flush(profileId, client, creds).catch(() => []);
  return reportOutcome(results.find((r) => r.kind === 'report' && r.noteId === noteId)?.outcome);
}
