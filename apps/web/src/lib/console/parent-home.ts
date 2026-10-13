import type { RosterLearner, SpaceListItem } from './api';
import { heldPersonas } from './personas';
import { ROUTES } from './routing';

/**
 * What the family home `/parent` draws (F-APP-001 A-5b, section 3.8; design/screens/app-shell/parent-home.md).
 * Pure: the page reads `GET /api/spaces` and one roster per family and renders this view. No
 * ranking: learners keep the order they joined in, whatever their activity (section 3.17).
 */

export type ParentHomeView =
  /** The account holds no family persona: Set up my family, and Go to Classes for a teacher. */
  | { state: 'noFamily'; goTeacher: boolean }
  /** One section per family space; the quiet cross-link at the bottom. */
  | { state: 'families'; families: SpaceListItem[]; cross: 'addClass' | 'toTeacher' };

const byCreatedThenId = (a: SpaceListItem, b: SpaceListItem): number => a.space.createdAt.localeCompare(b.space.createdAt) || a.space.id.localeCompare(b.space.id);

export function parentHomeView(items: readonly SpaceListItem[]): ParentHomeView {
  const held = heldPersonas(items);
  const holdsTeacher = held.includes('teacher');
  const families = items.filter((entry) => entry.space.kind === 'family' && (entry.role === 'owner' || entry.role === 'caregiver'));
  if (families.length === 0) return { state: 'noFamily', goTeacher: holdsTeacher };
  return { state: 'families', families: [...families].sort(byCreatedThenId), cross: holdsTeacher ? 'toTeacher' : 'addClass' };
}

/** Learners in the order they joined the family (`joinedAt`, then id): stable, never by activity or minutes. */
export function joinOrder(learners: readonly RosterLearner[]): RosterLearner[] {
  return [...learners].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.id.localeCompare(b.id));
}

/** The sibling flags a learner card reads (section 3.8), each off by default. */
export interface CardFlags {
  reports: boolean;
  notes: boolean;
  route: boolean;
}

export interface CardAction {
  key: 'seeReport' | 'open' | 'sendNote' | 'route';
  href: string;
}

/**
 * A learner card's actions: **See report** with reports on, else **Open** (the family roster); then
 * **Send a note** (the composer with this learner preselected) and **Learning Route**, each by flag.
 * The learner report keeps F-REPORT-001's own family address until its RP-7c.
 */
export function learnerCardActions(familyId: string, learnerId: string, flags: CardFlags): { primary: CardAction; secondary: CardAction[] } {
  const primary: CardAction = flags.reports
    ? { key: 'seeReport', href: ROUTES.learnerReport({ spaceId: familyId, learnerId, kind: 'family', from: 'home' }) }
    : { key: 'open', href: ROUTES.space(familyId, 'family') };
  const secondary: CardAction[] = [];
  if (flags.notes) secondary.push({ key: 'sendNote', href: ROUTES.spaceNotes(familyId, 'family', { compose: true, learner: learnerId }) });
  if (flags.route) secondary.push({ key: 'route', href: ROUTES.learnerRoute(familyId, learnerId, 'family') });
  return { primary, secondary };
}

/** The family actions under the cards (Lessons and Add a learner are buttons the page draws). */
export function familyActionLinks(familyId: string): { planWeek: string; planTerm: string; settings: string } {
  return {
    planWeek: ROUTES.spacePlan(familyId, undefined, 'family'),
    planTerm: ROUTES.spaceCurriculum(familyId, 'family'),
    settings: ROUTES.spaceSettings(familyId, 'family'),
  };
}
