import { FAMILY_LIFETIME_LEARNERS, type BillingSpaceCard, type BillingSummary } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccountCard, AddPlanSection, BackToBilling, BillingCard, EmptyState, FailPanel, HelpSection, ReceiptsTable, ReturnNoticeRegion, type CardHandlers } from '@/components/console/BillingHomeParts';
import { StepUpDialog } from '@/components/console/StepUpDialog';
import { initialReturnState, returnNotice, returnStep, type ReturnState } from '@/lib/console/checkout-return';
import { billingHomeView, receiptRow, summaryFailureNotice } from '@/lib/console/billing-summary';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-BILL-002 B-8a, F-I18N-001 section 3.11: the billing home's loaded parts (cards for each persona, the offer with
 * Have a code?, Add a plan, Help, the empty state, the failure panel) take every word from the dictionary. Rendered
 * in en-XA from B-7's view model; space names, the e-mail address, prices and dates are data.
 */
const PSEUDO = 'en-XA' as UiLocale;

vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: PSEUDO, messages: getMessages(PSEUDO), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => PSEUDO, useSetLocale: () => () => undefined };
});

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The formatters take UI locales only (en-XA is a dictionary test locale): dates and amounts render in English.
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  const ui = (locale: UiLocale): UiLocale => (locale === PSEUDO ? 'en' : locale);
  return {
    ...actual,
    formatDate: (locale: UiLocale, ...rest: Parameters<typeof actual.formatDate> extends [UiLocale, ...infer R] ? R : never) => actual.formatDate(ui(locale), ...rest),
    formatUsd: (locale: UiLocale, ...rest: Parameters<typeof actual.formatUsd> extends [UiLocale, ...infer R] ? R : never) => actual.formatUsd(ui(locale), ...rest),
  };
});

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const now = new Date('2026-10-12T12:00:00.000Z');
const noop = (): undefined => undefined;
const data = ['Kim family', 'Room 4', 'Maple School', 'hello@hangulroute.com', 'Oct', 'Aug'];

const card = (over: Partial<BillingSpaceCard> = {}): BillingSpaceCard => ({
  spaceId: 'space:fam',
  kind: 'family',
  name: 'Kim family',
  role: 'owner',
  archived: false,
  payer: true,
  readOnlyReason: null,
  coverage: { state: 'free' },
  usage: { learners: 0, learnerCap: FAMILY_LIFETIME_LEARNERS, teachers: null, teacherCap: null },
  actions: { buy: 'family_lifetime', manage: false, contact: false },
  receipts: [],
  hasReceipts: false,
  legacyNoHistory: false,
  ...over,
});
const active = { state: 'own' as const, planKey: 'family_lifetime' as const, status: 'active' as const, expiresAt: '2027-10-12T00:00:00.000Z', statusSince: '2026-10-01T00:00:00.000Z', endsAtPeriodEnd: false };
const summary = (cards: BillingSpaceCard[], over: Partial<BillingSummary> = {}): BillingSummary => ({ mode: 'test', purchasesOpen: true, cards, account: [], ...over });
const handlers = (over: Partial<CardHandlers> = {}): CardHandlers => ({ onManage: noop, actionsDisabled: false, offer: null, contactHref: 'mailto:hello@hangulroute.com', ...over });
// Built inside each test: the pseudo-locale is switched on in beforeAll.
const promoForm = () => ({ value: '', onChange: noop, onSubmit: noop, applied: false, note: getMessages(PSEUDO).console.promoHint, disabled: false });

describe('billing home parts render only dictionary text (en-XA)', () => {
  it('the one buyable card with the offer and Have a code?', () => {
    const view = billingHomeView(summary([card()]), { now, locale: PSEUDO });
    const first = view.cards[0] as NonNullable<(typeof view.cards)[0]>;
    const html = renderToStaticMarkup(<BillingCard card={first} handlers={handlers({ offer: { promo: promoForm(), onBuy: noop } })} />);
    expect(html).toContain('name="promo"');
    expectAllPseudo(html, data);
  });

  it('a payer with the plan, receipts, Connect a learner and Contact us; a viewer card', () => {
    const receipt = { id: 'bev:r1', kind: 'purchase' as const, planKey: 'family_lifetime' as const, amountCents: 1530, currency: 'usd', livemode: false, occurredAt: '2026-10-01T09:00:00.000Z', hasReceipt: true };
    const view = billingHomeView(
      summary([
        card({ coverage: active, actions: { buy: null, manage: true, contact: true }, receipts: [receipt], hasReceipts: true, legacyNoHistory: true }),
        card({ spaceId: 'space:s', kind: 'school', name: 'Maple School', role: 'teacher', payer: false, readOnlyReason: 'school', coverage: { state: 'school', schoolName: 'Maple School', planKey: 'group_license', expiresAt: '2029-08-31T00:00:00.000Z' }, usage: null, actions: { buy: null, manage: false, contact: false } }),
      ]),
      { now, locale: PSEUDO },
    );
    const html = view.cards.map((c) => renderToStaticMarkup(<BillingCard card={c} handlers={handlers()} />)).join('');
    expect(html).toContain('/parent/space?id=');
    expectAllPseudo(html, data);
  });

  it('Add a plan, the legacy account card, Help, the empty state and the failure panels', () => {
    const view = billingHomeView(
      summary([card(), card({ spaceId: 'space:c', kind: 'class', name: 'Room 4', actions: { buy: 'group_license', manage: false, contact: true } })], {
        account: [{ coverage: active, actions: { manage: true }, receipts: [], legacyNoHistory: false }],
      }),
      { now, locale: PSEUDO },
    );
    const add = view.addPlan as NonNullable<typeof view.addPlan>;
    const empty = billingHomeView(summary([]), { now, locale: PSEUDO }).empty as NonNullable<typeof view.empty>;
    const failure = summaryFailureNotice(true, PSEUDO);
    const html = [
      renderToStaticMarkup(<AddPlanSection offers={add.offers} contact={add.contact} promo={promoForm()} onBuy={noop} disabled={false} />),
      ...view.accountCards.map((c) => renderToStaticMarkup(<AccountCard card={c} onManage={noop} actionsDisabled={false} />)),
      renderToStaticMarkup(<HelpSection help={view.help} />),
      renderToStaticMarkup(<EmptyState empty={empty} />),
      renderToStaticMarkup(<FailPanel text={failure.text} retry={failure.retry} onRetry={noop} />),
    ].join('');
    expectAllPseudo(html, data);
  });

  it('the checkout return notices and the step-up dialog (B-8b)', () => {
    const checking = initialReturnState({ kind: 'success', plan: 'family_lifetime', spaceId: 'space:fam' }) as ReturnState;
    const states: ReturnState[] = [
      checking,
      returnStep(checking, { type: 'offline' }, now),
      returnStep(checking, { type: 'pollFailed', offline: false }, now),
      { phase: 'stillProcessing', target: null },
      { phase: 'done', target: null, nextStep: null },
      { phase: 'cancelled' },
    ];
    const notices = states.map((state) => {
      const notice = returnNotice(state, PSEUDO);
      return renderToStaticMarkup(<ReturnNoticeRegion notice={notice} done={state.phase === 'done'} checking={state.phase === 'checking'} onAction={noop} />);
    });
    const dialogs = (['asking', 'verifying', 'unavailable'] as const).map((phase) => renderToStaticMarkup(<StepUpDialog phase={phase} onContinue={noop} onCancel={noop} />));
    expect(dialogs.join('')).toContain('role="dialog"');
    expectAllPseudo([...notices, ...dialogs].join(''), data);
  });

  it('the receipts page: Back to Billing and the table with a failed lookup line (B-8c)', () => {
    const rows = (['purchase', 'renewal', 'refund', 'failed'] as const).map((kind, i) =>
      receiptRow({ id: `bev:r${i}`, kind, planKey: 'family_lifetime', amountCents: 1530, currency: 'usd', livemode: false, occurredAt: '2028-10-02T09:00:00.000Z', hasReceipt: kind !== 'failed' }, PSEUDO),
    );
    const html = renderToStaticMarkup(<BackToBilling href="/account/billing" />) + renderToStaticMarkup(<ReceiptsTable rows={rows} notes={new Map([['bev:r0', 'failed'], ['bev:r1', 'tapAgain']] as const)} busyId={null} onView={noop} />);
    expect(html).toContain('role="rowheader"');
    expectAllPseudo(html, data);
  });
});
