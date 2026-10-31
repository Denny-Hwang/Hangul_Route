'use client';

import type { ReportPeriod } from '@hangul-route/content-schema';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AdultFrame, type FrameSpaces } from '@/components/console/AdultFrame';
import {
  REPORT_CSS,
  REPORT_PANEL_ID,
  ReportActions,
  ReportBack,
  ReportBody,
  ReportControls,
  ReportGlanceBlock,
  ReportSkeleton,
  ReportStateBlock,
  ReportTitle,
  loadingTabs,
  reportTabId,
} from '@/components/console/ReportParts';
import { ReportScopeBlock } from '@/components/console/ReportScopeBlock';
import { useTransfersShown } from '@/components/console/TransferParts';
import { useGrownUpLocation } from '@/components/console/grown-up-location';
import { useConsole } from '@/components/console/use-console';
import { useVisibleRefresh } from '@/components/console/use-visible-refresh';
import type { ApiResult, LearnerReportBody, SpaceListItem } from '@/lib/console/api';
import { browseLinksShown } from '@/lib/console/browse-link';
import { learningRouteEnabled, notesEnabled, reportsEnabled } from '@/lib/console/config';
import { learningRouteView, type LearningRouteGoal } from '@/lib/console/learning-route-view';
import { reportNoteLink } from '@/lib/console/notes-page';
import { dateKey } from '@/lib/console/plans';
import { learnerReportView, reportBackLink, reportBrowseStage, reportCacheKey, reportQueryOf, reportScreenOf, type ReportStepButton, type ReportTab } from '@/lib/console/report-view';
import { spaceKindOfPath } from '@/lib/console/routing';
import { signedOutTarget } from '@/lib/console/signin-flow';
import { stageTitle } from '@/lib/console/stage-titles';

/**
 * One learner's report (F-REPORT-001 RP-7a2, sections 3.1, 3.5, 3.6, 3.12 and 3.14; screen spec
 * `design/screens/reports/learner-report.md`): `/teach/space/learner?id=<spaceId>&learner=<learnerId>&period=<p>`,
 * ids and codes only. A family opens it at `/parent/learner` (RP-7c), which renders this component when a learner is
 * named; `/teach/space/learner?id=<family>` and the `/parent/space/learner` twin still render it, so no link breaks.
 *
 * Who: anyone who can open the roster (`summary.read`), on every plan (no entitlement call, no price). Data: the
 * learner route (`getLearnerReport`, one learner's projected summary; the Worker records one `report.viewed` per call,
 * so each period or step refetches), the account's spaces once (the viewer's role decides the archived sentence and
 * the plan actions, `reportViewerRights`) and, with the Learning Route on, the roster and the plans once for the goal
 * line. Shown only while `reportsEnabled(locale)`; otherwise "Reports are not available yet." with the back link.
 *
 * Order (AMENDMENTS-GROWNUP-UX GX-13, T13): the back link, the `h1` with its glance, the status lines, then the
 * actions (Send a note, Print), then the tabs. A family report also reads the family's moves once (`transferRequests`
 * `options`, only while class moves are shown) for the learner's classes line; a skipped or failed read draws no line.
 *
 * Loading (design, decisions): the first load draws the heading, the tab row disabled and a busy panel; a later period
 * or step keeps the cached report's controls enabled and marks only the panel busy, so focus stays on the control
 * that was used. A failed later load keeps the cached report with the error as a state line.
 */

/** The last report each account loaded per learner in this tab: a period, a step or a failed retry reuses it. */
const REPORT_CACHE = new Map<string, LearnerReportBody>();

function LearnerReportInner(): JSX.Element {
  const params = useSearchParams();
  const query = reportQueryOf(params);
  const { spaceId, learnerId, period, at } = query;
  const router = useRouter();
  const { ready, session, api, signOut, m, locale } = useConsole();
  const enabled = reportsEnabled(locale);
  const accountId = session?.accountId ?? '';
  const key = reportCacheKey(accountId, spaceId, learnerId);
  // The `/parent/space/learner` twin: with no space known yet, its back link goes to the parent console home.
  const routed = useGrownUpLocation();
  const pageKind = spaceKindOfPath(routed?.pathname ?? (typeof window === 'undefined' ? '' : window.location.pathname));

  // The answer to the newest load, with the address it answers: an answer for another period or window never draws.
  const [load, setLoad] = useState<{ key: string; period: ReportPeriod; at: string | null; result: ApiResult<LearnerReportBody> } | null>(null);
  const [spaces, setSpaces] = useState<FrameSpaces>(null);
  const [goal, setGoal] = useState<LearningRouteGoal | null>(null);
  const [nonce, setNonce] = useState(0);
  const [changed, setChanged] = useState(false);
  // Only the newest load may draw: an answer to an older address or an earlier Try again is dropped.
  const latest = useRef(0);
  const prev = useRef<HTMLButtonElement | null>(null);
  const next = useRef<HTMLButtonElement | null>(null);
  const stepped = useRef<'prev' | 'next' | null>(null);
  // Set by the read again when the tab comes back into view (F-LEARN-001 section 3.11): that read keeps the drawn report
  // (no busy panel), and a failed one changes nothing.
  const quiet = useRef(false);

  useEffect(() => {
    if (!api || !enabled || !spaceId || !learnerId) return;
    const call = ++latest.current;
    const background = quiet.current;
    quiet.current = false;
    if (!background) setLoad(null);
    void (background ? api.getLearnerReport(spaceId, learnerId, period, { refresh: true }) : api.getLearnerReport(spaceId, learnerId, period)).then((result) => {
      if (call !== latest.current) return;
      if (background && !result.ok) return;
      if (result.ok) REPORT_CACHE.set(key, result.data);
      setLoad({ key, period, at, result });
    });
    // `nonce` is not read here, but each Try again is a new view (one `report.viewed`), as each step is.
  }, [api, enabled, spaceId, learnerId, period, at, nonce, key]);

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
  }, [api]);

  // The classes line (GX-13): a family report only, from the family's transfer options. Keyed by space and learner, so
  // a line never outlives the learner it names; a failed read, an unknown shape or switched-off moves leave it out.
  const movesShown = useTransfersShown();
  // The space of the last answer, or the cached one while a period or a step reloads (no second read per step).
  const loadedSpace = (load !== null && load.key === key && load.result.ok ? load.result.data.space : null) ?? REPORT_CACHE.get(key)?.space ?? null;
  const familyId = loadedSpace?.kind === 'family' ? loadedSpace.id : null;
  const [classes, setClasses] = useState<{ key: string; names: string[] } | null>(null);
  useEffect(() => {
    if (!api || !enabled || !movesShown || familyId === null || !learnerId) return undefined;
    let live = true;
    const at = `${familyId}|${learnerId}`;
    void api.transferRequests(familyId).then(
      (result) => {
        if (!live || !result.ok) return;
        const option = Array.isArray(result.data.options) ? result.data.options.find((o) => o.learnerId === learnerId) : undefined;
        if (option) setClasses({ key: at, names: option.classes.map((c) => c.name) });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [api, enabled, movesShown, familyId, learnerId]);

  // Browse links (RP-13): read after mount, so the static export and the first client render agree (both draw none).
  const [browseOn, setBrowseOn] = useState(false);
  useEffect(() => {
    setBrowseOn(typeof window !== 'undefined' && browseLinksShown(window.location.origin));
  }, []);

  const routeOn = learningRouteEnabled();
  useEffect(() => {
    // The goal belongs to one space and learner: it never outlives them, and a failed read draws none.
    setGoal(null);
    if (!api || !enabled || !routeOn || !spaceId || !learnerId) return undefined;
    let live = true;
    void Promise.all([api.roster(spaceId), api.listPlans(spaceId)]).then(([roster, plans]) => {
      if (!live || !roster.ok || !plans.ok) return;
      const lr = learningRouteView({ space: roster.data.space, learners: roster.data.learners, learnerId, plans: plans.data, today: dateKey(new Date()), stageTitle, locale });
      setGoal(lr?.status === 'ready' ? lr.card.goal : null);
    });
    return () => {
      live = false;
    };
  }, [api, enabled, routeOn, spaceId, learnerId, locale]);

  // The browser's title and history never hold the learner's name (section 3.10).
  const documentTitle = m.report.documentTitle;
  useEffect(() => {
    const before = document.title;
    document.title = documentTitle;
    return () => {
      document.title = before;
    };
  }, [documentTitle]);

  const current = load !== null && load.key === key && load.period === period && load.at === at ? load.result : null;
  const screen = reportScreenOf({ enabled, query, load: current, cached: REPORT_CACHE.get(key) ?? null, locale, pageKind });

  useEffect(() => {
    if (screen.kind === 'signedOut') router.replace(signedOutTarget(window.location.pathname, window.location.search));
  }, [screen.kind, router]);

  // When a step removes the focused button (Next on the current window, Previous on the oldest), focus moves to the
  // other step button, never to the page body.
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
  // An open report shows a renamed learner and the newest practice without a reload. The read again is marked as a
  // background read (`refresh`), so the Worker records no further `report.viewed` for it.
  useVisibleRefresh(() => {
    quiet.current = true;
    setNonce((n) => n + 1);
  }, !!api && enabled && !!spaceId && !!learnerId);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const role = Array.isArray(spaces) ? ((spaces as readonly SpaceListItem[]).find((item) => item.space.id === spaceId)?.role ?? null) : null;
  // Until the spaces answer, the role is unknown: neither the archived sentence nor a plan action is drawn, so the owner's
  // settings sentence never replaces the neutral one and no action pops in late. A failed read keeps the neutral sentence.
  const roleKnown = spaces !== null;
  const frame = (children: JSX.Element): JSX.Element => (
    <AdultFrame onSignOut={signOut} spaces={spaces}>
      <div className="hr-report" data-testid="learner-report">
        <style>{REPORT_CSS}</style>
        {children}
      </div>
    </AdultFrame>
  );

  if (screen.kind === 'signedOut') return <AdultFrame>{null}</AdultFrame>;

  if (screen.kind === 'state') {
    // No learner name is known: the state sentence is the page's h1 (design, States).
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

  const status = (busy: boolean, failed: string | null = null): JSX.Element => (
    // The busy line sits right before the panel, its sibling, never inside the busy subtree (design, decisions). A later
    // load that failed is announced here too, so the viewer who pressed a tab or a step hears why nothing changed.
    <p className="hr-report-hidden" role="status" data-testid="report-status">
      {busy ? m.a11y.report.loading : (failed ?? '')}
    </p>
  );

  if (screen.kind === 'loading') {
    return frame(
      <>
        <div className="hr-report-actions">
          <ReportBack link={screen.back} />
        </div>
        <ReportTitle title={null} avatar={null} />
        <ReportActions printDisabled onPrint={() => undefined} />
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

  const classNames = movesShown && classes !== null && classes.key === `${screen.data.space.id}|${screen.data.learner.id}` ? classes.names : null;
  const view = learnerReportView({ data: screen.data, query, now: new Date(), role, stageTitle, learningRoute: routeOn, goal, classes: classNames, locale });
  if (view === null) {
    // A space kind with no learner report (a school): the same words as any report this viewer cannot open.
    return frame(
      <>
        <ReportBack link={reportBackLink(query.from, null, locale, pageKind)} />
        <div className="hr-report-state" data-testid="report-state">
          <h1 className="hr-report-state-title">{m.report.state.unavailable}</h1>
        </div>
      </>,
    );
  }

  const { busy, error } = screen;
  // Send a note (F-FEEDBACK-001 FB-11b; F-REPORT-001 section 3.6): the header, by flag, role and an open space.
  const noteLink = reportNoteLink({
    enabled: notesEnabled(),
    archived: screen.data.space.archivedAt !== null,
    role,
    kind: screen.data.space.kind,
    spaceId: screen.data.space.id,
    learnerId: screen.data.learner.id,
  });
  const lines = [...(view.archived && roleKnown ? [view.archived] : []), ...view.notices];
  const selected = view.tabs?.find((tab) => tab.selected)?.period ?? period;
  const body = busy ? (
    <ReportSkeleton />
  ) : (
    <>
      <ReportBody view={view} browse={browseOn ? { stage: reportBrowseStage(screen.data.summary) } : null} />
      {/* [TV] Words and Settings at full scope, the reason they are missing at base scope (TV-D2, TV-D12). */}
      <ReportScopeBlock data={screen.data} />
    </>
  );
  return frame(
    <>
      {/* Screen only, like the actions: the printed report starts at its h1 (RP-7b). */}
      <div className="hr-report-actions">
        <ReportBack link={view.back} />
      </div>
      <div className="hr-report-glance">
        <ReportTitle title={view.title} avatar={screen.data.learner.avatar} />
        {view.glance ? <ReportGlanceBlock glance={view.glance} /> : null}
      </div>
      <ReportStateBlock lines={lines} error={error} onRetry={retry} />
      <ReportActions printDisabled={busy || error !== null} onPrint={() => window.print()} sendNote={noteLink} />
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
          {status(busy, error?.message ?? null)}
          <div
            className="hr-report-panel"
            role="tabpanel"
            id={REPORT_PANEL_ID}
            aria-labelledby={reportTabId(selected)}
            aria-busy={busy ? 'true' : undefined}
            data-testid="report-panel"
          >
            {body}
          </div>
        </>
      ) : (
        <>
          {status(busy, error?.message ?? null)}
          <div className="hr-report-panel" aria-busy={busy ? 'true' : undefined} data-testid="report-panel">
            {body}
          </div>
        </>
      )}
      {/* Shown on paper only (RP-7b): "Private: shared from Hangul Route on {date}." at the foot of every printed page. */}
      <p className="hr-report-print-footer" data-testid="report-print-footer">
        {view.printFooter}
      </p>
    </>,
  );
}

export default function LearnerReportPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <LearnerReportInner />
    </Suspense>
  );
}
