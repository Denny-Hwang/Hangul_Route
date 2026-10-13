'use client';

import type { ReportPeriod } from '@hangul-route/content-schema';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AdultFrame, type FrameSpaces } from '@/components/console/AdultFrame';
import { CLASS_REPORT_CSS, ClassChooser, ClassReportContent } from '@/components/console/ClassReportParts';
import { REPORT_CSS, REPORT_PANEL_ID, ReportBack, ReportControls, ReportHeader, ReportSkeleton, ReportStateBlock, loadingTabs, reportTabId } from '@/components/console/ReportParts';
import { useConsole } from '@/components/console/use-console';
import type { ApiResult, ClassReportBody, SpaceListItem } from '@/lib/console/api';
import { classChooserRows, classReportScreenOf, classReportView } from '@/lib/console/class-report-view';
import { lectureModeEnabled, reportsEnabled } from '@/lib/console/config';
import { reportBackLink, reportCacheKey, reportQueryOf, type ReportStepButton, type ReportTab } from '@/lib/console/report-view';
import { signedOutTarget } from '@/lib/console/signin-flow';
import { stageTitle } from '@/lib/console/stage-titles';

/**
 * One class's statistics (F-REPORT-001 RP-8, sections 3.1, 3.7 and 3.14; screen spec
 * `design/screens/reports/class-report.md`): `/teach/space/report?id=<classId>&period=<p>&at=<day>`, the class id and
 * codes only. Without an id it is the class chooser (one class opens its report directly). Aggregates only: no learner
 * id, name or per-learner row ever reaches the page; a family space has no class report (the Worker answers 409).
 *
 * Who: a class's teacher or owner, or a school admin over it (`summary.read`), on every plan. Data: the class route
 * (`getClassReport`; the Worker records one `report.viewed` per call, so each period or step refetches) and the
 * account's spaces once (the role, the chooser, the frame). Shown only while `reportsEnabled(locale)`. Loading, focus
 * and the cached-error rule are the learner report's (RP-7a2).
 */

/**
 * The last class report each account loaded per class in this tab, with the window it was loaded for: the cached-error
 * rule keeps it on screen only for that same period and window (the Worker computes the figures for one window).
 */
const CLASS_CACHE = new Map<string, { period: ReportPeriod; at: string | null; data: ClassReportBody }>();

function ClassReportInner(): JSX.Element {
  const params = useSearchParams();
  const { spaceId, period, at } = reportQueryOf(params);
  const router = useRouter();
  const { ready, session, api, signOut, m, locale } = useConsole();
  const enabled = reportsEnabled(locale);
  const key = reportCacheKey(session?.accountId ?? '', spaceId, '');

  const [load, setLoad] = useState<{ key: string; period: ReportPeriod; at: string | null; result: ApiResult<ClassReportBody> } | null>(null);
  const [spaces, setSpaces] = useState<FrameSpaces>(null);
  const [nonce, setNonce] = useState(0);
  const [spacesNonce, setSpacesNonce] = useState(0);
  const [changed, setChanged] = useState(false);
  const latest = useRef(0);
  const prev = useRef<HTMLButtonElement | null>(null);
  const next = useRef<HTMLButtonElement | null>(null);
  const stepped = useRef<'prev' | 'next' | null>(null);

  useEffect(() => {
    if (!api || !enabled || !spaceId) return;
    const call = ++latest.current;
    setLoad(null);
    void api.getClassReport(spaceId, period, at).then((result) => {
      if (call !== latest.current) return;
      if (result.ok) CLASS_CACHE.set(key, { period, at, data: result.data });
      setLoad({ key, period, at, result });
    });
    // `nonce` is not read here, but each Try again is a new view (one `report.viewed`), as each step is.
  }, [api, enabled, spaceId, period, at, nonce, key]);

  useEffect(() => {
    if (!api) return undefined;
    let live = true;
    void api.listSpaces().then(
      (result) => live && setSpaces(result.ok ? result.data : 'failed'),
      () => live && setSpaces('failed'),
    );
    return () => {
      live = false;
    };
    // `spacesNonce` is not read here: each Try again on the chooser reads the spaces again.
  }, [api, spacesNonce]);

  const documentTitle = m.report.documentTitle;
  useEffect(() => {
    const before = document.title;
    document.title = documentTitle;
    return () => {
      document.title = before;
    };
  }, [documentTitle]);

  const current = load !== null && load.key === key && load.period === period && load.at === at ? load.result : null;
  const entry = CLASS_CACHE.get(key) ?? null;
  const screen = classReportScreenOf({ enabled, spaceId, load: current, cached: entry?.data ?? null, cachedWindow: entry !== null && entry.period === period && entry.at === at, locale });
  const list = Array.isArray(spaces) ? (spaces as readonly SpaceListItem[]) : null;
  const chooserRows = screen.kind === 'chooser' && list ? classChooserRows(list) : null;
  const only = chooserRows?.length === 1 ? chooserRows[0]?.href : undefined;

  useEffect(() => {
    if (screen.kind === 'signedOut') router.replace(signedOutTarget(window.location.pathname, window.location.search));
  }, [screen.kind, router]);

  // Exactly one class: its report opens directly (section 3.1).
  useEffect(() => {
    if (only) router.replace(only);
  }, [only, router]);

  useEffect(() => {
    const which = stepped.current;
    stepped.current = null;
    if (which === null) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    (which === 'next' ? prev.current : next.current)?.focus();
  }, [period, at]);

  const select = useCallback(
    (tab: ReportTab): void => {
      if (tab.selected) return;
      stepped.current = null;
      setChanged(true);
      router.push(tab.href, { scroll: false });
    },
    [router],
  );
  const step = useCallback(
    (which: 'prev' | 'next', button: ReportStepButton): void => {
      stepped.current = which;
      setChanged(true);
      router.push(button.href, { scroll: false });
    },
    [router],
  );
  const retry = (): void => setNonce((n) => n + 1);

  if (!ready || !session || screen.kind === 'signedOut' || only) return <AdultFrame>{null}</AdultFrame>;

  const role = list?.find((item) => item.space.id === spaceId)?.role ?? null;
  // Until the spaces answer, the role is unknown: no archived sentence is drawn (and no Plan a lesson, as `role` is null),
  // so the owner's settings sentence never replaces the neutral one late. A failed read keeps the neutral sentence.
  const roleKnown = spaces !== null;
  const frame = (children: JSX.Element): JSX.Element => (
    <AdultFrame onSignOut={signOut} spaces={spaces}>
      <div className="hr-report" data-testid="class-report">
        <style>{REPORT_CSS + CLASS_REPORT_CSS}</style>
        {children}
      </div>
    </AdultFrame>
  );

  if (screen.kind === 'chooser') {
    if (chooserRows === null && spaces === null) return frame(<ReportSkeleton />);
    if (spaces === 'failed') {
      const again = (): void => {
        setSpaces(null);
        setSpacesNonce((n) => n + 1);
      };
      return frame(
        <>
          <ReportBack link={reportBackLink(null, null, locale)} />
          <div className="hr-report-state" data-testid="report-state">
            <h1 className="hr-report-state-title">{m.report.state.error}</h1>
            <button type="button" className="hr-report-link-button" onClick={again} data-testid="report-retry">
              {m.common.buttons.tryAgain}
            </button>
          </div>
        </>,
      );
    }
    const rows = chooserRows ?? [];
    if (rows.length === 0) {
      return frame(
        <>
          <ReportBack link={reportBackLink(null, null, locale)} />
          <div className="hr-report-state" data-testid="report-state">
            <h1 className="hr-report-state-title">{m.report.state.unavailable}</h1>
          </div>
        </>,
      );
    }
    return frame(<ClassChooser title={m.report.chooser.class} rows={rows} />);
  }

  if (screen.kind === 'state') {
    return frame(
      <>
        <ReportBack link={screen.back} />
        <div className="hr-report-state" data-testid="report-state">
          <h1 className="hr-report-state-title">{screen.title}</h1>
          {screen.retry ? (
            <button type="button" className="hr-report-link-button" onClick={retry} data-testid="report-retry">
              {screen.retry}
            </button>
          ) : null}
        </div>
      </>,
    );
  }

  const status = (busy: boolean): JSX.Element => (
    <p className="hr-report-hidden" role="status" data-testid="report-status">
      {busy ? m.a11y.report.loading : ''}
    </p>
  );

  if (screen.kind === 'loading') {
    return frame(
      <>
        <ReportHeader back={screen.back} printDisabled onPrint={() => undefined} />
        <h1 className="hr-report-title">
          <span className="hr-report-skeleton-title" aria-hidden="true" />
          <span className="hr-report-hidden">{documentTitle}</span>
        </h1>
        <ReportControls
          tabs={loadingTabs(period, m.report.period)}
          tabsLabel={m.a11y.report.periods}
          stepper={null}
          disabled
          onSelect={() => undefined}
          onStep={() => undefined}
          prevRef={() => undefined}
          nextRef={() => undefined}
          announce=""
        />
        {status(true)}
        <div className="hr-report-panel" role="tabpanel" id={REPORT_PANEL_ID} aria-labelledby={reportTabId(period)} aria-busy="true" data-testid="report-panel">
          <ReportSkeleton />
        </div>
      </>,
    );
  }

  const { busy, error } = screen;
  const view = classReportView({ data: screen.data, query: { period, at }, now: new Date(), role, lecture: lectureModeEnabled(), stageTitle, locale });
  const selected = view.tabs?.find((tab) => tab.selected)?.period ?? period;
  return frame(
    <>
      {/* An empty class has nothing to print: the back link alone goes to the roster, where the join code is. */}
      {view.empty ? <ReportBack link={view.back} /> : <ReportHeader back={view.back} printDisabled={busy || error !== null} onPrint={() => window.print()} />}
      <div className="hr-report-glance">
        <h1 className="hr-report-title">{view.title}</h1>
        {view.classLines.map((line) => (
          <p key={line} className="hr-class-line">
            {line}
          </p>
        ))}
      </div>
      <ReportStateBlock lines={[...(view.archived && roleKnown ? [view.archived] : []), ...(view.empty ? [view.empty] : [])]} error={error} onRetry={retry} />
      {view.tabs ? (
        <>
          <ReportControls
            tabs={view.tabs}
            tabsLabel={view.tabsLabel}
            stepper={view.stepper}
            disabled={false}
            onSelect={select}
            onStep={step}
            prevRef={(node) => {
              prev.current = node;
            }}
            nextRef={(node) => {
              next.current = node;
            }}
            announce={changed && !busy && view.announce ? view.announce : ''}
          />
          {status(busy)}
          <div className="hr-report-panel" role="tabpanel" id={REPORT_PANEL_ID} aria-labelledby={reportTabId(selected)} aria-busy={busy ? 'true' : undefined} data-testid="report-panel">
            {busy ? <ReportSkeleton /> : <ClassReportContent view={view} />}
          </div>
        </>
      ) : null}
      {view.empty ? null : (
        <p className="hr-report-print-footer" data-testid="report-print-footer">
          {view.printFooter}
        </p>
      )}
    </>,
  );
}

export default function ClassReportPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <ClassReportInner />
    </Suspense>
  );
}
