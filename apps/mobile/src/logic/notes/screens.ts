import type { Episode, InboxNote, LearnerMembership, NoteReactionId } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { RootStackParamList } from '../../navigation/types';
import { episodeOfQuest } from '../browse/bundle';
import { isPresetId } from './copy';
import type { NotesData } from './types';
import { showMyNotesRow, visibleNotes, type HomeNotesCard, type NoteDetailView, type NoteRowView } from './view';

/**
 * What the learner's notes screens decide beyond the view models (F-FEEDBACK-001 FB-8; mocks
 * design/screens/notes/home-card.md, notes-list.md, note-page.md): the telemetry events, where
 * Start and the quiet report link go, and the Profile row. Pure.
 *
 * Every `notes.*` event is sent **without** a profile id and carries ids, codes, booleans and
 * counts only (section 10); the Worker drops anything else (`keptEventFields`).
 */

type NoteRole = InboxNote['from']['role'];

export interface NotesEvent {
  name: 'notes.card_shown' | 'notes.list_viewed' | 'notes.note_opened' | 'notes.reaction_picked' | 'notes.suggest_started';
  payload: Record<string, string | number | boolean>;
}

/** The inbox delivers at most 30 notes (section 6.8 rule 7); the Worker keeps counts 0-30 only. */
export const NOTE_EVENT_COUNT_MAX = 30;
const count = (n: number): number => Math.min(Math.max(0, n), NOTE_EVENT_COUNT_MAX);

export function cardShownEvent(card: HomeNotesCard): NotesEvent {
  return { name: 'notes.card_shown', payload: { unread: count(card.kind === 'one' ? 1 : card.count) } };
}

/**
 * `notes.card_shown` once per app session and profile, when the Home card first shows: `sent`
 * lives for the session (module scope in the screen). Null when nothing is to be sent.
 */
export function takeCardShown(sent: Set<string>, profileId: string | undefined, card: HomeNotesCard | null): NotesEvent | null {
  if (card === null || profileId === undefined || sent.has(profileId)) return null;
  sent.add(profileId);
  return cardShownEvent(card);
}

export function listViewedEvent(list: { new: readonly NoteRowView[]; earlier: readonly NoteRowView[] }): NotesEvent {
  return { name: 'notes.list_viewed', payload: { notes: count(list.new.length + list.earlier.length), unread: count(list.new.length) } };
}

/** The note page opened. A preset id this app does not know is left out (never a free string). */
export function noteOpenedEvent(note: InboxNote, view: NoteDetailView): NotesEvent {
  return {
    name: 'notes.note_opened',
    payload: {
      ...(isPresetId(note.presetId) ? { presetId: note.presetId } : {}),
      fromRole: note.from.role,
      hasText: view.text !== null,
      hasSuggest: view.suggest !== null,
      suggestOpen: view.suggest?.open ?? false,
    },
  };
}

export function reactionPickedEvent(reaction: NoteReactionId, fromRole: NoteRole, previous: NoteReactionId | null): NotesEvent {
  return { name: 'notes.reaction_picked', payload: { reaction, fromRole, changed: previous !== null } };
}

export function suggestStartedEvent(fromRole: NoteRole): NotesEvent {
  return { name: 'notes.suggest_started', payload: { fromRole } };
}

/** Start on an open suggested quest opens the quest player, as Journey does; null when no openable episode lists it. */
export function suggestStartTarget(questId: string, episodes: readonly Episode[]): { questId: string; episodeId: string } | null {
  const episode = episodeOfQuest({ episodes: [...episodes] }, questId);
  return episode === undefined ? null : { questId, episodeId: episode.id };
}

export type ReportLinkTarget =
  | { screen: 'PinEntry'; params: RootStackParamList['PinEntry'] }
  | { screen: 'NoteReport'; params: RootStackParamList['NoteReport'] };

/**
 * "Tell a grown-up" opens the gate, which continues to the report sheet of this note; "Report this
 * note" on a self-managed profile opens the sheet directly (section 6.10 item 4).
 */
export function reportLinkTarget(i: { selfManaged: boolean; noteId: string; profileId: string }): ReportLinkTarget {
  if (i.selfManaged) return { screen: 'NoteReport', params: { noteId: i.noteId, profileId: i.profileId } };
  return { screen: 'PinEntry', params: { next: 'NoteReport', noteId: i.noteId, profileId: i.profileId } };
}

/** The link's accessible name: the gated one says it needs the PIN (mock N4); the self-managed one is its label. */
export function reportLinkA11y(m: Messages, label: string, selfManaged: boolean): string {
  return selfManaged ? label : m.caregiver.audience.gated(label, true);
}

/**
 * The "My notes" row on Profile: null when it is not shown (flag off, or no class or family
 * membership and no cached note, section 6.5 item 2); `isNew` while a note shown on this device is
 * unread.
 */
export function myNotesRowView(i: { enabled: boolean; memberships: readonly LearnerMembership[]; data: NotesData | null }): { isNew: boolean } | null {
  if (!showMyNotesRow(i)) return null;
  return { isNew: i.data !== null && visibleNotes(i.data).some((n) => n.readAt === null) };
}

/** The routes the note page, the gate and the report sheet stack over My notes. */
const OVER_NOTES = new Set(['NoteDetail', 'PinEntry', 'NoteReport']);

/**
 * The stack after leaving a note for My notes (Put this note away, Done on the report sheet): the
 * note page and whatever sits over it are dropped, and the My notes below is kept (its key, so the
 * list is never stacked twice); when the note was opened from Home, one My notes is added.
 */
export function notesReturnRoutes<R extends { key: string; name: string }>(routes: readonly R[]): Array<R | { key: string; name: 'Notes' }> {
  const kept = [...routes];
  while (kept.length > 1 && OVER_NOTES.has(kept[kept.length - 1]?.name ?? '')) kept.pop();
  return kept[kept.length - 1]?.name === 'Notes' ? kept : [...kept, { key: `Notes-${Date.now().toString(36)}`, name: 'Notes' }];
}
