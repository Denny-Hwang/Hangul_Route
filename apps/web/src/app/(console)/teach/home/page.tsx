'use client';

import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AdultFrame, type FrameSpaces } from '@/components/console/AdultFrame';
import { Button, Muted, Notice, buttonBase, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { SpaceListItem } from '@/lib/console/api';
import { browseEntryEnabled, reportsEnabled, notesEnabled } from '@/lib/console/config';
import { FAMILY_HOME_LIVE, personaHome } from '@/lib/console/personas';
import { ROUTES, statusLine } from '@/lib/console/routing';
import { writeLastPersona } from '@/lib/console/shell-store';
import { lessonsUrl } from '@/lib/console/shell-nav';
import { START_CLASS, START_FAMILY, classRowLinks, teacherHomeView } from '@/lib/console/teacher-home';

/**
 * The teacher home `/teach/home` (F-APP-001 A-5a, section 3.8; design mock
 * design/screens/app-shell/teacher-home.md, wireframe design/wireframes/shell/teacher-home.md).
 * Classes, then the School group; each class row's Class report and Notes by flag; + New class;
 * Lessons; the no-class state and the quiet cross-link. Counts only: no names of learners, no
 * percentages, no ranking (F-CONSOLE-001 section 3.4).
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
  fontSize: typography.size.body,
  cursor: 'pointer',
};
const columnStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.xl, maxWidth: layout.maxWidth.reading };
const rowsStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.sm };
const headStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm };
const h1Style: CSSProperties = { margin: 0, fontSize: typography.size.title, lineHeight: typography.leading.tight, fontWeight: typography.weight.bold };
const groupTitle: CSSProperties = { margin: 0, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold };

export default function HomePage(): JSX.Element {
  const { ready, session, api, signOut, m, locale } = useConsole();
  const router = useRouter();
  const [items, setItems] = useState<SpaceListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

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

  const frameSpaces: FrameSpaces = !api || (failed && !items) ? 'failed' : items;
  if (!ready || !session) return <AdultFrame spaces={frameSpaces}>{null}</AdultFrame>;
  const c = m.console;
  const flags = { reports: reportsEnabled(locale), notes: notesEnabled() };
  const view = items ? teacherHomeView(items, FAMILY_HOME_LIVE) : null;

  const toFamily = (): void => {
    void writeLastPersona('parent');
    router.push(personaHome('parent', FAMILY_HOME_LIVE));
  };
  const openLessons = (): void => window.location.assign(lessonsUrl(window.location.origin));

  const row = (item: SpaceListItem): JSX.Element => {
    const archived = !!item.space.archivedAt;
    const links = classRowLinks(item, flags);
    return (
      <article
        key={item.space.id}
        data-testid={`space-row-${item.space.id}`}
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
          <div>
            <p style={{ margin: 0, fontWeight: typography.weight.bold, overflowWrap: 'anywhere', color: archived ? colors.text.secondary : colors.text.primary }}>
              {item.space.name}
              {archived ? <span style={{ color: colors.text.muted, fontSize: typography.size.bodySm }}> {c.home.archived}</span> : null}
            </p>
            <p style={{ margin: 0, color: colors.text.secondary, fontSize: typography.size.bodySm }}>{statusLine(item, locale)}</p>
          </div>
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
            {item.space.kind === 'family' && !archived ? (
              <Link href={ROUTES.spaceCurriculum(item.space.id)} style={smallButton}>
                {c.curriculum.entries.planTerm.cta}
              </Link>
            ) : null}
            <Link href={ROUTES.space(item.space.id)} style={smallButton}>
              {c.home.open.cta}
            </Link>
          </div>
        </div>
        {links.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm, borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}` }}>
            {links.map((link) =>
              link === 'classReport' ? (
                <Link key={link} href={ROUTES.classReport({ spaceId: item.space.id })} style={smallButton} data-testid={`class-report-${item.space.id}`}>
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
            <h1 style={{ ...h1Style, fontSize: typography.size.prompt }}>{c.home.noClass.title}</h1>
            <Link href={START_CLASS} style={primaryButton} data-testid="no-class-set-up">
              {c.home.noClass.setUp}
            </Link>
            {view.goFamily ? (
              <Link href={personaHome('parent', FAMILY_HOME_LIVE)} style={smallButton} data-testid="no-class-go-family">
                {c.home.noClass.goFamily}
              </Link>
            ) : null}
          </div>
          {crossLink}
        </div>
      ) : null}
      {view?.state === 'list' ? (
        <div style={columnStyle}>
          <div style={headStyle}>
            <h1 style={h1Style}>{c.kind.group.class}</h1>
            <Link href={START_CLASS} style={view.newClassPrimary ? primaryButton : smallButton} data-testid="new-class">
              {c.home.newClass.cta}
            </Link>
          </div>
          {view.classRows.length > 0 ? <div style={rowsStyle}>{view.classRows.map(row)}</div> : null}
          {group('home-family', c.kind.group.family, view.familyRows)}
          {group('home-school', c.kind.group.school, view.schoolRows)}
          {browseEntryEnabled() ? (
            <button type="button" onClick={openLessons} style={{ ...smallButton, alignSelf: 'flex-start' }} data-testid="home-lessons">
              {c.home.lessons}
            </button>
          ) : null}
          {crossLink}
        </div>
      ) : null}
    </AdultFrame>
  );
}
