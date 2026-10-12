import {
  NOTE_PRESETS_NEED_SUGGEST,
  type InboxNote,
  type LearnerMembership,
  type LearnerType,
  type NotePrefs,
  type NoteReactionId,
  type UiLocale,
} from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import {
  familyLabelText,
  isPresetId,
  isReactionId,
  noteDateText,
  presetText,
  reactionText,
  reportLinkText,
  seenByText,
  teacherLabelText,
  textLang,
} from './copy';
import { newestFirst } from './apply';
import { pendingReportIds } from './queue';
import type { NotesData } from './types';

/**
 * View models of the learner's notes (F-FEEDBACK-001 FB-7; wireframes home/notes-card.md,
 * notes/list.md, notes/detail.md). Pure: the screens (FB-8) pass the dictionary, the memberships,
 * the profile's learner type, the clock and the content lookups.
 */
export interface NotesViewContext {
  m: Messages;
  locale: UiLocale;
  /** The learner's memberships: the class name of a teacher's note. */
  memberships: readonly LearnerMembership[];
  /** The profile's learner type; absent reads as `child`. */
  learnerType: LearnerType | undefined;
  now: Date;
  /** Whether this build's catalogue has the quest (an older app may not). */
  questKnown: (questId: string) => boolean;
}

export interface NoteRowView {
  id: string;
  fromRole: 'teacher' | 'family';
  sender: string;
  preset: string;
  /** The grown-up's words, as typed; null when none or stripped (encouragements-only mode). */
  text: string | null;
  textLang: string | undefined;
  date: string;
  isNew: boolean;
  reaction: NoteReactionId | null;
  reactionText: string | null;
}

/** Notes the learner sees: not put away on this device, no report waiting. Newest first. */
export function visibleNotes(data: NotesData): InboxNote[] {
  const hidden = new Set([...data.putAway, ...pendingReportIds(data.queue)]);
  return data.notes.filter((n) => !hidden.has(n.id)).sort(newestFirst);
}

/** The quest a note suggests, when this build has it. */
function suggestedQuest(note: InboxNote, ctx: NotesViewContext): string | null {
  return note.suggest !== null && ctx.questKnown(note.suggest.id) ? note.suggest.id : null;
}

function senderOf(note: InboxNote, ctx: NotesViewContext): string {
  if (note.from.role === 'family') return familyLabelText(ctx.m, note.from.label, ctx.learnerType);
  const membership = ctx.memberships.find((row) => row.spaceId === note.spaceId);
  return teacherLabelText(ctx.m, membership?.name ?? null);
}

/**
 * The preset line. A preset that needs a quest whose suggestion this app cannot read or show
 * renders the fallback line, so a note never points at a quest it does not carry (section 7.1).
 */
function presetOf(note: InboxNote, ctx: NotesViewContext): string {
  if (isPresetId(note.presetId) && NOTE_PRESETS_NEED_SUGGEST.has(note.presetId) && suggestedQuest(note, ctx) === null) {
    return ctx.m.common.notes.presetFallback;
  }
  return presetText(ctx.m, note.presetId);
}

function rowOf(note: InboxNote, ctx: NotesViewContext): NoteRowView {
  const reaction = isReactionId(note.reaction) ? note.reaction : null;
  return {
    id: note.id,
    fromRole: note.from.role,
    sender: senderOf(note, ctx),
    preset: presetOf(note, ctx),
    text: note.text,
    textLang: textLang(note),
    date: noteDateText(ctx.m, ctx.locale, note.createdAt, ctx.now),
    isNew: note.readAt === null,
    reaction,
    reactionText: reactionText(ctx.m, reaction),
  };
}

/** My notes: "New" (unread) then "Earlier" (read), each newest first. */
export function notesList(data: NotesData, ctx: NotesViewContext): { new: NoteRowView[]; earlier: NoteRowView[] } {
  const rows = visibleNotes(data).map((n) => rowOf(n, ctx));
  return { new: rows.filter((r) => r.isNew), earlier: rows.filter((r) => !r.isNew) };
}

export type HomeNotesCard =
  | { kind: 'one'; noteId: string; title: string; preset: string; a11y: string }
  | { kind: 'many'; count: number; title: string; from: string; a11y: string };

/**
 * The Home card (row 2a): shown while a visible note is unread. One note opens that note; several
 * open the list. The free text is never on Home, so a glance at a shared screen shows the
 * encouragement only.
 */
export function homeNotesCard(data: NotesData, ctx: NotesViewContext): HomeNotesCard | null {
  const unread = visibleNotes(data).filter((n) => n.readAt === null);
  const newest = unread[0];
  if (newest === undefined) return null;
  const sender = senderOf(newest, ctx);
  const { home } = ctx.m.learner.notes;
  if (unread.length === 1) {
    const preset = presetOf(newest, ctx);
    return { kind: 'one', noteId: newest.id, title: home.title(sender), preset, a11y: ctx.m.a11y.notes.card(sender, preset) };
  }
  return {
    kind: 'many',
    count: unread.length,
    title: home.newCount(unread.length),
    from: home.from(sender),
    a11y: ctx.m.a11y.notes.cardMany(unread.length, sender),
  };
}

/** Who sees the learner's pick: the teacher of a class note while the mode is `all` (or not known here). */
export function reactionSeenBy(note: InboxNote, prefs: NotePrefs | null): 'teacher' | 'family' {
  if (note.from.role === 'family') return 'family';
  const mode = prefs?.classes ?? null;
  return mode === 'presets' || mode === 'off' ? 'family' : 'teacher';
}

export interface NoteDetailView extends NoteRowView {
  /** "From <sender>", under the grown-up's words. */
  from: string;
  /** The suggested quest: open shows Start; closed shows the caption, never a gate or a paywall. */
  suggest: { questId: string; open: boolean } | null;
  seenBy: string;
  /** "Tell a grown-up", or "Report this note" on a self-managed profile. */
  reportLink: string;
}

/** The note page; null when the note is not shown on this device (gone, put away, or reported). */
export function noteDetail(
  data: NotesData,
  noteId: string,
  ctx: NotesViewContext,
  deps: { isQuestOpen: (questId: string) => boolean; selfManaged: boolean },
): NoteDetailView | null {
  const note = visibleNotes(data).find((n) => n.id === noteId);
  if (note === undefined) return null;
  const row = rowOf(note, ctx);
  const questId = suggestedQuest(note, ctx);
  return {
    ...row,
    from: ctx.m.learner.notes.detail.from(row.sender),
    suggest: questId === null ? null : { questId, open: deps.isQuestOpen(questId) },
    seenBy: seenByText(ctx.m, reactionSeenBy(note, data.prefs)),
    reportLink: reportLinkText(ctx.m, deps.selfManaged),
  };
}

/**
 * The Profile row "My notes": only with the flag on and a class or family membership or a cached
 * note, so a self-learner with neither never sees it (section 6.5 item 2).
 */
export function showMyNotesRow(i: { enabled: boolean; memberships: readonly LearnerMembership[]; data: NotesData | null }): boolean {
  if (!i.enabled) return false;
  return i.memberships.length > 0 || (i.data?.notes.length ?? 0) > 0;
}
