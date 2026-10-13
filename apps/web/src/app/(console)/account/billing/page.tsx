'use client';

import type { BillingSummary, Promo, PurchasablePlanKey } from '@hangul-route/content-schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountCard, AddPlanSection, BillingCard, BillingNote, BillingSkeleton, BillingStyles, EmptyState, FailPanel, HelpSection, ModeBanner, type PromoFormProps } from '@/components/console/BillingHomeParts';
import { AdultFrame } from '@/components/console/AdultFrame';
import { Notice } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import { promoNoteText, type PromoNote } from '@/lib/console/billing';
import { actionNoteFor, actionNoteText, billingHomeView, contactHref, summaryFailureNotice, type BillingActionNote, type BillingOfferView } from '@/lib/console/billing-summary';

/**
 * The billing home — F-BILL-002 B-8a (sections 4.2, 4.3, 4.6, 4.9, 4.12; screen spec
 * `design/screens/billing/billing-home.md`) at `APP_ROUTES.billing` for every grown-up, inside F-APP-001's
 * grown-up layout (`account/layout.tsx`: providers, lock, `noindex`). It reads `GET /api/billing/summary` and draws
 * `billingHomeView`; the server decides who pays and what a viewer may see.
 */

function browserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

type Failure = 'offline' | 'error';

export default function BillingPage(): JSX.Element {
  const { ready, session, api, signOut, m, locale } = useConsole();
  const b = m.console.billing;
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  // Keys, not text: notes are worded at render time, so they follow the header language select.
  const [note, setNote] = useState<BillingActionNote | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [promo, setPromo] = useState<Promo | null>(null);
  // The plan the code was checked for: only that plan's offers show the promo price and carry the code to checkout.
  const [promoPlanKey, setPromoPlanKey] = useState<PurchasablePlanKey | null>(null);
  const [promoNote, setPromoNote] = useState<PromoNote | null>(null);
  const failureRef = useRef<Failure | null>(null);
  failureRef.current = failure;

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    const result = await api.billingSummary();
    if (result.ok) {
      setSummary(result.data);
      setFailure(null);
      return;
    }
    setFailure(!browserOnline() || result.error === 'network' ? 'offline' : 'error');
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  // Offline after the cards loaded: buy, Manage and Apply code wait for the connection; a failed read reloads by itself.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    setOnline(browserOnline());
    const goOffline = (): void => setOnline(false);
    const goOnline = (): void => {
      setOnline(true);
      if (failureRef.current) void load();
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [load]);

  const view = useMemo(() => (summary ? billingHomeView(summary, { now: new Date(), locale, promo, promoPlanKey }) : null), [summary, locale, promo, promoPlanKey]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const actionsDisabled = !view?.actionsEnabled || !online || busy || !api;
  const firstOffer: BillingOfferView | undefined = view ? (view.cards.find((card) => card.offer)?.offer ?? view.addPlan?.offers[0] ?? undefined) : undefined;

  const applyCode = async (): Promise<void> => {
    if (!api || !firstOffer) return;
    const code = codeInput.trim();
    if (!code) {
      setPromo(null);
      setPromoNote(null);
      return;
    }
    // Checked against the first offer's plan; the server checks it again at checkout.
    setBusy(true);
    setPromoNote(null);
    const result = await api.checkPromo({ code, planKey: firstOffer.planKey });
    setBusy(false);
    if (!result.ok) {
      setPromo(null);
      setPromoNote({ kind: result.status === 429 ? 'tooMany' : result.code === 'stripe_not_configured' ? 'notConfigured' : 'invalid' });
      return;
    }
    setPromo(result.data.promo);
    setPromoPlanKey(firstOffer.planKey);
    setCodeInput(result.data.promo.code);
    setPromoNote({ kind: 'applied', code: result.data.promo.code, name: result.data.promo.name });
  };

  const buy = async (planKey: PurchasablePlanKey, spaceId: string): Promise<void> => {
    if (!api) return;
    setBusy(true);
    setNote(null);
    const result = await api.checkout({ planKey, subjectKind: 'space', subjectId: spaceId, ...(promo && promoPlanKey === planKey ? { promoCode: promo.code } : {}) });
    setBusy(false);
    if (result.ok) {
      window.location.assign(result.data.url);
      return;
    }
    if (result.code === 'promo_invalid') {
      setPromo(null);
      setPromoNote({ kind: 'invalid' });
      return;
    }
    const next = actionNoteFor('checkout', result.code);
    setNote(next);
    // The plan landed meanwhile (another tab, a late webhook): show it. Nothing was charged.
    if (next === 'alreadyActive') void load();
  };

  const manage = async (subjectKind: 'account' | 'space', subjectId: string): Promise<void> => {
    if (!api) return;
    setBusy(true);
    setNote(null);
    const result = await api.portal({ subjectKind, subjectId });
    setBusy(false);
    if (result.ok) {
      window.location.assign(result.data.url);
      return;
    }
    setNote(actionNoteFor('portal', result.code));
  };

  const promoProps: PromoFormProps | null = firstOffer
    ? {
        value: codeInput,
        onChange: setCodeInput,
        onSubmit: () => void applyCode(),
        applied: promo !== null,
        note: promoNote ? promoNoteText(promoNote, locale) : m.console.promoHint,
        disabled: actionsDisabled,
      }
    : null;
  const mail = contactHref(locale);
  const failed = failure ? summaryFailureNotice(failure === 'offline', locale) : null;

  return (
    <AdultFrame onSignOut={signOut}>
      <BillingStyles />
      <div className="hr-bill">
        <h1>{b.title}</h1>
        {!api ? <Notice tone="info">{m.console.shell.noApi}</Notice> : null}
        {failed ? (
          <FailPanel text={failed.text} retry={failed.retry} onRetry={() => void load()} />
        ) : !view ? (
          api ? <BillingSkeleton /> : null
        ) : (
          <>
            <ModeBanner text={view.banner} />
            {!online ? <BillingNote>{b.offline}</BillingNote> : null}
            {note ? <BillingNote>{actionNoteText(note, locale)}</BillingNote> : null}
            {view.pastDueNote ? <BillingNote>{view.pastDueNote}</BillingNote> : null}
            {view.empty ? (
              <EmptyState empty={view.empty} />
            ) : (
              <section className="hr-bill-section" aria-labelledby="hr-bill-yours">
                <h2 id="hr-bill-yours">{b.sections.yours}</h2>
                <div className="hr-bill-cards">
                  {view.cards.map((card) => {
                    const offer = card.offer;
                    return (
                      <BillingCard
                        key={card.spaceId}
                        card={card}
                        handlers={{
                          onManage: () => void manage('space', card.spaceId),
                          actionsDisabled,
                          contactHref: mail,
                          offer: offer ? { promo: offer === firstOffer ? promoProps : null, onBuy: () => void buy(offer.planKey, offer.spaceId) } : null,
                        }}
                      />
                    );
                  })}
                  {view.accountCards.map((card, i) => (
                    <AccountCard key={`account-${i}`} card={card} actionsDisabled={actionsDisabled} onManage={() => void manage('account', session.accountId)} />
                  ))}
                </div>
              </section>
            )}
            {view.addPlan ? <AddPlanSection offers={view.addPlan.offers} contact={view.addPlan.contact} promo={promoProps} onBuy={(offer) => void buy(offer.planKey, offer.spaceId)} disabled={actionsDisabled} /> : null}
            <HelpSection help={view.help} />
          </>
        )}
      </div>
    </AdultFrame>
  );
}
