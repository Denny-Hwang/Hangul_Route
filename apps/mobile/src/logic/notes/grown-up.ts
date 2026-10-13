import type { LearnerMembership, NotePrefs, NoteReactionId, NoteReportReason, NotesMode } from '@hangul-route/content-schema';
import type { NoteWriteResult } from '../../platform/sync-api';
import { newestFirst } from './apply';
import { pendingReportIds } from './queue';
import type { FlushOutcome } from './queue';
import type { NoteAttest, NotesData } from './types';
import { notesList, type NotesViewContext } from './view';

/**
 * The grown-up zone of notes in the learner app (F-FEEDBACK-001 section 6.10, FB-9; mocks
 * design/screens/notes/grown-up-notes.md and note-report.md). Pure. Behind the gate the grown-up
 * sees every delivered note of a learner, put-away ones too, and can hide (online, every device),
 * report (queued, hidden here at once) and choose what class notes deliver.
 */

const hasClass = (memberships: readonly LearnerMembership[]): boolean => memberships.some((row) => row.kind === 'class');

/** The dashboard row "Notes for <learner>": null when the profile has no notes and no memberships. */
export function grownUpRow(i: { data: NotesData | null; memberships: readonly LearnerMembership[] }): { isNew: boolean } | null {
  const notes = i.data?.notes ?? [];
  if (notes.length === 0 && i.memberships.length === 0) return null;
  const seen = i.data?.grownUpSeenAt;
  return { isNew: notes.some((n) => seen === undefined || n.createdAt > seen) };
}

export interface GrownUpNoteRow {
  id: string;
  fromRole: 'teacher' | 'family';
  /** "<sender> · <date>": the row's first line, which also describes its Hide and Report buttons. */
  line: string;
  preset: string;
  text: string | null;
  textLang: string | undefined;
  /** The learner opened it (a family view may say so; section 6.7). */
  opened: boolean;
  reaction: NoteReactionId | null;
  reactionText: string | null;
  /** Put away on this device by the learner: still listed, so a grown-up can report it. */
  putAway: boolean;
}

/**
 * Every delivered note of the learner, newest first: put-away ones marked, a note with a report
 * waiting left out (it is hidden here until the inbox drops it). Never sorted by sender or status.
 */
export function grownUpNotes(data: NotesData, ctx: NotesViewContext): GrownUpNoteRow[] {
  const reporting = pendingReportIds(data.queue);
  const putAway = new Set(data.putAway);
  // The view rows of every note (put away or not), so sender, preset and date read exactly as the learner's.
  const all = notesList({ ...data, putAway: [], queue: data.queue.filter((w) => w.kind !== 'report') }, ctx);
  const rows = new Map([...all.new, ...all.earlier].map((r) => [r.id, r]));
  return [...data.notes]
    .sort(newestFirst)
    .filter((n) => !reporting.has(n.id))
    .flatMap((n): GrownUpNoteRow[] => {
      const row = rows.get(n.id);
      if (row === undefined) return [];
      return [
        {
          id: row.id,
          fromRole: row.fromRole,
          line: row.date === '' ? row.sender : `${row.sender} · ${row.date}`,
          preset: row.preset,
          text: row.text,
          textLang: row.textLang,
          opened: n.readAt !== null,
          reaction: row.reaction,
          reactionText: row.reactionText,
          putAway: putAway.has(n.id),
        },
      ];
    });
}

/** The class-notes setting shows for a learner in a class, and only while this app knows the mode (section 6.10 item 2). */
export function showModeSetting(i: { memberships: readonly LearnerMembership[]; prefs: NotePrefs | null }): boolean {
  return hasClass(i.memberships) && i.prefs !== null && i.prefs.classes !== null;
}

/**
 * The one-time class-notes card (section 6.10 item 5): once a class note reached the learner and the
 * family has not answered it (never while the mode is unknown). `mode` is the current choice.
 */
export function oneTimeCard(i: { memberships: readonly LearnerMembership[]; data: NotesData | null }): { mode: NotesMode } | null {
  const prefs = i.data?.prefs ?? null;
  if (i.data === null || prefs === null || prefs.classes === null) return null;
  if (prefs.acknowledged || i.data.classNotesCardSeen || !hasClass(i.memberships)) return null;
  return i.data.notes.some((n) => n.from.role === 'teacher') ? { mode: prefs.classes } : null;
}

export type ReportAnswer = 'reported' | 'tooMany' | 'alreadyGone' | 'queued';

/** What the report sheet says after Report and hide, from the flush outcome of its report (none: still waiting). */
export function reportOutcome(outcome: FlushOutcome | undefined): ReportAnswer {
  if (outcome === 'done') return 'reported';
  if (outcome === 'limited') return 'tooMany';
  if (outcome === 'drop') return 'alreadyGone';
  return 'queued';
}

const offlineOr = (result: NoteWriteResult | null): boolean => result === null || (result.status === 'error' && result.http === -1);
const scopeLimited = (result: NoteWriteResult): boolean => result.status === 'error' && result.http === 403 && result.code === 'scope_limited';

/** The hide route's answer; null when there is no connection or no device credentials. */
export function hideOutcome(result: NoteWriteResult | null): 'hidden' | 'alreadyGone' | 'classScoped' | 'offline' | 'failed' {
  if (offlineOr(result)) return 'offline';
  const r = result as NoteWriteResult;
  if (r.status === 'ok') return 'hidden';
  if (r.http === 404) return 'alreadyGone';
  return scopeLimited(r) ? 'classScoped' : 'failed';
}

/** The note-prefs route's answer; null when there is no connection or no device credentials. */
export function prefsOutcome(result: NoteWriteResult | null): 'saved' | 'classScoped' | 'offline' | 'failed' {
  if (offlineOr(result)) return 'offline';
  const r = result as NoteWriteResult;
  if (r.status === 'ok') return 'saved';
  return scopeLimited(r) ? 'classScoped' : 'failed';
}

export type ReportVia = 'note_page' | 'grown_up_zone';

/** `notes.report_sent`, sent without a profile id (section 10). */
export function reportSentEvent(reason: NoteReportReason, via: ReportVia): { name: 'notes.report_sent'; payload: { reason: NoteReportReason; via: ReportVia } } {
  return { name: 'notes.report_sent', payload: { reason, via } };
}

/** `notes.prefs_changed`, sent without a profile id (section 10). */
export function prefsChangedEvent(classes: NotesMode): { name: 'notes.prefs_changed'; payload: { classes: NotesMode } } {
  return { name: 'notes.prefs_changed', payload: { classes } };
}

/** The claim a device route records (`NoteAttestSchema`): the grown-up PIN, or a self-managed learner. */
export const attestFor = (selfManaged: boolean): NoteAttest => (selfManaged ? 'self' : 'grown_up_pin');

/** Done on the report sheet: My notes when it came from the note page, else back to Notes for <learner>. */
export const noteReportDoneTarget = (via: ReportVia): 'Notes' | 'back' => (via === 'note_page' ? 'Notes' : 'back');
