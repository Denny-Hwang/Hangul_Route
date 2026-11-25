import type { StageKey, UiLocale } from '@hangul-route/content-schema';
import { SAVED_RUN_MAX_AGE_MS } from '../quest-flow/saved-run';
import type { HangulCheck } from '../stage1/hangul-check';
import type { ReviewAnswer } from '../stage1/review-flow';
import type { RoundAnswer } from './daily-review';
import type { ReviewRound } from './review-rounds';

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-3a (section 3.4): a check stopped or interrupted goes on where it stopped.
 *
 * One stored check per learner (`hr:check-run:<profileId>`, `store/check-run-saved.ts`). This file is the pure side:
 * what is stored and whether a stored value may be resumed. It names no check's content (the caller passes the builder),
 * so `store/profile-keys.ts`, which the start bundle loads, does not pull the Hangul Check in. OD-LR9 (b), owner decision 2026-11-24: the first answers
 * are stored as they are given (the answers only, never a game's state), and the check goes on at the item after the
 * last one answered, so no first answer is asked again and nothing is scored twice.
 *
 * Row LR-3a stores the Hangul Check (`kind: 'hangul'`). Row LR-3b adds the Stage Check beside it (`kind: 'stage'`:
 * its planned rounds and its first answer per round index) and reuses the parts below that name no check:
 * `isFreshCheckRun` (24 hours either way), `isReviewAnswer`, `answeredLike` and `nextAfterLastAnswered`. The Stage
 * Check's own rules (`saved-stage-check.ts`) live in the memory chunk with its API, so this start-bundle file holds only
 * the Stage Check's stored type.
 */

/** The stored value's version; a row that changes what is stored changes it (a value of another version is dropped). */
export const SAVED_CHECK_VERSION = 1;

/** The Hangul Check as stored. */
export interface SavedHangulCheck {
  v: 1;
  kind: 'hangul';
  /** The seed the check was built from (`buildHangulCheck` is deterministic by seed). */
  seed: number;
  /** The item ids of that check, in order: a content update that changes them discards the run. */
  items: string[];
  /** The first-try record of each item answered. */
  answers: Record<string, ReviewAnswer>;
  /** The attempt's "reading practice" choice. */
  hideRomanization: boolean;
  /** ISO time the check began (a resumed check keeps it). */
  startedAt: string;
}

/**
 * The Stage Check as stored (row LR-3b, OD-LR7): the plan's rounds as played, not questions to rebuild them from (the
 * plan reads the learner's memory states, voice and switches at the moment it is made, and each first answer is written
 * into that store, so a plan made again after the first parts would be another check). Bump `v` when a row changes a
 * round's required fields (`saved-stage-check.ts` checks them).
 */
export interface SavedStageCheck {
  v: 1;
  kind: 'stage';
  stage: StageKey;
  /** The UI language of the rounds' meanings: a run is resumed only in the same one. */
  locale: UiLocale;
  /** `reviewItemsChunk.hash` when the plan was made: a new review-item set discards the run. */
  itemsHash: string;
  rounds: ReviewRound[];
  /** The first answer per round index, `[index, answer]` pairs, each already recorded in the memory store. */
  answers: Array<[number, RoundAnswer]>;
  hideRomanization: boolean;
  /** ISO time the check began (a resumed check keeps it). */
  startedAt: string;
  /**
   * ISO time the check's result was written into the progress (the entry and the latch): set by the finish right after
   * them and before the complete event. A stored run that carries it is a finished check whose clear did not happen (a
   * kill, a removal that failed): it is not offered again and records nothing a second time. No clock comparison is
   * involved, so a skewed clock or another device's entry cannot mark a run finished.
   */
  finishedAt?: string;
}

/** Every kind of check run that can be stored. */
export type SavedCheckRun = SavedHangulCheck | SavedStageCheck;

/** The value to store for a Hangul Check in progress. */
export function savedHangulCheck(run: {
  seed: number;
  items: readonly string[];
  answers: Readonly<Record<string, ReviewAnswer>>;
  hideRomanization: boolean;
  startedAt: string;
}): SavedHangulCheck {
  const answers: Record<string, ReviewAnswer> = {};
  for (const id of run.items) {
    const answer = run.answers[id];
    if (answer) answers[id] = { first: answer.first, retries: answer.retries };
  }
  return { v: SAVED_CHECK_VERSION, kind: 'hangul', seed: run.seed, items: [...run.items], answers, hideRomanization: run.hideRomanization, startedAt: run.startedAt };
}

/**
 * A check began at most 24 hours ago, either way on the clock (a clock set back reads as a run from the future: within
 * a day either way it is the same run, the rule of `saved-run.ts`).
 */
export function isFreshCheckRun(startedAt: unknown, now: number): boolean {
  if (typeof startedAt !== 'string') return false;
  const started = Date.parse(startedAt);
  return Number.isFinite(started) && Math.abs(now - started) <= SAVED_RUN_MAX_AGE_MS;
}

/** A first-try record: `{ first: boolean, retries: integer >= 0 }`. */
export function isReviewAnswer(value: unknown): value is ReviewAnswer {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const { first, retries } = value as Record<string, unknown>;
  return typeof first === 'boolean' && typeof retries === 'number' && Number.isInteger(retries) && retries >= 0;
}

/** Which of `ids` have an answer, in order. */
export function answeredLike(ids: readonly string[], answers: Readonly<Record<string, unknown>>): boolean[] {
  return ids.map((id) => Object.prototype.hasOwnProperty.call(answers, id));
}

/**
 * The item a check goes on at: the one after the last item answered (OD-LR9 (b)). An item whose round could not play has
 * no answer and is passed over when a later one has. Nothing answered: 0. Every item answered, or the last one: the
 * length of the list, which means "straight to the finish".
 */
export function nextAfterLastAnswered(answered: readonly boolean[]): number {
  const last = answered.lastIndexOf(true);
  return last < 0 ? 0 : last + 1;
}

/** Where a resumed Hangul Check opens: the chunk, and how many of its items are already answered. */
export interface ResumePoint {
  chunk: number;
  /** Items of that chunk to skip: the part's game plays the rest. */
  from: number;
}

/** The chunk and offset of item `index`, or null when `index` is past the last item (every item is answered). */
export function resumePointOf(chunks: readonly (readonly unknown[])[], index: number): ResumePoint | null {
  let before = 0;
  for (let chunk = 0; chunk < chunks.length; chunk += 1) {
    const size = chunks[chunk]?.length ?? 0;
    if (index < before + size) return { chunk, from: index - before };
    before += size;
  }
  return null;
}

/** What a resumable Hangul Check restores. */
export interface ResumableHangulCheck {
  seed: number;
  /** The check rebuilt from the stored seed (the one the learner was playing). */
  check: HangulCheck;
  answers: Record<string, ReviewAnswer>;
  hideRomanization: boolean;
  startedAt: string;
  /** Where it opens, or null: every item is answered and the check goes straight to the finish. */
  at: ResumePoint | null;
}

/**
 * What a stored value restores, or null: the check opens on its normal intro. Resumed only when the value is a saved
 * Hangul Check, it began at most 24 hours ago, the check rebuilt from its seed has the same item ids in the same order
 * (a content update that adds, removes or moves a letter or word discards it), and `answers` names only items of the
 * check, each `{ first: boolean, retries: integer >= 0 }`, with at least one answer (a run with none has nothing to go
 * on from). Anything else is dropped, not repaired.
 */
export function resumableHangulCheck(saved: unknown, now: number, build: (seed: number) => HangulCheck): ResumableHangulCheck | null {
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return null;
  const run = saved as Partial<Record<keyof SavedHangulCheck, unknown>>;
  if (run.v !== SAVED_CHECK_VERSION || run.kind !== 'hangul') return null;
  if (!isFreshCheckRun(run.startedAt, now)) return null;
  const { seed, items, answers, hideRomanization } = run;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0) return null;
  if (typeof hideRomanization !== 'boolean') return null;
  if (!Array.isArray(items) || !items.every((id) => typeof id === 'string')) return null;
  if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) return null;
  let check: HangulCheck;
  try {
    check = build(seed);
  } catch {
    return null;
  }
  const ids = check.items.map((item) => item.id);
  if (ids.length !== items.length || !ids.every((id, i) => id === items[i])) return null;
  const known = new Set(ids);
  const entries = Object.entries(answers as Record<string, unknown>);
  if (entries.length === 0) return null;
  const restored: Record<string, ReviewAnswer> = {};
  for (const [id, answer] of entries) {
    if (!known.has(id) || !isReviewAnswer(answer)) return null;
    restored[id] = { first: answer.first, retries: answer.retries };
  }
  const next = nextAfterLastAnswered(answeredLike(ids, restored));
  return { seed, check, answers: restored, hideRomanization, startedAt: run.startedAt as string, at: resumePointOf(check.chunks, next) };
}
