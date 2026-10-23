import type { ReviewEntry, StageKey } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import { checkResult, type CheckResult } from './cell-check';
import type { RoundAnswer } from './daily-review';
import { buildCheck, type EngineContext } from './engine';
import { roundFor, type ReviewRound, type RoundInput } from './review-rounds';

/**
 * The Stage Check of Stages 2-7 (F-CURR-002 sections 4.5, 7.3, 11.3 and OD-1, row CM-22; design/wireframes/reviews/
 * stage-check.md D to F): the pure half the memory chunk's `stageCheckApi()` reads. The screens are a chunk of their own.
 *
 * - **Items**: from every cell of the stage (all five themes), met or not. Each cell gets a fair share of the 20
 *   places (as many as it can fill, the rest to the others, in theme order), its share chosen box first by the CM-13
 *   Check selector; then the selector runs once over the chosen items: at least ceil(0.3 x rounds) at the produce
 *   rung, interleaved with the theme and format caps.
 * - **Size**: about 20 rounds (6-8 minutes), untimed, in parts of 5 with a pause between parts. With fewer than
 *   `STAGE_CHECK_MIN_ITEMS` (10) playable rounds there is no Stage Check (the wireframe's floor).
 * - **Result**: stars only (F-RVW-001 section 3.1, first try, unhinted). The 3-star tier (80% or more right first
 *   try) latches `stageCheckAt` (earliest): the "Stage Checks passed" line of the reports. Every finished check writes
 *   the stage's one `reviews[]` entry of kind `stage-certificate` (the existing kind; the UI never says "certificate"),
 *   scope the stage, never pruned; a retake merges into it keeping the best stars, so a later lower result never
 *   lowers what shows.
 * - It never gates anything: Stage N+1, its cells and the route do not read it (OD-1).
 */

/** Rounds of a Stage Check when the stage has them (section 4.5: about 20 items, 6-8 minutes). */
export const STAGE_CHECK_SIZE = 20;
/** The fewest playable rounds a Stage Check is offered with (stage-check.md States: the floor decided in CM-22). */
export const STAGE_CHECK_MIN_ITEMS = 10;
/** Rounds of one part; a pause sits between parts (stage-check.md E, E2). */
export const STAGE_CHECK_PART = 5;
/** How many times the plan is built again without the items that cannot be played. */
const REBUILD_TRIES = 4;

export interface PlannedStageCheck {
  stage: StageKey;
  rounds: ReviewRound[];
  /** The engine's sound notice (F-AUDIO-004). */
  soundNotice: boolean;
}

/**
 * The items a Stage Check of the stage may ask, cell by cell in the order given (the stage's grid cells, theme order):
 * those each cell teaches, not retired. An item two cells teach belongs to the first.
 */
export function stageCheckItemIds(index: EngineContext['index'], cells: readonly string[]): string[][] {
  const taken = new Set<string>();
  return cells.map((cell) =>
    index.items.flatMap((item) => {
      if (!item.cells.includes(cell) || index.retired.has(item.id) || taken.has(item.id)) return [];
      taken.add(item.id);
      return [item.id];
    }),
  );
}

/** Fair shares of `size` places over cells that can fill `capacity[i]` each: round robin, a full cell gives way. */
export function shares(capacity: readonly number[], size: number): number[] {
  const out = capacity.map(() => 0);
  let left = Math.min(size, capacity.reduce((sum, c) => sum + c, 0));
  while (left > 0) {
    for (let i = 0; i < capacity.length && left > 0; i += 1) {
      if ((out[i] ?? 0) < (capacity[i] ?? 0)) {
        out[i] = (out[i] ?? 0) + 1;
        left -= 1;
      }
    }
  }
  return out;
}

/** The items to ask: each cell's share, chosen box first by the Check selector over that cell's items. */
export function stageCheckSelection(ctx: EngineContext, cells: readonly string[], skipped: ReadonlySet<string>): string[] {
  const perCell = stageCheckItemIds(ctx.index, cells).map((ids) => ids.filter((id) => !skipped.has(id)));
  // What each cell can ask at all (the selector leaves out what this device cannot play or show).
  const askable = perCell.map((ids) => buildCheck(ctx, { itemIds: ids, size: ids.length }).questions.length);
  const quota = shares(askable, STAGE_CHECK_SIZE);
  return perCell.flatMap((ids, i) => ((quota[i] ?? 0) > 0 ? buildCheck(ctx, { itemIds: ids, size: quota[i] ?? 0 }).questions.map((q) => q.itemId) : []));
}

/**
 * The Stage Check to play, as rounds; null when the stage has fewer than 10 playable rounds. `exclude` leaves items out
 * from the start (one whose lesson chunk could not load).
 */
export function planStageCheck(
  ctx: EngineContext,
  stage: StageKey,
  cells: readonly string[],
  rounds: Omit<RoundInput, 'index'>,
  exclude: ReadonlySet<string> = new Set(),
): PlannedStageCheck | null {
  const skipped = new Set<string>(exclude);
  let best: ReviewRound[] = [];
  for (let attempt = 0; attempt < REBUILD_TRIES; attempt += 1) {
    const ids = stageCheckSelection(ctx, cells, skipped);
    if (ids.length === 0) break;
    const session = buildCheck(ctx, { itemIds: ids, size: STAGE_CHECK_SIZE });
    const built = session.questions.map((q) => ({ q, round: roundFor(q, { ...rounds, index: ctx.index }) }));
    best = built.flatMap((b) => (b.round ? [b.round] : []));
    if (best.length === session.questions.length) break;
    for (const b of built) if (b.round === null) skipped.add(b.q.itemId);
  }
  if (best.length < STAGE_CHECK_MIN_ITEMS) return null;
  return { stage, rounds: best, soundNotice: best.some((r) => r.question.voiceFallback) };
}

/** After which round a pause sits (0-based round index), between parts of 5: never after the last round. */
export function pauseAfter(index: number, total: number): boolean {
  return (index + 1) % STAGE_CHECK_PART === 0 && index + 1 < total;
}

/** How many pauses a check of `total` rounds has, and which one comes after round `index` (0-based), or null. */
export function pauseNumber(index: number, total: number): { n: number; last: boolean } | null {
  if (!pauseAfter(index, total)) return null;
  const n = Math.floor((index + 1) / STAGE_CHECK_PART) - 1;
  const count = Math.ceil(total / STAGE_CHECK_PART) - 1;
  return { n, last: n === count - 1 };
}

/** The result of a finished Stage Check: the stars, and whether it reached the 3-star tier (which latches `stageCheckAt`). */
export function stageCheckResult(rounds: readonly ReviewRound[], answers: ReadonlyMap<number, RoundAnswer>): CheckResult {
  return checkResult(rounds, answers);
}

/**
 * The `reviews[]` entry of a finished Stage Check: kind `stage-certificate`, scope the stage, one per stage
 * (`stage-check:<stage>`): a retake merges into it (`mergeReview`: the best stars, then the earliest copy), so retakes
 * never grow `reviews[]`. `at` is the guarded stamp. Never a profile id or a name.
 */
export function stageCheckEntry(input: { stage: StageKey; result: CheckResult; at: string }): ReviewEntry {
  return {
    id: `stage-check:${input.stage}`,
    kind: 'stage-certificate',
    generatedAt: input.at,
    scope: input.stage,
    itemIds: input.result.itemIds,
    resultStars: input.result.stars,
    missedItemIds: input.result.missedItemIds,
  };
}

// ---- telemetry (section 11.3) ----------------------------------------------------------------------------

/** `review.start { kind: 'stage-certificate', stageKey, hideRomanization }`. No item, no text. */
export function stageCheckStartEvent(profileId: string, stage: StageKey, hideRomanization: boolean): TelemetryEvent {
  return { name: 'review.start', profileId, payload: { kind: 'stage-certificate', stageKey: stage, hideRomanization } };
}

/** `review.complete { kind: 'stage-certificate', stageKey, stars }`: stars only, never a count or a score. */
export function stageCheckCompleteEvent(profileId: string, stage: StageKey, stars: 1 | 2 | 3): TelemetryEvent {
  return { name: 'review.complete', profileId, payload: { kind: 'stage-certificate', stageKey: stage, stars } };
}
