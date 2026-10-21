import { SPACE_NAME_MAX } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  NameOverrides,
  checkRename,
  renameCancel,
  renameCheckLine,
  renameEdit,
  renameFailureLine,
  renameFailureOf,
  renameHint,
  renameIdle,
  renameOpen,
  renameSettled,
  renameShown,
  renameSubmit,
} from '../rename';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 5.3 (row SA-3): the console's inline rename. The field checks the name with the
 * Worker's own `checkSpaceName`, and the save is optimistic: the new name shows at once and the old one comes back
 * when the save does not land.
 */
const r = getMessages('en').console.rename;

describe('checkRename: the Worker rule, client side', () => {
  it('normalizes before comparing, so extra spaces are the same name', () => {
    expect(checkRename('Sunday  Class A ', 'Sunday Class A')).toEqual({ state: 'unchanged', name: 'Sunday Class A' });
    expect(checkRename('\tSunday\nClass B', 'Sunday Class A')).toEqual({ state: 'ok', name: 'Sunday Class B' });
  });

  it('a decomposed Hangul name equals its composed form (NFC)', () => {
    const composed = '해바라기 반';
    expect(checkRename(composed.normalize('NFD'), composed)).toEqual({ state: 'unchanged', name: composed });
  });

  it('a stored name from before the rule (no letter) compares as it is', () => {
    expect(checkRename('Room 4', '***')).toEqual({ state: 'ok', name: 'Room 4' });
  });

  it('refuses empty, too long and letterless names, with the line for each', () => {
    expect(checkRename('   ', 'Kim family')).toEqual({ state: 'empty' });
    expect(checkRename('x'.repeat(SPACE_NAME_MAX + 1), 'Kim family')).toEqual({ state: 'too_long' });
    expect(checkRename('x'.repeat(SPACE_NAME_MAX), 'Kim family').state).toBe('ok');
    expect(checkRename('!!! ---', 'Kim family')).toEqual({ state: 'invalid' });
    expect(checkRename('Kim‮family', 'Kim family')).toEqual({ state: 'invalid' });
    expect(renameCheckLine({ state: 'empty' })).toBe(r.empty);
    expect(renameCheckLine({ state: 'too_long' })).toBe('Names can be up to 40 characters.');
    expect(renameCheckLine({ state: 'invalid' })).toBe(r.invalid);
    expect(renameCheckLine({ state: 'ok', name: 'x' })).toBeNull();
    expect(renameCheckLine({ state: 'unchanged', name: 'x' })).toBeNull();
    expect(renameCheckLine({ state: 'empty' }, 'ko')).toBe(getMessages('ko').console.rename.empty);
  });
});

describe('failure lines', () => {
  it('maps the answer to offline, archived, wait or failed', () => {
    expect(renameFailureOf({ ok: false, error: 'network', status: -1 })).toBe('offline');
    expect(renameFailureOf({ ok: false, error: 'unknown', status: 500 }, false)).toBe('offline');
    expect(renameFailureOf({ ok: false, error: 'invalid', status: 422, code: 'archived' })).toBe('archived');
    expect(renameFailureOf({ ok: false, error: 'invalid', status: 422, code: 'bad_name' })).toBe('failed');
    expect(renameFailureOf({ ok: false, error: 'unknown', status: 429, code: 'too_many_attempts' })).toBe('tooManyAttempts');
    expect(renameFailureOf({ ok: false, error: 'forbidden', status: 403 })).toBe('failed');
    const m = getMessages('en');
    expect(renameFailureLine('failed')).toBe(r.failed);
    expect(renameFailureLine('offline')).toBe(m.caregiver.retry.offline);
    expect(renameFailureLine('tooManyAttempts')).toBe(m.caregiver.retry.tooManyAttempts);
    expect(renameFailureLine('archived')).toBe(r.archived);
    expect(renameFailureLine('failed', 'es')).toBe(getMessages('es').console.rename.failed);
  });

  it('names who sees the name, per kind', () => {
    expect(renameHint('family')).toBe(r.hint.family);
    expect(renameHint('class')).toBe(r.hint.class);
    expect(renameHint('school', 'ko')).toBe(getMessages('ko').console.rename.hint.school);
  });

  it('shows Rename only with canRename on a live space', () => {
    expect(renameShown({ archivedAt: null }, true)).toBe(true);
    expect(renameShown({ archivedAt: null }, false)).toBe(false);
    expect(renameShown({ archivedAt: null }, undefined)).toBe(false);
    expect(renameShown({ archivedAt: '2026-10-01T00:00:00Z' }, true)).toBe(false);
  });
});

describe('the optimistic save and its rollback', () => {
  it('opens with the current name; Cancel closes with no change', () => {
    const open = renameOpen(renameIdle('Kim family'), 'Kim family');
    expect(open).toMatchObject({ open: true, draft: 'Kim family', stored: 'Kim family', failure: null });
    expect(renameCancel(renameEdit(open, 'Park family'))).toMatchObject({ open: false, draft: 'Kim family' });
  });

  it('Save sends the normalized name and closes the field at once', () => {
    const typed = renameEdit(renameOpen(renameIdle('Kim family'), 'Kim family'), '  Kim  and Park family ');
    const { state, send } = renameSubmit(typed);
    expect(send).toBe('Kim and Park family');
    expect(state).toMatchObject({ open: false, saving: true, pending: 'Kim and Park family', stored: 'Kim family' });
    // A second Enter while saving sends nothing.
    expect(renameSubmit(state).send).toBeNull();
  });

  it('reopened while a save is still under way, the field keeps the confirmed name to go back to', () => {
    const { state } = renameSubmit(renameEdit(renameOpen(renameIdle('Kim family'), 'Kim family'), 'Park family'));
    expect(renameOpen(state, 'Park family')).toMatchObject({ open: true, draft: 'Park family', stored: 'Kim family' });
    // A settle with no pending name (never sent) reopens with what is in the field.
    expect(renameSettled({ ...state, pending: null, draft: 'Typed' }, { ok: false, failure: 'failed' }).state.draft).toBe('Typed');
  });

  it('nothing to send while unchanged or invalid', () => {
    const open = renameOpen(renameIdle('Kim family'), 'Kim family');
    expect(renameSubmit(open).send).toBeNull();
    expect(renameSubmit(renameEdit(open, '')).send).toBeNull();
    expect(renameSubmit(renameEdit(open, '...')).send).toBeNull();
  });

  it('a saved name becomes the stored one; announce only when it changed', () => {
    const { state } = renameSubmit(renameEdit(renameOpen(renameIdle('Kim family'), 'Kim family'), 'Park family'));
    expect(renameSettled(state, { ok: true, name: 'Park family', changed: true })).toEqual({ state: renameIdle('Park family'), name: 'Park family', announce: true });
    expect(renameSettled(state, { ok: true, name: 'Kim family', changed: false })).toMatchObject({ name: 'Kim family', announce: false });
  });

  it('a failed save gives the old name back and reopens the field with what was typed', () => {
    const { state } = renameSubmit(renameEdit(renameOpen(renameIdle('Kim family'), 'Kim family'), 'Park family'));
    const failed = renameSettled(state, { ok: false, failure: 'offline' });
    expect(failed).toMatchObject({ name: 'Kim family', announce: false });
    expect(failed.state).toMatchObject({ open: true, draft: 'Park family', stored: 'Kim family', saving: false, failure: 'offline' });
    // Typing again clears the failure line; an archived space keeps Save unavailable.
    expect(renameEdit(failed.state, 'Park family 2').failure).toBeNull();
    const archived = renameSettled(state, { ok: false, failure: 'archived' }).state;
    expect(renameEdit(archived, 'Park family 2').failure).toBe('archived');
    expect(renameSubmit(renameEdit(archived, 'Park family 2')).send).toBeNull();
  });
});

describe('NameOverrides: a rename never drops a read, and no read puts an old name back', () => {
  it('a pending name wins over every read; a settled one over reads that began before it settled', () => {
    const names = new NameOverrides();
    const before = names.begin();
    names.set('space:c1', 'Room 5', false);
    const during = names.begin();
    // Both reads may hold the old name while the PATCH is under way.
    expect(names.nameFor('space:c1', 'Room 4', before)).toBe('Room 5');
    expect(names.nameFor('space:c1', 'Room 4', during)).toBe('Room 5');
    names.set('space:c1', 'Room 5', true);
    // Settled: a read that began earlier still answers with the old name and is overruled...
    expect(names.nameFor('space:c1', 'Room 4', during)).toBe('Room 5');
    // ...a read that began after it draws its own name (a later rename from another device included).
    const after = names.begin();
    expect(names.nameFor('space:c1', 'Room 6', after)).toBe('Room 6');
    // The older read can still land after that one (two reads of one space, either order): it is still overruled.
    expect(names.nameFor('space:c1', 'Room 4', before)).toBe('Room 5');
    // Another space is untouched.
    expect(names.nameFor('space:c2', 'Room 9', before)).toBe('Room 9');
  });

  it('a failed save settles on the last confirmed name', () => {
    const names = new NameOverrides();
    const read = names.begin();
    names.set('space:c1', 'Room 5', false);
    names.set('space:c1', 'Room 4', true);
    expect(names.nameFor('space:c1', 'Room 4', read)).toBe('Room 4');
    expect(names.nameFor('space:c1', 'Room 4', names.begin())).toBe('Room 4');
  });
});
