import type { ApiResult, SpaceListItem, TransferDestinationView, TransferSchoolCount, TransferSourceView, TransferView } from './api';
import { isOpenTransfer } from './transfer';

/**
 * The class requests page's pure parts (F-SPACE-002 section 4.8 "Requests page", PR T-6b; design authority the T-0b
 * mockups, `design/screens/transfer/requests-page.md`). Order within a refresh: the cards that wait for this class,
 * then the ones that wait for others, then scheduled moves; the 30-day history apart, newest first. Nothing here names
 * who said no: an ending is one neutral line with a date.
 */

export type ClassView = TransferSourceView | TransferDestinationView;

/** Whether this class's own step still waits on an open request (its Agree / Accept). */
export function ownAnswerWaits(view: ClassView): boolean {
  return view.status === 'requested' && view.steps?.[view.role] === 'waiting';
}

/** 0: waits for this class; 1: waits for others (room included); 2: scheduled. */
export function cardRank(view: ClassView): number {
  if (ownAnswerWaits(view)) return 0;
  if (view.status === 'approved' && !view.blockReason) return 2;
  return 1;
}

/** A history row's date: the move, else the ending, else the ask. */
export function historyDate(view: ClassView): string {
  return view.executedAt ?? view.endedAt ?? view.createdAt;
}

export interface ClassMoveGroups {
  leaving: TransferSourceView[];
  leavingHistory: TransferSourceView[];
  joining: TransferDestinationView[];
  joiningHistory: TransferDestinationView[];
  /** A move into this class happened in the last 30 days: the page offers New class code. */
  movedIn: boolean;
}

function byRank<T extends ClassView>(views: T[], keep: readonly string[] | null): T[] {
  const ranked = [...views].sort((a, b) => cardRank(a) - cardRank(b) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (!keep) return ranked;
  // Focus is inside a card: the cards drawn last time keep their places; a new card goes after them.
  const at = new Map(keep.map((id, i) => [id, i]));
  const kept = ranked.filter((v) => at.has(v.id)).sort((a, b) => (at.get(a.id) ?? 0) - (at.get(b.id) ?? 0));
  return [...kept, ...ranked.filter((v) => !at.has(v.id))];
}

const newestFirst = <T extends ClassView>(views: T[]): T[] => [...views].sort((a, b) => Date.parse(historyDate(b)) - Date.parse(historyDate(a)));

/**
 * The page's two groups and their histories. `keep` is the card order of the last draw, kept while focus is in a card.
 * `stay` is the cards drawn before an automatic refresh: nothing auto-dismisses (spec 4.8), so a card that finished
 * meanwhile stays a card (with its ended or moved line and no actions) until the next manual refresh moves it into the
 * history.
 */
export function classMoveGroups(views: readonly TransferView[], keep: readonly string[] | null = null, stay: ReadonlySet<string> | null = null): ClassMoveGroups {
  const card = (v: ClassView): boolean => isOpenTransfer(v) || (stay?.has(v.id) ?? false);
  const source = views.filter((v): v is TransferSourceView => v.role === 'source');
  const dest = views.filter((v): v is TransferDestinationView => v.role === 'destination');
  return {
    leaving: byRank(source.filter(card), keep),
    leavingHistory: newestFirst(source.filter((v) => !card(v))),
    joining: byRank(dest.filter(card), keep),
    joiningHistory: newestFirst(dest.filter((v) => !card(v))),
    movedIn: dest.some((v) => v.status === 'executed'),
  };
}

/** The classes this account owns or teaches itself (never through a school): the only ones T11 lets it answer in one click. */
export function directClassIds(items: readonly SpaceListItem[] | null): Set<string> {
  return new Set((items ?? []).filter((i) => i.space.kind === 'class' && (i.role === 'owner' || i.role === 'teacher')).map((i) => i.space.id));
}

/**
 * **Agree for both classes** (T11): the family said yes, both class steps still wait, and both this class (`spaceId`,
 * the page's class) and the new class (named on this card) are ones this account owns or teaches directly. A school
 * admin's cascade never qualifies: the Worker fills a school-reached slot via `school_admin` and refuses two slots in
 * one action then (`one_slot_per_action`).
 */
export function canAgreeBoth(view: TransferSourceView, spaceId: string, direct: ReadonlySet<string>): boolean {
  if (!ownAnswerWaits(view) || !view.destination || !view.steps) return false;
  return view.steps.learner === 'yes' && view.steps.destination === 'waiting' && direct.has(spaceId) && direct.has(view.destination.spaceId);
}

/** **Try again** on the destination of an agreed move that waits for its own class's or school's room (not `cap_learner`). */
export function retryShown(view: ClassView): boolean {
  return view.role === 'destination' && view.status === 'approved' && (view.blockReason === 'cap_class' || view.blockReason === 'cap_school');
}

/**
 * What an answer means (requests-page.md "States"): `ended` (it closed meanwhile: reload to the ended line),
 * `changed` (a lost race or a reset learner slot: "Something changed. Look again." with Refresh), `reload` (Try again
 * found it asked again: back to the waiting card, no reason), `failed` ("Didn't go through" with Try again), or a
 * page state.
 */
export type ActionOutcome = 'ok' | 'ended' | 'changed' | 'reload' | 'failed' | 'locked' | 'signIn' | 'forbidden';

export function actionOutcome(result: ApiResult<unknown>): ActionOutcome {
  if (result.ok) return 'ok';
  if (result.error === 'network') return 'failed';
  if (result.status === 401) return 'signIn';
  const code = result.code ?? '';
  if (code === 'transfers_locked') return 'locked';
  if (code === 'not_open' || code === 'expired') return 'ended';
  if (code === 'request_changed' || code === 'awaiting_learner') return 'changed';
  if (code === 'consent_outdated' || code === 'not_approved') return 'reload';
  if (result.status === 403 || result.status === 404) return 'forbidden';
  return 'failed';
}

export interface SchoolMoveLink {
  spaceId: string;
  name: string;
  waiting: number;
}

/** A school row's links: one per child class with a waiting move, in the school's class order (counts only). */
export function schoolMoveLinks(counts: readonly TransferSchoolCount[], classes: ReadonlyArray<{ id: string; name: string }>): SchoolMoveLink[] {
  const waiting = new Map(counts.map((c) => [c.spaceId, c.waiting]));
  return classes.flatMap((cls) => {
    const n = waiting.get(cls.id) ?? 0;
    return n > 0 ? [{ spaceId: cls.id, name: cls.name, waiting: n }] : [];
  });
}
