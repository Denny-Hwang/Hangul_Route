'use client';

import { APP_ROUTES } from '@hangul-route/content-schema';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import LearnerReportPage from '@/app/(console)/teach/space/learner/page';
import { AdultFrame, type FrameSpaces } from '@/components/console/AdultFrame';
import { REPORT_CSS, ReportBack, ReportChooser, ReportSkeleton } from '@/components/console/ReportParts';
import { useConsole } from '@/components/console/use-console';
import { useVisibleRefresh } from '@/components/console/use-visible-refresh';
import type { RosterLearner, SpaceListItem } from '@/lib/console/api';
import { reportsEnabled } from '@/lib/console/config';
import { parentChooserFamilies, parentChooserRows, type ParentChooserRow } from '@/lib/console/report-chooser';
import { signedOutTarget } from '@/lib/console/signin-flow';

/**
 * `/parent/learner` (F-REPORT-001 RP-7c, section 3.1; F-APP-001 section 3.8): the family learner report. With a
 * `learner` it is the learner report page itself (the same component as `/teach/space/learner`; `ROUTES.learnerReport`
 * sends a family here). Without one it is the parent chooser (design `learner-report.md`, States): the learners of the
 * account's family spaces in the family home's order, never by a figure; exactly one learner opens that report
 * directly (`replace`, so Back skips the chooser). Ids only in every link; no learner name reaches the URL.
 */

/**
 * What the chooser draws: rows once the spaces and their rosters answered (`partial` when a roster read failed, so the
 * page says so and offers Try again), the failed read (the spaces, or every roster), or a signed-out answer.
 */
type ChooserLoad = { kind: 'rows'; rows: ParentChooserRow[]; partial: boolean } | { kind: 'failed' } | { kind: 'signedOut' } | null;

function ParentChooser(): JSX.Element {
  const router = useRouter();
  const { ready, session, api, signOut, m, locale } = useConsole();
  const enabled = reportsEnabled(locale);
  const [spaces, setSpaces] = useState<FrameSpaces>(null);
  const [load, setLoad] = useState<ChooserLoad>(null);
  const [nonce, setNonce] = useState(0);
  // Set by the read again when the tab comes back into view (F-LEARN-001 section 3.11): the drawn rows stay while it
  // reads, and only a complete answer replaces them.
  const quiet = useRef(false);

  useEffect(() => {
    if (!api || !enabled) return undefined;
    let live = true;
    const background = quiet.current;
    quiet.current = false;
    if (!background) {
      setLoad(null);
      setSpaces(null);
    }
    void (async () => {
      try {
        const listed = await api.listSpaces();
        if (!live) return;
        if (background && !listed.ok) return;
        if (!listed.ok) {
          setSpaces('failed');
          setLoad(listed.error === 'unauthorized' ? { kind: 'signedOut' } : { kind: 'failed' });
          return;
        }
        setSpaces(listed.data);
        const families = parentChooserFamilies(listed.data as readonly SpaceListItem[]);
        // One roster per family; a roster that fails leaves that family's learners out, never the others, and is said.
        const results = await Promise.all(families.map((item) => api.roster(item.space.id).then((r) => [item.space.id, r] as const)));
        if (!live) return;
        if (background && results.some(([, r]) => !r.ok)) return;
        if (results.some(([, r]) => !r.ok && r.error === 'unauthorized')) {
          setLoad({ kind: 'signedOut' });
          return;
        }
        const failed = results.filter(([, r]) => !r.ok).length;
        if (families.length > 0 && failed === families.length) {
          setLoad({ kind: 'failed' });
          return;
        }
        const rosters = new Map<string, readonly RosterLearner[]>(results.map(([id, r]) => [id, r.ok ? r.data.learners : []]));
        setLoad({ kind: 'rows', rows: parentChooserRows(families, rosters), partial: failed > 0 });
      } catch {
        // A read that throws in the client (not an API answer) falls back to the error and Try again, never the
        // skeleton forever.
        if (!live || background) return;
        setSpaces((current) => current ?? 'failed');
        setLoad({ kind: 'failed' });
      }
    })();
    return () => {
      live = false;
    };
  }, [api, enabled, nonce]);

  // The browser's title and history never hold a learner's name (section 3.10).
  const documentTitle = m.report.documentTitle;
  useEffect(() => {
    const before = document.title;
    document.title = documentTitle;
    return () => {
      document.title = before;
    };
  }, [documentTitle]);

  // Exactly one learner opens that report directly, unless a roster failed: the other family's learners may be missing.
  const only = load?.kind === 'rows' && !load.partial && load.rows.length === 1 ? load.rows[0]?.href : undefined;
  useEffect(() => {
    if (only) router.replace(only);
  }, [only, router]);
  const signedOut = load?.kind === 'signedOut';
  useEffect(() => {
    if (signedOut) router.replace(signedOutTarget(window.location.pathname, window.location.search));
  }, [signedOut, router]);

  // An open chooser shows a renamed learner without a reload.
  useVisibleRefresh(() => {
    quiet.current = true;
    setNonce((n) => n + 1);
  }, !!api && enabled);

  if (!ready || !session || only || signedOut) return <AdultFrame>{null}</AdultFrame>;

  const back = { href: APP_ROUTES.parentHome, text: m.report.back.home };
  const frame = (children: JSX.Element): JSX.Element => (
    <AdultFrame onSignOut={signOut} spaces={spaces}>
      <div className="hr-report" data-testid="learner-report">
        <style>{REPORT_CSS}</style>
        <ReportBack link={back} />
        {children}
      </div>
    </AdultFrame>
  );
  const state = (title: string, retry: string | null): JSX.Element =>
    frame(
      <div className="hr-report-state" data-testid="report-state">
        <h1 className="hr-report-state-title">{title}</h1>
        {retry ? (
          <button type="button" className="hr-report-link-button" onClick={() => setNonce((n) => n + 1)} data-testid="report-retry">
            {retry}
          </button>
        ) : null}
      </div>,
    );

  if (!enabled) return state(m.report.state.flagOff, null);
  if (load === null) return frame(<ReportSkeleton />);
  if (load.kind === 'failed') return state(m.report.state.error, m.common.buttons.tryAgain);
  if (load.rows.length === 0 && !load.partial) return state(m.report.state.unavailable, null);
  return frame(
    <>
      <ReportChooser title={m.report.chooser.learner} rows={load.rows} />
      {load.partial ? (
        <div className="hr-report-state" data-testid="report-state">
          <p data-testid="report-error-line">{m.report.state.error}</p>
          <button type="button" className="hr-report-link-button" onClick={() => setNonce((n) => n + 1)} data-testid="report-retry">
            {m.common.buttons.tryAgain}
          </button>
        </div>
      ) : null}
    </>,
  );
}

function ParentLearnerInner(): JSX.Element {
  const learner = useSearchParams()?.get('learner')?.trim() ?? '';
  return learner ? <LearnerReportPage /> : <ParentChooser />;
}

export default function ParentLearnerPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <ParentLearnerInner />
    </Suspense>
  );
}
