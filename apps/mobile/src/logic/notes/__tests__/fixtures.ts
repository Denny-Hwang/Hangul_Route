import type { InboxNote, LearnerMembership } from '@hangul-route/content-schema';
import { emptyNotes, type NotesData } from '../types';

/** One delivered note, as `InboxNoteSchema` reads it; override any field. */
export function note(id: string, over: Partial<InboxNote> = {}): InboxNote {
  return {
    id: `note:${id}`,
    spaceId: 'space:cls',
    from: { role: 'teacher', label: null },
    presetId: 'effort_keep_trying',
    text: null,
    textLocale: null,
    suggest: null,
    createdAt: '2026-10-10T09:00:00.000Z',
    readAt: null,
    reaction: null,
    ...over,
  };
}

export function familyNote(id: string, over: Partial<InboxNote> = {}): InboxNote {
  return note(id, { spaceId: 'space:fam', from: { role: 'family', label: 'grandma' }, ...over });
}

export function data(over: Partial<NotesData> = {}): NotesData {
  return { ...emptyNotes(), ...over };
}

export const classRow: LearnerMembership = { spaceId: 'space:cls', kind: 'class', name: 'Sunday Class A', role: 'student', joinedAt: 't' };
export const familyRow: LearnerMembership = { spaceId: 'space:fam', kind: 'family', name: 'Kim family', role: 'student', joinedAt: 't' };
