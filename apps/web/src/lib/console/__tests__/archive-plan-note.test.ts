import { FAMILY_LIFETIME_LEARNERS, PAST_DUE_GRACE_MS, type BillingSpaceCard, type BillingSummary } from '@hangul-route/content-schema';
import { getMessages, UI_LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { archiveConfirmText, archivePlanNote } from '../archive-plan-note';

/**
 * F-BILL-002 B-12 (section 4.6): the space settings archive confirm names the
 * plan the archive affects. Archiving pauses a space's own plan (tierFromSpaces
 * skips archived spaces) but never stops a Stripe subscription from renewing.
 */
const now = new Date('2026-10-12T12:00:00.000Z');
const a = getMessages('en').console.billing.archiveConfirm;
const YEAR_ON = '2027-10-12T00:00:00.000Z';
const PAST = '2026-01-01T00:00:00.000Z';

type Own = Extract<BillingSpaceCard['coverage'], { state: 'own' }>;
const own = (over: Partial<Own> = {}): Own => ({ state: 'own', planKey: 'family_lifetime', status: 'active', expiresAt: YEAR_ON, statusSince: '2026-10-01T00:00:00.000Z', endsAtPeriodEnd: false, ...over });
const card = (over: Partial<BillingSpaceCard> = {}): BillingSpaceCard => ({
  spaceId: 'space:fam',
  kind: 'family',
  name: 'Kim family',
  role: 'owner',
  archived: false,
  payer: true,
  readOnlyReason: null,
  coverage: own(),
  usage: { learners: 2, learnerCap: FAMILY_LIFETIME_LEARNERS, teachers: null, teacherCap: null },
  actions: { buy: null, manage: true, contact: false },
  receipts: [],
  hasReceipts: false,
  legacyNoHistory: false,
  ...over,
});
const summary = (cards: BillingSpaceCard[]): BillingSummary => ({ mode: 'test', purchasesOpen: true, cards, account: [] });
const license = (over: Partial<Own> = {}): BillingSpaceCard =>
  card({ spaceId: 'space:cls', kind: 'class', name: 'Spring Class', coverage: own({ planKey: 'group_license', ...over }), usage: { learners: 12, learnerCap: null, teachers: null, teacherCap: null } });

describe('archivePlanNote: the Family Plan (section 4.6)', () => {
  it('a renewing Family Plan: learners lose it while archived, and it keeps renewing', () => {
    expect(archivePlanNote(summary([card()]), 'space:fam', now, 'en')).toBe(`${a.familyLoses('Kim family')} ${a.familyRenews}`);
  });

  it('the line uses the space name from the card it reads', () => {
    expect(archivePlanNote(summary([card({ name: 'Park family' })]), 'space:fam', now, 'en')).toContain('Park family');
  });

  it('a Family Plan cancelled in the portal: learners lose it while archived, no renewing line', () => {
    expect(archivePlanNote(summary([card({ coverage: own({ endsAtPeriodEnd: true }) })]), 'space:fam', now, 'en')).toBe(a.familyLoses('Kim family'));
    expect(archivePlanNote(summary([card({ coverage: own({ status: 'cancelled' }) })]), 'space:fam', now, 'en')).toBe(a.familyLoses('Kim family'));
  });

  it('a legacy one-time sandbox Family Plan (no date): learners lose it, it never renews', () => {
    expect(archivePlanNote(summary([card({ coverage: own({ expiresAt: null }) })]), 'space:fam', now, 'en')).toBe(a.familyLoses('Kim family'));
  });

  it('past due inside the grace week: still covering and still renewing', () => {
    const since = new Date(now.getTime() - PAST_DUE_GRACE_MS / 2).toISOString();
    expect(archivePlanNote(summary([card({ coverage: own({ status: 'past_due', statusSince: since }) })]), 'space:fam', now, 'en')).toBe(`${a.familyLoses('Kim family')} ${a.familyRenews}`);
  });

  it('a plan that already ended affects nothing: no line', () => {
    expect(archivePlanNote(summary([card({ coverage: own({ status: 'expired', expiresAt: PAST }) })]), 'space:fam', now, 'en')).toBeNull();
    expect(archivePlanNote(summary([card({ coverage: own({ status: 'cancelled', expiresAt: PAST }) })]), 'space:fam', now, 'en')).toBeNull();
    const longAgo = new Date(now.getTime() - PAST_DUE_GRACE_MS * 2).toISOString();
    expect(archivePlanNote(summary([card({ coverage: own({ status: 'past_due', statusSince: longAgo }) })]), 'space:fam', now, 'en')).toBeNull();
  });
});

describe('archivePlanNote: the Group License (section 4.6)', () => {
  it('a renewing license: it keeps renewing until cancelled in Billing', () => {
    expect(archivePlanNote(summary([license()]), 'space:cls', now, 'en')).toBe(a.licenseRenews);
  });

  it('a license that does not renew (cancelled at period end): no line', () => {
    expect(archivePlanNote(summary([license({ endsAtPeriodEnd: true })]), 'space:cls', now, 'en')).toBeNull();
  });
});

describe('archivePlanNote: nothing to name', () => {
  it('a free space, a class covered by its school, a School Contract: no line', () => {
    expect(archivePlanNote(summary([card({ coverage: { state: 'free' } })]), 'space:fam', now, 'en')).toBeNull();
    const covered = card({ spaceId: 'space:cls', kind: 'class', coverage: { state: 'school', schoolName: 'Hill School', planKey: 'group_license', expiresAt: YEAR_ON } });
    expect(archivePlanNote(summary([covered]), 'space:cls', now, 'en')).toBeNull();
    const contract = card({ spaceId: 'space:sch', kind: 'school', coverage: own({ planKey: 'school_seat' }) });
    expect(archivePlanNote(summary([contract]), 'space:sch', now, 'en')).toBeNull();
  });

  it('no summary (not loaded or failed) or no card for this space: no line', () => {
    expect(archivePlanNote(null, 'space:fam', now, 'en')).toBeNull();
    expect(archivePlanNote(summary([card()]), 'space:other', now, 'en')).toBeNull();
  });

  it('a viewer card names the plan too: the archive affects learners whoever pays', () => {
    expect(archivePlanNote(summary([card({ payer: false, role: 'caregiver', readOnlyReason: 'family', actions: { buy: null, manage: false, contact: false } })]), 'space:fam', now, 'en')).toBe(
      `${a.familyLoses('Kim family')} ${a.familyRenews}`,
    );
  });
});

describe('archiveConfirmText: the confirm dialog', () => {
  const c = getMessages('en').console;
  it('without a plan: the ask and the keeps line, as before', () => {
    expect(archiveConfirmText('Kim family', null, 'en')).toBe(`${c.settings.danger.archiveAsk('Kim family')} ${c.archiveKeeps}`);
  });

  it('with a plan: the plan line follows on its own paragraph', () => {
    expect(archiveConfirmText('Kim family', a.licenseRenews, 'en')).toBe(`${c.settings.danger.archiveAsk('Kim family')} ${c.archiveKeeps}\n\n${a.licenseRenews}`);
  });
});

describe('archivePlanNote: every UI locale has the words', () => {
  it.each(UI_LOCALES)('%s', (locale) => {
    const words = getMessages(locale).console.billing.archiveConfirm;
    expect(archivePlanNote(summary([card()]), 'space:fam', now, locale)).toBe(`${words.familyLoses('Kim family')} ${words.familyRenews}`);
    expect(words.familyLoses('Kim family')).toContain('Kim family');
    expect(archivePlanNote(summary([license()]), 'space:cls', now, locale)).toBe(words.licenseRenews);
  });
});
