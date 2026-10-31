import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { RelinkView, RosterLearner, SpaceListItem, TransferLearnerSideView, TransferList } from './api';
import type { ClassScopeState, MoveNotice } from './class-moves';
import { minutesShown } from './learner-status';
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

// ---------------------------------------------------------------------------
// AMENDMENTS-GROWNUP-UX GX-4 (section 7, GX-D7; wireframe design/wireframes/parent/needs-you.md, mock
// design/screens/approvals/mock/parent-*.html): the family's **Needs you** strip, the status chip on each child card, the
// class line and the move notice inside its child's card. Every read that failed or was skipped is `null` and adds
// nothing (never a guess); nothing is matched by name, only by learner id.

/** What the family home reads for one family, beside its roster (all in the page's quiet load). */
export interface FamilyAsks {
  /** `GET /:familyId/relink-requests`; null when it failed. */
  relinks: readonly RelinkView[] | null;
  /** `GET /:familyId/transfer-requests` (learner-side views and `options`); null when skipped (class moves hidden or locked) or failed. */
  transfers: TransferList | null;
  /** `GET /:familyId/class-scope`; null when it failed. */
  scope: ClassScopeState | null;
  /** TV-D10 notices of moves a teacher made; empty when skipped or failed. */
  notices: readonly MoveNotice[];
}

export type NeedsYouItem =
  | { kind: 'relink'; id: string; learnerId: string; name: string; expiresAt: string; at: string }
  | { kind: 'move'; id: string; learnerId: string; name: string; to: string; expiresAt: string; at: string }
  | { kind: 'scope'; id: string; learnerId: string; name: string; expiresAt: null; at: null };

const DAY_MS = 24 * 60 * 60 * 1000;

const later = (iso: string, now: Date): boolean => {
  const at = Date.parse(iso);
  return !Number.isNaN(at) && at > now.getTime();
};

/** The learner-side views of the read, by role (a family reads only its own learners' views). */
function sideViews(transfers: TransferList | null): TransferLearnerSideView[] {
  return (transfers?.requests ?? []).filter((v): v is TransferLearnerSideView => v.role === 'learner_side');
}

/** An open request whose family step waits (`learnerState` pending) and has not run out. */
function familyStepWaits(view: TransferLearnerSideView, now: Date): boolean {
  return view.status === 'requested' && view.learnerState === 'pending' && later(view.expiresAt, now);
}

/**
 * The family's waiting items (section 7.1 table): a child's pending re-link, a class move whose family step waits, a
 * class-scope update to read. Soonest-closing first (a re-link, closing in minutes, before a move), then oldest first; an
 * item with no end (a class-scope update) last, in the read's order. Never by a score.
 */
export function needsYou(asks: FamilyAsks, now: Date): NeedsYouItem[] {
  const items: NeedsYouItem[] = [];
  for (const r of asks.relinks ?? []) {
    if (r.status === 'pending' && later(r.expiresAt, now)) items.push({ kind: 'relink', id: r.id, learnerId: r.learnerId, name: r.learnerName, expiresAt: r.expiresAt, at: r.requestedAt });
  }
  for (const v of sideViews(asks.transfers)) {
    if (familyStepWaits(v, now)) items.push({ kind: 'move', id: v.id, learnerId: v.learner.id, name: v.learner.name, to: v.to.name, expiresAt: v.expiresAt, at: v.createdAt });
  }
  for (const l of asks.scope?.learners ?? []) {
    if (l.needed) items.push({ kind: 'scope', id: l.learnerId, learnerId: l.learnerId, name: l.name, expiresAt: null, at: null });
  }
  const ends = (item: NeedsYouItem): number => (item.expiresAt === null ? Number.POSITIVE_INFINITY : Date.parse(item.expiresAt));
  const asked = (item: NeedsYouItem): number => (item.at === null ? Number.POSITIVE_INFINITY : Date.parse(item.at));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => ends(a.item) - ends(b.item) || asked(a.item) - asked(b.item) || a.index - b.index)
    .map(({ item }) => item);
}

/**
 * The fold rule (section 7.1): with 1 or 2 items every item has its row; with 3 or more the soonest-closing item keeps its
 * row and the rest fold into one "{n} more things need you · See all" row, so the first child stays on the first screen.
 */
export function foldNeedsYou(items: readonly NeedsYouItem[]): { rows: NeedsYouItem[]; more: number } {
  if (items.length <= 2) return { rows: [...items], more: 0 };
  return { rows: [items[0] as NeedsYouItem], more: items.length - 1 };
}

/** A row's sentence and its short second line (a time or a date), in `locale`. */
export function needsYouWords(item: NeedsYouItem, now: Date, locale: UiLocale = DEFAULT_LOCALE): { text: string; meta: string | null } {
  const c = getMessages(locale).console;
  const t = c.parentHome.needsYou;
  if (item.kind === 'relink') return { text: t.relink(item.name), meta: c.status.minutesLeft(minutesShown(item.expiresAt, now)) };
  if (item.kind === 'move') {
    const days = Math.max(1, Math.ceil((Date.parse(item.expiresAt) - now.getTime()) / DAY_MS));
    return { text: t.move(item.name), meta: t.moveMeta(item.to, days) };
  }
  return { text: t.scope(item.name), meta: null };
}

/** The one chip of a child card (section 7.2): what waits for the family about this child, or a move on a date. */
export type ChildStatus = { kind: 'relink' } | { kind: 'move' } | { kind: 'scope' } | { kind: 'moving'; on: string };

/**
 * One chip per child, by priority: a re-link (closing in minutes), a move that needs the family's OK, the class info to
 * read, then an agreed move with its date ahead. A move waiting for a seat, or with no date, is no chip.
 */
export function childStatus(learnerId: string, asks: FamilyAsks, now: Date): ChildStatus | null {
  const items = needsYou(asks, now).filter((item) => item.learnerId === learnerId);
  for (const kind of ['relink', 'move', 'scope'] as const) if (items.some((item) => item.kind === kind)) return { kind };
  const dated = sideViews(asks.transfers).find(
    (v) => v.learner.id === learnerId && v.status === 'approved' && v.blockReason === null && v.executeAfter !== null && later(v.executeAfter, now),
  );
  return dated?.executeAfter ? { kind: 'moving', on: dated.executeAfter } : null;
}

/** A chip's text and fill: the family's action chips in the amber light fill, Moving in the info fill. Text, never a button. */
export function childChipWords(status: ChildStatus, locale: UiLocale = DEFAULT_LOCALE): { text: string; tone: 'action' | 'info' } {
  const c = getMessages(locale).console;
  if (status.kind === 'moving') return { text: c.status.moving(formatDate(locale, status.on, 'monthDay')), tone: 'info' };
  return { text: c.parentHome.status[status.kind], tone: 'action' };
}

export type ClassLine = { kind: 'none' } | { kind: 'one'; name: string } | { kind: 'many'; names: string[] };

/**
 * Which classes the child is in (section 7.2), from the `options` of the family's class-move read. Null, and the line is
 * omitted, when the read was skipped (class moves hidden or locked) or failed, or does not list the child: never
 * "Family only" on a guess.
 */
export function classLine(learnerId: string, transfers: TransferList | null): ClassLine | null {
  const option = transfers?.options?.find((o) => o.learnerId === learnerId);
  if (!option) return null;
  const names = option.classes.map((cls) => cls.name);
  if (names.length === 0) return { kind: 'none' };
  if (names.length === 1) return { kind: 'one', name: names[0] as string };
  return { kind: 'many', names };
}

/** The class line in `locale`: one line, or "In 2 classes" with the names on a second line. */
export function classLineWords(line: ClassLine, locale: UiLocale = DEFAULT_LOCALE): string[] {
  const t = getMessages(locale).console.parentHome.classLine;
  if (line.kind === 'none') return [t.none];
  if (line.kind === 'one') return [t.one(line.name)];
  return [t.many(line.names.length), line.names.join(' · ')];
}

/** The TV-D10 notice about this child, shown inside the child's card (the first, if several). */
export function noticeFor(learnerId: string, notices: readonly MoveNotice[]): MoveNotice | null {
  return notices.find((n) => n.learnerId === learnerId) ?? null;
}
