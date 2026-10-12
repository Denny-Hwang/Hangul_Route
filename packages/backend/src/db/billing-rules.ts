import { BillingEventSchema, type BillingEvent, type BillingEventKind } from '@hangul-route/content-schema';
import { isCanonicalIso } from './transfer-rules';
import type { BillingEventInput } from './types';

/*
 * Rules both Db backends share for `billing_events` (F-BILL-002 sections 5.1,
 * 5.4 and 5.5). The SQL backend gets the column checks from the CHECKs of
 * migration 0007 as well; both backends call these first, so a row the merged
 * `BillingEventSchema` would refuse is refused the same way on both, and a
 * test against `MemoryDb` sees what production would.
 */

const BillingEventInputSchema = BillingEventSchema.omit({ id: true, createdAt: true });

/**
 * The fields `recordBillingEvent` stores for `input`. An empty `paymentRef`
 * means "unknown" and is stored as null, so it neither blocks a later fill nor
 * matches a lookup. Anything else the schema refuses (a negative or fractional
 * amount, an unknown kind, plan, provider or subject kind, a currency that is
 * not three lower-case letters, an empty subject or ref) throws, and so does an
 * `occurredAt` that is not canonical ISO, because the reads sort by it as text.
 * Unknown keys are dropped, so a wider runtime object stores nothing extra.
 */
export function billingEventFields(input: BillingEventInput): BillingEventInput {
  const parsed = BillingEventInputSchema.safeParse({ ...input, paymentRef: input.paymentRef === '' ? null : input.paymentRef });
  if (!parsed.success) {
    throw new Error(`recordBillingEvent: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  if (!isCanonicalIso(parsed.data.occurredAt)) throw new Error('recordBillingEvent: occurredAt must be canonical ISO (toISOString)');
  return parsed.data;
}

/** `LIMIT ?` means the same on both backends: a non-negative integer, nothing else (SQLite reads -1 as "no limit"). */
export function assertBillingLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error(`billingEventsFor: limit must be a non-negative integer, not ${String(limit)}`);
}

/** The rows a refund can belong to (section 5.4): what `billingEventByPaymentRef` answers. */
export const REFUNDABLE_BILLING_KINDS: readonly BillingEventKind[] = ['purchase', 'renewal'];

/** `ORDER BY occurred_at DESC, created_at DESC, id DESC`: on an equal Stripe second, the later recorded row is newer. */
export function newestBillingEvent(a: BillingEvent, b: BillingEvent): number {
  for (const key of ['occurredAt', 'createdAt', 'id'] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? 1 : -1;
  }
  return 0;
}
