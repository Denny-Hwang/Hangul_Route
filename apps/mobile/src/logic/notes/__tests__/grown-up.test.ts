import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  attestFor,
  endsGateOnLeave,
  grownUpNotes,
  grownUpRow,
  hideOutcome,
  noteReportDoneTarget,
  oneTimeCard,
  prefsChangedEvent,
  prefsOutcome,
  reportOutcome,
  reportSentEvent,
  showModeSetting,
} from '../grown-up';
import type { NotesViewContext } from '../view';
import { classRow, data, familyNote, familyRow, note } from './fixtures';

const m = getMessages('en');
const at = (day: number, hour: number): string => new Date(2026, 9, day, hour).toISOString();
const ctx: NotesViewContext = { m, locale: 'en', memberships: [classRow, familyRow], learnerType: 'child', now: new Date(2026, 9, 12, 15), questKnown: () => true };

describe('grownUpRow: the dashboard row "Notes for <learner>" (section 6.10 item 1)', () => {
  it('shows only for a profile with notes or memberships', () => {
    expect(grownUpRow({ data: null, memberships: [] })).toBeNull();
    expect(grownUpRow({ data: data(), memberships: [] })).toBeNull();
    expect(grownUpRow({ data: null, memberships: [classRow] })).toEqual({ isNew: false });
  });

  it('is New while a note arrived after the grown-up last opened this learner\'s notes', () => {
    const d = data({ notes: [note('aaaaaaaa', { createdAt: at(12, 9) })] });
    expect(grownUpRow({ data: d, memberships: [] })).toEqual({ isNew: true });
    expect(grownUpRow({ data: { ...d, grownUpSeenIds: ['note:aaaaaaaa'] }, memberships: [] })).toEqual({ isNew: false });
    expect(grownUpRow({ data: { ...d, grownUpSeenIds: [] }, memberships: [] })).toEqual({ isNew: true });
  });

  it('counts arrival on this device, not the time a note was written (a late or offline delivery is New)', () => {
    // Written before the grown-up looked, delivered after: it was not on the device then, so it is New.
    const late = note('bbbbbbbb', { createdAt: at(11, 9) });
    const d = data({ notes: [note('aaaaaaaa', { createdAt: at(12, 9) }), late], grownUpSeenIds: ['note:aaaaaaaa'] });
    expect(grownUpRow({ data: d, memberships: [] })).toEqual({ isNew: true });
  });
});

describe('grownUpNotes: Notes for <learner> (section 6.10 item 2)', () => {
  it('lists every delivered note newest first, put-away ones marked, a note with a report waiting left out', () => {
    const d = data({
      notes: [
        note('aaaaaaaa', { createdAt: at(12, 9), text: 'Loved it', readAt: at(12, 10), reaction: 'thanks' }),
        familyNote('bbbbbbbb', { createdAt: at(11, 9) }),
        note('cccccccc', { createdAt: at(10, 9) }),
      ],
      putAway: ['note:bbbbbbbb'],
      queue: [{ kind: 'report', noteId: 'note:cccccccc', reason: 'unkind', at: 't' }],
    });
    const rows = grownUpNotes(d, ctx);
    expect(rows.map((r) => r.id)).toEqual(['note:aaaaaaaa', 'note:bbbbbbbb']);
    expect(rows[0]).toMatchObject({
      line: 'Your teacher · Sunday Class A · Today',
      preset: 'You keep trying. That is how we learn.',
      text: 'Loved it',
      opened: true,
      reaction: 'thanks',
      reactionText: 'Thank you',
      putAway: false,
      fromRole: 'teacher',
    });
    expect(rows[1]).toMatchObject({ line: 'Grandma · Yesterday', opened: false, putAway: true, reaction: null });
  });
});

describe('the class-notes setting and the one-time card (section 6.10 items 2 and 5)', () => {
  const prefs = { classes: 'all' as const, acknowledged: false };

  it('the setting shows only for a learner in a class whose mode this app knows', () => {
    expect(showModeSetting({ memberships: [classRow], prefs })).toBe(true);
    expect(showModeSetting({ memberships: [familyRow], prefs })).toBe(false);
    expect(showModeSetting({ memberships: [classRow], prefs: { classes: null, acknowledged: true } })).toBe(false);
    expect(showModeSetting({ memberships: [classRow], prefs: null })).toBe(false);
  });

  it('the card shows once a class note arrived, while the family has not answered it', () => {
    const withClassNote = data({ notes: [note('aaaaaaaa')], prefs });
    expect(oneTimeCard({ memberships: [classRow], data: withClassNote })).toEqual({ mode: 'all' });
    expect(oneTimeCard({ memberships: [classRow], data: data({ notes: [familyNote('bbbbbbbb')], prefs }) })).toBeNull();
    expect(oneTimeCard({ memberships: [classRow], data: { ...withClassNote, classNotesCardSeen: true } })).toBeNull();
    expect(oneTimeCard({ memberships: [classRow], data: { ...withClassNote, prefs: { classes: 'all', acknowledged: true } } })).toBeNull();
    expect(oneTimeCard({ memberships: [classRow], data: { ...withClassNote, prefs: { classes: null, acknowledged: false } } })).toBeNull();
    expect(oneTimeCard({ memberships: [familyRow], data: withClassNote })).toBeNull();
    expect(oneTimeCard({ memberships: [classRow], data: null })).toBeNull();
  });
});

describe('answers of the device routes', () => {
  it('a report: sent, today\'s limit, gone, or waiting for the next sync', () => {
    expect(reportOutcome('done')).toBe('reported');
    expect(reportOutcome('limited')).toBe('tooMany');
    expect(reportOutcome('drop', 404)).toBe('alreadyGone');
    expect(reportOutcome('drop', 409)).toBe('alreadyGone');
    // Any other refusal recorded nothing: never "already gone".
    expect(reportOutcome('drop', 422)).toBe('refused');
    expect(reportOutcome('drop', 403)).toBe('refused');
    expect(reportOutcome('drop')).toBe('refused');
    expect(reportOutcome('retry')).toBe('queued');
    expect(reportOutcome(undefined)).toBe('queued');
  });

  it('a hide: hidden, gone, a class-scoped device, offline, or failed', () => {
    expect(hideOutcome({ status: 'ok', http: 200 })).toBe('hidden');
    expect(hideOutcome({ status: 'error', http: 404, code: 'not_found' })).toBe('alreadyGone');
    expect(hideOutcome({ status: 'error', http: 403, code: 'scope_limited' })).toBe('classScoped');
    expect(hideOutcome({ status: 'error', http: -1, code: 'network' })).toBe('offline');
    expect(hideOutcome({ status: 'error', http: 500, code: 'http_500' })).toBe('failed');
    expect(hideOutcome(null)).toBe('offline');
  });

  it('the setting: saved, a class-scoped device, offline, or failed', () => {
    expect(prefsOutcome({ status: 'ok', http: 200 })).toBe('saved');
    expect(prefsOutcome({ status: 'error', http: 403, code: 'scope_limited' })).toBe('classScoped');
    expect(prefsOutcome({ status: 'error', http: -1, code: 'network' })).toBe('offline');
    expect(prefsOutcome({ status: 'error', http: 422, code: 'invalid' })).toBe('failed');
    expect(prefsOutcome(null)).toBe('offline');
  });
});

describe('telemetry, attestation and where Done goes', () => {
  it('reports and setting changes carry codes only, never a profile id', () => {
    expect(reportSentEvent('unsafe', 'note_page')).toEqual({ name: 'notes.report_sent', payload: { reason: 'unsafe', via: 'note_page' } });
    expect(prefsChangedEvent('off')).toEqual({ name: 'notes.prefs_changed', payload: { classes: 'off' } });
  });

  it('the device claims the grown-up PIN, or a self-managed learner', () => {
    expect(attestFor(false)).toBe('grown_up_pin');
    expect(attestFor(true)).toBe('self');
  });

  it('Done returns to My notes from the note page, else back to Notes for <learner>', () => {
    expect(noteReportDoneTarget('note_page')).toBe('Notes');
    expect(noteReportDoneTarget('grown_up_zone')).toBe('back');
  });

  it('ends the grown-up session on leaving only on the learner path of a gated device', () => {
    expect(endsGateOnLeave('note_page', false)).toBe(true);
    expect(endsGateOnLeave('note_page', true)).toBe(false);
    expect(endsGateOnLeave('grown_up_zone', false)).toBe(false);
  });
});
