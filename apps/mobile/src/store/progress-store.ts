import type { ProgressSnapshot, QuestProgress } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { readJson, writeJson } from '../platform/storage';

const key = (profileId: string): string => `progress:${profileId}`;

interface State {
  byProfile: Record<string, ProgressSnapshot>;
  hydratedFor: Set<string>;
}

interface Actions {
  hydrate: (profileId: string) => Promise<void>;
  ensure: (profileId: string) => ProgressSnapshot;
  recordQuestComplete: (
    profileId: string,
    input: {
      questId: string;
      episodeId: string;
      stars: 0 | 1 | 2 | 3;
      accuracy: number;
      attempts: number;
    },
  ) => void;
  unlockCard: (profileId: string, cardId: string) => void;
  beginSession: (profileId: string) => void;
  endSession: (profileId: string) => void;
  reset: (profileId: string) => void;
}

function blankSnapshot(profileId: string): ProgressSnapshot {
  return {
    profileId,
    updatedAt: new Date().toISOString(),
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  };
}

function persist(profileId: string, snap: ProgressSnapshot): void {
  void writeJson(key(profileId), snap);
}

export const useProgressStore = create<State & Actions>((set, get) => ({
  byProfile: {},
  hydratedFor: new Set(),

  hydrate: async (profileId) => {
    if (get().hydratedFor.has(profileId)) return;
    const loaded = await readJson<ProgressSnapshot>(key(profileId));
    const snap = loaded ?? blankSnapshot(profileId);
    set((s) => ({
      byProfile: { ...s.byProfile, [profileId]: snap },
      hydratedFor: new Set([...s.hydratedFor, profileId]),
    }));
  },

  ensure: (profileId) => {
    const existing = get().byProfile[profileId];
    if (existing) return existing;
    const fresh = blankSnapshot(profileId);
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: fresh } }));
    return fresh;
  },

  recordQuestComplete: (profileId, input) => {
    const snap = get().byProfile[profileId] ?? blankSnapshot(profileId);
    const now = new Date().toISOString();
    const updatedQuest: QuestProgress = {
      questId: input.questId,
      episodeId: input.episodeId,
      startedAt: now,
      completedAt: now,
      stars: input.stars,
      attempts: input.attempts,
      accuracy: input.accuracy,
    };
    const quests = [
      ...snap.quests.filter((q) => q.questId !== input.questId),
      updatedQuest,
    ];
    const updated: ProgressSnapshot = { ...snap, quests, updatedAt: now };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
  },

  unlockCard: (profileId, cardId) => {
    const snap = get().byProfile[profileId] ?? blankSnapshot(profileId);
    if (snap.cards.some((c) => c.cardId === cardId)) return;
    const now = new Date().toISOString();
    const updated: ProgressSnapshot = {
      ...snap,
      cards: [...snap.cards, { cardId, unlockedAt: now, newSinceLastView: true }],
      updatedAt: now,
    };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
  },

  beginSession: (profileId) => {
    const snap = get().byProfile[profileId] ?? blankSnapshot(profileId);
    const now = new Date().toISOString();
    const session = {
      id: `session:${now}`,
      profileId,
      startedAt: now,
      episodesTouched: [],
    };
    const updated: ProgressSnapshot = {
      ...snap,
      sessions: [...snap.sessions, session],
      updatedAt: now,
    };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
  },

  endSession: (profileId) => {
    const snap = get().byProfile[profileId];
    if (!snap || snap.sessions.length === 0) return;
    const now = new Date().toISOString();
    const last = snap.sessions[snap.sessions.length - 1];
    if (!last || last.endedAt) return;
    const startMs = new Date(last.startedAt).getTime();
    const endMs = new Date(now).getTime();
    const updatedSession = {
      ...last,
      endedAt: now,
      durationSeconds: Math.max(0, Math.round((endMs - startMs) / 1000)),
    };
    const sessions = [...snap.sessions.slice(0, -1), updatedSession];
    const updated: ProgressSnapshot = { ...snap, sessions, updatedAt: now };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
  },

  reset: (profileId) => {
    const fresh = blankSnapshot(profileId);
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: fresh } }));
    persist(profileId, fresh);
  },
}));
