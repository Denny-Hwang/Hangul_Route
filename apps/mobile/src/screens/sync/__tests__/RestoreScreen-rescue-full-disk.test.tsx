import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { TextInput } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.7 (row DP-1e; the open item DP-2 left): Restore by Rescue Code on a full
 * disk. The claim adopts the learner (`adoptServerLearner`), whose progress write rejects; the screen chooses its line
 * only after that write has run (`whenWritten`, section 3.2) and shows `caregiver.restore.saveLater` in place of the
 * "restored" notice text (design frame N; owner item O3: the card, Hoya and Great stay). Nothing is written over a
 * record already on the device.
 */
const disk = vi.hoisted(() => ({
  mem: new Map<string, unknown>(),
  /** While set, a progress write rejects (a full disk). */
  full: false,
}));
vi.mock('../../../platform/storage', async () =>
  (await import('../../../test-support/storage-transactions')).withTransactions({
    readJson: vi.fn(async (key: string) => (disk.mem.has(key) ? structuredClone(disk.mem.get(key)) : null)),
    readJsonStrict: vi.fn(async (key: string) => (disk.mem.has(key) ? structuredClone(disk.mem.get(key)) : null)),
    writeJson: vi.fn(async (key: string, value: unknown) => {
      if (key.startsWith('progress:') && disk.full) throw new Error('disk full');
      disk.mem.set(key, structuredClone(value));
    }),
    removeKey: vi.fn(async (key: string) => void disk.mem.delete(key)),
  }),
);
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
// The cloud is on: the Rescue Code path.
vi.mock('../../../platform/sync-api', () => ({ apiBaseUrl: vi.fn(() => 'https://api.example.com'), createSyncApi: vi.fn() }));

import { flags } from '../../../config/flags';
import { restoreNotice } from '../../../logic/sync/restore';
import { useProfileStore } from '../../../store/profile-store';
import { followSaveRetries, useProgressStore } from '../../../store/progress-store';
import { setSyncApiForTests, useSyncStore } from '../../../store/sync-store';
import { buttonsNamed, byTestId, cleanup, press, render, screenTexts } from '../../../test-support/render';
import { RestoreScreen } from '../RestoreScreen';

const m = getMessages('en').caregiver.restore;
const CODE = 'TIGER-MOON-4821';
const ID = 'profile:mina';
const PROFILE: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' };
const snap = (questIds: string[]): ProgressSnapshot => ({
  profileId: ID,
  updatedAt: '2026-11-01T09:00:00.000Z',
  episodes: [],
  quests: questIds.map((questId) => ({ questId, episodeId: 'episode:e', startedAt: '2026-11-01T09:00:00.000Z', completedAt: '2026-11-01T09:05:00.000Z', stars: 3, attempts: 1, accuracy: 1 })),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 1,
  questDoneAt: Object.fromEntries(questIds.map((q) => [q, '2026-11-01T09:05:00.000Z'])),
});

/** The server: the code finds Mina, whose cloud copy holds quest:r. */
const fakeApi = () => ({
  claimRescueCode: vi.fn(async () => ({
    status: 'ok',
    learner: { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange' },
    secret: 'sec-mina',
    snapshot: { rev: 4, snapshot: snap(['quest:r']), summary: null },
  })),
  register: vi.fn(async () => ({ status: 'ok', learnerId: ID, secret: 'sec-mina' })),
  getSnapshot: vi.fn(async () => ({ status: 'none' })),
  putSnapshot: vi.fn(async (_id: string, body: { baseRev: number }) => ({ status: 'ok', rev: body.baseRev + 1 })),
  issueRescueCode: vi.fn(async () => ({ status: 'ok', code: CODE })),
  getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })),
  updateLearnerProfile: vi.fn(async () => ({ status: 'ok', applied: true })),
});

const navigation = { navigate: vi.fn(), goBack: vi.fn() };
const syncFlag = flags.syncEnabled;

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 60; i += 1) await Promise.resolve();
  });
}

/** Opens the code field, types the code and presses Find my cards; waits for the claim and its write. */
async function claimWithCode(root: ReactTestInstance): Promise<void> {
  await press(buttonsNamed(root, m.code.cta)[0] as ReactTestInstance);
  await act(async () => {
    (root.findAll((n) => n.type === TextInput && n.props.testID === 'rescue-code-input')[0] as ReactTestInstance).props.onChangeText(CODE);
  });
  await press(buttonsNamed(root, m.code.find.cta)[0] as ReactTestInstance);
  await flush();
}

const screen = () => render(<RestoreScreen navigation={navigation as never} route={{ key: 'Restore', name: 'Restore', params: { from: 'settings' } } as never} />);
const restoredText = (action: 'create' | 'merge', quests: number): string =>
  restoreNotice({ action, profile: PROFILE, added: { cards: 0, quests } } as never, getMessages('en').caregiver);

beforeEach(() => {
  // react-native-web's TextInput reads `document.activeElement` when it mounts; Node has no document.
  vi.stubGlobal('document', { activeElement: null });
  disk.mem.clear();
  disk.full = false;
  flags.syncEnabled = true;
  setSyncApiForTests(fakeApi() as never);
  useSyncStore.setState({ byLearner: {} });
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), pendingVocabEvents: {}, loadFailedFor: new Set(), freshFor: new Set(), saveFailedFor: new Set(), saveRetryFailedFor: new Set() });
});

afterEach(async () => {
  disk.full = false;
  // A retry left waiting lands now on the working disk, so none reaches the next test.
  followSaveRetries((listener) => {
    listener(true);
    return () => undefined;
  });
  await flush();
  await cleanup();
  setSyncApiForTests(null);
  flags.syncEnabled = syncFlag;
  vi.unstubAllGlobals();
});

describe('[DP] Restore by Rescue Code on a full disk (row DP-1e)', () => {
  it('a learner new to this device: saveLater in place of the notice text, the card and Great stay, nothing stored', async () => {
    disk.full = true;
    const r = await screen();
    await claimWithCode(r.root);
    expect(byTestId(r.root, 'restore-notice').length).toBeGreaterThan(0);
    const texts = screenTexts(r.root);
    expect(texts).toContain(m.saveLater);
    expect(texts).not.toContain(restoredText('create', 1));
    // Announced as the notice appears (D8).
    expect(byTestId(r.root, 'restore-save-later')[0]?.props['aria-live']).toBe('polite');
    expect(buttonsNamed(r.root, m.great.cta)).toHaveLength(1);
    // The learner is on the device, the restore in memory; its record could not be written yet.
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([ID]);
    expect(useProgressStore.getState().byProfile[ID]?.quests.map((q) => q.questId)).toEqual(['quest:r']);
    expect(useProgressStore.getState().saveFailedFor.has(ID)).toBe(true);
    expect(disk.mem.has(`progress:${ID}`)).toBe(false);
  });

  it('a learner already on the device: the stored record is not written over, and saveLater shows', async () => {
    disk.mem.set(`progress:${ID}`, snap(['quest:a']));
    useProfileStore.setState({ profiles: [PROFILE], activeId: ID, hydrated: true });
    await useProgressStore.getState().hydrate(ID);
    await flush();
    disk.full = true;
    const r = await screen();
    await claimWithCode(r.root);
    const texts = screenTexts(r.root);
    expect(texts).toContain(m.saveLater);
    expect(texts).not.toContain(restoredText('merge', 1));
    expect(useProgressStore.getState().saveFailedFor.has(ID)).toBe(true);
    expect((disk.mem.get(`progress:${ID}`) as ProgressSnapshot).quests.map((q) => q.questId)).toEqual(['quest:a']);
    // Memory holds both; the next write that lands stores them.
    expect(useProgressStore.getState().byProfile[ID]?.quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:r']);
    disk.full = false;
    followSaveRetries((listener) => {
      listener(true);
      return () => undefined;
    });
    await flush();
    expect((disk.mem.get(`progress:${ID}`) as ProgressSnapshot).quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:r']);
  });

  it('the same claim with room on the disk says restored, not saveLater', async () => {
    const r = await screen();
    await claimWithCode(r.root);
    const texts = screenTexts(r.root);
    expect(texts).not.toContain(m.saveLater);
    expect(byTestId(r.root, 'restore-save-later')).toHaveLength(0);
    expect(byTestId(r.root, 'restore-notice').length).toBeGreaterThan(0);
    expect(useProgressStore.getState().saveFailedFor.has(ID)).toBe(false);
    expect((disk.mem.get(`progress:${ID}`) as ProgressSnapshot).quests.map((q) => q.questId)).toEqual(['quest:r']);
  });
});
