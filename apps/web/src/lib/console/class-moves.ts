import { NOTES_MODES, type NotesMode } from '@hangul-route/content-schema';
import type { ApiResult } from './api';

/**
 * [TV] Teacher moves and the class-scope update in the console — AMENDMENTS-TEACHER-VISIBILITY-TRANSFER
 * sections 4.3 and 5 (owner decisions 2026-10-14). Pure readers of the Worker's answers (lenient: a row this
 * bundle cannot read is dropped, never a failed page) and the mapping of an error code to a sheet line.
 * Moves are addressed by their opaque `move:` id; names never reach a URL.
 */

export type ClassMoveViewStatus = 'waiting' | 'moved' | 'ended';
export type ClassMoveKind = 'direct' | 'accept';

export interface ClassMoveDestination {
  id: string;
  name: string;
}

export interface OutgoingMove {
  id: string;
  kind: ClassMoveKind;
  status: ClassMoveViewStatus;
  to: { spaceId: string; name: string };
  learner: { name: string; avatar: string } | null;
  createdAt: string;
  at: string | null;
}

export interface IncomingMove {
  id: string;
  kind: ClassMoveKind;
  status: ClassMoveViewStatus;
  from: { name: string };
  /** Before acceptance initials, a picture and a level only; after the move, the roster's name. */
  learner: { alias: string; avatar: string; level: string } | { name: string; avatar: string } | null;
  createdAt: string;
  at: string | null;
}

export interface ClassMoveLists {
  outgoing: OutgoingMove[];
  incoming: IncomingMove[];
}

export interface MoveNotice {
  id: string;
  learnerId: string;
  learnerName: string;
  to: { spaceId: string; name: string };
  executedAt: string;
}

export interface ClassScopeLearner {
  learnerId: string;
  name: string;
  needed: boolean;
}

export interface ClassScopeState {
  current: string;
  learners: ClassScopeLearner[];
}

export interface ClassMovePreview {
  destination: ClassMoveDestination;
  direct: boolean;
}

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const STATUSES: readonly ClassMoveViewStatus[] = ['waiting', 'moved', 'ended'];
const KINDS: readonly ClassMoveKind[] = ['direct', 'accept'];
const isStatus = (v: unknown): v is ClassMoveViewStatus => str(v) && (STATUSES as readonly string[]).includes(v);
const isKind = (v: unknown): v is ClassMoveKind => str(v) && (KINDS as readonly string[]).includes(v);
const rows = (v: unknown): Plain[] => (Array.isArray(v) ? v.filter(isPlain) : []);

function readNamed(v: unknown): { name: string; avatar: string } | null {
  return isPlain(v) && str(v.name) && str(v.avatar) ? { name: v.name, avatar: v.avatar } : null;
}

export function readOutgoing(v: Plain): OutgoingMove | null {
  if (!str(v.id) || !isKind(v.kind) || !isStatus(v.status) || !isPlain(v.to) || !str(v.to.spaceId) || !str(v.to.name) || !str(v.createdAt)) return null;
  return { id: v.id, kind: v.kind, status: v.status, to: { spaceId: v.to.spaceId, name: v.to.name }, learner: readNamed(v.learner), createdAt: v.createdAt, at: str(v.at) ? v.at : null };
}

export function readIncoming(v: Plain): IncomingMove | null {
  if (!str(v.id) || !isKind(v.kind) || !isStatus(v.status) || !isPlain(v.from) || !str(v.from.name) || !str(v.createdAt)) return null;
  let learner: IncomingMove['learner'] = null;
  if (isPlain(v.learner) && str(v.learner.alias) && str(v.learner.avatar) && str(v.learner.level)) learner = { alias: v.learner.alias, avatar: v.learner.avatar, level: v.learner.level };
  else learner = readNamed(v.learner);
  return { id: v.id, kind: v.kind, status: v.status, from: { name: v.from.name }, learner, createdAt: v.createdAt, at: str(v.at) ? v.at : null };
}

export function readMoveLists(data: unknown): ClassMoveLists {
  const d = isPlain(data) ? data : {};
  return {
    outgoing: rows(d.outgoing).flatMap((r) => readOutgoing(r) ?? []),
    incoming: rows(d.incoming).flatMap((r) => readIncoming(r) ?? []),
  };
}

export function readNotices(data: unknown): MoveNotice[] {
  const d = isPlain(data) ? data : {};
  return rows(d.notices).flatMap((n) =>
    str(n.id) && str(n.learnerId) && str(n.learnerName) && isPlain(n.to) && str(n.to.spaceId) && str(n.to.name) && str(n.executedAt)
      ? [{ id: n.id, learnerId: n.learnerId, learnerName: n.learnerName, to: { spaceId: n.to.spaceId, name: n.to.name }, executedAt: n.executedAt }]
      : [],
  );
}

export function readClassScope(data: unknown): ClassScopeState | null {
  if (!isPlain(data) || !str(data.current)) return null;
  return {
    current: data.current,
    learners: rows(data.learners).flatMap((l) => (str(l.learnerId) && str(l.name) && typeof l.needed === 'boolean' ? [{ learnerId: l.learnerId, name: l.name, needed: l.needed }] : [])),
  };
}

export function readDestinations(data: unknown): ClassMoveDestination[] {
  const d = isPlain(data) ? data : {};
  return rows(d.destinations).flatMap((r) => (str(r.id) && str(r.name) ? [{ id: r.id, name: r.name }] : []));
}

export function readPreview(data: unknown): ClassMovePreview | null {
  if (!isPlain(data) || !isPlain(data.destination) || !str(data.destination.id) || !str(data.destination.name) || typeof data.direct !== 'boolean') return null;
  return { destination: { id: data.destination.id, name: data.destination.name }, direct: data.direct };
}

/** The report's `scope` and `settings` (lenient: anything else reads as unknown, never a failed report). */
export function readReportScope(raw: Plain): { scope: 'base' | 'full' | null; settings: { classNotes: NotesMode | null } | null } {
  const scope = raw.scope === 'base' || raw.scope === 'full' ? raw.scope : null;
  const settings = isPlain(raw.settings)
    ? { classNotes: str(raw.settings.classNotes) && (NOTES_MODES as readonly string[]).includes(raw.settings.classNotes) ? (raw.settings.classNotes as NotesMode) : null }
    : null;
  return { scope, settings };
}

// ---------------------------------------------------------------------------
// The sheet's error lines

export type MoveErrorKey =
  | 'full'
  | 'capLearner'
  | 'alreadyMember'
  | 'alreadyOpen'
  | 'sameSpace'
  | 'codeRequired'
  | 'codeNotFound'
  | 'codeExpired'
  | 'tooManyAttempts'
  | 'notTransferable'
  | 'offline'
  | 'failed';

/** What a failed answer means for the sheet: one line, a refreshed lookup, or a page state. */
export type MoveError = { kind: 'line'; key: MoveErrorKey } | { kind: 'refind' } | { kind: 'locked' } | { kind: 'signIn' } | { kind: 'forbidden' };

const LINES: Readonly<Record<string, MoveErrorKey>> = {
  cap_class: 'full',
  cap_school: 'full',
  cap_learner: 'capLearner',
  move_blocked: 'full',
  already_member: 'alreadyMember',
  already_open: 'alreadyOpen',
  same_space: 'sameSpace',
  code_required: 'codeRequired',
  code_not_found: 'codeNotFound',
  invalid_code: 'codeNotFound',
  code_expired: 'codeExpired',
  too_many_attempts: 'tooManyAttempts',
  not_transferable: 'notTransferable',
};

export function moveError(result: ApiResult<unknown>): MoveError | null {
  if (result.ok) return null;
  if (result.error === 'network') return { kind: 'line', key: 'offline' };
  if (result.status === 401) return { kind: 'signIn' };
  const code = result.code ?? '';
  if (code === 'transfers_locked') return { kind: 'locked' };
  if (code === 'destination_changed') return { kind: 'refind' };
  if (code === 'move_blocked' && result.details?.reason === 'cap_learner') return { kind: 'line', key: 'capLearner' };
  if (code === 'not_found' || result.status === 403) return { kind: 'forbidden' };
  return { kind: 'line', key: LINES[code] ?? 'failed' };
}

/** Open first, then newest first (stable within a refresh). */
export const moveOrder = <T extends { status: ClassMoveViewStatus; createdAt: string; id: string }>(a: T, b: T): number =>
  Number(b.status === 'waiting') - Number(a.status === 'waiting') || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
