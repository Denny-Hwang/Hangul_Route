import { describe, expect, it } from 'vitest';
import { notesKey, readStoredNotes } from '../stored';
import { emptyNotes } from '../types';
import { note } from './fixtures';

/** F-FEEDBACK-001 section 6.9: the per-profile record read back from storage, leniently. */
describe('readStoredNotes', () => {
  it('names the key per profile', () => {
    expect(notesKey('profile:a')).toBe('notes:profile:a');
  });

  it('reads a missing or unreadable record as empty', () => {
    expect(readStoredNotes(null)).toEqual(emptyNotes());
    expect(readStoredNotes('text')).toEqual(emptyNotes());
    expect(readStoredNotes([])).toEqual(emptyNotes());
    expect(readStoredNotes({ notes: 'x', putAway: 3, queue: {}, prefs: 7, classNotesCardSeen: 'yes' })).toEqual(emptyNotes());
  });

  it('round-trips a record and keeps every readable part', () => {
    const record = {
      notes: [note('aaaaaaaa', { readAt: 't', reaction: 'thanks' })],
      prefs: { classes: 'presets', acknowledged: true },
      putAway: ['note:aaaaaaaa'],
      classNotesCardSeen: true,
      queue: [
        { kind: 'state', noteId: 'note:aaaaaaaa', read: true, reaction: 'thanks', at: 't1' },
        { kind: 'report', noteId: 'note:aaaaaaaa', reason: 'unsafe', attest: 'grown_up_pin', at: 't2' },
      ],
    };
    expect(readStoredNotes(JSON.parse(JSON.stringify(record)))).toEqual(record);
  });

  it('drops one bad note or write and keeps the rest', () => {
    const out = readStoredNotes({
      notes: [note('aaaaaaaa'), { id: 'bad' }],
      putAway: ['note:aaaaaaaa', 4],
      queue: [
        { kind: 'state', noteId: 'note:aaaaaaaa', reaction: 'wave', at: 't1' },
        { kind: 'state', noteId: 'note:aaaaaaaa', at: 't1' },
        { kind: 'report', noteId: 'note:aaaaaaaa', reason: 'mean', at: 't2' },
        { kind: 'report', noteId: 'note:bbbbbbbb', reason: 'other', attest: 'someone', at: 't3' },
        { kind: 'hide', noteId: 'note:aaaaaaaa', at: 't4' },
        { kind: 'state', noteId: 'note:cccccccc', read: true, at: 't5' },
        { kind: 'state', noteId: 'note:dddddddd', reaction: 'happy', at: 't6' },
        null,
      ],
    });
    expect(out.notes.map((n) => n.id)).toEqual(['note:aaaaaaaa']);
    expect(out.putAway).toEqual(['note:aaaaaaaa']);
    expect(out.queue).toEqual([
      { kind: 'report', noteId: 'note:bbbbbbbb', reason: 'other', at: 't3' },
      { kind: 'state', noteId: 'note:cccccccc', read: true, at: 't5' },
      { kind: 'state', noteId: 'note:dddddddd', reaction: 'happy', at: 't6' },
    ]);
  });

  it('reads stored prefs through the inbox rules (an unknown mode is null, never a looser one)', () => {
    expect(readStoredNotes({ prefs: { classes: 'friends', acknowledged: false } }).prefs).toEqual({ classes: null, acknowledged: false });
    expect(readStoredNotes({ prefs: null }).prefs).toBeNull();
  });
});
