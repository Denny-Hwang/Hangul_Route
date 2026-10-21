import type { RosterLearner, SpaceListItem } from './api';
import { lectureCardView, type LectureCardView } from './lecture-entry';
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

/** An archived family: its pages stay reachable read-only; the home labels it and offers Family settings only. */
export function isArchivedFamily(family: SpaceListItem): boolean {
  return family.space.archivedAt !== null;
}

/** Only the owner makes and sees the family join code (`space.manage`; a caregiver's roster has no code). */
export function managesJoinCode(family: SpaceListItem): boolean {
  return family.role === 'owner';
}

/** Families held as owner or caregiver: the live ones first, then the archived ones, each oldest first, then by id. */
export function parentHomeView(items: readonly SpaceListItem[]): ParentHomeView {
  const held = heldPersonas(items);
  const holdsTeacher = held.includes('teacher');
  const families = items.filter((entry) => entry.space.kind === 'family' && (entry.role === 'owner' || entry.role === 'caregiver'));
  if (families.length === 0) return { state: 'noFamily', goTeacher: holdsTeacher };
  const live = families.filter((family) => !isArchivedFamily(family)).sort(byCreatedThenId);
  const archived = families.filter(isArchivedFamily).sort(byCreatedThenId);
  return { state: 'families', families: [...live, ...archived], cross: holdsTeacher ? 'toTeacher' : 'addClass' };
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
 * See report opens the learner report at `/parent/learner` on the week, `from=home` (F-REPORT-001 RP-7c).
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

/**
 * The Lecture mode card on the family home (AMENDMENTS-LECTURE-V2 E2, LV-5): the families the account composes in
 * (owner or caregiver, live, most recent first) give one, several or no space. Null while `lectureModeEnabled()` is
 * off: the card is not drawn at all.
 */
export function familyLectureCard(items: readonly SpaceListItem[] | 'failed' | null, opts: { enabled: boolean; appUrl: string }): LectureCardView | null {
  return opts.enabled ? lectureCardView(items, 'parent', opts.appUrl) : null;
}

/**
 * Where the family home draws its one card (design/screens/app-shell/lecture-card.md "Placement", measured at
 * 375 x 667): from 70em (`wide`) first in the first family's side column, level with the learner cards and above the
 * family actions; below it in the first family's card grid right after the last card of its first row (one column
 * below 45em: directly after the first learner card or loading card, so the first screen keeps that whole card and
 * shows the top of this one), so the order on screen is the order in the page (`firstRowEnd`); with no card to follow
 * (a family with no learner yet, a roster that did not load), at the end of the family's main column.
 */
export type LectureSlot = 'side' | 'afterFirstRow' | 'afterMain';

export function lectureCardSlot(wide: boolean, cards: number): LectureSlot {
  if (wide) return 'side';
  return cards > 0 ? 'afterFirstRow' : 'afterMain';
}

/** The index of the card the Lecture mode card follows: the last card of the grid's first row of `columns`. */
export function firstRowEnd(cards: number, columns: number): number {
  const perRow = Number.isFinite(columns) && columns >= 1 ? Math.floor(columns) : 1;
  return Math.max(0, Math.min(cards, perRow) - 1);
}

/** The column count of a grid from its computed `grid-template-columns` ("288px 288px"); one when there is none. */
export function gridColumnCount(template: string): number {
  const tracks = template.trim() === '' || template.trim() === 'none' ? [] : template.trim().split(/\s+/);
  return Math.max(1, tracks.length);
}
