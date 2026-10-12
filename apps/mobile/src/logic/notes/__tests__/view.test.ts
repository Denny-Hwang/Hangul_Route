import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import { homeNotesCard, noteDetail, notesList, reactionSeenBy, showMyNotesRow, visibleNotes, type NotesViewContext } from '../view';
import { classRow, data, familyNote, familyRow, note } from './fixtures';

const m = getMessages('en');
const now = new Date('2026-10-12T15:00:00.000Z');
const ctx = (over: Partial<NotesViewContext> = {}): NotesViewContext => ({
  m,
  locale: 'en',
  memberships: [classRow, familyRow],
  learnerType: 'child',
  now,
  questKnown: (id) => id === 'quest:stage1-letters-q1',
  ...over,
});

const unreadTeacher = note('aaaaaaaa', { createdAt: '2026-10-12T09:00:00.000Z', text: 'Loved your work today' });
const unreadFamily = familyNote('bbbbbbbb', { createdAt: '2026-10-11T09:00:00.000Z', presetId: 'warm_thinking_of_you' });
const readOld = note('cccccccc', { createdAt: '2026-10-03T09:00:00.000Z', readAt: '2026-10-03T10:00:00.000Z', reaction: 'thanks', presetId: 'progress_reading' });

describe('visibleNotes', () => {
  it('leaves out notes put away on this device and notes with a pending report', () => {
    const d = data({
      notes: [unreadTeacher, unreadFamily, readOld],
      putAway: ['note:bbbbbbbb'],
      queue: [{ kind: 'report', noteId: 'note:cccccccc', reason: 'unkind', at: 't' }],
    });
    expect(visibleNotes(d).map((n) => n.id)).toEqual(['note:aaaaaaaa']);
  });
});

describe('notesList (wireframe notes/list.md)', () => {
  it('groups New then Earlier, newest first, without put-away notes', () => {
    const d = data({ notes: [unreadTeacher, unreadFamily, readOld], putAway: [] });
    const list = notesList(d, ctx());
    expect(list.new.map((r) => r.id)).toEqual(['note:aaaaaaaa', 'note:bbbbbbbb']);
    expect(list.earlier.map((r) => r.id)).toEqual(['note:cccccccc']);
    expect(list.new[0]).toMatchObject({
      sender: 'Your teacher · Sunday Class A',
      preset: 'You keep trying. That is how we learn.',
      text: 'Loved your work today',
      date: 'Today',
      isNew: true,
      reaction: null,
      fromRole: 'teacher',
    });
    expect(list.new[1]).toMatchObject({ sender: 'Grandma', preset: 'Thinking of you. Have fun learning today.', date: 'Yesterday', text: null });
    expect(list.earlier[0]).toMatchObject({ isNew: false, reaction: 'thanks', reactionText: 'Thank you', date: 'Oct 3' });
    expect(notesList(data({ notes: [unreadTeacher], putAway: ['note:aaaaaaaa'] }), ctx())).toEqual({ new: [], earlier: [] });
  });

  it('names a teacher by the class name from the memberships; an unknown class reads "Your teacher"', () => {
    const list = notesList(data({ notes: [unreadTeacher] }), ctx({ memberships: [familyRow] }));
    expect(list.new[0]?.sender).toBe('Your teacher');
  });

  it('reads "Your partner" only on a self learner (FAMILY_LABELS_SELF_LEARNER_ONLY)', () => {
    const partner = familyNote('dddddddd', { from: { role: 'family', label: 'partner' } });
    expect(notesList(data({ notes: [partner] }), ctx({ learnerType: 'child' })).new[0]?.sender).toBe('Your family');
    expect(notesList(data({ notes: [partner] }), ctx({ learnerType: undefined })).new[0]?.sender).toBe('Your family');
    expect(notesList(data({ notes: [partner] }), ctx({ learnerType: 'self' })).new[0]?.sender).toBe('Your partner');
    const unlabelled = familyNote('eeeeeeee', { from: { role: 'family', label: null } });
    expect(notesList(data({ notes: [unlabelled] }), ctx()).new[0]?.sender).toBe('Your family');
  });

  it('renders the fallback line for an unknown preset and ignores an unknown reaction', () => {
    const odd = note('ffffffff', { presetId: 'warm_from_the_future', readAt: 't', reaction: 'wave' });
    expect(notesList(data({ notes: [odd] }), ctx()).earlier[0]).toMatchObject({ preset: 'A note for you.', reaction: null, reactionText: null });
  });

  it('a "try this quest" note whose quest is unreadable or unknown here renders the fallback line, with its text', () => {
    const unreadable = note('gggggggg', { presetId: 'next_try_this', suggest: null, text: 'Have a look' });
    const unknown = note('hhhhhhhh', { presetId: 'next_try_this', suggest: { kind: 'quest', id: 'quest:stage9-new' } });
    const known = note('iiiiiiii', { presetId: 'next_try_this', suggest: { kind: 'quest', id: 'quest:stage1-letters-q1' } });
    const rows = notesList(data({ notes: [unreadable, unknown, known] }), ctx()).new;
    expect(rows.map((r) => r.preset)).toEqual(['A note for you.', 'A note for you.', 'Try this quest next. I think you will like it.']);
    expect(rows[0]?.text).toBe('Have a look');
  });

  it('marks the language of the free text (Hangul reads "ko", else the sender console locale)', () => {
    const ko = note('jjjjjjjj', { text: 'ㄱ and ㄴ were great', textLocale: 'en' });
    const es = note('kkkkkkkk', { text: 'Muy bien', textLocale: 'es' });
    const rows = notesList(data({ notes: [ko, es] }), ctx()).new;
    expect(rows.map((r) => r.textLang)).toEqual(['ko', 'es']);
  });

  it('renders presets in the viewer locale, falling back to English until a native review (OD-15)', () => {
    const rows = notesList(data({ notes: [unreadTeacher] }), ctx({ m: getMessages('ko'), locale: 'ko' })).new;
    expect(rows[0]?.preset).toBe(getMessages('ko').common.notes.presets.effort_keep_trying);
  });
});

describe('homeNotesCard (wireframe home/notes-card.md)', () => {
  it('is absent with no unread visible note', () => {
    expect(homeNotesCard(data(), ctx())).toBeNull();
    expect(homeNotesCard(data({ notes: [readOld] }), ctx())).toBeNull();
    expect(homeNotesCard(data({ notes: [unreadTeacher], putAway: ['note:aaaaaaaa'] }), ctx())).toBeNull();
  });

  it('one new note: the sender, the preset line and Read to that note; never the free text', () => {
    const card = homeNotesCard(data({ notes: [unreadTeacher, readOld] }), ctx());
    expect(card).toEqual({
      kind: 'one',
      noteId: 'note:aaaaaaaa',
      title: 'A note from Your teacher · Sunday Class A',
      preset: 'You keep trying. That is how we learn.',
      a11y: 'New note from Your teacher · Sunday Class A: You keep trying. That is how we learn. Read.',
    });
    expect(JSON.stringify(card)).not.toContain('Loved your work');
  });

  it('several new notes: the count and the newest sender, Read to the list', () => {
    const card = homeNotesCard(data({ notes: [unreadFamily, unreadTeacher, readOld] }), ctx());
    expect(card).toEqual({
      kind: 'many',
      count: 2,
      title: '2 new notes',
      from: 'From Your teacher · Sunday Class A',
      a11y: '2 new notes. Newest from Your teacher · Sunday Class A. Read.',
    });
  });
});

describe('noteDetail (wireframe notes/detail.md)', () => {
  const deps = { isQuestOpen: vi.fn((id: string) => id === 'quest:stage1-letters-q1'), selfManaged: false };

  it('is null for a note that is not on this device, put away or reported', () => {
    expect(noteDetail(data(), 'note:aaaaaaaa', ctx(), deps)).toBeNull();
    expect(noteDetail(data({ notes: [unreadTeacher], putAway: ['note:aaaaaaaa'] }), 'note:aaaaaaaa', ctx(), deps)).toBeNull();
  });

  it('an open suggested quest shows Start; a closed one shows the quest without Start (isQuestOpen injected)', () => {
    const open = note('aaaaaaaa', { presetId: 'next_try_this', suggest: { kind: 'quest', id: 'quest:stage1-letters-q1' } });
    expect(noteDetail(data({ notes: [open] }), open.id, ctx(), deps)?.suggest).toEqual({ questId: 'quest:stage1-letters-q1', open: true });
    const closed = note('bbbbbbbb', { suggest: { kind: 'quest', id: 'quest:stage1-letters-q1' } });
    const view = noteDetail(data({ notes: [closed] }), closed.id, ctx(), { ...deps, isQuestOpen: () => false });
    expect(view?.suggest).toEqual({ questId: 'quest:stage1-letters-q1', open: false });
  });

  it('a quest this build does not have draws no quest card', () => {
    const unknown = note('aaaaaaaa', { suggest: { kind: 'quest', id: 'quest:stage9-new' } });
    expect(noteDetail(data({ notes: [unknown] }), unknown.id, ctx(), deps)?.suggest).toBeNull();
    expect(noteDetail(data({ notes: [unreadTeacher] }), unreadTeacher.id, ctx(), deps)?.suggest).toBeNull();
  });

  it('carries the seen-by line by role and notes mode', () => {
    const d = (prefs: { classes: 'all' | 'presets' | 'off' | null; acknowledged: boolean } | null) => data({ notes: [unreadTeacher, unreadFamily], prefs });
    expect(noteDetail(d({ classes: 'all', acknowledged: true }), unreadTeacher.id, ctx(), deps)?.seenBy).toBe('Your teacher will see your answer.');
    expect(noteDetail(d({ classes: 'presets', acknowledged: true }), unreadTeacher.id, ctx(), deps)?.seenBy).toBe('Your family will see your answer.');
    expect(noteDetail(d({ classes: 'all', acknowledged: true }), unreadFamily.id, ctx(), deps)?.seenBy).toBe('Your family will see your answer.');
  });

  it('says "Tell a grown-up", or "Report this note" on a self-managed profile', () => {
    const d = data({ notes: [unreadTeacher] });
    expect(noteDetail(d, unreadTeacher.id, ctx(), deps)?.reportLink).toBe('Tell a grown-up');
    expect(noteDetail(d, unreadTeacher.id, ctx(), { ...deps, selfManaged: true })?.reportLink).toBe('Report this note');
  });

  it('carries the from line, the reaction already picked and the sender role', () => {
    const view = noteDetail(data({ notes: [readOld] }), readOld.id, ctx(), deps);
    expect(view).toMatchObject({ from: 'From Your teacher · Sunday Class A', reaction: 'thanks', fromRole: 'teacher', preset: 'Your reading is getting stronger.' });
  });
});

describe('reactionSeenBy (section 6.6)', () => {
  it('a class note in "all" (or an unknown mode) tells the teacher; "presets" and family notes tell the family', () => {
    expect(reactionSeenBy(unreadTeacher, { classes: 'all', acknowledged: true })).toBe('teacher');
    expect(reactionSeenBy(unreadTeacher, { classes: null, acknowledged: true })).toBe('teacher');
    expect(reactionSeenBy(unreadTeacher, null)).toBe('teacher');
    expect(reactionSeenBy(unreadTeacher, { classes: 'presets', acknowledged: true })).toBe('family');
    expect(reactionSeenBy(unreadTeacher, { classes: 'off', acknowledged: true })).toBe('family');
    expect(reactionSeenBy(unreadFamily, { classes: 'all', acknowledged: true })).toBe('family');
  });
});

describe('showMyNotesRow (section 6.5 item 2)', () => {
  it('only with the flag on and a class or family membership or a cached note', () => {
    expect(showMyNotesRow({ enabled: false, memberships: [classRow], data: data({ notes: [unreadTeacher] }) })).toBe(false);
    expect(showMyNotesRow({ enabled: true, memberships: [], data: data() })).toBe(false);
    expect(showMyNotesRow({ enabled: true, memberships: [], data: null })).toBe(false);
    expect(showMyNotesRow({ enabled: true, memberships: [classRow], data: null })).toBe(true);
    expect(showMyNotesRow({ enabled: true, memberships: [familyRow], data: data() })).toBe(true);
    expect(showMyNotesRow({ enabled: true, memberships: [], data: data({ notes: [readOld] }) })).toBe(true);
  });
});
