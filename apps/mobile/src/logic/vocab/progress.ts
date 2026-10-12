import {
  VocabIdSchema,
  VocabProgressSchema,
  type VocabItemState,
  type VocabProgress,
  type VocabTopicProgress,
} from '@hangul-route/content-schema';
import { MIN_BOX, addDays, onHinted, onRight, onSelf, onWrong, type Schedule } from './srs';

/**
 * Word progress events and the pure reducer — F-VOC-005 section 3.2.
 *
 * Screens (flashcards, Speed Round, the Daily Test) describe what happened as
 * events; `applyVocabEvents` folds them into the snapshot's `vocab` slice. It
 * never throws: an event with a malformed id or topic key is ignored. The
 * output arrays are sorted by key so the result is deterministic and the
 * merge (`logic/sync/merge.ts` `mergeVocab`) is order-free.
 */

export { BOX_DAYS, addDays } from './srs';

export type VocabEvent =
  | { type: 'introduced'; id: string }
  | { type: 'self'; id: string; known: boolean }
  | {
      type: 'answer';
      id: string;
      correct: boolean;
      hinted?: boolean;
      /** Accepted and ignored by the reducer (telemetry only). */
      format?: string;
      source: 'cards' | 'speed' | 'match' | 'review';
      /** Accepted and ignored: response time never changes the schedule (P3). */
      ms?: number;
    }
  | {
      type: 'session';
      topicKey: string;
      kind: 'cards' | 'speed' | 'match';
      stars?: 1 | 2 | 3;
      caught?: number;
      mode?: 'relaxed' | 'challenge';
      /** Accepted and ignored (F-VOC-004 section 3.6 sends it; telemetry reads it). */
      endedBy?: 'questions' | 'clock';
    };

/** The schema caps (`VocabProgressSchema`): the reducer never grows past them, so a full slice cannot make every later upload a 422. */
export const VOCAB_MAX_ITEMS = 1000;
export const VOCAB_MAX_TOPICS = 100;

/** How far past the latest schedule stamp in the slice a new stamp may be (section 3.3, clock skew). */
const CLAMP_MS = 24 * 60 * 60 * 1000;

const TOPIC_KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The shape `AtSchema` accepts for `toISOString()` output (four-digit years only). */
const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T/;

export function emptyVocab(): VocabProgress {
  return { v: 1, items: [], topics: [] };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** `YYYY-MM-DD` in the device's local time zone (P5), not the UTC prefix of an ISO string. */
export function localDay(now: Date): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** Slices already checked, so a reader on every render parses each stored slice once. */
const checked = new WeakMap<object, boolean>();

function isValidSlice(v: unknown): v is VocabProgress {
  if (typeof v !== 'object' || v === null) return false;
  let ok = checked.get(v);
  if (ok === undefined) {
    ok = VocabProgressSchema.safeParse(v).success;
    checked.set(v, ok);
  }
  return ok;
}

/**
 * The slice when it is valid, otherwise `undefined`: a stored slice that fails
 * the schema (corrupt, or written by a newer version) is treated as absent
 * (section 3.10) and the next write rebuilds it from events.
 */
export function validVocab(v: unknown): VocabProgress | undefined {
  return isValidSlice(v) ? v : undefined;
}

/** The learner's slice, or the empty slice when it is absent or unreadable. */
export function vocabOf(snapshot: { vocab?: VocabProgress }): VocabProgress {
  return validVocab(snapshot.vocab) ?? emptyVocab();
}

/** Plain code-point order (never locale collation, which ignores '-' under ICU): the slice's sort order. */
export const codePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The latest schedule stamp in the slice as epoch ms, or null when there is none. */
function latestStamp(items: readonly VocabItemState[]): number | null {
  let latest: number | null = null;
  for (const s of items) {
    const t = Date.parse(s.at);
    if (Number.isFinite(t) && (latest === null || t > latest)) latest = t;
  }
  return latest;
}

/** A star count from a session that the schema can hold, else 0. */
function starsOf(stars: unknown): number {
  return stars === 1 || stars === 2 || stars === 3 ? stars : 0;
}

/** A caught count that is a non-negative integer, else 0. */
function caughtOf(caught: unknown): number {
  return typeof caught === 'number' && Number.isInteger(caught) && caught >= 0 ? caught : 0;
}

/**
 * Fold `events` into `v` in order. `today` is the device's local day of `now`;
 * the schedule stamp `at` is `now`, clamped to at most 24 hours past the
 * latest stamp already in the slice, so one device with a wrong clock cannot
 * make its schedule win every merge for years. The calendar day is never
 * clamped: a learner back after a week is scheduled from today (skipped days
 * are invisible, section 3.4).
 *
 * Returns `v` itself when nothing changed (no events, all ignored, or an
 * invalid clock), so a caller can skip the write.
 */
export function applyVocabEvents(v: VocabProgress, events: readonly VocabEvent[], now: Date): VocabProgress {
  const nowMs = now.getTime();
  if (events.length === 0 || !Number.isFinite(nowMs)) return v;
  const latest = latestStamp(v.items);
  const stampMs = latest !== null && nowMs > latest + CLAMP_MS ? latest + CLAMP_MS : nowMs;
  const at = new Date(stampMs).toISOString();
  const today = localDay(now);
  if (!ISO_STAMP.test(at) || !/^\d{4}-/.test(today)) return v;

  const items = new Map(v.items.map((s) => [s.id, s]));
  const topics = new Map(v.topics.map((t) => [t.topic, t]));
  let changed = false;

  /** The word's state, created as `introduced` would when it has none (or null at the cap). */
  const ensure = (id: string): VocabItemState | null => {
    const held = items.get(id);
    if (held) return held;
    if (items.size >= VOCAB_MAX_ITEMS) return null;
    const created: VocabItemState = { id, first: today, seen: 0, right: 0, bestBox: MIN_BOX, last: today, box: MIN_BOX, due: addDays(today, 1), at };
    items.set(id, created);
    changed = true;
    return created;
  };

  const reschedule = (s: VocabItemState, next: Schedule, counts: Partial<Pick<VocabItemState, 'seen' | 'right' | 'last'>>): void => {
    items.set(s.id, { ...s, ...counts, box: next.box, bestBox: next.bestBox, due: next.due, at });
    changed = true;
  };

  for (const e of events) {
    if (e.type === 'session') {
      if (typeof e.topicKey !== 'string' || !TOPIC_KEY.test(e.topicKey)) continue;
      const held = topics.get(e.topicKey);
      if (!held && topics.size >= VOCAB_MAX_TOPICS) continue;
      const base: VocabTopicProgress = held ?? { topic: e.topicKey, bestStars: 0, sessions: 0, last: today, bestCaught: 0 };
      topics.set(e.topicKey, {
        ...base,
        sessions: base.sessions + 1,
        last: today > base.last ? today : base.last,
        bestStars: Math.max(base.bestStars, starsOf(e.stars)),
        bestCaught: e.mode === 'challenge' ? Math.max(base.bestCaught, caughtOf(e.caught)) : base.bestCaught,
      });
      changed = true;
      continue;
    }
    if (e.type !== 'introduced' && e.type !== 'self' && e.type !== 'answer') continue;
    if (!VocabIdSchema.safeParse(e.id).success) continue;
    const s = ensure(e.id);
    if (s === null || e.type === 'introduced') continue;
    if (e.type === 'self') {
      const next = onSelf(s, e.known, today);
      if (next !== s) reschedule(s, next, {});
      continue;
    }
    const last = today > s.last ? today : s.last;
    if (!e.correct) reschedule(s, onWrong(s, today), { seen: s.seen + 1, last });
    else if (e.hinted) reschedule(s, onHinted(s, today), { seen: s.seen + 1, last });
    else reschedule(s, onRight(s, today), { seen: s.seen + 1, right: s.right + 1, last });
  }

  if (!changed) return v;
  return {
    v: 1,
    items: [...items.values()].sort((a, b) => codePoint(a.id, b.id)),
    topics: [...topics.values()].sort((a, b) => codePoint(a.topic, b.topic)),
  };
}
