import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { RelinkView, RosterLearner, TransferView } from './api';
import type { ClassMoveLists } from './class-moves';
import { minutesLeft } from './relink';
import { pendingCount } from './transfer';

/**
 * One status per learner (AMENDMENTS-GROWNUP-UX GX-D1, section 3; owner request 2026-10-31). A pure function turns the
 * roster, the re-link list, the transfer list and the class-move list (or the roster's own `pending` field once GX-W is
 * deployed) into one status per learner, the learners asking to join, the moves out that wait for this space, and the
 * totals. Every screen that draws a learner's state reads it, so a learner never shows two states on two screens.
 *
 * Rules (section 3.2 to 3.4):
 * - priority `relink` > `move_yours` > `move_room` > `move_scheduled` > `move_others` > `new` > `in_class` (`none` in a
 *   family): one chip per learner, the highest wins;
 * - an expired re-link is dropped before ranking; a move that is no longer open is not a status;
 * - a read that failed or was skipped (`null`) adds nothing, never a guess; the model never matches by name;
 * - `totals.moves` is `pendingCount(transfers)` plus the incoming teacher moves, never counted from matched learners, so
 *   a family-started move out (its source view has no `learnerId` before GX-W) is still counted;
 * - re-links are counted whatever `CLASS_TRANSFER` says (the caller passes `null` move reads while moves are hidden).
 */

export type LearnerStatusKind = 'relink' | 'move_yours' | 'move_others' | 'move_room' | 'move_scheduled' | 'new' | 'in_class' | 'none';

export interface LearnerMove {
  source: 'transfer' | 'teacher';
  id: string;
  /** The other class's name, where this viewer may read it (TV-D8); null otherwise. */
  to: string | null;
  /** The move date of a scheduled move. */
  on: string | null;
  expiresAt: string | null;
}

export interface LearnerStatus {
  learnerId: string;
  kind: LearnerStatusKind;
  /** `relink` and `move_yours` only: the grown-up's answer is needed. */
  action: boolean;
  relink?: { id: string; expiresAt: string };
  move?: LearnerMove;
  /** The roster row's `scope === 'base'` (TV-D3): a muted line under the card's header, never a chip. */
  scopeBase: boolean;
}

/** A learner asking to join this space (not on the roster yet): initials, picture and level only until accepted (T8). */
export interface IncomingItem {
  source: 'transfer' | 'teacher';
  id: string;
  alias: string;
  avatar: string | null;
  level: string | null;
  /** The source class name (TV-D8), or null for a family. */
  from: string | null;
  /** A teacher-move view carries none. */
  expiresAt: string | null;
  createdAt: string | null;
}

/** A move out of this space that waits for this space's answer. */
export interface OutgoingItem {
  source: 'transfer';
  id: string;
  /** Null before GX-W on a family-started request (section 3.3). */
  learnerId: string | null;
  name: string | null;
  avatar: string | null;
  to: string | null;
  expiresAt: string | null;
}

export interface AttentionModel {
  byLearner: Record<string, LearnerStatus>;
  incoming: IncomingItem[];
  outgoing: OutgoingItem[];
  totals: { relinks: number; moves: number; all: number };
}

export interface AttentionInput {
  kind: 'class' | 'family' | 'school';
  roster: readonly RosterLearner[];
  /** null: not read (an older Worker, a failed read). */
  relinks: readonly RelinkView[] | null;
  /** null: not read, also while class moves are hidden (`useTransfersShown`). */
  transfers: readonly TransferView[] | null;
  classMoves: ClassMoveLists | null;
  now: Date;
}

/** "New" lasts this long after a join, while nothing is synced yet. */
export const NEW_LEARNER_MS = 7 * 24 * 60 * 60 * 1000;

const RANK: Readonly<Record<LearnerStatusKind, number>> = {
  relink: 7,
  move_yours: 6,
  move_room: 5,
  move_scheduled: 4,
  move_others: 3,
  new: 2,
  in_class: 1,
  none: 0,
};

type Candidate = Pick<LearnerStatus, 'kind' | 'relink' | 'move'>;

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const strOrNull = (v: unknown): string | null => (str(v) ? v : null);
const future = (iso: string | null, now: Date): boolean => {
  if (iso === null) return false;
  const at = Date.parse(iso);
  return !Number.isNaN(at) && at > now.getTime();
};

/**
 * The roster row's `pending` (GX-W, section 12), read leniently: a shape this bundle cannot read is no state. Returns
 * null when the row carries no `pending` field (an older Worker), so the model falls back to the three list reads.
 */
export function readPending(row: unknown): Candidate[] | null {
  if (!isPlain(row) || !('pending' in row)) return null;
  const pending = row.pending;
  if (!isPlain(pending)) return [];
  const out: Candidate[] = [];
  const relink = pending.relink;
  if (isPlain(relink) && str(relink.id) && str(relink.expiresAt)) out.push({ kind: 'relink', relink: { id: relink.id, expiresAt: relink.expiresAt } });
  const move = pending.move;
  if (isPlain(move) && str(move.id) && (move.source === 'transfer' || move.source === 'teacher')) {
    const steps: Readonly<Record<string, LearnerStatusKind>> = { yours: 'move_yours', others: 'move_others', room: 'move_room', scheduled: 'move_scheduled' };
    const kind = str(move.step) ? steps[move.step] : undefined;
    if (kind) out.push({ kind, move: { source: move.source, id: move.id, to: strOrNull(move.to), on: strOrNull(move.on), expiresAt: strOrNull(move.expiresAt) } });
  }
  return out;
}

/** The candidates the three list reads give one learner (section 3.3, "Before GX-W"). */
function listCandidates(input: AttentionInput): Map<string, Candidate[]> {
  const out = new Map<string, Candidate[]>();
  const add = (learnerId: string | null | undefined, c: Candidate): void => {
    if (!learnerId) return;
    out.set(learnerId, [...(out.get(learnerId) ?? []), c]);
  };
  for (const r of input.relinks ?? []) {
    if (r.status !== 'pending' || !future(r.expiresAt, input.now)) continue;
    add(r.learnerId, { kind: 'relink', relink: { id: r.id, expiresAt: r.expiresAt } });
  }
  for (const view of input.transfers ?? []) {
    if (view.status !== 'requested' && view.status !== 'approved') continue;
    if (view.role === 'destination') continue;
    const learnerId = view.role === 'source' ? view.learnerId : view.learner?.id;
    const to = view.role === 'source' ? (view.destination?.name ?? null) : (view.to?.name ?? null);
    const on = view.role === 'source' ? view.scheduledFor : view.executeAfter;
    const move = (step: LearnerStatusKind, date: string | null = null): Candidate => ({ kind: step, move: { source: 'transfer', id: view.id, to, on: date, expiresAt: view.expiresAt } });
    if (view.status === 'approved') {
      if (view.blockReason) add(learnerId, move('move_room'));
      else if (future(on, input.now)) add(learnerId, move('move_scheduled', on));
      else add(learnerId, move('move_others'));
      continue;
    }
    const yours = view.role === 'source' ? view.steps?.source === 'waiting' : view.learnerState === 'pending';
    add(learnerId, move(yours ? 'move_yours' : 'move_others'));
  }
  // An outgoing class move carries a learner id only from GX-W on (while the stored status is `requested`).
  for (const m of input.classMoves?.outgoing ?? []) {
    if (m.status !== 'waiting') continue;
    add(m.learnerId, { kind: 'move_others', move: { source: 'teacher', id: m.id, to: m.to.name, on: null, expiresAt: null } });
  }
  return out;
}

const best = (candidates: readonly Candidate[], base: LearnerStatusKind): Candidate =>
  candidates.reduce<Candidate>((top, c) => (RANK[c.kind] > RANK[top.kind] ? c : top), { kind: base });

/** The learner's default state: `new` within 7 days of the join with nothing synced, else `in_class` (or `none` in a family). */
function baseKind(learner: RosterLearner, kind: AttentionInput['kind'], now: Date): LearnerStatusKind {
  const joined = Date.parse(learner.joinedAt);
  if (learner.summary === null && !Number.isNaN(joined) && now.getTime() - joined < NEW_LEARNER_MS && joined <= now.getTime()) return 'new';
  return kind === 'family' ? 'none' : 'in_class';
}

export function attentionModel(input: AttentionInput): AttentionModel {
  const fromLists = listCandidates(input);
  const byLearner: Record<string, LearnerStatus> = {};
  let pendingRelinks = 0;
  for (const learner of input.roster) {
    // `pending` preferred when present (GX-W): the roster's own field is the newest read of the same rows.
    const fromRow = readPending(learner);
    const candidates = (fromRow ?? fromLists.get(learner.id) ?? []).filter((c) => c.kind !== 'relink' || (c.relink && future(c.relink.expiresAt, input.now)));
    if (fromRow?.some((c) => c.kind === 'relink' && c.relink && future(c.relink.expiresAt, input.now))) pendingRelinks += 1;
    const top = best(candidates, baseKind(learner, input.kind, input.now));
    byLearner[learner.id] = {
      learnerId: learner.id,
      kind: top.kind,
      action: top.kind === 'relink' || top.kind === 'move_yours',
      ...(top.relink ? { relink: top.relink } : {}),
      ...(top.move ? { move: top.move } : {}),
      scopeBase: learner.scope === 'base',
    };
  }

  const incoming: IncomingItem[] = [];
  const outgoing: OutgoingItem[] = [];
  for (const view of input.transfers ?? []) {
    if (view.status !== 'requested') continue;
    if (view.role === 'destination' && view.steps?.destination === 'waiting') {
      incoming.push({
        source: 'transfer',
        id: view.id,
        alias: view.learner?.name ?? '',
        avatar: view.learner?.avatar ?? null,
        level: view.learner?.level ?? null,
        from: view.comingFrom?.name ?? null,
        expiresAt: view.expiresAt,
        createdAt: view.createdAt,
      });
    }
    if (view.role === 'source' && view.steps?.source === 'waiting') {
      outgoing.push({ source: 'transfer', id: view.id, learnerId: view.learnerId, name: view.learner?.name ?? null, avatar: view.learner?.avatar ?? null, to: view.destination?.name ?? null, expiresAt: view.expiresAt });
    }
  }
  let teacherMovesIn = 0;
  for (const m of input.classMoves?.incoming ?? []) {
    if (m.status !== 'waiting' || m.kind !== 'accept') continue;
    teacherMovesIn += 1;
    const alias = m.learner && 'alias' in m.learner ? m.learner : null;
    incoming.push({ source: 'teacher', id: m.id, alias: alias?.alias ?? '', avatar: m.learner?.avatar ?? null, level: alias?.level ?? null, from: m.from.name, expiresAt: null, createdAt: m.createdAt });
  }
  incoming.sort(byExpiry);
  outgoing.sort(byExpiry);

  const relinks = input.relinks !== null ? input.relinks.filter((r) => r.status === 'pending' && future(r.expiresAt, input.now)).length : pendingRelinks;
  const moves = (input.transfers ? pendingCount(input.transfers) : 0) + teacherMovesIn;
  return { byLearner, incoming, outgoing, totals: { relinks, moves, all: relinks + moves } };
}

/** When an action item closes: a re-link's or a move's `expiresAt`; null when none is known. */
export function statusExpiry(status: LearnerStatus | undefined): string | null {
  if (!status?.action) return null;
  return status.relink?.expiresAt ?? status.move?.expiresAt ?? null;
}

const expiryValue = (iso: string | null | undefined): number => {
  const at = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
};

/** Soonest `expiresAt` first; a missing one last, then the oldest request first. */
function byExpiry(a: { expiresAt: string | null; createdAt?: string | null }, b: { expiresAt: string | null; createdAt?: string | null }): number {
  const ea = expiryValue(a.expiresAt);
  const eb = expiryValue(b.expiresAt);
  if (ea !== eb) return ea < eb ? -1 : 1;
  return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
}

/**
 * The roster's order (section 4 "Ordering"): action cards first, by soonest expiry (a re-link, closing in minutes, before a
 * move; a missing expiry last); then the shipped order. `pinned` ids keep the index they had in `previous` (a card decided
 * a moment ago keeps its place with its result line, so the list never jumps under the grown-up's thumb).
 */
export function rosterOrder<T extends { id: string }>(learners: readonly T[], byLearner: Readonly<Record<string, LearnerStatus>>, pinned: ReadonlySet<string> = new Set(), previous: readonly string[] = []): T[] {
  const index = new Map(learners.map((l, i) => [l.id, i]));
  const sorted = [...learners].sort((a, b) => {
    const sa = byLearner[a.id];
    const sb = byLearner[b.id];
    const aa = sa?.action === true;
    const ab = sb?.action === true;
    if (aa !== ab) return aa ? -1 : 1;
    if (aa) {
      const ea = expiryValue(statusExpiry(sa));
      const eb = expiryValue(statusExpiry(sb));
      if (ea !== eb) return ea < eb ? -1 : 1;
    }
    return (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0);
  });
  if (pinned.size === 0) return sorted;
  // Hold every pinned card at its previous index; the rest fill the other places in their new order.
  const out: (T | undefined)[] = new Array(sorted.length).fill(undefined);
  const held = new Set<string>();
  for (const id of pinned) {
    const at = previous.indexOf(id);
    const item = sorted.find((l) => l.id === id);
    if (item && at >= 0 && at < out.length && out[at] === undefined) {
      out[at] = item;
      held.add(id);
    }
  }
  const rest = sorted.filter((l) => !held.has(l.id));
  let k = 0;
  for (let i = 0; i < out.length; i += 1) if (out[i] === undefined) out[i] = rest[k++];
  return out as T[];
}

/** Whole minutes left, rounded up, at least 1 while the request is open (section 4 rules). */
export function minutesShown(expiresAt: string, now: Date): number {
  return Math.max(1, minutesLeft(expiresAt, now));
}

export type ChipTone = 'action' | 'in' | 'info' | 'quiet';

export interface StatusWords {
  chip: string;
  reason: string | null;
  tone: ChipTone;
}

/** The chip and reason line of a status, in `locale` (section 4 table); null for `none` (a family's default). */
export function statusWords(status: LearnerStatus, now: Date, locale: UiLocale = DEFAULT_LOCALE): StatusWords | null {
  const t = getMessages(locale).console.status;
  const to = status.move?.to ?? null;
  switch (status.kind) {
    case 'relink':
      return { chip: t.needsOk, reason: status.relink ? t.newDevice(minutesShown(status.relink.expiresAt, now)) : null, tone: 'action' };
    case 'move_yours':
      return { chip: t.needsOk, reason: to ? t.moveTo(to) : null, tone: 'action' };
    case 'move_room':
      return { chip: t.waitingSeat, reason: null, tone: 'quiet' };
    case 'move_scheduled': {
      const on = status.move?.on ?? null;
      const date = on ? formatDate(locale, on, 'monthDay') : null;
      return { chip: date ? t.moving(date) : t.moveWaiting, reason: null, tone: date ? 'info' : 'quiet' };
    }
    case 'move_others':
      return { chip: t.moveWaiting, reason: to ? t.waitingFor(to) : null, tone: 'quiet' };
    case 'new':
      return { chip: t.new, reason: t.noPractice, tone: 'info' };
    case 'in_class':
      return { chip: t.inClass, reason: null, tone: 'in' };
    default:
      return null;
  }
}
