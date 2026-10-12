import { NOTE_PREFS_DEFAULT, NOTE_PREFS_UNREADABLE } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { applyInbox, isGone } from '../apply';
import { emptyNotes } from '../types';
import { data, familyNote, note } from './fixtures';

/** F-FEEDBACK-001 section 6.9: apply inbox (pure). */
describe('applyInbox', () => {
  const prefs = { classes: 'all' as const, acknowledged: false };

  it('takes the inbox as the list of notes that exist, newest first', () => {
    const older = note('aaaaaaaa', { createdAt: '2026-10-01T00:00:00.000Z' });
    const newer = familyNote('bbbbbbbb', { createdAt: '2026-10-05T00:00:00.000Z' });
    const { data: out, added, removed } = applyInbox(emptyNotes(), { notes: [older, newer], notePrefs: prefs });
    expect(out.notes.map((n) => n.id)).toEqual(['note:bbbbbbbb', 'note:aaaaaaaa']);
    expect(added).toEqual(['note:aaaaaaaa', 'note:bbbbbbbb']);
    expect(removed).toEqual([]);
    expect(out.prefs).toEqual(prefs);
  });

  it('removes a note the inbox no longer lists (hidden, reported, withdrawn, expired, blocked, left the space) and says which', () => {
    const local = data({ notes: [note('aaaaaaaa'), note('bbbbbbbb')] });
    const { data: out, removed } = applyInbox(local, { notes: [note('bbbbbbbb')], notePrefs: prefs });
    expect(out.notes.map((n) => n.id)).toEqual(['note:bbbbbbbb']);
    expect(removed).toEqual(['note:aaaaaaaa']);
    // The note page open on it closes gently (withdrawn-while-open signal).
    expect(isGone(out, 'note:aaaaaaaa')).toBe(true);
    expect(isGone(out, 'note:bbbbbbbb')).toBe(false);
  });

  it('takes the server read state and reaction when nothing is pending', () => {
    const local = data({ notes: [note('aaaaaaaa', { readAt: null, reaction: 'thanks' })] });
    const server = note('aaaaaaaa', { readAt: '2026-10-10T10:00:00.000Z', reaction: 'did_it' });
    const { data: out } = applyInbox(local, { notes: [server], notePrefs: prefs });
    expect(out.notes[0]).toMatchObject({ readAt: '2026-10-10T10:00:00.000Z', reaction: 'did_it' });
  });

  it('keeps local writes the server has not acknowledged yet (pending read and reaction)', () => {
    const local = data({
      notes: [note('aaaaaaaa', { readAt: '2026-10-10T11:00:00.000Z', reaction: 'happy' })],
      queue: [{ kind: 'state', noteId: 'note:aaaaaaaa', read: true, reaction: 'happy', at: '2026-10-10T11:00:00.000Z' }],
    });
    const { data: out } = applyInbox(local, { notes: [note('aaaaaaaa', { readAt: null, reaction: 'thanks' })], notePrefs: prefs });
    expect(out.notes[0]).toMatchObject({ readAt: '2026-10-10T11:00:00.000Z', reaction: 'happy' });
    expect(out.queue).toHaveLength(1);
  });

  it('a read pending on a note the server already marked read keeps the first read time (set once)', () => {
    const local = data({
      notes: [note('aaaaaaaa', { readAt: '2026-10-10T11:00:00.000Z' })],
      queue: [{ kind: 'state', noteId: 'note:aaaaaaaa', read: true, at: '2026-10-10T11:00:00.000Z' }],
    });
    const { data: out } = applyInbox(local, { notes: [note('aaaaaaaa', { readAt: '2026-10-10T08:00:00.000Z' })], notePrefs: prefs });
    expect(out.notes[0]?.readAt).toBe('2026-10-10T08:00:00.000Z');
  });

  it('a pending read for a note this device never cached uses the time of the write', () => {
    const local = data({ queue: [{ kind: 'state', noteId: 'note:aaaaaaaa', read: true, at: '2026-10-10T12:00:00.000Z' }] });
    const { data: out } = applyInbox(local, { notes: [note('aaaaaaaa')], notePrefs: prefs });
    expect(out.notes[0]?.readAt).toBe('2026-10-10T12:00:00.000Z');
  });

  it('drops pending state writes of notes that are gone, and keeps pending reports for the next flush', () => {
    const local = data({
      notes: [note('aaaaaaaa'), note('bbbbbbbb')],
      queue: [
        { kind: 'state', noteId: 'note:aaaaaaaa', read: true, at: 't1' },
        { kind: 'report', noteId: 'note:aaaaaaaa', reason: 'unkind', at: 't2' },
        { kind: 'state', noteId: 'note:bbbbbbbb', reaction: 'thanks', at: 't3' },
      ],
    });
    const { data: out } = applyInbox(local, { notes: [note('bbbbbbbb')], notePrefs: prefs });
    expect(out.queue).toEqual([
      { kind: 'report', noteId: 'note:aaaaaaaa', reason: 'unkind', at: 't2' },
      { kind: 'state', noteId: 'note:bbbbbbbb', reaction: 'thanks', at: 't3' },
    ]);
  });

  it('prunes put-away ids that are no longer in the inbox', () => {
    const local = data({ notes: [note('aaaaaaaa'), note('bbbbbbbb')], putAway: ['note:aaaaaaaa', 'note:bbbbbbbb'] });
    const { data: out } = applyInbox(local, { notes: [note('bbbbbbbb')], notePrefs: prefs });
    expect(out.putAway).toEqual(['note:bbbbbbbb']);
  });

  it('keeps one row per note id when an inbox repeats one', () => {
    const { data: out } = applyInbox(emptyNotes(), { notes: [note('aaaaaaaa'), note('aaaaaaaa', { text: 'later copy' })], notePrefs: prefs });
    expect(out.notes).toHaveLength(1);
    expect(out.notes[0]?.text).toBeNull();
  });

  it('mirrors the class-notes acknowledgement and never forgets a local answer', () => {
    expect(applyInbox(emptyNotes(), { notes: [], notePrefs: { classes: 'all', acknowledged: true } }).data.classNotesCardSeen).toBe(true);
    expect(applyInbox(emptyNotes(), { notes: [], notePrefs: { classes: 'all', acknowledged: false } }).data.classNotesCardSeen).toBe(false);
    expect(applyInbox(data({ classNotesCardSeen: true }), { notes: [], notePrefs: { classes: 'all', acknowledged: false } }).data.classNotesCardSeen).toBe(true);
  });

  it('stores its own copy of the prefs, never a shared fallback object', () => {
    const { data: out } = applyInbox(emptyNotes(), { notes: [], notePrefs: NOTE_PREFS_UNREADABLE });
    expect(out.prefs).toEqual({ classes: null, acknowledged: true });
    expect(out.prefs).not.toBe(NOTE_PREFS_UNREADABLE);
    expect(applyInbox(emptyNotes(), { notes: [], notePrefs: NOTE_PREFS_DEFAULT }).data.prefs).not.toBe(NOTE_PREFS_DEFAULT);
  });

  it('does not change the local data it was given', () => {
    const local = data({ notes: [note('aaaaaaaa')], putAway: ['note:aaaaaaaa'] });
    const before = JSON.stringify(local);
    applyInbox(local, { notes: [], notePrefs: prefs });
    expect(JSON.stringify(local)).toBe(before);
  });
});
