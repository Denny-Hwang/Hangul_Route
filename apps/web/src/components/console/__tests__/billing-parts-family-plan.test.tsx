import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CurrentPlanList, PlanRowList } from '@/components/console/BillingParts';
import type { EntitlementView, SpaceListItem } from '@/lib/console/api';
import { currentPlanCards, planRowsFor } from '@/lib/console/billing';

/**
 * The Family Plan renews yearly (owner decision 2026-10-11,
 * docs/specs/AMENDMENTS-BILLING-FAMILY-YEARLY.md BY-1; wireframe console/billing):
 * the family row prices it per year with the renew line, and a family's card
 * has Manage subscription like a licence. English, as the page renders it.
 */
vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: 'en', messages: getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

const now = new Date('2026-10-11T12:00:00.000Z');
const noop = (): void => undefined;
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const family: SpaceListItem = {
  space: { id: 'space:fam', kind: 'family', name: 'Kim family', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: 't' },
  role: 'owner',
  counts: { learners: 2, accounts: 1, classes: 0 },
  joinCode: null,
  joinCodeExpiresAt: null,
};
const familyPlan = (over: Partial<EntitlementView>): EntitlementView => ({ id: 'ent:fam', subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime', status: 'active', provider: 'stripe', providerRef: 'sub_fam', customerRef: 'cus_fam', seats: null, expiresAt: '2027-10-11T00:00:00.000Z', promoCode: null, updatedAt: '2026-10-11T00:00:00.000Z', subjectName: 'Kim family', ...over });

describe('console billing: the Family Plan renews yearly (BY-1)', () => {
  it('offers the Family Plan at $15.30 / year with the renew line, never as a one-time purchase', () => {
    const page = text(renderToStaticMarkup(<PlanRowList rows={planRowsFor('me', [family], [], now)} promo={null} disabled={false} onChoose={noop} />));
    expect(page).toContain('Family Plan');
    expect(page).toContain('$15.30 / year · Renews yearly. Cancel from Manage subscription any time.');
    expect(page).not.toMatch(/lifetime|\bonce\b|one payment|for good|nothing to cancel/i);
  });

  it('shows when a family plan renews and lets the payer manage it; a cancelled one says when it ends', () => {
    const renewing = text(renderToStaticMarkup(<CurrentPlanList cards={currentPlanCards([familyPlan({})], now)} showFree={false} busy={false} onManage={noop} />));
    expect(renewing).toContain('Family Plan · Kim family');
    expect(renewing).toContain('active · renews Oct 11, 2027');
    expect(renewing).toContain('Manage subscription');
    const ending = text(renderToStaticMarkup(<CurrentPlanList cards={currentPlanCards([familyPlan({ status: 'cancelled' })], now)} showFree={false} busy={false} onManage={noop} />));
    expect(ending).toContain('cancelled · ends Oct 11, 2027');
    expect(ending).toContain('Manage subscription');
  });

  it('a legacy one-time sandbox row reads active with no date and no Manage button', () => {
    const legacy = text(renderToStaticMarkup(<CurrentPlanList cards={currentPlanCards([familyPlan({ providerRef: 'pi_old', expiresAt: null })], now)} showFree={false} busy={false} onManage={noop} />));
    expect(legacy).toContain('Family Plan · Kim family');
    expect(legacy).toContain(' active ');
    expect(legacy).not.toContain('Manage subscription');
  });
});
