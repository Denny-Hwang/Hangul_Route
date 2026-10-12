import { describe, expect, it } from 'vitest';
import {
  FAMILY_LABEL_IDS,
  InboxNoteSchema,
  NOTES_MODES,
  NOTE_PRESETS_NEED_SUGGEST,
  NOTE_PRESET_AUDIENCE,
  NOTE_PRESET_IDS,
  NOTE_REACTION_IDS,
  NOTE_REPORT_REASONS,
  NOTE_SEND_MAX_LEARNERS,
  NoteIdSchema,
  NotePrefsPutSchema,
  NotePrefsSchema,
  NoteReportSchema,
  NoteSendSchema,
  NoteStatePutSchema,
  NoteSuggestSchema,
} from '../index';

// F-FEEDBACK-001 section 7.1: the shared shapes of notes from grown-ups.

describe('note catalogues (section 6.3, 6.6, 6.11)', () => {
  it('lists the fifteen preset ids in the order of section 6.3', () => {
    expect([...NOTE_PRESET_IDS]).toEqual([
      'effort_keep_trying',
      'effort_proud',
      'effort_practice_helps',
      'progress_new_letters',
      'progress_reading',
      'progress_writing',
      'progress_listening',
      'progress_new_card',
      'next_try_this',
      'next_look_again',
      'next_take_time',
      'warm_thinking_of_you',
      'warm_cheering',
      'warm_see_you_in_class',
      'warm_learning_together',
    ]);
    expect(new Set(NOTE_PRESET_IDS).size).toBe(15);
  });

  it('gives every preset an audience: one teacher-only, one family-only, the rest for all', () => {
    expect(Object.keys(NOTE_PRESET_AUDIENCE).sort()).toEqual([...NOTE_PRESET_IDS].sort());
    expect(NOTE_PRESET_AUDIENCE.warm_see_you_in_class).toBe('teacher');
    expect(NOTE_PRESET_AUDIENCE.warm_learning_together).toBe('family');
    const others = NOTE_PRESET_IDS.filter((id) => id !== 'warm_see_you_in_class' && id !== 'warm_learning_together');
    for (const id of others) expect(NOTE_PRESET_AUDIENCE[id], id).toBe('all');
  });

  it('needs a suggested quest only for next_try_this', () => {
    expect([...NOTE_PRESETS_NEED_SUGGEST]).toEqual(['next_try_this']);
    expect(NOTE_PRESETS_NEED_SUGGEST.has('next_try_this')).toBe(true);
    expect(NOTE_PRESETS_NEED_SUGGEST.has('next_look_again')).toBe(false);
  });

  it('lists the reactions, family labels, report reasons and notes modes of the spec', () => {
    expect([...NOTE_REACTION_IDS]).toEqual(['thanks', 'will_try', 'did_it', 'happy']);
    expect([...FAMILY_LABEL_IDS]).toEqual(['family', 'mom', 'dad', 'grandma', 'grandpa', 'aunt', 'uncle', 'guardian', 'partner']);
    expect([...NOTE_REPORT_REASONS]).toEqual(['unkind', 'unsafe', 'not_for_me', 'other']);
    expect([...NOTES_MODES]).toEqual(['all', 'presets', 'off']);
  });

  it('never offers a "friend" label (review log: a grooming pattern)', () => {
    expect((FAMILY_LABEL_IDS as readonly string[]).includes('friend')).toBe(false);
  });

  it('caps one send at 300 learners', () => {
    expect(NOTE_SEND_MAX_LEARNERS).toBe(300);
  });
});

describe('NoteIdSchema and NoteSuggestSchema', () => {
  it('accepts note:<8-64 lower-case letters, digits or dashes>', () => {
    expect(NoteIdSchema.safeParse('note:0b7c2f9e-1d2a-4f00-9a7e-3c1f0e2d4b5a').success).toBe(true);
    expect(NoteIdSchema.safeParse('note:abcdefgh').success).toBe(true);
    expect(NoteIdSchema.safeParse(`note:${'a'.repeat(64)}`).success).toBe(true);
  });

  it.each([['note:abc'], [`note:${'a'.repeat(65)}`], ['note:ABCDEFGH'], ['plan:abcdefgh'], ['note:abcd_efgh'], ['']])('refuses %j', (id) => {
    expect(NoteIdSchema.safeParse(id).success).toBe(false);
  });

  it('takes a quest suggestion only, strictly', () => {
    expect(NoteSuggestSchema.parse({ kind: 'quest', id: 'quest:stage1-letters-q1' })).toEqual({ kind: 'quest', id: 'quest:stage1-letters-q1' });
    expect(NoteSuggestSchema.safeParse({ kind: 'story', id: 'x' }).success).toBe(false);
    expect(NoteSuggestSchema.safeParse({ kind: 'quest', id: '' }).success).toBe(false);
    expect(NoteSuggestSchema.safeParse({ kind: 'quest', id: 'q'.repeat(65) }).success).toBe(false);
    expect(NoteSuggestSchema.safeParse({ kind: 'quest', id: 'q', title: 'x' }).success).toBe(false);
  });
});

describe('NoteSendSchema (POST /api/spaces/:id/notes)', () => {
  const minimal = { to: { kind: 'everyone' }, presetId: 'effort_proud' };

  it('accepts a preset-only note to everyone', () => {
    expect(NoteSendSchema.parse(minimal)).toEqual(minimal);
  });

  it('accepts a full note to chosen learners', () => {
    const full = {
      to: { kind: 'learners', ids: ['profile:suni', 'profile:min-jun'] },
      presetId: 'next_try_this',
      text: 'Loved your work on ㄱ and ㄴ today',
      textLocale: 'en',
      suggest: { kind: 'quest', id: 'quest:stage1-letters-q1' },
      label: 'grandma',
    };
    expect(NoteSendSchema.parse(full)).toEqual(full);
  });

  it('is strict: an unknown key fails at the top and inside `to`', () => {
    expect(NoteSendSchema.safeParse({ ...minimal, sender: 'Ms Kim' }).success).toBe(false);
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'everyone', ids: ['profile:a'] } }).success).toBe(false);
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'learners', ids: ['profile:a'], all: true } }).success).toBe(false);
  });

  it('takes a label only from the family list, partner included', () => {
    for (const label of FAMILY_LABEL_IDS) expect(NoteSendSchema.safeParse({ ...minimal, label }).success, label).toBe(true);
    expect(NoteSendSchema.safeParse({ ...minimal, label: 'partner' }).success).toBe(true);
    expect(NoteSendSchema.safeParse({ ...minimal, label: 'friend' }).success).toBe(false);
    expect(NoteSendSchema.safeParse({ ...minimal, label: 'Grandma Kim' }).success).toBe(false);
  });

  it('takes 1 to 300 learner ids, each an opaque profile id', () => {
    const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `profile:p${i}`);
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'learners', ids: ids(300) } }).success).toBe(true);
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'learners', ids: ids(301) } }).success).toBe(false);
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'learners', ids: [] } }).success).toBe(false);
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'learners', ids: ['Suni'] } }).success).toBe(false);
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'class' } }).success).toBe(false);
  });

  it('refuses a repeated learner id, so one send cannot deliver the same note twice to one learner', () => {
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'learners', ids: ['profile:a', 'profile:b'] } }).success).toBe(true);
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'learners', ids: ['profile:a', 'profile:a'] } }).success).toBe(false);
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'learners', ids: Array.from({ length: 300 }, () => 'profile:x') } }).success).toBe(false);
  });

  it('caps a learner id at 80 characters', () => {
    const id = (n: number): string => `profile:${'a'.repeat(n - 'profile:'.length)}`;
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'learners', ids: [id(80)] } }).success).toBe(true);
    expect(NoteSendSchema.safeParse({ ...minimal, to: { kind: 'learners', ids: [id(81)] } }).success).toBe(false);
  });

  it('takes a known preset id only', () => {
    expect(NoteSendSchema.safeParse({ ...minimal, presetId: 'effort_great' }).success).toBe(false);
    expect(NoteSendSchema.safeParse({ to: minimal.to }).success).toBe(false);
  });

  it('bounds the raw text at 400 characters (checkNoteText judges length and content)', () => {
    expect(NoteSendSchema.safeParse({ ...minimal, text: 'a'.repeat(400), textLocale: 'en' }).success).toBe(true);
    expect(NoteSendSchema.safeParse({ ...minimal, text: 'a'.repeat(401), textLocale: 'en' }).success).toBe(false);
  });

  it('needs textLocale when text is present, and takes UI locales only', () => {
    const missing = NoteSendSchema.safeParse({ ...minimal, text: 'Well done' });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['textLocale']);
    expect(NoteSendSchema.safeParse({ ...minimal, text: 'Well done', textLocale: 'ko' }).success).toBe(true);
    expect(NoteSendSchema.safeParse({ ...minimal, text: 'Well done', textLocale: 'fr' }).success).toBe(false);
    expect(NoteSendSchema.safeParse({ ...minimal, textLocale: 'es' }).success).toBe(true);
  });

  it('leaves the next_try_this suggest rule to the Worker (422 bad_preset)', () => {
    expect(NoteSendSchema.safeParse({ ...minimal, presetId: 'next_try_this' }).success).toBe(true);
  });
});

describe('InboxNoteSchema (one delivered note, lenient on the device)', () => {
  const row = {
    id: 'note:0b7c2f9e-1d2a',
    spaceId: 'space:class-a',
    from: { role: 'teacher', label: null },
    presetId: 'progress_reading',
    text: 'Loved your work today',
    textLocale: 'en',
    suggest: { kind: 'quest', id: 'quest:stage1-letters-q1' },
    createdAt: '2026-10-11T09:00:00.000Z',
    readAt: null,
    reaction: null,
  };

  it('parses a delivered note', () => {
    expect(InboxNoteSchema.parse(row)).toEqual(row);
    const family = { ...row, from: { role: 'family', label: 'grandma' }, text: null, textLocale: null, suggest: null, readAt: 't', reaction: 'thanks' };
    expect(InboxNoteSchema.parse(family)).toEqual(family);
  });

  it('accepts an unknown preset id and an unknown reaction (a newer Worker never breaks an older app)', () => {
    const parsed = InboxNoteSchema.parse({ ...row, presetId: 'effort_brand_new', reaction: 'wow' });
    expect(parsed.presetId).toBe('effort_brand_new');
    expect(parsed.reaction).toBe('wow');
  });

  it('keeps the note when its label, text locale or suggestion is from a newer Worker', () => {
    const parsed = InboxNoteSchema.parse({
      ...row,
      from: { role: 'family', label: 'cousin' },
      textLocale: 'ja',
      suggest: { kind: 'story', id: 'story:x' },
    });
    expect(parsed.from).toEqual({ role: 'family', label: null });
    expect(parsed.textLocale).toBeNull();
    expect(parsed.suggest).toBeNull();
    expect(parsed.text).toBe(row.text);
  });

  it('refuses a row without a valid id, an unknown sender role or an oversized text', () => {
    expect(InboxNoteSchema.safeParse({ ...row, id: 'x' }).success).toBe(false);
    expect(InboxNoteSchema.safeParse({ ...row, from: { role: 'school', label: null } }).success).toBe(false);
    expect(InboxNoteSchema.safeParse({ ...row, text: 'a'.repeat(401) }).success).toBe(false);
    expect(InboxNoteSchema.safeParse({ ...row, presetId: 'p'.repeat(65) }).success).toBe(false);
    expect(InboxNoteSchema.safeParse({ ...row, reaction: 'r'.repeat(33) }).success).toBe(false);
  });
});

describe('note prefs, state, report bodies', () => {
  it('defaults the prefs to all notes, not yet acknowledged', () => {
    expect(NotePrefsSchema.parse({})).toEqual({ classes: 'all', acknowledged: false });
    expect(NotePrefsSchema.parse({ classes: 'presets', acknowledged: true })).toEqual({ classes: 'presets', acknowledged: true });
  });

  it('reads a mode this app does not know as null (unknown), never as a looser mode, and keeps the acknowledgement', () => {
    expect(NotePrefsSchema.parse({ classes: 'quiet', acknowledged: true })).toEqual({ classes: null, acknowledged: true });
    expect(NotePrefsSchema.parse({ classes: 42, acknowledged: false })).toEqual({ classes: null, acknowledged: false });
    expect(NotePrefsSchema.parse({ classes: null, acknowledged: false })).toEqual({ classes: null, acknowledged: false });
  });

  it('reads an unreadable acknowledgement as given, so the one-time card never comes back (section 6.10 item 5)', () => {
    expect(NotePrefsSchema.parse({ classes: 'off', acknowledged: 'yes' })).toEqual({ classes: 'off', acknowledged: true });
    expect(NotePrefsSchema.parse({ classes: 'all', acknowledged: null })).toEqual({ classes: 'all', acknowledged: true });
  });

  it('writes the prefs strictly; acknowledge may only be true', () => {
    expect(NotePrefsPutSchema.parse({ classes: 'off' })).toEqual({ classes: 'off' });
    expect(NotePrefsPutSchema.parse({ classes: 'all', acknowledge: true })).toEqual({ classes: 'all', acknowledge: true });
    expect(NotePrefsPutSchema.safeParse({ classes: 'all', acknowledge: false }).success).toBe(false);
    expect(NotePrefsPutSchema.safeParse({ classes: 'some' }).success).toBe(false);
    expect(NotePrefsPutSchema.safeParse({}).success).toBe(false);
    expect(NotePrefsPutSchema.safeParse({ classes: 'all', acknowledged: true }).success).toBe(false);
  });

  it('refuses an empty state body and takes read and a known reaction', () => {
    expect(NoteStatePutSchema.safeParse({}).success).toBe(false);
    expect(NoteStatePutSchema.parse({ read: true })).toEqual({ read: true });
    expect(NoteStatePutSchema.parse({ reaction: 'did_it' })).toEqual({ reaction: 'did_it' });
    expect(NoteStatePutSchema.parse({ read: true, reaction: 'happy' })).toEqual({ read: true, reaction: 'happy' });
    expect(NoteStatePutSchema.safeParse({ read: false }).success).toBe(false);
    expect(NoteStatePutSchema.safeParse({ reaction: 'wow' }).success).toBe(false);
    expect(NoteStatePutSchema.safeParse({ read: true, text: 'thanks!' }).success).toBe(false);
  });

  it('takes a report reason and, from a device, an attestation', () => {
    for (const reason of NOTE_REPORT_REASONS) expect(NoteReportSchema.safeParse({ reason }).success, reason).toBe(true);
    expect(NoteReportSchema.parse({ reason: 'unsafe', attest: 'grown_up_pin' })).toEqual({ reason: 'unsafe', attest: 'grown_up_pin' });
    expect(NoteReportSchema.safeParse({ reason: 'unsafe', attest: 'self' }).success).toBe(true);
    expect(NoteReportSchema.safeParse({ reason: 'rude' }).success).toBe(false);
    expect(NoteReportSchema.safeParse({ reason: 'other', details: 'he was mean' }).success).toBe(false);
    expect(NoteReportSchema.safeParse({ reason: 'other', attest: 'teacher' }).success).toBe(false);
  });
});
