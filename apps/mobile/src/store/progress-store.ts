import type { ProgressSnapshot, QuestProgress } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { readJson, writeJson } from '../platform/storage';
import { track } from '../platform/telemetry';

const key = (profileId: string): string => `progress:${profileId}`;

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(earlierKey: string, laterKey: string): number {
  const earlier = new Date(`${earlierKey}T00:00:00Z`).getTime();
  const later = new Date(`${laterKey}T00:00:00Z`).getTime();
  return Math.round((later - earlier) / DAY_MS);
}

/**
 * Streak rule:
 *   - Same UTC day as the last recorded session → streak unchanged
 *     (a child returning later the same day should not double-count).
 *   - Exactly one day later → streak + 1.
 *   - Any larger gap → streak resets to 1 (the streak is the *new* day).
 *   - No prior session → 1.
 */
export function nextStreak(
  currentStreak: number,
  lastSessionDay: string | undefined,
  todayKey: string,
): number {
  if (!lastSessionDay) return Math.max(1, 1);
  const diff = daysBetween(lastSessionDay, todayKey);
  if (diff <= 0) return Math.max(currentStreak, 1);
  if (diff === 1) return currentStreak + 1;
  return 1;
}

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
    const todayKey = dayKey(now);
    const lastSession = snap.sessions[snap.sessions.length - 1];
    const lastDay = lastSession ? dayKey(lastSession.startedAt) : undefined;
    const streakDays = nextStreak(snap.streakDays, lastDay, todayKey);

    const session = {
      id: `session:${now}`,
      profileId,
      startedAt: now,
      episodesTouched: [],
    };
    const updated: ProgressSnapshot = {
      ...snap,
      sessions: [...snap.sessions, session],
      streakDays,
      updatedAt: now,
    };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
    void track({
      name: 'session.start',
      profileId,
      payload: { streakDays, isNewDay: lastDay !== todayKey },
    });
  },

  endSession: (profileId) => {
    const snap = get().byProfile[profileId];
    if (!snap || snap.sessions.length === 0) return;
    const now = new Date().toISOString();
    const last = snap.sessions[snap.sessions.length - 1];
    if (!last || last.endedAt) return;
    const startMs = new Date(last.startedAt).getTime();
    const endMs = new Date(now).getTime();
    const durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
    const updatedSession = { ...last, endedAt: now, durationSeconds };
    const sessions = [...snap.sessions.slice(0, -1), updatedSession];
    const updated: ProgressSnapshot = { ...snap, sessions, updatedAt: now };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
    void track({
      name: 'session.end',
      profileId,
      payload: { durationSeconds, streakDays: snap.streakDays },
    });
  },

  reset: (profileId) => {
    const fresh = blankSnapshot(profileId);
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: fresh } }));
    persist(profileId, fresh);
  },
}));
