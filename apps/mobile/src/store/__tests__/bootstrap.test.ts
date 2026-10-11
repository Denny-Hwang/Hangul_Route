import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => {} }));

import { readJson, writeJson } from '../../platform/storage';
import { useAudioStore } from '../audio-store';
import { useLayoutStore } from '../layout-store';
import { hydrateLearnerData } from '../bootstrap';
import { useLocaleStore } from '../locale-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { useStoryStore } from '../story-store';

const profile = (id: string, displayName: string): Profile => ({ id, displayName, ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' });

const saved = (profileId: string, cardId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: '2026-10-01T09:05:00.000Z',
  episodes: [],
  quests: [{ questId: 'quest:a', episodeId: 'episode:e', startedAt: '2026-10-01T09:00:00.000Z', completedAt: '2026-10-01T09:05:00.000Z', stars: 3, attempts: 1, accuracy: 1 }],
  cards: [{ cardId, unlockedAt: '2026-10-01T09:05:00.000Z', newSinceLastView: false }],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

describe('cold start (audit UX-01 / L16)', () => {
  beforeEach(() => {
    mem.clear();
    vi.mocked(readJson).mockReset().mockImplementation(async (k: string) => (mem.get(k) ?? null) as never);
    vi.mocked(writeJson).mockClear();
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), catchUp: {} });
    useLocaleStore.setState({ detected: 'en', device: null, byProfile: {}, hydrated: false });
    useAudioStore.setState({ muted: false, hydrated: false });
    useLayoutStore.setState({ allowedSideways: false, hydrated: false });
    useStoryStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), clearedFor: {} });
  });

  it("loads the profiles, then every profile's saved progress, before resolving", async () => {
    mem.set('profiles', [profile('profile:a', 'Suni'), profile('profile:b', 'Bo')]);
    mem.set('profiles:active', 'profile:b');
    mem.set('progress:profile:a', saved('profile:a', 'card:book'));
    mem.set('progress:profile:b', saved('profile:b', 'card:hanji'));

    await hydrateLearnerData();

    expect(useProfileStore.getState()).toMatchObject({ hydrated: true, activeId: 'profile:b' });
    const progress = useProgressStore.getState();
    expect([...progress.hydratedFor].sort()).toEqual(['profile:a', 'profile:b']);
    // Each saved copy is reconciled after it loads: the welcome card joins (F-STORY-006 §3.5).
    expect(progress.byProfile['profile:a']?.cards.map((c) => c.cardId)).toEqual(['card:book', 'card:tiger']);
    expect(progress.byProfile['profile:b']?.cards.map((c) => c.cardId)).toEqual(['card:hanji', 'card:tiger']);
  });

  it('reconciles each profile after its saved progress loads, so cards it already earned arrive (F-STORY-006 §3.5)', async () => {
    const at = '2026-10-01T09:05:00.000Z';
    mem.set('profiles', [profile('profile:a', 'Suni')]);
    mem.set('progress:profile:a', {
      ...saved('profile:a', 'card:book'),
      quests: [{ questId: 'quest:stage1-rites-q1', episodeId: 'episode:stage1-rites', startedAt: at, completedAt: at, stars: 1, attempts: 1, accuracy: 1 }],
    });

    await hydrateLearnerData();

    const stored = mem.get('progress:profile:a') as ProgressSnapshot;
    const rites = ['card:chuseok', 'card:sebae', 'card:seollal', 'card:songpyeon', 'card:tteokguk'];
    expect(stored.cards.map((c) => c.cardId).sort()).toEqual(['card:book', ...rites, 'card:tiger'].sort());
    expect(useProgressStore.getState().catchUp['profile:a']).toEqual(expect.arrayContaining(rites));
  });

  it("writes nothing at launch for a profile with no saved progress; Home's ensure then shows the welcome card (F-STORY-006 §3.3)", async () => {
    mem.set('profiles', [{ ...profile('profile:a', 'Suni'), createdAt: '2026-09-01T08:00:00.000Z' }]);

    await hydrateLearnerData();

    expect(mem.has('progress:profile:a')).toBe(false);
    expect(writeJson).not.toHaveBeenCalledWith('progress:profile:a', expect.anything());
    const snap = useProgressStore.getState().ensure('profile:a');
    expect(snap.cards).toEqual([{ cardId: 'card:tiger', unlockedAt: '2026-09-01T08:00:00.000Z', newSinceLastView: true }]);
    expect(mem.has('progress:profile:a')).toBe(false);
    expect(useProgressStore.getState().catchUp['profile:a']).toBeUndefined();
  });

  it('a saved record whose read fails at launch is never written over, for any profile', async () => {
    const original = saved('profile:a', 'card:book');
    mem.set('profiles', [profile('profile:a', 'Suni'), profile('profile:b', 'Minho')]);
    mem.set('progress:profile:a', original);
    // readJson turns a storage or parse error into null: the same answer as "nothing saved".
    vi.mocked(readJson).mockImplementation(async (k: string) => (k === 'progress:profile:a' ? null : ((mem.get(k) ?? null) as never)));

    await hydrateLearnerData();
    useProgressStore.getState().ensure('profile:a');
    useProgressStore.getState().ensure('profile:b');

    expect(mem.get('progress:profile:a')).toEqual(original);
    expect(writeJson).not.toHaveBeenCalledWith('progress:profile:a', expect.anything());
    expect(writeJson).not.toHaveBeenCalledWith('progress:profile:b', expect.anything());
  });

  it("loads every profile's story bookmarks with its progress, so Home never renders without them (F-STORY-004 §3.2)", async () => {
    mem.set('profiles', [profile('profile:a', 'Suni'), profile('profile:b', 'Bo')]);
    mem.set('story:bookmarks:profile:a', { v: 1, byStory: { 'story:sun-and-moon': { level: 'listen', sceneIndex: 3, updatedAt: '2026-10-01T09:05:00.000Z' } } });

    await hydrateLearnerData();

    const stories = useStoryStore.getState();
    expect([...stories.hydratedFor].sort()).toEqual(['profile:a', 'profile:b']);
    expect(stories.getBookmark('profile:a', 'story:sun-and-moon')?.sceneIndex).toBe(3);
    expect(stories.getBookmark('profile:b', 'story:sun-and-moon')).toBeUndefined();
  });

  it('the first write after start keeps what was saved', async () => {
    mem.set('profiles', [profile('profile:a', 'Suni')]);
    mem.set('progress:profile:a', saved('profile:a', 'card:book'));

    await hydrateLearnerData();
    useProgressStore.getState().beginSession('profile:a');

    const stored = mem.get('progress:profile:a') as ProgressSnapshot;
    expect(stored.cards.map((c) => c.cardId)).toEqual(['card:book', 'card:tiger']);
    expect(stored.quests.map((q) => q.questId)).toEqual(['quest:a']);
    expect(stored.sessions).toHaveLength(1);
  });

  it('a fresh install resolves with nothing to load', async () => {
    await hydrateLearnerData();
    expect(useProfileStore.getState()).toMatchObject({ hydrated: true, profiles: [] });
    expect(useProgressStore.getState().hydratedFor.size).toBe(0);
  });

  it("loads the device and every profile's locale settings after the profiles, before resolving (F-I18N-001 §3.2)", async () => {
    mem.set('profiles', [profile('profile:a', 'Suni'), profile('profile:b', 'Bo')]);
    mem.set('device:settings', { uiLocale: 'ko' });
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'tap' });

    await hydrateLearnerData();

    const locale = useLocaleStore.getState();
    expect(locale.hydrated).toBe(true);
    expect(locale.device).toBe('ko');
    expect(locale.byProfile['profile:a']).toEqual({ uiLocale: 'es', romanizationMode: 'tap' });
    expect(locale.byProfile['profile:b']).toBeUndefined();
  });

  it('a fresh install still marks the locale store hydrated', async () => {
    await hydrateLearnerData();
    expect(useLocaleStore.getState()).toMatchObject({ hydrated: true, device: null });
  });

  it('reads the saved mute before resolving, so the navigator never plays for a learner who muted yesterday (F-AUDIO-004 §3.7)', async () => {
    mem.set('device:audio', { muted: true });

    await hydrateLearnerData();

    expect(useAudioStore.getState()).toMatchObject({ muted: true, hydrated: true });
  });

  it('a device that never saved the mute starts with sound on and writes nothing for it', async () => {
    mem.set('profiles', [profile('profile:a', 'Suni')]);

    await hydrateLearnerData();

    expect(useAudioStore.getState()).toMatchObject({ muted: false, hydrated: true });
    expect(mem.has('device:audio')).toBe(false);
  });

  it('reads "Keep sideways" before resolving, so the portrait guard never flashes for a learner who said no (F-LAYOUT-001 §3.4)', async () => {
    mem.set('device:layout', { v: 1, allowedSideways: true });

    await hydrateLearnerData();

    expect(useLayoutStore.getState()).toMatchObject({ allowedSideways: true, hydrated: true });
  });

  it('a fresh install marks the layout store hydrated with the guard allowed to ask, and writes nothing for it', async () => {
    await hydrateLearnerData();

    expect(useLayoutStore.getState()).toMatchObject({ allowedSideways: false, hydrated: true });
    expect(mem.has('device:layout')).toBe(false);
  });
});
