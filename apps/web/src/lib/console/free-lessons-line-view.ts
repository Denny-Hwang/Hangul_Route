import { CATALOG, HORIZON_DAYS, addDays, dateKey, freeLessonsLine, planFreeFacts, type Catalog, type SpaceKind, type SpaceRole } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { PlanView, RosterLearner } from './api';
import type { SpaceCoverage } from './curriculum';
import { planReaches } from './plans';
import { ROUTES } from './routing';

/**
 * The free-lessons line on a console roster card (F-ENT-003 section 3.9.2, E3-12; wireframe
 * console/free-lessons-line A). The console has counts, not quest ids, so it shows only
 * `plan-waiting`: a live plan of this space that reaches the learner has every derived item
 * done (`planProgress[planId]`: `done === total > 0`, `notReady > 0`), holds lessons that open
 * with a paid plan the device really skipped, and has no open item still ahead of its derivation
 * horizon (`planFreeFacts` over the plan's own items; the horizon starts on the device's
 * derivation day, `horizonAnchor`). Only the space owner who can see the space's coverage reads it
 * (never a teacher or a co-caregiver who does not own the space), only for a space no Family
 * Plan or Group License covers, and only with the console's free-plan switch on. No new summary
 * field; the roster carries no tier.
 */
export interface RosterFreeLineInput {
  /** `contentGatingEnabled()`. */
  gating: boolean;
  /** The viewer's role in this space (`GET /api/spaces`); null while unknown. */
  role: SpaceRole | null;
  /** `spaceCoverage`: "uncovered" only when this viewer owns the space and can see every entitlement that could cover it. */
  coverage: SpaceCoverage;
  spaceKind: SpaceKind;
  learner: Pick<RosterLearner, 'id' | 'displayName' | 'summary' | 'lastSyncedAt'>;
  /** This space's live plans, newest published first (`livePublished`). */
  plans: readonly PlanView[];
  /** The console's date key (UTC, `dateKey`): the latest day a curriculum's horizon can start from (`horizonAnchor`). */
  today: string;
}

/** A date key from an ISO time, or null when it does not parse. */
const keyOf = (iso: string | null | undefined): string | null => {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(ms) ? null : dateKey(new Date(ms));
};

/**
 * The day a curriculum's horizon is measured from (review of E3-12, 2026-10-12). The device
 * derived `planProgress` with its own today at its last pass, not the console's: the earliest of
 * the console's today, the summary's `lastActiveAt` and the learner's `lastSyncedAt`, one day
 * earlier for the device's time zone. An earlier start can only move more open items "ahead"
 * and hide the line, never show a false one. Null when the summary carries neither date: then
 * a curriculum shows no line.
 */
export function horizonAnchor(input: Pick<RosterFreeLineInput, 'learner' | 'today'>): string | null {
  const known = [keyOf(input.learner.summary?.lastActiveAt), keyOf(input.learner.lastSyncedAt)].filter((key): key is string => key !== null);
  if (known.length === 0) return null;
  const earliest = [input.today, ...known].sort()[0] as string;
  return addDays(earliest, -1);
}

export interface RosterFreeLine {
  text: string;
  /** **Open billing**: the console's Billing route (F-BILL-002 owns the page). */
  billing: { label: string; href: string };
}

export function rosterFreeLessonsLine(input: RosterFreeLineInput, locale: UiLocale = DEFAULT_LOCALE, source: Catalog = CATALOG): RosterFreeLine | null {
  const progress = input.learner.summary?.planProgress ?? {};
  const anchor = horizonAnchor(input);
  const plans = input.plans
    .filter((plan) => planReaches(plan, input.learner.id))
    .flatMap((plan) => {
      const row = progress[plan.id];
      if (!row) return [];
      // A curriculum without a known derivation day: the console cannot tell what is ahead, so it never guesses.
      if (plan.meta && anchor === null) return [];
      const horizonEnd = plan.meta && anchor !== null ? addDays(anchor, plan.meta.horizonDays ?? HORIZON_DAYS) : null;
      return [{ done: row.done, total: row.total, notReady: row.notReady, ...planFreeFacts(plan.items, source, horizonEnd) }];
    });
  const covered = input.coverage === 'unknown' ? null : input.coverage === 'covered';
  const line = freeLessonsLine({ gating: input.gating, owner: input.role === 'owner', covered, spaceKind: input.spaceKind, plans });
  if (line?.code !== 'plan-waiting') return null;
  const words = getMessages(locale).console.access;
  return {
    text: words.planWaiting(input.learner.displayName, line.closed, words.product[line.product]),
    billing: { label: words.openBilling.cta, href: ROUTES.billing },
  };
}
