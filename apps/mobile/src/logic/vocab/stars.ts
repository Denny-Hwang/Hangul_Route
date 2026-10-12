import type { SpeedMode } from './session-clock';
import type { QuestionResult, SessionConfig } from './speed-session';

/**
 * Speed Round stars and the round summary (F-VOC-004 §3.4, S4). Pure.
 *
 * Stars follow F-RVW-001 §3.1, not the quest table (`logic/score.ts`
 * `starsForAccuracy`, 0.95 / 0.6 / 0.2, which allows 0): of the questions
 * answered, a first-try share of at least 0.8 earns 3, at least 0.5 earns 2,
 * otherwise 1. A round with at least one answer always earns a star; a round
 * with none has no stars at all (it was not played). When
 * `logic/reviews/star-calc.ts` lands (F-RVW-001), a test pins the two tables
 * together.
 *
 * The learner only ever sees the stars and the plain count `caught`; the
 * other numbers are for telemetry and caregivers and are never rendered on a
 * learner screen.
 */

export type RoundStars = 1 | 2 | 3;

/** `null` when `answered === 0`: nothing was played. */
export function starsForRound(firstTryCorrect: number, answered: number): RoundStars | null {
  if (!(answered >= 1)) return null;
  const right = Number.isFinite(firstTryCorrect) ? Math.min(answered, Math.max(0, firstTryCorrect)) : 0;
  // Integer cross-multiplication, so 0.8 and 0.5 are exact boundaries.
  if (right * 10 >= answered * 8) return 3;
  if (right * 2 >= answered) return 2;
  return 1;
}

/** How a round that reached the results ended (a quit has no summary). */
export type SummaryEndedBy = 'questions' | 'clock';

/** A plain serialisable object: it rides in the `VocabResults` route. */
export interface RoundSummary {
  mode: SpeedMode;
  endedBy: SummaryEndedBy;
  /** The Challenge clock the round had; `null` in Relaxed. */
  clockMs: number | null;
  answered: number;
  /** Right on the first try and not hinted. */
  firstTryCorrect: number;
  /** Answers given after a hint appeared. */
  hinted: number;
  /** Distinct words with a first-try right answer (a word caught twice counts once). */
  caught: number;
  caughtIds: string[];
  /** Distinct words answered wrongly at least once, in the order they came up ("Words to see again"). */
  seeAgainIds: string[];
  stars: RoundStars | null;
}

function distinct(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function summarize(results: readonly QuestionResult[], cfg: SessionConfig, endedBy: SummaryEndedBy): RoundSummary {
  const firstTry = results.filter((r) => r.correct && !r.hinted);
  const caughtIds = distinct(firstTry.map((r) => r.itemId));
  return {
    mode: cfg.mode,
    endedBy,
    clockMs: cfg.clockMs,
    answered: results.length,
    firstTryCorrect: firstTry.length,
    hinted: results.filter((r) => r.hinted).length,
    caught: caughtIds.length,
    caughtIds,
    seeAgainIds: distinct(results.filter((r) => !r.correct).map((r) => r.itemId)),
    stars: starsForRound(firstTry.length, results.length),
  };
}
