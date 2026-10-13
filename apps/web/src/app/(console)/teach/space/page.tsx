'use client';

import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Button, Muted, Notice, panelStyle } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { AvatarChip } from '@/components/AvatarChip';
import { SchoolAdmin } from '@/components/console/SchoolAdmin';
import { StartingSpot } from '@/components/console/PlacementParts';
import { JourneyStrip } from '@/components/console/JourneyParts';
import { FreeLessonsLine } from '@/components/console/FreeLessonsParts';
import { ClassGoalLineView } from '@/components/console/ClassGoalParts';
import { StudentWordsLines, WeekWordsRevisit } from '@/components/console/VocabWordsParts';
import { useConsole } from '@/components/console/use-console';
import type { PlanView, Roster, SpaceListItem } from '@/lib/console/api';
import { contentGatingEnabled, lectureModeEnabled } from '@/lib/console/config';
import { canComposeIn } from '@/lib/console/lecture';
import { levelPillLabel } from '@/lib/console/level-label';
import { capState, classRollup, codeExpiry, percent, relativeDay } from '@/lib/console/rollup';
import { ownRouteLine, readoutLine as routeReadoutLine, spaceCoverage, type SpaceCoverage } from '@/lib/console/curriculum';
import { rosterFreeLessonsLine } from '@/lib/console/free-lessons-line-view';
import { classGoalLine } from '@/lib/console/class-goal-line';
import { stageTitle } from '@/lib/console/stage-titles';
import { dateKey, livePublished, planReaches, planReadout, readoutLine, rosterPlan } from '@/lib/console/plans';
import { ROUTES, type SpaceError, spaceErrorText, spaceIdFrom } from '@/lib/console/routing';
import { consoleWords, studentWords } from '@/lib/console/vocab-words';
import { aroundSlot } from '@/lib/i18n/slot';

/** console/roster — F-CONSOLE-001 §3.5. Summaries only; the API never sends payloads here. */
function SpaceInner(): JSX.Element {
  const spaceId = spaceIdFrom(useSearchParams());
  const { ready, session, api, signOut, m, locale } = useConsole();
  const c = m.console;
  const [roster, setRoster] = useState<Roster | null>(null);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [pendingRelinks, setPendingRelinks] = useState(0);
  // Lecture mode's entry points show for the roles that compose plans (F-TCH-004 §3.11); the free-lessons line for the owner (F-ENT-003 §3.9.2).
  const [spaces, setSpaces] = useState<SpaceListItem[] | null>(null);
  // Whether a Family Plan or Group License covers this space, as far as this viewer can tell (the free-lessons line never guesses).
  const [coverage, setCoverage] = useState<SpaceCoverage>('unknown');
  // A key, not text: the message is looked up at render time, so it follows the header language select.
  const [error, setError] = useState<SpaceError | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const now = new Date();

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(null);
    setCoverage('unknown');
    // The free-plan switch (F-ENT-003 §3.4): only with it on does the roster read the role and the entitlements for the free-lessons line.
    const gating = contentGatingEnabled();
    const [result, planList, relinks, spaceList, entitlements] = await Promise.all([
      api.roster(spaceId),
      api.listPlans(spaceId),
      api.relinkRequests(spaceId),
      lectureModeEnabled() || gating ? api.listSpaces() : null,
      gating ? api.entitlements() : null,
    ]);
    if (spaceList?.ok) setSpaces(spaceList.data);
    if (gating && result.ok) setCoverage(spaceCoverage(entitlements?.ok ? entitlements.data : null, spaceList?.ok ? spaceList.data : null, result.data.space, new Date()));
    if (planList.ok) setPlans(planList.data);
    if (relinks.ok) setPendingRelinks(relinks.data.length);
    if (result.ok) setRoster(result.data);
    else setError(result.error === 'forbidden' ? 'forbidden' : result.error === 'not_found' ? 'gone' : 'cantReach');
  }, [api, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;
  // School spaces get the admin view (F-SCHOOL-001 §3.3); classes and families the roster.
  if (roster?.space.kind === 'school' && api) return <SchoolAdmin api={api} spaceId={spaceId} onSignOut={signOut} />;

  const regenerate = async (): Promise<void> => {
    if (!api || !roster) return;
    if (roster.joinCode && !window.confirm(`${c.space.regenerateAsk(roster.space.name)} ${c.oldCodeStops}`)) return;
    setBusy(true);
    const result = await api.regenerateCode(spaceId);
    setBusy(false);
    if (result.ok) setRoster({ ...roster, joinCode: result.data.joinCode, joinCodeExpiresAt: result.data.expiresAt });
    else setError('regenerateFailed');
  };

  const copy = async (): Promise<void> => {
    if (!roster?.joinCode) return;
    try {
      await navigator.clipboard.writeText(roster.joinCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const rollup = roster ? classRollup(roster.learners, now) : null;
  const cap = roster ? capState(roster.space.kind, roster.learners.length) : null;
  const empty = roster !== null && roster.learners.length === 0;
  // The newest plan for everyone: a plan for one learner (a suggested start) never takes over the roster.
  const latestPlan = rosterPlan(plans);
  const lecture = lectureModeEnabled() && canComposeIn(spaces, spaceId);
  const readout = latestPlan && roster ? new Map(planReadout(latestPlan.id, roster.learners).map((r) => [r.learnerId, r])) : null;
  // Taught jamo stay outside the message (§3.4 rule 5): the sentence is split around them and the page marks them Korean.
  const weekRevisit = aroundSlot(c.space.week.revisit);
  const learnerRevisit = aroundSlot(c.space.learner.revisit);
  const jamo = (items: readonly string[]): JSX.Element => <span lang="ko">{items.join(' · ')}</span>;
  const gating = contentGatingEnabled();
  const role = spaces?.find((item) => item.space.id === spaceId)?.role ?? null;
  const livePlans = gating ? livePublished(plans) : [];
  const today = dateKey(now);
  // One line about the newest live whole-class plan (Learning Route section 6.3, LR-9); a class only, never about learners.
  const goalLine = roster ? classGoalLine({ kind: roster.space.kind, plans, today, stageTitle, locale }) : null;

  return (
    <AdultFrame onSignOut={signOut} title={roster ? c.space.title[roster.space.kind](roster.space.name, roster.learners.length) : c.space.loading}>
      {error ? (
        <div style={panelStyle}>
          <p style={{ margin: 0 }}>{spaceErrorText(error, locale)}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}
      {roster ? (
        <>
          <section style={{ ...panelStyle, marginBottom: spacing.lg, textAlign: empty ? 'center' : 'left' }} aria-label={c.space.joinCodeLabel}>
            <div style={{ fontSize: typography.size.caption, color: colors.text.muted, textTransform: 'uppercase' }}>
              {c.space.codeLabel[roster.space.kind]}
            </div>
            <div data-testid="join-code" style={{ fontSize: empty ? typography.size.hero : typography.size.display, fontWeight: typography.weight.bold, letterSpacing: spacing.sm, fontFamily: typography.family.mono, margin: `${spacing.xs}px 0` }}>
              {roster.joinCode ?? '—'}
            </div>
            <Muted>{codeExpiry(roster.joinCodeExpiresAt, now, locale)}</Muted>
            <div style={{ display: 'flex', gap: spacing.sm, justifyContent: empty ? 'center' : 'flex-start' }}>
              {roster.joinCode ? <Button onClick={() => void copy()}>{copied ? c.joinCode.copied.cta : c.joinCode.copy.cta}</Button> : null}
              <Button onClick={() => void regenerate()} disabled={busy}>
                {roster.joinCode ? c.space.regenerate.cta : c.space.createCode.cta}
              </Button>
            </div>
            {empty ? <Muted>{c.writeOnBoard}</Muted> : null}
          </section>

          <ClassGoalLineView line={goalLine} />

          {cap?.warning ? (
            <Notice tone="nudge">
              {cap.reached ? c.capReached : c.capWarning(cap.used, cap.total)}{' '}
              <Link href="/teach/billing">{c.space.upgrade}</Link>
            </Notice>
          ) : null}

          {rollup && !empty ? (
            <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={c.space.week.title}>
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>{c.space.week.title}</h2>
              <ul style={{ margin: 0, paddingLeft: spacing.lg, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>
                <li>{c.space.week.practiced(rollup.practicedThisWeek, rollup.students)}</li>
                <li>{c.space.week.anchor(percent(rollup.anchorAccuracy))}</li>
                {rollup.revisit.length ? (
                  <li>
                    {weekRevisit.before}
                    {jamo(rollup.revisit)}
                    {weekRevisit.after}{' '}
                    {lecture ? (
                      <Link
                        href={ROUTES.spaceLecture(spaceId, 'revisit')}
                        data-testid="revisit-together"
                        style={{ display: 'inline-flex', alignItems: 'center', minHeight: spacing.xxxl, fontSize: typography.size.caption, fontWeight: typography.weight.bold, padding: `0 ${spacing.md}px`, borderRadius: radii.pill, border: `1px solid ${colors.border.strong}`, color: colors.text.primary, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        {c.lecture.revisitChip.cta}
                      </Link>
                    ) : null}
                  </li>
                ) : null}
                <WeekWordsRevisit words={consoleWords(rollup.vocabRevisit, locale)} />
                {rollup.notSynced ? <li>{c.space.week.notSynced(rollup.notSynced)}</li> : null}
              </ul>
            </section>
          ) : null}

          <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href={ROUTES.spacePlan(spaceId)}>
              <Button tone="primary">{latestPlan ? c.space.openPlan.label(latestPlan.title) : c.planThisWeek}</Button>
            </Link>
            <Link href={ROUTES.spaceCurriculum(spaceId)}>
              <Button testId="plan-term">{c.curriculum.entries.planTerm.cta}</Button>
            </Link>
            {lecture ? (
              <Link href={ROUTES.spaceLecture(spaceId)}>
                <Button testId="open-lecture">{c.lecture.entry.cta}</Button>
              </Link>
            ) : null}
            <Link href={ROUTES.spaceRelink(spaceId)}>
              <Button>{pendingRelinks > 0 ? c.space.relinkPending.cta(pendingRelinks) : c.space.relinkRequests.cta}</Button>
            </Link>
            <Link href={ROUTES.spaceSettings(spaceId)}>
              <Button>{c.space.settings.cta}</Button>
            </Link>
          </div>

          {!empty ? (
            <section aria-label={c.space.studentsLabel}>
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>{c.space.recentFirst}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing.md }}>
                {roster.learners.map((l) => (
                  <article key={l.id} style={panelStyle} data-testid="student-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
                        <AvatarChip avatar={l.avatar} />
                        <strong>{l.displayName}</strong>
                      </span>
                      {levelPillLabel(l.ageGroup) ? (
                        <span style={{ fontSize: typography.size.caption, color: colors.text.muted, padding: `${spacing.xxs}px ${spacing.sm}px`, backgroundColor: colors.surface.sunken, borderRadius: radii.pill }}>
                          {levelPillLabel(l.ageGroup)}
                        </span>
                      ) : null}
                    </div>
                    {l.summary ? (
                      <div style={{ color: colors.text.secondary, fontSize: typography.size.bodySm, marginTop: spacing.xs, lineHeight: typography.leading.relaxed }}>
                        <div>{c.space.learner.lastActive(relativeDay(l.summary.lastActiveAt, now, locale))}</div>
                        <StartingSpot summary={l.summary} spaceId={spaceId} learnerId={l.id} learnerName={l.displayName} />
                        <div>{c.space.learner.questsCards(l.summary.stage1.questsDone, l.summary.stage1.questsTotal, l.summary.cardsUnlocked)}</div>
                        <div>{c.space.learner.minutesThisWeek(l.summary.minutesLast7d)}</div>
                        <JourneyStrip kind={roster.space.kind} summary={l.summary} />
                        {l.summary.needsPractice.length ? (
                          <div>
                            {learnerRevisit.before}
                            {jamo(l.summary.needsPractice)}
                            {learnerRevisit.after}
                          </div>
                        ) : null}
                        <StudentWordsLines words={studentWords(l.summary, locale)} />
                        {latestPlan && readout && planReaches(latestPlan, l.id) ? (
                          <div>
                            {c.space.learner.planReadout(
                              latestPlan.title,
                              latestPlan.meta
                                ? routeReadoutLine(readout.get(l.id) as NonNullable<ReturnType<typeof readout.get>>, latestPlan.items.length, locale)
                                : readoutLine(readout.get(l.id) as NonNullable<ReturnType<typeof readout.get>>, locale),
                            )}
                          </div>
                        ) : null}
                        {ownRouteLine(roster.space.kind, l.summary.selfRoute, locale) ? <div data-testid="own-route">{ownRouteLine(roster.space.kind, l.summary.selfRoute, locale)}</div> : null}
                        <FreeLessonsLine line={rosterFreeLessonsLine({ gating, role, coverage, spaceKind: roster.space.kind, learner: l, plans: livePlans, today }, locale)} />
                      </div>
                    ) : (
                      <Muted>
                        {c.notSyncedYet} · {c.space.learner.joined(relativeDay(l.joinedAt, now, locale))}
                      </Muted>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </AdultFrame>
  );
}

export default function SpacePage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <SpaceInner />
    </Suspense>
  );
}
