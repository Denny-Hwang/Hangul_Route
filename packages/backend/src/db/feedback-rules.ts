import type { NewNote, StoredNote } from './feedback-types';

/*
 * Rules shared by both `Db` backends for the notes tables (F-FEEDBACK-001
 * section 7.4, migration 0008). The memory backend mirrors the table CHECKs
 * here so a bad row fails in tests exactly as it would on D1.
 */

/** The one sender of a send; null for an empty send. A send never mixes accounts (the hold re-check names one). */
export function assertOneSender(rows: readonly NewNote[]): string | null {
  const first = rows[0];
  if (!first) return null;
  if (rows.some((r) => r.senderAccountId !== first.senderAccountId)) throw new Error('insertNotes: a send has exactly one sender');
  return first.senderAccountId;
}

/**
 * The smallest string greater than every string that starts with `prefix`, for a range
 * delete (`key >= prefix AND key < bound`) that uses the key index and no wildcard.
 * `prefix` ends in an ASCII character below U+FFFF (every key prefix here ends in ':').
 */
export function prefixUpperBound(prefix: string): string {
  const last = prefix.charCodeAt(prefix.length - 1);
  return prefix.slice(0, -1) + String.fromCharCode(last + 1);
}

const SENDER_ROLES = new Set(['teacher', 'family']);
const BATCH_KINDS = new Set(['everyone', 'learners']);
const STATUSES = new Set(['live', 'hidden', 'reported', 'withdrawn']);
const VIAS = new Set(['family', 'device']);

/** The CHECK constraints of `feedback_notes` (migration 0008). */
export function assertNoteChecks(n: StoredNote): void {
  const ok =
    SENDER_ROLES.has(n.senderRole) &&
    BATCH_KINDS.has(n.batchKind) &&
    STATUSES.has(n.status) &&
    (n.hiddenVia === null || VIAS.has(n.hiddenVia)) &&
    (n.suggest === null || n.suggest.kind === 'quest') &&
    (n.senderRole === 'family' || n.senderLabel === null) &&
    (n.status !== 'hidden' || (n.hiddenAt !== null && n.hiddenVia !== null)) &&
    (n.status !== 'withdrawn' || n.withdrawnAt !== null);
  if (!ok) throw new Error('CHECK constraint failed: feedback_notes');
}
