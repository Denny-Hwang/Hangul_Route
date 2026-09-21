import type { BackupFile, Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { planRestore, restoreNotice } from '../restore';
import { notifyProgressPersisted, setProgressPersistListener } from '../persist-hook';
import { vi } from 'vitest';

const NOW = new Date('2026-09-21T12:00:00Z');
const profile: Profile = { id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' };
const snap = (cards: string[], quests: string[]): ProgressSnapshot => ({
  profileId: 'profile:a',
  updatedAt: 't',
  episodes: [],
  quests: quests.map((questId) => ({ questId, episodeId: 'e', startedAt: 't', completedAt: 't', stars: 2 as const, attempts: 1, accuracy: 0.8 })),
  cards: cards.map((cardId) => ({ cardId, unlockedAt: 't', newSinceLastView: false })),
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});
const file: BackupFile = { format: 'hangul-route-backup', version: 1, exportedAt: 't', profile, snapshot: snap(['c1', 'c2'], ['q1']) };

describe('planRestore (F-SYNC-002 §3.3)', () => {
  it('creates the profile when it does not exist on this device', () => {
    const plan = planRestore(file, null, NOW);
    expect(plan.action).toBe('create');
    expect(plan.added).toEqual({ cards: 2, quests: 1 });
    expect(restoreNotice(plan)).toBe('Welcome back, Suni! Your journey is here.');
  });
  it('merges into an existing profile and counts only what was new', () => {
    const plan = planRestore(file, { profile, snapshot: snap(['c1'], ['q1', 'q9']) }, NOW);
    expect(plan.action).toBe('merge');
    expect(plan.snapshot.cards.map((c) => c.cardId)).toEqual(['c1', 'c2']);
    expect(plan.snapshot.quests.map((q) => q.questId)).toEqual(['q1', 'q9']);
    expect(plan.added).toEqual({ cards: 1, quests: 0 });
    expect(restoreNotice(plan)).toBe("We found Suni's progress! Added 1 card.");
  });
  it('says so when the file adds nothing, and pluralizes', () => {
    const same = planRestore(file, { profile, snapshot: file.snapshot }, NOW);
    expect(restoreNotice(same)).toBe('Suni already has everything from this file.');
    const both = planRestore(file, { profile, snapshot: snap([], []) }, NOW);
    expect(restoreNotice(both)).toBe("We found Suni's progress! Added 2 cards and 1 quest.");
  });
});

describe('persist hook', () => {
  it('forwards to the listener when set and is silent otherwise', () => {
    const l = vi.fn();
    setProgressPersistListener(l);
    notifyProgressPersisted('profile:a');
    expect(l).toHaveBeenCalledWith('profile:a');
    setProgressPersistListener(null);
    expect(() => notifyProgressPersisted('profile:a')).not.toThrow();
  });
});
