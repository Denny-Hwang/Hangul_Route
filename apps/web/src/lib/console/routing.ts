import type { SpaceKind } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, en, getMessages, type UiLocale } from '@hangul-route/i18n';
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
  /** Lecture setup (F-TCH-004 §3.11); `from` preselects the deck source. Never a name in the URL. */
  spaceLecture: (id: string, from?: 'plan' | 'revisit') =>
    `/teach/space/lecture?id=${encodeURIComponent(id)}${from ? `&from=${from}` : ''}`,
} as const;

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

/** English kind labels ("Class"), read by the settings page until it takes `m.console.kind.label` (PR 10c). */
export const KIND_LABEL: Readonly<Record<SpaceKind, string>> = en.console.kind.label;

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

/** What a space's members are called ("students", "learners", "members"), in `locale`. */
export function memberNoun(kind: SpaceKind, locale: UiLocale = DEFAULT_LOCALE): string {
  return getMessages(locale).console.kind.members[kind];
}
