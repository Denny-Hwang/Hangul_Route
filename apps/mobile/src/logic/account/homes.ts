import { describeRelativeDay, type Messages, type UiLocale } from '@hangul-route/i18n';
import type { AccountApiError } from './api';
import type { AccountRoster, AccountRosterLearner, AccountSpaceItem } from './account-data';
import { ACCOUNT_ROUTE_NAMES } from './account-gate';
import { orderLearners, orderSpaces } from './order';

/**
 * F-AUTH-004 sections 6.6, 8.2, 8.8 and 15 (row NS-5; design `homes.md` boards 1 to 7 and 15 to 19, D10, D11, D18;
 * anti-shame, CLAUDE.md section 1): the native homes in words and rules, pure. The Family home
 * (`FamilyHome.native.tsx`) reads `GET /api/spaces`, one roster per family and the plan status, and draws what these
 * return; the states, the event's bucket and where Sign out lands are every home's (row NS-6 adds the Teacher home).
 *
 * - **Families**: every family space where the account is `owner` or `caregiver`, live ones first, then archived ones,
 *   each oldest first (`orderSpaces`), whatever order the server sent.
 * - **Learners**: in the order they joined (`orderLearners`), never by activity, minutes or progress.
 * - **The code panel**: only the owner manages a family's code (`space.manage`); an archived family shows none.
 */

/** The families of the Family home, in their fixed order. */
export function familiesOf(items: readonly AccountSpaceItem[]): AccountSpaceItem[] {
  return orderSpaces(items.filter((item) => item.space.kind === 'family' && (item.role === 'owner' || item.role === 'caregiver')));
}

/** Only the owner makes and sees a family's code (the Worker sends it with `space.manage`; a caregiver's has none). */
export function managesCode(item: AccountSpaceItem): boolean {
  return item.role === 'owner';
}

/**
 * The code panel of one family (section 8.2, D11): the code (when the server sent one), **Make a code** for the owner
 * when there is no live code, `askOwner` for anyone else; none on an archived family.
 */
export type CodePanel = { kind: 'code'; code: string } | { kind: 'make' } | { kind: 'ask' } | { kind: 'none' };

export function codePanelOf(item: AccountSpaceItem, roster: AccountRoster | null): CodePanel {
  if (item.space.archivedAt !== null) return { kind: 'none' };
  if (!managesCode(item)) return { kind: 'ask' };
  const code = item.joinCode ?? roster?.joinCode ?? null;
  return code === null ? { kind: 'make' } : { kind: 'code', code };
}

/** D11: the code drawn as two groups of three that never break inside a group (`K7M PQ4`). */
export function codeGroups(code: string): [string, string] {
  return [code.slice(0, 3), code.slice(3)];
}

/** D11: the characters passed spaced (`K 7 M P Q 4`) to `a11y.account.joinCode`, so a screen reader spells them. */
export function spelledCode(code: string): string {
  return code.split('').join(' ');
}

/** D11: the advance of one character of the code's monospace face, in ems (Menlo's is 0.602). */
export const CODE_ADVANCE_EM = 0.602;

/**
 * D11, section 14: the code's font size for a row `available` points wide, each character tracked by `tracking`. A group of three characters must fit on one
 * line, so the size steps down from `display` to fit, and never below `body` (a group wider still wraps by groups,
 * never inside one). Before the row is measured (`available` 0) it is `display`. `minimumFontScale` is iOS only, so the
 * floor is computed here for both platforms.
 */
export function codeFontSize(available: number, display: number, body: number, tracking: number): number {
  if (!(available > 0)) return display;
  const fits = (available - 3 * tracking) / (3 * CODE_ADVANCE_EM);
  return Math.max(body, Math.min(display, Math.floor(fits)));
}

/** One learner card (D10): the name, the last-active line, and the minutes line once the learner has started. */
export interface LearnerCardView {
  id: string;
  name: string;
  lastActive: string;
  minutes: string | null;
}

/**
 * Whether a learner has never practised, as the console's card reads it (`childWeek`): no summary on the server, or the
 * report's `empty` state (no practice day; on an older summary with no day-by-day data, no quest, card, stage or
 * last-active time), except an older summary that still counts minutes.
 */
export function notStarted(learner: AccountRosterLearner): boolean {
  const summary = learner.summary;
  if (summary === null) return true;
  if (summary.activity) return summary.activity.total.days === 0;
  const journeyDone = (summary.journey?.stages ?? []).reduce((total, row) => total + row.done, 0);
  const empty = !summary.stage1?.questsDone && !summary.cardsUnlocked && journeyDone === 0 && !summary.lastActiveAt;
  return empty && !((summary.minutesLast7d ?? 0) > 0);
}

/** The learner cards of one family, in join order, with the console's words (D10). */
export function learnerCards(roster: AccountRoster, now: Date, locale: UiLocale, m: Messages): LearnerCardView[] {
  return orderLearners(roster.learners).map((learner) => {
    if (notStarted(learner)) return { id: learner.id, name: learner.displayName, lastActive: m.console.parentHome.lastActive.notStarted, minutes: null };
    const when = describeRelativeDay(locale, m.common.time, learner.summary?.lastActiveAt || learner.lastActiveAt, now);
    return {
      id: learner.id,
      name: learner.displayName,
      lastActive: m.console.space.learner.lastActive(when),
      minutes: m.console.parentHome.minutes7d(learner.summary?.minutesLast7d ?? 0),
    };
  });
}

/** What a home or report draws for a read that failed (section 8.8). */
export type LoadFailure = 'offline' | 'unauthorized' | 'unavailable' | 'cant_load';

export function loadFailureOf(error: AccountApiError): LoadFailure {
  if (error === 'offline') return 'offline';
  if (error === 'unauthorized') return 'unauthorized';
  if (error === 'native_off') return 'unavailable';
  return 'cant_load';
}

/** A read that failed, thrown by a home's query so the screen knows why (`failureOf`). */
export class AccountLoadError extends Error {
  readonly error: AccountApiError;

  constructor(error: AccountApiError) {
    super(error);
    this.name = 'AccountLoadError';
    this.error = error;
  }
}

/** Why a query failed: its `AccountLoadError`, or `cant_load` for anything else (an answer that did not parse). */
export function failureOf(error: unknown): LoadFailure {
  return loadFailureOf(error instanceof AccountLoadError ? error.error : 'error');
}

/**
 * Section 8.8: the one failure a screen draws when several reads failed. A session that ended (`401`) wins (the
 * records go and the sign-in opens), then the Worker's switch (`unavailable`), then offline, then any other.
 */
export function worstFailure(failures: readonly LoadFailure[]): LoadFailure | null {
  for (const failure of ['unauthorized', 'unavailable', 'offline', 'cant_load'] as const) if (failures.includes(failure)) return failure;
  return null;
}

/**
 * Section 6.6: where a home's Sign out lands. The Grown-up area when it is under the home (Back to it); on a device
 * with no learner profile (the home was opened from Welcome) Welcome, by leaving the area; else the Grown-up area in
 * the home's place (a chooser row opened the home first in its stack).
 */
export type SignOutLanding = 'area_below' | 'welcome' | 'area_here';

export function signOutLanding(routes: readonly { name: string }[], hasLearnerProfile: boolean): SignOutLanding {
  if (routes.some((route) => route.name === 'ParentDashboard')) return 'area_below';
  return hasLearnerProfile ? 'area_here' : 'welcome';
}

/**
 * Sections 6.6 and 8.8 (`401` on a page above a home): the stack after the session ended elsewhere. The run of account
 * routes the page sits in (a home and the report above it) gives way to one sign-in, so the sign-in that follows opens
 * a fresh home in their place and Back never returns to a page of the ended session. Routes below (the Grown-up area)
 * stay. A page not found keeps the whole stack and adds the sign-in.
 */
export function routesAfterEndedSession<R extends { key: string; name: string }>(routes: readonly R[], key: string): R[] {
  const index = routes.findIndex((route) => route.key === key);
  if (index < 0) return [...routes];
  let start = index;
  while (start > 0 && ACCOUNT_ROUTE_NAMES.has(routes[start - 1]!.name)) start -= 1;
  return routes.slice(0, start);
}

/** `auth.native.home`'s `spaces`: how many spaces the home listed, as a bucket, never the count (section 15). */
export function spacesBucket(count: number): '0' | '1' | '2-4' | '5+' {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  return count <= 4 ? '2-4' : '5+';
}
