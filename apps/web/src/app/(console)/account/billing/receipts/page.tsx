'use client';

import { APP_ROUTES, RECEIPTS_PAGE_LIMIT, type BillingSummary } from '@hangul-route/content-schema';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdultFrame } from '@/components/console/AdultFrame';
import { BackToBilling, BillingNote, BillingStyles, FailPanel, ModeBanner, ReceiptsSkeleton, ReceiptsTable } from '@/components/console/BillingHomeParts';
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
 * asks `POST /api/billing/receipt-link` for a fresh Stripe link behind step-up, and sends the tab there. No Stripe id
 * or URL is ever on this page or in its address; a failed lookup closes the tab and says so on that row.
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
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
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

  const markFailed = (id: string, on: boolean): void =>
    setFailed((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const view = async (row: ReceiptRowView): Promise<void> => {
    if (!api) return;
    // Inside the tap, before any await: a tab opened later would be blocked as a pop-up.
    const tab = window.open('', '_blank') as ReceiptTab | null;
    if (tab) tab.opener = null;
    setBusyId(row.id);
    setCancelled(false);
    markFailed(row.id, false);
    const step = await stepUp.run(() => api.receiptLink(row.id));
    setBusyId(null);
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
      // The blank tab was blocked: one more try now that the link is here; if that is blocked too, say so.
      if (window.open(url, '_blank', 'noopener,noreferrer')) return;
      markFailed(row.id, true);
      return;
    }
    tab?.close();
    markFailed(row.id, true);
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
              <ReceiptsTable rows={rows} failed={failed} busyId={busyId} onView={(row) => void view(row)} />
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
