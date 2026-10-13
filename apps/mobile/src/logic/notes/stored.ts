import {
  InboxNoteSchema,
  NOTE_REACTION_IDS,
  NOTE_REPORT_REASONS,
  NoteAttestSchema,
  NotePrefsSchema,
  type InboxNote,
  type NotePrefs,
  type NoteReactionId,
  type NoteReportReason,
} from '@hangul-route/content-schema';
import { newestFirst } from './apply';
import { enqueueReport, enqueueState } from './queue';
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
const ATTESTS: ReadonlySet<string> = new Set<NoteAttest>(NoteAttestSchema.options);

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
  // A reaction this build does not know (a newer build, or a downgrade) is dropped, but the read stays,
  // so the Worker still learns the note was opened; a write left with neither is dropped.
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
    ...(Array.isArray(raw.grownUpSeenIds) ? { grownUpSeenIds: raw.grownUpSeenIds.filter((id): id is string => typeof id === 'string') } : {}),
  };
}

/** Both records' grown-up zone marks: a note seen in either was seen. */
function seenIds(a: readonly string[] | undefined, b: readonly string[] | undefined): { grownUpSeenIds?: string[] } {
  return a === undefined && b === undefined ? {} : { grownUpSeenIds: [...new Set([...(a ?? []), ...(b ?? [])])] };
}

/**
 * The stored record with the changes made in memory before it could be read (a read that failed,
 * then one that worked). Memory that applied an inbox (`prefs` set) is authoritative for which
 * notes exist; otherwise the stored notes stay, with any note held in memory on top. No report and
 * no put-away id is lost, and a state write made in memory is merged into the stored one for its
 * note (the newer pick wins). Pure.
 */
export function mergeUnloaded(stored: NotesData, memory: NotesData): NotesData {
  const fresh = memory.prefs !== null;
  const byId = new Map<string, InboxNote>(fresh ? [] : stored.notes.map((n) => [n.id, n]));
  for (const n of memory.notes) byId.set(n.id, n);
  const notes = [...byId.values()].sort(newestFirst);
  const ids = new Set(byId.keys());
  let queue: PendingWrite[] = [...stored.queue];
  for (const w of memory.queue) {
    queue =
      w.kind === 'report'
        ? enqueueReport(queue, w.noteId, w.reason, w.attest, w.at)
        : enqueueState(queue, w.noteId, { ...(w.read ? { read: true as const } : {}), ...(w.reaction ? { reaction: w.reaction } : {}) }, w.at);
  }
  if (fresh) queue = queue.filter((w) => w.kind === 'report' || ids.has(w.noteId));
  return {
    notes,
    prefs: memory.prefs ?? stored.prefs,
    putAway: [...new Set([...stored.putAway, ...memory.putAway])].filter((id) => ids.has(id)),
    classNotesCardSeen: fresh ? memory.classNotesCardSeen : stored.classNotesCardSeen || memory.classNotesCardSeen,
    queue,
    ...seenIds(stored.grownUpSeenIds, memory.grownUpSeenIds),
  };
}
