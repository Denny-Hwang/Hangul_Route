'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { LearningRouteContent, LearningRouteLoading, readingColumn } from '@/components/console/LearningRouteParts';
import { Button, panelStyle } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConsole } from '@/components/console/use-console';
import { useGrownUpLocation } from '@/components/console/grown-up-location';
import type { PlanView, Roster } from '@/lib/console/api';
import { learningRouteEnabled } from '@/lib/console/config';
import { learningRouteView } from '@/lib/console/learning-route-view';
import { dateKey } from '@/lib/console/plans';
import { ROUTES, type SpaceError, spaceErrorText, spaceIdFrom, spaceKindOfPath } from '@/lib/console/routing';
import { stageTitle } from '@/lib/console/stage-titles';

/**
 * One learner's Learning Route in the adult shell (AMENDMENTS-ROUTE-LEARNING-ROUTE section 6.1,
 * LR-8; wireframes `console/learning-route.md` T3 and `parent/learning-route.md` L2; screen spec
 * `design/screens/learning-route/stage-list.md`): `/teach/space/route?id=<spaceId>&learner=<learnerId>`,
 * ids only. A family opens it here too until F-APP-001 A-5b adds the `/parent/space/route` twin,
 * which re-exports this component.
 *
 * Who: anyone who can open the roster (`summary.read`), on free and paid accounts alike (LR-OD-9).
 * Data: the roster and the space's plans, the two reads the roster page already makes; no new
 * endpoint, no `payload_json`, no entitlements read. Read-only: no write and no telemetry. Shown only
 * while `learningRouteEnabled()` is on; off, the address goes back to the space page.
 */
function LearningRouteInner(): JSX.Element {
  const params = useSearchParams();
  const spaceId = spaceIdFrom(params);
  const learnerId = params?.get('learner')?.trim() ?? '';
  const router = useRouter();
  const { ready, session, api, signOut, m, locale } = useConsole();
  const enabled = learningRouteEnabled();
  const [data, setData] = useState<{ roster: Roster; plans: PlanView[] } | null>(null);
  // A key, not text: the words are looked up at render time, so they follow the header language select.
  const [error, setError] = useState<SpaceError | null>(null);
  // Only the newest load may draw: an answer to an older address or an earlier Try again is dropped.
  const latest = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    if (!api || !enabled) return;
    const call = ++latest.current;
    setError(null);
    setData(null);
    const [roster, plans] = await Promise.all([api.roster(spaceId), api.listPlans(spaceId)]);
    if (call !== latest.current) return;
    if (!roster.ok) {
      setError(roster.error === 'forbidden' ? 'forbidden' : roster.error === 'not_found' ? 'gone' : 'cantReach');
      return;
    }
    // Without the plans the card could miss a live weekly plan and name the wrong goal: say so instead.
    if (!plans.ok) {
      setError('cantReach');
      return;
    }
    setData({ roster: roster.data, plans: plans.data });
  }, [api, enabled, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const view = data
    ? learningRouteView({
        space: data.roster.space,
        learners: data.roster.learners,
        learnerId,
        plans: data.plans,
        today: dateKey(new Date()),
        stageTitle,
        locale,
      })
    : null;
  // A space with no roster view (a school, or a kind this bundle does not know) is the space page's to draw.
  const away = !enabled || (data !== null && view === null);

  // The kind the roster names, or the one the page's prefix tells before it arrives (a family under /parent/space).
  const routed = useGrownUpLocation();
  const pathKind = spaceKindOfPath(routed?.pathname ?? (typeof window === 'undefined' ? '' : window.location.pathname));
  const kind = data?.roster.space.kind ?? pathKind;
  const home = kind === 'family' ? ROUTES.parentHome : ROUTES.home;
  useEffect(() => {
    if (away) router.replace(spaceId ? ROUTES.space(spaceId, kind) : home);
  }, [away, router, spaceId, kind, home]);

  if (away || !ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const lr = m.console.learningRoute;
  // Before the roster names the space's kind (loading, or a read that failed): the kind-neutral "Back" to the space,
  // or the console home when the address names no space.
  const back = spaceId ? { href: ROUTES.space(spaceId, kind), text: lr.back.space } : { href: home, text: m.console.shell.home };
  // PageBack (AMENDMENTS-DISPLAY-NAV section 7.3): the report, the class or the family once the view says which.
  const pageBack = view ? view.back : back;
  return (
    <AdultFrame onSignOut={signOut} title={lr.section} back={{ href: pageBack.href, label: pageBack.text }}>
      {error ? (
        <div style={readingColumn}>
          <div style={panelStyle}>
            <p style={{ margin: 0 }}>{spaceErrorText(error, locale)}</p>
            {/* Only a read that did not arrive can succeed on a retry; a 403 or a 404 will answer the same. */}
            {error === 'cantReach' ? <Button onClick={() => void load()}>{m.console.tryAgain}</Button> : null}
          </div>
        </div>
      ) : view ? (
        <LearningRouteContent view={view} />
      ) : (
        <LearningRouteLoading />
      )}
    </AdultFrame>
  );
}

export default function LearningRoutePage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <LearningRouteInner />
    </Suspense>
  );
}
