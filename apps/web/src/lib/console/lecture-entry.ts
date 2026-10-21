import type { AdultPersona, SpaceKind } from '@hangul-route/content-schema';
import type { SpaceListItem } from './api';
import { personaHome } from './personas';
import { ROUTES } from './routing';

/**
 * Where Lecture mode is found (AMENDMENTS-LECTURE-V2 section 3, entry points E1 to E3, row LV-5;
 * design/screens/app-shell/lecture-card.md): the card on the teacher home and the family home, and the nav item of
 * both personas. Pure, and kept apart from `lecture.ts` (the setup page's half, which carries the catalogue) so the
 * frame on every grown-up page can read it. Ids only in every link: a space's name is drawn on the card, never put
 * in a URL.
 */

/** The card's id on both homes: the nav item's target with zero or several spaces (`/parent#lecture-mode`). */
export const LECTURE_CARD_ID = 'lecture-mode';

/**
 * The roles that compose plans (F-TCH-004 section 3.11; `plan.write` in `packages/backend/src/lib/can.ts`): a class
 * `teacher`, a family `caregiver`, or the owner of either. A school admin reaching a child class through the school
 * composes in none of them.
 */
export function composesIn(entry: SpaceListItem): boolean {
  if (entry.space.kind === 'class') return entry.role === 'teacher' || entry.role === 'owner';
  if (entry.space.kind === 'family') return entry.role === 'caregiver' || entry.role === 'owner';
  return false;
}

/** The space kind each persona teaches in: classes under Teacher, families under Family (F-APP-001 section 3.8). */
const PERSONA_KIND: Record<AdultPersona, SpaceKind> = { teacher: 'class', parent: 'family' };

/**
 * The spaces a persona's Lecture mode entries offer: of the persona's kind, where the account composes
 * (`composesIn`), not archived (an archived space is read-only and its home row is labelled so; its own page keeps its
 * Lecture mode button), most recent first, then by id. No counts and no ranking reach the card.
 */
export function lectureSpaces(spaces: readonly SpaceListItem[], persona: AdultPersona): SpaceListItem[] {
  return spaces
    .filter((entry) => entry.space.kind === PERSONA_KIND[persona] && !entry.space.archivedAt && composesIn(entry))
    .sort((a, b) => b.space.createdAt.localeCompare(a.space.createdAt) || a.space.id.localeCompare(b.space.id));
}

/** A space's lecture setup page (presets first, LV-4): `/teach/space/lecture?id=` or `/parent/space/lecture?id=`. */
export function lectureHref(entry: SpaceListItem): string {
  return ROUTES.spaceLecture(entry.space.id, undefined, undefined, entry.space.kind);
}

/** The presenter's home on the learner web app: presets work with no space and no sign-in (F-TCH-004 TD2). */
export function presentHref(appUrl: string): string {
  return `${appUrl}/present`;
}

export interface LectureChoice {
  id: string;
  /** The space's own name, drawn as the radio row's label only. */
  name: string;
  href: string;
}

/**
 * What the card draws (section 3, E1 and E2):
 * - `loading`: the spaces list has not answered; Start waits (Loading…), so nothing jumps.
 * - `none`: no space to teach in, or the list failed; the no-space line, and Start opens the presenter in a new tab.
 * - `one`: Start opens that space's setup page.
 * - `several`: a choice of spaces (most recent first, the first chosen), and Start opens the chosen one's setup page.
 */
export type LectureCardView =
  | { state: 'loading' }
  | { state: 'none'; href: string }
  | { state: 'one'; href: string }
  | { state: 'several'; choices: LectureChoice[] };

/** The card's view from the home's spaces list (`null` while it loads, `'failed'` when it did not answer). */
export function lectureCardView(spaces: readonly SpaceListItem[] | 'failed' | null, persona: AdultPersona, appUrl: string): LectureCardView {
  if (spaces === null) return { state: 'loading' };
  const own = spaces === 'failed' ? [] : lectureSpaces(spaces, persona);
  const [first] = own;
  if (!first) return { state: 'none', href: presentHref(appUrl) };
  if (own.length === 1) return { state: 'one', href: lectureHref(first) };
  return { state: 'several', choices: own.map((entry) => ({ id: entry.space.id, name: entry.space.name, href: lectureHref(entry) })) };
}

/**
 * The nav item's target (E3): the persona's one space's setup page; with zero or several, the persona home at the
 * card (`#lecture-mode`), where the card offers the choice or the no-space path.
 */
export function lectureNavHref(spaces: readonly SpaceListItem[], persona: AdultPersona): string {
  const own = lectureSpaces(spaces, persona);
  const [only] = own;
  return only && own.length === 1 ? lectureHref(only) : `${personaHome(persona)}#${LECTURE_CARD_ID}`;
}
