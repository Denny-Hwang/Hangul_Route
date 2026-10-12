import { NOTE_SEND_MAX_LEARNERS } from '@hangul-route/content-schema';
import { noteRateKey } from '../db';

/**
 * Note limits — F-FEEDBACK-001 section 7.3 (OD-14). Durable counters in
 * `rate_hits` (keys `noteRateKey`), counted over the rolling 24 hours the
 * transfer limits use, and read with one set-based query per send
 * (`countRateHitsByKeys`), never one query per learner. Pure: the route reads
 * the counts, this decides.
 */

/** Notes from one account to one learner per day: that learner is skipped with `limit`. */
export const NOTE_LIMIT_PAIR_PER_DAY = 3;
/** Notes to one learner from all senders per day: skipped with `limit`. */
export const NOTE_LIMIT_LEARNER_PER_DAY = 10;
/** Notes from one account per day, all learners: `429 too_many { scope: 'account' }`, nothing sent. */
export const NOTE_LIMIT_ACCOUNT_PER_DAY = 400;
/** Learners in one send (the schema refuses more). */
export const NOTE_LIMIT_LEARNERS_PER_SEND = NOTE_SEND_MAX_LEARNERS;
/** Sends (batches) from one account per minute, per isolate (`lib/rate-limit.ts`). */
export const NOTE_LIMIT_SENDS_PER_MINUTE = 10;
/** The window every daily limit counts over. */
export const NOTE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Every counter key one send reads: the account, and per learner the pair and the learner. */
export function sendCounterKeys(accountId: string, learnerIds: readonly string[]): string[] {
  return [noteRateKey.account(accountId), ...learnerIds.flatMap((learnerId) => [noteRateKey.pair(learnerId, accountId), noteRateKey.learner(learnerId)])];
}

/** The learners over a per-learner daily limit (pair or learner), given the counts of `sendCounterKeys`. */
export function learnersOverLimit(accountId: string, learnerIds: readonly string[], counts: ReadonlyMap<string, number>): Set<string> {
  const over = new Set<string>();
  for (const learnerId of learnerIds) {
    const pair = counts.get(noteRateKey.pair(learnerId, accountId)) ?? 0;
    const all = counts.get(noteRateKey.learner(learnerId)) ?? 0;
    if (pair >= NOTE_LIMIT_PAIR_PER_DAY || all >= NOTE_LIMIT_LEARNER_PER_DAY) over.add(learnerId);
  }
  return over;
}

/** Whether sending `count` more notes would take the account past its daily limit. */
export function accountOverLimit(accountId: string, count: number, counts: ReadonlyMap<string, number>): boolean {
  return (counts.get(noteRateKey.account(accountId)) ?? 0) + count > NOTE_LIMIT_ACCOUNT_PER_DAY;
}

/** The counter hits a send writes: one per note on the account, the pair and the learner keys. */
export function sendCounterHits(accountId: string, learnerIds: readonly string[], at: string): Array<{ key: string; at: string }> {
  return learnerIds.flatMap((learnerId) => [noteRateKey.account(accountId), noteRateKey.pair(learnerId, accountId), noteRateKey.learner(learnerId)].map((key) => ({ key, at })));
}
