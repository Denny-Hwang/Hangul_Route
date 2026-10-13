import { APP_ROUTES, SpaceKindSchema, isDateKey, type AdultPersona, type ReportPeriod, type SpaceKind } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { SpaceListItem } from './api';

/** `id=<space id>`, encoded, so an id can never add or change a query parameter. */
function idQuery(id: string): string {
  return `id=${encodeURIComponent(id)}`;
}

/**
 * A space page under the prefix of the space kind (F-APP-001 A-5b, section 3.8): `/parent/space…` for a
 * family, `/teach/space…` for a class, a school or no kind. `sub` is a `SPACE_PAGES` entry (`''` for the
 * space page itself); `query` is already encoded.
 */
export function spacePath(sub: string, query: string, kind?: SpaceKind): string {
  return `${kind === 'family' ? '/parent/space' : '/teach/space'}${sub ? `/${sub}` : ''}${query ? `?${query}` : ''}`;
}

/**
 * The space kind a page's own prefix tells before any data names it: a `/parent/space…` page belongs to a
 * family (F-APP-001 A-5b); `/teach/space…` renders every kind, so it tells nothing.
 */
export function spaceKindOfPath(pathname: string): 'family' | undefined {
  return /^\/parent\/space(?:[/.]|$)/.test(pathname) ? 'family' : undefined;
}

/** Where the console sends an adult — F-CONSOLE-001 §3.2–3.4. */
export const ROUTES = {
  /** Grown-up sign-in and the router into the grown-up area (F-APP-001 A-4b, section 3.7). */
  signIn: APP_ROUTES.signIn,
  /** The first space for a grown-up, moved from `/teach/start` (F-APP-001 A-4b; `/teach/start` redirects here). */
  start: APP_ROUTES.start,
  home: '/teach/home',
  /** The family home (F-APP-001 A-5b, section 3.8). */
  parentHome: APP_ROUTES.parentHome,
  /*
   * Every space builder takes the space kind as its last, optional parameter (F-APP-001 section 3.8): a family
   * under `/parent/space…`, anything else (or no kind) under `/teach/space…`, which renders every kind.
   */
  space: (id: string, kind?: SpaceKind) => spacePath('', idQuery(id), kind),
  /** With `planId` the builder opens that plan (the curriculum wizard's draft, F-PLAN-002 section 3.8). */
  spacePlan: (id: string, planId?: string, kind?: SpaceKind) => spacePath('plan', `${idQuery(id)}${planId ? `&plan=${encodeURIComponent(planId)}` : ''}`, kind),
  spaceCurriculum: (id: string, kind?: SpaceKind) => spacePath('curriculum', idQuery(id), kind),
  spaceRelink: (id: string, kind?: SpaceKind) => spacePath('relink', idQuery(id), kind),
  /**
   * Class moves of a space (F-SPACE-002 section 4.8): the class page, the family page (`/parent/space/transfers` for
   * a family) or a school's counts. The space id only, never a learner, class or teacher name (T14); a request
   * travels by its opaque id in API paths.
   */
  spaceTransfers: (id: string, kind?: SpaceKind) => spacePath('transfers', idQuery(id), kind),
  spaceSettings: (id: string, kind?: SpaceKind) => spacePath('settings', idQuery(id), kind),
  /** Lecture setup (F-TCH-004 §3.11); `from` preselects the deck source, `plan` names the plan on screen (an id). Never a name in the URL. */
  spaceLecture: (id: string, from?: 'plan' | 'revisit', planId?: string, kind?: SpaceKind) =>
    spacePath('lecture', `${idQuery(id)}${from ? `&from=${from}` : ''}${planId ? `&plan=${encodeURIComponent(planId)}` : ''}`, kind),
  /**
   * The console's Billing page (F-ENT-001 §3.6; F-BILL-002 owns it), `/account/billing` for every grown-up
   * (F-APP-001 A-5c; `/teach/billing` forwards there): the frame's Billing item and **Open billing** on the
   * free-lessons line (F-ENT-003 §3.9.2).
   */
  billing: APP_ROUTES.billing,
  /**
   * One learner's Learning Route stage list (Learning Route amendment section 6.1, LR-7, LR-8). Ids only,
   * as query parameters (a static export): a learner's name never reaches the URL. A family opens the
   * `/parent/space/route` twin (F-APP-001 A-5b), a class `/teach/space/route`.
   */
  learnerRoute: (spaceId: string, learnerId: string, kind?: SpaceKind) => spacePath('route', `${idQuery(spaceId)}&learner=${encodeURIComponent(learnerId)}`, kind),
  /**
   * The notes page of a space (F-FEEDBACK-001 section 6.13): a family under `/parent`, a class or a
   * school under `/teach`. `compose` opens the composer sub-view, `learner` preselects an opaque
   * `profile:` id, `quest` prefills a catalogue quest id, `tab` picks the family tab. Never a name.
   */
  spaceNotes: (id: string, kind: SpaceKind, opts: SpaceNotesOptions = {}) =>
    spacePath(
      'notes',
      idQuery(id) +
        `${opts.compose ? '&compose=1' : ''}` +
        `${opts.learner ? `&learner=${encodeURIComponent(opts.learner)}` : ''}` +
        `${opts.quest ? `&quest=${encodeURIComponent(opts.quest)}` : ''}` +
        `${opts.tab ? `&tab=${opts.tab}` : ''}`,
      kind,
    ),
  /**
   * One learner's report (F-REPORT-001 section 3.1): `period` (week by default), an optional past window `at` (a
   * learner-local day key; never on All time, which has no stepper) and `from` for the back link. Ids and codes only,
   * so a learner's name never reaches the URL. A class reads `/teach/space/learner`; a family goes there too until
   * RP-7c moves its branch to `/parent/learner` (F-APP-001 keeps the `/teach` path working for family ids).
   */
  learnerReport: (opts: LearnerReportRoute) =>
    `/teach/space/learner?id=${encodeURIComponent(opts.spaceId)}&learner=${encodeURIComponent(opts.learnerId)}` +
    reportWindowQuery(opts.period, opts.at) +
    `${opts.from ? `&from=${opts.from}` : ''}`,
  /** One class's statistics (F-REPORT-001 section 3.1, RP-8): aggregates only, so the URL holds the class id and the window. */
  classReport: (opts: ClassReportRoute) => spacePath('report', `${idQuery(opts.spaceId)}${reportWindowQuery(opts.period, opts.at)}`, opts.kind),
} as const;

/** Where the grown-up opened a learner report from: the back link goes there (F-REPORT-001 section 3.1). */
export type ReportFrom = 'home' | 'roster' | 'nav';

/** The options of `ROUTES.learnerReport`: ids and codes, never a name. */
export interface LearnerReportRoute {
  spaceId: string;
  learnerId: string;
  kind: SpaceKind;
  period?: ReportPeriod;
  at?: string | null;
  from?: ReportFrom | null;
}

/** The options of `ROUTES.classReport`; `kind` picks the prefix (F-APP-001 section 3.8; a class report is a class's, so usually `'class'`). */
export interface ClassReportRoute {
  spaceId: string;
  kind?: SpaceKind;
  period?: ReportPeriod;
  at?: string | null;
}

/** `&period=<p>` (week by default) and `&at=<day>` when it is a day key and the period has a stepper. */
function reportWindowQuery(period: ReportPeriod = 'week', at?: string | null): string {
  return `&period=${period}${period !== 'all' && typeof at === 'string' && isDateKey(at) ? `&at=${at}` : ''}`;
}

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

/** Where a new space lands (F-APP-001 section 3.7): a class on its page, a family on the family home, a school on the teacher home. */
export function landingAfterCreate(kind: SpaceKind, spaceId: string, _fromHome: boolean): string {
  if (kind === 'class') return ROUTES.space(spaceId, 'class');
  if (kind === 'family') return ROUTES.parentHome;
  return ROUTES.home;
}

/** The role card a persona hint preselects on `/start` (F-APP-001 section 3.5): Family → family, Teacher → class. */
export function presetKind(hint: AdultPersona | null): SpaceKind | null {
  if (hint === 'parent') return 'family';
  if (hint === 'teacher') return 'class';
  return null;
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

/**
 * One member of a space, singular (F-SPACE-002 section 4.8 wording table): a class `student`, a family `learner`, a
 * school `member`, so a teacher's history line reads "A student moved to another class". In `locale`.
 */
export function memberNounSingular(kind: SpaceKind, locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.transfer.memberNoun[kind];
}
