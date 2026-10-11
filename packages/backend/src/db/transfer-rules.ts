import type { TransferSlot } from '@hangul-route/content-schema';
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

/**
 * A new request is always inserted as `requested`; every later state is
 * reached through the CAS methods, so a caller cannot skip the consent and
 * promote steps by inserting an `approved` (or ended) row.
 */
export function assertNewTransfer(t: Pick<StoredTransfer, 'id' | 'status'>): void {
  if (t.status !== 'requested') throw new Error(`createTransfer: a new request must be 'requested' (${t.id} is '${t.status}')`);
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
