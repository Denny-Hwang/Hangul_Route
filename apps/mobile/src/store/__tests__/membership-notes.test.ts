import type { InboxNote, ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
const flagState = vi.hoisted(() => ({ notesEnabled: true }));
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/sync-api', () => ({ apiBaseUrl: vi.fn(() => 'https://api.example.com'), createSyncApi: vi.fn() }));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => undefined) }));
vi.mock('../../config/flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../config/flags')>()),
  flags: {
    syncEnabled: true,
    telemetryEnabled: false,
    telemetryNetwork: false,
    voiceEchoEnabled: false,
    get notesEnabled() {
      return flagState.notesEnabled;
    },
  },
}));

import { useMembershipStore } from '../membership-store';
import { useNotesStore } from '../notes-store';
import { usePlanStore } from '../plan-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { setSyncApiForTests, useSyncStore } from '../sync-store';
import { useTierStore } from '../tier-store';

const snap: ProgressSnapshot = { profileId: 'profile:a', updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 };
const classRow = { spaceId: 'space:cls', kind: 'class' as const, name: 'Sunday Class A', role: 'student' as const, joinedAt: 't' };
const delivered: InboxNote = {
  id: 'note:aaaaaaaa',
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

function fakeApi(calls: string[]) {
  return {
    getInbox: vi.fn(async () => {
      calls.push('inbox');
      return {
        status: 'ok',
        inbox: { rev: 1, plans: [], memberships: [classRow], tier: 'free', serverTime: 't', transfers: [], notes: [delivered], notePrefs: { classes: 'presets', acknowledged: false } },
      };
    }),
    putNoteState: vi.fn(async () => {
      calls.push('state');
      return { status: 'ok', http: 200, readAt: 't', reaction: null };
    }),
    reportNote: vi.fn(async () => {
      calls.push('report');
      return { status: 'ok', http: 201 };
    }),
  };
}

beforeEach(() => {
  mem.clear();
  flagState.notesEnabled = true;
  useMembershipStore.setState({ byLearner: {} });
  useNotesStore.setState({ byProfile: {} });
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
  useSyncStore.setState({ byLearner: {} });
  useProfileStore.setState({ profiles: [{ id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: 'profile:a', hydrated: true });
  useProgressStore.setState({ byProfile: { 'profile:a': snap }, hydratedFor: new Set(['profile:a']) });
});

/** F-FEEDBACK-001 section 6.9 (FB-7): the inbox hook and the queue flush before the inbox read. */
describe('membership-store refresh with notes', () => {
  it('flushes the queued note writes before the inbox read, then applies the inbox notes and prefs', async () => {
    const calls: string[] = [];
    const api = fakeApi(calls);
    setSyncApiForTests(api as never);
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    useNotesStore.setState({
      byProfile: {
        'profile:a': {
          notes: [delivered],
          prefs: null,
          putAway: [],
          classNotesCardSeen: false,
          queue: [
            { kind: 'state', noteId: 'note:aaaaaaaa', read: true, at: 't1' },
            { kind: 'report', noteId: 'note:aaaaaaaa', reason: 'unkind', at: 't2' },
          ],
        },
      },
    });
    await useMembershipStore.getState().refresh('profile:a');
    expect(calls).toEqual(['report', 'state', 'inbox']);
    expect(api.reportNote).toHaveBeenCalledWith('profile:a', 'note:aaaaaaaa', { reason: 'unkind' }, { deviceId: 'device-test', secret: 'sec' });
    const notes = useNotesStore.getState().byProfile['profile:a'];
    expect(notes?.queue).toEqual([]);
    expect(notes?.notes.map((n) => n.id)).toEqual(['note:aaaaaaaa']);
    expect(notes?.prefs).toEqual({ classes: 'presets', acknowledged: false });
    expect(mem.get('notes:profile:a')).toMatchObject({ prefs: { classes: 'presets' } });
  });

  it('with the flag off, nothing is flushed and the inbox notes are not kept', async () => {
    flagState.notesEnabled = false;
    const calls: string[] = [];
    setSyncApiForTests(fakeApi(calls) as never);
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    useNotesStore.setState({
      byProfile: { 'profile:a': { notes: [], prefs: null, putAway: [], classNotesCardSeen: false, queue: [{ kind: 'state', noteId: 'note:aaaaaaaa', read: true, at: 't1' }] } },
    });
    await useMembershipStore.getState().refresh('profile:a');
    expect(calls).toEqual(['inbox']);
    expect(useNotesStore.getState().byProfile['profile:a']?.notes).toEqual([]);
    expect(mem.has('notes:profile:a')).toBe(false);
  });

  it('an inbox that could not be read leaves the cached notes as they are', async () => {
    const calls: string[] = [];
    const api = { ...fakeApi(calls), getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })) };
    setSyncApiForTests(api as never);
    useSyncStore.getState().adoptCredentials('profile:a', 'sec', 1);
    useNotesStore.setState({ byProfile: { 'profile:a': { notes: [delivered], prefs: null, putAway: [], classNotesCardSeen: false, queue: [] } } });
    await useMembershipStore.getState().refresh('profile:a');
    expect(useNotesStore.getState().byProfile['profile:a']?.notes).toEqual([delivered]);
  });
});
