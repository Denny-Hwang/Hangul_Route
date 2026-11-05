import { DEFAULT_LOCALE, describeRelativeDay, getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * The class page's order and buttons (AMENDMENTS-GROWNUP-UX GX-7, section 8 T3 to T5; wireframe
 * `design/wireframes/console/roster.md` "Class page order (GX-7)"). Pure: the page draws what this returns.
 *
 * T3: the action bar keeps the plan (primary), the term plan, Lecture mode and the class report in view; More holds
 * Notes, the new-device (re-link) entry, Class moves and Settings. T5: an empty class leaves out what needs a learner
 * (Re-link, Class moves, Notes, Lecture mode, and the class report, which the roll-up only ever showed with learners),
 * except an entry that has something waiting: a move into an empty class is how a new class often fills. An entry with
 * something waiting (new devices, class moves) moves out of More into the bar, after the everyday buttons, until it is
 * answered.
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
  // A waiting entry stands in the bar, its count in words on the button, never folded behind More (GX-7 review: the
  // owner found a count tucked away, "re-link requests 1", easy to miss). It folds back under More once nothing waits.
  if (input.relinksWaiting > 0) bar.push('relink');
  else if (learners) more.push('relink');
  if (input.moves && input.movesWaiting > 0) bar.push('moves');
  else if (input.moves && learners) more.push('moves');
  more.push('settings');
  return { bar, more };
}

/**
 * T4 line 2: "Practiced {when} · {n} min this week". With no readable day (an old summary) only the minutes, so the
 * card never reads "Practiced not yet". A day inside the last week is the whole weekday ("Wednesday"): the short form
 * is one character in Korean, which reads ambiguously alone on a card (GX-7 review).
 */
export function practicedLine(summary: { lastActiveAt: string | null; minutesLast7d: number }, now: Date, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.space.learner;
  const at = summary.lastActiveAt ? Date.parse(summary.lastActiveAt) : Number.NaN;
  if (Number.isNaN(at)) return words.minutesThisWeek(summary.minutesLast7d);
  const when = describeRelativeDay(locale, getMessages(locale).common.time, summary.lastActiveAt, now, 'weekdayLong');
  return words.practiced(when, summary.minutesLast7d);
}
