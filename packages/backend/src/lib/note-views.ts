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
  /** The learner is still a student of the space (delivery rule 2; an adult's removal keeps the notes, section 7.5). */
  learnerInSpace: boolean;
}

/**
 * The status word of section 7.2 for one note. A note taken back reads `withdrawn` for good, from
 * `withdrawnAt`, even after a report changes its status: otherwise a report of a taken-back note would turn
 * it `not_shown` and tell its sender, a family adult included, that the learner reported it (rule 8.2-c).
 */
export function sentNoteStatus(note: Pick<StoredNote, 'status' | 'readAt' | 'withdrawnAt'>, facts: SentNoteFacts): SentNoteStatus {
  if (note.withdrawnAt !== null || note.status === 'withdrawn') return 'withdrawn';
  if (note.status !== 'live' || facts.blocked || !facts.senderMaySend || !facts.learnerInSpace) return 'not_shown';
  if (facts.spaceKind === 'class') return facts.mode === 'off' ? 'not_shown' : 'sent';
  return note.readAt === null ? 'sent' : 'opened';
}

/** The learner's pick, only while the note is shown and, for a class note, only while the mode is `all` (section 7.7). */
export function sentNoteReaction(note: Pick<StoredNote, 'reaction'>, status: SentNoteStatus, facts: SentNoteFacts): string | null {
  if (status !== 'sent' && status !== 'opened') return null;
  if (facts.spaceKind === 'class' && facts.mode !== 'all') return null;
  return note.reaction;
}

/**
 * A collapsed `everyone` batch reads `withdrawn` once none of it is live and a note of it was taken back
 * (`withdrawnAt`, so a later report of a taken-back note changes nothing); otherwise `sent`.
 */
export function batchStatus(batch: { live: number; withdrawn: number }): 'sent' | 'withdrawn' {
  return batch.live === 0 && batch.withdrawn > 0 ? 'withdrawn' : 'sent';
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

/*
 * The family view of every note to a learner — F-FEEDBACK-001 sections 7.2
 * and 8.2 (PR FB-4b-family). The family sees every status, also notes taken
 * back, with who acted: an account name for a console action, `"device"` for a
 * device action. Rule 8.2-c: a note the learner reported from a device reads
 * `not_shown` to its own sender, never "reported" or "via device".
 */
export type OversightStatus = 'live' | 'opened' | 'hidden' | 'reported' | 'withdrawn' | 'not_shown';
/** Who acted, for an action from the learner's device. */
export const DEVICE_ACTOR = 'device';

export interface OversightFacts {
  /** The inbox rules would deliver it now (space, membership, mode, block, sender's right). */
  delivered: boolean;
  /** The viewing account sent the note. */
  viewerIsSender: boolean;
  /** At least one report on the note came from a device. */
  reportedOnDevice: boolean;
}

export function oversightStatus(note: Pick<StoredNote, 'status' | 'readAt'>, facts: OversightFacts): OversightStatus {
  if (note.status === 'withdrawn' || note.status === 'hidden') return note.status;
  if (note.status === 'reported') return facts.viewerIsSender && facts.reportedOnDevice ? 'not_shown' : 'reported';
  if (!facts.delivered) return 'not_shown';
  return note.readAt === null ? 'live' : 'opened';
}

/** An account as the family view names it: its display name, else its email (adult to adult inside the family). */
export function accountLabel(account: { displayName: string | null; email: string | null } | null): string {
  return account?.displayName || account?.email || '';
}

const SENDER_REF_HEX = 32;

/**
 * The opaque reference of a stopped sender (section 7.2 blocks): an HMAC-SHA-256 of the account id keyed per
 * family, so the account id never travels to the console and a reference means nothing in another family.
 */
export async function senderRefFor(familyId: string, accountId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(`note-sender-ref:${familyId}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(accountId)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, SENDER_REF_HEX);
}
