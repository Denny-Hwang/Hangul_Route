import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 5.3 and 5.4, G2, CS-G7 (row GU-2, section 19): quest 1 is recorded for
 * an id with no profile record (stars, the quest's card, the session log) with no welcome card and no
 * `session.start`; the save keeps the id, so every per-profile record is the learner's key for key; the welcome card
 * arrives after the save and is never announced; a duplicate id is refused; the boot repairs a save cut short; sync
 * and backups never see the guest. Storage is an in-memory map; nothing may reach the network.
 */
const disk = vi.hoisted(() => new Map<string, string>());
const parse = (key: string): unknown => (disk.has(key) ? JSON.parse(disk.get(key)!) : null);
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => parse(key)),
  readJsonStrict: vi.fn(async (key: string) => parse(key)),
  readJsonExact: vi.fn(async (key: string) => parse(key)),
  readJsonExactFresh: vi.fn(async (key: string) => parse(key)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, JSON.stringify(value))),
  updateJson: vi.fn(async (key: string, next: (current: unknown) => unknown) => {
    const value = next(parse(key));
    if (value === undefined) return false;
    disk.set(key, JSON.stringify(value));
    return true;
  }),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
  listKeys: vi.fn(async () => [...disk.keys()]),
  setWriteFence: vi.fn(),
  requestPersistence: vi.fn(async () => false),
}));
const sent = vi.hoisted(() => [] as { name: string; payload?: unknown; profileId?: string }[]);
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    sent.push(event);
    return true;
  }),
}));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined }));
vi.mock('../../platform/app-root', () => ({ peekBootIntent: () => null, consumeBootIntent: () => undefined }));
vi.mock('../../platform/join-handoff', () => ({ takeJoinHandoff: () => null }));

import type { GuestRecord, ProgressSnapshot } from '@hangul-route/content-schema';
import { welcomeCardIds } from '../../content/award-world';
import { promotionPlan } from '../../logic/guest/guest-model';
import { applyQuestResult } from '../../logic/results-award';
import { encodeBackup } from '../../logic/sync/backup';
import { track } from '../../platform/telemetry';
import { useGuestStore } from '../guest-store';
import { saveGuestAsProfile } from '../guest-promotion';
import { hydrateGuest } from '../guest-sweep';
import { PER_PROFILE_KEYS } from '../profile-keys';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { useSyncStore } from '../sync-store';
import { useUiStore } from '../ui-store';

const fetchSpy = vi.fn(async () => {
  throw new Error('no network in this test');
});

/** The run's start, before the test clock's now. */
const STARTED = '2026-10-01T09:00:00.000Z';
const GUEST: GuestRecord = { v: 1, id: 'profile:guest001', startedAt: STARTED, lastAt: STARTED, via: 'site', questDone: false };
const FORM = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const, learnerType: 'child' as const };
const Q1 = 'quest:stage1-letters-q1';
const LETTERS = 'episode:stage1-letters';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

/** The guest store holds a live record, as after a start (`hr:guest` stored). */
function liveGuest(running = true): void {
  disk.set('guest', JSON.stringify(GUEST));
  useGuestStore.setState({ record: GUEST, running, hydrated: true, memoryOnly: false });
}

/** Quest 1 played to Results for the guest id, wired the way Results wires it (row GU-3 hands it the guest id). */
function playQuestOne(stars: 0 | 1 | 2 | 3 = 3): void {
  const s = useProgressStore.getState();
  const sessionId = s.beginSession(GUEST.id, { owner: 'quest', streak: true });
  applyQuestResult(
    { profileId: GUEST.id, profileCreatedAt: GUEST.startedAt, questId: Q1, episodeId: LETTERS, rewardCardId: 'card:book', stars, correct: stars, total: 3, retries: 0 },
    {
      isHydrated: (id) => useProgressStore.getState().hydratedFor.has(id),
      snapshot: (id) => useProgressStore.getState().byProfile[id],
      recordQuestComplete: s.recordQuestComplete,
      unlockCards: s.unlockCards,
      recordCatchUp: s.recordCatchUp,
      track,
    },
  );
  if (sessionId !== null) useProgressStore.getState().endSession(GUEST.id, sessionId);
}

const cardsOf = (snap: ProgressSnapshot | undefined): string[] => (snap?.cards ?? []).map((c) => c.cardId).sort();
const storedProgress = (): ProgressSnapshot => parse(`progress:${GUEST.id}`) as ProgressSnapshot;

beforeEach(async () => {
  disk.clear();
  sent.length = 0;
  fetchSpy.mockClear();
  vi.stubGlobal('fetch', fetchSpy);
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), catchUp: {}, catchUpFound: {}, openSession: null });
  useSyncStore.setState({ byLearner: {} });
  useGuestStore.setState({ record: null, running: false, hydrated: true, memoryOnly: false });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  await settle();
});

describe('[GU] quest 1 for an id with no profile record (5.3)', () => {
  it('the stars, the quest card and the session log are stored; no welcome card, no session.start', async () => {
    liveGuest();
    await useProgressStore.getState().hydrate(GUEST.id);
    playQuestOne(3);
    await settle();

    const snap = useProgressStore.getState().byProfile[GUEST.id];
    expect(snap?.quests.find((q) => q.questId === Q1)).toMatchObject({ stars: 3 });
    expect(cardsOf(snap)).toEqual(['card:book']);
    expect(snap?.sessions).toHaveLength(1);
    expect(snap?.sessions[0]).toMatchObject({ profileId: GUEST.id });
    expect(snap?.sessions[0]?.endedAt).toEqual(expect.any(String));
    // Stored under the id, as for any learner.
    expect(cardsOf(storedProgress())).toEqual(['card:book']);
    expect(storedProgress().sessions).toHaveLength(1);
    for (const id of welcomeCardIds) expect(cardsOf(snap)).not.toContain(id);
    expect(sent.map((e) => e.name)).not.toContain('session.start');
    expect(sent.map((e) => e.name)).not.toContain('card.catchup_granted');
    expect(useProgressStore.getState().catchUp[GUEST.id]).toBeUndefined();
  });

  it('a hydrate or a reconcile for the guest adds no welcome card (withAwards needs a profile record)', async () => {
    liveGuest();
    await useProgressStore.getState().hydrate(GUEST.id);
    playQuestOne(2);
    expect(useProgressStore.getState().reconcileAwards(GUEST.id)).toEqual([]);
    expect(cardsOf(useProgressStore.getState().byProfile[GUEST.id])).toEqual(['card:book']);
  });

  it('a learner with a profile still gets session.start (only the guest goes without)', async () => {
    const mina = useProfileStore.getState().createProfile(FORM);
    useProgressStore.getState().beginSession(mina.id, { owner: 'quest', streak: true });
    expect(sent.filter((e) => e.name === 'session.start')).toHaveLength(1);
  });
});

describe('[GU] the save keeps the id (5.4, G2)', () => {
  it('the profile has the guest id, the run start as createdAt and is active; hr:guest goes; the run ends', async () => {
    liveGuest();
    await useProgressStore.getState().hydrate(GUEST.id);
    playQuestOne(3);
    await settle();
    const before = useProgressStore.getState().byProfile[GUEST.id]!;

    const created = await saveGuestAsProfile(GUEST, promotionPlan(GUEST, FORM, Date.now()));
    await settle();

    expect(created).toMatchObject({ id: GUEST.id, displayName: 'Mina', createdAt: STARTED, learnerType: 'child', role: 'learner' });
    expect(useProfileStore.getState().activeId).toBe(GUEST.id);
    expect((parse('profiles') as { id: string }[]).map((p) => p.id)).toEqual([GUEST.id]);
    expect(parse('profiles:active')).toBe(GUEST.id);
    expect(disk.has('guest')).toBe(false);
    expect(useGuestStore.getState()).toMatchObject({ record: null, running: false });

    // G2: the progress, stars and session log are the guest's; the welcome card arrives now, never announced.
    const after = useProgressStore.getState().byProfile[GUEST.id]!;
    expect(after.quests).toEqual(before.quests);
    expect(after.sessions).toEqual(before.sessions);
    expect(cardsOf(after)).toEqual([...new Set(['card:book', ...welcomeCardIds])].sort());
    const welcome = after.cards.find((c) => c.cardId === welcomeCardIds[0]);
    expect(Date.parse(welcome!.unlockedAt)).toBeLessThanOrEqual(Date.parse(after.cards.find((c) => c.cardId === 'card:book')!.unlockedAt));
    expect(cardsOf(storedProgress())).toEqual(cardsOf(after));
    expect(useProgressStore.getState().catchUp[GUEST.id]).toBeUndefined();
    expect(sent.map((e) => e.name)).not.toContain('card.catchup_granted');
  });

  it('key for key: every per-profile record under the guest id is the learner\'s after the save, nothing copied or renamed', async () => {
    liveGuest();
    for (const [name, template] of Object.entries(PER_PROFILE_KEYS)) {
      if (name !== 'progress') disk.set(template(GUEST.id), JSON.stringify({ store: name, seeded: true }));
    }
    await useProgressStore.getState().hydrate(GUEST.id);
    playQuestOne(3);
    await settle();
    const keysBefore = [...disk.keys()].filter((k) => k !== 'guest').sort();
    const valuesBefore = new Map(keysBefore.map((k) => [k, disk.get(k)]));

    await saveGuestAsProfile(GUEST, promotionPlan(GUEST, FORM, Date.now()));
    await settle();

    const guestKeysAfter = [...disk.keys()].filter((k) => k.endsWith(`:${GUEST.id}`)).sort();
    expect(guestKeysAfter).toEqual(keysBefore.filter((k) => k.endsWith(`:${GUEST.id}`)));
    for (const [name, template] of Object.entries(PER_PROFILE_KEYS)) {
      const key = template(GUEST.id);
      if (name === 'progress') continue;
      expect(disk.get(key), key).toBe(valuesBefore.get(key));
    }
    // No key under another id was made from the guest's.
    expect([...disk.keys()].filter((k) => k.includes('profile:') && !k.includes(GUEST.id))).toEqual([]);
  });

  it('a duplicate id is refused: another tab saved the guest first, so this tab keeps that profile and no second one', async () => {
    // An id this tab has never held (the tests above saved GUEST's id here; this tab would not take it back).
    const other: GuestRecord = { ...GUEST, id: 'profile:guest002' };
    disk.set('guest', JSON.stringify(other));
    useGuestStore.setState({ record: other, running: true });
    const theirs = { id: other.id, displayName: 'Jun', ageGroup: '8-9', avatar: 'hoya-green', role: 'learner', createdAt: STARTED, lastActiveAt: STARTED };
    disk.set('profiles', JSON.stringify([theirs]));

    expect(await useProfileStore.getState().promoteGuest(other, FORM)).toBeNull();
    await settle();
    expect(useProfileStore.getState().profiles.map((p) => [p.id, p.displayName])).toEqual([[other.id, 'Jun']]);

    expect(await saveGuestAsProfile(other, promotionPlan(other, FORM, Date.now()))).toBeNull();
    await settle();
    expect((parse('profiles') as unknown[]).length).toBe(1);
    expect(disk.has('guest')).toBe(false);
    expect(useGuestStore.getState()).toMatchObject({ record: null, running: false });
  });

  it('the reducer\'s name rule is unchanged: an invalid name throws and nothing is written', async () => {
    liveGuest();
    await expect(useProfileStore.getState().promoteGuest(GUEST, { ...FORM, displayName: ' ' })).rejects.toThrow(/display name/);
    expect(useProfileStore.getState().profiles).toEqual([]);
    expect(disk.has('guest')).toBe(true);
  });

  it('a start time that does not read as a time dates the profile now', async () => {
    const odd = { ...GUEST, startedAt: 'not a time' };
    const created = await useProfileStore.getState().promoteGuest(odd, FORM);
    expect(Number.isFinite(Date.parse(created!.createdAt))).toBe(true);
  });
});

describe('[GU] the hydrate repair (5.4 step 4)', () => {
  it('hr:guest whose id is already a profile (a crash between the two writes): hr:guest goes, the profile and its keys stay', async () => {
    disk.set('guest', JSON.stringify(GUEST));
    disk.set(`progress:${GUEST.id}`, JSON.stringify({ seeded: true }));
    useProfileStore.setState({ profiles: [{ id: GUEST.id, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: STARTED }] });
    useGuestStore.setState({ hydrated: false });

    expect(await hydrateGuest(Date.parse(STARTED))).toBe('repair');
    expect(disk.has('guest')).toBe(false);
    expect(disk.has(`progress:${GUEST.id}`)).toBe(true);
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([GUEST.id]);
    expect(useGuestStore.getState()).toMatchObject({ record: null, hydrated: true });
    // The repair sends nothing.
    expect(sent).toEqual([]);
  });

  it('an id in neither list keeps the guest', async () => {
    disk.set('guest', JSON.stringify(GUEST));
    expect(await hydrateGuest(Date.parse(STARTED) + 60_000)).toBe('keep');
    expect(useGuestStore.getState()).toMatchObject({ record: GUEST, running: false, hydrated: true });
    expect(disk.has('guest')).toBe(true);
  });

  it('nothing stored: no guest; a storage that cannot be read decides nothing', async () => {
    expect(await hydrateGuest()).toBe('none');
    const storage = await import('../../platform/storage');
    vi.mocked(storage.readJsonExact).mockRejectedValueOnce(new Error('read failed'));
    vi.mocked(storage.readJsonStrict).mockRejectedValueOnce(new Error('read failed'));
    disk.set('guest', JSON.stringify(GUEST));
    expect(await hydrateGuest()).toBe('unread');
    expect(disk.has('guest')).toBe(true);
    expect(useGuestStore.getState().hydrated).toBe(true);
  });

  it('a record that does not parse is no guest, kept until 30 days have passed', async () => {
    disk.set('guest', JSON.stringify({ ...GUEST, v: 2 }));
    expect(await hydrateGuest(Date.parse(STARTED) + 1000)).toBe('unreadable');
    expect(useGuestStore.getState().record).toBeNull();
    expect(disk.has('guest')).toBe(true);
  });
});

describe('[GU] sync and backups never see the guest (CS-G7)', () => {
  it('a sync asked for the guest id makes no request and writes no sync record', async () => {
    liveGuest();
    await useProgressStore.getState().hydrate(GUEST.id);
    playQuestOne(3);
    useSyncStore.getState().requestSync(GUEST.id);
    await useSyncStore.getState().syncNow(GUEST.id);
    await useSyncStore.getState().syncAll();
    await settle();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(disk.has(`sync:${GUEST.id}`)).toBe(false);
    expect(useSyncStore.getState().byLearner[GUEST.id]).toBeUndefined();
  });

  it('a backup is made from a profile, and the profile list holds no guest', async () => {
    liveGuest();
    const mina = useProfileStore.getState().createProfile(FORM);
    const lists = useProfileStore.getState().profiles.map((p) => encodeBackup(p, { profileId: p.id, quests: [], cards: [], sessions: [], homework: [], reviews: [], placements: [], updatedAt: STARTED } as unknown as ProgressSnapshot, new Date(STARTED)));
    expect(lists).toHaveLength(1);
    expect(lists[0]).toContain(mina.id);
    expect(lists.join('')).not.toContain(GUEST.id);
  });
});
