import { APP_ROUTES, BILLING_RECEIPTS_PATH, FAMILY_LIFETIME_LEARNERS, FREE_CLASS_STUDENT_CAP, SCHOOL_LICENSE_STUDENTS, SCHOOL_LICENSE_TEACHERS, type BillingAccountCard, type BillingSpaceCard, type BillingSummary, type Promo, type ReceiptView } from '@hangul-route/content-schema';
import { formatDate, formatMinorAmount, getMessages, UI_LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL } from '../../../data/contact';
import { SITE_CLAIMS, type SiteClaims } from '../../../data/site-claims';
import { actionNoteFor, actionNoteText, billingHomeView, modeBanner, contactHref, includesLines, receiptRow, summaryFailureNotice, type BillingActionNote, type BillingHomeView } from '../billing-summary';
import { planPrice, promoPriceLine } from '../billing';

/**
 * F-BILL-002 B-7: the billing home view model (wireframe billing/billing-home,
 * spec sections 4.2, 4.3, 4.6, 4.9, 4.10). Words come from the dictionary.
 */
const now = new Date('2026-10-12T12:00:00.000Z');
const w = getMessages('en').console;
const b = w.billing;
const day = (iso: string) => formatDate('en', iso, 'monthDayYear', { utc: true });
const YEAR_ON = '2027-10-12T00:00:00.000Z';

const receipt = (over: Partial<ReceiptView> = {}): ReceiptView => ({ id: 'bev:r1', kind: 'purchase', planKey: 'family_lifetime', amountCents: 1530, currency: 'usd', livemode: false, occurredAt: '2026-10-01T09:00:00.000Z', hasReceipt: true, ...over });

const card = (over: Partial<BillingSpaceCard> = {}): BillingSpaceCard => ({
  spaceId: 'space:fam',
  kind: 'family',
  name: 'Kim family',
  role: 'owner',
  archived: false,
  payer: true,
  readOnlyReason: null,
  coverage: { state: 'free' },
  usage: { learners: 2, learnerCap: FAMILY_LIFETIME_LEARNERS, teachers: null, teacherCap: null },
  actions: { buy: 'family_lifetime', manage: false, contact: false },
  receipts: [],
  hasReceipts: false,
  legacyNoHistory: false,
  ...over,
});
const own = (over: Partial<Extract<BillingSpaceCard['coverage'], { state: 'own' }>> = {}): BillingSpaceCard['coverage'] => ({ state: 'own', planKey: 'family_lifetime', status: 'active', expiresAt: YEAR_ON, statusSince: '2026-10-01T00:00:00.000Z', endsAtPeriodEnd: false, ...over });
const summary = (cards: BillingSpaceCard[], over: Partial<BillingSummary> = {}): BillingSummary => ({ mode: 'test', purchasesOpen: true, cards, account: [], ...over });
/** Every feature claim off: the base includes lines. Today's claims (`SITE_CLAIMS`, reports on since F-REPORT-001 RP-11) are tested below. */
const OFF: Readonly<SiteClaims> = { ...SITE_CLAIMS, learningRoute: false, parentReports: false, teacherReports: false, feedbackNotes: false, browseAsLearner: false, lectureMode: false };
const view = (s: BillingSummary, claims: Readonly<SiteClaims> = OFF, promo: Promo | null = null): BillingHomeView => billingHomeView(s, { now, locale: 'en', claims, promo });
const ALL_ON: Readonly<SiteClaims> = { ...SITE_CLAIMS, browseAsLearner: true, parentReports: true, teacherReports: true, feedbackNotes: true };

describe('billingHomeView: the mode banner and whether buttons work (section 4.3 item 2, section 4.9)', () => {
  it('test mode: the test banner, buttons on', () => {
    expect(view(summary([card()]))).toMatchObject({ banner: b.testMode, actionsEnabled: true });
  });

  it('no key bound: not configured, every buy and manage button off', () => {
    expect(view(summary([card()], { mode: 'none', purchasesOpen: false }))).toMatchObject({ banner: b.notConfigured, actionsEnabled: false });
    // Even a summary that claims purchases are open never enables a deployment without a key.
    expect(view(summary([card()], { mode: 'none', purchasesOpen: true }))).toMatchObject({ banner: b.notConfigured, actionsEnabled: false });
  });

  it('live without BILLING_LIVE_ALLOWED: payments not open; live and open: no banner', () => {
    expect(view(summary([card()], { mode: 'live', purchasesOpen: false }))).toMatchObject({ banner: b.liveOff, actionsEnabled: false });
    expect(view(summary([card()], { mode: 'live', purchasesOpen: true }))).toMatchObject({ banner: null, actionsEnabled: true });
    // Test mode always works (section 4.3 item 2): only none, and live while closed, turn buttons off.
    expect(view(summary([card()], { mode: 'test', purchasesOpen: false }))).toMatchObject({ banner: b.testMode, actionsEnabled: true });
  });
});

describe('billingHomeView: one card per persona row of section 4.2', () => {
  it('parent, free family: plan, usage, the offer inside the card, no Add a plan block', () => {
    const v = view(summary([card()]));
    expect(v.addPlan).toBeNull();
    expect(v.cards).toHaveLength(1);
    const c = v.cards[0];
    expect(c).toMatchObject({ spaceId: 'space:fam', heading: `${b.kind.family} · Kim family`, plan: b.coverage.free, status: null, usage: b.usage.learners(2, FAMILY_LIFETIME_LEARNERS), readOnly: null, manage: false, contact: false, connectLearner: null });
    expect(c?.offer).toEqual({
      planKey: 'family_lifetime',
      spaceId: 'space:fam',
      title: b.planTitle.family_lifetime,
      includes: [b.includesLines.family.everyLesson, b.includesLines.family.learners(FAMILY_LIFETIME_LEARNERS), b.includesLines.family.cloudSave],
      price: planPrice('family_lifetime', 'en'),
      renew: w.familyLine,
      cta: b.buy.family_lifetime.cta,
      primary: true,
    });
  });

  it('parent, Family Plan: renews on, manage, receipts (latest 3, no link inline), All receipts', () => {
    const rows = [receipt({ id: 'bev:r3', kind: 'renewal', occurredAt: '2026-10-03T00:00:00.000Z' }), receipt({ id: 'bev:r2', kind: 'refund', amountCents: 500 }), receipt()];
    const c = view(summary([card({ coverage: own(), usage: { learners: 4, learnerCap: 5, teachers: null, teacherCap: null }, actions: { buy: null, manage: true, contact: false }, receipts: rows, hasReceipts: true })])).cards[0];
    expect(c).toMatchObject({ plan: b.coverage.family, status: b.status.renewsOn(day(YEAR_ON)), usage: b.usage.learners(4, 5), manage: true, offer: null, connectLearner: null, pastDue: false });
    expect(c?.receipts.map((r) => r.id)).toEqual(['bev:r3', 'bev:r2', 'bev:r1']);
    expect(c?.allReceiptsHref).toBe(`${BILLING_RECEIPTS_PATH}?id=space%3Afam`);
  });

  it('parent, Family Plan with 0 learners: the connect-a-learner step to the family page', () => {
    const c = view(summary([card({ coverage: own(), usage: { learners: 0, learnerCap: 5, teachers: null, teacherCap: null }, actions: { buy: null, manage: true, contact: false } })])).cards[0];
    expect(c?.connectLearner).toEqual({ line: b.connectLearner.line, cta: b.connectLearner.cta, href: `${APP_ROUTES.parentHome}/space?id=space%3Afam` });
  });

  it('no connect step on a free family, a co-parent card, or a plan that has ended', () => {
    const zero = { learners: 0, learnerCap: 5, teachers: null, teacherCap: null };
    expect(view(summary([card({ usage: zero })])).cards[0]?.connectLearner).toBeNull();
    expect(view(summary([card({ coverage: own(), usage: zero, payer: false, role: 'caregiver', readOnlyReason: 'family', actions: { buy: null, manage: false, contact: false } })])).cards[0]?.connectLearner).toBeNull();
    expect(view(summary([card({ coverage: own({ status: 'expired', expiresAt: '2026-10-01T00:00:00.000Z' }), usage: zero })])).cards[0]?.connectLearner).toBeNull();
  });

  it('co-parent: read-only family line, no amount, no button, no receipts', () => {
    const c = view(summary([card({ role: 'caregiver', payer: false, readOnlyReason: 'family', coverage: own(), actions: { buy: null, manage: false, contact: false } })])).cards[0];
    expect(c).toMatchObject({ plan: b.coverage.family, status: b.status.renewsOn(day(YEAR_ON)), readOnly: b.readOnly.family, manage: false, contact: false, offer: null, receipts: [], allReceiptsHref: null });
  });

  it('a viewer card never shows an offer or a manage button, even if a summary says so', () => {
    const c = view(summary([card({ role: 'caregiver', payer: false, readOnlyReason: 'family', actions: { buy: 'family_lifetime', manage: true, contact: true }, receipts: [receipt()], hasReceipts: true })]));
    expect(c.cards[0]).toMatchObject({ offer: null, manage: false, contact: false, receipts: [], allReceiptsHref: null });
    expect(c.addPlan).toBeNull();
  });

  it('teacher, free stand-alone class: cap usage and the Group License offer', () => {
    const c = view(summary([card({ spaceId: 'space:cls', kind: 'class', name: 'Room 4', usage: { learners: 14, learnerCap: FREE_CLASS_STUDENT_CAP, teachers: null, teacherCap: null }, actions: { buy: 'group_license', manage: false, contact: false } })])).cards[0];
    expect(c).toMatchObject({ heading: `${b.kind.class} · Room 4`, plan: b.coverage.free, usage: b.usage.students(14, FREE_CLASS_STUDENT_CAP) });
    expect(c?.offer).toMatchObject({ planKey: 'group_license', title: b.planTitle.group_license, includes: [b.includesLines.license.everyStudent, b.includesLines.license.noCap(FREE_CLASS_STUDENT_CAP)], renew: w.groupLine, cta: b.buy.group_license.cta, primary: true });
  });

  it('teacher with a license: no cap in the usage line; cancelled reads Ends on, never renews', () => {
    const license = own({ planKey: 'group_license' });
    const base = { spaceId: 'space:cls', kind: 'class' as const, name: 'Room 4', usage: { learners: 23, learnerCap: null, teachers: null, teacherCap: null }, actions: { buy: null, manage: true, contact: false } };
    expect(view(summary([card({ ...base, coverage: license })])).cards[0]).toMatchObject({ plan: b.coverage.license, status: b.status.renewsOn(day(YEAR_ON)), usage: b.usage.students(23, null) });
    expect(view(summary([card({ ...base, coverage: own({ planKey: 'group_license', status: 'cancelled', endsAtPeriodEnd: true }) })])).cards[0]?.status).toBe(b.status.endsOn(day(YEAR_ON)));
    // A cancelled row that still covers (the portal cancel maps to cancelled with the period end).
    expect(view(summary([card({ ...base, coverage: own({ planKey: 'group_license', status: 'cancelled' }) })])).cards[0]?.status).toBe(b.status.endsOn(day(YEAR_ON)));
    // A flag on an active row ends on the date too.
    expect(view(summary([card({ ...base, coverage: own({ planKey: 'group_license', endsAtPeriodEnd: true }) })])).cards[0]?.status).toBe(b.status.endsOn(day(YEAR_ON)));
  });

  it('co-teacher: class read-only line', () => {
    const c = view(summary([card({ spaceId: 'space:cls', kind: 'class', name: 'Room 4', role: 'teacher', payer: false, readOnlyReason: 'class', coverage: own({ planKey: 'group_license' }), usage: { learners: 23, learnerCap: null, teachers: null, teacherCap: null }, actions: { buy: null, manage: false, contact: false } })])).cards[0];
    expect(c).toMatchObject({ readOnly: b.readOnly.class, usage: b.usage.students(23, null), manage: false });
  });

  it('class inside a school and a school teacher member: covered by the school, no seat counts for the member', () => {
    const inSchool = card({ spaceId: 'space:cls', kind: 'class', name: 'Room 4', payer: true, readOnlyReason: 'school', coverage: { state: 'school', schoolName: 'Maple School', planKey: 'group_license', expiresAt: '2027-06-30T00:00:00.000Z' }, usage: { learners: 31, learnerCap: null, teachers: null, teacherCap: null }, actions: { buy: null, manage: false, contact: false } });
    const member = card({ spaceId: 'space:sch', kind: 'school', name: 'Maple School', role: 'teacher', payer: false, readOnlyReason: 'school', coverage: { state: 'school', schoolName: 'Maple School', planKey: 'group_license', expiresAt: null }, usage: null, actions: { buy: null, manage: false, contact: false } });
    const [a, m] = view(summary([inSchool, member])).cards;
    expect(a).toMatchObject({ plan: b.coverage.schoolUntil('Maple School', day('2027-06-30T00:00:00.000Z')), status: null, usage: b.usage.students(31, null), readOnly: b.readOnly.school, offer: null });
    expect(m).toMatchObject({ heading: `${b.kind.school} · Maple School`, plan: b.coverage.school('Maple School'), usage: null, readOnly: b.readOnly.school });
  });

  it('school owner or admin: seats for students and teachers, manage, Contact us', () => {
    const c = view(summary([card({ spaceId: 'space:sch', kind: 'school', name: 'Maple School', role: 'admin', coverage: own({ planKey: 'group_license' }), usage: { learners: 212, learnerCap: SCHOOL_LICENSE_STUDENTS, teachers: 7, teacherCap: SCHOOL_LICENSE_TEACHERS }, actions: { buy: null, manage: true, contact: true } })])).cards[0];
    expect(c).toMatchObject({ usage: `${b.usage.students(212, SCHOOL_LICENSE_STUDENTS)} · ${b.usage.teachers(7, SCHOOL_LICENSE_TEACHERS)}`, manage: true, contact: true });
    expect(contactHref()).toBe(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(b.contact.mailSubject)}`);
  });

  it('a school contract reads School Contract and ends on its date', () => {
    const c = view(summary([card({ spaceId: 'space:sch', kind: 'school', name: 'Maple School', coverage: own({ planKey: 'school_seat' }), usage: { learners: 400, learnerCap: null, teachers: 12, teacherCap: null }, actions: { buy: null, manage: false, contact: true } })])).cards[0];
    expect(c).toMatchObject({ plan: b.coverage.contract, status: b.status.endsOn(day(YEAR_ON)), usage: `${b.usage.students(400, null)} · ${b.usage.teachers(12, null)}` });
    expect(view(summary([card({ kind: 'school', coverage: own({ planKey: 'school_seat', expiresAt: null }), actions: { buy: null, manage: false, contact: true } })])).cards[0]?.status).toBeNull();
  });

  it('archived space with a live license: marked (archived), still manageable, never offered', () => {
    const c = view(summary([card({ spaceId: 'space:cls', kind: 'class', name: 'Room 4', archived: true, coverage: own({ planKey: 'group_license' }), actions: { buy: 'group_license', manage: true, contact: false } })])).cards[0];
    expect(c).toMatchObject({ heading: `${b.kind.class} · Room 4 ${b.archived}`, archived: true, manage: true, offer: null });
  });

  it('a legacy one-time sandbox row: the plan name, no date, nothing to manage', () => {
    const c = view(summary([card({ coverage: own({ expiresAt: null }), actions: { buy: null, manage: false, contact: false }, legacyNoHistory: true })])).cards[0];
    expect(c).toMatchObject({ plan: b.coverage.family, status: null, manage: false, legacyNoHistory: true, allReceiptsHref: null });
  });

  it('past due within the grace week: kept line and the one note above the cards; past the week: paused', () => {
    const due = (since: string) => card({ coverage: own({ status: 'past_due', statusSince: since }), actions: { buy: null, manage: true, contact: false } });
    const kept = view(summary([due('2026-10-10T00:00:00.000Z')]));
    expect(kept.cards[0]).toMatchObject({ status: w.entitlementStatus.pastDueKept, pastDue: true });
    expect(kept.pastDueNote).toBe(b.pastDue);
    const paused = view(summary([due('2026-09-01T00:00:00.000Z')]));
    expect(paused.cards[0]).toMatchObject({ status: w.entitlementStatus.pastDuePaused, pastDue: true });
    // The note promises a week of the full route, so it shows only while the grace runs (section 4.6).
    expect(paused.pastDueNote).toBeNull();
    // A viewer's past-due card raises no note: only the payer can act on it.
    expect(view(summary([card({ payer: false, role: 'caregiver', readOnlyReason: 'family', coverage: own({ status: 'past_due' }), actions: { buy: null, manage: false, contact: false } })])).pastDueNote).toBeNull();
    expect(view(summary([card()])).pastDueNote).toBeNull();
  });

  it('other statuses: a trial renews on its date, an ended row says ended, an expired row without a date says ended', () => {
    expect(view(summary([card({ coverage: own({ status: 'trial' }) })])).cards[0]?.status).toBe(b.status.renewsOn(day(YEAR_ON)));
    expect(view(summary([card({ coverage: own({ status: 'expired', expiresAt: '2026-10-01T00:00:00.000Z' }) })])).cards[0]?.status).toBe(w.entitlementStatus.endedOn(day('2026-10-01T00:00:00.000Z')));
    expect(view(summary([card({ coverage: own({ status: 'cancelled', expiresAt: '2026-10-01T00:00:00.000Z' }) })])).cards[0]?.status).toBe(w.entitlementStatus.endedOn(day('2026-10-01T00:00:00.000Z')));
    expect(view(summary([card({ coverage: own({ status: 'expired', expiresAt: null }) })])).cards[0]?.status).toBe(w.entitlementStatus.ended);
    expect(view(summary([card({ coverage: own({ status: 'active', expiresAt: '2026-10-01T00:00:00.000Z' }) })])).cards[0]?.status).toBe(w.entitlementStatus.endedOn(day('2026-10-01T00:00:00.000Z')));
  });
});

describe('billingHomeView: order and offers', () => {
  const fam = card();
  const cls = card({ spaceId: 'space:cls', kind: 'class', name: 'Room 4', usage: { learners: 3, learnerCap: 20, teachers: null, teacherCap: null }, actions: { buy: 'group_license', manage: false, contact: false } });
  const sch = card({ spaceId: 'space:sch', kind: 'school', name: 'Maple School', usage: { learners: 40, learnerCap: 20, teachers: 2, teacherCap: null }, actions: { buy: 'group_license', manage: false, contact: true } });
  const viewer = card({ spaceId: 'space:other', role: 'caregiver', payer: false, readOnlyReason: 'family', actions: { buy: null, manage: false, contact: false } });

  it('payer cards first, then viewers; family, class, school within each; the server order kept otherwise', () => {
    const cls2 = { ...cls, spaceId: 'space:cls2', name: 'Room 5' };
    const v = view(summary([viewer, sch, cls, fam, cls2]));
    expect(v.cards.map((c) => c.spaceId)).toEqual(['space:fam', 'space:cls', 'space:cls2', 'space:sch', 'space:other']);
  });

  it('two or more buyable spaces: Add a plan, one row each, exactly one primary, plus the school contract row', () => {
    const v = view(summary([sch, cls, fam]));
    expect(v.cards.every((c) => c.offer === null)).toBe(true);
    expect(v.addPlan?.offers.map((o) => [o.spaceId, o.planKey, o.primary])).toEqual([
      ['space:fam', 'family_lifetime', true],
      ['space:cls', 'group_license', false],
      ['space:sch', 'group_license', false],
    ]);
    expect(v.addPlan?.offers[1]?.title).toBe(b.buy.forSpace(b.planTitle.group_license, 'Room 4'));
    expect(v.addPlan?.offers[2]?.includes).toContain(b.includesLines.license.school(SCHOOL_LICENSE_TEACHERS, SCHOOL_LICENSE_STUDENTS));
    expect(v.addPlan?.contact).toEqual([{ spaceId: 'space:sch', title: b.buy.forSpace(b.planTitle.school_seat, 'Maple School'), cta: b.contact.cta, href: contactHref() }]);
  });

  it("the Contact us rows follow the server's contact action, like the card's own button", () => {
    const noContact = { ...sch, actions: { buy: 'group_license' as const, manage: false, contact: false } };
    const v = view(summary([noContact, cls, fam]));
    expect(v.addPlan?.offers).toHaveLength(3);
    expect(v.addPlan?.contact).toEqual([]);
  });

  it('nothing to buy: no offer anywhere', () => {
    const v = view(summary([viewer, card({ coverage: own(), actions: { buy: null, manage: true, contact: false } })]));
    expect(v.addPlan).toBeNull();
    expect(v.cards.every((c) => c.offer === null)).toBe(true);
  });

  it('a promo rewrites every price line (F-ENT-002 section 3.3)', () => {
    const promo: Promo = { id: 'promo_1', code: 'HOYA20', name: null, percentOff: 20, amountOffCents: null, duration: 'once' };
    const single = view(summary([fam]), SITE_CLAIMS, promo);
    expect(single.cards[0]?.offer?.price).toBe(promoPriceLine('family_lifetime', promo, 'en'));
    const many = view(summary([fam, cls]), SITE_CLAIMS, promo);
    expect(many.addPlan?.offers.map((o) => o.price)).toEqual([promoPriceLine('family_lifetime', promo, 'en'), promoPriceLine('group_license', promo, 'en')]);
  });

  it('a promo checked for one plan rewrites only that plan\'s price lines; the others keep the plain price', () => {
    const promo: Promo = { id: 'promo_1', code: 'HOYA20', name: null, percentOff: 20, amountOffCents: null, duration: 'once' };
    const many = billingHomeView(summary([fam, cls]), { now, locale: 'en', promo, promoPlanKey: 'family_lifetime' });
    expect(many.addPlan?.offers.map((o) => o.price)).toEqual([promoPriceLine('family_lifetime', promo, 'en'), planPrice('group_license', 'en')]);
    const single = billingHomeView(summary([cls]), { now, locale: 'en', promo, promoPlanKey: 'family_lifetime' });
    expect(single.cards[0]?.offer?.price).toBe(planPrice('group_license', 'en'));
  });
});

describe('includesLines: feature lines only while SITE_CLAIMS says the feature is live', () => {
  it('family: base lines always; browse, reports and notes only when their claims are on', () => {
    const base = [b.includesLines.family.everyLesson, b.includesLines.family.learners(FAMILY_LIFETIME_LEARNERS), b.includesLines.family.cloudSave];
    expect(includesLines('family_lifetime', 'family', 'en', OFF)).toEqual(base);
    expect(includesLines('family_lifetime', 'family', 'en', ALL_ON)).toEqual([...base, b.includesLines.family.browse, b.includesLines.family.reports, b.includesLines.family.notes]);
    expect(includesLines('family_lifetime', 'family', 'en', { ...OFF, parentReports: true })).toEqual([...base, b.includesLines.family.reports]);
    // teacherReports is not a family claim.
    expect(includesLines('family_lifetime', 'family', 'en', { ...OFF, teacherReports: true })).toEqual(base);
  });

  it('license: the school line only for a school; feature lines per claim', () => {
    const base = [b.includesLines.license.everyStudent, b.includesLines.license.noCap(FREE_CLASS_STUDENT_CAP)];
    expect(includesLines('group_license', 'class', 'en', OFF)).toEqual(base);
    expect(includesLines('group_license', 'school', 'en', OFF)).toEqual([...base, b.includesLines.license.school(SCHOOL_LICENSE_TEACHERS, SCHOOL_LICENSE_STUDENTS)]);
    expect(includesLines('group_license', 'class', 'en', ALL_ON)).toEqual([...base, b.includesLines.license.browse, b.includesLines.license.reports, b.includesLines.license.notes]);
    expect(includesLines('group_license', 'class', 'en', { ...OFF, parentReports: true })).toEqual(base);
  });

  it.each(['ko', 'es'] as const)('%s: no reports line while reports render only in a reviewed locale', (locale) => {
    const lines = getMessages(locale).console.billing.includesLines;
    expect(includesLines('family_lifetime', 'family', locale, SITE_CLAIMS)).toEqual(includesLines('family_lifetime', 'family', locale, OFF));
    expect(includesLines('family_lifetime', 'family', locale, ALL_ON)).not.toContain(lines.family.reports);
    expect(includesLines('group_license', 'class', locale, SITE_CLAIMS)).not.toContain(lines.license.reports);
    expect(includesLines('group_license', 'class', locale, ALL_ON)).toEqual([...includesLines('group_license', 'class', locale, OFF), lines.license.browse, lines.license.notes]);
  });

  it('reads SITE_CLAIMS by default, where the reports claims are on (F-REPORT-001 RP-11)', () => {
    expect(billingHomeView(summary([card()]), { now }).cards[0]?.offer?.includes).toEqual(includesLines('family_lifetime', 'family', 'en', SITE_CLAIMS));
    expect(includesLines('family_lifetime', 'family', 'en')).toEqual([...includesLines('family_lifetime', 'family', 'en', OFF), b.includesLines.family.reports]);
    expect(includesLines('group_license', 'class', 'en')).toEqual([...includesLines('group_license', 'class', 'en', OFF), b.includesLines.license.reports]);
  });
});

describe('receipt rows (section 4.10)', () => {
  it('words the kinds and plans, with a test pill for sandbox rows', () => {
    const kinds = (['purchase', 'renewal', 'refund', 'failed'] as const).map((kind) => receiptRow(receipt({ kind }), 'en').kind);
    expect(kinds).toEqual([b.receipts.kind.purchase, b.receipts.kind.renewal, b.receipts.kind.refund, b.receipts.kind.failed]);
    const row = receiptRow(receipt(), 'en');
    expect(row).toEqual({
      id: 'bev:r1',
      date: day('2026-10-01T09:00:00.000Z'),
      kind: b.receipts.kind.purchase,
      plan: b.planTitle.family_lifetime,
      amount: '$15.30',
      testPill: b.receipts.test.pill,
      hasReceipt: true,
      viewLabel: b.receipts.view.cta,
      viewA11y: b.receipts.viewA11y(day('2026-10-01T09:00:00.000Z')),
    });
    expect(receiptRow(receipt({ livemode: true }), 'en').testPill).toBeNull();
    expect(receiptRow(receipt({ planKey: 'group_license' }), 'en').plan).toBe(b.planTitle.group_license);
  });

  it('a legacy one-time row shows the plan name only, never a "one payment" label (BY-D9)', () => {
    // A legacy one-time sandbox Family Plan: the card's row has no date, its receipt is a purchase.
    const legacy = receipt({ id: 'bev:legacy', kind: 'purchase', planKey: 'family_lifetime', amountCents: 9900, livemode: false });
    const c = view(summary([card({ coverage: own({ expiresAt: null }), actions: { buy: null, manage: false, contact: false }, receipts: [legacy], hasReceipts: true })])).cards[0];
    const row = c?.receipts[0];
    expect(row?.plan).toBe(b.planTitle.family_lifetime);
    expect(row?.kind).toBe(b.receipts.kind.purchase);
    for (const value of Object.values(row ?? {})) expect(String(value)).not.toMatch(/one payment|once|lifetime|for good/i);
  });

  it('usd through formatUsd like the offer price; other currencies in their own minor unit (formatMinorAmount)', () => {
    expect(receiptRow(receipt({ amountCents: 15300 }), 'en').amount).toBe('$153');
    expect(receiptRow(receipt({ amountCents: 1530, currency: 'USD' }), 'en').amount).toBe('$15.30');
    expect(receiptRow(receipt({ amountCents: 20000, currency: 'krw' }), 'en').amount).toBe('₩20,000');
    expect(receiptRow(receipt({ amountCents: 1250, currency: 'eur' }), 'es').amount).toBe(formatMinorAmount('es', 1250, 'eur'));
  });

  it('inline rows are cut to the newest three', () => {
    const many = [receipt({ id: 'bev:a' }), receipt({ id: 'bev:b' }), receipt({ id: 'bev:c' }), receipt({ id: 'bev:d' })];
    expect(view(summary([card({ receipts: many, hasReceipts: true })])).cards[0]?.receipts.map((r) => r.id)).toEqual(['bev:a', 'bev:b', 'bev:c']);
  });
});

describe('account cards (legacy subject account rows, section 4.2)', () => {
  const account = (over: Partial<BillingAccountCard> = {}): BillingAccountCard => ({ coverage: own({ planKey: 'group_license' }), actions: { manage: true }, receipts: [receipt()], legacyNoHistory: false, ...over });

  it('one extra card for the viewer own account, always a payer card', () => {
    const v = view(summary([], { account: [account()] }));
    expect(v.empty).toBeNull();
    expect(v.accountCards).toEqual([
      { heading: b.accountCard.title, plan: b.coverage.license, status: b.status.renewsOn(day(YEAR_ON)), pastDue: false, manage: true, receipts: [receiptRow(receipt(), 'en')], legacyNoHistory: false },
    ]);
  });

  it('the account card heading is a sentence-case title in every locale', () => {
    expect(b.accountCard.title).toBe('Your account');
    for (const locale of UI_LOCALES) {
      expect(billingHomeView(summary([], { account: [account()] }), { now, locale }).accountCards[0]?.heading).toBe(getMessages(locale).console.billing.accountCard.title);
    }
  });

  it('a past-due account row raises the note too', () => {
    expect(view(summary([], { account: [account({ coverage: own({ planKey: 'group_license', status: 'past_due', statusSince: '2026-10-11T00:00:00.000Z' }) })] })).pastDueNote).toBe(b.pastDue);
  });
});

describe('empty state, help and failures', () => {
  it('no spaces: the two set-up buttons into /start', () => {
    const v = view(summary([]));
    expect(v.empty).toEqual({
      title: b.noSpaces.title,
      family: { cta: b.noSpaces.family.cta, href: `${APP_ROUTES.start}?persona=parent` },
      class: { cta: b.noSpaces.class.cta, href: `${APP_ROUTES.start}?persona=teacher` },
    });
    expect(v.cards).toEqual([]);
    expect(v.addPlan).toBeNull();
  });

  it('help lines with the contact address', () => {
    expect(view(summary([card()])).help).toEqual({ refund: b.help.refund(CONTACT_EMAIL), learners: b.help.learners, sharedDevice: b.help.sharedDevice });
  });

  it('offline and error panels with Try again', () => {
    expect(summaryFailureNotice(true, 'en')).toEqual({ text: b.offline, retry: b.retry.cta });
    expect(summaryFailureNotice(false, 'en')).toEqual({ text: b.cantCheck, retry: b.retry.cta });
    expect(summaryFailureNotice(false)).toEqual({ text: b.cantCheck, retry: b.retry.cta });
  });

  it('words every locale from its own dictionary, with no price outside an offer', () => {
    for (const locale of UI_LOCALES) {
      const v = billingHomeView(summary([card({ role: 'caregiver', payer: false, readOnlyReason: 'family', coverage: own(), actions: { buy: null, manage: false, contact: false } })]), { now, locale });
      expect(v.cards[0]?.readOnly).toBe(getMessages(locale).console.billing.readOnly.family);
      expect(JSON.stringify(v)).not.toMatch(/\$|15[.,]30/);
    }
  });
});

describe('action notes after checkout or Manage subscription (B-8a)', () => {
  it('maps the server codes to one neutral note per action', () => {
    expect(actionNoteFor('checkout', 'already_active')).toBe('alreadyActive');
    expect(actionNoteFor('checkout', 'stripe_not_configured')).toBe('notConfigured');
    expect(actionNoteFor('portal', 'not_configured')).toBe('notConfigured');
    expect(actionNoteFor('checkout', 'live_not_enabled')).toBe('liveOff');
    expect(actionNoteFor('portal', 'live_not_enabled')).toBe('liveOff');
    expect(actionNoteFor('checkout', 'stripe_error')).toBe('checkoutFailed');
    expect(actionNoteFor('checkout', undefined)).toBe('checkoutFailed');
    expect(actionNoteFor('portal', 'already_active')).toBe('portalFailed');
    expect(actionNoteFor('portal', undefined)).toBe('portalFailed');
  });

  it('words each note from the dictionary', () => {
    const notes: Record<BillingActionNote, string> = {
      alreadyActive: b.alreadyActive,
      notConfigured: b.notConfigured,
      liveOff: b.liveOff,
      checkoutFailed: b.checkoutFailed,
      portalFailed: b.portalFailed,
      stepUpCancelled: b.stepUp.cancelled,
    };
    for (const [note, text] of Object.entries(notes)) expect(actionNoteText(note as BillingActionNote, 'en')).toBe(text);
    expect(actionNoteText('alreadyActive')).toBe(b.alreadyActive);
    expect(actionNoteText('alreadyActive', 'ko')).toBe(getMessages('ko').console.billing.alreadyActive);
  });
});

describe('modeBanner (the receipts page reuses it, B-8c)', () => {
  it('test, none, live not open, live open', () => {
    expect(modeBanner({ mode: 'test', purchasesOpen: true })).toBe(b.testMode);
    expect(modeBanner({ mode: 'none', purchasesOpen: false }, 'en')).toBe(b.notConfigured);
    expect(modeBanner({ mode: 'live', purchasesOpen: false }, 'en')).toBe(b.liveOff);
    expect(modeBanner({ mode: 'live', purchasesOpen: true }, 'en')).toBeNull();
  });
});
