import type { InboxNote, NotePrefs } from '@hangul-route/content-schema';
import type { DeliveredNote, StoredNotePrefs } from '../db';

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
