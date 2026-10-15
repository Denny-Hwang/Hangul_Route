'use client';

import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AvatarChip } from '@/components/AvatarChip';
import { BrowseLink } from '@/components/console/BrowseLink';
import { AdultFrame, type FrameSpaces } from '@/components/console/AdultFrame';
import { FamilyClassCards } from '@/components/console/FamilyClassCards';
import { FreeLessonsLine } from '@/components/console/FreeLessonsParts';
import { useTransfersShown } from '@/components/console/TransferParts';
import { Button, Muted, buttonBase, panelStyle } from '@/components/console/ui';
import { useMovesWaiting } from '@/components/console/MovesEntry';
import { useConsole } from '@/components/console/use-console';
import { useVisibleRefresh } from '@/components/console/use-visible-refresh';
import type { EntitlementView, PlanView, Roster, RosterLearner, SpaceListItem } from '@/lib/console/api';
import { browseEntryShown, contentGatingEnabled, learningRouteEnabled, notesEnabled, reportsEnabled } from '@/lib/console/config';
import { spaceCoverage } from '@/lib/console/curriculum';
import { rosterFreeLessonsLine } from '@/lib/console/free-lessons-line-view';
import { openAppWithJoinCode } from '@/lib/console/join-handoff';
import { familyActionLinks, isArchivedFamily, joinOrder, learnerCardActions, managesJoinCode, parentHomeView, type CardFlags } from '@/lib/console/parent-home';
import { personaHome } from '@/lib/console/personas';
import { dateKey, livePublished } from '@/lib/console/plans';
import { codeExpiry, relativeDay } from '@/lib/console/rollup';
import { ROUTES, spaceErrorText } from '@/lib/console/routing';
import { writeLastPersona } from '@/lib/console/shell-store';
import { START_CLASS, START_FAMILY } from '@/lib/console/teacher-home';

/**
 * The family home `/parent` (F-APP-001 A-5b, section 3.8; design mock design/screens/app-shell/parent-home.md,
 * wireframe design/wireframes/shell/parent-home.md). One section per family space, one card per learner in
 * the order they joined (never by activity, section 3.17), minutes labelled "last 7 days" with no target and
 * no comparison. Card actions and Lessons show only with their sibling flags. A family with no learner gets
 * the join code and the hand-off to the learner app on this device; an account with no family the
 * "no family yet" panel. Ids only in links (R-2).
 *
 * With the console's free-plan switch on (F-ENT-003 E3-12c, section 3.9.2 Console), the page also reads each
 * family's plans and the account's entitlements, and a child card shows the `plan-waiting` free-lessons line
 * under its figures for the owner of a family no Family Plan covers, with **Open billing** described by it.
 * With the switch off it reads neither and shows no line.
 *
 * Class moves (F-SPACE-002 T-6b, requests-page.md "Entry points"):
 * the family actions gain "N class moves waiting" to the family's page, only while a move waits for the family.
 */

/** Background reads of the family list that may fail in a row before they stop (a signed-out answer stops them at once). */
const QUIET_FAILURES_BEFORE_STOP = 3;

/** One family's roster read: loading, failed (that section alone shows Try again) or loaded. */
type FamilyRoster = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; roster: Roster };

/** The phone / wide switches (45em = `layout.maxWidth.reading`, 70em = `layout.maxWidth.full`), and the grid tracks of the mock (README, Constants). */
const WIDE = `${layout.maxWidth.reading / 16}em`;
const FULL = `${layout.maxWidth.full / 16}em`;
const CARD_TRACK = '18rem';
const ACTION_TRACK = '9rem';

/** Layout rules that change at a breakpoint (inline styles would beat them); every value is a token. */
const HOME_CSS = `
.hr-ph{display:flex;flex-direction:column;gap:${spacing.xl}px}
.hr-ph-hidden{position:absolute;width:${borderWidth.thin}px;height:${borderWidth.thin}px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.hr-ph-family{display:grid;grid-template-columns:minmax(0,1fr);gap:${spacing.lg}px}
.hr-ph-main{display:flex;flex-direction:column;gap:${spacing.md}px;min-width:0}
.hr-ph-cards{display:grid;grid-template-columns:minmax(0,1fr);gap:${spacing.md}px}
.hr-ph-side{display:flex;flex-direction:column;gap:${spacing.lg}px;min-width:0}
.hr-ph-actions{display:grid;grid-template-columns:repeat(auto-fill,minmax(${ACTION_TRACK},1fr));gap:${spacing.sm}px}
.hr-ph-row{display:flex;flex-wrap:wrap;gap:${spacing.sm}px}
.hr-ph-row>*{flex:1 1 ${ACTION_TRACK}}
@media (min-width:${WIDE}){.hr-ph-cards{grid-template-columns:repeat(auto-fill,minmax(${CARD_TRACK},1fr))}}
@media (min-width:${FULL}){.hr-ph-family{grid-template-columns:minmax(0,1fr) ${layout.pane.master}px;column-gap:${spacing.xxl}px;align-items:start}}
`;

const button: CSSProperties = {
  ...buttonBase,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  minHeight: touchTarget.min,
  textAlign: 'center',
  textDecoration: 'none',
};
const primary: CSSProperties = { ...button, fontSize: typography.size.body, backgroundColor: colors.brand.primary, borderColor: colors.brand.primary, color: colors.text.onPrimary };
const pressed: CSSProperties = { ...button, backgroundColor: colors.surface.sunken };
const textLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: touchTarget.min,
  minWidth: touchTarget.min,
  padding: `0 ${spacing.sm}px`,
  color: colors.brand.secondaryDark,
  fontWeight: typography.weight.semibold,
  fontSize: typography.size.body,
  textDecoration: 'underline',
  textUnderlineOffset: spacing.xs,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
};
/** `shadows.card` (a React Native shadow tuple) as a CSS box shadow: the colour token with the token's opacity as alpha (mock: Tokens, Card). */
const cardShadow = `0 ${shadows.card.shadowOffset.height}px ${shadows.card.shadowRadius}px ${shadows.card.shadowColor}${Math.round(shadows.card.shadowOpacity * 255)
  .toString(16)
  .padStart(2, '0')}`;
const familyHeading: CSSProperties = { margin: 0, fontSize: typography.size.title, lineHeight: typography.leading.tight, fontWeight: typography.weight.bold, overflowWrap: 'anywhere' };
const cardStyle: CSSProperties = {
  backgroundColor: colors.surface.paper,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  borderRadius: radii.lg,
  boxShadow: cardShadow,
  padding: spacing.lg,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.md,
  minWidth: 0,
};
const facts: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.xxs, color: colors.text.secondary, fontSize: typography.size.bodySm };
const skeleton: CSSProperties = { ...cardStyle, boxShadow: 'none', backgroundColor: colors.surface.sunken, minHeight: touchTarget.min * 3 };

export default function ParentHomePage(): JSX.Element {
  const { ready, session, api, signOut, m, locale } = useConsole();
  const router = useRouter();
  const [items, setItems] = useState<SpaceListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [rosters, setRosters] = useState<Record<string, FamilyRoster>>({});
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState<string | null>(null);
  // Create a code: the family whose request is running (one at a time, so a double tap never makes two codes) and the one that failed.
  const [codeBusy, setCodeBusy] = useState<string | null>(null);
  const codeBusyRef = useRef<string | null>(null);
  const [codeFailed, setCodeFailed] = useState<string | null>(null);
  // The free-lessons line (F-ENT-003 section 3.9.2): each family's plans and the account's entitlements, read only with the switch on.
  const [plans, setPlans] = useState<Record<string, PlanView[]>>({});
  const [entitlements, setEntitlements] = useState<EntitlementView[] | null>(null);
  const homeView = items ? parentHomeView(items) : null;
  const moves = useMovesWaiting(api, homeView?.state === 'families' ? homeView.families.map((family) => family.space.id) : []);
  // [TV] The class-scope update and the one-time move notices (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D5, TV-D10).
  const movesShown = useTransfersShown();

  // Which read may still draw, for the family list and for each family's roster. A read the user started (open, Try
  // again) takes a new number, so an older read that ends later never puts back what it replaced. A quiet read takes
  // none: it draws only while no newer user read started after it.
  const loadSeq = useRef(0);
  const rosterSeq = useRef<Record<string, number>>({});

  // `quiet`: the read again when the tab comes back into view (F-LEARN-001 section 3.11). The drawn cards stay while it
  // reads, and a failed quiet read keeps them: a background read never turns a family into an error.
  const loadRoster = useCallback(
    async (spaceId: string, role: SpaceListItem['role'], quiet = false): Promise<void> => {
      if (!api) return;
      const seen = rosterSeq.current[spaceId] ?? 0;
      const call = quiet ? seen : seen + 1;
      rosterSeq.current[spaceId] = call;
      if (!quiet) setRosters((prev) => ({ ...prev, [spaceId]: { state: 'loading' } }));
      // Plans only for a family this account owns: the line is owner only, so a co-caregiver's family needs no plan read.
      const readPlans = contentGatingEnabled() && role === 'owner';
      const [result, planList] = await Promise.all([api.roster(spaceId).catch(() => null), readPlans ? api.listPlans(spaceId).catch(() => null) : null]);
      if (call !== rosterSeq.current[spaceId]) return;
      if (planList?.ok) setPlans((prev) => ({ ...prev, [spaceId]: planList.data }));
      setRosters((prev) => {
        if (result?.ok) return { ...prev, [spaceId]: { state: 'ready', roster: result.data } };
        if (quiet && prev[spaceId]?.state === 'ready') return prev;
        return { ...prev, [spaceId]: { state: 'failed' } };
      });
    },
    [api],
  );

  // Background reads that failed in a row. A signed-out answer, or the third failure, stops the background reads and
  // shows the usual "can't reach" line with Try again, so a home left open never sends failing reads with no sign.
  const quietFailures = useRef(0);
  const [refreshStopped, setRefreshStopped] = useState(false);

  const load = useCallback(
    async (quiet = false): Promise<void> => {
      if (!api) return;
      const call = quiet ? loadSeq.current : ++loadSeq.current;
      if (!quiet) setFailed(false);
      const [result, owned] = await Promise.all([api.listSpaces(), contentGatingEnabled() ? api.entitlements().catch(() => null) : null]);
      if (call !== loadSeq.current) return;
      if (!result.ok) {
        if (!quiet) {
          setEntitlements(owned?.ok ? owned.data : null);
          setFailed(true);
        } else {
          quietFailures.current += 1;
          if (result.error === 'unauthorized' || quietFailures.current >= QUIET_FAILURES_BEFORE_STOP) {
            setFailed(true);
            setRefreshStopped(true);
          }
        }
        return;
      }
      quietFailures.current = 0;
      setRefreshStopped(false);
      if (!quiet || owned?.ok) setEntitlements(owned?.ok ? owned.data : null);
      setFailed(false);
      setItems(result.data);
      const view = parentHomeView(result.data);
      if (view.state === 'families') await Promise.all(view.families.map((family) => loadRoster(family.space.id, family.role, quiet)));
    },
    [api, loadRoster],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // An open family home shows a renamed learner or a new member without a reload.
  // A roster page: it also reads slowly while it stays in front.
  useVisibleRefresh(() => void load(true), !!api && !refreshStopped, { poll: true });

  const frameSpaces: FrameSpaces = !api || (failed && !items) ? 'failed' : items;
  if (!ready || !session) return <AdultFrame spaces={frameSpaces}>{null}</AdultFrame>;

  const c = m.console;
  const p = c.parentHome;
  const now = new Date();
  const flags: CardFlags = { reports: reportsEnabled(locale), notes: notesEnabled(), route: learningRouteEnabled() };
  const gating = contentGatingEnabled();
  const today = dateKey(now);
  const lessons = browseEntryShown(typeof window === 'undefined' ? '' : window.location.origin);
  const view = homeView;
  const joinLine = p.empty.line(m.learner.home.profileLabel, m.caregiver.spaces.title, m.caregiver.spaces.join.cta);

  const toTeacher = (): void => {
    void writeLastPersona('teacher');
    router.push(personaHome('teacher'));
  };
  const copy = async (spaceId: string, code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(spaceId);
      setCopyFailed(null);
    } catch {
      setCopied(null);
      setCopyFailed(spaceId);
    }
  };
  const createCode = async (spaceId: string): Promise<void> => {
    if (!api || codeBusyRef.current) return;
    codeBusyRef.current = spaceId;
    setCodeBusy(spaceId);
    setCodeFailed(null);
    const result = await api.regenerateCode(spaceId).catch(() => null);
    codeBusyRef.current = null;
    setCodeBusy(null);
    if (!result?.ok) {
      setCodeFailed(spaceId);
      return;
    }
    setRosters((prev) => {
      const entry = prev[spaceId];
      return entry?.state === 'ready' ? { ...prev, [spaceId]: { state: 'ready', roster: { ...entry.roster, joinCode: result.data.joinCode, joinCodeExpiresAt: result.data.expiresAt } } } : prev;
    });
  };

  /**
   * The family join code: the visible code is hidden from screen readers, which read the spaced copy one character at a
   * time; its expiry under it. Only the owner makes a code (`space.manage`): a caregiver is asked to get it from them.
   */
  const joinPanel = (family: SpaceListItem, roster: Roster): JSX.Element => {
    const id = family.space.id;
    return (
      <section data-testid="join-panel" aria-label={c.space.codeLabel.family} style={{ ...panelStyle, margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.sm, padding: `${spacing.xl}px ${spacing.lg}px`, textAlign: 'center' }}>
        <span style={{ fontSize: typography.size.caption, fontWeight: typography.weight.semibold, color: colors.text.muted }}>{c.space.codeLabel.family}</span>
        {roster.joinCode ? (
          <>
            <span data-testid="join-code" aria-hidden={true} style={{ fontFamily: typography.family.mono, fontSize: typography.size.display, fontWeight: typography.weight.bold, letterSpacing: typography.tracking.wide }}>
              {roster.joinCode}
            </span>
            <span className="hr-ph-hidden">{roster.joinCode.split('').join(' ')}</span>
            <Muted>{codeExpiry(roster.joinCodeExpiresAt, now, locale)}</Muted>
            <Button onClick={() => void copy(id, roster.joinCode as string)}>{copied === id ? c.joinCode.copied.cta : c.joinCode.copy.cta}</Button>
            {copyFailed === id ? (
              <p role="status" style={{ margin: 0, color: colors.text.secondary }}>
                {p.copyFailed}
              </p>
            ) : null}
          </>
        ) : managesJoinCode(family) ? (
          <>
            <Button testId="create-code" disabled={codeBusy !== null} onClick={() => void createCode(id)}>
              {c.space.createCode.cta}
            </Button>
            {codeFailed === id ? (
              <p role="status" style={{ margin: 0, color: colors.text.secondary }}>
                {spaceErrorText('regenerateFailed', locale)}
              </p>
            ) : null}
          </>
        ) : (
          <p data-testid="ask-owner" style={{ margin: 0, fontWeight: typography.weight.semibold }}>
            {p.askOwner}
          </p>
        )}
        <p style={{ margin: 0, color: colors.text.secondary, maxWidth: layout.pane.master }}>{joinLine}</p>
      </section>
    );
  };

  const card = (family: SpaceListItem, learner: RosterLearner): JSX.Element => {
    const familyId = family.space.id;
    const actions = learnerCardActions(familyId, learner.id, flags);
    // Owner only, an uncovered family only, the switch on only (F-ENT-003 section 3.9.2): rosterFreeLessonsLine says null otherwise.
    const freeLine = gating
      ? rosterFreeLessonsLine(
          { gating, role: family.role, coverage: spaceCoverage(entitlements, items, family.space, now), spaceKind: family.space.kind, learner, plans: livePublished(plans[familyId] ?? []), today },
          locale,
        )
      : null;
    const label = (key: 'seeReport' | 'open' | 'sendNote' | 'route'): string => p.child[key];
    return (
      <article key={learner.id} data-testid="learner-card" aria-label={learner.displayName} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
          <AvatarChip avatar={learner.avatar} />
          <h3 style={{ margin: 0, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, overflowWrap: 'anywhere' }}>{learner.displayName}</h3>
        </div>
        <div style={facts}>
          <span>{c.space.learner.lastActive(relativeDay(learner.lastActiveAt, now, locale))}</span>
          {learner.summary ? <span>{p.minutes7d(learner.summary.minutesLast7d)}</span> : null}
        </div>
        <FreeLessonsLine line={freeLine} />
        <Link href={actions.primary.href} style={primary}>
          {label(actions.primary.key)}
        </Link>
        {actions.secondary.length > 0 ? (
          <div className="hr-ph-row">
            {actions.secondary.map((action) => (
              <Link key={action.key} href={action.href} style={button}>
                {label(action.key)}
              </Link>
            ))}
          </div>
        ) : null}
      </article>
    );
  };

  const familySection = (family: SpaceListItem, isLast: boolean, cross: JSX.Element | null): JSX.Element => {
    const id = family.space.id;
    const entry = rosters[id] ?? { state: 'loading' };
    const headingId = `family-${id}`;
    const panelId = `join-${id}`;
    const links = familyActionLinks(id);
    const learners = entry.state === 'ready' ? joinOrder(entry.roster.learners) : [];
    const empty = entry.state === 'ready' && learners.length === 0;
    // An archived family is read-only (the API refuses a join to it): its label, its cards and Family settings only.
    const archived = isArchivedFamily(family);
    const expanded = openPanel === id && !archived;
    const canAdd = entry.state === 'ready' && !empty && !archived;
    const actions = (
      <div className="hr-ph-actions">
        {lessons ? (
          <BrowseLink source="nav" label={p.actions.lessons} testId="family-lessons" style={{ ...button, flex: '1 1 auto' }} />
        ) : null}
        {archived ? null : (
          <>
            <Link href={links.planWeek} style={button} data-testid="family-plan-week">
              {p.actions.planWeek}
            </Link>
            <Link href={links.planTerm} style={button} data-testid="family-plan-term">
              {p.actions.planTerm}
            </Link>
          </>
        )}
        <Link href={links.settings} style={button} data-testid="family-settings">
          {p.actions.settings}
        </Link>
        {canAdd ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setOpenPanel(expanded ? null : id)}
            style={expanded ? pressed : button}
            data-testid="family-add-learner"
          >
            {p.actions.addLearner}
          </button>
        ) : null}
        {(moves[id] ?? 0) > 0 ? (
          <Link href={ROUTES.spaceTransfers(id, 'family')} style={button} data-testid="family-moves-waiting">
            {c.transfer.waiting(moves[id] ?? 0)}
          </Link>
        ) : null}
      </div>
    );
    return (
      <section key={id} aria-labelledby={headingId} className="hr-ph-family">
        <div className="hr-ph-main" aria-busy={entry.state === 'loading' ? true : undefined}>
          <h2 id={headingId} style={familyHeading}>
            {family.space.name}
            {archived ? <span style={{ color: colors.text.muted, fontSize: typography.size.bodySm, fontWeight: typography.weight.semibold }}> {c.home.archived}</span> : null}
          </h2>
          {api && !archived ? <FamilyClassCards familyId={id} api={api} movesShown={movesShown} /> : null}
          {entry.state === 'loading' ? (
            <div className="hr-ph-cards">
              <div style={skeleton} />
              <div style={skeleton} />
            </div>
          ) : null}
          {entry.state === 'failed' ? (
            <div style={{ ...panelStyle, margin: 0 }}>
              <p style={{ margin: `0 0 ${spacing.sm}px` }}>{c.cantReach}</p>
              <Button testId={`family-retry-${id}`} onClick={() => void loadRoster(id, family.role)}>
                {c.tryAgain}
              </Button>
            </div>
          ) : null}
          {entry.state === 'ready' && empty && archived ? <p style={{ margin: 0, color: colors.text.secondary }}>{p.empty.title}</p> : null}
          {entry.state === 'ready' && empty && !archived ? (
            <>
              <p style={{ margin: 0, color: colors.text.secondary }}>{p.empty.title}</p>
              {joinPanel(family, entry.roster)}
              {entry.roster.joinCode ? (
                <button
                  type="button"
                  style={{ ...primary, width: '100%', maxWidth: layout.pane.master, alignSelf: 'center' }}
                  data-testid="open-app"
                  onClick={() => openAppWithJoinCode({ code: entry.roster.joinCode as string, now: Date.now() })}
                >
                  {p.empty.openApp}
                </button>
              ) : null}
            </>
          ) : null}
          {learners.length > 0 ? <div className="hr-ph-cards">{learners.map((learner) => card(family, learner))}</div> : null}
        </div>
        <aside aria-label={p.actionsFor(family.space.name)} className="hr-ph-side">
          {actions}
          {canAdd ? (
            <div id={panelId} hidden={expanded ? undefined : true}>
              {expanded && entry.state === 'ready' ? joinPanel(family, entry.roster) : null}
            </div>
          ) : null}
          {isLast ? cross : null}
        </aside>
      </section>
    );
  };

  const crossLink =
    view?.state === 'families' ? (
      <p style={{ margin: 0 }}>
        {view.cross === 'addClass' ? (
          <Link href={START_CLASS} style={textLink} data-testid="cross-add-class">
            {p.cross.addClass}
          </Link>
        ) : (
          <button type="button" onClick={toTeacher} style={textLink} data-testid="cross-to-teacher">
            {p.cross.toTeacher}
          </button>
        )}
      </p>
    ) : null;

  return (
    <AdultFrame onSignOut={signOut} spaces={frameSpaces}>
      <style>{HOME_CSS}</style>
      {!api ? <p style={{ margin: 0 }}>{c.shell.noApi}</p> : null}
      {failed ? (
        <div style={{ ...panelStyle, marginBottom: spacing.md }}>
          <p style={{ margin: `0 0 ${spacing.sm}px` }}>{c.cantReach}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}
      {!view && !failed && api ? (
        <div className="hr-ph" aria-busy={true}>
          <div className="hr-ph-cards">
            <div style={skeleton} />
            <div style={skeleton} />
          </div>
        </div>
      ) : null}
      {view?.state === 'noFamily' ? (
        <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: spacing.md, padding: `${spacing.xl}px ${spacing.lg}px`, maxWidth: layout.maxWidth.reading }}>
          <h1 style={{ margin: 0, fontSize: typography.size.prompt, lineHeight: typography.leading.tight, fontWeight: typography.weight.bold }}>{p.noFamily.title}</h1>
          <Link href={START_FAMILY} style={primary} data-testid="no-family-set-up">
            {p.noFamily.setUp}
          </Link>
          {view.goTeacher ? (
            <Link href={personaHome('teacher')} style={button} data-testid="no-family-go-teacher">
              {p.noFamily.goTeacher}
            </Link>
          ) : null}
        </div>
      ) : null}
      {view?.state === 'families' ? (
        <div className="hr-ph">
          <h1 className="hr-ph-hidden">{p.title}</h1>
          {view.families.map((family, index) => familySection(family, index === view.families.length - 1, crossLink))}
        </div>
      ) : null}
    </AdultFrame>
  );
}
