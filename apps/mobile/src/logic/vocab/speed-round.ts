import type { ClockScale, RuntimeVocabItem, VocabProgress } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { nudgeFor, type Nudge, type VocabSpeedCopy } from './nudges';
import type { VocabEvent } from './progress';
import { NotEnoughWords, buildQuestions, type VocabQuestion } from './question-builder';
import { selectSpeedWords } from './select-words';
import type { SpeedMode } from './session-clock';
import type { QuestionResult, SpeedState } from './speed-session';
import type { RoundStars, RoundSummary } from './stars';

/**
 * The Speed Round screens' decisions (F-VOC-004 §3.1, §3.5, §3.6, §3.10;
 * PR S-5). Pure: the start sheet, the question screen and the results render
 * what these return, and the round screen writes and sends what they build.
 *
 * - The level chooses the options and the question count (§3.2): Pictures
 *   first 3 options and 8 questions, otherwise 4 and 10; Challenge builds 40
 *   and stops at its clock. The level is `levelOrder`, never an age.
 * - Each first tap writes one `answer` event at once (source `speed`), and a
 *   round with at least one answer writes one `session` event at the end; a
 *   round with none writes nothing (§3.4).
 * - Hoya's line comes from `nudgeFor` (§3.7); the results show stars and a
 *   plain count of words caught, never a percentage, a fraction or a count of
 *   misses (S4, S11).
 * - A personal best is the learner's own, Challenge only (S9).
 */

/** Relaxed questions for every level but Pictures first. */
export const RELAXED_COUNT = 10;
/** Relaxed questions at the Pictures-first level. */
export const PICTURES_FIRST_COUNT = 8;
/** Challenge builds this many up front and stops at the clock (§3.4). */
export const CHALLENGE_COUNT = 40;
/** Sparks the meter holds before it is full: `SparkMeter`'s 10 slots x 3 rows (design/components/SparkMeter/spec.md). */
export const SPARK_CAPACITY = 30;

export type RoundLevel = 0 | 1 | 2;

export interface RoundPlan {
  level: RoundLevel;
  optionCount: 3 | 4;
  /** Questions to build. */
  count: number;
}

/** The round for a learner level (`null` reads as 1, §3.2) and a mode. */
export function roundPlan(levelOrder: RoundLevel | null, mode: SpeedMode): RoundPlan {
  const level: RoundLevel = levelOrder ?? 1;
  const picturesFirst = level === 0;
  const relaxedCount = picturesFirst ? PICTURES_FIRST_COUNT : RELAXED_COUNT;
  return { level, optionCount: picturesFirst ? 3 : 4, count: mode === 'challenge' ? CHALLENGE_COUNT : relaxedCount };
}

/** The topic's words the learner has collected (any saved state), in the topic's order. */
export function collectedWords(items: readonly RuntimeVocabItem[], progress: VocabProgress): RuntimeVocabItem[] {
  const known = new Set(progress.items.map((s) => s.id));
  return items.filter((item) => known.has(item.id));
}

/** §3.1: a round needs as many collected words as it has options; fewer is the learn-first card. */
export function sheetState(collected: number, optionCount: number): 'learn-first' | 'ready' {
  return collected >= optionCount ? 'ready' : 'learn-first';
}

export interface RoundInput {
  /** The topic's collected words (`collectedWords`). */
  collected: readonly RuntimeVocabItem[];
  /** Every word of the topic: the distractors (§3.3 rule 7). */
  universe: readonly RuntimeVocabItem[];
  progress: VocabProgress;
  /** The device's local day (`localDay`). */
  today: string;
  plan: RoundPlan;
  seed: number;
  canRender(ref: string): boolean;
  canPlay: boolean;
}

/**
 * The round's questions (§3.5): the words chosen by `selectSpeedWords` (due
 * words first), asked through `buildQuestions` with each word's box. The
 * builder returns as many questions as the words allow (each word takes each
 * allowed format at most once), which can be fewer than the plan's count; none
 * at all is the "Nothing to play yet" state, never an error.
 */
export function buildRound(i: RoundInput): VocabQuestion[] {
  const boxes = new Map(i.progress.items.map((s) => [s.id, s.box]));
  const pool = selectSpeedWords({ collected: i.collected, progress: i.progress, today: i.today, count: i.plan.count, seed: i.seed });
  try {
    return buildQuestions({
      pool,
      universe: i.universe,
      count: i.plan.count,
      optionCount: i.plan.optionCount,
      levelOrder: i.plan.level,
      boxOf: (id) => boxes.get(id) ?? 0,
      seed: i.seed,
      canRender: i.canRender,
      canPlay: i.canPlay,
    });
  } catch (e) {
    if (e instanceof NotEnoughWords) return [];
    throw e;
  }
}

/** The event one first tap writes, as it happens (§3.6). */
export function speedAnswerEvent(r: QuestionResult): VocabEvent {
  return { type: 'answer', id: r.itemId, correct: r.correct, format: r.format, source: 'speed', ms: r.ms, hinted: r.hinted };
}

/** The event the end of a round writes; `null` when nothing was answered (no stars: the round was not played). */
export function speedSessionEvent(topicKey: string, s: RoundSummary): VocabEvent | null {
  if (s.stars === null) return null;
  return { type: 'session', topicKey, kind: 'speed', stars: s.stars, caught: s.caught, mode: s.mode, endedBy: s.endedBy };
}

/** The learner's earlier Challenge best for the topic (`bestCaught`), 0 when there is none. */
export function previousBest(progress: VocabProgress, topicKey: string): number {
  return progress.topics.find((t) => t.topic === topicKey)?.bestCaught ?? 0;
}

/** "New best!": a played Challenge round that caught more than the learner's own earlier best (S9). */
export function isNewBest(s: RoundSummary, earlierBest: number): boolean {
  return s.mode === 'challenge' && s.stars !== null && s.caught > earlierBest;
}

export interface RoundStartInput {
  topicKey: string;
  mode: SpeedMode;
  /** The learner's setting; sent as `null` in Relaxed, which has no clock. */
  clockScale: ClockScale;
  plan: RoundPlan;
  /** Questions actually built. */
  questions: number;
  /** Sound questions are in the round (`canPlay`). */
  audio: boolean;
}

export interface RoundStartEvent {
  name: 'vocab.round.start';
  payload: {
    topicKey: string;
    mode: SpeedMode;
    clockScale: ClockScale | null;
    optionCount: 3 | 4;
    level: RoundLevel;
    questions: number;
    audio: boolean;
  };
}

/** `vocab.round.start` (§3.10), when Start is tapped. */
export function roundStartEvent(i: RoundStartInput): RoundStartEvent {
  return {
    name: 'vocab.round.start',
    payload: {
      topicKey: i.topicKey,
      mode: i.mode,
      clockScale: i.mode === 'challenge' ? i.clockScale : null,
      optionCount: i.plan.optionCount,
      level: i.plan.level,
      questions: i.questions,
      audio: i.audio,
    },
  };
}

export interface RoundCompleteInput {
  topicKey: string;
  summary: RoundSummary;
  /** From the session state. */
  pauses: number;
  activeMs: number;
  newBest: boolean;
}

export interface RoundCompleteEvent {
  name: 'vocab.round.complete';
  payload: {
    topicKey: string;
    mode: SpeedMode;
    endedBy: RoundSummary['endedBy'];
    answered: number;
    firstTryCorrect: number;
    hinted: number;
    caught: number;
    stars: RoundStars;
    pauses: number;
    activeMs: number;
    newBest: boolean;
  };
}

/** `vocab.round.complete` (§3.10), as the results open; never for a round with no answer. */
export function roundCompleteEvent(i: RoundCompleteInput): RoundCompleteEvent | null {
  const s = i.summary;
  if (s.stars === null) return null;
  return {
    name: 'vocab.round.complete',
    payload: {
      topicKey: i.topicKey,
      mode: s.mode,
      endedBy: s.endedBy,
      answered: s.answered,
      firstTryCorrect: s.firstTryCorrect,
      hinted: s.hinted,
      caught: s.caught,
      stars: s.stars,
      pauses: i.pauses,
      activeMs: i.activeMs,
      newBest: i.newBest,
    },
  };
}

/**
 * Hoya's line on the question screen (§3.6, §3.7): "Ready when you are." on
 * the first question before any answer; the right or gentle-miss line during
 * a reveal (naming the right word, rotated by the answers already given); and
 * "Take your time." once a Relaxed hint is up. Otherwise none.
 */
export function hoyaLine(s: SpeedState, glossOf: (id: string) => string | undefined, copy: VocabSpeedCopy): Nudge | null {
  if (s.phase === 'reveal') {
    const last = s.results[s.results.length - 1];
    if (last === undefined) return null;
    const gloss = glossOf(last.itemId) ?? '';
    return nudgeFor({ kind: last.correct ? 'right' : 'miss', gloss }, s.sparks, s.results.length - 1, copy);
  }
  if (s.phase !== 'question') return null;
  if (s.hint !== 'none') return nudgeFor({ kind: 'idle' }, s.sparks, s.results.length, copy);
  if (s.index === 0 && s.results.length === 0) return nudgeFor({ kind: 'start' }, 0, 0, copy);
  return null;
}

export interface ResultsView {
  stars: RoundStars;
  /** "7 words caught": distinct words, a plain count. */
  caughtLine: string;
  /** A round the clock ended (Challenge). */
  timeUp: string | null;
  /** "New best!" or nothing. */
  newBest: string | null;
  hoya: Nudge;
  /** "Words to see again", in the order they came up; empty: no list. */
  seeAgainIds: readonly string[];
  /** Play again is the primary button only when there is nothing to see again. */
  playAgainPrimary: boolean;
}

/** What the results screen shows (§3.6); `null` for a summary with no stars (nothing was played). */
export function resultsView(s: RoundSummary, newBest: boolean, copy: VocabSpeedCopy): ResultsView | null {
  if (s.stars === null) return null;
  const r = copy.results;
  return {
    stars: s.stars,
    caughtLine: r.caught(s.caught),
    timeUp: s.endedBy === 'clock' ? r.timeUp : null,
    newBest: newBest ? r.newBest : null,
    hoya: nudgeFor({ kind: 'results', stars: s.stars, firstTryCorrect: s.firstTryCorrect }, s.caught, 0, copy),
    seeAgainIds: s.seeAgainIds,
    playAgainPrimary: s.seeAgainIds.length === 0,
  };
}

export type SpeedA11yCopy = Messages['a11y']['vocab']['speed'];

/** The spark meter's name (§3.8): "3 sparks", and "Full of sparks" once it is full. */
export function sparkLabel(sparks: number, a11y: SpeedA11yCopy): string {
  return sparks >= SPARK_CAPACITY ? a11y.sparksFull : a11y.sparks(sparks);
}
