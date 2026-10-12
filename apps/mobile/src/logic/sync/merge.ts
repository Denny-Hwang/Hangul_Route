import {
  PLACEMENT_KEEP,
  type CardCollectionEntry,
  type EpisodeProgress,
  type HomeworkAssignment,
  type PlacementResult,
  type ProgressSnapshot,
  type QuestProgress,
  type ReviewEntry,
  type SelfRoute,
  type SessionLog,
  type VocabItemState,
  type VocabProgress,
  type VocabTopicProgress,
} from '@hangul-route/content-schema';
import { computeStreak } from '../streak';
import { codePoint, validVocab } from '../vocab/progress';

/**
 * Deterministic snapshot merge — F-SYNC-001 §3.3. Every collection in a
 * snapshot only ever grows, so a set union with per-field tie-breaks is
 * enough; no clock skew can lose a card or a star.
 */

function earliest(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function latest(a: string, b: string): string {
  return a > b ? a : b;
}

/** Union by key, output sorted by key so merge order never changes the result. */
function unionBy<T>(local: readonly T[], server: readonly T[], keyOf: (t: T) => string, pick: (l: T, s: T) => T): T[] {
  const out = new Map<string, T>();
  for (const item of local) out.set(keyOf(item), item);
  for (const item of server) {
    const key = keyOf(item);
    const existing = out.get(key);
    out.set(key, existing ? pick(existing, item) : item);
  }
  return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

export function mergeQuest(l: QuestProgress, s: QuestProgress): QuestProgress {
  const winner = l.stars !== s.stars ? (l.stars > s.stars ? l : s) : l.accuracy >= s.accuracy ? l : s;
  return {
    ...winner,
    attempts: l.attempts + s.attempts,
    startedAt: earliest(l.startedAt, s.startedAt) ?? winner.startedAt,
    completedAt: earliest(l.completedAt, s.completedAt),
  };
}

export function mergeEpisode(l: EpisodeProgress, s: EpisodeProgress): EpisodeProgress {
  return {
    episodeId: l.episodeId,
    startedAt: earliest(l.startedAt, s.startedAt) ?? l.startedAt,
    completedAt: earliest(l.completedAt, s.completedAt),
    questsCompleted: Math.max(l.questsCompleted, s.questsCompleted),
    totalQuests: Math.max(l.totalQuests, s.totalQuests),
  };
}

/**
 * One card held on both sides (F-STORY-006 §3.6): the earliest unlock time
 * (M2), and "seen anywhere = seen" (M3) — the card is new only while neither
 * device has shown it. Both rules are symmetric, so merge order never changes
 * the result (M4).
 */
export function mergeCard(l: CardCollectionEntry, s: CardCollectionEntry): CardCollectionEntry {
  return {
    cardId: l.cardId,
    unlockedAt: earliest(l.unlockedAt, s.unlockedAt) ?? l.unlockedAt,
    newSinceLastView: l.newSinceLastView && s.newSinceLastView,
  };
}

export function mergeHomework(l: HomeworkAssignment, s: HomeworkAssignment): HomeworkAssignment {
  const completedAt = earliest(l.completedAt, s.completedAt);
  return { ...(l.completedAt ? l : s.completedAt ? s : l), completedAt };
}

export function mergeReview(l: ReviewEntry, s: ReviewEntry): ReviewEntry {
  const ls = l.resultStars ?? -1;
  const ss = s.resultStars ?? -1;
  return ls >= ss ? l : s;
}

/**
 * The earlier of two latch times as instants (`Date.parse`), so an offset form
 * and a UTC form compare correctly. A value that does not parse never beats one
 * that does; two unparseable values (or a tie) fall back to the string order,
 * so the result never depends on argument order. The Worker applies the same
 * rule (packages/backend/src/lib/additive-fields.ts `earlierLatchTime`).
 */
export function earlierLatchTime(a: string, b: string): string {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  const fa = Number.isFinite(ta);
  const fb = Number.isFinite(tb);
  if (fa && fb && ta !== tb) return ta < tb ? a : b;
  if (fa !== fb) return fa ? a : b;
  return a <= b ? a : b;
}

/**
 * Stage latch (F-ROUTE-001 section 3.15): key union, earliest time wins, so an
 * earned "Complete" is never removed. `undefined` when neither side holds a
 * latch, so a snapshot that predates the key keeps its shape. The writer
 * (R-1b) stores `new Date().toISOString()` and only ever adds keys to the
 * hydrated snapshot; it never builds a fresh record.
 */
export function mergeStageDoneAt(
  l: Readonly<Record<string, string>> | undefined,
  s: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  const out = new Map<string, string>();
  for (const side of [l ?? {}, s ?? {}]) {
    for (const [stage, at] of Object.entries(side)) {
      const prev = out.get(stage);
      out.set(stage, prev === undefined ? at : earlierLatchTime(prev, at));
    }
  }
  return out.size === 0 ? undefined : Object.fromEntries([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Orders two ISO timestamps as instants (an offset and `Z`, with or without
 * milliseconds, compare by the moment they name), like `earlierLatchTime`.
 * An unparsable side sorts first; equal instants and unparsable pairs fall
 * back to code-point order, so the order is the same on every engine.
 */
export function compareInstant(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  const fa = Number.isFinite(ta);
  const fb = Number.isFinite(tb);
  if (fa && fb && ta !== tb) return ta < tb ? -1 : 1;
  if (fa !== fb) return fa ? 1 : -1;
  return codePointCompare(a, b);
}

/** Plain code-point order (never locale collation, which ignores '-' under ICU). */
const codePointCompare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Local copies carry no zod defaults (F-PLC-001 section 3.8): the progress store
 * reads its own snapshot without parsing, so a snapshot saved before an
 * additive key existed lacks it at runtime. Only `recordPlacement` applies
 * this: `hydrate` and `replaceSnapshot` keep a stored snapshot's shape (the P-2
 * rule, pinned by a progress-store test), and every reader treats a missing
 * `placements` as `[]` and a missing `selfRoute` (F-PLAN-002 section 3.5) as
 * null. A server copy always carries both keys (the Worker stores the
 * zod-parsed payload), so `mergeSnapshots` writes them on the first sync.
 * F-VOC-005 P-3 adds its key here.
 */
export function withSnapshotDefaults(
  snapshot: ProgressSnapshot,
): ProgressSnapshot & { placements: PlacementResult[]; selfRoute: SelfRoute | null } {
  if (snapshot.placements !== undefined && snapshot.selfRoute !== undefined) {
    return snapshot as ProgressSnapshot & { placements: PlacementResult[]; selfRoute: SelfRoute | null };
  }
  return { ...snapshot, placements: snapshot.placements ?? [], selfRoute: snapshot.selfRoute ?? null };
}

/**
 * The learner's weekly plan on both sides (F-PLAN-002 section 3.5): the newest
 * `updatedAt` as an instant wins, a tie keeps the local copy. A missing or
 * null side never replaces a held route: a stopped route is archived, never
 * set to null, so null only means "this copy has none".
 */
export function mergeSelfRoute(l: SelfRoute | null | undefined, s: SelfRoute | null | undefined): SelfRoute | null {
  if (!l) return s ?? null;
  if (!s) return l;
  return compareInstant(s.updatedAt, l.updatedAt) > 0 ? s : l;
}

/**
 * Same id on both sides: the copy carrying a parent override wins (the later
 * `override.at` when both do), otherwise the local copy.
 */
export function mergePlacement(l: PlacementResult, s: PlacementResult): PlacementResult {
  if (l.override === undefined) return s.override === undefined ? l : s;
  if (s.override === undefined) return l;
  return compareInstant(s.override.at, l.override.at) > 0 ? s : l;
}

/** Union by id, oldest first, newest `PLACEMENT_KEEP` kept. A missing list is `[]`. */
export function mergePlacements(
  l: readonly PlacementResult[] | undefined,
  s: readonly PlacementResult[] | undefined,
): PlacementResult[] {
  return unionBy(l ?? [], s ?? [], (r) => r.id, mergePlacement)
    .sort((a, b) => compareInstant(a.completedAt, b.completedAt) || codePointCompare(a.id, b.id))
    .slice(-PLACEMENT_KEEP);
}

/** Order of two due days for the schedule tie-break: `null` (not scheduled) is earliest. */
function compareDue(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return codePoint(a, b);
}

/**
 * The side whose schedule (`box`, `due`, `at`) wins (F-VOC-005 section 3.3):
 * the later `at` as an instant, then the higher box, then the later due. A full
 * tie means the two triples are equal, and `a` is returned.
 */
function scheduleWinner(a: VocabItemState, b: VocabItemState): VocabItemState {
  const byAt = compareInstant(a.at, b.at);
  if (byAt !== 0) return byAt > 0 ? a : b;
  if (a.box !== b.box) return a.box > b.box ? a : b;
  return compareDue(a.due, b.due) >= 0 ? a : b;
}

/**
 * One word held on both sides: every learner-visible field at its best (`first`
 * the earliest, the rest the largest) and the schedule from `scheduleWinner`,
 * so a box that fell on one device never shows as a loss (P2).
 */
export function mergeVocabItem(l: VocabItemState, s: VocabItemState): VocabItemState {
  const w = scheduleWinner(l, s);
  const seen = Math.max(l.seen, s.seen);
  return {
    id: l.id,
    first: l.first < s.first ? l.first : s.first,
    seen,
    right: Math.min(Math.max(l.right, s.right), seen),
    bestBox: Math.max(l.bestBox, s.bestBox, w.box),
    last: l.last > s.last ? l.last : s.last,
    box: w.box,
    due: w.due,
    at: w.at,
  };
}

export function mergeVocabTopic(l: VocabTopicProgress, s: VocabTopicProgress): VocabTopicProgress {
  return {
    topic: l.topic,
    bestStars: Math.max(l.bestStars, s.bestStars),
    sessions: Math.max(l.sessions, s.sessions),
    last: l.last > s.last ? l.last : s.last,
    bestCaught: Math.max(l.bestCaught, s.bestCaught),
  };
}

/**
 * The word progress slice on both sides (F-VOC-005 section 3.3): union by word
 * and by topic, sorted in code-point order like the reducer's output.
 * Commutative, associative and idempotent. A side that is absent, or fails the
 * schema (section 3.10), counts as none; `undefined` when neither has one, so
 * `mergeSnapshots` omits the key.
 */
export function mergeVocab(local: VocabProgress | undefined, server: VocabProgress | undefined): VocabProgress | undefined {
  const l = validVocab(local);
  const s = validVocab(server);
  if (!l) return s;
  if (!s) return l;
  return {
    v: 1,
    items: unionBy(l.items, s.items, (x) => x.id, mergeVocabItem).sort((a, b) => codePoint(a.id, b.id)),
    topics: unionBy(l.topics, s.topics, (x) => x.topic, mergeVocabTopic).sort((a, b) => codePoint(a.topic, b.topic)),
  };
}

/**
 * True when the server slice already holds everything in the local one: each
 * word with a schedule that wins or ties and every other field at least as
 * good, and each topic likewise. No local slice is always held.
 */
function vocabCovered(local: VocabProgress | undefined, server: VocabProgress | undefined): boolean {
  const l = validVocab(local);
  if (!l) return true;
  const s = validVocab(server);
  if (!s) return false;
  const words = new Map(s.items.map((x) => [x.id, x]));
  const topics = new Map(s.topics.map((x) => [x.topic, x]));
  return (
    l.items.every((x) => {
      const t = words.get(x.id);
      return (
        t !== undefined &&
        scheduleWinner(t, x) === t &&
        t.bestBox >= x.bestBox &&
        t.seen >= x.seen &&
        t.right >= x.right &&
        t.first <= x.first &&
        t.last >= x.last
      );
    }) &&
    l.topics.every((x) => {
      const t = topics.get(x.topic);
      return t !== undefined && t.bestStars >= x.bestStars && t.sessions >= x.sessions && t.last >= x.last && t.bestCaught >= x.bestCaught;
    })
  );
}

export interface MergeOptions {
  /** Clock for the streak recomputation; injected for determinism. */
  now: Date;
}

export function mergeSnapshots(local: ProgressSnapshot, server: ProgressSnapshot, opts: MergeOptions): ProgressSnapshot {
  const stageDoneAt = mergeStageDoneAt(local.stageDoneAt, server.stageDoneAt);
  const vocab = mergeVocab(local.vocab, server.vocab);
  const sessions = unionBy<SessionLog>(local.sessions, server.sessions, (x) => x.id, (l) => l).sort(
    (a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
  );
  return {
    profileId: local.profileId,
    updatedAt: latest(local.updatedAt, server.updatedAt),
    quests: unionBy(local.quests, server.quests, (q) => q.questId, mergeQuest),
    episodes: unionBy(local.episodes, server.episodes, (e) => e.episodeId, mergeEpisode),
    cards: unionBy(local.cards, server.cards, (c) => c.cardId, mergeCard),
    sessions,
    homework: unionBy(local.homework, server.homework, (h) => h.id, mergeHomework),
    reviews: unionBy(local.reviews, server.reviews, (r) => r.id, mergeReview),
    streakDays: computeStreak(
      sessions.map((s) => s.startedAt),
      opts.now,
    ),
    ...(stageDoneAt ? { stageDoneAt } : {}),
    // A snapshot that predates the key keeps its shape when neither side has one.
    ...(local.placements !== undefined || server.placements !== undefined
      ? { placements: mergePlacements(local.placements, server.placements) }
      : {}),
    ...(local.selfRoute !== undefined || server.selfRoute !== undefined
      ? { selfRoute: mergeSelfRoute(local.selfRoute, server.selfRoute) }
      : {}),
    // Word progress (F-VOC-005): omitted when neither side has a slice.
    ...(vocab !== undefined ? { vocab } : {}),
  };
}

/**
 * Fold a server answer into a copy that changed while the request was in
 * flight (issue #262). `base` is the snapshot that went up, `theirs` the one
 * that came back (it already holds `base`), and `ours` is `base` plus the
 * writes made since. Every collection only grows, so `mergeSnapshots` keeps
 * both sides; only quest `attempts` is a sum, so the attempts `base` already
 * gave `theirs` are taken out of `ours` first and each attempt counts once.
 * A quest finished during the request keeps its new `completedAt` (the
 * later one): `mergeQuest` keeps the earliest date between devices, but a
 * local replay moves it forward (`recordBestQuest`), and Home's "done today"
 * and the replay window read it.
 */
export function rebaseSnapshot(base: ProgressSnapshot, ours: ProgressSnapshot, theirs: ProgressSnapshot, opts: MergeOptions): ProgressSnapshot {
  const counted = new Map(base.quests.map((q) => [q.questId, q.attempts]));
  const sentDone = new Map(base.quests.map((q) => [q.questId, q.completedAt]));
  const held = new Set(theirs.quests.map((q) => q.questId));
  const quests = ours.quests.map((q) => {
    const already = held.has(q.questId) ? (counted.get(q.questId) ?? 0) : 0;
    return already === 0 ? q : { ...q, attempts: Math.max(0, q.attempts - already) };
  });
  // Quests whose completedAt this device moved forward while the request was in flight.
  const finished = new Map<string, string>();
  for (const q of ours.quests) {
    const before = sentDone.get(q.questId);
    if (q.completedAt && (!before || compareInstant(q.completedAt, before) > 0)) finished.set(q.questId, q.completedAt);
  }
  const merged = mergeSnapshots({ ...ours, quests }, theirs, opts);
  if (finished.size === 0) return merged;
  return {
    ...merged,
    quests: merged.quests.map((q) => {
      const mine = finished.get(q.questId);
      if (!mine || (q.completedAt && compareInstant(q.completedAt, mine) >= 0)) return q;
      return { ...q, completedAt: mine };
    }),
  };
}

/**
 * True when nothing in `local` is missing from `server` (upload not needed).
 * A card this device has seen counts as held only when the server copy is
 * seen too (F-STORY-006 section 3.6 M3), so a cleared "New" flag still uploads.
 * Word progress counts as held when the server would gain nothing by merging
 * it (F-VOC-005 section 3.3, `vocabCovered`).
 */
export function isSubsetOf(local: ProgressSnapshot, server: ProgressSnapshot): boolean {
  const has = <T>(arr: readonly T[], key: (t: T) => string) => new Set(arr.map(key));
  const q = has(server.quests, (x) => `${x.questId}:${x.stars}`);
  const c = has(server.cards, (x) => `${x.cardId}:${x.newSinceLastView ? 'new' : 'seen'}`);
  const cardHeld = (x: CardCollectionEntry): boolean => c.has(`${x.cardId}:seen`) || (x.newSinceLastView && c.has(`${x.cardId}:new`));
  const s = has(server.sessions, (x) => x.id);
  // A placement is held when the server has its id with the same or a newer override.
  const placed = new Map((server.placements ?? []).map((x) => [x.id, x]));
  const holdsPlacement = (x: PlacementResult): boolean => {
    const theirs = placed.get(x.id);
    if (theirs === undefined) return false;
    if (x.override === undefined) return true;
    return theirs.override !== undefined && compareInstant(theirs.override.at, x.override.at) >= 0;
  };
  // A latch counts as held when the server has the stage at the same or an earlier time.
  const latched = new Map(Object.entries(server.stageDoneAt ?? {}));
  const holds = (stage: string, at: string): boolean => {
    const theirs = latched.get(stage);
    return theirs !== undefined && earlierLatchTime(theirs, at) === theirs;
  };
  // The weekly plan is held when the server has the same route at the same or a newer edit.
  const route = local.selfRoute ?? null;
  const theirRoute = server.selfRoute ?? null;
  const holdsRoute = route === null || (theirRoute !== null && theirRoute.id === route.id && compareInstant(theirRoute.updatedAt, route.updatedAt) >= 0);
  return (
    holdsRoute &&
    vocabCovered(local.vocab, server.vocab) &&
    local.quests.every((x) => q.has(`${x.questId}:${x.stars}`)) &&
    local.cards.every(cardHeld) &&
    local.sessions.every((x) => s.has(x.id)) &&
    (local.placements ?? []).every(holdsPlacement) &&
    Object.entries(local.stageDoneAt ?? {}).every(([stage, at]) => holds(stage, at))
  );
}
