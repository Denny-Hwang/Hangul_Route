import { getMessages } from '@hangul-route/i18n';
import type { Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  NOTE_EVENT_COUNT_MAX,
  cardShownEvent,
  listViewedEvent,
  myNotesRowView,
  notesReturnRoutes,
  noteOpenedEvent,
  reactionPickedEvent,
  reportLinkA11y,
  reportLinkTarget,
  suggestStartTarget,
  suggestStartedEvent,
  takeCardShown,
} from '../screens';
import type { HomeNotesCard, NoteDetailView } from '../view';
import { data, familyNote, note } from './fixtures';

const m = getMessages('en');

const one: HomeNotesCard = { kind: 'one', noteId: 'note:aaaaaaaa', title: 't', preset: 'p', a11y: 'a' };
const many = (count: number): HomeNotesCard => ({ kind: 'many', count, title: 't', from: 'f', a11y: 'a' });

const detail = (over: Partial<NoteDetailView> = {}): NoteDetailView => ({
  id: 'note:aaaaaaaa',
  fromRole: 'teacher',
  sender: 'Your teacher',
  preset: 'p',
  text: null,
  textLang: undefined,
  date: 'Today',
  isNew: true,
  reaction: null,
  reactionText: null,
  from: 'From Your teacher',
  suggest: null,
  seenBy: 's',
  reportLink: 'Tell a grown-up',
  ...over,
});

describe('notes telemetry (F-FEEDBACK-001 section 10): ids, codes and counts only, never a profile id', () => {
  it('notes.card_shown carries the unread count: 1 for one note, the count for several, at most 30', () => {
    expect(cardShownEvent(one)).toEqual({ name: 'notes.card_shown', payload: { unread: 1 } });
    expect(cardShownEvent(many(3))).toEqual({ name: 'notes.card_shown', payload: { unread: 3 } });
    expect(cardShownEvent(many(45)).payload).toEqual({ unread: NOTE_EVENT_COUNT_MAX });
  });

  it('notes.card_shown goes once per app session and profile, when the card first shows', () => {
    const sent = new Set<string>();
    expect(takeCardShown(sent, 'profile:a', null)).toBeNull();
    expect(takeCardShown(sent, undefined, one)).toBeNull();
    expect(takeCardShown(sent, 'profile:a', one)).toEqual({ name: 'notes.card_shown', payload: { unread: 1 } });
    expect(takeCardShown(sent, 'profile:a', many(2))).toBeNull();
    expect(takeCardShown(sent, 'profile:b', many(2))).toEqual({ name: 'notes.card_shown', payload: { unread: 2 } });
  });

  it('notes.list_viewed counts every listed note and the new ones', () => {
    const row = { id: 'x' } as never;
    expect(listViewedEvent({ new: [row, row], earlier: [row] })).toEqual({ name: 'notes.list_viewed', payload: { notes: 3, unread: 2 } });
    expect(listViewedEvent({ new: Array(31).fill(row), earlier: [row] }).payload).toEqual({ notes: 30, unread: 30 });
    expect(listViewedEvent({ new: [], earlier: [] }).payload).toEqual({ notes: 0, unread: 0 });
  });

  it('notes.note_opened names the preset, the role and what the note carries; never the text or an id', () => {
    const n = note('aaaaaaaa', { presetId: 'next_try_this', text: 'Hi' });
    const event = noteOpenedEvent(n, detail({ text: 'Hi', suggest: { questId: 'quest:x', open: false } }));
    expect(event).toEqual({
      name: 'notes.note_opened',
      payload: { presetId: 'next_try_this', fromRole: 'teacher', hasText: true, hasSuggest: true, suggestOpen: false },
    });
    expect(JSON.stringify(event)).not.toMatch(/note:|Hi|profile/);
    const open = noteOpenedEvent(familyNote('bbbbbbbb'), detail({ fromRole: 'family', suggest: { questId: 'quest:x', open: true } }));
    expect(open.payload).toEqual({ presetId: 'effort_keep_trying', fromRole: 'family', hasText: false, hasSuggest: true, suggestOpen: true });
  });

  it('notes.note_opened leaves out a preset id this app does not know (the Worker would drop it anyway)', () => {
    const event = noteOpenedEvent(note('aaaaaaaa', { presetId: 'future_preset' }), detail());
    expect(event.payload).toEqual({ fromRole: 'teacher', hasText: false, hasSuggest: false, suggestOpen: false });
  });

  it('notes.reaction_picked says whether an earlier pick was changed', () => {
    expect(reactionPickedEvent('thanks', 'teacher', null)).toEqual({ name: 'notes.reaction_picked', payload: { reaction: 'thanks', fromRole: 'teacher', changed: false } });
    expect(reactionPickedEvent('did_it', 'family', 'thanks').payload).toEqual({ reaction: 'did_it', fromRole: 'family', changed: true });
  });

  it('notes.suggest_started names the role only', () => {
    expect(suggestStartedEvent('family')).toEqual({ name: 'notes.suggest_started', payload: { fromRole: 'family' } });
  });
});

describe('suggestStartTarget: Start opens the quest as Journey does', () => {
  const episodes = [
    { id: 'episode:shelf', questIds: ['quest:a'], status: 'shipped', placement: 'shelf' },
    { id: 'episode:grid', questIds: ['quest:a', 'quest:b'], status: 'shipped' },
  ] as unknown as Episode[];

  it('finds the grid episode that lists the quest, before a shelf episode', () => {
    expect(suggestStartTarget('quest:a', episodes)).toEqual({ questId: 'quest:a', episodeId: 'episode:grid' });
    expect(suggestStartTarget('quest:b', episodes)).toEqual({ questId: 'quest:b', episodeId: 'episode:grid' });
  });

  it('is null for a quest no openable episode lists', () => {
    expect(suggestStartTarget('quest:none', episodes)).toBeNull();
  });
});

describe('the quiet report link (section 6.10 item 4)', () => {
  it('a gated profile opens the gate with NoteReport, the note and the profile', () => {
    expect(reportLinkTarget({ selfManaged: false, noteId: 'note:aaaaaaaa', profileId: 'profile:a' })).toEqual({
      screen: 'PinEntry',
      params: { next: 'NoteReport', noteId: 'note:aaaaaaaa', profileId: 'profile:a' },
    });
  });

  it('a self-managed profile opens the report sheet directly', () => {
    expect(reportLinkTarget({ selfManaged: true, noteId: 'note:aaaaaaaa', profileId: 'profile:a' })).toEqual({
      screen: 'NoteReport',
      params: { noteId: 'note:aaaaaaaa', profileId: 'profile:a' },
    });
  });

  it('"Tell a grown-up" says it needs the PIN in its name; "Report this note" does not', () => {
    expect(reportLinkA11y(m, 'Tell a grown-up', false)).toBe('Tell a grown-up (PIN required)');
    expect(reportLinkA11y(m, 'Report this note', true)).toBe('Report this note');
  });
});

describe('myNotesRowView (section 6.5 item 2)', () => {
  it('is hidden with the flag off, or with no membership and no cached note', () => {
    expect(myNotesRowView({ enabled: false, memberships: [{} as never], data: null })).toBeNull();
    expect(myNotesRowView({ enabled: true, memberships: [], data: data() })).toBeNull();
    expect(myNotesRowView({ enabled: true, memberships: [], data: null })).toBeNull();
  });

  it('shows the New pill while a visible note is unread', () => {
    expect(myNotesRowView({ enabled: true, memberships: [{} as never], data: null })).toEqual({ isNew: false });
    expect(myNotesRowView({ enabled: true, memberships: [], data: data({ notes: [note('aaaaaaaa')] }) })).toEqual({ isNew: true });
    const read = note('aaaaaaaa', { readAt: '2026-10-10T10:00:00.000Z' });
    expect(myNotesRowView({ enabled: true, memberships: [], data: data({ notes: [read] }) })).toEqual({ isNew: false });
    // A put-away unread note is not new on this device.
    expect(myNotesRowView({ enabled: true, memberships: [], data: data({ notes: [note('aaaaaaaa')], putAway: ['note:aaaaaaaa'] }) })).toEqual({ isNew: false });
  });
});

describe('notesReturnRoutes (back to one My notes, section 6.10 items 3 and 4)', () => {
  const r = (name: string, key = name): { key: string; name: string } => ({ key, name });

  it('drops the note page (and the sheet and PIN above it) and goes back to the My notes below', () => {
    expect(notesReturnRoutes([r('Main'), r('Notes'), r('NoteDetail')]).map((x) => x.name)).toEqual(['Main', 'Notes']);
    expect(notesReturnRoutes([r('Main'), r('Notes'), r('NoteDetail'), r('NoteReport')]).map((x) => x.name)).toEqual(['Main', 'Notes']);
    expect(notesReturnRoutes([r('Main'), r('Notes'), r('NoteDetail'), r('PinEntry'), r('NoteReport')]).map((x) => x.name)).toEqual(['Main', 'Notes']);
    // The same Notes route is kept (its key), so the list is not stacked twice.
    expect(notesReturnRoutes([r('Main'), r('Notes', 'notes-1'), r('NoteDetail')])[1]).toEqual({ key: 'notes-1', name: 'Notes' });
  });

  it('adds one My notes when none is below (the Home card opened the note)', () => {
    const out = notesReturnRoutes([r('Main'), r('NoteDetail'), r('NoteReport')]);
    expect(out.map((x) => x.name)).toEqual(['Main', 'Notes']);
    expect(out[1]?.key).toMatch(/^Notes-/);
  });

  it('a wide window: the sheet over My notes goes back to it', () => {
    expect(notesReturnRoutes([r('Main'), r('Notes'), r('NoteReport')]).map((x) => x.name)).toEqual(['Main', 'Notes']);
  });
});
