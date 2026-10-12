import {
  InboxNoteSchema,
  NOTE_REACTION_IDS,
  NOTE_REPORT_REASONS,
  NotePrefsSchema,
  type InboxNote,
  type NotePrefs,
  type NoteReactionId,
  type NoteReportReason,
} from '@hangul-route/content-schema';
import { emptyNotes, type NoteAttest, type NotesData, type PendingWrite } from './types';

/**
 * The per-profile notes record as stored on the device (F-FEEDBACK-001 section 6.9), read back
 * leniently: a part that cannot be read is dropped, never the whole record, so one bad row from an
 * older or newer build never costs the learner their notes. Pure.
 */

/** The storage key of one learner profile's notes; removed with the profile. */
export const notesKey = (profileId: string): string => `notes:${profileId}`;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const REACTIONS: ReadonlySet<string> = new Set(NOTE_REACTION_IDS);
const REASONS: ReadonlySet<string> = new Set(NOTE_REPORT_REASONS);
const ATTESTS: ReadonlySet<string> = new Set<NoteAttest>(['grown_up_pin', 'self']);

const isReaction = (v: unknown): v is NoteReactionId => typeof v === 'string' && REACTIONS.has(v);
const isReason = (v: unknown): v is NoteReportReason => typeof v === 'string' && REASONS.has(v);
const isAttest = (v: unknown): v is NoteAttest => typeof v === 'string' && ATTESTS.has(v);

function readWrite(raw: unknown): PendingWrite | null {
  if (!isObject(raw) || typeof raw.noteId !== 'string' || typeof raw.at !== 'string') return null;
  const { noteId, at } = raw;
  if (raw.kind === 'report') {
    if (!isReason(raw.reason)) return null;
    return { kind: 'report', noteId, reason: raw.reason, ...(isAttest(raw.attest) ? { attest: raw.attest } : {}), at };
  }
  if (raw.kind !== 'state') return null;
  if (raw.reaction !== undefined && !isReaction(raw.reaction)) return null;
  const read = raw.read === true;
  const reaction = isReaction(raw.reaction) ? raw.reaction : undefined;
  if (!read && reaction === undefined) return null;
  return { kind: 'state', noteId, ...(read ? { read: true as const } : {}), ...(reaction ? { reaction } : {}), at };
}

export function readStoredNotes(raw: unknown): NotesData {
  if (!isObject(raw)) return emptyNotes();
  const notes: InboxNote[] = [];
  for (const row of Array.isArray(raw.notes) ? raw.notes : []) {
    const parsed = InboxNoteSchema.safeParse(row);
    if (parsed.success) notes.push(parsed.data);
  }
  let prefs: NotePrefs | null = null;
  if (isObject(raw.prefs)) prefs = NotePrefsSchema.parse(raw.prefs);
  const queue: PendingWrite[] = [];
  for (const row of Array.isArray(raw.queue) ? raw.queue : []) {
    const write = readWrite(row);
    if (write) queue.push(write);
  }
  return {
    notes,
    prefs,
    putAway: (Array.isArray(raw.putAway) ? raw.putAway : []).filter((id): id is string => typeof id === 'string'),
    classNotesCardSeen: raw.classNotesCardSeen === true,
    queue,
  };
}
