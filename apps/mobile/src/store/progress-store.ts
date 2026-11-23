import {
  PlacementResultSchema,
  ReviewEntrySchema,
  latestLocalDay,
  pruneReviews,
  SelfRouteSchema,
  PracticeDaysEntrySchema,
  type PracticeDaysEntry,
  pruneDailyReviews,
  type PlacementResult,
  type ProgressSnapshot,
  type ReviewEntry,
  type SelfRoute,
  type VocabProgress,
} from '@hangul-route/content-schema';
import { create } from 'zustand';
import { episodesAll } from '../content/episodes';
import { latchSnapshot } from '../logic/my-route/latch';
import { practiceDaysWrite } from '../logic/route/practice-days';
import { awardWorldFor, welcomeCardIds } from '../content/award-world';
import { applyAwards } from '../logic/awards/apply';
import { catchUpGrantedPayload } from '../logic/awards/catch-up';
import { missingAwards } from '../logic/awards/derive';
import { ownedIdsOf } from '../logic/awards/upper-cards';
import type { AwardWorld, DerivedAward } from '../logic/awards/types';
import { latchQuests, recordBestQuest } from '../logic/quest-progress';
import { sessionKindOf, takesOver, type SessionOptions } from '../logic/sessions/hold';
import { elapsedSeconds, keepsRun, lastStreakDay, newSessionId } from '../logic/sessions/session-log';
import { sessionDay, withLocalStreak } from '../logic/streak';
import { mergePlacements, mergeReview, mergeSnapshots, withSnapshotDefaults } from '../logic/sync/merge';
import { notifyProgressPersisted } from '../logic/sync/persist-hook';
import { mergeWithStored } from '../logic/sync/stored-merge';
import { emitGoalEvent } from '../logic/goals/goal-events';
import { sessionDayNow } from '../platform/goal-clock';
import { applyVocabEvents, emptyVocab, localDay, vocabOf, type VocabEvent } from '../logic/vocab/progress';
import { postProgressChanged, subscribeProgressChanged } from '../platform/progress-channel';
import { keepRawCopy, readJsonStrict, removeKey, updateJson } from '../platform/storage';
import { track } from '../platform/telemetry';
import { isLiveGuestId } from './guest-store';
import { onProfileRemoved } from './profile-removal';
import { useProfileStore } from './profile-store';
import { trackProgressReadFailed, trackProgressStartedFresh, trackSaveFailed, trackSaveLanded, trackSaveTried } from './storage-telemetry';
import { upperCardsOnFor } from './upper-cards-switch';

/** The learner's progress snapshot (`hr:progress:<id>`); exported for the removal sweep (row OA-7a). */
export const PROGRESS_KEY = (profileId: string): string => `progress:${profileId}`;
const key = PROGRESS_KEY;

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-3: where a stored snapshot that cannot be used is kept, byte for byte
 * (`hr:progress-corrupt:<id>`), before anything is written in its place. The first copy is the one kept. It goes
 * with the learner (the removal sweep, row OA-7a).
 */
export const PROGRESS_CORRUPT_KEY = (profileId: string): string => `progress-corrupt:${profileId}`;

/**
 * [OA] Learners removed from this device in this session (row OA-7a, CS-20): a read or a derive still in flight
 * writes nothing back for them while they are not a profile here. A restore adds the profile first, so its
 * snapshot saves again.
 */
const removedHere = new Set<string>();
const removedNow = (profileId: string): boolean => removedHere.has(profileId) && !useProfileStore.getState().profiles.some((p) => p.id === profileId);

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
  /**
   * Every card listed in `catchUp` since the profile's list was last empty
   * (session-only). Cards opened elsewhere leave `catchUp` but stay here, so
   * the catch-up card's number is the cards found, never what is left (D3).
   */
  catchUpFound: Record<string, string[]>;
  /**
   * Word progress events recorded before the profile's saved snapshot was read
   * (F-VOC-005 section 3.2), in order, each batch with its clock. `hydrate`
   * replays them onto the saved slice: merging a slice built on a blank one
   * would let a fresh `introduced` stamp win over a saved schedule.
   * Memory only; cleared by `hydrate` and by any wholesale replacement.
   */
  pendingVocabEvents: Record<string, PendingVocab[]>;
  /**
   * The one session running now (F-REPORT-001 section 3.3.2), in memory only:
   * never saved, so it is empty after every start and a session left open by
   * a killed app or a closed tab (an orphan) is never joined.
   */
  openSession: OpenSession | null;
  /**
   * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.2 (row DP-1a): profiles whose stored snapshot the last `hydrate` could
   * not read (AU-3's unread set, now store state so boot, the chooser and Home can subscribe). They stay un-hydrated:
   * nothing is written for them, and the next `hydrate` reads again.
   */
  loadFailedFor: ReadonlySet<string>;
  /**
   * [DP] Section 3.2: profiles whose damaged record AU-3 started fresh in this session (`withStored` answered
   * `fresh`), until the sync store's cloud fold has pushed them (`clearFresh`).
   */
  freshFor: ReadonlySet<string>;
  /**
   * [DP] Section 3.7 (row DP-2): profiles whose last progress write did not land (`withStored` answered `unsaved`: the
   * storage write rejected, as on a full disk), from that first failure until a write of them lands (`done` or
   * `fresh`). The write is tried again meanwhile (`SAVE_RETRY_DELAYS_MS`, `followSaveRetries`, and every new write).
   * A step that threw (`step-failed`) neither adds nor clears it.
   */
  saveFailedFor: ReadonlySet<string>;
}

/** The session running now and who began it. */
export interface OpenSession extends SessionOptions {
  profileId: string;
  sessionId: string;
}

/** One `recordVocab` call waiting for the saved snapshot. */
export interface PendingVocab {
  events: readonly VocabEvent[];
  /** The clock of the call, ISO. */
  at: string;
  /** The spacing rule was on for the call (F-CURR-002 section 4.3, row CM-12), so the replay applies it too. */
  spacing?: boolean;
}

/**
 * F-CURR-002 row CM-12: how word answers meet the memory model. `spacing` says whether the spacing
 * rule of F-VOC-005 P3 (as amended by CM-0b) applies to the profile's topic words now (the
 * `memoryRecord` switch); `recorded` hears each write of a hydrated profile, with the slice before
 * it, so the day's `memory.daily` counts include topic words. Registered by `logic/memory/boot.ts`;
 * with none registered the section 3.2 table applies, as before CM-12.
 */
export interface VocabRecordHook {
  spacing(profileId: string): boolean;
  recorded(profileId: string, before: VocabProgress, events: readonly VocabEvent[], clock: Date, spacing: boolean): void;
}
let vocabRecordHook: VocabRecordHook | null = null;
export function setVocabRecordHook(hook: VocabRecordHook | null): void {
  vocabRecordHook = hook;
}

type CatchUpState = Pick<State, 'catchUp' | 'catchUpFound'>;

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
   * [AU] Row AU-3: never rejects. A storage read that fails leaves the profile
   * un-hydrated (nothing is written for it; the next call reads again). A
   * stored value that cannot be used is first copied to
   * `hr:progress-corrupt:<id>`, and the profile then starts from a fresh snapshot.
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
  /**
   * Begin a session (F-REPORT-001 section 3.3.2): returns its id, or `null`
   * when the open session already belongs to this profile (a story opened
   * inside a quest joins the quest's session; that caller does nothing on
   * unmount). A streak session begun over the profile's time-only session
   * ends it and takes over. An open session of another profile is ended first.
   * `streak: true` (the quest player) moves `streakDays` and sends
   * `session.start` as before; `streak: false` (story, stand-alone game, level
   * check; OD-19) records time only. A quest and a learning session
   * (`keepsRun`: a story) keep the local-day run (`streakLocal`, F-CURR-002
   * OD-14); a learning session begun over a time-only one takes it over too.
   * Every session records its local day (`localDay`).
   */
  beginSession: (profileId: string, options: SessionOptions) => string | null;
  /**
   * End that session, if it is the open one: its elapsed time, capped at 60
   * minutes, is saved and `openSession` is cleared. Any other id is a no-op,
   * so the open session keeps running.
   */
  endSession: (profileId: string, sessionId: string) => void;
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
   * A grown-up's "Choose a different start" on the report (F-PLC-001 section
   * 3.9): sets `override` on that stored result (a later one replaces it) and
   * nothing else. `effectiveRoute` then skips every grid quest before the
   * chosen one and puts it and everything after it back. Returns whether a
   * result was changed.
   */
  applyPlacementOverride: (profileId: string, resultId: string, startQuestId: string) => boolean;
  /**
   * Sync / restore hand back a merged snapshot. It is latched and reconciled
   * first and saved with one write; that write does not notify sync unless the
   * stage latch added a key or the reconcile added cards, which sync must then
   * upload (the next pass adds nothing, so it converges).
   */
  replaceSnapshot: (profileId: string, snapshot: ProgressSnapshot) => void;
  /**
   * [DP] Section 3.2: resolves once the profile's storage work queued so far (its write chain as it is now) has
   * settled; at once when there is none. Never rejects. A restore awaits it before it chooses its line.
   */
  whenWritten: (profileId: string) => Promise<void>;
  /** [DP] Section 3.2: the cloud fold after a fresh start has landed; the profile leaves `freshFor`. */
  clearFresh: (profileId: string) => void;
  /**
   * Fold word progress events into the profile's `vocab` slice (F-VOC-005
   * section 3.2) and save it; writes nothing when every event is ignored.
   * Before the saved snapshot is read the events are also queued, and
   * `hydrate` replays them onto the saved slice. No screen calls it until the
   * Worker that keeps the slice is deployed (section 3.3).
   */
  recordVocab: (profileId: string, events: readonly VocabEvent[], now?: Date) => void;
  /**
   * Save a finished Hangul Check (F-QUEST-002 §3.9) to `reviews` and nothing else, persisted and
   * synced like any write: the caregiver channel. One entry per attempt; the same id again keeps
   * the higher-star entry (`mergeReview`). An entry the schema refuses is never stored; returns
   * whether it was.
   */
  recordReview: (profileId: string, entry: ReviewEntry) => boolean;
  /**
   * The learner's own weekly plan (F-PLAN-002 section 3.9): replaces `selfRoute` (a new plan, or
   * the same plan archived) and nothing else. A route the Worker's schema would refuse is never
   * stored; returns whether it was. Plan derivation runs separately (`usePlanStore.rederive`).
   */
  setSelfRoute: (profileId: string, route: SelfRoute) => boolean;
  /**
   * The learner's own practice days for one class plan (AMENDMENTS-ROUTE-CLASS-BLEND section 9.4, row BL-8):
   * replaces that plan's `practiceDays` entry, drops the entries of plans not in `livePlanIds` (the days go with their
   * plan), persists and syncs like any write. An entry the schema refuses is never stored; returns whether it was.
   * Plan derivation runs separately (`usePlanStore.rederive`).
   */
  setPracticeDays: (profileId: string, entry: PracticeDaysEntry, livePlanIds: readonly string[]) => boolean;
  /**
   * A goals write (F-CURR-002 row CM-17: points in `dayLog`, `goals`, the `steadyWeeks` latch) on the saved
   * snapshot only: false, with nothing written, while the profile's saved copy has not been read (a write
   * built on a blank record would lose to the saved points in the merge). The same object back writes nothing.
   */
  applyGoalWrite: (profileId: string, update: (snap: ProgressSnapshot) => ProgressSnapshot) => boolean;
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
    // The quest latch key is always written (F-REPORT-001 section 3.3.1), a reset included.
    questDoneAt: {},
  };
}

/**
 * Whether a stored value can be a snapshot at all: an object, not a list or a bare value. A record that is an object
 * is read back as it is, unvalidated, as before (an old or malformed one must never stop a hydrate or a sync);
 * anything else is kept aside, never worked on (AU-3).
 */
function isSnapshot(value: unknown): value is ProgressSnapshot {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Thrown inside a storage transaction to end it with no write: the stored value parses but is no snapshot. */
const NOT_A_SNAPSHOT = new Error('progress: the stored value is not a snapshot');

/** What one storage transaction does with the stored snapshot (null: nothing stored): the snapshot to store, or `undefined` to store nothing. */
type StoredStep = (stored: ProgressSnapshot | null) => ProgressSnapshot | undefined;

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.2 (row DP-1a): what one storage transaction of `hr:progress:<id>` ended as.
 * - `done`: the read worked, `step` returned, and its value was stored (or there was nothing to store).
 * - `fresh`: the stored bytes were damaged, kept at `hr:progress-corrupt:<id>`, and `step` ran on null (AU-3's fresh start).
 * - `fenced`: the write fence is up; `step` saw a plain read and nothing was stored.
 * - `unread`: the read failed, the damaged copy could not be kept, or the learner was removed meanwhile.
 * - `unsaved`: `step` returned and the storage write rejected (a full disk).
 * - `step-failed`: `step` itself threw; retrying the same step would throw again.
 */
export type StoredOutcome = 'done' | 'fresh' | 'fenced' | 'unread' | 'unsaved' | 'step-failed';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-3: every read and every write of `hr:progress:<id>` is one storage transaction
 * (`updateJson`) that reads the stored record first, so a record that cannot be read is never written over.
 * - The storage read fails: nothing is written and the answer is `unread` (`step` did not run).
 * - The stored value does not parse, or parses to something that is no snapshot: its raw bytes are first copied to
 *   `hr:progress-corrupt:<id>` (kept as it is when that key already holds a copy), and only then does `step` run, with
 *   null for "nothing usable stored" (`fresh`). When the copy cannot be made, nothing is written (`unread`).
 * Under the write fence (All lessons) the transaction is not run at all; `step` then gets what a plain read finds,
 * its answer is not stored, and the outcome is `fenced`. [DP] Row DP-1a: `ran` says `step` was called, `stepped` that it
 * returned, so a storage write that rejected (`unsaved`) is told apart from a step that threw (`step-failed`). Never
 * throws. Exported for its tests. [DP] Row DP-3: `failure.cause` says why a record that could not be used was not read
 * (`parse`: bytes that do not parse, or parse to no snapshot; `read`: the read threw), and `failure.kept` that its
 * bytes were kept aside, for `storage.read_failed`.
 */
export async function withStored(profileId: string, step: StoredStep, failure?: { cause?: 'read' | 'parse'; kept?: boolean }): Promise<StoredOutcome> {
  const storageKey = key(profileId);
  let ran = false;
  let stepped = false;
  /** `step`, with the two flags set around it. */
  const run = (stored: ProgressSnapshot | null): ProgressSnapshot | undefined => {
    ran = true;
    const value = step(stored);
    stepped = true;
    return value;
  };
  try {
    await updateJson<unknown>(
      storageKey,
      (stored) => {
        if (stored !== null && !isSnapshot(stored)) throw NOT_A_SNAPSHOT;
        return run(stored);
      },
      { exact: true },
    );
    if (!ran) {
      const stored = await readJsonStrict<unknown>(storageKey);
      run(isSnapshot(stored) ? stored : null);
      return 'fenced';
    }
    return 'done';
  } catch (error) {
    // `step` ran: it does not run twice. Its value did not land (`unsaved`), or it threw (`step-failed`).
    if (stepped) return 'unsaved';
    if (ran) return 'step-failed';
    if (failure) failure.cause = error instanceof SyntaxError || error === NOT_A_SNAPSHOT ? 'parse' : 'read';
    try {
      // A read that failed has nothing to copy and stays unread; a damaged value is kept before anything replaces it.
      if (!(await keepRawCopy(storageKey, PROGRESS_CORRUPT_KEY(profileId), { onlyUnparsable: error !== NOT_A_SNAPSHOT }))) return 'unread';
      if (failure) failure.kept = true;
      // The learner was removed while the copy was being made (row OA-7a): the removal already deleted both keys, so
      // the copy that landed after it goes too, and nothing is written for a learner who is no longer here.
      if (removedNow(profileId)) {
        await removeKey(PROGRESS_CORRUPT_KEY(profileId)).catch(() => undefined);
        return 'unread';
      }
      await updateJson<unknown>(storageKey, (stored) => run(isSnapshot(stored) ? stored : null));
      if (!removedNow(profileId)) trackProgressStartedFresh(profileId);
      return 'fresh';
    } catch {
      if (stepped) return 'unsaved';
      if (ran) return 'step-failed';
      return 'unread';
    } finally {
      // [DP] Row DP-1a: once the damaged-path step has run, the learner's memory is built on a fresh record, whatever the
      // write did (a full disk often comes with the damage): the next push must fold the cloud copy in first. The
      // answer may then be `unsaved` or `step-failed`, so the profile enters `freshFor` here, not in the callers.
      if (ran) enterFresh(profileId);
    }
  }
}

/**
 * The storage work of one profile runs one step after another, so a write never passes the read before it. A step
 * for a profile with nothing running starts at once.
 */
const chains = new Map<string, Promise<unknown>>();
function enqueue<T>(profileId: string, job: () => Promise<T>): Promise<T> {
  const before = chains.get(profileId);
  const run = before ? before.then(job) : job();
  const tail: Promise<unknown> = run.catch(() => undefined).then(() => {
    if (chains.get(profileId) === tail) chains.delete(profileId);
  });
  chains.set(profileId, tail);
  return run;
}

/**
 * Profiles with a write waiting for its turn: it stores the snapshot held when it runs, so a second one is not
 * queued. `replace` (a reset) is kept over `merge`.
 */
const writeWaiting = new Map<string, WriteMode>();

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-11 (audit FUNC-1): the stored snapshot this tab last read or wrote, per
 * profile, as the JSON it was stored as (null: nothing was stored). A write compares it with what is stored now: the
 * same means no other tab wrote meanwhile, and this tab's snapshot is stored as it is (so a reset, a sync or a plan
 * reconcile still replaces exactly what it means to). No entry means this tab never read the record: a replacement
 * that lands before the read is final, as it always was (a restore wins over the read still in flight).
 */
const seen = new Map<string, string | null>();

/** `merge`: a write another tab made meanwhile is folded in, never written over. `replace`: a reset, which clears. */
type WriteMode = 'merge' | 'replace';

/** What one write transaction did, for the steps that follow it once the write has landed. */
interface WriteOutcome {
  /** The stored snapshot after the transaction, as JSON (`seen`); `undefined` when the step did not look. */
  stored: string | null | undefined;
  /** A snapshot was stored. */
  wrote: boolean;
  /** Both tabs had written: the cards the award rules added to the union, when memory took it. */
  merged: DerivedAward[] | null;
}

/** The snapshot memory holds from now on; a subscriber that throws never ends the storage transaction. */
function adopt(profileId: string, snapshot: ProgressSnapshot, added: readonly DerivedAward[] = []): void {
  try {
    useProgressStore.setState((s) => ({ byProfile: { ...s.byProfile, [profileId]: snapshot }, ...catchUpAfter(s, profileId, added) }));
  } catch {
    // The snapshot is in the store; only a listener failed.
  }
}

/**
 * [AU] Row AU-11: one write, inside the storage transaction (`withStored`). The stored snapshot is compared with the
 * one this tab last saw (`seen`):
 * - the same, or nothing stored: no other tab wrote, and this tab's snapshot is stored as it is;
 * - changed, and this tab holds nothing new: the other tab's snapshot is taken into memory, nothing is written;
 * - changed on both sides: the two are merged (`mergeWithStored`, the union the sync merge makes: stars never go
 *   down, a card or a finished quest of either tab is kept), latched and reconciled like any merged snapshot, stored,
 *   and memory takes the result.
 * The snapshot is read from memory when the transaction runs, so one transaction stores every write made before it.
 */
function writeStep(profileId: string, mode: WriteMode, out: WriteOutcome): StoredStep {
  return (stored) => {
    out.stored = undefined;
    out.wrote = false;
    out.merged = null;
    const state = useProgressStore.getState();
    // A removed learner, and one whose saved snapshot was not read (row AU-3), are never written.
    if (removedNow(profileId) || !state.hydratedFor.has(profileId)) return undefined;
    const theirs = stored === null ? null : JSON.stringify(stored);
    out.stored = theirs;
    const ours = state.byProfile[profileId];
    if (ours === undefined) {
      // Nothing held here: what another tab stored is what this tab shows.
      if (stored !== null && mode === 'merge') adopt(profileId, stored);
      return undefined;
    }
    const mine = JSON.stringify(ours);
    // What is stored is what this tab holds: nothing to do, whoever wrote it.
    if (mine === theirs) return undefined;
    const base = seen.get(profileId);
    if (stored === null || theirs === base || base === undefined || mode === 'replace') {
      out.stored = mine;
      out.wrote = true;
      return ours;
    }
    if (mine === base) {
      adopt(profileId, stored);
      return undefined;
    }
    const now = new Date();
    const union = mergeWithStored(base === null ? null : (JSON.parse(base) as ProgressSnapshot), ours, stored, { now });
    const { snap, added } = withAwards(profileId, withLatches(union, now));
    const result = JSON.stringify(snap);
    if (result !== mine) {
      adopt(profileId, snap, added);
      out.merged = added;
    }
    out.stored = result;
    if (result === theirs) return undefined;
    out.wrote = true;
    return snap;
  };
}

/**
 * Stores the snapshot the profile holds in memory now, merged with what another tab stored meanwhile (`writeStep`;
 * `withStored`: never over a record that cannot be read), then tells the other tabs. Also how this tab reads a
 * snapshot again after another tab's write: with nothing new here, the transaction only takes theirs.
 */
function writeStored(profileId: string, mode: WriteMode = 'merge'): void {
  const waiting = writeWaiting.get(profileId);
  if (waiting !== undefined) {
    if (mode === 'replace') writeWaiting.set(profileId, mode);
    return;
  }
  const write = async (): Promise<void> => {
    const turn = writeWaiting.get(profileId) ?? mode;
    writeWaiting.delete(profileId);
    const out: WriteOutcome = { stored: undefined, wrote: false, merged: null };
    const outcome = await withStored(profileId, writeStep(profileId, turn, out));
    if ((outcome === 'done' || outcome === 'fresh') && out.stored !== undefined) {
      seen.set(profileId, out.stored);
      if (out.wrote) postProgressChanged();
    }
    afterWrite(profileId, outcome, turn);
    // Memory took the union even when the write did not land (it holds more, never less).
    if (out.merged === null) return;
    // The union holds what the other tab earned: it goes up with the next sync, the cards the rules added to it are
    // announced as a catch-up, and the steady-weeks latch runs as after any merge (F-CURR-002 row CM-17).
    announceCatchUp(profileId, out.merged);
    notifyProgressPersisted(profileId);
    emitGoalEvent({ type: 'merged', profileId });
  };
  if (chains.has(profileId)) writeWaiting.set(profileId, mode);
  void enqueue(profileId, write).catch(() => undefined);
}

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.7 (row DP-2): the waits before the timed retries of a write that did not
 * land, one after each failure in turn. After the last one a write is tried again only when the app comes to the front
 * or goes to the back (`followSaveRetries`) and with each new write.
 */
export const SAVE_RETRY_DELAYS_MS: readonly number[] = [1000, 4000, 15000];

/**
 * [DP] Row DP-2: per profile in `saveFailedFor`, the timed retries already run, the one waiting, if any, and the mode the
 * retries write in: a reset (`replace`) that did not land is retried as a reset, never as a merge that would bring back
 * what another tab stored meanwhile.
 */
const retries = new Map<string, { tried: number; timer: ReturnType<typeof setTimeout> | null; mode: WriteMode }>();

function stopRetries(profileId: string): void {
  const retry = retries.get(profileId);
  if (retry?.timer) clearTimeout(retry.timer);
  retries.delete(profileId);
}

/**
 * [DP] Row DP-2: what a write's answer means for `saveFailedFor`. `unsaved` (the step ran, the storage write rejected)
 * marks the profile and schedules the next timed retry, unless one is already waiting or all three have run; a write
 * that lands (`done` or `fresh`) clears both. `step-failed` neither marks nor clears and schedules nothing: retrying a
 * step that throws would throw again. (The spec logs a step that threw through a shared logger; the app has none yet.)
 * A retry of a marked profile that meets a failed read (`unread`) or the write fence (`fenced`) keeps the mark and
 * schedules the next slot, so "we will try again" stays true.
 */
function afterWrite(profileId: string, outcome: StoredOutcome, mode: WriteMode): void {
  if (outcome === 'done' || outcome === 'fresh') {
    stopRetries(profileId);
    if (useProgressStore.getState().saveFailedFor.has(profileId)) {
      useProgressStore.setState((s) => ({ saveFailedFor: without(s.saveFailedFor, profileId) }));
      trackSaveLanded(profileId);
    }
    return;
  }
  if (outcome === 'step-failed' || removedNow(profileId)) return;
  const marked = useProgressStore.getState().saveFailedFor.has(profileId);
  if (outcome !== 'unsaved' && !marked) return;
  if (!marked) {
    // The first failure of a run starts the timed retries from the first wait.
    stopRetries(profileId);
    useProgressStore.setState((s) => ({ saveFailedFor: new Set([...s.saveFailedFor, profileId]) }));
    trackSaveFailed(profileId);
  } else {
    trackSaveTried(profileId);
  }
  const retry = retries.get(profileId) ?? { tried: 0, timer: null, mode };
  if (mode === 'replace') retry.mode = 'replace';
  retries.set(profileId, retry);
  const delay = SAVE_RETRY_DELAYS_MS[retry.tried];
  if (retry.timer !== null || delay === undefined) return;
  retry.timer = setTimeout(() => {
    retry.timer = null;
    retry.tried += 1;
    // An ordinary write: it stores the snapshot held when it runs, never an older one.
    if (retries.get(profileId) === retry && useProgressStore.getState().saveFailedFor.has(profileId)) writeStored(profileId, retry.mode);
  }, delay);
}

/**
 * [DP] Row DP-2 (section 3.7): each time the app comes to the front, and before it goes to the back (best effort), every
 * profile whose save did not land is written again. Bound once by App.tsx with `platform/app-state`'s
 * `subscribeAppActive` (passed in, so this store never loads `react-native`); returns the unsubscribe. On the web a page
 * back in front also writes every hydrated profile again (`followProgressChanges`): a failed profile is then tried twice in
 * a row (one write runs, one waits), which is harmless.
 */
export function followSaveRetries(subscribeAppActive: (listener: (active: boolean) => void) => () => void): () => void {
  return subscribeAppActive(() => {
    for (const profileId of useProgressStore.getState().saveFailedFor) writeStored(profileId, retries.get(profileId)?.mode ?? 'merge');
  });
}

function save(profileId: string, mode: WriteMode = 'merge'): void {
  if (removedNow(profileId)) return;
  writeStored(profileId, mode);
  notifyProgressPersisted(profileId);
}

/**
 * [AU] Row AU-11: another tab stored a snapshot (`hr-progress`), or this page is back in front: every snapshot this
 * tab has read is read again, inside the same transaction a write uses, so what the other tab earned shows here and
 * nothing unsaved here is lost. Bound once by App.tsx; returns the unsubscribe. A no-op on native (one window).
 */
export function followProgressChanges(): () => void {
  return subscribeProgressChanged(() => {
    for (const profileId of useProgressStore.getState().hydratedFor) writeStored(profileId);
  });
}

/**
 * The latch writers, on the hydrated snapshot only, never on a blank one. They
 * run after each quest result, on hydrate (app start) and when sync or restore
 * hands back a snapshot. The stage latch (F-ROUTE-001 R-1b) adds `stageDoneAt`
 * keys for stages that are complete now, with `flags.myRouteEnabled` off too,
 * so a learner who finishes Stage 1 is latched before any build adds Stage 1
 * quests. The quest latch (F-REPORT-001 section 3.3.1) dates each quest's
 * first finish in `questDoneAt`; on hydrate it is the one-time backfill from
 * `completedAt`. Best effort: neither throws (`latchSnapshot`, `latchQuests`).
 */
function withLatches(snap: ProgressSnapshot, now: Date): ProgressSnapshot {
  return latchSnapshot(latchQuests(snap), episodesAll, now);
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

/**
 * The merged snapshot with the queued word events replayed onto its slice.
 * The pending write's own slice was left out of the merge (it was built on a
 * blank one), so each event lands on the saved state exactly once.
 */
function replayVocab(merged: ProgressSnapshot, queued: readonly PendingVocab[]): ProgressSnapshot {
  const start = vocabOf(merged);
  const vocab = queued.reduce((v, batch) => applyVocabEvents(v, batch.events, new Date(batch.at), { spacing: batch.spacing === true }), start);
  return vocab === start && merged.vocab === undefined ? merged : { ...merged, vocab };
}

/** `snap` without its `vocab` key. */
function withoutVocab(snap: ProgressSnapshot): ProgressSnapshot {
  const { vocab: _dropped, ...rest } = snap;
  return rest;
}

function withoutKey<T>(record: Record<string, T>, id: string): Record<string, T> {
  if (!(id in record)) return record;
  const { [id]: _dropped, ...others } = record;
  return others;
}

/** One storage read per profile at a time: callers that overlap share it. */
const inFlight = new Map<string, Promise<void>>();

function without(ids: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}

/** [DP] Row DP-1a: AU-3 started the profile's damaged record fresh; its next push folds the cloud copy in first. */
function enterFresh(profileId: string): void {
  if (useProgressStore.getState().freshFor.has(profileId)) return;
  useProgressStore.setState((s) => ({ freshFor: new Set([...s.freshFor, profileId]) }));
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
    save(profileId);
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
/**
 * The award world for a learner holding `cards` (F-CURR-002 row CM-23): the upper-cell cards only while `upperCards` is
 * on for them, or once held. The reconcile and Results read it.
 */
export const awardWorldOf = (profileId: string, cards: ProgressSnapshot['cards'] | undefined): AwardWorld =>
  awardWorldFor(upperCardsOnFor(profileId), ownedIdsOf(cards));

function withAwards(profileId: string, snap: ProgressSnapshot): { snap: ProgressSnapshot; added: DerivedAward[] } {
  const profile = useProfileStore.getState().profiles.find((p) => p.id === profileId);
  if (!profile) return { snap, added: [] };
  try {
    // F-CURR-002 row CM-23: the upper-cell cards arrive only while `upperCards` is on for this learner.
    const added = missingAwards(awardWorldOf(profileId, snap.cards), snap, profile);
    if (added.length === 0) return { snap, added };
    return { snap: applyAwards(snap, added, new Date().toISOString()), added };
  } catch {
    return { snap, added: [] };
  }
}

/** The catch-up lists after a reconcile added `added`: only non-welcome cards announce (§3.5). */
function catchUpAfter(s: CatchUpState, profileId: string, added: readonly DerivedAward[]): CatchUpState {
  const ids = added.map((a) => a.cardId);
  if (!ids.some((id) => !WELCOME_CARD_IDS.has(id))) return { catchUp: s.catchUp, catchUpFound: s.catchUpFound };
  return {
    catchUp: { ...s.catchUp, [profileId]: unionIds(s.catchUp[profileId] ?? [], ids) },
    catchUpFound: { ...s.catchUpFound, [profileId]: unionIds(s.catchUpFound[profileId] ?? [], ids) },
  };
}

/** One `card.catchup_granted` per reconcile that added more than the welcome card (§3.5); never a per-card event. */
function announceCatchUp(profileId: string, added: readonly DerivedAward[]): void {
  const payload = catchUpGrantedPayload(added);
  if (payload) void track({ name: 'card.catchup_granted', profileId, payload });
}

/** The profile's catch-up list and its found list go together. */
function withoutCatchUp(s: CatchUpState, profileId: string): CatchUpState {
  return { catchUp: withoutKey(s.catchUp, profileId), catchUpFound: withoutKey(s.catchUpFound, profileId) };
}

/** Union in first-seen order, so a card is never listed twice. */
function unionIds(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])];
}

/** A wholesale replacement (restore, sync, reset) is final: no read still in flight may bring older data back. */
function settle(profileId: string, snapshot: ProgressSnapshot): void {
  // [AU] Row AU-11: a profile this tab never read has no copy to compare the stored record with: the replacement is
  // stored as it is (final, as before), whatever an earlier session of this tab saw.
  if (!useProgressStore.getState().hydratedFor.has(profileId)) seen.delete(profileId);
  useProgressStore.setState((s) => ({
    byProfile: { ...s.byProfile, [profileId]: snapshot },
    hydratedFor: new Set([...s.hydratedFor, profileId]),
    pendingFor: without(s.pendingFor, profileId),
    pendingVocabEvents: withoutKey(s.pendingVocabEvents, profileId),
  }));
}

/** Whether applying vocab events finished a word set: a topic's `sessions` count rose (an ignored event moves none). */
function finishedWordSet(before: VocabProgress, after: VocabProgress): boolean {
  const held = new Map(before.topics.map((t) => [t.topic, t.sessions]));
  return after.topics.some((t) => t.sessions > (held.get(t.topic) ?? 0));
}

/**
 * `snap` with a finished word set's day logged (F-CURR-002 OD-14): a learning
 * session of no length (it adds no minutes, and a grown-up's session count
 * reads quest sessions only) on the local day, and the run kept. A day that
 * already holds a session that keeps the run gains no second one, so a busy
 * day of word sets adds one row to the synced log, not one per set.
 */
function withWordSetDay(snap: ProgressSnapshot, profileId: string, clock: Date): ProgressSnapshot {
  const at = clock.toISOString();
  // With `goals` on, never later than the server's clock carried forward (F-CURR-002 section 13, row CM-17).
  const day = localDay(sessionDayNow(profileId, clock));
  if (snap.sessions.some((s) => keepsRun(s) && sessionDay(s) === day)) return withLocalStreak(snap, day);
  const session = { id: newSessionId(at, 'learn', snap.sessions), profileId, startedAt: at, endedAt: at, durationSeconds: 0, episodesTouched: [], localDay: day };
  return withLocalStreak({ ...snap, sessions: [...snap.sessions, session] }, day);
}

/** `snap` with the session ended now (its elapsed time, capped), or `undefined` when it is not there or already ended. */
function withSessionEnded(snap: ProgressSnapshot, sessionId: string, now: string): { updated: ProgressSnapshot; durationSeconds: number } | undefined {
  const session = snap.sessions.find((s) => s.id === sessionId);
  if (!session || session.endedAt) return undefined;
  const durationSeconds = elapsedSeconds(session.startedAt, now);
  const sessions = snap.sessions.map((s) => (s.id === sessionId ? { ...s, endedAt: now, durationSeconds } : s));
  return { updated: { ...snap, sessions, updatedAt: now }, durationSeconds };
}

export const useProgressStore = create<State & Actions>((set, get) => ({
  byProfile: {},
  hydratedFor: new Set(),
  pendingFor: new Set(),
  catchUp: {},
  catchUpFound: {},
  pendingVocabEvents: {},
  openSession: null,
  loadFailedFor: new Set(),
  freshFor: new Set(),
  saveFailedFor: new Set(),

  hydrate: (profileId) => {
    if (get().hydratedFor.has(profileId)) return Promise.resolve();
    const running = inFlight.get(profileId);
    if (running) return running;
    const load = enqueue(profileId, async () => {
      let after: (() => void) | undefined;
      let loadedJson: string | null | undefined;
      let writtenJson: string | undefined;
      const failure: { cause?: 'read' | 'parse'; kept?: boolean } = {};
      const outcome = await withStored(profileId, (loaded) => {
        // A restore or a reset landed first; this read is stale.
        if (get().hydratedFor.has(profileId)) return undefined;
        const { byProfile, pendingFor, pendingVocabEvents } = get();
        const unsaved = pendingFor.has(profileId) ? byProfile[profileId] : undefined;
        const queued = pendingVocabEvents[profileId];
        const found =
          unsaved && loaded
            ? queued
              ? replayVocab(replayUnsaved(mergeSnapshots(withoutVocab(unsaved), loaded, { now: new Date() }), unsaved), queued)
              : replayUnsaved(mergeSnapshots(unsaved, loaded, { now: new Date() }), unsaved)
            : (unsaved ?? loaded ?? byProfile[profileId]);
        const latched = found ? withLatches(found, new Date()) : found;
        // Reconcile after the merge with the saved copy, never before (F-STORY-006 §3.5).
        const { snap, added } = latched ? withAwards(profileId, latched) : { snap: undefined, added: [] };
        set((s) => ({
          byProfile: snap ? { ...s.byProfile, [profileId]: snap } : s.byProfile,
          hydratedFor: new Set([...s.hydratedFor, profileId]),
          pendingFor: without(s.pendingFor, profileId),
          pendingVocabEvents: withoutKey(s.pendingVocabEvents, profileId),
          loadFailedFor: s.loadFailedFor.has(profileId) ? without(s.loadFailedFor, profileId) : s.loadFailedFor,
          ...catchUpAfter(s, profileId, added),
        }));
        // One write for the pending writes, an added latch and the cards they
        // earned. Cards are saved only onto a record that was read or written:
        // a blank record holding only the welcome card stays in memory until
        // the next real write (nothing is stored for a learner who did nothing).
        const write = snap !== undefined && (unsaved !== undefined || latched !== found || (loaded !== null && added.length > 0)) && !removedNow(profileId);
        // [AU] Row AU-11: the record as it is stored after this transaction, for the next write to compare with.
        loadedJson = loaded === null ? null : JSON.stringify(loaded);
        writtenJson = write ? JSON.stringify(snap) : undefined;
        after = () => {
          announceCatchUp(profileId, added);
          if (write) notifyProgressPersisted(profileId);
        };
        return write ? snap : undefined;
      }, failure);
      if (outcome !== 'unread' && outcome !== 'step-failed' && loadedJson !== undefined) {
        const wrote = (outcome === 'done' || outcome === 'fresh') && writtenJson !== undefined;
        seen.set(profileId, wrote ? (writtenJson as string) : loadedJson);
        if (wrote) postProgressChanged();
      }
      // [DP] Row DP-2: the profile is hydrated and only its merged write did not land: it is tried again like any write.
      if (outcome === 'unsaved' && get().hydratedFor.has(profileId)) afterWrite(profileId, outcome, 'merge');
      // [AU] Row AU-3: a stored record that could not be read (or a damaged one that could not be kept aside) leaves
      // the profile un-hydrated, so nothing is written for it; the writes made meanwhile stay in memory and the next
      // `hydrate` reads again.
      // [DP] Row DP-1a: the set is store state (`loadFailedFor`); a step that threw before the profile was hydrated is
      // treated the same way.
      if ((outcome === 'unread' || outcome === 'step-failed') && !get().hydratedFor.has(profileId) && !get().loadFailedFor.has(profileId)) {
        set((s) => ({ loadFailedFor: new Set([...s.loadFailedFor, profileId]) }));
        // [DP] Row DP-3 (section 3.9): on the way in only, so a re-read that fails again sends nothing. A step that threw
        // on a record that parsed counts as `parse`.
        if (!removedNow(profileId)) trackProgressReadFailed(failure.cause ?? 'parse', failure.kept === true);
      }
      after?.();
    })
      .catch(() => undefined)
      .finally(() => inFlight.delete(profileId));
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
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: snap }, ...catchUpAfter(s, profileId, added) }));
    announceCatchUp(profileId, added);
    return snap;
  },

  recordQuestComplete: (profileId, input) => {
    const hydrated = get().hydratedFor.has(profileId);
    const held = get().byProfile[profileId] ?? blankSnapshot(profileId);
    // A finish held without a latch is dated before this run moves its
    // completedAt (F-REPORT-001 section 3.3.1): a replay never moves the first
    // finish. Before the saved copy loads, `hydrate` latches the merged copy,
    // whose completedAt is the saved (earliest) finish.
    const snap = hydrated ? latchQuests(held) : held;
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
    const updated = hydrated ? withLatches(result, new Date(now)) : result;
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
    // [GU] Section 5.3 (row GU-2): the welcome card comes with the profile record, so a guest is never given one; it
    // arrives with the save (the reconcile after `promoteGuest`).
    const guest = isLiveGuestId(profileId);
    for (const card of cards) {
      if (owned.has(card.cardId) || (guest && WELCOME_CARD_IDS.has(card.cardId))) continue;
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
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: snap }, ...catchUpAfter(s, profileId, added) }));
    persist(profileId, snap);
    announceCatchUp(profileId, added);
    return added;
  },

  recordCatchUp: (profileId, added) => {
    if (added.length === 0) return;
    set((s) => catchUpAfter(s, profileId, added));
    announceCatchUp(profileId, added);
  },

  markCardsSeen: (profileId, cardIds) => {
    const seen = new Set(cardIds);
    const listed = get().catchUp[profileId];
    if (listed) {
      const left = listed.filter((id) => !seen.has(id));
      set((s) => (left.length > 0 ? { catchUp: { ...s.catchUp, [profileId]: left } } : withoutCatchUp(s, profileId)));
    }
    const snap = get().byProfile[profileId];
    if (!snap?.cards.some((c) => c.newSinceLastView && seen.has(c.cardId))) return;
    const now = new Date().toISOString();
    const cards = snap.cards.map((c) => (c.newSinceLastView && seen.has(c.cardId) ? { ...c, newSinceLastView: false } : c));
    const updated: ProgressSnapshot = { ...snap, cards, updatedAt: now };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
  },

  beginSession: (profileId, options) => {
    const open = get().openSession;
    // Join the profile's open session, unless a kind that counts for more begins over it (a quest over a story
    // or a game, a story over a game): it takes over, so the run moves (and session.start is sent for a quest);
    // the earlier holder's own end is then a no-op.
    if (open?.profileId === profileId && !takesOver(open, options)) return null;
    if (open) get().endSession(open.profileId, open.sessionId);
    const snap = get().byProfile[profileId] ?? blankSnapshot(profileId);
    const clock = new Date();
    const now = clock.toISOString();
    const kind = sessionKindOf(options);
    const sessionId = newSessionId(now, kind, snap.sessions);
    // The local day the run is kept on (`sessionDayNow`: capped at the server's clock while `goals` is on).
    const session = { id: sessionId, profileId, startedAt: now, episodesTouched: [], localDay: localDay(sessionDayNow(profileId, clock)) };
    const todayKey = dayKey(now);
    const lastDay = lastStreakDay(snap.sessions);
    // A time-only or learning session (OD-19) leaves the old streak exactly as it is.
    const streakDays = options.streak ? nextStreak(snap.streakDays, lastDay, todayKey) : snap.streakDays;
    const logged: ProgressSnapshot = {
      ...snap,
      sessions: [...snap.sessions, session],
      streakDays,
      updatedAt: now,
    };
    // A quest or a learning session keeps the local-day run (F-CURR-002 OD-14); a game or a level check does not.
    const updated = kind === 'time' ? logged : withLocalStreak(logged, session.localDay);
    set((s) => ({
      byProfile: { ...s.byProfile, [profileId]: updated },
      openSession: { profileId, sessionId, owner: options.owner, streak: options.streak, ...(options.keepsRun ? { keepsRun: true } : {}) },
    }));
    persist(profileId, updated);
    // [GU] GU-D15 (row GU-2): no `session.start` for a guest, so OA's G1 counts profile sessions only.
    if (options.streak && !isLiveGuestId(profileId)) {
      void track({
        name: 'session.start',
        profileId,
        payload: { streakDays, isNewDay: lastDay !== todayKey },
      });
    }
    return sessionId;
  },

  endSession: (profileId, sessionId) => {
    const open = get().openSession;
    if (open?.profileId !== profileId || open.sessionId !== sessionId) return;
    set({ openSession: null });
    const snap = get().byProfile[profileId];
    if (!snap) return;
    const ended = withSessionEnded(snap, sessionId, new Date().toISOString());
    if (!ended) return;
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: ended.updated } }));
    persist(profileId, ended.updated);
    if (open.streak) {
      void track({
        name: 'session.end',
        profileId,
        payload: { durationSeconds: ended.durationSeconds, streakDays: snap.streakDays },
      });
    }
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

  recordReview: (profileId, entry) => {
    const parsed = ReviewEntrySchema.safeParse(entry);
    if (!parsed.success) return false;
    const snap = withSnapshotDefaults(get().byProfile[profileId] ?? blankSnapshot(profileId));
    const kept = snap.reviews.find((r) => r.id === parsed.data.id);
    // `daily` entries are kept for 14 local days (F-CURR-002 section 4.8), as the merge and the Worker keep them; a pulled
    // entry dated past the latest local day of now (a clock far ahead) never prunes the one just written (section 13).
    const now = new Date();
    const reviews = pruneDailyReviews(kept ? snap.reviews.map((r) => (r.id === parsed.data.id ? mergeReview(r, parsed.data) : r)) : [...snap.reviews, parsed.data], {
      latestDay: latestLocalDay(now),
    });
    // A warm-up or Try these again day is kept for 14 local days (F-CURR-002 section 4.8, row CM-15).
    const updated: ProgressSnapshot = { ...snap, reviews: [...pruneReviews(reviews, latestLocalDay(now))], updatedAt: now.toISOString() };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
    return true;
  },

  applyPlacementOverride: (profileId, resultId, startQuestId) => {
    const snap = get().byProfile[profileId];
    const placements = snap?.placements ?? [];
    if (snap === undefined || startQuestId === '' || !placements.some((r) => r.id === resultId)) return false;
    const at = new Date().toISOString();
    const updated: ProgressSnapshot = {
      ...snap,
      placements: placements.map((r) => (r.id === resultId ? { ...r, override: { by: 'parent', at, startQuestId } } : r)),
      updatedAt: at,
    };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
    return true;
  },

  reset: (profileId) => {
    // A profile that ever held word progress gets the empty slice, not an
    // absent key: the Worker keeps a stored slice when the key is absent
    // (F-VOC-005 section 3.10), which would bring the old words back.
    const heldVocab = get().byProfile[profileId]?.vocab !== undefined || profileId in get().pendingVocabEvents;
    const fresh = heldVocab ? { ...blankSnapshot(profileId), vocab: emptyVocab() } : blankSnapshot(profileId);
    settle(profileId, fresh);
    // The open session went with the old record: its owner's end is now a no-op.
    set((s) => ({ ...withoutCatchUp(s, profileId), openSession: s.openSession?.profileId === profileId ? null : s.openSession }));
    // [AU] Row AU-11: a reset clears; it is the one write that is not merged with what is stored.
    save(profileId, 'replace');
  },

  replaceSnapshot: (profileId, snapshot) => {
    // [OA] A plan derivation or sync that lands after the learner was removed changes nothing (row OA-7a).
    if (removedNow(profileId)) return;
    // [AU] Row AU-3: the stored record could not be read, so a replacement is not final here: it is held like any
    // write made before the saved copy loaded, and the next read merges the two (nothing is written until then).
    if (get().loadFailedFor.has(profileId) && !get().hydratedFor.has(profileId)) {
      set((s) => ({ byProfile: { ...s.byProfile, [profileId]: snapshot } }));
      persist(profileId, snapshot);
      return;
    }
    // Every sync, restore and plan derivation lands here. A completion that
    // arrived by sync or restore is latched now, not at the next cold start,
    // and the cards it earned are reconciled after the merge (F-STORY-006
    // §3.5). Only an added latch or card is announced, so it uploads.
    const latched = withLatches(snapshot, new Date());
    const { snap, added } = withAwards(profileId, latched);
    settle(profileId, snap);
    if (added.length > 0) set((s) => catchUpAfter(s, profileId, added));
    announceCatchUp(profileId, added);
    writeStored(profileId);
    if (snap !== snapshot) notifyProgressPersisted(profileId);
    // The steady-weeks latch runs after every merge (F-CURR-002 row CM-17).
    emitGoalEvent({ type: 'merged', profileId });
  },

  whenWritten: (profileId) =>
    (chains.get(profileId) ?? Promise.resolve()).then(
      () => undefined,
      () => undefined,
    ),

  clearFresh: (profileId) => {
    if (!get().freshFor.has(profileId)) return;
    set((s) => ({ freshFor: without(s.freshFor, profileId) }));
  },

  setSelfRoute: (profileId, route) => {
    const parsed = SelfRouteSchema.safeParse(route);
    if (!parsed.success) return false;
    const snap = withSnapshotDefaults(get().byProfile[profileId] ?? blankSnapshot(profileId));
    const updated: ProgressSnapshot = { ...snap, selfRoute: parsed.data, updatedAt: new Date().toISOString() };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
    return true;
  },

  setPracticeDays: (profileId, entry, livePlanIds) => {
    const parsed = PracticeDaysEntrySchema.safeParse(entry);
    if (!parsed.success) return false;
    const snap = withSnapshotDefaults(get().byProfile[profileId] ?? blankSnapshot(profileId));
    const updated: ProgressSnapshot = { ...snap, practiceDays: practiceDaysWrite(snap.practiceDays, parsed.data, livePlanIds), updatedAt: new Date().toISOString() };
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    persist(profileId, updated);
    return true;
  },

  recordVocab: (profileId, events, now = new Date()) => {
    const clock = Number.isFinite(now.getTime()) ? now : new Date();
    const snap = get().byProfile[profileId] ?? blankSnapshot(profileId);
    const current = vocabOf(snap);
    const spacing = vocabRecordHook?.spacing(profileId) === true;
    const vocab = applyVocabEvents(current, events, clock, { spacing });
    if (vocab === current) return;
    const at = clock.toISOString();
    const withVocab: ProgressSnapshot = { ...snap, vocab, updatedAt: at };
    // A finished word set (its `session` event) is a learning activity: it keeps the local-day run (F-CURR-002
    // OD-14). It is logged as a learning session of no length, so the day is on the record every device reads.
    const wordSet = finishedWordSet(current, vocab);
    const updated = wordSet ? withWordSetDay(withVocab, profileId, clock) : withVocab;
    const hydrated = get().hydratedFor.has(profileId);
    set((s) => ({
      byProfile: { ...s.byProfile, [profileId]: updated },
      pendingVocabEvents: hydrated
        ? s.pendingVocabEvents
        : { ...s.pendingVocabEvents, [profileId]: [...(s.pendingVocabEvents[profileId] ?? []), { events, at: clock.toISOString(), ...(spacing ? { spacing } : {}) }] },
    }));
    persist(profileId, updated);
    if (hydrated && vocabRecordHook) {
      try {
        vocabRecordHook.recorded(profileId, current, events, clock, spacing);
      } catch {
        // The word write is saved; only the day's memory counts miss it.
      }
    }
    // A finished word set earns its daily-goal point (F-CURR-002 section 7.4, row CM-17).
    if (wordSet) emitGoalEvent({ type: 'activity', profileId, kind: 'wordSet' });
  },

  applyGoalWrite: (profileId, update) => {
    if (!get().hydratedFor.has(profileId) || removedNow(profileId)) return false;
    const snap = get().byProfile[profileId] ?? blankSnapshot(profileId);
    const updated = update(snap);
    if (updated === snap) return true;
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: updated } }));
    save(profileId);
    return true;
  },
}));

// A removed profile's catch-up list goes with it (F-STORY-006 §3.5); [OA] row OA-7a: and its snapshot, in memory and
// stored (section 10.4, CS-20).
onProfileRemoved((profileId) => {
  removedHere.add(profileId);
  useProgressStore.setState((s) => ({
    ...withoutCatchUp(s, profileId),
    byProfile: withoutKey(s.byProfile, profileId),
    hydratedFor: without(s.hydratedFor, profileId),
    pendingFor: without(s.pendingFor, profileId),
    pendingVocabEvents: withoutKey(s.pendingVocabEvents, profileId),
    loadFailedFor: without(s.loadFailedFor, profileId),
    freshFor: without(s.freshFor, profileId),
    saveFailedFor: without(s.saveFailedFor, profileId),
  }));
  seen.delete(profileId);
  writeWaiting.delete(profileId);
  stopRetries(profileId);
  removeKey(key(profileId)).catch(() => undefined);
  // [AU] Row AU-3: the copy of a damaged record goes with the learner.
  removeKey(PROGRESS_CORRUPT_KEY(profileId)).catch(() => undefined);
});

