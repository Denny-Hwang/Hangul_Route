import { NOTE_REPORT_REASONS, NOTES_MODES, type NotesMode } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { groupByDay, receivedRowView, type FamilyNotePrefs, type NoteBlock, type NoteSender, type OversightNote, type ReceivedRowView } from './notes';

/**
 * The family Received tab and panel D (F-FEEDBACK-001 FB-12, sections 6.10 item 5, 7.2, 7.7 and 8.2 to 8.5; wireframe
 * console/family-notes.md; screen spec design/screens/notes/family-notes.md): which learner the tab shows, its rows with
 * their day word, the one-time class-notes card, the setting's words, the stopped senders and who may send. Rows keep
 * the API's send-time order; nothing is sorted or filtered by sender, status, opens or answers (section 9).
 */

/** A device action reads `"device"` in `hiddenBy`, `reportedBy` and `updatedBy` (section 7.2). */
const DEVICE = 'device';

/** The learner the Received tab shows: the `&learner` one when the family has it, else the first, else nobody. */
export function receivedLearner<T extends { id: string }>(learners: readonly T[], wanted: string | null): T | null {
  return learners.find((l) => l.id === wanted) ?? learners[0] ?? null;
}

export interface ReceivedLine {
  /** "Today", "Yesterday" or a short date, drawn in front of the row's sender line. */
  day: string;
  raw: OversightNote;
  view: ReceivedRowView;
}

/** The Received rows in the API order (newest first), each with its day word and FB-10's row view. */
export function receivedLines(rows: readonly OversightNote[], now: Date, locale: UiLocale = DEFAULT_LOCALE): ReceivedLine[] {
  return groupByDay(rows, now, locale).flatMap((group) => group.rows.map((raw) => ({ day: group.day, raw, view: receivedRowView(raw, locale) })));
}

/** A note from a class (a teacher), read from the sender role, or from the space kind when the role is unreadable. */
const fromClass = (row: OversightNote): boolean => (row.from?.role ?? (row.spaceKind === 'family' ? 'family' : 'teacher')) === 'teacher';

/**
 * The one-time class-notes card (section 6.10 item 5, wireframe C): once a class note reached the learner while the
 * family has not answered the card on any device or here. Never while the setting could not be read.
 */
export function showOneTimeCard(prefs: FamilyNotePrefs | null, rows: readonly OversightNote[]): boolean {
  return prefs !== null && !prefs.acknowledged && rows.some(fromClass);
}

/** The three class-notes modes in their fixed order, with their words. */
export function classModeChoices(locale: UiLocale = DEFAULT_LOCALE): Array<{ id: NotesMode; label: string }> {
  const options = getMessages(locale).console.notes.family.settings.options;
  return NOTES_MODES.map((id) => ({ id, label: options[id] }));
}

/** "Notes from classes: All notes." */
export function oneTimeCardLine(mode: NotesMode, locale: UiLocale = DEFAULT_LOCALE): string {
  const f = getMessages(locale).console.notes.family;
  return f.oneTimeCard.line(f.settings.options[mode]);
}

/** "Last changed by <account>", "Last changed on a device", or null when the setting was never changed. */
export function prefsChangedLine(updatedBy: string | null, locale: UiLocale = DEFAULT_LOCALE): string | null {
  const s = getMessages(locale).console.notes.family.settings;
  if (!updatedBy) return null;
  return updatedBy === DEVICE ? s.lastChangedOnDevice : s.lastChangedBy(updatedBy);
}

/**
 * A stopped sender's row (section 8.5): a teacher as "Your teacher · <class>", a family adult by the account name (or
 * another family of the learner by that space's name), a sender who left as "A former sender", all in the viewer's
 * language (a teacher or family adult without a name reads "Your teacher" / "Your family"). An older Worker without
 * `role` keeps its own line.
 */
export function blockRowLabel(block: NoteBlock, locale: UiLocale = DEFAULT_LOCALE): string {
  const m = getMessages(locale);
  if (block.role === 'former') return m.console.notes.family.settings.stopped.former;
  if (block.role === 'teacher') return block.name ? m.common.notes.teacherLabel(block.name) : m.common.notes.teacherOnly;
  if (block.role === 'family') return block.name || m.common.notes.familyLabels.family;
  return block.label;
}

/** The report sheet's reasons, the app's four (section 6.10 item 4), the third named for the learner. */
export function reportReasonChoices(learner: string, locale: UiLocale = DEFAULT_LOCALE): Array<{ id: (typeof NOTE_REPORT_REASONS)[number]; label: string }> {
  const reasons = getMessages(locale).console.notes.family.report.reasons;
  return NOTE_REPORT_REASONS.map((id) => ({ id, label: id === 'not_for_me' ? reasons.not_for_me(learner) : reasons[id] }));
}

export interface SenderRowView {
  accountId: string;
  /** The account name or email, with "(you)" on the viewer's own row. */
  name: string;
  /** The family owner: always sends, no switch. */
  always: boolean;
  canSend: boolean;
  /** Only the owner turns a caregiver's switch (rule 8.2-b); everyone else reads the list. */
  switchable: boolean;
}

/** Panel D (`console/family-notes.md` D): the family's adults in the API order, the owner's switches live, others read-only. */
export function senderRows(senders: readonly NoteSender[], viewerAccountId: string, locale: UiLocale = DEFAULT_LOCALE): { viewerIsOwner: boolean; rows: SenderRowView[] } {
  const you = getMessages(locale).console.notes.family.senders.you;
  const viewerIsOwner = senders.some((s) => s.accountId === viewerAccountId && s.isOwner);
  return {
    viewerIsOwner,
    rows: senders.map((s) => ({
      accountId: s.accountId,
      name: s.accountId === viewerAccountId ? you(s.name) : s.name,
      always: s.isOwner,
      canSend: s.isOwner || s.canSend,
      switchable: viewerIsOwner && !s.isOwner,
    })),
  };
}

/** Whether the viewer may send in this family (OD-17): true or false from the list, null when the list says nothing. */
export function viewerSendGrant(senders: readonly NoteSender[] | null, viewerAccountId: string): boolean | null {
  const me = senders?.find((s) => s.accountId === viewerAccountId);
  return me ? me.isOwner || me.canSend : null;
}
