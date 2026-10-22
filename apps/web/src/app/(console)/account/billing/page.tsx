'use client';

import type { BillingSummary, Promo, PurchasablePlanKey } from '@hangul-route/content-schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountCard, AddPlanSection, BillingCard, BillingNote, BillingSkeleton, BillingStyles, EmptyState, FailPanel, FreeForEveryone, HelpSection, ModeBanner, ReturnNoticeRegion, type PromoFormProps } from '@/components/console/BillingHomeParts';
import { AdultFrame } from '@/components/console/AdultFrame';
import { StepUpDialog, useStepUp } from '@/components/console/StepUpDialog';
import { Notice } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import { promoNoteText, type PromoNote } from '@/lib/console/billing';
import { actionNoteFor, actionNoteText, billingHomeView, contactHref, summaryFailureNotice, type BillingActionNote, type BillingOfferView } from '@/lib/console/billing-summary';
import { POLL_INTERVAL_MS, busyCardId, cleanedReturnSearch, focusCardId, initialReturnState, readCheckoutReturn, returnNotice, returnStep, shouldPoll, type ReturnEvent, type ReturnState } from '@/lib/console/checkout-return';

/**
 * The billing home — F-BILL-002 B-8a (sections 4.2, 4.3, 4.6, 4.9, 4.12; screen spec
 * `design/screens/billing/billing-home.md`) at `APP_ROUTES.billing` for every grown-up, inside F-APP-001's
 * grown-up layout (`account/layout.tsx`: providers, lock, `noindex`). It reads `GET /api/billing/summary` and draws
 * `billingHomeView`; the server decides who pays and what a viewer may see.
 *
 * B-8b (section 4.5, `checkout-return.md`): back from Stripe the page reads `?checkout=&plan=&id=` once, clears it
 * from the address bar, and polls the summary until the bought plan shows active on that card (B-7's
 * `checkout-return.ts` state machine), pausing offline without using attempts. Checkout and Manage subscription
 * go through step-up (section 4.4, `step-up.md`).
 */

function browserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

type Failure = 'offline' | 'error';

export default function BillingPage(): JSX.Element {
  const { ready, session, api, signOut, m, locale } = useConsole();
  const b = m.console.billing;
  const stepUp = useStepUp();
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
  const [ret, setRet] = useState<ReturnState | null>(null);
  const failureRef = useRef<Failure | null>(null);
  failureRef.current = failure;
  const retRef = useRef<ReturnState | null>(null);
  retRef.current = ret;
  const headings = useRef(new Map<string, HTMLHeadingElement>());
  const focused = useRef<string | null>(null);
  // Summary reads in flight: a poll never starts while one runs (its answer schedules the next poll).
  const reading = useRef(0);

  const dispatch = useCallback((event: ReturnEvent): void => {
    setRet((state) => (state ? returnStep(state, event, new Date()) : state));
  }, []);

  /** One summary read. A poll (`?poll=1`) sends no view event, and a failed poll leaves the cards where they are. */
  const load = useCallback(
    async (poll = false): Promise<void> => {
      if (!api) return;
      reading.current += 1;
      const result = await api.billingSummary(poll ? { poll: true } : {}).finally(() => {
        reading.current -= 1;
      });
      if (result.ok) {
        setSummary(result.data);
        setFailure(null);
        dispatch({ type: 'polled', summary: result.data });
        return;
      }
      const offline = !browserOnline() || result.error === 'network';
      if (!poll) setFailure(offline ? 'offline' : 'error');
      dispatch({ type: 'pollFailed', offline });
    },
    [api, dispatch],
  );

  // A return from Stripe: read the query once, then clear it so a refresh or a copied URL does not repeat it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = window.location.search;
    const parsed = readCheckoutReturn(search);
    if (!parsed) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${cleanedReturnSearch(search)}${window.location.hash}`);
    setRet(initialReturnState(parsed));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While checking, one poll every CHECKOUT_POLL_MS; each answer is a new state, which schedules the next.
  useEffect(() => {
    if (!api || !shouldPoll(ret)) return undefined;
    const timer = setTimeout(() => {
      // A slower read is still out (the first one, or one after `online`): its answer is the next state.
      if (reading.current === 0) void load(true);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [api, ret, load]);

  // Offline after the cards loaded: buy, Manage and Apply code wait for the connection; a failed read reloads by itself.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    setOnline(browserOnline());
    const goOffline = (): void => {
      setOnline(false);
      dispatch({ type: 'offline' });
    };
    const goOnline = (): void => {
      setOnline(true);
      // A paused return resumes checking, which reads the summary itself.
      const resumes = retRef.current?.phase === 'offline';
      dispatch({ type: 'online' });
      if (failureRef.current && !resumes) void load();
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [load, dispatch]);

  // Done: focus moves to the bought space's card heading, once.
  const focusId = focusCardId(ret);
  useEffect(() => {
    if (!focusId || focused.current === focusId) return;
    const heading = headings.current.get(focusId);
    if (!heading) return;
    focused.current = focusId;
    heading.focus();
  }, [focusId, summary]);

  const view = useMemo(() => (summary ? billingHomeView(summary, { now: new Date(), locale, promo, promoPlanKey }) : null), [summary, locale, promo, promoPlanKey]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const actionsDisabled = !view?.actionsEnabled || !online || busy || !api;
  // The card a return waits on keeps its buy, Manage and Apply code off: no second purchase meanwhile.
  const waitingId = busyCardId(ret);
  const firstOffer: BillingOfferView | undefined = view ? (view.cards.find((card) => card.offer)?.offer ?? view.addPlan?.offers[0] ?? undefined) : undefined;
  const notice = returnNotice(ret, locale);

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
    const step = await stepUp.run(() => api.checkout({ planKey, subjectKind: 'space', subjectId: spaceId, ...(promo && promoPlanKey === planKey ? { promoCode: promo.code } : {}) }));
    setBusy(false);
    if (step.kind === 'cancelled') {
      setNote('stepUpCancelled');
      return;
    }
    const result = step.result;
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
    const step = await stepUp.run(() => api.portal({ subjectKind, subjectId }));
    setBusy(false);
    if (step.kind === 'cancelled') {
      setNote('stepUpCancelled');
      return;
    }
    if (step.result.ok) {
      window.location.assign(step.result.data.url);
      return;
    }
    setNote(actionNoteFor('portal', step.result.code));
  };

  const promoProps: PromoFormProps | null = firstOffer
    ? {
        value: codeInput,
        onChange: setCodeInput,
        onSubmit: () => void applyCode(),
        applied: promo !== null,
        note: promoNote ? promoNoteText(promoNote, locale) : m.console.promoHint,
        disabled: actionsDisabled || firstOffer.spaceId === waitingId,
      }
    : null;
  const mail = contactHref(locale);
  // A return that is paused offline or on an error says so itself, with its own Try again.
  const returnSpeaks = ret?.phase === 'offline' || ret?.phase === 'error';
  const failed = failure && !returnSpeaks ? summaryFailureNotice(failure === 'offline', locale) : null;

  return (
    <AdultFrame onSignOut={signOut}>
      <BillingStyles />
      <div className="hr-bill">
        <h1>{b.title}</h1>
        {!api ? <Notice tone="info">{m.console.shell.noApi}</Notice> : null}
        {view ? <ModeBanner text={view.banner} /> : null}
        <ReturnNoticeRegion
          notice={notice ? { text: notice.text, action: notice.action ? { label: notice.action.label } : null } : null}
          done={ret?.phase === 'done'}
          checking={ret?.phase === 'checking'}
          onAction={() => {
            if (notice?.action) dispatch({ type: notice.action.event });
          }}
        />
        {failed ? (
          <FailPanel text={failed.text} retry={failed.retry} onRetry={() => void load()} />
        ) : !view ? (
          api && !returnSpeaks ? <BillingSkeleton /> : null
        ) : (
          <>
            {!online && !returnSpeaks ? <BillingNote>{b.offline}</BillingNote> : null}
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
                    const waiting = card.spaceId === waitingId;
                    return (
                      <BillingCard
                        key={card.spaceId}
                        card={card}
                        handlers={{
                          onManage: () => void manage('space', card.spaceId),
                          actionsDisabled: actionsDisabled || waiting,
                          contactHref: mail,
                          offer: offer ? { promo: offer === firstOffer ? promoProps : null, onBuy: () => void buy(offer.planKey, offer.spaceId) } : null,
                          marked: waiting || card.spaceId === focusId,
                          busy: waiting && ret?.phase === 'checking',
                          headingRef: (el) => {
                            if (el) headings.current.set(card.spaceId, el);
                            else headings.current.delete(card.spaceId);
                          },
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
            {view.addPlan ? (
              <AddPlanSection offers={view.addPlan.offers} contact={view.addPlan.contact} promo={promoProps} onBuy={(offer) => void buy(offer.planKey, offer.spaceId)} disabled={actionsDisabled} waitingSpaceId={waitingId} />
            ) : null}
            {/* Once under the offers: reports and notes come with every plan, the free one too (app-first-run). */}
            {view.freeForEveryone ? <FreeForEveryone text={view.freeForEveryone} /> : null}
            <HelpSection help={view.help} />
          </>
        )}
        {stepUp.dialog ? <StepUpDialog {...stepUp.dialog} /> : null}
      </div>
    </AdultFrame>
  );
}
