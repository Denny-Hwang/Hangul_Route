import type { SpaceKind } from '@hangul-route/content-schema';
import type { SpaceListItem } from './api';

/** Where the console sends an adult — F-CONSOLE-001 §3.2–3.4. */
export const ROUTES = {
  signIn: '/teach',
  start: '/teach/start',
  home: '/teach/home',
  space: (id: string) => `/teach/space/${encodeURIComponent(id)}`,
} as const;

export function landingAfterSignIn(spaceCount: number): string {
  return spaceCount > 0 ? ROUTES.home : ROUTES.start;
}

export function landingAfterCreate(kind: SpaceKind, spaceId: string, fromHome: boolean): string {
  if (kind === 'class') return ROUTES.space(spaceId);
  return fromHome ? ROUTES.home : ROUTES.home;
}

export const KIND_LABEL: Record<SpaceKind, string> = { family: 'Family', class: 'Class', school: 'School' };
export const KIND_GROUP: Record<SpaceKind, string> = { family: 'Family', class: 'Classes', school: 'School' };

export interface RoleCard {
  kind: SpaceKind;
  title: string;
  line: string;
}

export const ROLE_CARDS: readonly RoleCard[] = [
  { kind: 'family', title: 'Parent / caregiver', line: 'Home — my kids' },
  { kind: 'class', title: 'Teacher', line: 'My class' },
  { kind: 'school', title: 'School admin', line: 'Teachers and classes' },
];

export function prefillName(kind: SpaceKind, displayName: string): string {
  const who = displayName.trim();
  if (kind === 'family') return who ? `${who} family` : 'Our family';
  if (kind === 'class') return 'Class A';
  return who ? `${who} school` : 'Our school';
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

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** One neutral status line per row — counts only, never names or percentages. */
export function statusLine(item: SpaceListItem): string {
  const { kind } = item.space;
  if (kind === 'family') return plural(item.counts.learners, 'learner', 'learners');
  if (kind === 'class') return plural(item.counts.learners, 'student', 'students');
  return plural(item.counts.classes, 'class', 'classes');
}

export function memberNoun(kind: SpaceKind): string {
  return kind === 'class' ? 'students' : kind === 'family' ? 'learners' : 'members';
}
