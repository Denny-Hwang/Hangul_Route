import type { GuestRecord } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.3, 8.4 and 12 (row GU-4): the save's memory at run time: the entry it
 * began at (`guest.saved.via`), Welcome's Add my name, whether quest 1's card is held, and the first Home's one bubble.
 */
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async () => undefined),
  listKeys: vi.fn(async () => []),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true), flushQueue: vi.fn(async () => undefined) }));
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../platform/grown-up-tab', () => ({ endGrownUpTab: vi.fn() }));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined }));
vi.mock('../../platform/device-uses', () => ({ readDeviceUses: async () => [] }));
vi.mock('../../platform/app-root', () => ({ peekBootIntent: () => null, consumeBootIntent: () => undefined }));
vi.mock('../../platform/join-handoff', () => ({ takeJoinHandoff: () => null, hasJoinHandoff: () => false }));

import { questById } from '../../content';
import { useAccountStore } from '../account-store';
import { guestFirstQuest } from '../guest-launch';
import { beginGuestSaveFromWelcome, clearGuestSavedNote, guestSaveEntry, guestSavedNoteFor, holdsFirstQuestCard, noteGuestSaveEntry, noteGuestSaved, promoteLiveGuest } from '../guest-save';
import { useGuestStore } from '../guest-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';

const ID = 'profile:guest001';
const AT = '2026-10-22T10:00:00.000Z';
const record: GuestRecord = { v: 1, id: ID, startedAt: AT, lastAt: AT, via: 'site', questDone: true };
const mina = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const, role: 'learner' as const, createdAt: AT };

beforeEach(() => {
  useGuestStore.setState({ record, running: false, hydrated: true, memoryOnly: false });
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useAccountStore.setState({ parentPinHash: null });
  useProgressStore.setState({ byProfile: {} });
  clearGuestSavedNote();
});

describe('the save entry (guest.saved.via)', () => {
  it('is the last entry noted', () => {
    noteGuestSaveEntry('later');
    expect(guestSaveEntry()).toBe('later');
    noteGuestSaveEntry('results');
    expect(guestSaveEntry()).toBe('results');
  });
});

describe('beginGuestSaveFromWelcome (6.3)', () => {
  it('notes Welcome and answers the form, or the SaveGuest PIN with a PIN stored', () => {
    expect(beginGuestSaveFromWelcome()).toEqual({ screen: 'CreateProfile', params: { firstRun: true, from: 'guest' } });
    expect(guestSaveEntry()).toBe('welcome');
    useAccountStore.setState({ parentPinHash: 'h:1234' });
    expect(beginGuestSaveFromWelcome()).toEqual({ screen: 'PinEntry', params: { next: 'SaveGuest' } });
  });

  it('nothing without a live guest (none, or already a profile)', () => {
    useGuestStore.setState({ record: null });
    expect(beginGuestSaveFromWelcome()).toBeNull();
    useGuestStore.setState({ record });
    useProfileStore.setState({ profiles: [{ ...mina, id: ID }] });
    expect(beginGuestSaveFromWelcome()).toBeNull();
  });
});

describe('holdsFirstQuestCard', () => {
  it('reads quest 1\'s card in the learner\'s progress', () => {
    const cardId = questById(guestFirstQuest()!.questId)!.rewardCardId!;
    expect(holdsFirstQuestCard(ID)).toBe(false);
    expect(holdsFirstQuestCard(null)).toBe(false);
    useProgressStore.setState({
      byProfile: { [ID]: { profileId: ID, updatedAt: AT, episodes: [], quests: [], cards: [{ cardId, unlockedAt: AT, newSinceLastView: true }], sessions: [], homework: [], reviews: [], streakDays: 0, questDoneAt: {} } },
    });
    expect(holdsFirstQuestCard(ID)).toBe(true);
  });
});

describe('promoteLiveGuest (5.4)', () => {
  it('null without a live guest', async () => {
    useGuestStore.setState({ record: null });
    expect(await promoteLiveGuest({ displayName: 'Sam', ageGroup: '8-9', avatar: 'hoya-orange', learnerType: 'self' })).toBeNull();
  });
});

describe('the first Home\'s bubble (8.4)', () => {
  it('is for the saved learner only, until it is cleared', () => {
    noteGuestSaved(ID, false);
    expect(guestSavedNoteFor(mina.id)).toBeNull();
    expect(guestSavedNoteFor(undefined)).toBeNull();
    expect(guestSavedNoteFor(ID)).toEqual({ card: false });
    expect(guestSavedNoteFor(ID)).toEqual({ card: false });
    clearGuestSavedNote();
    expect(guestSavedNoteFor(ID)).toBeNull();
  });
});
