'use client';

import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AvatarChip } from '@/components/AvatarChip';
import { AdultFrame, type FrameSpaces } from '@/components/console/AdultFrame';
import { Button, buttonBase, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { Roster, RosterLearner, SpaceListItem } from '@/lib/console/api';
import { browseEntryShown, learningRouteEnabled, notesEnabled, reportsEnabled } from '@/lib/console/config';
import { openAppWithJoinCode } from '@/lib/console/join-handoff';
import { familyActionLinks, joinOrder, learnerCardActions, parentHomeView, type CardFlags } from '@/lib/console/parent-home';
import { personaHome } from '@/lib/console/personas';
import { relativeDay } from '@/lib/console/rollup';
import { writeLastPersona } from '@/lib/console/shell-store';
import { BROWSE_PATH } from '@/lib/console/shell-nav';
import { START_CLASS, START_FAMILY } from '@/lib/console/teacher-home';

/**
 * The family home `/parent` (F-APP-001 A-5b, section 3.8; design mock design/screens/app-shell/parent-home.md,
 * wireframe design/wireframes/shell/parent-home.md). One section per family space, one card per learner in
 * the order they joined (never by activity, section 3.17), minutes labelled "last 7 days" with no target and
 * no comparison. Card actions and Lessons show only with their sibling flags. A family with no learner gets
 * the join code and the hand-off to the learner app on this device; an account with no family the
 * "no family yet" panel. Ids only in links (R-2).
 */

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
const familyHeading: CSSProperties = { margin: 0, fontSize: typography.size.title, lineHeight: typography.leading.tight, fontWeight: typography.weight.bold, overflowWrap: 'anywhere' };
const cardStyle: CSSProperties = {
  backgroundColor: colors.surface.paper,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  borderRadius: radii.lg,
  padding: spacing.lg,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.md,
  minWidth: 0,
};
const facts: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.xxs, color: colors.text.secondary, fontSize: typography.size.bodySm };
const skeleton: CSSProperties = { ...cardStyle, backgroundColor: colors.surface.sunken, minHeight: touchTarget.min * 3 };

export default function ParentHomePage(): JSX.Element {
  const { ready, session, api, signOut, m, locale } = useConsole();
  const router = useRouter();
  const [items, setItems] = useState<SpaceListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [rosters, setRosters] = useState<Record<string, FamilyRoster>>({});
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadRoster = useCallback(
    async (spaceId: string): Promise<void> => {
      if (!api) return;
      setRosters((prev) => ({ ...prev, [spaceId]: { state: 'loading' } }));
      const result = await api.roster(spaceId).catch(() => null);
      setRosters((prev) => ({ ...prev, [spaceId]: result?.ok ? { state: 'ready', roster: result.data } : { state: 'failed' } }));
    },
    [api],
  );

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setFailed(false);
    const result = await api.listSpaces();
    if (!result.ok) {
      setFailed(true);
      return;
    }
    setItems(result.data);
    const view = parentHomeView(result.data);
    if (view.state === 'families') await Promise.all(view.families.map((family) => loadRoster(family.space.id)));
  }, [api, loadRoster]);

  useEffect(() => {
    void load();
  }, [load]);

  const frameSpaces: FrameSpaces = !api || (failed && !items) ? 'failed' : items;
  if (!ready || !session) return <AdultFrame spaces={frameSpaces}>{null}</AdultFrame>;

  const c = m.console;
  const p = c.parentHome;
  const now = new Date();
  const flags: CardFlags = { reports: reportsEnabled(locale), notes: notesEnabled(), route: learningRouteEnabled() };
  const lessons = browseEntryShown(typeof window === 'undefined' ? '' : window.location.origin);
  const view = items ? parentHomeView(items) : null;
  const joinLine = p.empty.line(m.learner.home.profileLabel, m.caregiver.spaces.title, m.caregiver.spaces.join.cta);

  const toTeacher = (): void => {
    void writeLastPersona('teacher');
    router.push(personaHome('teacher'));
  };
  const copy = async (spaceId: string, code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(spaceId);
    } catch {
      setCopied(null);
    }
  };
  const createCode = async (spaceId: string): Promise<void> => {
    if (!api) return;
    const result = await api.regenerateCode(spaceId);
    if (!result.ok) return;
    setRosters((prev) => {
      const entry = prev[spaceId];
      return entry?.state === 'ready' ? { ...prev, [spaceId]: { state: 'ready', roster: { ...entry.roster, joinCode: result.data.joinCode, joinCodeExpiresAt: result.data.expiresAt } } } : prev;
    });
  };

  /** The family join code: the visible code is hidden from screen readers, which read the spaced copy one character at a time. */
  const joinPanel = (family: SpaceListItem, roster: Roster, id?: string): JSX.Element => (
    <section id={id} data-testid="join-panel" aria-label={c.space.codeLabel.family} style={{ ...panelStyle, margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.sm, padding: `${spacing.xl}px ${spacing.lg}px`, textAlign: 'center' }}>
      <span style={{ fontSize: typography.size.caption, fontWeight: typography.weight.semibold, color: colors.text.muted }}>{c.space.codeLabel.family}</span>
      {roster.joinCode ? (
        <>
          <span data-testid="join-code" aria-hidden={true} style={{ fontFamily: typography.family.mono, fontSize: typography.size.display, fontWeight: typography.weight.bold, letterSpacing: typography.tracking.wide }}>
            {roster.joinCode}
          </span>
          <span className="hr-ph-hidden">{roster.joinCode.split('').join(' ')}</span>
          <Button onClick={() => void copy(family.space.id, roster.joinCode as string)}>{copied === family.space.id ? c.joinCode.copied.cta : c.joinCode.copy.cta}</Button>
        </>
      ) : (
        <Button testId="create-code" onClick={() => void createCode(family.space.id)}>
          {c.space.createCode.cta}
        </Button>
      )}
      <p style={{ margin: 0, color: colors.text.secondary, maxWidth: layout.pane.master }}>{joinLine}</p>
    </section>
  );

  const card = (familyId: string, learner: RosterLearner): JSX.Element => {
    const actions = learnerCardActions(familyId, learner.id, flags);
    const label = (key: 'seeReport' | 'open' | 'sendNote' | 'route'): string => p.child[key];
    return (
      <article key={learner.id} data-testid="learner-card" aria-label={learner.displayName} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
          <AvatarChip avatar={learner.avatar} />
          <h3 style={{ margin: 0, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, overflowWrap: 'anywhere' }}>{learner.displayName}</h3>
        </div>
        <div style={facts}>
          <span>{c.space.learner.lastActive(relativeDay(learner.lastActiveAt, now, locale))}</span>
          <span>{p.minutes7d(learner.summary?.minutesLast7d ?? 0)}</span>
        </div>
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
    const expanded = openPanel === id;
    const actions = (
      <div className="hr-ph-actions">
        {lessons ? (
          <a href={BROWSE_PATH} style={button} data-testid="family-lessons">
            {p.actions.lessons}
          </a>
        ) : null}
        <Link href={links.planWeek} style={button} data-testid="family-plan-week">
          {p.actions.planWeek}
        </Link>
        <Link href={links.planTerm} style={button} data-testid="family-plan-term">
          {p.actions.planTerm}
        </Link>
        <Link href={links.settings} style={button} data-testid="family-settings">
          {p.actions.settings}
        </Link>
        {entry.state === 'ready' && !empty ? (
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
      </div>
    );
    return (
      <section key={id} aria-labelledby={headingId} className="hr-ph-family">
        <div className="hr-ph-main" aria-busy={entry.state === 'loading' ? true : undefined}>
          <h2 id={headingId} style={familyHeading}>
            {family.space.name}
          </h2>
          {entry.state === 'loading' ? (
            <div className="hr-ph-cards">
              <div style={skeleton} />
              <div style={skeleton} />
            </div>
          ) : null}
          {entry.state === 'failed' ? (
            <div style={{ ...panelStyle, margin: 0 }}>
              <p style={{ margin: `0 0 ${spacing.sm}px` }}>{c.cantReach}</p>
              <Button testId={`family-retry-${id}`} onClick={() => void loadRoster(id)}>
                {c.tryAgain}
              </Button>
            </div>
          ) : null}
          {entry.state === 'ready' && empty ? (
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
          {learners.length > 0 ? <div className="hr-ph-cards">{learners.map((learner) => card(id, learner))}</div> : null}
        </div>
        <aside aria-label={family.space.name} className="hr-ph-side">
          {actions}
          {expanded && entry.state === 'ready' ? joinPanel(family, entry.roster, panelId) : null}
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
