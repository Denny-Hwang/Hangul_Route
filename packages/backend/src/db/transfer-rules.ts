import { TRANSFER_COOLING_OFF_MS, type TransferSlot } from '@hangul-route/content-schema';
import { ENDED_TRANSFER_STATUSES, OPEN_TRANSFER_STATUSES, type StoredTransfer, type TransferPrefKey, type TransferSlotConsent } from './transfer-types';

/*
 * Rules both Db backends share for the class-transfer rows (F-SPACE-002
 * section 4.1 / 4.7). The SQL backend gets the same answers from the CHECKs
 * of migration 0005 and the WHERE clauses of its statements; `MemoryDb` calls
 * these so its observable behaviour is the same.
 */

/** Which teacher slots a consent names. Refuses an empty, repeated or unknown slot list. */
export function teacherSlotsOf(consent: Extract<TransferSlotConsent, { kind: 'teacher' }>): { source: boolean; destination: boolean } {
  const slots = consent.slots;
  const source = slots.includes('source');
  const destination = slots.includes('destination');
  if (slots.length === 0 || new Set(slots).size !== slots.length || slots.length !== Number(source) + Number(destination)) {
    throw new Error('consentSlot: name each teacher slot once (source, destination, or both)');
  }
  return { source, destination };
}

/**
 * The CHECK constraints of `transfer_requests`, in JS. Throws the way SQLite
 * does ("CHECK constraint failed") so a test sees the same failure on both
 * backends.
 */
export function assertTransferChecks(t: StoredTransfer): void {
  const failed =
    t.sourceSpaceId === t.destSpaceId ||
    ((t.status === 'approved' || t.status === 'executed') && !allSlotsIn(t)) ||
    (t.status === 'executed' && t.executedAt === null) ||
    (isEndedTransfer(t) && (t.endReason === null || t.endedAt === null)) ||
    (t.learner.state === 'consented' && (t.learner.at === null || t.learner.basis === null || t.learner.textVersion === null || t.learner.locale === null || t.learner.evidence === null));
  if (failed) throw new Error(`CHECK constraint failed: transfer_requests (${t.id})`);
}

/** True for the one form every Db-side `now` takes (`Date.toISOString()`); the SQL compares these as text. */
const isCanonicalIso = (value: string): boolean => {
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value;
};

const teacherSlotIsEmpty = (slot: StoredTransfer['source']): boolean => slot.at === null && slot.accountId === null && slot.via === null;
const teacherSlotIsFilled = (slot: StoredTransfer['source']): boolean => slot.at !== null && slot.accountId !== null && slot.via !== null;
const learnerSlotIsEmpty = (slot: StoredTransfer['learner']): boolean =>
  slot.at === null && slot.basis === null && slot.attest === null && slot.evidence === null && slot.role === null && slot.textVersion === null && slot.locale === null && slot.shown === null && slot.terms === null;

/**
 * A new request is always inserted as `requested`, with the starting slots of
 * the initiator table (section 4.1) and nothing of a later state; every later
 * state is reached through the CAS methods, so a caller cannot skip a consent
 * (a pre-filled destination slot) or the promote step by what it inserts.
 *
 * | initiator      | learner   | source  | destination |
 * | `learner_side` | consented | pending | pending     |
 * | `source`       | pending   | consented | pending   |
 *
 * `executeAfter` is the learner consent + 48 h when the learner slot is in,
 * null otherwise. Every timestamp is canonical ISO (`toISOString()`), because
 * expiry, cooling-off and retention compare them as text.
 */
export function assertNewTransfer(t: StoredTransfer): void {
  const refuse = (why: string): never => {
    throw new Error(`createTransfer: ${why} (${t.id})`);
  };
  if (t.status !== 'requested') refuse(`a new request must be 'requested', not '${t.status}'`);
  const stamps = [t.createdAt, t.updatedAt, t.expiresAt, t.learner.at, t.source.at, t.destination.at, t.executeAfter].filter((v): v is string => v !== null);
  if (!stamps.every(isCanonicalIso)) refuse('every timestamp must be canonical ISO (toISOString)');
  const learnerSide = t.initiator === 'learner_side';
  const slotsMatch =
    t.destination.state === 'pending' &&
    teacherSlotIsEmpty(t.destination) &&
    (learnerSide
      ? t.learner.state === 'consented' && t.source.state === 'pending' && teacherSlotIsEmpty(t.source)
      : t.learner.state === 'pending' && learnerSlotIsEmpty(t.learner) && t.source.state === 'consented' && teacherSlotIsFilled(t.source));
  if (!slotsMatch) refuse(`the starting slots do not match the initiator table for '${t.initiator}'`);
  const executeAfter = t.learner.state === 'consented' && t.learner.at !== null ? new Date(Date.parse(t.learner.at) + TRANSFER_COOLING_OFF_MS).toISOString() : null;
  if (t.executeAfter !== executeAfter) refuse('execute_after must be the learner consent + 48 h, and null while the learner slot is pending');
  const fresh = t.rev === 0 && t.approvedAt === null && t.executedAt === null && t.endedAt === null && t.endReason === null && t.endActor === null && t.blockReason === null;
  if (!fresh) refuse('a new request carries no approval, execution, end or block fields, and rev 0');
}

/** The slot a decline names, refused when it is not one of the three (the column maps never see caller text). */
export function assertTransferSlot(slot: string): asserts slot is TransferSlot {
  if (slot !== 'learner' && slot !== 'source' && slot !== 'destination') throw new Error(`declineSlot: unknown slot '${slot}'`);
}

/** The switch a prefs write names, refused when it is not one of the two. */
export function assertTransferPrefKey(which: string): asserts which is TransferPrefKey {
  if (which !== 'selfManaged' && which !== 'blockTeacherRequests') throw new Error(`setTransferPref: unknown switch '${which}'`);
}

/** `requested` or `approved`: the request can still change. */
export const isOpenTransfer = (t: Pick<StoredTransfer, 'status'>): boolean => (OPEN_TRANSFER_STATUSES as readonly string[]).includes(t.status);
/** `declined`, `cancelled` or `expired`: ended without a move. */
export const isEndedTransfer = (t: Pick<StoredTransfer, 'status'>): boolean => (ENDED_TRANSFER_STATUSES as readonly string[]).includes(t.status);
/** Every slot is in: learner and destination consented, source consented or not required. */
export const allSlotsIn = (t: Pick<StoredTransfer, 'learner' | 'source' | 'destination'>): boolean =>
  t.learner.state === 'consented' && (t.source.state === 'consented' || t.source.state === 'not_required') && t.destination.state === 'consented';
/** An unlimited cap (`Number.POSITIVE_INFINITY`, a Pro class) as the finite number SQL compares against. */
export const finiteCap = (cap: number): number => (Number.isFinite(cap) ? cap : 1e9);
