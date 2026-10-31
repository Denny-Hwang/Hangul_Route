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
import { rem } from '@/lib/console/rem';
import { announceRosterChange } from '@/lib/console/roster-broadcast';

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
 *
 * AMENDMENTS-GROWNUP-UX GX-2: Accept comes first (primary), as on every other incoming card, and the moves page draws the
 * asks under its one *Joining this class* heading (`incomingHere: false`, `TeacherMovesIncoming`).
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
  /** The page's reads and answers (`useTeacherMoves`), when the page also draws the incoming cards elsewhere. */
  moves?: TeacherMoves;
  /**
   * false: the asks into this class are drawn under the page's one *Joining this class* heading (GX-2, one incoming
   * list on the moves page), not here.
   */
  incomingHere?: boolean;
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
const h3: CSSProperties = { margin: `${spacing.lg}px 0 ${spacing.sm}px`, fontSize: rem(typography.size.body), fontWeight: typography.weight.bold };
const muted: CSSProperties = { margin: 0, color: colors.text.secondary, fontSize: rem(typography.size.body) };
const nudge: CSSProperties = { margin: 0, color: colors.text.primary, fontWeight: typography.weight.semibold, borderInlineStart: `${borderWidth.thick}px solid ${colors.feedback.nudge}`, paddingInlineStart: spacing.sm };

/** The section's reads and answers, shared by the section and the incoming cards drawn under *Joining this class*. */
export interface TeacherMoves {
  lists: ClassMoveLists | null;
  now: Date;
  busy: string | null;
  noRoom: ReadonlySet<string>;
  failed: string | null;
  act: (id: string, run: () => Promise<ApiResult<unknown>>) => Promise<void>;
}

/**
 * Reads the class's teacher moves on mount and every `refreshMs` while online, and answers them. `enabled: false` reads
 * nothing (a section that is handed its moves by the page).
 */
export function useTeacherMoves({
  spaceId,
  api,
  online,
  refreshMs,
  onPageState,
  enabled = true,
}: Omit<TeacherMovesSectionProps, 'readOnly' | 'moves' | 'incomingHere' | 'api'> & { api: TeacherMovesApi | null; enabled?: boolean }): TeacherMoves {
  const [lists, setLists] = useState<ClassMoveLists | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [noRoom, setNoRoom] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  // Set true in the effect body (AMENDMENTS-GROWNUP-UX GX-2): React's StrictMode mounts, unmounts and mounts again under
  // `next dev`, and a ref set false by that first cleanup and never set true again kept the section from ever drawing.
  const live = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // The latest page callback, read through a ref: a page that passes a new closure on each render never restarts the reads.
  const onPageStateRef = useRef(onPageState);
  onPageStateRef.current = onPageState;
  const pageState = useCallback((result: ApiResult<unknown>): boolean => {
    const err = moveError(result);
    if (err && (err.kind === 'locked' || err.kind === 'signIn' || err.kind === 'forbidden')) {
      onPageStateRef.current(err.kind);
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    const r = await api.classMoves(spaceId);
    if (!live.current) return;
    setNow(new Date());
    if (r.ok) setLists({ outgoing: [...r.data.outgoing].sort(moveOrder), incoming: [...r.data.incoming].sort(moveOrder) });
    else pageState(r);
  }, [api, spaceId, pageState]);

  useEffect(() => {
    if (!enabled || !api) return undefined;
    void load();
    const timer = setInterval(() => {
      if (online) void load();
    }, refreshMs);
    return () => clearInterval(timer);
  }, [load, online, refreshMs, enabled, api]);

  const act = async (id: string, run: () => Promise<ApiResult<unknown>>): Promise<void> => {
    if (busy || !online) return;
    setBusy(id);
    setFailed(null);
    const r = await run();
    // An ask answered (an accept moves a learner): an open roster in another console tab reads again at once, even when
    // this section has gone meanwhile (the teacher left the page while the answer was on its way).
    if (r.ok) announceRosterChange();
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

  return { lists, now, busy, noRoom, failed, act };
}

/** Another teacher's asks into this class that wait: one card each, **Accept** (primary, first) then **Not now**. */
export function TeacherMovesIncoming({ moves, spaceId, api, online, readOnly }: { moves: TeacherMoves; spaceId: string; api: TeacherMovesApi; online: boolean; readOnly: boolean }): JSX.Element | null {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.teacherMove.section;
  const { lists, now, busy, noRoom, failed, act } = moves;
  if (!lists) return null;
  const waitingIn = lists.incoming.filter((m) => m.status === 'waiting');
  if (waitingIn.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.md }}>
      {waitingIn.map((m) => {
        const alias = m.learner && 'alias' in m.learner ? m.learner : null;
        const level = alias ? levelPillLabel(alias.level, locale) : null;
        return (
          <article key={m.id} style={card} data-testid="teacher-move-incoming">
            <div style={row}>
              {alias ? <AvatarChip avatar={alias.avatar} /> : null}
              <strong style={{ fontSize: rem(typography.size.bodyLg) }}>{alias?.alias ?? ''}</strong>
              {level ? <span style={{ ...muted, fontSize: rem(typography.size.bodySm) }}>{level}</span> : null}
            </div>
            <p style={muted}>{t.from(m.from.name)}</p>
            <p style={muted}>{t.asked(relativeDay(m.createdAt, now, locale))}</p>
            {noRoom.has(m.id) ? <p style={nudge}>{t.noRoom}</p> : null}
            {failed === m.id ? <p style={nudge}>{t.failed}</p> : null}
            {readOnly ? null : (
              // Primary first, as on every incoming card (GX-2: the class page, the review sheet and the transfer cards).
              <div style={row}>
                <MoveButton primary waiting={busy === m.id} disabled={!online || (busy !== null && busy !== m.id)} onClick={() => void act(m.id, () => api.acceptClassMove(spaceId, m.id))} testId="teacher-move-accept">
                  {noRoom.has(m.id) ? t.tryAgain.cta : t.accept.cta}
                </MoveButton>
                <MoveButton disabled={!online || busy !== null} onClick={() => void act(m.id, () => api.declineClassMove(spaceId, m.id))} testId="teacher-move-not-now">
                  {t.notNow.cta}
                </MoveButton>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/** How many of another teacher's asks into this class wait (the *Joining this class* group's count). */
export function waitingIncomingCount(moves: TeacherMoves): number {
  return moves.lists?.incoming.filter((m) => m.status === 'waiting').length ?? 0;
}

export function TeacherMovesSection(props: TeacherMovesSectionProps): JSX.Element | null {
  const { spaceId, api, online, readOnly, incomingHere = true } = props;
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.teacherMove.section;
  const titleId = useId();
  const own = useTeacherMoves({ ...props, enabled: props.moves === undefined });
  const moves = props.moves ?? own;
  const { lists, now, busy, failed, act } = moves;

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
      <h2 id={titleId} style={{ margin: `${spacing.md}px 0 ${spacing.sm}px`, fontSize: rem(typography.size.bodyLg), fontWeight: typography.weight.bold }}>
        {t.title}
      </h2>

      {incomingHere ? (
        <>
          <h3 style={h3}>{t.incoming}</h3>
          {waitingIn.length === 0 ? <p style={muted}>{t.empty}</p> : null}
          <TeacherMovesIncoming moves={moves} spaceId={spaceId} api={api} online={online} readOnly={readOnly} />
        </>
      ) : null}

      <h3 style={h3}>{t.outgoing}</h3>
      {waitingOut.length === 0 ? <p style={muted}>{t.empty}</p> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        {waitingOut.map((m) => (
          <article key={m.id} style={card} data-testid="teacher-move-outgoing">
            <div style={row}>
              {m.learner ? <AvatarChip avatar={m.learner.avatar} /> : null}
              <strong style={{ fontSize: rem(typography.size.bodyLg) }}>{m.learner?.name ?? ''}</strong>
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
