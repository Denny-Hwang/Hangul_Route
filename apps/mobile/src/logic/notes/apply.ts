import type { InboxNote, NotePrefs } from '@hangul-route/content-schema';
import type { NotesData, PendingState } from './types';

/**
 * Apply one inbox to a learner's notes (F-FEEDBACK-001 section 6.9, decision D6). Pure.
 *
 * - The inbox is authoritative for which notes exist: a note it no longer lists is gone (hidden,
 *   reported, withdrawn, expired, blocked, its sender lost the right, or the learner left the space).
 * - Read state and reactions are server state, except local writes the server has not acknowledged
 *   yet (a pending state write in the queue), which stay until they are flushed. `readAt` is set
 *   once: the earliest known time wins.
 * - Put-away ids that are no longer listed are dropped; pending state writes of gone notes are
 *   dropped too (the Worker would answer 404). A pending report stays: the next flush sends it.
 */
export interface ApplyResult {
  data: NotesData;
  /** Notes that arrived with this inbox. */
  added: string[];
  /** Notes that left: a note page open on one closes gently to the list. */
  removed: string[];
}

export const newestFirst = (a: InboxNote, b: InboxNote): number => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

export function applyInbox(local: NotesData, inbox: { notes: readonly InboxNote[]; notePrefs: NotePrefs }): ApplyResult {
  const pending = new Map<string, PendingState>();
  for (const write of local.queue) if (write.kind === 'state') pending.set(write.noteId, write);
  const cached = new Map(local.notes.map((n) => [n.id, n]));

  const seen = new Set<string>();
  const notes: InboxNote[] = [];
  for (const server of inbox.notes) {
    if (seen.has(server.id)) continue;
    seen.add(server.id);
    const write = pending.get(server.id);
    const mine = cached.get(server.id);
    const localRead = write?.read ? (mine?.readAt ?? write.at) : null;
    const readAt = server.readAt !== null && (localRead === null || server.readAt <= localRead) ? server.readAt : localRead;
    notes.push({ ...server, readAt, reaction: write?.reaction ?? server.reaction });
  }
  notes.sort(newestFirst);

  return {
    data: {
      notes,
      prefs: { classes: inbox.notePrefs.classes, acknowledged: inbox.notePrefs.acknowledged },
      putAway: local.putAway.filter((id) => seen.has(id)),
      classNotesCardSeen: local.classNotesCardSeen || inbox.notePrefs.acknowledged,
      queue: local.queue.filter((write) => write.kind === 'report' || seen.has(write.noteId)),
    },
    added: [...seen].filter((id) => !cached.has(id)),
    removed: local.notes.filter((n) => !seen.has(n.id)).map((n) => n.id),
  };
}

/** Whether a note is no longer on this device (the note page shows "This note was put away."). */
export function isGone(data: NotesData, noteId: string): boolean {
  return !data.notes.some((n) => n.id === noteId);
}
