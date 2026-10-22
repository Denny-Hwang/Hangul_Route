import type { ReviewEntry } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { MemoryAnswer } from '../memory/memory-runtime';
import {
  DAILY_REVIEW_DUE_CAP,
  KEEP_GOING_ROUNDS_PER_DAY,
  buildDailyReview,
  buildKeepGoing,
  dueCount,
  reviewFirst,
  type DayReviewLog,
  type EngineContext,
  type EngineStates,
  type ReviewSession,
} from './engine';
import { roundFor, type ReviewRound, type RoundInput } from './review-rounds';
import { reviewStars } from './star-calc';

/**
 * The Daily Review and Keep going (F-CURR-002 sections 4.3, 4.5, 4.8 and 11.3, row CM-14;
 * design/wireframes/reviews/daily-review.md and keep-going.md): the pure half the screen and Home read.
 *
 * - **Which session**: the day's first is the Daily Review; once a Daily Review is finished on the local day
 *   (a `daily` entry whose `scope` is today) the next is a Keep going, up to 3 a day. Today's count needs no new
 *   field: it is the day's `daily` entries minus the Daily Review itself.
 * - **Section 4.8 step 3**: the Daily Reviews of a day draw at most 20 due items before Keep going. A Daily Review
 *   stopped before its end writes no entry, so the screen counts the due items such a review drew (`drawnBefore`).
 * - **Rounds**: the engine's questions as rounds (`review-rounds.ts`); an item that cannot be played is left out and
 *   the engine is asked again without it, so its slot goes to the next item. Fewer than 3 playable rounds where the
 *   engine offered more is the "nothing is waiting" page.
 * - **Result**: stars by F-RVW-001 section 3.1 (first try, never 0) and the count of the session's items whose best
 *   box rose, never a ratio, a percentage or an "n of m".
 * - **Telemetry**: `review.start` and `review.complete` with `kind: 'daily'` (section 11.3); stars only.
 */

/** Section 4.5, the design's "an item cannot play" state: fewer playable rounds than this is the "nothing is waiting" page. */
export const MIN_PLAYABLE_ROUNDS = 3;
/** How many times the engine is asked again without the items that cannot be played. */
const REBUILD_TRIES = 4;

export type DailySessionKind = 'daily' | 'keep-going';

/** Today's `daily` entries (the Daily Review, then each Keep going), oldest first. */
export function dailyEntriesOn(reviews: readonly ReviewEntry[], day: string): ReviewEntry[] {
  return reviews.filter((r) => r.kind === 'daily' && r.scope === day).sort((a, b) => (a.generatedAt < b.generatedAt ? -1 : a.generatedAt > b.generatedAt ? 1 : 0));
}

/** Whether today's Daily Review is finished. */
export function dailyDoneOn(reviews: readonly ReviewEntry[], day: string): boolean {
  return reviews.some((r) => r.kind === 'daily' && r.scope === day);
}

/**
 * The day's review log for the engine: Keep going rounds taken (today's entries minus the Daily Review, never below 0)
 * and the due items the Daily Reviews drew (the finished one's items plus `drawnBefore`, those of stopped ones).
 */
export function dayReviewLog(reviews: readonly ReviewEntry[], day: string, drawnBefore = 0): DayReviewLog {
  const today = dailyEntriesOn(reviews, day);
  const first = today[0];
  return { dailyDueDrawn: Math.min(DAILY_REVIEW_DUE_CAP, (first?.itemIds.length ?? 0) + drawnBefore), keepGoingRounds: Math.max(0, today.length - 1) };
}

/** The next session of the day: the Daily Review until it is finished, then Keep going. */
export function nextSessionKind(reviews: readonly ReviewEntry[], day: string): DailySessionKind {
  return dailyDoneOn(reviews, day) ? 'keep-going' : 'daily';
}

export interface PlannedSession {
  kind: DailySessionKind;
  rounds: ReviewRound[];
  /** The engine's sound notice (F-AUDIO-004): a question was asked at read because there is no device voice. */
  soundNotice: boolean;
}

/**
 * The session to play, as rounds; null when there is nothing to ask (or fewer than 3 playable rounds where the engine
 * offered more): the "All refreshed today" page. A Keep going past the day's 3 is null too. `exclude` leaves items out
 * from the start (an item whose lesson chunk could not load).
 */
export function planSession(
  ctx: EngineContext,
  log: DayReviewLog,
  kind: DailySessionKind,
  rounds: Omit<RoundInput, 'index'>,
  exclude: ReadonlySet<string> = new Set(),
): PlannedSession | null {
  const skipped = new Set<string>(exclude);
  let offered = 0;
  let best: ReviewRound[] = [];
  for (let attempt = 0; attempt < REBUILD_TRIES; attempt += 1) {
    const session: ReviewSession | null = kind === 'daily' ? buildDailyReview(ctx, log, skipped) : buildKeepGoing(ctx, log, skipped);
    if (session === null || session.questions.length === 0) break;
    if (attempt === 0) offered = session.questions.length;
    const built = session.questions.map((q) => ({ q, round: roundFor(q, { ...rounds, index: ctx.index }) }));
    best = built.flatMap((b) => (b.round ? [b.round] : []));
    if (best.length === session.questions.length) break;
    for (const b of built) if (b.round === null) skipped.add(b.q.itemId);
  }
  // Fewer playable rounds than the engine first offered, and under 3: the "nothing is waiting" page.
  if (best.length === 0 || best.length < Math.min(MIN_PLAYABLE_ROUNDS, offered)) return null;
  return { kind, rounds: best, soundNotice: best.some((r) => r.question.voiceFallback) };
}

/** Home's view of the Daily Review: how many items are due, whether it was done today, and the review-first suggestion. */
export function dailyReviewSummary(ctx: EngineContext, reviews: readonly ReviewEntry[]): { due: number; done: boolean; reviewFirst: boolean } {
  return { due: dueCount(ctx), done: dailyDoneOn(reviews, ctx.today), reviewFirst: reviewFirst(ctx) };
}

// ---- answers and the result ------------------------------------------------------------------------------

/** One round's first answer, the scored one (later taps or Dones are retries). */
export interface RoundAnswer {
  correct: boolean;
  hinted?: boolean;
}

/** A round's first answer as the memory store records it (the round's rung, the engine's hinted rule). */
export function memoryAnswerOf(round: ReviewRound, answer: RoundAnswer): MemoryAnswer {
  return { itemId: round.question.itemId, rung: round.question.rung, correct: answer.correct, ...(answer.hinted ? { hinted: true } : {}) };
}

export interface SessionResult {
  stars: 1 | 2 | 3;
  /** The items asked, in order. */
  itemIds: string[];
  /** Not right on the first try (a hinted answer counts as not right, as F-RVW-001 reads `missedItemIds`). */
  missedItemIds: string[];
}

/** Stars by F-RVW-001 section 3.1 over the rounds answered: first try right and unhinted. Never 0. */
export function sessionResult(rounds: readonly ReviewRound[], answers: ReadonlyMap<number, RoundAnswer>): SessionResult {
  const asked = rounds.flatMap((r, i) => (answers.has(i) ? [{ r, a: answers.get(i) as RoundAnswer }] : []));
  const right = asked.filter((x) => x.a.correct && !x.a.hinted).length;
  return {
    stars: reviewStars(right, asked.length),
    itemIds: asked.map((x) => x.r.question.itemId),
    missedItemIds: asked.filter((x) => !x.a.correct || x.a.hinted).map((x) => x.r.question.itemId),
  };
}

/**
 * How many items got stronger: their best box rose between the reading before the session and the one after it (the
 * session's items and the words a right sentence credited inside it, section 4.3). A count of the learner's own items.
 */
export function strongerCount(before: EngineStates, after: EngineStates): number {
  let n = 0;
  for (const [id, row] of Object.entries(after)) if ((row?.st.s ?? 0) > (before[id]?.st.s ?? 0)) n += 1;
  return n;
}

/** The `reviews[]` entry of a finished Daily Review or Keep going: a plain `daily` entry on the local day. */
export function dailyEntry(input: { result: SessionResult; day: string; now: Date; nonce: string }): ReviewEntry {
  return {
    id: `daily:${input.day}:${input.nonce}`,
    kind: 'daily',
    generatedAt: input.now.toISOString(),
    scope: input.day,
    itemIds: input.result.itemIds,
    resultStars: input.result.stars,
    missedItemIds: input.result.missedItemIds,
  };
}

/**
 * What follows a result, or the done-today page (keep-going.md panels A, D1, D2 and E): `offer` while items are due
 * and fewer than 3 Keep goings were played today; `empty` once nothing is due ("All refreshed today", which wins);
 * `enough` after the third Keep going with items still due. Never a count of what is left.
 */
export type AfterSession = 'offer' | 'empty' | 'enough';

export function afterSession(ctx: EngineContext, log: DayReviewLog): AfterSession {
  if (dueCount(ctx) === 0) return 'empty';
  return log.keepGoingRounds >= KEEP_GOING_ROUNDS_PER_DAY ? 'enough' : 'offer';
}

/** The result headline for its stars (one word per tier, never a number). */
export function headlineKey(stars: 1 | 2 | 3): 'one' | 'two' | 'three' {
  return stars === 3 ? 'three' : stars === 2 ? 'two' : 'one';
}

// ---- telemetry (section 11.3) ----------------------------------------------------------------------------

/** `review.start { kind: 'daily' }` when a Daily Review or a Keep going begins. No item, no text. */
export function dailyReviewStartEvent(profileId: string): TelemetryEvent {
  return { name: 'review.start', profileId, payload: { kind: 'daily' } };
}

/** `review.complete { kind: 'daily', stars }` when one finishes; the rollups read the stars by kind. */
export function dailyReviewCompleteEvent(profileId: string, stars: 1 | 2 | 3): TelemetryEvent {
  return { name: 'review.complete', profileId, payload: { kind: 'daily', stars } };
}
