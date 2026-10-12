import { describe, expect, it } from 'vitest';
import {
  APP_ROUTES,
  BILLING_RECEIPTS_PATH,
  BillingAccountCardSchema,
  BillingEventKindSchema,
  BillingEventSchema,
  BillingSpaceCardSchema,
  BillingSummarySchema,
  CHECKOUT_POLL_MAX,
  CHECKOUT_POLL_MS,
  CoverageSchema,
  RECEIPTS_CARD_LIMIT,
  RECEIPTS_PAGE_LIMIT,
  ReadOnlyReasonSchema,
  ReceiptViewSchema,
  STEP_UP_MAX_AGE_MIN,
  StripeModeSchema,
  UsageSchema,
  parseBillingSummary,
} from '../index';

/** F-BILL-002 §5.2 — billing summary, receipts and webhook history schemas. */

const event = {
  id: 'bev:abc-123',
  subjectKind: 'space',
  subjectId: 'space:fam',
  planKey: 'family_lifetime',
  kind: 'purchase',
  amountCents: 1530,
  currency: 'usd',
  provider: 'stripe',
  providerRef: 'pi_123',
  paymentRef: null,
  livemode: false,
  occurredAt: '2026-10-11T00:00:00.000Z',
  createdAt: '2026-10-11T00:00:01.000Z',
};

const receipt = {
  id: 'bev:abc-123',
  kind: 'purchase',
  planKey: 'family_lifetime',
  amountCents: 1530,
  currency: 'usd',
  livemode: false,
  occurredAt: '2026-10-11T00:00:00.000Z',
  hasReceipt: true,
};

const card = {
  spaceId: 'space:fam',
  kind: 'family',
  name: 'Kim family',
  role: 'owner',
  archived: false,
  payer: true,
  readOnlyReason: null,
  coverage: { state: 'free' },
  usage: { learners: 2, learnerCap: 5, teachers: null, teacherCap: null },
  actions: { buy: 'family_lifetime', manage: false, contact: false },
  receipts: [receipt],
  hasReceipts: true,
  legacyNoHistory: false,
};

describe('billing constants (F-BILL-002 §5.2)', () => {
  it('builds the receipts path from APP_ROUTES.billing and pins the numbers', () => {
    expect(BILLING_RECEIPTS_PATH).toBe(`${APP_ROUTES.billing}/receipts`);
    expect(BILLING_RECEIPTS_PATH).toBe('/account/billing/receipts');
    expect(STEP_UP_MAX_AGE_MIN).toBe(10);
    expect(RECEIPTS_PAGE_LIMIT).toBe(50);
    expect(RECEIPTS_CARD_LIMIT).toBe(3);
    expect(CHECKOUT_POLL_MS).toBe(2000);
    expect(CHECKOUT_POLL_MAX).toBe(10);
  });
});

describe('BillingEventSchema', () => {
  it('accepts a webhook history row and every event kind', () => {
    expect(BillingEventSchema.parse(event)).toEqual(event);
    expect(BillingEventKindSchema.options).toEqual(['purchase', 'renewal', 'refund', 'failed']);
    for (const kind of BillingEventKindSchema.options) {
      expect(BillingEventSchema.safeParse({ ...event, kind }).success).toBe(true);
    }
    expect(BillingEventSchema.parse({ ...event, paymentRef: 'pi_9', subjectKind: 'account', subjectId: 'acct_1' }).paymentRef).toBe('pi_9');
  });

  it('rejects bad ids, currencies, amounts, kinds, plans and providers', () => {
    expect(BillingEventSchema.safeParse({ ...event, id: 'ent:abc' }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, id: 'bev:ABC' }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, currency: 'USD' }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, currency: 'us' }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, currency: 'usdx' }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, amountCents: -1 }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, amountCents: 1.5 }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, kind: 'chargeback' }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, planKey: 'teacher_pro' }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, provider: 'paypal' }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, providerRef: '' }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, subjectId: '' }).success).toBe(false);
    expect(BillingEventSchema.safeParse({ ...event, livemode: 0 }).success).toBe(false);
    // null is the documented "unknown"; an empty ref would never match a refund lookup.
    expect(BillingEventSchema.safeParse({ ...event, paymentRef: '' }).success).toBe(false);
  });
});

describe('ReceiptViewSchema', () => {
  it('carries no Stripe id and no URL', () => {
    const parsed = ReceiptViewSchema.parse({ ...receipt, providerRef: 'pi_123', paymentRef: 'pi_123', url: 'https://pay.stripe.com/receipts/x', receiptUrl: 'https://x' });
    expect(parsed).toEqual(receipt);
    expect(Object.keys(ReceiptViewSchema.shape).sort()).toEqual(['amountCents', 'currency', 'hasReceipt', 'id', 'kind', 'livemode', 'occurredAt', 'planKey']);
    expect(ReceiptViewSchema.safeParse({ ...receipt, id: 'pi_123' }).success).toBe(false);
    expect(ReceiptViewSchema.safeParse({ ...receipt, hasReceipt: undefined }).success).toBe(false);
  });
});

describe('StripeModeSchema and ReadOnlyReasonSchema', () => {
  it('lists the modes and the viewer reasons', () => {
    expect(StripeModeSchema.options).toEqual(['test', 'live', 'none']);
    expect(StripeModeSchema.safeParse('sandbox').success).toBe(false);
    expect(ReadOnlyReasonSchema.options).toEqual(['family', 'class', 'school']);
    expect(ReadOnlyReasonSchema.safeParse('account').success).toBe(false);
  });
});

describe('CoverageSchema', () => {
  it('parses free, own (with endsAtPeriodEnd) and school coverage', () => {
    expect(CoverageSchema.parse({ state: 'free' })).toEqual({ state: 'free' });
    const own = { state: 'own', planKey: 'group_license', status: 'cancelled', expiresAt: '2027-10-11T00:00:00.000Z', statusSince: '2026-10-11T00:00:00.000Z', endsAtPeriodEnd: true };
    expect(CoverageSchema.parse(own)).toEqual(own);
    expect(CoverageSchema.parse({ ...own, planKey: 'family_lifetime', status: 'active', expiresAt: null, endsAtPeriodEnd: false })).toMatchObject({ expiresAt: null, endsAtPeriodEnd: false });
    const school = { state: 'school', schoolName: 'Hanbit School', planKey: 'school_seat', expiresAt: null };
    expect(CoverageSchema.parse(school)).toEqual(school);
  });

  it('rejects an unknown state and missing or wrong fields', () => {
    expect(CoverageSchema.safeParse({ state: 'trial' }).success).toBe(false);
    const own = { state: 'own', planKey: 'group_license', status: 'active', expiresAt: null, statusSince: '2026-10-11T00:00:00.000Z' };
    expect(CoverageSchema.safeParse(own).success).toBe(false);
    expect(CoverageSchema.safeParse({ ...own, endsAtPeriodEnd: false, status: 'paused' }).success).toBe(false);
    expect(CoverageSchema.safeParse({ state: 'school', schoolName: 'S', planKey: 'family_lifetime', expiresAt: null }).success).toBe(false);
    expect(CoverageSchema.safeParse({ state: 'school', planKey: 'group_license', expiresAt: null }).success).toBe(false);
  });
});

describe('UsageSchema', () => {
  it('allows unlimited caps as null and refuses negatives or fractions', () => {
    expect(UsageSchema.parse({ learners: 0, learnerCap: null, teachers: 3, teacherCap: 10 })).toEqual({ learners: 0, learnerCap: null, teachers: 3, teacherCap: 10 });
    expect(UsageSchema.safeParse({ learners: -1, learnerCap: null, teachers: null, teacherCap: null }).success).toBe(false);
    expect(UsageSchema.safeParse({ learners: 1.5, learnerCap: null, teachers: null, teacherCap: null }).success).toBe(false);
    expect(UsageSchema.safeParse({ learners: 1, learnerCap: 2.5, teachers: null, teacherCap: null }).success).toBe(false);
  });
});

describe('BillingSpaceCardSchema', () => {
  it('parses a payer card and a read-only viewer card', () => {
    expect(BillingSpaceCardSchema.parse(card)).toEqual(card);
    const viewer = {
      ...card,
      role: 'caregiver',
      payer: false,
      readOnlyReason: 'family',
      actions: { buy: null, manage: false, contact: false },
      receipts: [],
      hasReceipts: false,
    };
    expect(BillingSpaceCardSchema.parse(viewer)).toMatchObject({ payer: false, readOnlyReason: 'family', receipts: [] });
  });

  it('keeps at most three inline receipts and only purchasable plans in buy', () => {
    expect(BillingSpaceCardSchema.safeParse({ ...card, receipts: [receipt, receipt, receipt] }).success).toBe(true);
    expect(BillingSpaceCardSchema.safeParse({ ...card, receipts: [receipt, receipt, receipt, receipt] }).success).toBe(false);
    expect(BillingSpaceCardSchema.safeParse({ ...card, actions: { buy: 'school_seat', manage: false, contact: true } }).success).toBe(false);
    expect(BillingSpaceCardSchema.safeParse({ ...card, spaceId: 'fam' }).success).toBe(false);
    // Cards exist only where the account is owner, caregiver, teacher or admin (§5.3).
    for (const role of ['owner', 'caregiver', 'teacher', 'admin']) {
      expect(BillingSpaceCardSchema.safeParse({ ...card, role }).success).toBe(true);
    }
    expect(BillingSpaceCardSchema.safeParse({ ...card, role: 'student' }).success).toBe(false);
    expect(BillingSpaceCardSchema.safeParse({ ...card, role: 'guest' }).success).toBe(false);
    expect(BillingSpaceCardSchema.safeParse({ ...card, readOnlyReason: 'account' }).success).toBe(false);
  });
  it('carries no usage line for a school seen by a teacher member (seat counts are for payers only)', () => {
    const schoolViewer = {
      ...card,
      spaceId: 'space:school',
      kind: 'school',
      name: 'Hanbit School',
      role: 'teacher',
      payer: false,
      readOnlyReason: 'school',
      coverage: { state: 'school', schoolName: 'Hanbit School', planKey: 'group_license', expiresAt: '2027-10-11T00:00:00.000Z' },
      usage: null,
      actions: { buy: null, manage: false, contact: false },
      receipts: [],
      hasReceipts: false,
    };
    expect(BillingSpaceCardSchema.parse(schoolViewer)).toMatchObject({ usage: null, readOnlyReason: 'school' });
    expect(BillingSpaceCardSchema.safeParse({ ...schoolViewer, usage: undefined }).success).toBe(false);
  });
});

describe('BillingAccountCardSchema', () => {
  const accountCard = {
    coverage: { state: 'own', planKey: 'group_license', status: 'active', expiresAt: '2027-10-11T00:00:00.000Z', statusSince: '2026-10-11T00:00:00.000Z', endsAtPeriodEnd: false },
    actions: { manage: true },
    receipts: [receipt],
    legacyNoHistory: false,
  };

  it('parses a legacy account card with a manage action and inline receipts only', () => {
    expect(BillingAccountCardSchema.parse(accountCard)).toEqual(accountCard);
    // No All receipts link: the receipts page takes a space id, so the account card has no `hasReceipts`.
    expect(Object.keys(BillingAccountCardSchema.shape).sort()).toEqual(['actions', 'coverage', 'legacyNoHistory', 'receipts']);
    expect(BillingAccountCardSchema.parse({ ...accountCard, hasReceipts: true })).not.toHaveProperty('hasReceipts');
  });

  it('rejects a missing coverage or action, more than three receipts and wrong types', () => {
    const { coverage: _coverage, ...noCoverage } = accountCard;
    expect(BillingAccountCardSchema.safeParse(noCoverage).success).toBe(false);
    const { actions: _actions, ...noActions } = accountCard;
    expect(BillingAccountCardSchema.safeParse(noActions).success).toBe(false);
    expect(BillingAccountCardSchema.safeParse({ ...accountCard, receipts: [receipt, receipt, receipt, receipt] }).success).toBe(false);
    expect(BillingAccountCardSchema.safeParse({ ...accountCard, actions: { manage: 'yes' } }).success).toBe(false);
    expect(BillingAccountCardSchema.safeParse({ ...accountCard, legacyNoHistory: 1 }).success).toBe(false);
    expect(BillingAccountCardSchema.safeParse({ ...accountCard, coverage: { state: 'trial' } }).success).toBe(false);
  });
});

describe('BillingSummarySchema', () => {
  const account = {
    coverage: { state: 'own', planKey: 'group_license', status: 'active', expiresAt: null, statusSince: '2026-10-11T00:00:00.000Z', endsAtPeriodEnd: false },
    actions: { manage: true },
    receipts: [],
    legacyNoHistory: true,
  };

  it('parses a summary with space and account cards', () => {
    const summary = { mode: 'test', purchasesOpen: true, cards: [card], account: [account] };
    expect(BillingSummarySchema.parse(summary)).toEqual(summary);
    expect(BillingAccountCardSchema.parse(account)).toEqual(account);
    expect(BillingSummarySchema.parse({ mode: 'none', purchasesOpen: false, cards: [], account: [] }).cards).toEqual([]);
  });

  it('parses leniently: unknown keys from a newer Worker are stripped', () => {
    const newer = {
      mode: 'live',
      purchasesOpen: false,
      futureFlag: true,
      cards: [{ ...card, joinCode: 'ABCDEF', customerRef: 'cus_1', receipts: [{ ...receipt, url: 'https://x' }] }],
      account: [{ ...account, extra: 1 }],
    };
    const result = BillingSummarySchema.safeParse(newer);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toHaveProperty('futureFlag');
    expect(result.data.cards[0]).not.toHaveProperty('joinCode');
    expect(result.data.cards[0]).not.toHaveProperty('customerRef');
    expect(result.data.cards[0]?.receipts[0]).not.toHaveProperty('url');
    expect(result.data.account[0]).not.toHaveProperty('extra');
  });

  it('is the strict Worker contract: an unknown mode, a missing card list or a fourth inline receipt fails', () => {
    expect(BillingSummarySchema.safeParse({ mode: 'prod', purchasesOpen: true, cards: [], account: [] }).success).toBe(false);
    expect(BillingSummarySchema.safeParse({ mode: 'test', purchasesOpen: true, account: [] }).success).toBe(false);
    expect(BillingSummarySchema.safeParse({ mode: 'test', purchasesOpen: true, cards: [{ ...card, receipts: [receipt, receipt, receipt, receipt] }], account: [] }).success).toBe(false);
  });
});

describe('parseBillingSummary (the page side: a newer Worker never blanks an older page)', () => {
  const account = {
    coverage: { state: 'own', planKey: 'group_license', status: 'active', expiresAt: null, statusSince: '2026-10-11T00:00:00.000Z', endsAtPeriodEnd: false },
    actions: { manage: true },
    receipts: [],
    legacyNoHistory: true,
  };
  const summary = { mode: 'test', purchasesOpen: true, cards: [card], account: [account] };

  it('returns a valid summary as is and strips unknown keys', () => {
    expect(parseBillingSummary(summary)).toEqual(summary);
    expect(parseBillingSummary({ ...summary, futureFlag: true, cards: [{ ...card, joinCode: 'ABCDEF' }] })).toEqual(summary);
  });

  it('drops only the card a newer value breaks; its siblings survive', () => {
    const school = { ...card, spaceId: 'space:school', kind: 'school', name: 'Hanbit School' };
    const parsed = parseBillingSummary({
      ...summary,
      cards: [card, { ...school, coverage: { state: 'trial' } }, { ...school, spaceId: 'space:new-reason', readOnlyReason: 'contract' }, 'not a card'],
      account: [{ ...account, coverage: { state: 'gift' } }, account],
    });
    expect(parsed?.cards).toEqual([card]);
    expect(parsed?.account).toEqual([account]);
  });

  it('drops an unreadable receipt row and keeps at most three inline rows', () => {
    const rows = ['bev:a', 'bev:b', 'bev:c', 'bev:d', 'bev:e'].map((id) => ({ ...receipt, id }));
    const parsed = parseBillingSummary({
      ...summary,
      cards: [{ ...card, receipts: [{ ...receipt, id: 'bev:dispute', kind: 'dispute' }, ...rows] }],
      account: [{ ...account, receipts: rows }],
    });
    expect(parsed?.cards[0]?.receipts.map((r) => r.id)).toEqual(['bev:a', 'bev:b', 'bev:c']);
    expect(parsed?.account[0]?.receipts).toHaveLength(RECEIPTS_CARD_LIMIT);
  });

  it('reads an unknown mode as none, which turns every buy and manage button off', () => {
    expect(parseBillingSummary({ ...summary, mode: 'restricted' })?.mode).toBe('none');
  });

  it('answers null when the summary itself is unreadable', () => {
    expect(parseBillingSummary(null)).toBeNull();
    expect(parseBillingSummary('summary')).toBeNull();
    expect(parseBillingSummary({ mode: 'test', purchasesOpen: true, account: [] })).toBeNull();
    expect(parseBillingSummary({ ...summary, purchasesOpen: 'yes' })).toBeNull();
    expect(parseBillingSummary({ ...summary, cards: {} })).toBeNull();
  });
});
