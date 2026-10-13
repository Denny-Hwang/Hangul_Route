import type { RosterLearner, SpaceListItem } from './api';
import { joinOrder, parentHomeView } from './parent-home';
import { ROUTES } from './routing';

/**
 * The parent chooser (F-REPORT-001 RP-7c, section 3.1; design `design/screens/reports/learner-report.md`, States:
 * "parent chooser"): `/parent/learner` with no `learner` lists the learners of the account's family spaces. The order
 * is the family home's (families live first, each oldest first; learners in the order they joined), so no row is ever
 * placed by a figure (anti-ranking). A row opens that learner's report on the week, `from=nav`. Pure.
 */

/** One chooser row: ids only in the link; the name and avatar are drawn, never put in the URL. */
export interface ParentChooserRow {
  key: string;
  href: string;
  name: string;
  avatar: string;
}

/** The family spaces held as owner or caregiver, in the family home's order (live first, oldest first). */
export function parentChooserFamilies(spaces: readonly SpaceListItem[]): SpaceListItem[] {
  const view = parentHomeView(spaces);
  return view.state === 'families' ? view.families : [];
}

/** One row per learner of each family whose roster loaded (`rosters` by space id), family by family. */
export function parentChooserRows(families: readonly SpaceListItem[], rosters: ReadonlyMap<string, readonly RosterLearner[]>): ParentChooserRow[] {
  return families.flatMap((family) =>
    joinOrder(rosters.get(family.space.id) ?? []).map((learner) => ({
      key: `${family.space.id}/${learner.id}`,
      href: ROUTES.learnerReport({ spaceId: family.space.id, learnerId: learner.id, kind: 'family', from: 'nav' }),
      name: learner.displayName,
      avatar: learner.avatar,
    })),
  );
}
