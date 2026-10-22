import type { MemoryItemState } from '@hangul-route/content-schema';
import { addDays, daysBetween } from '../vocab/srs';

/**
 * The spacing rule of the memory store (F-CURR-002 section 4.3, row CM-12): F-VOC-005 P3 with the
 * spacing rule, over boxes 0-7. Pure: the caller passes the local day (`YYYY-MM-DD`, F-VOC-005 P5)
 * and the instant of the answer, so the rule never reads a clock or a time zone.
 *
 * - Box 0 is "not met". The first answer to an item meets it: box 1, due tomorrow, first day `f`
 *   today. That answer is never spaced, and neither is any other answer on the day of meeting.
 * - An answer is **spaced** only when it is the item's first answer of the local day and the item is
 *   due (`d` <= today, overdue included). Only a spaced, first-try, unhinted right answer raises the
 *   box, by one, so a box rises at most one step a local day.
 * - A wrong first try lowers the box by one, never below 1, and makes it due tomorrow, spaced or
 *   not, but at most once a local day.
 * - A hinted right answer (the F-VOC-004 idle hint, a one-jamo slip at the produce rung) is neither
 *   promoted nor demoted; a spaced one is rescheduled from its box.
 * - Every answer counts in the reps `n` and the rungs; response time is never read.
 * - Intervals 1, 3, 7, 14, 30, 60 and 120 days for boxes 1-7.
 *
 * The rungs (section 4.3, modality ladder): `r` is a bitmask of the rungs ever passed (bit 0
 * recognize, bit 1 read, bit 2 produce) and only grows; `c` is the rung to ask next (0 recognize,
 * 1 read, 2 produce, 3 the ladder passed in full). A first-try unhinted right answer at rung `c` or
 * above sets that rung's bit and every lower one and moves `c` past it; a miss at the produce rung
 * sets `c` back to read and keeps the produce bit.
 *
 * Facts the rule needs that the shared state does not hold ("answered today", "fell today", the day
 * of the last spaced answer) are device-only `DayFacts`, kept beside the state and never uploaded.
 * The shared state keeps the CM-11 contract: `at` moves only when `b`, `d` or `c` change, so an
 * answer that changes no schedule never wins a last-writer-wins merge over a real change elsewhere.
 */

/** Days until due, by box. Boxes 6 and 7 belong to the memory store only (topic words keep 0-5). */
export const MEMORY_BOX_DAYS = [0, 1, 3, 7, 14, 30, 60, 120] as const;
export const MEMORY_MIN_BOX = 1;
export const MEMORY_MAX_BOX = 7;

export const RUNGS = ['recognize', 'read', 'produce'] as const;
export type Rung = (typeof RUNGS)[number];
export const RUNG_INDEX: Readonly<Record<Rung, number>> = { recognize: 0, read: 1, produce: 2 };
/** `c` once every rung has been passed in order: review keeps asking at produce. */
export const LADDER_DONE = 3;
/** A spaced right answer after this many days since the item's previous spaced answer counts toward the north star (section 3.1). */
export const DURABLE_LAG_DAYS = 7;

/** Device-only facts about one item (never uploaded): local days, `YYYY-MM-DD`. */
export interface DayFacts {
  /** The last local day the item was answered on this device. */
  l?: string;
  /** The last local day its box fell. */
  fd?: string;
  /** The last local day of a spaced answer. */
  p?: string;
  /** The last local day of a durable answer (spaced, right, 7 or more days after the previous spaced answer). */
  w?: string;
}

export interface Answer {
  correct: boolean;
  /** A right answer given with help; a hinted answer is never wrong. */
  hinted?: boolean;
  rung: Rung;
}

export interface AnswerOutcome {
  state: MemoryItemState;
  facts: DayFacts;
  /** This answer met the item (box 0 or no state before). */
  met: boolean;
  spaced: boolean;
  /** Days since the previous spaced answer (or the first day) for a spaced answer; null otherwise. */
  lagDays: number | null;
  /** The box went down. */
  fell: boolean;
  /** A spaced answer that was not right first try, unhinted: a lapse of section 11.3. */
  lapse: boolean;
  /** A spaced right answer 7 or more days after the previous spaced answer (section 3.1). */
  durable: boolean;
  /** The best box reached 3 for the first time. */
  newHeld: boolean;
}

const interval = (box: number): number => MEMORY_BOX_DAYS[Math.min(MEMORY_MAX_BOX, Math.max(0, box)) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7];

/** The state of an item met today (its Discover page or its first scored round): box 1, due tomorrow. */
export function meetState(today: string, at: string): MemoryItemState {
  return { b: MEMORY_MIN_BOX, d: addDays(today, 1), c: 0, r: 0, n: 0, f: today, s: MEMORY_MIN_BOX, at };
}

/** Due on or before `today`; an item never met or with no due day never is. */
export function isItemDue(state: Pick<MemoryItemState, 'b' | 'd'>, today: string): boolean {
  return state.b >= MEMORY_MIN_BOX && state.d !== null && state.d <= today;
}

/** The rungs `c` and `r` after a first-try answer. */
function nextRungs(state: MemoryItemState, answer: Answer): { c: number; r: number } {
  const idx = RUNG_INDEX[answer.rung];
  if (answer.correct && !answer.hinted) {
    const r = state.r | ((1 << (idx + 1)) - 1);
    const c = idx >= state.c ? Math.min(LADDER_DONE, idx + 1) : state.c;
    return { c, r };
  }
  if (!answer.correct && idx === RUNG_INDEX.produce) return { c: RUNG_INDEX.read, r: state.r };
  return { c: state.c, r: state.r };
}

/**
 * One first-try answer to one item on the local day `today`, at the instant `at` (ISO). Returns the
 * new state and facts, and what happened, for the day's counts (`memory.daily`).
 */
export function applyAnswer(prev: MemoryItemState | undefined, prevFacts: DayFacts, answer: Answer, today: string, at: string): AnswerOutcome {
  const met = prev === undefined || prev.b < MEMORY_MIN_BOX;
  const before = met ? meetState(today, at) : prev;
  const hinted = answer.correct && answer.hinted === true;
  const right = answer.correct && !hinted;
  const spaced = !met && prevFacts.l !== today && isItemDue(before, today);
  const lagDays = spaced ? Math.max(0, daysBetween(prevFacts.p ?? before.f, today)) : null;

  let b = before.b;
  let d = before.d;
  let fell = false;
  // Only the facts: a stored row passed as its facts carries its state and shard too.
  const facts: DayFacts = { l: today };
  if (prevFacts.fd !== undefined) facts.fd = prevFacts.fd;
  if (prevFacts.p !== undefined) facts.p = prevFacts.p;
  if (prevFacts.w !== undefined) facts.w = prevFacts.w;
  if (spaced && right) {
    b = Math.min(MEMORY_MAX_BOX, b + 1);
    d = addDays(today, interval(b));
  } else if (spaced && hinted) {
    d = addDays(today, interval(b));
  } else if (!answer.correct && !met && prevFacts.fd !== today) {
    b = Math.max(MEMORY_MIN_BOX, b - 1);
    d = addDays(today, 1);
    fell = b < before.b;
    facts.fd = today;
  }
  const { c, r } = nextRungs(before, answer);
  const durable = spaced && right && (lagDays ?? 0) >= DURABLE_LAG_DAYS;
  if (spaced) facts.p = today;
  if (durable) facts.w = today;
  const s = Math.max(before.s, b);
  const scheduleMoved = met || b !== before.b || d !== before.d || c !== before.c;
  const state: MemoryItemState = { b, d, c, r, n: before.n + 1, f: before.f, s, at: scheduleMoved ? at : before.at };
  const heldBefore = met ? 0 : before.s;
  return { state, facts, met, spaced, lagDays, fell, lapse: spaced && !right && !hinted, durable, newHeld: heldBefore < 3 && s >= 3 };
}

/** The lag bucket of section 11.3 for a number of days. */
export function lagBucket(days: number): '0-1' | '2-3' | '4-7' | '8-14' | '15-30' | '31+' {
  if (days <= 1) return '0-1';
  if (days <= 3) return '2-3';
  if (days <= 7) return '4-7';
  if (days <= 14) return '8-14';
  if (days <= 30) return '15-30';
  return '31+';
}
