import type { InboxNote, NotePrefs, NoteReactionId, NoteReportReason } from '@hangul-route/content-schema';

/**
 * Notes from grown-ups on the learner device (F-FEEDBACK-001 section 6.9). Pure types: the
 * notes store keeps one `NotesData` per learner profile under `notes:<profileId>`.
 */

/** How the device says a grown-up acted: the grown-up PIN, or a self-managed learner (a client claim). */
export type NoteAttest = 'grown_up_pin' | 'self';

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
  /** The one-time class-notes card was answered (a mirror of `notePrefs.acknowledged`, kept until the next inbox). */
  classNotesCardSeen: boolean;
  queue: PendingWrite[];
}

/** A fresh empty record; every call returns its own object. */
export function emptyNotes(): NotesData {
  return { notes: [], prefs: null, putAway: [], classNotesCardSeen: false, queue: [] };
}
