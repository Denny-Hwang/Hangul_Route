import type { RouteNext } from '../route-next';

/**
 * The Home "Take the level check" card (F-PLC-001 section 3.10): a quiet
 * card below the mission cards. No streak or guilt copy; "Not now" hides it.
 *
 * Owner request 2026-10-16 (item 8, Home): the rest of Home's show-or-hide rules live here too, pure, so
 * they are unit-tested: the Next lesson hero, the streak pill, the tip, Recent stars and the Homework card's
 * title.
 */

/**
 * Without a decline the card disappears once this many quests are complete; after "I am new to Korean" it waits
 * for this many and is offered from then on (owner request 2026-10-16, item 8).
 */
export const HOME_CARD_MAX_QUESTS = 3;

export interface LevelCheckCardInput {
  /** `flags.placementEnabled`. */
  enabled: boolean;
  /** The bank parsed at start; a failure hides every entry point (section 3.11). */
  bankReady: boolean;
  /** The active profile has a stored result. */
  hasResult: boolean;
  /** Completed quests of the active profile. */
  questsDone: number;
  /** `placement-ui:<profileId>.dismissedAt`. */
  dismissedAt: string | undefined;
  /** `placement-ui:<profileId>.declinedAt`: the invite's "I am new to Korean". */
  declinedAt?: string | undefined;
  /** A saved run can be offered as Continue. */
  resumable: boolean;
}

/** `take` ("Take the level check"), `continue` ("Continue the level check"), or null (hidden). */
export function levelCheckCard(input: LevelCheckCardInput): 'take' | 'continue' | null {
  if (!input.enabled || !input.bankReady || input.hasResult) return null;
  if (input.dismissedAt !== undefined && input.dismissedAt !== '') return null;
  const declined = input.declinedAt !== undefined && input.declinedAt !== '';
  // "I am new to Korean" was just said (owner request 2026-10-16, item 8): Home does not ask "Already know some
  // Korean?" right after. The card stays hidden until the first three quests are done, and is offered from then on
  // (a learner who said "new" may find the check useful once they have played), until Not now or a result.
  if (declined) return input.questsDone < HOME_CARD_MAX_QUESTS ? null : input.resumable ? 'continue' : 'take';
  if (input.questsDone >= HOME_CARD_MAX_QUESTS) return null;
  return input.resumable ? 'continue' : 'take';
}

/**
 * At most one quiet card between the mission cards and the route strip: the
 * level-check card while it is eligible, then F-PLAN-002's weekly-plan prompt.
 */
export function homeQuietCard(
  levelCheck: 'take' | 'continue' | null,
  planPromptEligible: boolean,
): 'level-check' | 'plan-prompt' | null {
  if (levelCheck !== null) return 'level-check';
  return planPromptEligible ? 'plan-prompt' : null;
}

/** The Next lesson hero above the three mission cards: F-ENT-003's one next, with its length and one button. */
export interface HomeNextLesson {
  questId: string;
  episodeId: string;
  /** "About n minutes": the quest's own estimate, at least 1. */
  minutes: number;
  /** Start before the first quest is done; Continue after. */
  cta: 'start' | 'continue';
}

/**
 * The hero names `routeNext`'s quest (the same quest as Home card 2, the Learning Route card and Results), so
 * a brand-new learner's first card is the next lesson, not a story. Nothing when the one next is not a quest
 * (the free-end and rest states keep their own cards) or the quest is not in this build.
 */
export function homeNextLesson(input: {
  next: RouteNext | null;
  questOf: (questId: string) => { estimatedMinutes: number } | undefined;
  questsDone: number;
}): HomeNextLesson | null {
  const next = input.next;
  if (next === null || next.kind !== 'quest') return null;
  const quest = input.questOf(next.questId);
  if (quest === undefined) return null;
  return {
    questId: next.questId,
    episodeId: next.episodeId,
    minutes: Math.max(1, Math.round(quest.estimatedMinutes)),
    cta: input.questsDone === 0 ? 'start' : 'continue',
  };
}

/**
 * Card (2) drawn in its compact form (AMENDMENTS-DISPLAY-NAV section 9.1): a mission card that names the hero's own
 * lesson, not yet collected, is one quiet row that is not a button ("Same as your next lesson above"), so Home never
 * offers the same lesson twice. The slots, their order and their completion stay F-HW-001's; a replay card (a quest
 * already done) is never the hero's lesson, and a collected card keeps its collected look.
 */
export function isSameAsHero(card: { kind: string; questId?: string; collected: boolean }, hero: Pick<HomeNextLesson, 'questId'> | null): boolean {
  return hero !== null && card.questId === hero.questId && !card.collected && card.kind !== 'replay';
}

/** The streak pill waits for the first day: "Streak 0 days" is never shown. */
export function showStreakPill(streak: number): boolean {
  return streak >= 1;
}

/**
 * Hoya's tip under the Homework card, by state; never "keep your streak alive" (no loss framing):
 * `first` before any quest is done, `doneToday` once any learning activity counted today (on the local day, as
 * the streak reads it: F-CURR-002 OD-14), `daily` otherwise.
 */
export type HomeTip = 'first' | 'doneToday' | 'daily';

export function homeTip(input: { questsDone: number; playedToday: boolean }): HomeTip {
  if (input.questsDone === 0) return 'first';
  return input.playedToday ? 'doneToday' : 'daily';
}

/** Recent stars: the stars of the newest quest that earned any; null (the card hides) until there is a star. */
export function recentStarsOf(quests: readonly { stars: number }[]): 1 | 2 | 3 | null {
  for (let i = quests.length - 1; i >= 0; i -= 1) {
    const stars = quests[i]?.stars ?? 0;
    if (stars >= 1) return Math.min(3, Math.floor(stars)) as 1 | 2 | 3;
  }
  return null;
}

/**
 * The Homework card's title: Homework while a grown-up's or a class's assignment for this learner is open, Review
 * otherwise. The learner's own weekly plan (`assignedBy: 'system'`, `ASSIGNED_BY.self`) is not homework, and another
 * profile's rows never count.
 */
export function homeworkCardTitle(
  assignments: readonly { completedAt?: string | undefined; profileId: string; assignedBy: 'parent' | 'teacher' | 'system' }[] | undefined,
  profileId: string | undefined,
): 'homework' | 'review' {
  return (assignments ?? []).some((a) => !a.completedAt && a.profileId === profileId && a.assignedBy !== 'system') ? 'homework' : 'review';
}
