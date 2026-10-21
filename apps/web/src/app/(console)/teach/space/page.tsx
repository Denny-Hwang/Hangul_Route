'use client';

import { colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import type { UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Muted, Notice, buttonBase, panelStyle } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConfirm } from '@/components/console/ConfirmSheet';
import { RevisitLetterLinks } from '@/components/console/BrowseLink';
import { AvatarChip } from '@/components/AvatarChip';
import { SchoolAdmin } from '@/components/console/SchoolAdmin';
import { StartingSpot } from '@/components/console/PlacementParts';
import { PlanUpdateLine } from '@/components/console/PlanUpdateParts';
import { JourneyStrip } from '@/components/console/JourneyParts';
import { FreeLessonsLine } from '@/components/console/FreeLessonsParts';
import { ClassGoalLineView } from '@/components/console/ClassGoalParts';
import { StudentWordsLines, WeekWordsRevisit } from '@/components/console/VocabWordsParts';
import { useTransfersShown } from '@/components/console/TransferParts';
import { useMovesWaiting } from '@/components/console/MovesEntry';
import { useConsole } from '@/components/console/use-console';
import { useVisibleRefresh } from '@/components/console/use-visible-refresh';
import { useGrownUpLocation } from '@/components/console/grown-up-location';
import type { PlanView, Roster, SpaceListItem } from '@/lib/console/api';
import { appUrl, contentGatingEnabled, lectureModeEnabled, notesEnabled, reportsEnabled } from '@/lib/console/config';
import { rosterJoinLink } from '@/lib/console/join-link';
import { JoinLinkPanel } from '@/components/console/JoinLinkParts';
import { canComposeIn } from '@/lib/console/lecture';
import { rosterNotesLinks } from '@/lib/console/notes-page';
import { levelPillLabel } from '@/lib/console/level-label';
import { rosterReportLink } from '@/lib/console/report-view';
import { rosterClassReportLink } from '@/lib/console/class-report-view';
import { capState, classRollup, codeExpiry, familyCountLine, percent, relativeDay, seatLine } from '@/lib/console/rollup';
import { renameShown } from '@/lib/console/rename';
import { RenameStyles, RenameTitle, useAnnouncer, useSpaceRename } from '@/components/console/RenameParts';
import { ownRouteLine, readoutLine as routeReadoutLine, spaceCoverage, type SpaceCoverage } from '@/lib/console/curriculum';
import { rosterFreeLessonsLine } from '@/lib/console/free-lessons-line-view';
import { classGoalLine } from '@/lib/console/class-goal-line';
import { stageTitle } from '@/lib/console/stage-titles';
import { dateKey, livePublished, planReaches, planReadout, readoutLine, rosterPlan } from '@/lib/console/plans';
import { ROUTES, type SpaceError, spaceErrorText, spaceIdFrom, spaceKindOfPath } from '@/lib/console/routing';
import { spacePageBack } from '@/lib/console/page-back';
import { consoleWords, studentWords } from '@/lib/console/vocab-words';
import { aroundSlot } from '@/lib/i18n/slot';
import { headRem, rem } from '@/lib/console/rem';

/** console/roster — F-CONSOLE-001 §3.5. Summaries only; the API never sends payloads here. */
function SpaceInner(): JSX.Element {
  const spaceId = spaceIdFrom(useSearchParams());
  const { ready, session, api, signOut, m, locale } = useConsole();
  // Class moves (F-SPACE-002 T-6d): the family roster's permanent Class moves button, next to Settings (family-page.md).
  const movesShown = useTransfersShown();
  const c = m.console;
  // The confirm step in the console language (AMENDMENTS-DISPLAY-NAV section 8).
  const { confirm, sheet: confirmSheet } = useConfirm();
  // PageBack (AMENDMENTS-DISPLAY-NAV section 7.3): the persona home, by the page's prefix until the roster names the kind.
  const routed = useGrownUpLocation();
  const pathKind = spaceKindOfPath(routed?.pathname ?? (typeof window === 'undefined' ? '' : (window.location?.pathname ?? '')));
  const [roster, setRoster] = useState<Roster | null>(null);
  // T-6b: the class roster's button beside Re-link requests, and both buttons' "N class moves waiting" (requests-page.md
  // "Entry points"). Asked only once the roster says class or family: a school has no count of its own here.
  const movesKind = roster?.space.kind;
  const movesAsked = movesShown && (movesKind === 'class' || movesKind === 'family');
  const movesWaiting = useMovesWaiting(movesAsked ? api : null, movesAsked ? [spaceId] : [])[spaceId] ?? 0;
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

  // Which read may still draw. A read the user started (open, Try again, a saved plan) takes a new number, so an older
  // read that ends later never puts back what it replaced (a removed learner, an old name). A quiet read takes none: it
  // draws only while no newer user read started after it.
  const loadSeq = useRef(0);

  // `quiet`: the read again when the tab comes back into view (F-LEARN-001 section 3.11). It keeps what is drawn while it
  // reads, and a quiet read that cannot reach the Worker changes nothing: the page never turns into an error because a
  // background read failed. A removed teacher or a deleted space is the exception (below).
  const load = useCallback(async (quiet = false): Promise<void> => {
    if (!api) return;
    const call = quiet ? loadSeq.current : ++loadSeq.current;
    if (!quiet) {
      setError(null);
      setCoverage('unknown');
    }
    // The free-plan switch (F-ENT-003 §3.4): only with it on does the roster read the role and the entitlements for the free-lessons line.
    const gating = contentGatingEnabled();
    const [result, planList, relinks, spaceList, entitlements] = await Promise.all([
      api.roster(spaceId),
      api.listPlans(spaceId),
      api.relinkRequests(spaceId),
      // Notes (FB-11a) read the role too: only a role that sends here sees the roster's notes entries.
      lectureModeEnabled() || gating || notesEnabled() ? api.listSpaces() : null,
      gating ? api.entitlements() : null,
    ]);
    if (call !== loadSeq.current) return;
    if (spaceList?.ok) setSpaces(spaceList.data);
    if (gating && result.ok) setCoverage(spaceCoverage(entitlements?.ok ? entitlements.data : null, spaceList?.ok ? spaceList.data : null, result.data.space, new Date()));
    if (planList.ok) setPlans(planList.data);
    if (relinks.ok) setPendingRelinks(relinks.data.length);
    if (result.ok) {
      setRoster(result.data);
      if (quiet) setError(null);
    } else if (!quiet) setError(result.error === 'forbidden' ? 'forbidden' : result.error === 'not_found' ? 'gone' : 'cantReach');
    else if (result.error === 'forbidden' || result.error === 'not_found') {
      // A background read that says the teacher was removed or the space is gone is final: the old roster goes, the
      // usual line shows, and the background reads stop. Only a failure to reach the Worker stays silent.
      setRoster(null);
      setError(result.error === 'forbidden' ? 'forbidden' : 'gone');
    }
  }, [api, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  // An open roster shows a renamed learner, a new practice day or a new member without a reload.
  // A roster page also reads slowly while it stays in front (a classroom screen), never a report page.
  useVisibleRefresh(() => void load(true), !!api && error !== 'forbidden' && error !== 'gone', { poll: true });

  // [SA] The inline rename (AMENDMENTS-SEATS-ADMINS section 5.3): the new name shows at once in the title, the Back
  // labels and the frame, all read from this roster. A read still under way would put the old name back, so a rename
  // takes a new read number, as a read the user starts does.
  const { announce, region: renameLive } = useAnnouncer();
  const setName = useCallback((name: string) => {
    loadSeq.current += 1;
    setRoster((prev) => (prev ? { ...prev, space: { ...prev.space, name } } : prev));
  }, []);
  const rename = useSpaceRename({ api, spaceId, name: roster?.space.name ?? '', onName: setName, announce });

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;
  // School spaces get the admin view (F-SCHOOL-001 §3.3); classes and families the roster.
  if (roster?.space.kind === 'school' && api) return <SchoolAdmin api={api} spaceId={spaceId} onSignOut={signOut} />;

  const regenerate = async (): Promise<void> => {
    if (!api || !roster) return;
    if (roster.joinCode && !(await confirm({ title: c.space.regenerateAsk(roster.space.name), message: c.oldCodeStops, confirmLabel: c.confirm.newCode }))) return;
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
  // The class join link and its QR code (owner decision 2026-10-17): a class with a code only, the code alone in the fragment.
  const joinLink = roster ? rosterJoinLink({ kind: roster.space.kind, code: roster.joinCode, origin: appUrl() }) : null;
  // [SA] section 3.4: the count against the roster's own cap (`seats`), not the free cap.
  const cap = roster ? capState(roster.space.kind, roster.learners.length, roster.seats) : null;
  const capLine = roster ? seatLine(roster.space.kind, cap, locale) : null;
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
  // Notes (F-FEEDBACK-001 FB-11a, section 6.13 item 3): the roster header's Notes and each card's Send a note, by flag.
  const notesLinks = roster ? rosterNotesLinks({ enabled: notesEnabled(), archived: roster.space.archivedAt !== null, role: spaces?.find((item) => item.space.id === spaceId)?.role ?? null, spaceId, kind: roster.space.kind }) : null;

  return (
    <AdultFrame
      onSignOut={signOut}
      back={spacePageBack(roster?.space.kind ?? pathKind, c)}
      title={roster ? undefined : c.space.loading}
    >
      {confirmSheet}
      <RenameStyles />
      {renameLive}
      {roster ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, marginBottom: spacing.md }} data-testid="space-head">
          <RenameTitle
            rename={rename}
            name={roster.space.name}
            kind={roster.space.kind}
            canRename={renameShown(roster.space, roster.canRename)}
            openMoves={roster.openMoves === true}
            heading="h1"
            headingStyle={{ fontSize: headRem(typography.size.title), lineHeight: typography.leading.tight, fontWeight: typography.weight.bold }}
          />
          <p style={{ margin: 0, color: colors.text.secondary }} data-testid="space-count">
            {roster.space.kind === 'family' ? c.spaceCounts.learners(roster.learners.length) : c.spaceCounts.students(roster.learners.length)}
          </p>
        </div>
      ) : null}
      {error ? (
        <div style={panelStyle}>
          <p style={{ margin: 0 }}>{spaceErrorText(error, locale)}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}
      {roster ? (
        <>
          <section style={{ ...panelStyle, marginBottom: spacing.lg, textAlign: empty ? 'center' : 'left' }} aria-label={c.space.joinCodeLabel}>
            <div style={{ fontSize: rem(typography.size.caption), color: colors.text.muted, textTransform: 'uppercase' }}>
              {c.space.codeLabel[roster.space.kind]}
            </div>
            <div data-testid="join-code" style={{ fontSize: headRem(empty ? typography.size.hero : typography.size.display), fontWeight: typography.weight.bold, letterSpacing: spacing.sm, fontFamily: typography.family.mono, margin: `${spacing.xs}px 0` }}>
              {roster.joinCode ?? '—'}
            </div>
            <Muted>{codeExpiry(roster.joinCodeExpiresAt, now, locale)}</Muted>
            {roster.space.kind === 'family' && cap ? <Muted>{familyCountLine(cap, locale)}</Muted> : null}
            <div style={{ display: 'flex', gap: spacing.sm, justifyContent: empty ? 'center' : 'flex-start' }}>
              {roster.joinCode ? <Button onClick={() => void copy()}>{copied ? c.joinCode.copied.cta : c.joinCode.copy.cta}</Button> : null}
              <Button onClick={() => void regenerate()} disabled={busy}>
                {roster.joinCode ? c.space.regenerate.cta : c.space.createCode.cta}
              </Button>
            </div>
            {empty ? <Muted>{c.writeOnBoard}</Muted> : null}
            {joinLink !== null ? <JoinLinkPanel key={joinLink} url={joinLink} copy={c.space.joinLink} centered={empty} /> : null}
          </section>

          <ClassGoalLineView line={goalLine} />

          {capLine ? (
            <Notice tone="nudge">
              {capLine.text}
              {capLine.upgrade ? (
                <>
                  {' '}
                  <Link href={ROUTES.billing}>{c.space.upgrade}</Link>
                </>
              ) : null}
            </Notice>
          ) : null}

          {rollup && !empty ? (
            <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={c.space.week.title}>
              <h2 style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.sm}px` }}>{c.space.week.title}</h2>
              <ul style={{ margin: 0, paddingLeft: spacing.lg, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>
                <li>{c.space.week.practiced(rollup.practicedThisWeek, rollup.students)}</li>
                <li>{c.space.week.anchor(percent(rollup.anchorAccuracy))}</li>
                {rollup.revisit.length ? (
                  <li>
                    {weekRevisit.before}
                    <RevisitLetterLinks chars={rollup.revisit} />
                    {weekRevisit.after}{' '}
                    {lecture ? (
                      <Link
                        href={ROUTES.spaceLecture(spaceId, 'revisit', undefined, roster.space.kind)}
                        data-testid="revisit-together"
                        style={{ display: 'inline-flex', alignItems: 'center', minHeight: spacing.xxxl, fontSize: rem(typography.size.caption), fontWeight: typography.weight.bold, padding: `0 ${spacing.md}px`, borderRadius: radii.pill, border: `1px solid ${colors.border.strong}`, color: colors.text.primary, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        {c.lecture.revisitChip.cta}
                      </Link>
                    ) : null}
                  </li>
                ) : null}
                <WeekWordsRevisit words={consoleWords(rollup.vocabRevisit, locale)} />
                {rollup.notSynced ? <li>{c.space.week.notSynced(rollup.notSynced)}</li> : null}
              </ul>
              <ClassReportLink spaceId={spaceId} kind={roster.space.kind} locale={locale} />
            </section>
          ) : null}

          <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href={ROUTES.spacePlan(spaceId, undefined, roster.space.kind)}>
              <Button tone="primary">{latestPlan ? c.space.openPlan.label(latestPlan.title) : c.planThisWeek}</Button>
            </Link>
            <Link href={ROUTES.spaceCurriculum(spaceId, roster.space.kind)}>
              <Button testId="plan-term">{c.curriculum.entries.planTerm.cta}</Button>
            </Link>
            {lecture ? (
              <Link href={ROUTES.spaceLecture(spaceId, undefined, undefined, roster.space.kind)}>
                <Button testId="open-lecture">{c.lecture.entry.cta}</Button>
              </Link>
            ) : null}
            <Link href={ROUTES.spaceRelink(spaceId, roster.space.kind)}>
              <Button>{pendingRelinks > 0 ? c.space.relinkPending.cta(pendingRelinks) : c.space.relinkRequests.cta}</Button>
            </Link>
            {movesShown && roster.space.kind === 'class' ? (
              <Link href={ROUTES.spaceTransfers(spaceId, roster.space.kind)}>
                <Button testId="class-moves">{movesWaiting > 0 ? c.transfer.waiting(movesWaiting) : c.transfer.entry.cta}</Button>
              </Link>
            ) : null}
            {notesLinks?.header ? <NotesLink href={notesLinks.header} testId="roster-notes" text={c.notes.roster.notes.cta} /> : null}
            <Link href={ROUTES.spaceSettings(spaceId, roster.space.kind)}>
              <Button>{c.space.settings.cta}</Button>
            </Link>
            {movesShown && roster.space.kind === 'family' ? (
              <Link href={ROUTES.spaceTransfers(spaceId, roster.space.kind)}>
                <Button testId="family-moves">{movesWaiting > 0 ? c.transfer.waiting(movesWaiting) : c.transfer.entry.cta}</Button>
              </Link>
            ) : null}
          </div>

          {!empty ? (
            <section aria-label={c.space.studentsLabel}>
              <h2 style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.sm}px` }}>{c.space.recentFirst}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing.md }}>
                {roster.learners.map((l, index) => (
                  <article key={l.id} style={panelStyle} data-testid="student-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
                        <AvatarChip avatar={l.avatar} />
                        <strong id={`roster-learner-${index}`}>{l.displayName}</strong>
                      </span>
                      {levelPillLabel(l.ageGroup, locale) ? (
                        <span style={{ fontSize: rem(typography.size.caption), color: colors.text.muted, padding: `${spacing.xxs}px ${spacing.sm}px`, backgroundColor: colors.surface.sunken, borderRadius: radii.pill }}>
                          {levelPillLabel(l.ageGroup, locale)}
                        </span>
                      ) : null}
                    </div>
                    {l.summary ? (
                      <div style={{ color: colors.text.secondary, fontSize: rem(typography.size.bodySm), marginTop: spacing.xs, lineHeight: typography.leading.relaxed }}>
                        <div>{c.space.learner.lastActive(relativeDay(l.summary.lastActiveAt, now, locale))}</div>
                        <StartingSpot summary={l.summary} spaceId={spaceId} learnerId={l.id} learnerName={l.displayName} kind={roster.space.kind} />
                        <PlanUpdateLine kind={roster.space.kind} learner={l} plans={plans} today={today} api={api} spaceId={spaceId} onSaved={() => void load()} />
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
                    <SeeReport spaceId={spaceId} kind={roster.space.kind} learnerId={l.id} locale={locale} />
                    {notesLinks?.card(l.id) ? <NotesLink href={notesLinks.card(l.id) ?? ''} testId="send-note" text={c.notes.sendNote.cta} describedBy={`roster-learner-${index}`} /> : null}
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

/**
 * The student card's **See report** (F-REPORT-001 RP-7a2, section 3.1): the learner's week report with `from=roster`,
 * ids only, for a class and a family; not drawn while reports are off for this build or console locale.
 */
function SeeReport({ spaceId, kind, learnerId, locale }: { spaceId: string; kind: Roster['space']['kind']; learnerId: string; locale: UiLocale }): JSX.Element | null {
  const link = rosterReportLink({ spaceId, kind, learnerId, enabled: reportsEnabled(locale), locale });
  if (link === null) return null;
  return (
    <Link
      href={link.href}
      data-testid="see-report"
      style={{ ...buttonBase, display: 'inline-flex', alignItems: 'center', minHeight: touchTarget.min, marginTop: spacing.sm, textDecoration: 'none', boxSizing: 'border-box' }}
    >
      {link.text}
    </Link>
  );
}

/**
 * A notes entry of the roster (F-FEEDBACK-001 FB-11a): a secondary pill that navigates, ids only in its address. A card's
 * Send a note is described by the learner's name, so a links list says whom it is for (design pass N7).
 */
function NotesLink({ href, testId, text, describedBy }: { href: string; testId: string; text: string; describedBy?: string }): JSX.Element {
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-describedby={describedBy}
      style={{ ...buttonBase, display: 'inline-flex', alignItems: 'center', minHeight: touchTarget.min, ...(describedBy ? { marginTop: spacing.sm, marginLeft: spacing.xs } : {}), textDecoration: 'none', boxSizing: 'border-box' }}
    >
      {text}
    </Link>
  );
}

/** The roll-up's **Class report** (F-REPORT-001 RP-8, section 3.1): class spaces only, while reports are on. */
function ClassReportLink({ spaceId, kind, locale }: { spaceId: string; kind: Roster['space']['kind']; locale: UiLocale }): JSX.Element | null {
  const link = rosterClassReportLink({ spaceId, kind, enabled: reportsEnabled(locale), locale });
  if (link === null) return null;
  return (
    <Link
      href={link.href}
      data-testid="class-report-link"
      style={{ ...buttonBase, display: 'inline-flex', alignItems: 'center', minHeight: touchTarget.min, marginTop: spacing.sm, textDecoration: 'none', boxSizing: 'border-box' }}
    >
      {link.text}
    </Link>
  );
}

export default function SpacePage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <SpaceInner />
    </Suspense>
  );
}
