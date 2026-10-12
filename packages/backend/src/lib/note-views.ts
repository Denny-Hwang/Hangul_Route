import type { InboxNote, NotePrefs, NotesMode } from '@hangul-route/content-schema';
import type { DeliveredNote, NoteCursor, StoredNote, StoredNotePrefs } from '../db';

/*
 * How notes reach the learner's device — F-FEEDBACK-001 sections 6.8 and 7.1
 * (PR FB-4a). Only what the learner may see goes on the wire: never the sender
 * account, the batch, or who hid or reported what.
 */

/** One delivered note as `InboxNoteSchema` reads it. A class note carries no label; a note without text carries no text locale. */
export function inboxNoteView(n: DeliveredNote): InboxNote {
  return {
    id: n.id,
    spaceId: n.spaceId,
    from: { role: n.senderRole, label: n.senderRole === 'family' ? (n.senderLabel ?? 'family') : null },
    presetId: n.presetId,
    text: n.body,
    textLocale: n.body === null ? null : (n.bodyLocale as InboxNote['textLocale']),
    suggest: n.suggest,
    createdAt: n.createdAt,
    readAt: n.readAt,
    reaction: n.reaction,
  };
}

/** The learner's class-notes setting on the wire; without a row, the defaults: all class notes (OD-3), card not answered. */
export function notePrefsView(p: StoredNotePrefs | null): NotePrefs {
  return { classes: p?.classes ?? 'all', acknowledged: p?.acknowledgedAt !== null && p?.acknowledgedAt !== undefined };
}

/*
 * The sent list of a space — F-FEEDBACK-001 section 7.2 (PR FB-3b). A class
 * sender never reads `opened` (OD-8) and is never told why a note is not
 * shown: hidden, reported, a notes mode of `off`, a block and a lost right all
 * read `not_shown`. The family sees `opened` too.
 */
export type SentNoteStatus = 'sent' | 'opened' | 'not_shown' | 'withdrawn';

/** What the sending space knows about one note's learner and sender, besides the stored row. */
export interface SentNoteFacts {
  spaceKind: 'class' | 'family' | 'school';
  /** The learner's class-notes mode now (`all` without a prefs row). */
  mode: NotesMode;
  /** The learner's family stopped this note's sender. */
  blocked: boolean;
  /** The sender still holds `feedback.send` in the space (delivery rule 6). */
  senderMaySend: boolean;
}

/** The status word of section 7.2 for one note. */
export function sentNoteStatus(note: Pick<StoredNote, 'status' | 'readAt'>, facts: SentNoteFacts): SentNoteStatus {
  if (note.status === 'withdrawn') return 'withdrawn';
  if (note.status !== 'live' || facts.blocked || !facts.senderMaySend) return 'not_shown';
  if (facts.spaceKind === 'class') return facts.mode === 'off' ? 'not_shown' : 'sent';
  return note.readAt === null ? 'sent' : 'opened';
}

/** The learner's pick, only while the note is shown and, for a class note, only while the mode is `all` (section 7.7). */
export function sentNoteReaction(note: Pick<StoredNote, 'reaction'>, status: SentNoteStatus, facts: SentNoteFacts): string | null {
  if (status !== 'sent' && status !== 'opened') return null;
  if (facts.spaceKind === 'class' && facts.mode !== 'all') return null;
  return note.reaction;
}

/** A collapsed `everyone` batch reads `withdrawn` once none of it is live and its representative was taken back; otherwise `sent`. */
export function batchStatus(note: Pick<StoredNote, 'status'>, batch: { live: number }): 'sent' | 'withdrawn' {
  return batch.live === 0 && note.status === 'withdrawn' ? 'withdrawn' : 'sent';
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/;
const CURSOR_NOTE_ID = /^note:[a-z0-9-]{8,64}$/;

/** The `next` of a page: the last row's send time and id, so a batch sharing one send time is never skipped across pages. */
export function encodeNoteCursor(note: Pick<StoredNote, 'createdAt' | 'id'>): string {
  return `${note.createdAt}~${note.id}`;
}

/**
 * `before` as a list route reads it: a `next` value, or a plain ISO time (rows strictly older). Answers
 * null for anything else, which the route refuses with 422.
 */
export function parseNoteCursor(raw: string): NoteCursor | null {
  const [time, id, ...rest] = raw.split('~');
  if (time === undefined || rest.length > 0 || !ISO_INSTANT.test(time)) return null;
  const ms = Date.parse(time);
  if (Number.isNaN(ms)) return null;
  if (id !== undefined && !CURSOR_NOTE_ID.test(id)) return null;
  return { createdAt: new Date(ms).toISOString(), id: id ?? '' };
}
