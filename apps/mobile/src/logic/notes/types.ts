import type { InboxNote, NoteAttest, NotePrefs, NoteReactionId, NoteReportReason } from '@hangul-route/content-schema';

/**
 * Notes from grown-ups on the learner device (F-FEEDBACK-001 section 6.9). Pure types: the
 * notes store keeps one `NotesData` per learner profile under `notes:<profileId>`.
 */

/** How the device says a grown-up acted: the grown-up PIN, or a self-managed learner (a client claim; content-schema `NoteAttestSchema`). */
export type { NoteAttest };

/** A read or a reaction not yet acknowledged by the Worker: at most one per note (the newest pick wins). */
export interface PendingState {
  kind: 'state';
  noteId: string;
  read?: true;
  reaction?: NoteReactionId;
  /** When the write was made; it also tells a write in flight from a newer one. */
  at: string;
}

/** A report not yet sent: at most one per note. The note is hidden on this device at once. */
export interface PendingReport {
  kind: 'report';
  noteId: string;
  reason: NoteReportReason;
  attest?: NoteAttest;
  at: string;
}

export type PendingWrite = PendingState | PendingReport;

export interface NotesData {
  /** The delivered notes, newest first, with the local read state and reaction folded in. */
  notes: InboxNote[];
  /** `notePrefs` of the last inbox; null until this device applied one. */
  prefs: NotePrefs | null;
  /** Notes the learner put away on this device (never sent anywhere). */
  putAway: string[];
  /**
   * The one-time class-notes card was answered: a mirror of `notePrefs.acknowledged`. A local mark
   * (FB-9 sets it with the online `PUT note-prefs { acknowledge: true }`) lasts until the next inbox,
   * which replaces it with the server's value.
   */
  classNotesCardSeen: boolean;
  queue: PendingWrite[];
  /**
   * The note ids this device held when a grown-up last opened this learner's notes in the grown-up
   * zone (FB-9, section 6.10 item 1): the dashboard row says "New" for a note that arrived on this
   * device since, whenever it was written (a late or offline delivery still counts, and the device
   * clock plays no part). Optional, read leniently; never sent to the server.
   */
  grownUpSeenIds?: string[];
}

/** A fresh empty record; every call returns its own object. */
export function emptyNotes(): NotesData {
  return { notes: [], prefs: null, putAway: [], classNotesCardSeen: false, queue: [] };
}
