'use client';

import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { AvatarChip } from '@/components/AvatarChip';
import type { ApiResult, ConsoleApi } from '@/lib/console/api';
import { moveError, moveOrder, type ClassMoveLists, type IncomingMove, type OutgoingMove } from '@/lib/console/class-moves';
import { levelPillLabel } from '@/lib/console/level-label';
import { relativeDay } from '@/lib/console/rollup';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { MoveButton } from './TransferParts';

/**
 * [TV] "Teacher moves" on the class moves page (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D8; wireframe
 * `design/wireframes/console/teacher-move-and-scope.md` screen 2, mock notes `design/screens/class-moves/README.md`).
 *
 * - *Asked to join this class*: another teacher's ask, with initials, a picture and a level only (no name, no learner
 *   id: F-SPACE-002 T8) and the class it comes from; **Accept** or **Not now**. No room: one amber line and
 *   **Try again**, never red.
 * - *Sent from this class*: an ask that waits, with **Cancel**.
 * - *Done*: moves of the last 30 days. An ended move is one neutral line with a date and no actor or reason.
 * Refreshed on a timer; nothing auto-dismisses; every word comes from `console.teacherMove.section`.
 */

export type TeacherMovesApi = Pick<ConsoleApi, 'classMoves' | 'acceptClassMove' | 'declineClassMove' | 'cancelClassMove'>;

export interface TeacherMovesSectionProps {
  spaceId: string;
  api: TeacherMovesApi;
  online: boolean;
  /** An archived class reads its history only. */
  readOnly: boolean;
  refreshMs: number;
  onPageState: (state: 'locked' | 'signIn' | 'forbidden') => void;
}

const card: CSSProperties = {
  backgroundColor: colors.surface.paper,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  borderRadius: radii.md,
  padding: spacing.md,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.sm,
};
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' };
const h3: CSSProperties = { margin: `${spacing.lg}px 0 ${spacing.sm}px`, fontSize: typography.size.body, fontWeight: typography.weight.bold };
const muted: CSSProperties = { margin: 0, color: colors.text.secondary, fontSize: typography.size.body };
const nudge: CSSProperties = { margin: 0, color: colors.text.primary, fontWeight: typography.weight.semibold, borderInlineStart: `${borderWidth.thick}px solid ${colors.feedback.nudge}`, paddingInlineStart: spacing.sm };

export function TeacherMovesSection({ spaceId, api, online, readOnly, refreshMs, onPageState }: TeacherMovesSectionProps): JSX.Element | null {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.teacherMove.section;
  const titleId = useId();
  const [lists, setLists] = useState<ClassMoveLists | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [noRoom, setNoRoom] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  const pageState = useCallback(
    (result: ApiResult<unknown>): boolean => {
      const err = moveError(result);
      if (err && (err.kind === 'locked' || err.kind === 'signIn' || err.kind === 'forbidden')) {
        onPageState(err.kind);
        return true;
      }
      return false;
    },
    [onPageState],
  );

  const load = useCallback(async (): Promise<void> => {
    const r = await api.classMoves(spaceId);
    if (!live.current) return;
    setNow(new Date());
    if (r.ok) setLists({ outgoing: [...r.data.outgoing].sort(moveOrder), incoming: [...r.data.incoming].sort(moveOrder) });
    else pageState(r);
  }, [api, spaceId, pageState]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (online) void load();
    }, refreshMs);
    return () => clearInterval(timer);
  }, [load, online, refreshMs]);

  const act = async (id: string, run: () => Promise<ApiResult<unknown>>): Promise<void> => {
    if (busy || !online) return;
    setBusy(id);
    setFailed(null);
    const r = await run();
    if (!live.current) return;
    setBusy(null);
    if (r.ok) {
      setNoRoom((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await load();
      return;
    }
    if (pageState(r)) return;
    if (r.code === 'move_blocked') {
      setNoRoom((prev) => new Set(prev).add(id));
      return;
    }
    // An ask that ended meanwhile: show the list as it is now.
    if (r.code === 'not_open' || r.code === 'expired') {
      await load();
      return;
    }
    setFailed(id);
  };

  if (!lists) return null;
  const waitingIn = lists.incoming.filter((m) => m.status === 'waiting');
  const waitingOut = lists.outgoing.filter((m) => m.status === 'waiting');
  const doneRows: Array<{ id: string; text: string; at: string | null }> = [
    ...lists.incoming.filter((m) => m.status !== 'waiting').map((m) => ({ id: m.id, text: incomingDone(m), at: m.at })),
    ...lists.outgoing.filter((m) => m.status !== 'waiting').map((m) => ({ id: m.id, text: outgoingDone(m), at: m.at })),
  ].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

  function incomingDone(m: IncomingMove): string {
    if (m.status === 'moved' && m.learner && 'name' in m.learner) return t.joined(m.learner.name);
    return t.ended;
  }
  function outgoingDone(m: OutgoingMove): string {
    return m.status === 'moved' ? t.movedOut(m.to.name) : t.ended;
  }

  return (
    <section aria-labelledby={titleId} data-testid="teacher-moves" style={{ marginBottom: spacing.xl }}>
      <h2 id={titleId} style={{ margin: `${spacing.md}px 0 ${spacing.sm}px`, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold }}>
        {t.title}
      </h2>

      <h3 style={h3}>{t.incoming}</h3>
      {waitingIn.length === 0 ? <p style={muted}>{t.empty}</p> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        {waitingIn.map((m) => {
          const alias = m.learner && 'alias' in m.learner ? m.learner : null;
          const level = alias ? levelPillLabel(alias.level, locale) : null;
          return (
            <article key={m.id} style={card} data-testid="teacher-move-incoming">
              <div style={row}>
                {alias ? <AvatarChip avatar={alias.avatar} /> : null}
                <strong style={{ fontSize: typography.size.bodyLg }}>{alias?.alias ?? ''}</strong>
                {level ? <span style={{ ...muted, fontSize: typography.size.bodySm }}>{level}</span> : null}
              </div>
              <p style={muted}>{t.from(m.from.name)}</p>
              <p style={muted}>{t.asked(relativeDay(m.createdAt, now, locale))}</p>
              {noRoom.has(m.id) ? <p style={nudge}>{t.noRoom}</p> : null}
              {failed === m.id ? <p style={nudge}>{t.failed}</p> : null}
              {readOnly ? null : (
                <div style={row}>
                  <MoveButton disabled={!online || busy !== null} onClick={() => void act(m.id, () => api.declineClassMove(spaceId, m.id))} testId="teacher-move-not-now">
                    {t.notNow.cta}
                  </MoveButton>
                  <MoveButton primary waiting={busy === m.id} disabled={!online || (busy !== null && busy !== m.id)} onClick={() => void act(m.id, () => api.acceptClassMove(spaceId, m.id))} testId="teacher-move-accept">
                    {noRoom.has(m.id) ? t.tryAgain.cta : t.accept.cta}
                  </MoveButton>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <h3 style={h3}>{t.outgoing}</h3>
      {waitingOut.length === 0 ? <p style={muted}>{t.empty}</p> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        {waitingOut.map((m) => (
          <article key={m.id} style={card} data-testid="teacher-move-outgoing">
            <div style={row}>
              {m.learner ? <AvatarChip avatar={m.learner.avatar} /> : null}
              <strong style={{ fontSize: typography.size.bodyLg }}>{m.learner?.name ?? ''}</strong>
            </div>
            <p style={muted}>{t.to(m.to.name)}</p>
            <p style={muted}>{t.waitingOther}</p>
            {failed === m.id ? <p style={nudge}>{t.failed}</p> : null}
            {readOnly ? null : (
              <div style={row}>
                <MoveButton waiting={busy === m.id} disabled={!online || (busy !== null && busy !== m.id)} onClick={() => void act(m.id, () => api.cancelClassMove(spaceId, m.id))} testId="teacher-move-cancel-ask">
                  {t.cancel.cta}
                </MoveButton>
              </div>
            )}
          </article>
        ))}
      </div>

      {doneRows.length > 0 ? (
        <>
          <h3 style={h3}>{t.done}</h3>
          <ul style={{ margin: 0, paddingInlineStart: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {doneRows.map((r) => (
              <li key={r.id} style={muted} data-testid="teacher-move-done-row">
                {r.text} {r.at ? relativeDay(r.at, now, locale) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
