import { PlacementResultSchema, type PlacementResult, type ProgressSnapshot } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { episodesAll } from '../content/episodes';
import { stagesToLatch, withStageLatches } from '../logic/my-route/latch';
import { recordBestQuest } from '../logic/quest-progress';
import { mergePlacements, mergeSnapshots, withSnapshotDefaults } from '../logic/sync/merge';
import { notifyProgressPersisted } from '../logic/sync/persist-hook';
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
  /** Profiles whose saved snapshot has been read (or replaced wholesale). Only these are written to storage. */
  hydratedFor: Set<string>;
  /** Profiles written to before their saved snapshot was read; merged with it and saved once it loads. */
  pendingFor: Set<string>;
}

interface Actions {
  /**
   * Read the profile's saved snapshot into memory (once per profile; calls
   * that overlap share one read). Writes made before it lands are merged with
   * the saved copy, never written over it (audit UX-01 / L16). Leaves no
   * record when nothing is saved or written.
   */
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
  /**
   * Append a finished level check (F-PLC-001 section 3.8). Writes `placements`
   * and nothing else: no quest, card, homework, session or streak. A result
   * with zero responses, or one the Worker's schema would refuse (which would
   * block every later sync of the learner), is never stored; returns whether
   * it was.
   */
  recordPlacement: (profileId: string, result: PlacementResult) => boolean;
  /** Sync / restore hand back a merged snapshot; persisted without re-notifying sync. */
  replaceSnapshot: (profileId: string, snapshot: ProgressSnapshot) => void;
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

function save(profileId: string, snap: ProgressSnapshot): void {
  void writeJson(key(profileId), snap);
  notifyProgressPersisted(profileId);
}

/**
 * The stage latch writer (F-ROUTE-001 R-1b): adds `stageDoneAt` keys for
 * stages that are complete now, on the hydrated snapshot only, never on a
 * blank one. Runs after each quest result and on hydrate (app start), with
 * `flags.myRouteEnabled` off too, so a learner who finishes Stage 1 is latched
 * before any build adds Stage 1 quests.
 */
function withLatches(snap: ProgressSnapshot, now: Date): ProgressSnapshot {
  return withStageLatches(snap, stagesToLatch(snap, episodesAll), now);
}

/** Any open assignment for the quest is done (F-HW-001 §3.4, F-PLAN-001 §3.3). */
function completeAssignments(homework: ProgressSnapshot['homework'], questId: string, at: string): ProgressSnapshot['homework'] {
  return homework.map((h) => (h.questId === questId && !h.completedAt ? { ...h, completedAt: at } : h));
}

/**
 * Writes made before the saved copy loaded were built on a blank snapshot, so
 * their derived effects never touched what was saved. Replay them on the
 * merged result: a quest finished in that window completes its open
 * assignments from the saved copy, as `recordQuestComplete` would have.
 */
function replayUnsaved(merged: ProgressSnapshot, unsaved: ProgressSnapshot): ProgressSnapshot {
  const homework = unsaved.quests.reduce((hw, q) => (q.completedAt ? completeAssignments(hw, q.questId, q.completedAt) : hw), merged.homework);
  return { ...merged, homework };
}

/** One storage read per profile at a time: callers that overlap share it. */
const inFlight = new Map<string, Promise<void>>();

function without(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}

/**
 * Save a write. Until the profile's saved snapshot has been read, the write
 * stays in memory only — saving it would replace everything stored with a
 * record built on a blank one — and the read starts now; `hydrate` merges
 * the two and saves the result.
 */
function persist(profileId: string, snap: ProgressSnapshot): void {
  const store = useProgressStore.getState();
  if (store.hydratedFor.has(profileId)) {
    save(profileId, snap);
    return;
  }
  useProgressStore.setState((s) => ({ pendingFor: new Set([...s.pendingFor, profileId]) }));
  void store.hydrate(profileId);
}

/** A wholesale replacement (restore, sync, reset) is final: no read still in flight may bring older data back. */
function settle(profileId: string, snapshot: ProgressSnapshot): void {
  useProgressStore.setState((s) => ({
    byProfile: { ...s.byProfile, [profileId]: snapshot },
    hydratedFor: new Set([...s.hydratedFor, profileId]),
    pendingFor: without(s.pendingFor, profileId),
  }));
}

export const useProgressStore = create<State & Actions>((set, get) => ({
  byProfile: {},
  hydratedFor: new Set(),
  pendingFor: new Set(),

  hydrate: (profileId) => {
    if (get().hydratedFor.has(profileId)) return Promise.resolve();
    const running = inFlight.get(profileId);
    if (running) return running;
    const load = (async () => {
      const loaded = await readJson<ProgressSnapshot>(key(profileId));
      // A restore or a reset landed first; this read is stale.
      if (get().hydratedFor.has(profileId)) return;
      const { byProfile, pendingFor } = get();
      const unsaved = pendingFor.has(profileId) ? byProfile[profileId] : undefined;
      const found =
        unsaved && loaded
          ? replayUnsaved(mergeSnapshots(unsaved, loaded, { now: new Date() }), unsaved)
          : (unsaved ?? loaded ?? byProfile[profileId]);
      const snap = found ? withLatches(found, new Date()) : found;
      set((s) => ({
        byProfile: snap ? { ...s.byProfile, [profileId]: snap } : s.byProfile,
        hydratedFor: new Set([...s.hydratedFor, profileId]),
        pendingFor: without(s.pendingFor, profileId),
      }));
      if (snap && (unsaved || snap !== found)) save(profileId, snap);
    })().finally(() => inFlight.delete(profileId));
    inFlight.set(profileId, load);
    return load;
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
    const updatedQuest = recordBestQuest(
      snap.quests.find((q) => q.questId === input.questId),
      input,
      now,
    );
    const quests = [...snap.quests.filter((q) => q.questId !== input.questId), updatedQuest];
    const homework = completeAssignments(snap.homework, input.questId, now);
    const result: ProgressSnapshot = { ...snap, quests, homework, updatedAt: now };
    // Before the saved copy loads, `hydrate` latches the merged snapshot instead.
    const updated = get().hydratedFor.has(profileId) ? withLatches(result, new Date(now)) : result;
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

  recordPlacement: (profileId, result) => {
    if (result.responses.length === 0) return false;
    const parsed = PlacementResultSchema.safeParse(result);
    if (!parsed.success) return false;
    const snap = withSnapshotDefaults(get().byProfile[profileId] ?? blankSnapshot(profileId));
    const updated: ProgressSnapshot = {
      ...snap,
      placements: mergePlacements(snap.placements, [parsed.data]),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
    return true;
  },

  reset: (profileId) => {
    const fresh = blankSnapshot(profileId);
    settle(profileId, fresh);
    save(profileId, fresh);
  },

  replaceSnapshot: (profileId, snapshot) => {
    settle(profileId, snapshot);
    void writeJson(key(profileId), snapshot);
  },
}));
