import { APP_ROUTES, type AdultPersona, type SpaceKind } from '@hangul-route/content-schema';
import type { SpaceListItem } from './api';
import { spaceIdFrom } from './routing';
import { personasOfSpaces } from './signin-flow';

/**
 * Personas on grown-up pages (F-APP-001 sections 3.5 and 3.8; design/screens/app-shell/adult-frame.md).
 * Pure: the adult frame reads the spaces list once and asks these functions which persona a page
 * belongs to, which home the brand and the switch open, and when the last persona is written.
 */

/**
 * Whether `/parent` is the real family home (F-APP-001 A-5b). While it is still the demo on mock
 * data, the Family persona's home stays the console home (`/teach/home`, which lists the account's
 * family spaces too), so no real account is sent to mock data. A-5b sets this to true with the
 * real home and then removes it.
 */
export const FAMILY_HOME_LIVE = false;

/** The home of a persona: `/parent` for Family, `/teach/home` for Teacher (section 3.5). */
export function personaHome(persona: AdultPersona, live: boolean = FAMILY_HOME_LIVE): string {
  return persona === 'parent' && live ? APP_ROUTES.parentHome : APP_ROUTES.teacherHome;
}

/** The persona a space belongs to (section 3.8): a family is Family; a class or a school is Teacher. */
export function personaOfKind(kind: SpaceKind): AdultPersona {
  return kind === 'family' ? 'parent' : 'teacher';
}

/** The personas the account holds, from `GET /api/spaces` (Family first); none while the list is unknown. */
export function heldPersonas(spaces: readonly SpaceListItem[] | null): AdultPersona[] {
  return spaces ? personasOfSpaces(spaces) : [];
}

/** Where a page sits: a persona home, a page of one space (`?id=`), or a page of no persona. */
export type PageArea = { kind: 'home'; persona: AdultPersona } | { kind: 'space'; spaceId: string } | { kind: 'other' };

const PARENT_HOME = /^\/parent(?:\/|\.html)?$/;
const TEACHER_HOME = /^\/teach\/home(?:\/|\.html)?$/;
const SPACE_PAGE = /^\/(?:teach|parent)\/space(?:\.html|\/.*)?$/;

export function pageArea(pathname: string, search: string): PageArea {
  if (PARENT_HOME.test(pathname)) return { kind: 'home', persona: 'parent' };
  if (TEACHER_HOME.test(pathname)) return { kind: 'home', persona: 'teacher' };
  if (SPACE_PAGE.test(pathname)) return { kind: 'space', spaceId: spaceIdFrom(new URLSearchParams(search)) };
  return { kind: 'other' };
}

/**
 * The persona whose items fill the nav when the page itself does not say: the last persona when the
 * account holds it, else the first it holds, else Family (OD-11). While the spaces list is unknown
 * (`held` null), the last persona as remembered, Family when none (design pass D16).
 */
export function fallbackPersona(last: AdultPersona | null, held: readonly AdultPersona[] | null): AdultPersona {
  if (!held) return last ?? 'parent';
  if (last && held.includes(last)) return last;
  return held[0] ?? 'parent';
}

/** The active persona of a page; `resolved` is false while it is only a guess (no option checked, no item highlighted). */
export interface ActivePersona {
  persona: AdultPersona;
  resolved: boolean;
}

/**
 * The active persona (section 3.8): the page persona on a home; the kind of the page space on a
 * space page under either prefix (never the path); the fallback elsewhere. On a home the account
 * does not hold (the "not set up yet" states) the nav keeps the persona it holds. While `/parent`
 * is the demo, the console home is the home of a Family-only account as well.
 */
export function activePersona(input: { area: PageArea; spaces: readonly SpaceListItem[] | null; last: AdultPersona | null; live?: boolean }): ActivePersona {
  const { area, spaces, last, live = FAMILY_HOME_LIVE } = input;
  const held = spaces ? heldPersonas(spaces) : null;
  if (area.kind === 'home') {
    if (!held || held.length === 0 || held.includes(area.persona)) return { persona: area.persona, resolved: true };
    return { persona: live ? (held[0] as AdultPersona) : fallbackPersona(last, held), resolved: true };
  }
  if (area.kind === 'space') {
    const space = spaces?.find((entry) => entry.space.id === area.spaceId)?.space;
    if (space && (space.kind === 'family' || space.kind === 'class' || space.kind === 'school')) return { persona: personaOfKind(space.kind), resolved: true };
    return { persona: fallbackPersona(last, null), resolved: false };
  }
  return { persona: fallbackPersona(last, held), resolved: held !== null };
}

/** The persona switch: only for an account that holds both personas (section 3.8), once each has a home of its own. */
export function showPersonaSwitch(held: readonly AdultPersona[], live: boolean = FAMILY_HOME_LIVE): boolean {
  return live && held.includes('parent') && held.includes('teacher');
}

/**
 * The last persona to write (section 3.5): the persona of a home that renders with that persona
 * held; nothing on other pages or before the spaces are known. While `/parent` is the demo, the
 * console home records Family for an account that holds only Family.
 */
export function homeToRecord(area: PageArea, active: ActivePersona, held: readonly AdultPersona[], live: boolean = FAMILY_HOME_LIVE): AdultPersona | null {
  if (area.kind !== 'home' || !active.resolved || !held.includes(active.persona)) return null;
  return active.persona === area.persona || !live ? active.persona : null;
}
