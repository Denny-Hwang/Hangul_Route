import type { StoredTransfer, TransferSlotConsent } from './transfer-types';

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
  const allIn = t.learner.state === 'consented' && (t.source.state === 'consented' || t.source.state === 'not_required') && t.destination.state === 'consented';
  const failed =
    ((t.status === 'approved' || t.status === 'executed') && !allIn) ||
    (t.status === 'executed' && t.executedAt === null) ||
    ((t.status === 'declined' || t.status === 'cancelled' || t.status === 'expired') && (t.endReason === null || t.endedAt === null)) ||
    (t.learner.state === 'consented' && (t.learner.at === null || t.learner.basis === null || t.learner.textVersion === null || t.learner.locale === null || t.learner.evidence === null));
  if (failed) throw new Error(`CHECK constraint failed: transfer_requests (${t.id})`);
}

export const isOpenTransfer = (t: Pick<StoredTransfer, 'status'>): boolean => t.status === 'requested' || t.status === 'approved';
