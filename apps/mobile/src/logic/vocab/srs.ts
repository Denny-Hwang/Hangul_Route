/**
 * The Leitner schedule — F-VOC-005 section 3.4. Pure.
 *
 * Six boxes, no speed factor (P3): box 0 is "not met", a collected word starts
 * in box 1, a first-try right answer moves it up one box, a wrong answer moves
 * it down one (never below 1) and makes it due tomorrow. Only the schedule
 * (`box`, `due`) can go down; `bestBox` never does.
 *
 * Days are plain `YYYY-MM-DD` strings of the device's local calendar (P5).
 * The arithmetic here is calendar arithmetic on those strings (done in UTC, so
 * a daylight-saving change never moves a day), never a time-of-day.
 */

/** Days until due, by box (box 0 is unused for a collected word). */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;

/** A collected word is never below box 1. */
export const MIN_BOX = 1;
/** And never above box 5. */
export const MAX_BOX = 5;
/** "Got it" on a flashcard seeds at most this box (P4: self-marking is a weak signal). */
export const SELF_KNOWN_BOX = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The schedule part of a word's state that the transitions read and write. */
export interface Schedule {
  box: number;
  bestBox: number;
  due: string | null;
}

function dayMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** `day` plus `n` calendar days. */
export function addDays(day: string, n: number): string {
  return new Date(dayMs(day) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayMs(to) - dayMs(from)) / DAY_MS);
}

export function promote(box: number): number {
  return Math.min(MAX_BOX, Math.max(MIN_BOX - 1, box) + 1);
}

export function demote(box: number): number {
  return Math.max(MIN_BOX, box - 1);
}

/** The day a word in `box` comes back, counted from `today`. */
function dueFrom(box: number, today: string): string {
  return addDays(today, BOX_DAYS[box as 0 | 1 | 2 | 3 | 4 | 5]);
}

/** Due on or before today; an unscheduled word (`due: null`) never is. */
export function isDue(state: { due: string | null }, today: string): boolean {
  return state.due !== null && state.due <= today;
}

/**
 * How many days past due a word is (0 when due today or not due). Used only to
 * order words, oldest due first — never to choose a message or a style.
 */
export function daysOverdue(state: { due: string | null }, today: string): number {
  return state.due === null ? 0 : Math.max(0, daysBetween(state.due, today));
}

/** A first-try right answer, not hinted: up one box. */
export function onRight(s: Schedule, today: string): Schedule {
  const box = promote(s.box);
  return { box, bestBox: Math.max(s.bestBox, box), due: dueFrom(box, today) };
}

/** A right answer given with help: not promoted, never demoted; rescheduled by its box. */
export function onHinted(s: Schedule, today: string): Schedule {
  const box = Math.max(MIN_BOX, s.box);
  return { box, bestBox: Math.max(s.bestBox, box), due: dueFrom(box, today) };
}

/** A wrong answer: down one box (not below 1), due tomorrow. */
export function onWrong(s: Schedule, today: string): Schedule {
  return { box: demote(s.box), bestBox: s.bestBox, due: addDays(today, 1) };
}

/**
 * Self-marking on a flashcard (P4). "Got it" raises a lower box to 2 and never
 * lowers a higher one (the same object comes back when nothing changes);
 * "Show me again" sets box 1, due tomorrow.
 */
export function onSelf(s: Schedule, known: boolean, today: string): Schedule {
  if (!known) return { box: MIN_BOX, bestBox: s.bestBox, due: addDays(today, 1) };
  if (s.box >= SELF_KNOWN_BOX) return s;
  return { box: SELF_KNOWN_BOX, bestBox: Math.max(s.bestBox, SELF_KNOWN_BOX), due: dueFrom(SELF_KNOWN_BOX, today) };
}
