import { APP_ROUTES, type AdultPersona } from '@hangul-route/content-schema';
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

export type NavId = 'home' | 'reports' | 'notes' | 'classes' | 'classReports' | 'teacherNotes' | 'lessons' | 'billing';

/**
 * A link. `document` marks a learner root of this origin (Lessons opens All lessons at `/browse`, F-BROWSE-001), a
 * plain same-tab link rather than a console client navigation. A plain click on it writes the tab's browse pass
 * first (`AdultFrame`, `openBrowse(undefined, 'nav')`, F-BROWSE-001 BR-10); a modifier click opens a tab with no pass.
 */
export type NavTarget = { href: string; document?: true };

/** All lessons, a learner root of the app origin (F-APP-001 section 3.2, `LEARNER_ROOTS`). */
export const BROWSE_PATH = '/browse';

/** The sibling predicates the registry reads (section 3.8): Reports and Lessons are on by default (RP-11, BR-14); Notes is off by default. */
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

const familyHome = (): NavTarget => ({ href: personaHome('parent') });

export const ADULT_NAV: readonly AdultNavItem[] = [
  { id: 'home', persona: 'parent', labelKey: 'home', target: familyHome, enabled: () => true },
  {
    id: 'reports',
    persona: 'parent',
    labelKey: 'reports',
    target: (ctx) =>
      // One family learner opens that report; otherwise the parent chooser (F-REPORT-001 RP-7c).
      ctx.soloLearner
        ? { href: ROUTES.learnerReport({ spaceId: ctx.soloLearner.spaceId, learnerId: ctx.soloLearner.learnerId, kind: 'family', from: 'nav' }) }
        : { href: ROUTES.learnerReportChooser },
    enabled: (ctx) => ctx.flags.reports,
  },
  {
    id: 'notes',
    persona: 'parent',
    labelKey: 'notes',
    // The hub (F-FEEDBACK-001 FB-11b) goes straight on to the one family's notes page, or lists several.
    target: () => ({ href: ROUTES.notesHub('parent') }),
    enabled: (ctx) => ctx.flags.notes,
  },
  { id: 'classes', persona: 'teacher', labelKey: 'classes', target: () => ({ href: personaHome('teacher') }), enabled: () => true },
  // The class chooser, which opens the one class directly (F-REPORT-001 RP-7c, RP-8).
  { id: 'classReports', persona: 'teacher', labelKey: 'classReports', target: () => ({ href: ROUTES.classReportChooser }), enabled: (ctx) => ctx.flags.reports },
  { id: 'teacherNotes', persona: 'teacher', labelKey: 'notes', target: () => ({ href: ROUTES.notesHub('teacher') }), enabled: (ctx) => ctx.flags.notes },
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
const REPORT_PAGE = /^\/(?:(?:teach|parent)\/space\/(?:learner|report)|parent\/learner)(?:[/.]|$)/;
const CLASS_REPORT_PAGE = /^\/teach\/space\/report(?:[/.]|$)/;
const NOTES_PAGE = /^\/(?:teach|parent)\/(?:space\/)?notes(?:[/.]|$)/;
const PARENT_HOME_PAGE = /^\/parent(?:\/|\.html)?$/;
const TEACHER_HOME_PAGE = /^\/teach\/home(?:\/|\.html)?$/;

/**
 * The item to highlight (`aria-current="page"`, section 3.8): Billing on the billing pages; on the
 * active persona's pages, Reports on theirs (Family rows only), Class reports on the class report
 * and its chooser (Teacher row, F-REPORT-001 RP-7c), Notes on the notes pages and hubs (each
 * persona's own Notes item, F-FEEDBACK-001 FB-11b), else the persona's home
 * item. Nothing while the persona is only a guess, and nothing on a page of no persona. On a home,
 * the persona's home item only when it links to this very home: on a home the account does not
 * hold (the "not set up yet" states), the nav keeps the other persona's items and none is current.
 */
export function currentNavItem(pathname: string, persona: AdultPersona, resolved: boolean): NavId | null {
  if (BILLING_PAGE.test(pathname)) return 'billing';
  if (!resolved) return null;
  if (persona === 'parent' && REPORT_PAGE.test(pathname)) return 'reports';
  if (persona === 'teacher' && CLASS_REPORT_PAGE.test(pathname)) return 'classReports';
  if (NOTES_PAGE.test(pathname)) return persona === 'parent' ? 'notes' : 'teacherNotes';
  const homeItem: NavId = persona === 'parent' ? 'home' : 'classes';
  const pageHome = PARENT_HOME_PAGE.test(pathname) ? APP_ROUTES.parentHome : TEACHER_HOME_PAGE.test(pathname) ? APP_ROUTES.teacherHome : null;
  if (pageHome) return personaHome(persona) === pageHome ? homeItem : null;
  if (SPACE_PAGE.test(pathname)) return homeItem;
  return null;
}
