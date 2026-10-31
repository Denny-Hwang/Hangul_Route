'use client';

import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BrowseLink } from '@/components/console/BrowseLink';
import { AdultFrame, type FrameSpaces } from '@/components/console/AdultFrame';
import { LectureModeCard } from '@/components/console/LectureModeCard';
import { Button, Muted, Notice, buttonBase, panelStyle } from '@/components/console/ui';
import { AttentionCountChip, SchoolAttentionLinks } from '@/components/console/AttentionCounts';
import { useApprovalsWaiting, useSchoolMoveLinks } from '@/components/console/MovesEntry';
import { useConsole } from '@/components/console/use-console';
import type { SpaceListItem } from '@/lib/console/api';
import { appUrl, browseEntryShown, lectureModeEnabled, reportsEnabled, notesEnabled } from '@/lib/console/config';
import { attentionDeployed } from '@/lib/console/persona-attention';
import { personaHome } from '@/lib/console/personas';
import { ROUTES, statusLine } from '@/lib/console/routing';
import { writeLastPersona } from '@/lib/console/shell-store';
import { START_CLASS, START_FAMILY, classRowLinks, teacherHomeView, teacherLectureCard, wantsSchoolFocus, withoutSchoolFocus } from '@/lib/console/teacher-home';
import { headRem, rem } from '@/lib/console/rem';

/**
 * The teacher home `/teach/home` (F-APP-001 A-5a, section 3.8; design mock
 * design/screens/app-shell/teacher-home.md, wireframe design/wireframes/shell/teacher-home.md).
 * Classes, then the School group; each class row's Class report and Notes by flag; + New class;
 * Lessons; the no-class state and the quiet cross-link. Counts only: no names of learners, no
 * percentages, no ranking (F-CONSOLE-001 section 3.4). [GX-3] AMENDMENTS-GROWNUP-UX section 6 (mock
 * `design/screens/approvals/mock/home-{lc}.html`): a class row gets the amber "{n} need your OK" chip after its name,
 * to the class page's review (`#attention`), counting its re-links (whatever CLASS_TRANSFER says) and the moves that wait
 * for it, teacher moves included; it replaces the row's "N class moves waiting" pill. A school row gets one link per
 * child class with requests waiting, from the school's `attention` read (GX-W); before GX-W the shipped T-6b links stay
 * (waiting moves, to the class's requests page). The counts come from the frame (`FrameAttentionContext`, read again
 * every 30 s while in view) once the Worker sends `attention`, else from the per-class lists once, on focus and when a
 * roster changes (`useApprovalsWaiting`, never on a timer).
 *
 * Lecture mode (AMENDMENTS-LECTURE-V2 E1, LV-5; design/screens/app-shell/lecture-card.md): the card first in the
 * content column, above Classes, at every width, from the first paint (Start waits for the spaces list); in the
 * no-class state after the set-up panel. Nothing while `lectureModeEnabled()` is off. The page heading (h1, the nav
 * name, visually hidden) comes before the card in the list and loading states, so the outline starts at h1 and the
 * card and the visible Classes and School headings are h2.
 *
 * [OA] `?focus=school` (the chooser's School row, AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 5.3, row OA-4b): once the
 * list is drawn, focus moves to the first school card (the browser scrolls to what has focus; nothing scrolls without
 * it) and the query is removed with `history.replaceState`, so a reload or a shared address does not repeat it.
 */

const smallButton: CSSProperties = {
  ...buttonBase,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: touchTarget.min,
  boxSizing: 'border-box',
  textDecoration: 'none',
};
const primaryButton: CSSProperties = { ...smallButton, backgroundColor: colors.brand.primary, borderColor: colors.brand.primary, color: colors.text.onPrimary };
const textLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: touchTarget.min,
  minWidth: touchTarget.min,
  paddingInline: spacing.sm,
  color: colors.brand.secondaryDark,
  fontWeight: typography.weight.semibold,
  textDecoration: 'underline',
  textUnderlineOffset: spacing.xs,
  background: 'none',
  border: 'none',
  fontSize: rem(typography.size.body),
  cursor: 'pointer',
};
const columnStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.xl, maxWidth: layout.maxWidth.reading };
const rowsStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.sm };
const headStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm };
/** The page's own heading (its nav name), read first by a screen reader: the Lecture mode card's h2 comes before the visible Classes heading. */
const visuallyHidden: CSSProperties = { position: 'absolute', width: borderWidth.thin, height: borderWidth.thin, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', margin: 0 };
const h1Style: CSSProperties = { margin: 0, fontSize: headRem(typography.size.title), lineHeight: typography.leading.tight, fontWeight: typography.weight.bold };
const groupTitle: CSSProperties = { margin: 0, fontSize: rem(typography.size.bodyLg), fontWeight: typography.weight.bold };

export default function HomePage(): JSX.Element {
  const { ready, session, api, signOut, m, locale } = useConsole();
  const router = useRouter();
  const [items, setItems] = useState<SpaceListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const homeView = items ? teacherHomeView(items) : null;
  // [GX-3] A class row's count: its re-links and its moves (teacher moves included). With GX-W's `attention` on the list
  // nothing more is asked here (the frame keeps it fresh); before it, the per-class lists, never on a timer.
  const deployed = !!items && attentionDeployed(items);
  const listAttention = items && deployed ? Object.fromEntries(items.map((item) => [item.space.id, item.attention])) : undefined;
  const moves = useApprovalsWaiting(api, homeView?.classRows.map((item) => item.space.id) ?? [], 0, listAttention ? { attention: listAttention } : {});
  const schoolMoves = useSchoolMoveLinks(api, deployed ? [] : (homeView?.schoolRows.map((item) => item.space.id) ?? []));
  // [OA] Row OA-4b: read once, on the first render in the browser.
  const [schoolFocus] = useState(() => typeof window !== 'undefined' && wantsSchoolFocus(new URLSearchParams(window.location.search)));
  const focusDone = useRef(false);
  const firstSchoolCard = useRef<HTMLElement | null>(null);
  const firstSchoolId = homeView?.schoolRows[0]?.space.id ?? null;
  const drawn = ready && !!session && homeView !== null;

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setFailed(false);
    const result = await api.listSpaces();
    if (result.ok) setItems(result.data);
    else setFailed(true);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!schoolFocus || focusDone.current || !drawn) return;
    focusDone.current = true;
    firstSchoolCard.current?.focus();
    const { pathname, search, hash } = window.location;
    const cleaned = withoutSchoolFocus(search, pathname, hash);
    if (cleaned !== null) window.history.replaceState(window.history.state, '', cleaned);
  }, [schoolFocus, drawn, firstSchoolId]);

  const frameSpaces: FrameSpaces = !api || (failed && !items) ? 'failed' : items;
  if (!ready || !session) return <AdultFrame spaces={frameSpaces}>{null}</AdultFrame>;
  const c = m.console;
  const flags = { reports: reportsEnabled(locale), notes: notesEnabled() };
  const view = homeView;

  const toFamily = (): void => {
    void writeLastPersona('parent');
    router.push(personaHome('parent'));
  };
  const lessons = browseEntryShown(typeof window === 'undefined' ? '' : window.location.origin);
  const lectureView = teacherLectureCard(frameSpaces, { enabled: lectureModeEnabled(), appUrl: appUrl() });
  const lectureCard = <LectureModeCard view={lectureView} persona="teacher" />;

  const row = (item: SpaceListItem): JSX.Element => {
    const archived = !!item.space.archivedAt;
    const links = classRowLinks(item, flags);
    const waiting = moves[item.space.id]?.all;
    const schoolLinks = schoolMoves[item.space.id] ?? [];
    return (
      <article
        key={item.space.id}
        data-testid={`space-row-${item.space.id}`}
        // [OA] The School focus target (row OA-4b): focusable by script only, never a tab stop.
        {...(item.space.id === firstSchoolId ? { ref: firstSchoolCard, tabIndex: -1 } : {})}
        style={{
          backgroundColor: archived ? colors.surface.sunken : colors.surface.paper,
          border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
          borderRadius: radii.lg,
          padding: `${spacing.md}px ${spacing.lg}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.sm,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xs }}>
              <p style={{ margin: 0, fontWeight: typography.weight.bold, overflowWrap: 'anywhere', color: archived ? colors.text.secondary : colors.text.primary }}>
                {item.space.name}
                {archived ? <span style={{ color: colors.text.muted, fontSize: rem(typography.size.bodySm) }}> {c.home.archived}</span> : null}
              </p>
              {item.space.kind === 'class' && !archived ? <AttentionCountChip spaceId={item.space.id} fallback={waiting} /> : null}
            </div>
            <p style={{ margin: 0, color: colors.text.secondary, fontSize: rem(typography.size.bodySm) }}>{statusLine(item, locale)}</p>
          </div>
          <Link href={ROUTES.space(item.space.id, item.space.kind)} style={smallButton}>
            {c.home.open.cta}
          </Link>
        </div>
        {links.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm, borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}` }}>
            {links.map((link) =>
              link === 'classReport' ? (
                <Link key={link} href={ROUTES.classReport({ spaceId: item.space.id, kind: item.space.kind })} style={smallButton} data-testid={`class-report-${item.space.id}`}>
                  {c.home.classReport}
                </Link>
              ) : (
                <Link key={link} href={ROUTES.spaceNotes(item.space.id, 'class')} style={smallButton} data-testid={`class-notes-${item.space.id}`}>
                  {c.home.notes}
                </Link>
              ),
            )}
          </div>
        ) : null}
        {item.space.kind === 'school' ? <SchoolAttentionLinks schoolId={item.space.id} fallback={schoolLinks} /> : null}
      </article>
    );
  };

  const group = (id: string, heading: string, rows: SpaceListItem[]): JSX.Element | null =>
    rows.length > 0 ? (
      <section aria-labelledby={id} style={rowsStyle}>
        <h2 id={id} style={groupTitle}>
          {heading}
        </h2>
        <div style={rowsStyle}>{rows.map(row)}</div>
      </section>
    ) : null;

  const crossLink =
    view?.cross === 'addFamily' ? (
      <p style={{ margin: 0, color: colors.text.secondary }}>
        <Link href={START_FAMILY} style={textLink} data-testid="cross-add-family">
          {c.home.cross.addFamily}
        </Link>
      </p>
    ) : view?.cross === 'toFamily' ? (
      <p style={{ margin: 0, color: colors.text.secondary }}>
        <button type="button" onClick={toFamily} style={textLink} data-testid="cross-to-family">
          {c.home.cross.toFamily}
        </button>
      </p>
    ) : null;

  return (
    <AdultFrame onSignOut={signOut} spaces={frameSpaces}>
      {!api ? <Notice tone="nudge">{c.shell.noApi}</Notice> : null}
      {failed ? (
        <div style={{ ...panelStyle, marginBottom: spacing.md }}>
          <p style={{ margin: 0 }}>{c.cantReach}</p>
          <Muted>{items ? c.home.lastList : ''}</Muted>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}
      {view?.state === 'noClass' ? (
        <div style={columnStyle}>
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: spacing.md, padding: `${spacing.xl}px ${spacing.lg}px` }}>
            <h1 style={{ ...h1Style, fontSize: rem(typography.size.prompt) }}>{c.home.noClass.title}</h1>
            <Link href={START_CLASS} style={primaryButton} data-testid="no-class-set-up">
              {c.home.noClass.setUp}
            </Link>
            {view.goFamily ? (
              <Link href={personaHome('parent')} style={smallButton} data-testid="no-class-go-family">
                {c.home.noClass.goFamily}
              </Link>
            ) : null}
          </div>
          {lectureCard}
          {crossLink}
        </div>
      ) : null}
      {!view && lectureView ? (
        <div style={columnStyle}>
          <h1 style={visuallyHidden}>{c.shell.nav.classes}</h1>
          {lectureCard}
        </div>
      ) : null}
      {view?.state === 'list' ? (
        <div style={columnStyle}>
          <h1 style={visuallyHidden}>{c.shell.nav.classes}</h1>
          {lectureCard}
          <div style={headStyle}>
            <h2 style={h1Style}>{c.kind.group.class}</h2>
            <Link href={START_CLASS} style={view.newClassPrimary ? primaryButton : smallButton} data-testid="new-class">
              {c.home.newClass.cta}
            </Link>
          </div>
          {view.classRows.length > 0 ? <div style={rowsStyle}>{view.classRows.map(row)}</div> : null}
          {group('home-school', c.kind.group.school, view.schoolRows)}
          {lessons ? (
            <span style={{ alignSelf: 'flex-start' }}>
              <BrowseLink source="nav" label={c.home.lessons} testId="home-lessons" style={smallButton} />
            </span>
          ) : null}
          {crossLink}
        </div>
      ) : null}
    </AdultFrame>
  );
}
