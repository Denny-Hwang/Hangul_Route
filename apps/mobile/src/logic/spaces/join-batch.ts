import type { SpaceKind } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { needsFreshPin } from '../profiles/session';
import { joinErrorMessage, type JoinErrorCode } from './join-code';

/**
 * [OA] "Who is joining?" (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D14, sections 10.2, 10.3, 10.6, 15, CS-11; row OA-7b;
 * wireframe `profiles/people-on-device.md` Panels D and E, mock `design/screens/profiles/who-is-joining.md`).
 *
 * A **family** code entered on a device with 2 or more learner profiles lists them with check boxes: the active
 * learner checked, a locked profile (typically a grown-up's own "Me") unchecked with **Takes a family place.**, a
 * learner whose link on this device is class-scoped disabled with **Linked for a class on this device.** Then the
 * shipped name step for each picked learner, one consent step naming every one of them, and the joins in sequence
 * (one `/join` per learner, each taking its seat atomically on the Worker). Class codes never come here.
 *
 * Pure: the learners, locks, scopes, the PIN time, the clock and the join call are passed in. The screen
 * (`screens/sync/JoinBatch.tsx`) only reads and acts on the answers.
 */

/** A learner profile as the checklist reads it (creation order, or the chooser's tile order). */
export interface BatchLearner {
  id: string;
  displayName: string;
  avatar: string;
}

/** One checklist row. `caption` names the line under the name (`join.who.takesPlace`, `join.who.classOnly`). */
export interface ChecklistRow extends BatchLearner {
  active: boolean;
  locked: boolean;
  /** Class-scoped on this device (section 10.6): a family join is refused by scope, so the row cannot be picked. */
  disabled: boolean;
  caption: 'takesPlace' | 'classOnly' | null;
}

/**
 * Whether the checklist replaces the one-learner join: the flag on (`EXPO_PUBLIC_MULTI_JOIN`, section 16), a family
 * code, 2 or more learner profiles, and at least one of them not class-scoped. On a class device (every learner
 * class-scoped) it never appears (section 10.6); class codes stay one learner at a time (OA-D14, OQ-15).
 */
export function batchOffered(input: { flag: boolean; kind: SpaceKind; learners: readonly { id: string }[]; classScoped: readonly string[] }): boolean {
  const { flag, kind, learners, classScoped } = input;
  if (!flag || kind !== 'family' || learners.length < 2) return false;
  return learners.some((l) => !classScoped.includes(l.id));
}

/** The rows, in the order given. A class-scoped row is disabled whatever else is true of it. */
export function checklistRows(input: {
  learners: readonly BatchLearner[];
  activeId: string | null;
  locks: readonly string[];
  classScoped: readonly string[];
}): ChecklistRow[] {
  const { learners, activeId, locks, classScoped } = input;
  return learners.map((l) => {
    const locked = locks.includes(l.id);
    const disabled = classScoped.includes(l.id);
    return {
      id: l.id,
      displayName: l.displayName,
      avatar: l.avatar,
      active: l.id === activeId,
      locked,
      disabled,
      caption: disabled ? 'classOnly' : locked ? 'takesPlace' : null,
    };
  });
}

/** Section 10.3: only the active learner starts checked, and only when it is neither locked nor class-scoped. */
export function initialPicks(rows: readonly ChecklistRow[]): string[] {
  return rows.filter((r) => r.active && !r.locked && !r.disabled).map((r) => r.id);
}

/** Checks or unchecks a row; a disabled row or an unknown id leaves the picks as they are. */
export function togglePick<T extends readonly string[]>(picks: T, id: string, rows: readonly ChecklistRow[]): T | string[] {
  const row = rows.find((r) => r.id === id);
  if (row === undefined || row.disabled) return picks;
  return picks.includes(id) ? picks.filter((p) => p !== id) : [...picks, id];
}

/** The picked rows in the checklist order (the order of the name steps, the consent lines and the joins). */
export function pickedInOrder(picks: readonly string[], rows: readonly ChecklistRow[]): ChecklistRow[] {
  return rows.filter((r) => !r.disabled && picks.includes(r.id));
}

/**
 * CS-11, OA-D5b (3): a pick that includes anyone other than the active learner asks the PIN (or face or fingerprint)
 * again unless one was entered within `GROWN_UP_FRESH_PIN_MS` (2 minutes). A locked profile counts as "other" even
 * when it is the active one: it is a grown-up's own, and joining it takes a family place. Joining only the active,
 * unlocked learner needs no PIN, as today.
 */
export function batchPickNeedsPin(input: { picks: readonly string[]; rows: readonly ChecklistRow[]; lastPinVerifiedAt: number | null; now: number }): boolean {
  const { picks, rows, lastPinVerifiedAt, now } = input;
  const other = pickedInOrder(picks, rows).some((r) => !r.active || r.locked);
  return other && needsFreshPin('join_other', lastPinVerifiedAt, now);
}

/**
 * The locks that count (OA-D9, section 13.2): none without a PIN (a lock without a PIN is void); every profile while
 * the stored record cannot be read (fail closed: each then reads Takes a family place. and asks the PIN).
 */
export function locksThatCount(read: readonly string[] | 'unread', pinSet: boolean, ids: readonly string[]): string[] {
  if (!pinSet) return [];
  return read === 'unread' ? [...ids] : [...read];
}

// ---- The joins (section 10.3) ----

/** What one `membership-store.join` answers, as the batch reads it. */
export type BatchAnswer = { ok: true; alreadyMember: boolean } | { ok: false; error: JoinErrorCode; cap?: number };

/** A refused seat: a cap the Worker holds (409). A result, never an error. */
type CapCode = 'cap_family' | 'cap_class' | 'cap_school' | 'cap_learner';
const CAP_CODES: ReadonlySet<JoinErrorCode> = new Set<JoinErrorCode>(['cap_family', 'cap_class', 'cap_school', 'cap_learner']);
/** Offline, a timeout, a `5xx` (the client's `unknown`) or a busy Worker: the rest can be tried again as they are. */
const RETRY_CODES: ReadonlySet<JoinErrorCode> = new Set<JoinErrorCode>(['network', 'unknown', 'too_many_attempts']);
/**
 * About one learner, not the code: this device cannot act for that learner (`forbidden`, a `401` or `403` from the
 * device check) or the learner is gone. Trying again cannot help, and the others can still join: a result line, and
 * the sequence goes on (section 10.3, one result line per learner).
 */
type LearnerCode = 'forbidden' | 'learner_not_found' | 'already_bound';
const LEARNER_CODES: ReadonlySet<JoinErrorCode> = new Set<JoinErrorCode>(['forbidden', 'learner_not_found', 'already_bound']);

export type JoinClass = 'joined' | 'already' | 'refused' | 'skipped' | 'stop';

export function classifyJoin(answer: BatchAnswer): JoinClass {
  if (answer.ok) return answer.alreadyMember ? 'already' : 'joined';
  if (CAP_CODES.has(answer.error)) return 'refused';
  return LEARNER_CODES.has(answer.error) ? 'skipped' : 'stop';
}

/** One learner's result line. `refused` keeps the cap the Worker sent (null when it sent none). */
export type BatchResult =
  | { id: string; name: string; kind: 'joined' | 'already' }
  | { id: string; name: string; kind: 'refused'; error: CapCode; cap: number | null }
  | { id: string; name: string; kind: 'skipped'; error: LearnerCode };

/** A learner still to join, with the name it joins under (the name step's answer). */
export interface BatchPick {
  id: string;
  name: string;
}

/** Where the sequence stopped: the error, whether Try again can help, the learners left, and the one being tried. */
export interface BatchStop {
  error: JoinErrorCode;
  retry: boolean;
  remaining: BatchPick[];
  /** The learner whose `/join` ended in the stop: its seat may have been taken before the answer was lost. */
  tried: string;
}

export interface BatchRun {
  results: BatchResult[];
  stop: BatchStop | null;
}

/**
 * Section 10.3: the joins in sequence, one `/join` per learner. A refused seat is a result and the sequence goes on;
 * so is a failure about that one learner (`LEARNER_CODES`). The first other failure stops it: the results so far
 * stay, and the rest wait for **Try again** (`retry` for a network error, a timeout, a `5xx` or a busy Worker; a code
 * that no longer works cannot be helped by trying again). A join that throws is a network stop.
 *
 * A retry passes the earlier run as `before`: it is idempotent. The learner whose answer was lost (`before.stop.tried`)
 * answers "already a member" when the Worker had taken its seat, and reads **joined**; a learner who was a member
 * before the batch reads **already**.
 */
export async function runBatch(picks: readonly BatchPick[], join: (id: string, name: string) => Promise<BatchAnswer>, before?: BatchRun): Promise<BatchRun> {
  const results: BatchResult[] = [...(before?.results ?? [])];
  const lost = before?.stop?.tried ?? null;
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i]!;
    let answer: BatchAnswer;
    try {
      answer = await join(pick.id, pick.name);
    } catch {
      answer = { ok: false, error: 'network' };
    }
    if (!answer.ok) {
      const kind = classifyJoin(answer);
      if (kind === 'stop') {
        return { results, stop: { error: answer.error, retry: RETRY_CODES.has(answer.error), remaining: picks.slice(i), tried: pick.id } };
      }
      if (kind === 'skipped') results.push({ id: pick.id, name: pick.name, kind: 'skipped', error: answer.error as LearnerCode });
      else results.push({ id: pick.id, name: pick.name, kind: 'refused', error: answer.error as CapCode, cap: answer.cap ?? null });
      continue;
    }
    results.push({ id: pick.id, name: pick.name, kind: answer.alreadyMember && pick.id !== lost ? 'already' : 'joined' });
  }
  return { results, stop: null };
}

/** The learners in the family after the batch: joined and already a member both count (`join.who.result`). */
export function batchJoined(results: readonly BatchResult[]): number {
  return results.filter((r) => r.kind === 'joined' || r.kind === 'already').length;
}

type CaregiverCopy = Pick<Messages['caregiver'], 'join' | 'retry' | 'audience'>;

/**
 * One result line (section 10.3, 17.4): `join.who.joined(name)`, `join.who.already(name)`, or the cap line
 * (`caregiver.join.errors.familyFull(cap)`, SA) after the name in the colon form (`join.who.refused`); a learner the
 * device could not join reads its own shipped line the same way. Calm, never an error word.
 */
export function resultLine(result: BatchResult, m: CaregiverCopy): string {
  if (result.kind === 'refused') return m.join.who.refused(result.name, joinErrorMessage(result.error, m, result.cap));
  if (result.kind === 'skipped') return m.join.who.refused(result.name, joinErrorMessage(result.error, m));
  return result.kind === 'joined' ? m.join.who.joined(result.name) : m.join.who.already(result.name);
}

export function resultLines(results: readonly BatchResult[], m: CaregiverCopy): string[] {
  return results.map((r) => resultLine(r, m));
}

/** Section 15: each count of `space.join.batch` is a whole number from 0 to 12. */
export const BATCH_COUNT_MAX = 12;
const capped = (n: number): number => Math.max(0, Math.min(BATCH_COUNT_MAX, Math.floor(n)));

/** `space.join.batch { picked, joined, refused }`: counts only, never a name or a profile id. */
export function batchEvent(picked: number, results: readonly BatchResult[]): { name: 'space.join.batch'; payload: { picked: number; joined: number; refused: number } } {
  return {
    name: 'space.join.batch',
    payload: { picked: capped(picked), joined: capped(batchJoined(results)), refused: capped(results.filter((r) => r.kind === 'refused').length) },
  };
}
