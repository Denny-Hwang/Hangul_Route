import { CATALOG, HORIZON_DAYS, addDays, freeLessonsLine, planFreeFacts, type Catalog, type SpaceKind, type SpaceRole } from '@hangul-route/content-schema';
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
 * with a paid plan, and has no open item still ahead of its derivation horizon (`planFreeFacts`
 * over the plan's own items). Only the space owner who can see the space's coverage reads it
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
  learner: Pick<RosterLearner, 'id' | 'displayName' | 'summary'>;
  /** This space's live plans, newest published first (`livePublished`). */
  plans: readonly PlanView[];
  /** The console's date key: a curriculum's derivation horizon ends `horizonDays` after it. */
  today: string;
}

export interface RosterFreeLine {
  text: string;
  /** **Open billing**: the console's Billing route (F-BILL-002 owns the page). */
  billing: { label: string; href: string };
}

export function rosterFreeLessonsLine(input: RosterFreeLineInput, locale: UiLocale = DEFAULT_LOCALE, source: Catalog = CATALOG): RosterFreeLine | null {
  const progress = input.learner.summary?.planProgress ?? {};
  const plans = input.plans
    .filter((plan) => planReaches(plan, input.learner.id))
    .flatMap((plan) => {
      const row = progress[plan.id];
      if (!row) return [];
      const horizonEnd = plan.meta ? addDays(input.today, plan.meta.horizonDays ?? HORIZON_DAYS) : null;
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
