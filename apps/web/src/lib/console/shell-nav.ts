import type { AdultPersona } from '@hangul-route/content-schema';
import type { Messages, UiLocale } from '@hangul-route/i18n';
import type { SpaceListItem } from './api';
import { browseEntryShown, buildEnv, notesEnabled, reportsEnabled, type ConsoleEnv } from './config';
import { personaHome } from './personas';
import { ROUTES } from './routing';

/**
 * The adult navigation registry (F-APP-001 section 3.8; design/screens/app-shell/adult-frame.md).
 * This spec registers every item, so the frame never depends on a sibling adding itself; an item
 * whose predicate is off is not drawn (never a disabled "coming soon" button).
 */

export type NavId = 'home' | 'reports' | 'notes' | 'classes' | 'lessons' | 'billing';

/**
 * A link. `document` marks a learner root of this origin (Lessons opens All lessons at `/browse`, F-BROWSE-001), a
 * plain same-tab link rather than a console client navigation; F-BROWSE-001 BR-10 adds the click that writes the
 * tab's browse pass first (`openBrowse(undefined, 'nav')`).
 */
export type NavTarget = { href: string; document?: true };

/** All lessons, a learner root of the app origin (F-APP-001 section 3.2, `LEARNER_ROOTS`). */
export const BROWSE_PATH = '/browse';

/** The sibling predicates the registry reads (section 3.8), each off by default. */
export interface NavFlags {
  reports: boolean;
  notes: boolean;
  browse: boolean;
}

/** One family learner whose report the Reports item opens (one family with one learner). */
export interface SoloLearner {
  spaceId: string;
  learnerId: string;
}

export interface NavContext {
  persona: AdultPersona;
  spaces: readonly SpaceListItem[];
  soloLearner: SoloLearner | null;
  flags: NavFlags;
  /** Whether `/parent` is the real family home yet (`FAMILY_HOME_LIVE`). */
  live: boolean;
}

export interface AdultNavItem {
  id: NavId;
  persona: AdultPersona | 'both';
  labelKey: keyof Messages['console']['shell']['nav'];
  target: (ctx: NavContext) => NavTarget;
  enabled: (ctx: NavContext) => boolean;
}

/** Family spaces the account holds as owner or caregiver (the spaces the family home shows). */
export function ownFamilySpaces(spaces: readonly SpaceListItem[]): SpaceListItem[] {
  return spaces.filter((entry) => entry.space.kind === 'family' && (entry.role === 'owner' || entry.role === 'caregiver'));
}

/** The family whose roster the frame reads once for the Reports item: exactly one family space with exactly one learner. */
export function soloFamilyLearnerSpace(spaces: readonly SpaceListItem[]): string | null {
  const families = ownFamilySpaces(spaces);
  return families.length === 1 && families[0]?.counts.learners === 1 ? families[0].space.id : null;
}

const familyHome = (ctx: NavContext): NavTarget => ({ href: personaHome('parent', ctx.live) });

export const ADULT_NAV: readonly AdultNavItem[] = [
  { id: 'home', persona: 'parent', labelKey: 'home', target: familyHome, enabled: () => true },
  {
    id: 'reports',
    persona: 'parent',
    labelKey: 'reports',
    target: (ctx) =>
      ctx.soloLearner ? { href: ROUTES.learnerReport({ spaceId: ctx.soloLearner.spaceId, learnerId: ctx.soloLearner.learnerId, kind: 'family', from: 'nav' }) } : familyHome(ctx),
    enabled: (ctx) => ctx.flags.reports,
  },
  {
    id: 'notes',
    persona: 'parent',
    labelKey: 'notes',
    target: (ctx) => {
      const families = ownFamilySpaces(ctx.spaces);
      return families.length === 1 && families[0] ? { href: ROUTES.spaceNotes(families[0].space.id, 'family') } : familyHome(ctx);
    },
    enabled: (ctx) => ctx.flags.notes,
  },
  { id: 'classes', persona: 'teacher', labelKey: 'classes', target: () => ({ href: personaHome('teacher') }), enabled: () => true },
  { id: 'lessons', persona: 'both', labelKey: 'lessons', target: () => ({ href: BROWSE_PATH, document: true }), enabled: (ctx) => ctx.flags.browse },
  { id: 'billing', persona: 'both', labelKey: 'billing', target: () => ({ href: ROUTES.billing }), enabled: () => true },
];

/**
 * The predicates for this build, console locale and page origin (Reports also needs a reviewed locale, F-REPORT-001
 * section 3.1; Lessons the app origin, F-BROWSE-001 section 4.3).
 */
export function navFlags(locale: UiLocale, env: ConsoleEnv = buildEnv(), origin = ''): NavFlags {
  return { reports: reportsEnabled(locale, env), notes: notesEnabled(env), browse: browseEntryShown(origin, env) };
}

export interface NavEntry {
  id: NavId;
  labelKey: AdultNavItem['labelKey'];
  target: NavTarget;
}

/** The items of the active persona whose predicate is on, in registry order, with their targets. */
export function navItemsFor(ctx: NavContext): NavEntry[] {
  return ADULT_NAV.filter((entry) => (entry.persona === 'both' || entry.persona === ctx.persona) && entry.enabled(ctx)).map((entry) => ({
    id: entry.id,
    labelKey: entry.labelKey,
    target: entry.target(ctx),
  }));
}

const BILLING_PAGE = /^\/(?:account\/billing|teach\/billing)(?:[/.]|$)/;
const SPACE_PAGE = /^\/(?:teach|parent)\/space(?:[/.]|$)/;
const REPORT_PAGE = /^\/(?:teach|parent)\/space\/(?:learner|report)(?:[/.]|$)/;
const NOTES_PAGE = /^\/(?:teach|parent)\/space\/notes(?:[/.]|$)/;
const HOME_PAGE = /^\/(?:parent|teach\/home)(?:\/|\.html)?$/;

/**
 * The item to highlight (`aria-current="page"`, section 3.8): Billing on the billing pages; on the
 * active persona's pages, Reports and Notes on theirs (Family rows only), else the persona's home
 * item. Nothing while the persona is only a guess, and nothing on a page of no persona.
 */
export function currentNavItem(pathname: string, persona: AdultPersona, resolved: boolean): NavId | null {
  if (BILLING_PAGE.test(pathname)) return 'billing';
  if (!resolved) return null;
  if (persona === 'parent' && REPORT_PAGE.test(pathname)) return 'reports';
  if (persona === 'parent' && NOTES_PAGE.test(pathname)) return 'notes';
  if (HOME_PAGE.test(pathname) || SPACE_PAGE.test(pathname)) return persona === 'parent' ? 'home' : 'classes';
  return null;
}
