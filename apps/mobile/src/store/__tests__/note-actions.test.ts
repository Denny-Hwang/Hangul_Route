import type { InboxNote } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
const api = vi.hoisted(() => ({ client: null as unknown, creds: { deviceId: 'device-test', secret: 'sec' } as unknown }));
vi.mock('../../platform/storage', () => ({
  readJsonStrict: vi.fn(async (k: string) => (mem.has(k) ? JSON.parse(JSON.stringify(mem.get(k))) : null)),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
vi.mock('../sync-store', () => ({ syncApi: () => api.client }));
vi.mock('../membership-store', () => ({ deviceCredentialsFor: async () => api.creds }));

import type { NoteWriteResult } from '../../platform/sync-api';
import { hideNoteNow, putNotePrefsNow, reportNoteNow } from '../../screens/notes/note-actions';
import { useNotesStore } from '../notes-store';

/**
 * The grown-up zone's calls to the device routes (F-FEEDBACK-001 sections 6.9, 6.10, 7.6; FB-9):
 * what each answer of the Worker does to this device's notes and what the screens are told.
 */

const P = 'profile:a';
const prefs = { classes: 'all' as const, acknowledged: false };
const ok = (http = 200): NoteWriteResult => ({ status: 'ok', http });
const err = (http: number, code = 'x'): NoteWriteResult => ({ status: 'error', http, code });

function note(id: string): InboxNote {
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
  };
}

function client(o: { hide?: NoteWriteResult; prefs?: NoteWriteResult; report?: NoteWriteResult[] } = {}) {
  const reports = [...(o.report ?? [ok(201)])];
  return {
    hideNote: vi.fn(async () => o.hide ?? ok()),
    putNotePrefs: vi.fn(async () => o.prefs ?? ok()),
    reportNote: vi.fn(async () => reports.shift() ?? ok(201)),
    putNoteState: vi.fn(async () => ({ status: 'ok' as const, http: 200, readAt: null, reaction: null })),
  };
}

const ids = (): string[] => (useNotesStore.getState().byProfile[P]?.notes ?? []).map((n) => n.id);

beforeEach(async () => {
  mem.clear();
  useNotesStore.setState({ byProfile: {} });
  api.client = null;
  api.creds = { deviceId: 'device-test', secret: 'sec' };
  await useNotesStore.getState().applyInbox(P, { notes: [note('aaaaaaaa'), note('bbbbbbbb')], notePrefs: prefs });
});

describe('hideNoteNow (section 6.10 item 2)', () => {
  it('hidden or already gone: the note leaves this device', async () => {
    api.client = client({ hide: ok() });
    expect(await hideNoteNow(P, 'note:aaaaaaaa')).toBe('hidden');
    expect(ids()).toEqual(['note:bbbbbbbb']);
    api.client = client({ hide: err(404, 'not_found') });
    expect(await hideNoteNow(P, 'note:bbbbbbbb')).toBe('alreadyGone');
    expect(ids()).toEqual([]);
  });

  it('a class-scoped device, a refusal, no connection or no credentials: the note stays', async () => {
    api.client = client({ hide: err(403, 'scope_limited') });
    expect(await hideNoteNow(P, 'note:aaaaaaaa')).toBe('classScoped');
    api.client = client({ hide: err(500) });
    expect(await hideNoteNow(P, 'note:aaaaaaaa')).toBe('failed');
    api.client = client({ hide: err(-1, 'network') });
    expect(await hideNoteNow(P, 'note:aaaaaaaa')).toBe('offline');
    api.creds = null;
    expect(await hideNoteNow(P, 'note:aaaaaaaa')).toBe('offline');
    api.client = null;
    expect(await hideNoteNow(P, 'note:aaaaaaaa')).toBe('offline');
    expect(ids()).toEqual(['note:aaaaaaaa', 'note:bbbbbbbb']);
  });
});

describe('putNotePrefsNow (section 6.10 items 2 and 5)', () => {
  it('saved: the local setting follows, and the one-time card is answered once acknowledged', async () => {
    const c = client();
    api.client = c;
    expect(await putNotePrefsNow(P, { classes: 'presets', attest: 'grown_up_pin' })).toBe('saved');
    expect(useNotesStore.getState().byProfile[P]?.prefs).toEqual({ classes: 'presets', acknowledged: false });
    expect(await putNotePrefsNow(P, { classes: 'presets', acknowledge: true, attest: 'grown_up_pin' })).toBe('saved');
    expect(useNotesStore.getState().byProfile[P]).toMatchObject({ prefs: { classes: 'presets', acknowledged: true }, classNotesCardSeen: true });
    // A later change keeps the acknowledgement: the card does not come back.
    expect(await putNotePrefsNow(P, { classes: 'off', attest: 'grown_up_pin' })).toBe('saved');
    expect(useNotesStore.getState().byProfile[P]?.prefs).toEqual({ classes: 'off', acknowledged: true });
    expect(c.putNotePrefs).toHaveBeenCalledTimes(3);
  });

  it('not saved: the local setting stays as the Worker has it', async () => {
    api.client = client({ prefs: err(403, 'scope_limited') });
    expect(await putNotePrefsNow(P, { classes: 'off', attest: 'grown_up_pin' })).toBe('classScoped');
    api.client = client({ prefs: err(500) });
    expect(await putNotePrefsNow(P, { classes: 'off', attest: 'grown_up_pin' })).toBe('failed');
    api.client = null;
    expect(await putNotePrefsNow(P, { classes: 'off', attest: 'grown_up_pin' })).toBe('offline');
    expect(useNotesStore.getState().byProfile[P]?.prefs).toEqual(prefs);
  });
});

describe('reportNoteNow (section 6.10 item 4)', () => {
  it('reported: sent now, and the note is hidden here', async () => {
    const c = client({ report: [ok(201)] });
    api.client = c;
    expect(await reportNoteNow(P, 'note:aaaaaaaa', 'unkind', 'grown_up_pin')).toBe('reported');
    expect(c.reportNote).toHaveBeenCalledTimes(1);
    expect(useNotesStore.getState().byProfile[P]?.queue).toEqual([]);
    expect(useNotesStore.getState().byProfile[P]?.putAway).toContain('note:aaaaaaaa');
  });

  it('too many reports today: the limit answer', async () => {
    api.client = client({ report: [err(429, 'rate_limited')] });
    expect(await reportNoteNow(P, 'note:aaaaaaaa', 'unkind', 'grown_up_pin')).toBe('tooMany');
  });

  it('already gone on the server: the note leaves this device (Notes for <learner> no longer lists it)', async () => {
    api.client = client({ report: [err(404, 'not_found')] });
    expect(await reportNoteNow(P, 'note:aaaaaaaa', 'other', 'grown_up_pin')).toBe('alreadyGone');
    expect(ids()).toEqual(['note:bbbbbbbb']);
  });

  it('offline or no connection: queued with the local hide', async () => {
    api.client = null;
    expect(await reportNoteNow(P, 'note:aaaaaaaa', 'unsafe', 'self')).toBe('queued');
    expect(useNotesStore.getState().byProfile[P]?.queue).toEqual([expect.objectContaining({ kind: 'report', noteId: 'note:aaaaaaaa', reason: 'unsafe', attest: 'self' })]);
    api.client = client({ report: [err(-1, 'network'), err(-1, 'network')] });
    expect(await reportNoteNow(P, 'note:bbbbbbbb', 'unkind', 'self')).toBe('queued');
  });

  it('a flush already running: waits for it, then sends the new report at once', async () => {
    let release: () => void = () => undefined;
    const slow = client();
    slow.putNoteState = vi.fn(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: 'ok' as const, http: 200, readAt: null, reaction: null });
        }),
    );
    api.client = slow;
    await useNotesStore.getState().markRead(P, 'note:bbbbbbbb');
    const running = useNotesStore.getState().flush(P, slow, { deviceId: 'device-test', secret: 'sec' });
    const report = reportNoteNow(P, 'note:aaaaaaaa', 'unkind', 'grown_up_pin');
    await vi.waitFor(() => expect(slow.putNoteState).toHaveBeenCalled());
    release();
    await running;
    expect(await report).toBe('reported');
    expect(slow.reportNote).toHaveBeenCalledTimes(1);
  });
});
