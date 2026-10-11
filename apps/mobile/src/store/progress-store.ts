import { PlacementResultSchema, type PlacementResult, type ProgressSnapshot } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { episodesAll } from '../content/episodes';
import { latchSnapshot } from '../logic/my-route/latch';
import { awardWorld, welcomeCardIds } from '../content/award-world';
import { applyAwards } from '../logic/awards/apply';
import { catchUpGrantedPayload } from '../logic/awards/catch-up';
import { missingAwards } from '../logic/awards/derive';
import type { DerivedAward } from '../logic/awards/types';
import { recordBestQuest } from '../logic/quest-progress';
import { mergePlacements, mergeSnapshots, withSnapshotDefaults } from '../logic/sync/merge';
import { notifyProgressPersisted } from '../logic/sync/persist-hook';
import { readJson, writeJson } from '../platform/storage';
import { track } from '../platform/telemetry';
import { onProfileRemoved } from './profile-removal';
import { useProfileStore } from './profile-store';

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
  /**
   * Cards a reconcile added this app session, per profile (F-STORY-006 §3.5):
   * what the Home catch-up card announces. Session-only, never saved; holds
   * nothing when a reconcile added only the welcome card.
   */
  catchUp: Record<string, string[]>;
}

/** A card to add; without `unlockedAt` it is unlocked now. */
export interface CardUnlock {
  cardId: string;
  unlockedAt?: string;
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
  /**
   * @deprecated No production caller since F-STORY-006 PR 6.4b: use
   * `unlockCards`, which writes deterministic `unlockedAt` times (§3.1 rule 3)
   * and adds several cards with one write. This one stamps the current time.
   */
  unlockCard: (profileId: string, cardId: string) => void;
  /**
   * Add several cards with one storage write (F-STORY-006 §3.3, the live
   * path). Owned and repeated ids are skipped; returns the ids it added.
   * The live path (`applyQuestResult`) calls it in the same synchronous tick as
   * `recordQuestComplete`: a reconcile that lands in between (a hydrate or a
   * sync) would add those cards silently, as a catch-up with no Results moment.
   */
  unlockCards: (profileId: string, cards: readonly CardUnlock[]) => string[];
  /**
   * Add the cards the award rules say this snapshot should hold and does not
   * (F-STORY-006 §3.3, §3.5). Silent: no banner and no per-card telemetry,
   * one aggregate `card.catchup_granted` when it added more than the welcome
   * card. Only ever adds.
   * Returns the awards it added; a profile with no snapshot in memory or no
   * profile record (no creation time for the welcome card) is left alone, and
   * a record the rules cannot read (malformed or very old) gains nothing.
   * Cards a quest just earned belong to the live path (see `unlockCards`).
   */
  reconcileAwards: (profileId: string) => DerivedAward[];
  /**
   * Announce cards that were already owed before a Results visit and arrived
   * with its write (`unlockCards`): the Home catch-up list and one aggregate
   * `card.catchup_granted`, never a per-card event (§3.5). Writes nothing.
   */
  recordCatchUp: (profileId: string, added: readonly DerivedAward[]) => void;
  /**
   * Clear the "New" flag of owned cards (CardDetail, the catch-up card's "See
   * my cards") and take them off the catch-up list. The list is cleared even
   * when no flag changes (a sync merge may already have cleared them).
   */
  markCardsSeen: (profileId: string, cardIds: readonly string[]) => void;
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
  /**
   * Sync / restore hand back a merged snapshot. It is latched and reconciled
   * first and saved with one write; that write does not notify sync unless the
   * stage latch added a key or the reconcile added cards, which sync must then
   * upload (the next pass adds nothing, so it converges).
   */
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
 * blank one. Runs after each quest result, on hydrate (app start) and when
 * sync or restore hands back a snapshot, with `flags.myRouteEnabled` off too,
 * so a learner who finishes Stage 1 is latched before any build adds Stage 1
 * quests. Best effort: it never throws (`latchSnapshot`).
 */
function withLatches(snap: ProgressSnapshot, now: Date): ProgressSnapshot {
  return latchSnapshot(snap, episodesAll, now);
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

const WELCOME_CARD_IDS = new Set(welcomeCardIds);

/**
 * `snap` with the cards the award rules say it should hold (F-STORY-006
 * §3.3). Unchanged when the profile is unknown (no creation time for the
 * welcome card) or the rules cannot read the record: a saved snapshot is
 * read back unvalidated, and a malformed one must never stop a hydrate or a sync.
 */
function withAwards(profileId: string, snap: ProgressSnapshot): { snap: ProgressSnapshot; added: DerivedAward[] } {
  const profile = useProfileStore.getState().profiles.find((p) => p.id === profileId);
  if (!profile) return { snap, added: [] };
  try {
    const added = missingAwards(awardWorld, snap, profile);
    if (added.length === 0) return { snap, added };
    return { snap: applyAwards(snap, added, new Date().toISOString()), added };
  } catch {
    return { snap, added: [] };
  }
}

/** The catch-up list after a reconcile added `added`: only non-welcome cards announce (§3.5). */
function catchUpAfter(catchUp: Record<string, string[]>, profileId: string, added: readonly DerivedAward[]): Record<string, string[]> {
  const ids = added.map((a) => a.cardId);
  if (!ids.some((id) => !WELCOME_CARD_IDS.has(id))) return catchUp;
  return { ...catchUp, [profileId]: unionIds(catchUp[profileId] ?? [], ids) };
}

/** One `card.catchup_granted` per reconcile that added more than the welcome card (§3.5); never a per-card event. */
function announceCatchUp(profileId: string, added: readonly DerivedAward[]): void {
  const payload = catchUpGrantedPayload(added);
  if (payload) void track({ name: 'card.catchup_granted', profileId, payload });
}

function withoutCatchUp(catchUp: Record<string, string[]>, profileId: string): Record<string, string[]> {
  if (!(profileId in catchUp)) return catchUp;
  const { [profileId]: _dropped, ...others } = catchUp;
  return others;
}

/** Union in first-seen order, so a card is never listed twice. */
function unionIds(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])];
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
  catchUp: {},

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
      const latched = found ? withLatches(found, new Date()) : found;
      // Reconcile after the merge with the saved copy, never before (F-STORY-006 §3.5).
      const { snap, added } = latched ? withAwards(profileId, latched) : { snap: undefined, added: [] };
      set((s) => ({
        byProfile: snap ? { ...s.byProfile, [profileId]: snap } : s.byProfile,
        hydratedFor: new Set([...s.hydratedFor, profileId]),
        pendingFor: without(s.pendingFor, profileId),
        catchUp: catchUpAfter(s.catchUp, profileId, added),
      }));
      announceCatchUp(profileId, added);
      // One write for the pending writes, an added latch and the cards they
      // earned. Cards are saved only onto a record that was read or written:
      // nothing loaded also means "the read failed", and a blank record holding
      // only the welcome card would replace real progress (it stays in memory).
      if (snap && (unsaved || latched !== found || (loaded && added.length > 0))) save(profileId, snap);
    })().finally(() => inFlight.delete(profileId));
    inFlight.set(profileId, load);
    return load;
  },

  ensure: (profileId) => {
    const existing = get().byProfile[profileId];
    if (existing) return existing;
    const fresh = blankSnapshot(profileId);
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: fresh } }));
    // The welcome card arrives with a new snapshot (F-STORY-006 §3.3). Before
    // the saved copy has been read, read it instead: `hydrate` reconciles
    // whatever it loads, so a blank record is never written over saved progress.
    if (!get().hydratedFor.has(profileId)) {
      void get().hydrate(profileId);
      return fresh;
    }
    // In memory only, never saved on its own (see `hydrate`): the card is
    // deterministic (`profile.createdAt`), and the next real write saves it.
    const { snap, added } = withAwards(profileId, fresh);
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: snap }, catchUp: catchUpAfter(s.catchUp, profileId, added) }));
    announceCatchUp(profileId, added);
    return snap;
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

  unlockCards: (profileId, cards) => {
    const snap = get().byProfile[profileId] ?? blankSnapshot(profileId);
    const owned = new Set(snap.cards.map((c) => c.cardId));
    const now = new Date().toISOString();
    const added: ProgressSnapshot['cards'] = [];
    for (const card of cards) {
      if (owned.has(card.cardId)) continue;
      owned.add(card.cardId);
      added.push({ cardId: card.cardId, unlockedAt: card.unlockedAt ?? now, newSinceLastView: true });
    }
    if (added.length === 0) return [];
    const updated: ProgressSnapshot = { ...snap, cards: [...snap.cards, ...added], updatedAt: now };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
    return added.map((c) => c.cardId);
  },

  reconcileAwards: (profileId) => {
    const current = get().byProfile[profileId];
    if (!current) return [];
    const { snap, added } = withAwards(profileId, current);
    if (added.length === 0) return [];
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: snap }, catchUp: catchUpAfter(s.catchUp, profileId, added) }));
    persist(profileId, snap);
    announceCatchUp(profileId, added);
    return added;
  },

  recordCatchUp: (profileId, added) => {
    if (added.length === 0) return;
    set((s) => ({ catchUp: catchUpAfter(s.catchUp, profileId, added) }));
    announceCatchUp(profileId, added);
  },

  markCardsSeen: (profileId, cardIds) => {
    const seen = new Set(cardIds);
    const listed = get().catchUp[profileId];
    if (listed) {
      const left = listed.filter((id) => !seen.has(id));
      set((s) => ({ catchUp: left.length > 0 ? { ...s.catchUp, [profileId]: left } : withoutCatchUp(s.catchUp, profileId) }));
    }
    const snap = get().byProfile[profileId];
    if (!snap?.cards.some((c) => c.newSinceLastView && seen.has(c.cardId))) return;
    const now = new Date().toISOString();
    const cards = snap.cards.map((c) => (c.newSinceLastView && seen.has(c.cardId) ? { ...c, newSinceLastView: false } : c));
    const updated: ProgressSnapshot = { ...snap, cards, updatedAt: now };
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
    set((s) => ({ catchUp: withoutCatchUp(s.catchUp, profileId) }));
    save(profileId, fresh);
  },

  replaceSnapshot: (profileId, snapshot) => {
    // Every sync, restore and plan derivation lands here. A completion that
    // arrived by sync or restore is latched now, not at the next cold start,
    // and the cards it earned are reconciled after the merge (F-STORY-006
    // §3.5). Only an added latch or card is announced, so it uploads.
    const latched = withLatches(snapshot, new Date());
    const { snap, added } = withAwards(profileId, latched);
    settle(profileId, snap);
    if (added.length > 0) set((s) => ({ catchUp: catchUpAfter(s.catchUp, profileId, added) }));
    announceCatchUp(profileId, added);
    void writeJson(key(profileId), snap);
    if (snap !== snapshot) notifyProgressPersisted(profileId);
  },
}));

// A removed profile's catch-up list goes with it (F-STORY-006 §3.5).
onProfileRemoved((profileId) => useProgressStore.setState((s) => ({ catchUp: withoutCatchUp(s.catchUp, profileId) })));
