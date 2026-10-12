import type { BillingEvent } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { billingEventFields, newestBillingEvent } from '../billing-rules';

const row: BillingEvent = {
  id: 'bev:a',
  subjectKind: 'space',
  subjectId: 'space:c',
  planKey: 'group_license',
  kind: 'purchase',
  amountCents: 15300,
  currency: 'usd',
  provider: 'stripe',
  providerRef: 'in_1',
  paymentRef: null,
  livemode: false,
  occurredAt: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:01.000Z',
};

/** The shared billing_events rules (F-BILL-002 section 5.5); the Db contract covers them on both backends. */
describe('billing-rules', () => {
  it('newestBillingEvent is a consistent comparator: occurredAt, then createdAt, then id, and 0 for the same row', () => {
    expect(newestBillingEvent(row, row)).toBe(0);
    expect(newestBillingEvent(row, { ...row, occurredAt: '2026-10-02T00:00:00.000Z' })).toBe(1);
    expect(newestBillingEvent(row, { ...row, createdAt: '2026-10-01T00:00:00.000Z' })).toBe(-1);
    expect(newestBillingEvent(row, { ...row, id: 'bev:b' })).toBe(1);
  });

  it('billingEventFields names every refused field in one message', () => {
    const { id: _id, createdAt: _createdAt, ...input } = row;
    expect(billingEventFields(input)).toEqual(input);
    expect(() => billingEventFields({ ...input, amountCents: -1, currency: 'USD' })).toThrow(/^recordBillingEvent: amountCents: .+; currency: .+/);
  });
});
