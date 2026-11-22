import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.2, row DP-1a (test 4, screen half): the file restore chooses its line only
 * after the restore's write has run (`whenWritten`), so a line about the save (DP-2) can be true. The progress write is
 * held by a gate here: the notice must not show until it is released.
 */
const disk = vi.hoisted(() => ({
  mem: new Map<string, unknown>(),
  /** While set, a progress write waits for it. */
  gate: null as Promise<void> | null,
}));
vi.mock('../../../platform/storage', async () =>
  (await import('../../../test-support/storage-transactions')).withTransactions({
    readJson: vi.fn(async (key: string) => (disk.mem.has(key) ? structuredClone(disk.mem.get(key)) : null)),
    readJsonStrict: vi.fn(async (key: string) => (disk.mem.has(key) ? structuredClone(disk.mem.get(key)) : null)),
    readJsonExact: vi.fn(async (key: string) => (disk.mem.has(key) ? structuredClone(disk.mem.get(key)) : null)),
    writeJson: vi.fn(async (key: string, value: unknown) => {
      if (key.startsWith('progress:') && disk.gate) await disk.gate;
      disk.mem.set(key, structuredClone(value));
    }),
    removeKey: vi.fn(async (key: string) => void disk.mem.delete(key)),
  }),
);
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
// No cloud on this build: the file path only.
vi.mock('../../../platform/sync-api', () => ({ apiBaseUrl: vi.fn(() => ''), createSyncApi: vi.fn() }));
const picked = vi.hoisted(() => ({ text: '' }));
vi.mock('../../../platform/file', () => ({
  pickTextFile: vi.fn(async () => ({ ok: true, name: 'backup.json', text: picked.text })),
  saveTextFile: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../../store/membership-store', async (original) => ({
  ...(await original<typeof import('../../../store/membership-store')>()),
  rederiveLocal: vi.fn(async () => undefined),
}));

import { encodeBackup } from '../../../logic/sync/backup';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { buttonsNamed, byTestId, press, render } from '../../../test-support/render';
import { RestoreScreen } from '../RestoreScreen';

const m = getMessages('en').caregiver.restore;

const PROFILE: Profile = { id: 'profile:mina', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' };
const snap = (questIds: string[]): ProgressSnapshot => ({
  profileId: PROFILE.id,
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

const navigation = { navigate: vi.fn(), goBack: vi.fn() };

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 40; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  disk.mem.clear();
  disk.gate = null;
  useProfileStore.setState({ profiles: [PROFILE], activeId: PROFILE.id, hydrated: true });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), pendingVocabEvents: {}, loadFailedFor: new Set(), freshFor: new Set() });
  disk.mem.set(`progress:${PROFILE.id}`, snap(['quest:a']));
  picked.text = encodeBackup(PROFILE, snap(['quest:r']), new Date('2026-11-02T10:00:00.000Z'));
});

afterEach(() => {
  disk.gate = null;
});

describe('[DP] RestoreScreen waits for the restore write (test 4)', () => {
  it('shows the notice only once the restored snapshot was written', async () => {
    // The learner's record was read before (Home): the gate holds only the restore's own write.
    await useProgressStore.getState().hydrate(PROFILE.id);
    await flush();
    let release: () => void = () => undefined;
    disk.gate = new Promise<void>((r) => {
      release = r;
    });
    const r = await render(<RestoreScreen navigation={navigation as never} route={{ key: 'Restore', name: 'Restore', params: { from: 'settings' } } as never} />);
    const [open] = buttonsNamed(r.root, m.file.cta);
    expect(open).toBeDefined();
    await press(open as never);
    await flush();
    expect(byTestId(r.root, 'restore-notice')).toHaveLength(0);

    release();
    await flush();
    expect(byTestId(r.root, 'restore-notice').length).toBeGreaterThan(0);
    const stored = disk.mem.get(`progress:${PROFILE.id}`) as ProgressSnapshot;
    expect(stored.quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:r']);
  });
});
