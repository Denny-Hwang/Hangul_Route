'use client';

import { APP_ROUTES } from '@hangul-route/content-schema';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import LearnerReportPage from '@/app/(console)/teach/space/learner/page';
import { AdultFrame, type FrameSpaces } from '@/components/console/AdultFrame';
import { REPORT_CSS, ReportBack, ReportChooser, ReportSkeleton } from '@/components/console/ReportParts';
import { useConsole } from '@/components/console/use-console';
import type { RosterLearner, SpaceListItem } from '@/lib/console/api';
import { reportsEnabled } from '@/lib/console/config';
import { parentChooserFamilies, parentChooserRows, type ParentChooserRow } from '@/lib/console/report-chooser';

/**
 * `/parent/learner` (F-REPORT-001 RP-7c, section 3.1; F-APP-001 section 3.8): the family learner report. With a
 * `learner` it is the learner report page itself (the same component as `/teach/space/learner`; `ROUTES.learnerReport`
 * sends a family here). Without one it is the parent chooser (design `learner-report.md`, States): the learners of the
 * account's family spaces in the family home's order, never by a figure; exactly one learner opens that report
 * directly (`replace`, so Back skips the chooser). Ids only in every link; no learner name reaches the URL.
 */

/** What the chooser draws: rows once the spaces and their rosters answered, or the failed spaces read. */
type ChooserLoad = { kind: 'rows'; rows: ParentChooserRow[] } | { kind: 'failed' } | null;

function ParentChooser(): JSX.Element {
  const router = useRouter();
  const { ready, session, api, signOut, m, locale } = useConsole();
  const enabled = reportsEnabled(locale);
  const [spaces, setSpaces] = useState<FrameSpaces>(null);
  const [load, setLoad] = useState<ChooserLoad>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!api || !enabled) return undefined;
    let live = true;
    setLoad(null);
    setSpaces(null);
    void (async () => {
      const listed = await api.listSpaces();
      if (!live) return;
      if (!listed.ok) {
        setSpaces('failed');
        setLoad({ kind: 'failed' });
        return;
      }
      setSpaces(listed.data);
      const families = parentChooserFamilies(listed.data as readonly SpaceListItem[]);
      // One roster per family; a roster that fails leaves that family's learners out, never the others.
      const rosters = await Promise.all(families.map((item) => api.roster(item.space.id).then((r) => [item.space.id, r.ok ? r.data.learners : []] as const)));
      if (!live) return;
      setLoad({ kind: 'rows', rows: parentChooserRows(families, new Map<string, readonly RosterLearner[]>(rosters)) });
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

  const only = load?.kind === 'rows' && load.rows.length === 1 ? load.rows[0]?.href : undefined;
  useEffect(() => {
    if (only) router.replace(only);
  }, [only, router]);

  if (!ready || !session || only) return <AdultFrame>{null}</AdultFrame>;

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
  if (load.rows.length === 0) return state(m.report.state.unavailable, null);
  return frame(<ReportChooser title={m.report.chooser.learner} rows={load.rows} />);
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
