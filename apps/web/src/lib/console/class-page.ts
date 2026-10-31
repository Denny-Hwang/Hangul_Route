import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { relativeDay } from './rollup';

/**
 * The class page's order and buttons (AMENDMENTS-GROWNUP-UX GX-7, section 8 T3 to T5; wireframe
 * `design/wireframes/console/roster.md` "Class page order (GX-7)"). Pure: the page draws what this returns.
 *
 * T3: the action bar keeps the plan (primary), the term plan, Lecture mode and the class report in view; More holds
 * Notes, the new-device (re-link) entry, Class moves and Settings. T5: an empty class leaves out what needs a learner
 * (Re-link, Class moves, Notes, Lecture mode, and the class report, which the roll-up only ever showed with learners),
 * except an entry that has something waiting: a move into an empty class is how a new class often fills.
 */
export type ClassAction = 'plan' | 'termPlan' | 'lecture' | 'classReport' | 'notes' | 'relink' | 'moves' | 'settings';

export interface ClassActionsInput {
  /** No learner on the roster yet. */
  empty: boolean;
  /** Lecture mode is on and this role composes here (`canComposeIn`). */
  lecture: boolean;
  /** The class report is on for this build and console locale (`rosterClassReportLink`). */
  classReport: boolean;
  /** The roster's Notes entry is offered (`rosterNotesLinks(...).header`). */
  notes: boolean;
  /** Class moves are shown in this build (`useTransfersShown`). */
  moves: boolean;
  relinksWaiting: number;
  movesWaiting: number;
}

export interface ClassActions {
  bar: ClassAction[];
  more: ClassAction[];
}

export function classActions(input: ClassActionsInput): ClassActions {
  const learners = !input.empty;
  const bar: ClassAction[] = ['plan', 'termPlan'];
  if (input.lecture && learners) bar.push('lecture');
  if (input.classReport && learners) bar.push('classReport');
  const more: ClassAction[] = [];
  if (input.notes && learners) more.push('notes');
  if (learners || input.relinksWaiting > 0) more.push('relink');
  if (input.moves && (learners || input.movesWaiting > 0)) more.push('moves');
  more.push('settings');
  return { bar, more };
}

/**
 * T4 line 2: "Practiced {when} · {n} min this week". With no readable day (an old summary) only the minutes, so the
 * card never reads "Practiced not yet".
 */
export function practicedLine(summary: { lastActiveAt: string | null; minutesLast7d: number }, now: Date, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.space.learner;
  const at = summary.lastActiveAt ? Date.parse(summary.lastActiveAt) : Number.NaN;
  if (Number.isNaN(at)) return words.minutesThisWeek(summary.minutesLast7d);
  return words.practiced(relativeDay(summary.lastActiveAt, now, locale), summary.minutesLast7d);
}
