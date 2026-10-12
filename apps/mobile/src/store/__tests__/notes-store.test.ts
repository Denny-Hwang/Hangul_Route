import type { InboxNote } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJsonStrict: vi.fn(async (k: string) => (mem.has(k) ? JSON.parse(JSON.stringify(mem.get(k))) : null)),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));

import { readJsonStrict, removeKey } from '../../platform/storage';
import { useNotesStore, type NotesClient } from '../notes-store';
import { useProfileStore } from '../profile-store';

const creds = { deviceId: 'device-test', secret: 'sec' };
const prefs = { classes: 'all' as const, acknowledged: false };

function note(id: string, over: Partial<InboxNote> = {}): InboxNote {
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

function client(over: Partial<{ [K in keyof NotesClient]: NotesClient[K] }> = {}) {
  return {
    putNoteState: vi.fn<NotesClient['putNoteState']>(async () => ({ status: 'ok', http: 200, readAt: 't', reaction: null })),
    reportNote: vi.fn<NotesClient['reportNote']>(async () => ({ status: 'ok', http: 201 })),
    ...over,
  };
}

/** A fresh store, as after an app restart: memory empty, storage kept. */
const restart = (): void => useNotesStore.setState({ byProfile: {} });

beforeEach(() => {
  mem.clear();
  restart();
  vi.mocked(readJsonStrict).mockClear();
});

describe('notes-store (F-FEEDBACK-001 section 6.9)', () => {
  it('persists through platform/storage under notes:<profileId> and reads it back after a restart', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa')], notePrefs: prefs });
    expect(mem.get('notes:profile:a')).toMatchObject({ notes: [{ id: 'note:aaaaaaaa' }], prefs });
    restart();
    const data = await useNotesStore.getState().hydrate('profile:a');
    expect(data.notes.map((n) => n.id)).toEqual(['note:aaaaaaaa']);
    expect(readJsonStrict).toHaveBeenCalledWith('notes:profile:a');
  });

  it('hydrates once per profile, also when asked twice at the same time', async () => {
    mem.set('notes:profile:a', { notes: [note('aaaaaaaa')] });
    const [a, b] = await Promise.all([useNotesStore.getState().hydrate('profile:a'), useNotesStore.getState().hydrate('profile:a')]);
    expect(a).toBe(b);
    expect(readJsonStrict).toHaveBeenCalledTimes(1);
    expect(await useNotesStore.getState().hydrate('profile:a')).toBe(a);
  });

  it('keeps siblings apart: each profile has its own notes', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa')], notePrefs: prefs });
    await useNotesStore.getState().applyInbox('profile:b', { notes: [note('bbbbbbbb')], notePrefs: prefs });
    await useNotesStore.getState().putAway('profile:a', 'note:aaaaaaaa');
    expect(useNotesStore.getState().byProfile['profile:a']?.notes.map((n) => n.id)).toEqual(['note:aaaaaaaa']);
    expect(useNotesStore.getState().byProfile['profile:b']?.notes.map((n) => n.id)).toEqual(['note:bbbbbbbb']);
    expect(useNotesStore.getState().byProfile['profile:b']?.putAway).toEqual([]);
  });

  it('marks a note read once, locally first, and queues the read', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa')], notePrefs: prefs });
    await useNotesStore.getState().markRead('profile:a', 'note:aaaaaaaa', new Date('2026-10-12T10:00:00.000Z'));
    await useNotesStore.getState().markRead('profile:a', 'note:aaaaaaaa', new Date('2026-10-12T11:00:00.000Z'));
    await useNotesStore.getState().markRead('profile:a', 'note:zzzzzzzz');
    const data = useNotesStore.getState().byProfile['profile:a'];
    expect(data?.notes[0]?.readAt).toBe('2026-10-12T10:00:00.000Z');
    expect(data?.queue).toEqual([{ kind: 'state', noteId: 'note:aaaaaaaa', read: true, at: '2026-10-12T10:00:00.000Z' }]);
  });

  it('a reaction is local first, the last pick wins, and one write per note is queued', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa')], notePrefs: prefs });
    await useNotesStore.getState().pickReaction('profile:a', 'note:aaaaaaaa', 'thanks', new Date('2026-10-12T10:00:00.000Z'));
    await useNotesStore.getState().pickReaction('profile:a', 'note:aaaaaaaa', 'did_it', new Date('2026-10-12T10:01:00.000Z'));
    await useNotesStore.getState().pickReaction('profile:a', 'note:aaaaaaaa', 'did_it', new Date('2026-10-12T10:02:00.000Z'));
    await useNotesStore.getState().pickReaction('profile:a', 'note:zzzzzzzz', 'thanks');
    const data = useNotesStore.getState().byProfile['profile:a'];
    expect(data?.notes[0]?.reaction).toBe('did_it');
    expect(data?.queue).toEqual([{ kind: 'state', noteId: 'note:aaaaaaaa', reaction: 'did_it', at: '2026-10-12T10:01:00.000Z' }]);
  });

  it('put away survives a restart and is never sent', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa')], notePrefs: prefs });
    await useNotesStore.getState().putAway('profile:a', 'note:aaaaaaaa');
    await useNotesStore.getState().putAway('profile:a', 'note:aaaaaaaa');
    await useNotesStore.getState().putAway('profile:a', 'note:zzzzzzzz');
    restart();
    const data = await useNotesStore.getState().hydrate('profile:a');
    expect(data.putAway).toEqual(['note:aaaaaaaa']);
    expect(data.queue).toEqual([]);
    const api = client();
    await useNotesStore.getState().flush('profile:a', api, creds);
    expect(api.putNoteState).not.toHaveBeenCalled();
    expect(api.reportNote).not.toHaveBeenCalled();
  });

  it('a queued report is sent at the next flush, reports first, then state writes', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa'), note('bbbbbbbb')], notePrefs: prefs });
    await useNotesStore.getState().markRead('profile:a', 'note:aaaaaaaa');
    await useNotesStore.getState().queueReport('profile:a', 'note:bbbbbbbb', 'unkind', 'grown_up_pin');
    await useNotesStore.getState().queueReport('profile:a', 'note:zzzzzzzz', 'unkind');
    const order: string[] = [];
    const api = client({
      putNoteState: vi.fn<NotesClient['putNoteState']>(async (_l, id, body) => {
        order.push(`state:${id}:${JSON.stringify(body)}`);
        return { status: 'ok', http: 200, readAt: 't', reaction: null };
      }),
      reportNote: vi.fn<NotesClient['reportNote']>(async (_l, id, body) => {
        order.push(`report:${id}:${JSON.stringify(body)}`);
        return { status: 'ok', http: 201 };
      }),
    });
    await useNotesStore.getState().flush('profile:a', api, creds);
    expect(order).toEqual(['report:note:bbbbbbbb:{"reason":"unkind","attest":"grown_up_pin"}', 'state:note:aaaaaaaa:{"read":true}']);
    expect(useNotesStore.getState().byProfile['profile:a']?.queue).toEqual([]);
    expect(mem.get('notes:profile:a')).toMatchObject({ queue: [] });
  });

  it('a report without an attestation and a reaction write send only what they hold', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa'), note('bbbbbbbb')], notePrefs: prefs });
    await useNotesStore.getState().pickReaction('profile:a', 'note:aaaaaaaa', 'happy');
    await useNotesStore.getState().queueReport('profile:a', 'note:bbbbbbbb', 'other');
    const api = client();
    await useNotesStore.getState().flush('profile:a', api, creds);
    expect(api.reportNote).toHaveBeenCalledWith('profile:a', 'note:bbbbbbbb', { reason: 'other' }, creds);
    expect(api.putNoteState).toHaveBeenCalledWith('profile:a', 'note:aaaaaaaa', { reaction: 'happy' }, creds);
  });

  it('offline keeps the queue for the next sync and stops at the first network failure', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa'), note('bbbbbbbb')], notePrefs: prefs });
    await useNotesStore.getState().markRead('profile:a', 'note:aaaaaaaa');
    await useNotesStore.getState().markRead('profile:a', 'note:bbbbbbbb');
    const api = client({ putNoteState: vi.fn<NotesClient['putNoteState']>(async () => ({ status: 'error', http: -1, code: 'network' })) });
    await useNotesStore.getState().flush('profile:a', api, creds);
    expect(api.putNoteState).toHaveBeenCalledTimes(1);
    expect(useNotesStore.getState().byProfile['profile:a']?.queue).toHaveLength(2);
  });

  it('a 404 drops the write, a 5xx keeps it, a 429 report keeps the note hidden here', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa'), note('bbbbbbbb'), note('cccccccc')], notePrefs: prefs });
    await useNotesStore.getState().markRead('profile:a', 'note:aaaaaaaa');
    await useNotesStore.getState().markRead('profile:b', 'note:none');
    await useNotesStore.getState().pickReaction('profile:a', 'note:bbbbbbbb', 'thanks');
    await useNotesStore.getState().queueReport('profile:a', 'note:cccccccc', 'not_for_me', 'self');
    const api = client({
      putNoteState: vi.fn<NotesClient['putNoteState']>(async (_l, id) => (id === 'note:aaaaaaaa' ? { status: 'error', http: 404, code: 'not_found' } : { status: 'error', http: 503, code: 'http_503' })),
      reportNote: vi.fn<NotesClient['reportNote']>(async () => ({ status: 'error', http: 429, code: 'too_many' })),
    });
    await useNotesStore.getState().flush('profile:a', api, creds);
    const data = useNotesStore.getState().byProfile['profile:a'];
    expect(data?.queue).toEqual([expect.objectContaining({ kind: 'state', noteId: 'note:bbbbbbbb' })]);
    expect(data?.putAway).toEqual(['note:cccccccc']);
  });

  it('runs one flush per profile at a time', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa')], notePrefs: prefs });
    await useNotesStore.getState().markRead('profile:a', 'note:aaaaaaaa');
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api = client({
      putNoteState: vi.fn<NotesClient['putNoteState']>(async () => {
        await gate;
        return { status: 'ok', http: 200, readAt: 't', reaction: null };
      }),
    });
    const first = useNotesStore.getState().flush('profile:a', api, creds);
    const second = useNotesStore.getState().flush('profile:a', api, creds);
    expect(second).toBe(first);
    release();
    await first;
    expect(api.putNoteState).toHaveBeenCalledTimes(1);
  });

  it('applyInbox reports the notes that left, and a pending report keeps its note out of sight', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa'), note('bbbbbbbb')], notePrefs: prefs });
    const out = await useNotesStore.getState().applyInbox('profile:a', { notes: [note('bbbbbbbb')], notePrefs: prefs });
    expect(out).toEqual({ added: [], removed: ['note:aaaaaaaa'] });
  });

  it('records the one-time class-notes card answer once', async () => {
    await useNotesStore.getState().markClassNotesCardSeen('profile:a');
    await useNotesStore.getState().markClassNotesCardSeen('profile:a');
    expect(useNotesStore.getState().byProfile['profile:a']?.classNotesCardSeen).toBe(true);
    expect(mem.get('notes:profile:a')).toMatchObject({ classNotesCardSeen: true });
  });

  it('removing a profile clears its notes key and its memory, and only its own', async () => {
    useProfileStore.setState({
      profiles: [
        { id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' },
        { id: 'profile:b', displayName: 'Jin', ageGroup: '5-7', avatar: 'hoya-blue', role: 'learner', createdAt: 't' },
      ],
      activeId: 'profile:a',
      hydrated: true,
    });
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa')], notePrefs: prefs });
    await useNotesStore.getState().applyInbox('profile:b', { notes: [note('bbbbbbbb')], notePrefs: prefs });
    useProfileStore.getState().remove('profile:a');
    await Promise.resolve();
    expect(removeKey).toHaveBeenCalledWith('notes:profile:a');
    expect(mem.has('notes:profile:a')).toBe(false);
    expect(mem.has('notes:profile:b')).toBe(true);
    expect(useNotesStore.getState().byProfile['profile:a']).toBeUndefined();
    expect(useNotesStore.getState().byProfile['profile:b']).toBeDefined();
  });

  it('a report that was sent stays put away until an inbox drops the note', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa')], notePrefs: prefs });
    await useNotesStore.getState().queueReport('profile:a', 'note:aaaaaaaa', 'unkind');
    await useNotesStore.getState().flush('profile:a', client(), creds);
    expect(useNotesStore.getState().byProfile['profile:a']).toMatchObject({ queue: [], putAway: ['note:aaaaaaaa'] });
    // The Worker dropped it: the put-away id clears itself.
    await useNotesStore.getState().applyInbox('profile:a', { notes: [], notePrefs: prefs });
    expect(useNotesStore.getState().byProfile['profile:a']).toMatchObject({ notes: [], putAway: [] });
  });

  it('stops the flush at a 5xx or a 401, so a degraded Worker does not hold up the inbox', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa'), note('bbbbbbbb')], notePrefs: prefs });
    await useNotesStore.getState().markRead('profile:a', 'note:aaaaaaaa');
    await useNotesStore.getState().markRead('profile:a', 'note:bbbbbbbb');
    for (const http of [503, 401]) {
      const api = client({ putNoteState: vi.fn<NotesClient['putNoteState']>(async () => ({ status: 'error', http, code: `http_${http}` })) });
      await useNotesStore.getState().flush('profile:a', api, creds);
      expect(api.putNoteState, String(http)).toHaveBeenCalledTimes(1);
      expect(useNotesStore.getState().byProfile['profile:a']?.queue).toHaveLength(2);
    }
  });

  it('a storage read that fails never overwrites the stored record, and the next good read keeps both', async () => {
    const stored = {
      notes: [note('aaaaaaaa')],
      prefs,
      putAway: [],
      classNotesCardSeen: false,
      queue: [{ kind: 'report', noteId: 'note:aaaaaaaa', reason: 'unsafe', at: 't0' }],
    };
    mem.set('notes:profile:a', stored);
    vi.mocked(readJsonStrict).mockRejectedValueOnce(new Error('storage busy'));
    const { writeJson } = await import('../../platform/storage');
    vi.mocked(writeJson).mockClear();
    await useNotesStore.getState().putAway('profile:a', 'note:zzzzzzzz'); // read fails: nothing is written
    await useNotesStore.getState().markClassNotesCardSeen('profile:a'); // read works now: memory folded in
    expect(mem.get('notes:profile:a')).toMatchObject({
      notes: [{ id: 'note:aaaaaaaa' }],
      queue: [{ kind: 'report', noteId: 'note:aaaaaaaa', reason: 'unsafe' }],
      classNotesCardSeen: true,
    });
    expect(vi.mocked(writeJson).mock.calls.every(([, v]) => (v as { queue: unknown[] }).queue.length === 1)).toBe(true);
  });

  it('keeps changes in memory while storage cannot be read, and writes them once it can', async () => {
    vi.mocked(readJsonStrict).mockRejectedValueOnce(new Error('storage busy'));
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa')], notePrefs: prefs });
    expect(useNotesStore.getState().byProfile['profile:a']?.notes).toHaveLength(1);
    expect(mem.has('notes:profile:a')).toBe(false);
    await useNotesStore.getState().markRead('profile:a', 'note:aaaaaaaa');
    expect(mem.get('notes:profile:a')).toMatchObject({ notes: [{ id: 'note:aaaaaaaa' }], queue: [{ kind: 'state', noteId: 'note:aaaaaaaa', read: true }] });
  });

  it('a profile removed while a flush is in flight leaves no notes key behind', async () => {
    await useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa'), note('bbbbbbbb')], notePrefs: prefs });
    await useNotesStore.getState().queueReport('profile:a', 'note:aaaaaaaa', 'unkind');
    await useNotesStore.getState().markRead('profile:a', 'note:bbbbbbbb');
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api = client({
      reportNote: vi.fn<NotesClient['reportNote']>(async () => {
        await gate;
        return { status: 'error', http: 429, code: 'too_many' };
      }),
    });
    const running = useNotesStore.getState().flush('profile:a', api, creds);
    await Promise.resolve();
    useNotesStore.getState().forgetProfile('profile:a');
    release();
    await running;
    await Promise.resolve();
    expect(mem.has('notes:profile:a')).toBe(false);
    expect(useNotesStore.getState().byProfile['profile:a']).toBeUndefined();
    expect(api.putNoteState).not.toHaveBeenCalled();
  });

  it('a profile removed while its stored record or an inbox is being applied keeps nothing', async () => {
    mem.set('notes:profile:a', { notes: [note('aaaaaaaa')], prefs, putAway: [], classNotesCardSeen: false, queue: [] });
    const applying = useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa', { text: 'Loved it' })], notePrefs: prefs });
    useNotesStore.getState().forgetProfile('profile:a');
    await applying;
    await Promise.resolve();
    expect(mem.has('notes:profile:a')).toBe(false);
    expect(useNotesStore.getState().byProfile['profile:a']).toBeUndefined();
    // A later profile with the same id starts empty.
    expect(await useNotesStore.getState().hydrate('profile:a')).toEqual({ notes: [], prefs: null, putAway: [], classNotesCardSeen: false, queue: [] });
  });

  it('a stored write that fails never breaks the app', async () => {
    const { writeJson } = await import('../../platform/storage');
    vi.mocked(writeJson).mockRejectedValueOnce(new Error('quota'));
    await expect(useNotesStore.getState().applyInbox('profile:a', { notes: [note('aaaaaaaa')], notePrefs: prefs })).resolves.toEqual({ added: ['note:aaaaaaaa'], removed: [] });
  });
});
