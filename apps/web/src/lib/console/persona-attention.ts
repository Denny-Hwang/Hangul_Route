import { readSpaceAttention, type AdultPersona, type ClassAttention, type SpaceKind } from '@hangul-route/content-schema';
import type { SpaceListItem } from './api';
import type { ClassScopeState } from './class-moves';
import { minutesLeft } from './relink';
import { ROUTES } from './routing';

/**
 * What waits for a teacher's answer across every class the teacher can act on (AMENDMENTS-GROWNUP-UX GX-3, sections
 * 5.5 and 6; GX-D6): the home row chips, a school row's class links, the Classes tab's number and the re-link bar on
 * every other console page. Built from GX-W's counts only: `GET /api/spaces` `spaces[].attention` for the spaces the
 * account belongs to, and a school's `GET /:id/attention` for the classes a school owner or admin answers for without
 * being a member. Each class is counted once (merged by space id). Counts and space names only; never a learner's name.
 * Pure: the frame's hook reads, this file decides.
 *
 * The parent persona (GX-5, sections 5.5 and 7.4): the Home tab's number and the parent re-link bar on every other parent
 * page, from each live family's `attention` (re-links, and the learner-side moves the family can answer: the Worker counts
 * one only when `learnerRoute === 'caregiver'`) plus the children with a class-scope update to read (`classScope`).
 */

/** The read of `GET /api/spaces` (and the schools' attention) while a console page is in view (section 5.4). */
export const ATTENTION_POLL_MS = 30_000;
/** The shortest gap between two of those reads, so a focus right after a poll waits, and a poll right after a focus. */
export const ATTENTION_GAP_MS = 10_000;
/** Above this the nav shows "99+": a one- or two-digit number does not wrap the tab row (section 6). */
const NAV_COUNT_CAP = 99;

export interface SpaceCounts {
  relinks: number;
  moves: number;
  all: number;
  relinkExpiresAt: string | null;
}

export interface PersonaAttention {
  /** Every class (and school) the teacher can act on, once each. */
  bySpace: Readonly<Record<string, SpaceCounts>>;
  /** A school admin's classes, per school id, in the school's order (its row's links). */
  schools: Readonly<Record<string, readonly string[]>>;
  /** Space names the console may show (from the spaces list, or a school's own class list). */
  names: Readonly<Record<string, string>>;
  kinds: Readonly<Record<string, SpaceKind>>;
  total: number;
  relinks: number;
  /** The space whose re-link closes first; null while none waits. */
  soonestRelink: { spaceId: string; expiresAt: string | null } | null;
}

const isTeacherSpace = (item: SpaceListItem): boolean => item.space.kind !== 'family' && !item.space.archivedAt;
const isFamilySpace = (item: SpaceListItem): boolean => item.space.kind === 'family' && !item.space.archivedAt;

/** The live schools whose classes this account answers for through the school (owner or admin, `can.ts` cascade). */
export function adminSchoolIds(spaces: readonly SpaceListItem[]): string[] {
  return spaces.filter((item) => item.space.kind === 'school' && !item.space.archivedAt && (item.role === 'owner' || item.role === 'admin')).map((item) => item.space.id);
}

/** Whether this Worker sends GX-W's counts: any live space of the persona with a readable `attention`. */
export function attentionDeployed(spaces: readonly SpaceListItem[], persona: AdultPersona = 'teacher'): boolean {
  const mine = persona === 'parent' ? isFamilySpace : isTeacherSpace;
  return spaces.some((item) => mine(item) && readSpaceAttention(item.attention) !== null);
}

/** The children with a class-scope update to read in one family's `classScope` answer; null when it was not read. */
export function scopeNeeded(state: ClassScopeState | null): number | null {
  return state ? state.learners.filter((learner) => learner.needed).length : null;
}

/**
 * The teacher's counts, or null when nothing readable came (an older Worker): then no number and no bar, never a
 * guess. Re-links count whatever `CLASS_TRANSFER` says; the moves only while class moves are shown (`movesShown`).
 */
export function teacherAttention(input: {
  spaces: readonly SpaceListItem[];
  schools: Readonly<Record<string, readonly ClassAttention[] | null>>;
  movesShown: boolean;
}): PersonaAttention | null {
  const bySpace: Record<string, SpaceCounts> = {};
  const names: Record<string, string> = {};
  const kinds: Record<string, SpaceKind> = {};
  const schools: Record<string, string[]> = {};
  const add = (spaceId: string, relinks: number, moves: number, relinkExpiresAt: string | null): void => {
    if (bySpace[spaceId]) return; // one count per class: a class taught and administered comes in both reads
    const shownMoves = input.movesShown ? moves : 0;
    bySpace[spaceId] = { relinks, moves: shownMoves, all: relinks + shownMoves, relinkExpiresAt: relinks > 0 ? relinkExpiresAt : null };
  };
  for (const item of input.spaces) {
    if (!isTeacherSpace(item)) continue;
    names[item.space.id] = item.space.name;
    kinds[item.space.id] = item.space.kind;
    const read = readSpaceAttention(item.attention);
    if (read) add(item.space.id, read.relinks, read.moves, read.relinkExpiresAt);
  }
  let read = Object.keys(bySpace).length > 0;
  for (const [schoolId, classes] of Object.entries(input.schools)) {
    if (!classes) continue;
    read = true;
    schools[schoolId] = classes.map((row) => row.spaceId);
    for (const row of classes) {
      kinds[row.spaceId] ??= 'class';
      add(row.spaceId, row.relinks, row.moves, row.relinkExpiresAt);
    }
  }
  if (!read) return null;
  return { bySpace, schools, names, kinds, ...sums(bySpace) };
}

/**
 * The parent's counts (section 7.4), or null when no family carries a readable `attention` (an older Worker): per live
 * family, its pending re-links + the learner-side moves it can answer (only while class moves are shown) + its children
 * with a class-scope update (`scope`, from the family's `classScope` read; a read not made or failed adds nothing).
 */
export function parentAttention(input: { spaces: readonly SpaceListItem[]; scope: Readonly<Record<string, number | null>>; movesShown: boolean }): PersonaAttention | null {
  const bySpace: Record<string, SpaceCounts> = {};
  const names: Record<string, string> = {};
  const kinds: Record<string, SpaceKind> = {};
  for (const item of input.spaces) {
    if (!isFamilySpace(item)) continue;
    const read = readSpaceAttention(item.attention);
    if (!read) continue;
    const id = item.space.id;
    names[id] = item.space.name;
    kinds[id] = 'family';
    const moves = input.movesShown ? read.moves : 0;
    const scope = input.scope[id] ?? 0;
    bySpace[id] = { relinks: read.relinks, moves, all: read.relinks + moves + scope, relinkExpiresAt: read.relinks > 0 ? read.relinkExpiresAt : null };
  }
  if (Object.keys(bySpace).length === 0) return null;
  return { bySpace, schools: {}, names, kinds, ...sums(bySpace) };
}

/** The persona total, its re-links and the space whose re-link closes first (one with no expiry comes last). */
function sums(bySpace: Readonly<Record<string, SpaceCounts>>): Pick<PersonaAttention, 'total' | 'relinks' | 'soonestRelink'> {
  let total = 0;
  let relinks = 0;
  let soonestRelink: PersonaAttention['soonestRelink'] = null;
  for (const [spaceId, counts] of Object.entries(bySpace)) {
    total += counts.all;
    relinks += counts.relinks;
    if (counts.relinks === 0) continue;
    const sooner = !soonestRelink || (counts.relinkExpiresAt !== null && (soonestRelink.expiresAt === null || Date.parse(counts.relinkExpiresAt) < Date.parse(soonestRelink.expiresAt)));
    if (sooner) soonestRelink = { spaceId, expiresAt: counts.relinkExpiresAt };
  }
  return { total, relinks, soonestRelink };
}

/** The class page at its review (`#attention`, GX-2's sheet): an opaque id only, no learner in the address. */
export function attentionHref(spaceId: string, kind: SpaceKind = 'class'): string {
  return `${ROUTES.space(spaceId, kind)}#attention`;
}

export interface RelinkBarView {
  /** Re-links waiting over the persona: 1 draws the one-space line, more the count. */
  count: number;
  spaceId: string;
  /** The class's (or family's) name for the one-space line; null when this console cannot name it. */
  name: string | null;
  /** Whole minutes left on the soonest one, rounded up, at least 1; null with no expiry. */
  minutes: number | null;
  href: string;
}

/**
 * The re-link bar (section 5.5), or null while no new device waits. Review goes to the space whose one closes first: a
 * class's review (`#attention`), or the family home for a family.
 */
export function relinkBarView(attention: Pick<PersonaAttention, 'relinks' | 'soonestRelink' | 'names' | 'kinds'> | null, now: Date): RelinkBarView | null {
  if (!attention || attention.relinks === 0 || !attention.soonestRelink) return null;
  const { spaceId, expiresAt } = attention.soonestRelink;
  return {
    count: attention.relinks,
    spaceId,
    name: attention.names[spaceId] ?? null,
    minutes: expiresAt ? Math.max(1, minutesLeft(expiresAt, now)) : null,
    // A family's new device is answered on the family home (its pop-up and Needs you strip), not on the family roster.
    href: attention.kinds[spaceId] === 'family' ? ROUTES.parentHome : attentionHref(spaceId, attention.kinds[spaceId] ?? 'class'),
  };
}

/** The number on the nav tab: one or two digits, "99+" above. */
export function navCountText(n: number): string {
  return n > NAV_COUNT_CAP ? `${NAV_COUNT_CAP}+` : String(n);
}

const TITLE_COUNT = /^\(\d+\+?\) /;

/** The tab title with "(n) " in front while something waits (a count only, never a name), and without it at 0. */
export function titleWithCount(title: string, n: number): string {
  const bare = title.replace(TITLE_COUNT, '');
  return n > 0 ? `(${navCountText(n)}) ${bare}` : bare;
}
