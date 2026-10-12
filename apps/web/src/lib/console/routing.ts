import { SpaceKindSchema, type SpaceKind } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { SpaceListItem } from './api';

/** Where the console sends an adult — F-CONSOLE-001 §3.2–3.4. */
export const ROUTES = {
  signIn: '/teach',
  start: '/teach/start',
  home: '/teach/home',
  space: (id: string) => `/teach/space?id=${encodeURIComponent(id)}`,
  /** With `planId` the builder opens that plan (the curriculum wizard's draft, F-PLAN-002 section 3.8). */
  spacePlan: (id: string, planId?: string) => `/teach/space/plan?id=${encodeURIComponent(id)}${planId ? `&plan=${encodeURIComponent(planId)}` : ''}`,
  spaceCurriculum: (id: string) => `/teach/space/curriculum?id=${encodeURIComponent(id)}`,
  spaceRelink: (id: string) => `/teach/space/relink?id=${encodeURIComponent(id)}`,
  spaceSettings: (id: string) => `/teach/space/settings?id=${encodeURIComponent(id)}`,
  /** Lecture setup (F-TCH-004 §3.11); `from` preselects the deck source, `plan` names the plan on screen (an id). Never a name in the URL. */
  spaceLecture: (id: string, from?: 'plan' | 'revisit', planId?: string) =>
    `/teach/space/lecture?id=${encodeURIComponent(id)}${from ? `&from=${from}` : ''}${planId ? `&plan=${encodeURIComponent(planId)}` : ''}`,
  /** The console's Billing page (F-ENT-001 §3.6; F-BILL-002 owns it): **Open billing** on the free-lessons line (F-ENT-003 §3.9.2). */
  billing: '/teach/billing',
  /**
   * One learner's Learning Route stage list (Learning Route amendment section 6.1, LR-7): a family
   * under `/parent/space/route`, a class (or `kind` omitted, which renders every kind; F-APP-001
   * section 3.8) under `/teach/space/route`. Ids only, as query parameters (a static export): a
   * learner's name never reaches the URL. A caller passes `'family'` once the `/parent/space/route`
   * twin page exists (F-APP-001 A-5b or LR-8, whichever lands second); until then it omits the kind.
   */
  learnerRoute: (spaceId: string, learnerId: string, kind?: SpaceKind) =>
    `/${kind === 'family' ? 'parent' : 'teach'}/space/route?id=${encodeURIComponent(spaceId)}&learner=${encodeURIComponent(learnerId)}`,
  /**
   * The notes page of a space (F-FEEDBACK-001 section 6.13): a family under `/parent`, a class or a
   * school under `/teach`. `compose` opens the composer sub-view, `learner` preselects an opaque
   * `profile:` id, `quest` prefills a catalogue quest id, `tab` picks the family tab. Never a name.
   */
  spaceNotes: (id: string, kind: SpaceKind, opts: SpaceNotesOptions = {}) =>
    `${kind === 'family' ? '/parent' : '/teach'}/space/notes?id=${encodeURIComponent(id)}` +
    `${opts.compose ? '&compose=1' : ''}` +
    `${opts.learner ? `&learner=${encodeURIComponent(opts.learner)}` : ''}` +
    `${opts.quest ? `&quest=${encodeURIComponent(opts.quest)}` : ''}` +
    `${opts.tab ? `&tab=${opts.tab}` : ''}`,
} as const;

/** The options of `ROUTES.spaceNotes`. */
export interface SpaceNotesOptions {
  learner?: string;
  compose?: boolean;
  quest?: string;
  tab?: 'received' | 'sent';
}

/**
 * The console is a static export (one assets-only Worker, no server), so a space
 * is addressed by `?id=` rather than a dynamic segment — F-CONSOLE-001 §3.6.
 */
export function spaceIdFrom(params: { get(name: string): string | null } | null): string {
  return params?.get('id')?.trim() ?? '';
}

export function landingAfterSignIn(spaceCount: number): string {
  return spaceCount > 0 ? ROUTES.home : ROUTES.start;
}

export function landingAfterCreate(kind: SpaceKind, spaceId: string, fromHome: boolean): string {
  if (kind === 'class') return ROUTES.space(spaceId);
  return fromHome ? ROUTES.home : ROUTES.home;
}

export interface RoleCard {
  kind: SpaceKind;
  title: string;
  line: string;
}

const ROLE_ORDER: readonly SpaceKind[] = ['family', 'class', 'school'];

/** The role step of console/onboarding-role, in `locale`. */
export function roleCards(locale: UiLocale = DEFAULT_LOCALE): RoleCard[] {
  const roles = getMessages(locale).console.start.roles;
  return ROLE_ORDER.map((kind) => ({ kind, ...roles[kind] }));
}

/** The suggested name for a new space, in `locale`; the grown-up can edit it before creating. */
export function prefillName(kind: SpaceKind, displayName: string, locale: UiLocale = DEFAULT_LOCALE): string {
  const prefill = getMessages(locale).console.start.prefill;
  const who = displayName.trim();
  if (kind === 'family') return who ? prefill.family(who) : prefill.familyDefault;
  if (kind === 'class') return prefill.class;
  return who ? prefill.school(who) : prefill.schoolDefault;
}

/** Group by kind, most recent first inside each group, archived rows last. */
export function groupSpaces(items: readonly SpaceListItem[]): Record<SpaceKind, SpaceListItem[]> {
  const groups: Record<SpaceKind, SpaceListItem[]> = { family: [], class: [], school: [] };
  for (const item of items) groups[item.space.kind].push(item);
  for (const kind of Object.keys(groups) as SpaceKind[]) {
    groups[kind].sort((a, b) => {
      const archived = Number(!!a.space.archivedAt) - Number(!!b.space.archivedAt);
      return archived !== 0 ? archived : b.space.createdAt.localeCompare(a.space.createdAt);
    });
  }
  return groups;
}

/** One neutral status line per row — counts only, never names or percentages — in `locale`. */
export function statusLine(item: SpaceListItem, locale: UiLocale = DEFAULT_LOCALE): string {
  const counts = getMessages(locale).console.spaceCounts;
  const { kind } = item.space;
  if (kind === 'family') return counts.learners(item.counts.learners);
  if (kind === 'class') return counts.students(item.counts.learners);
  return counts.classes(item.counts.classes);
}

/** Why the roster page could not show a space; a key, worded at render time so it follows the header language select. */
export type SpaceError = 'forbidden' | 'gone' | 'cantReach' | 'regenerateFailed';

/** The words for a `SpaceError`, in `locale`. */
export function spaceErrorText(error: SpaceError, locale: UiLocale = DEFAULT_LOCALE): string {
  const c = getMessages(locale).console;
  return error === 'cantReach' ? c.cantReach : c.space[error];
}

/** Why a console page's data did not load: `forbidden` has the page's own words, anything else reads "can't reach". */
export type LoadError = 'forbidden' | 'cantReach';

/** The `LoadError` for a failed API call's error code. */
export function loadErrorKey(error: string): LoadError {
  return error === 'forbidden' ? 'forbidden' : 'cantReach';
}

/**
 * A space kind this console bundle can word. API responses are cast, not parsed, so a kind added by
 * a newer Worker (deployed first, an old console bundle cached) is treated as a failed load instead
 * of reaching the kind-keyed messages.
 */
export function isKnownSpaceKind(kind: unknown): kind is SpaceKind {
  return SpaceKindSchema.safeParse(kind).success;
}
