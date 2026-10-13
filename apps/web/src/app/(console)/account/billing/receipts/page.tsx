'use client';

import { APP_ROUTES, RECEIPTS_PAGE_LIMIT, type BillingSummary } from '@hangul-route/content-schema';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdultFrame } from '@/components/console/AdultFrame';
import { BackToBilling, BillingNote, BillingStyles, FailPanel, ModeBanner, ReceiptsSkeleton, ReceiptsTable, type ReceiptRowNote } from '@/components/console/BillingHomeParts';
import { StepUpDialog, useStepUp } from '@/components/console/StepUpDialog';
import { Notice } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { ReceiptsView } from '@/lib/console/api';
import { modeBanner, receiptRow, type ReceiptRowView } from '@/lib/console/billing-summary';

/**
 * Receipts — F-BILL-002 B-8c (sections 4.10, 4.12, 5.3; screen spec `design/screens/billing/receipts.md`) at
 * `BILLING_RECEIPTS_PATH?id=<spaceId>` (a query, not a path segment: the web build is a static export). Payers only:
 * the Worker answers anyone else with 403, which reads "This page is for the person who pays for this space."
 *
 * **View receipt** opens a blank tab inside the tap (so it is not blocked as a pop-up) and clears its opener, then
 * asks `POST /api/billing/receipt-link` for a fresh Stripe link behind step-up, and sends the tab there. When the
 * Worker asks for step-up, the blank tab is closed before "Confirm it's you" opens (the grown-up is never left on an
 * empty tab while this one asks), and after step-up the receipt opens in a new tab; if the browser blocks that tab
 * (the tap is long gone), the row says one more tap opens it. No Stripe id or URL is ever on this page or in its
 * address; a failed lookup closes the tab and says so on that row.
 */

type Failure = 'offline' | 'error' | 'notYours';

/** The window a View receipt tap opened; null when the browser blocked it. */
interface ReceiptTab {
  opener: unknown;
  location: { href: string };
  close: () => void;
}

function browserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function ReceiptsInner(): JSX.Element {
  const { ready, session, api, signOut, m, locale } = useConsole();
  const r = m.console.billing.receipts;
  const params = useSearchParams();
  const spaceId = params.get('id') ?? '';
  const stepUp = useStepUp();
  const [data, setData] = useState<ReceiptsView | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notes, setNotes] = useState<ReadonlyMap<string, ReceiptRowNote>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const failureRef = useRef<Failure | null>(null);
  failureRef.current = failure;

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    if (!spaceId) {
      setFailure('notYours');
      return;
    }
    // The summary (a poll read: no view event) gives the mode banner and whether history began after this plan.
    const [receipts, billing] = await Promise.all([api.receipts(spaceId), api.billingSummary({ poll: true })]);
    if (billing.ok) setSummary(billing.data);
    if (receipts.ok) {
      setData(receipts.data);
      setFailure(null);
      return;
    }
    if (receipts.status === 403 || receipts.status === 404) setFailure('notYours');
    else setFailure(!browserOnline() || receipts.error === 'network' ? 'offline' : 'error');
  }, [api, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const goOnline = (): void => {
      if (failureRef.current === 'offline') void load();
    };
    window.addEventListener('online', goOnline);
    return () => window.removeEventListener('online', goOnline);
  }, [load]);

  const rows = useMemo(() => (data ? data.receipts.map((row) => receiptRow(row, locale)) : []), [data, locale]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const noteRow = (id: string, note: ReceiptRowNote | null): void =>
    setNotes((current) => {
      const next = new Map(current);
      if (note) next.set(id, note);
      else next.delete(id);
      return next;
    });

  /** A new tab for `url` with its opener cleared; null when the browser blocked it. */
  const openTab = (url: string): ReceiptTab | null => {
    // No `noopener` feature: with it `window.open` returns null even when the tab opens, so success is unknowable.
    const opened = window.open(url, '_blank') as ReceiptTab | null;
    if (opened) opened.opener = null;
    return opened;
  };

  const view = async (row: ReceiptRowView): Promise<void> => {
    if (!api) return;
    // Inside the tap, before any await: a tab opened later would be blocked as a pop-up.
    const flow: { tab: ReceiptTab | null; steppedUp: boolean } = { tab: openTab(''), steppedUp: false };
    setBusyId(row.id);
    setCancelled(false);
    noteRow(row.id, null);
    const step = await stepUp.run(() => api.receiptLink(row.id), {
      // Step-up first: close the empty tab before the dialog opens in this one.
      onHint: () => {
        flow.steppedUp = true;
        flow.tab?.close();
        flow.tab = null;
      },
    });
    setBusyId(null);
    const { tab } = flow;
    if (step.kind === 'cancelled') {
      tab?.close();
      setCancelled(true);
      return;
    }
    if (step.result.ok) {
      const url = step.result.data.url;
      if (tab) {
        tab.location.href = url;
        return;
      }
      // No blank tab (step-up closed it, or the browser blocked it): one try now that the link is here.
      if (openTab(url)) return;
      // Blocked after step-up: a fresh tap opens it (no step-up again within 10 minutes). Blocked without one: say so.
      noteRow(row.id, flow.steppedUp ? 'tapAgain' : 'failed');
      return;
    }
    tab?.close();
    noteRow(row.id, 'failed');
  };

  const banner = summary ? modeBanner(summary, locale) : null;
  const legacy = summary?.cards.some((card) => card.spaceId === spaceId && card.legacyNoHistory) ?? false;
  const title = data && !failure ? r.pageTitle(data.spaceName) : r.title;
  const panel = failure === 'offline' ? m.console.billing.offline : failure === 'error' ? r.cantLoad : null;

  return (
    <AdultFrame onSignOut={signOut}>
      <BillingStyles />
      <div className="hr-bill hr-bill-reading">
        <BackToBilling href={APP_ROUTES.billing} />
        <h1>{title}</h1>
        {!api ? <Notice tone="info">{m.console.shell.noApi}</Notice> : null}
        {failure === 'notYours' ? (
          <div className="hr-bill-panel" data-testid="receipts-not-yours">
            <p>{r.notYours}</p>
            <BackToBilling href={APP_ROUTES.billing} />
          </div>
        ) : panel ? (
          <FailPanel text={panel} retry={m.console.billing.retry.cta} onRetry={() => void load()} />
        ) : !data ? (
          api ? <ReceiptsSkeleton /> : null
        ) : (
          <>
            <ModeBanner text={banner} />
            {cancelled ? <BillingNote>{m.console.billing.stepUp.cancelled}</BillingNote> : null}
            {rows.length === 0 ? (
              <p>{legacy ? r.older : r.empty}</p>
            ) : (
              <ReceiptsTable rows={rows} notes={notes} busyId={busyId} onView={(row) => void view(row)} />
            )}
            {rows.length >= RECEIPTS_PAGE_LIMIT ? <p className="hr-bill-line">{r.beyondLimit}</p> : null}
          </>
        )}
        {stepUp.dialog ? <StepUpDialog {...stepUp.dialog} /> : null}
      </div>
    </AdultFrame>
  );
}

export default function ReceiptsPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <ReceiptsInner />
    </Suspense>
  );
}
