'use client';

import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { formatDate } from '@hangul-route/i18n';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AvatarChip } from '@/components/AvatarChip';
import { MoveButton } from '@/components/console/TransferParts';
import type { ApiResult, ConsoleApi, TransferDestinationView, TransferSourceView, TransferView } from '@/lib/console/api';
import { levelPillLabel } from '@/lib/console/level-label';
import { canCancel, daysLeft, daysSince, slotLabel, statusLine, stepWord } from '@/lib/console/transfer';
import { actionOutcome, canAgreeBoth, classMoveGroups, historyDate, ownAnswerWaits, retryShown, type ClassView } from '@/lib/console/transfer-requests';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The class requests page's body (F-SPACE-002 section 4.8 "Requests page", PR T-6b): *Leaving this class* (source)
 * and *Joining this class* (destination), each with its 30-day history. Design authority: the T-0b mockups
 * (`design/screens/transfer/requests-page.md`, `mock/requests.html`, `mock/requests-states.html`; spec section 7 row
 * T-0b, owner decision 2026-10-12: agent-made mocks approved by multi-agent review). Cards show waiting / yes /
 * scheduled / ended only; no card names who said no; the destination never learns the source's answer (it draws no
 * steps). Tokens only; the room block uses the amber nudge, never the danger colour. Every word comes from
 * `console.transfer` (`useConsoleLocale`).
 */

export type ClassMovesApi = Pick<ConsoleApi, 'transferRequests' | 'approveTransfer' | 'declineTransfer' | 'cancelTransfer' | 'retryTransfer' | 'regenerateCode'>;
export type ClassPageState = 'locked' | 'signIn' | 'forbidden';

export interface ClassMovesProps {
  /** The class (the acting space); the URL carries this id only (T14). */
  spaceId: string;
  spaceName: string;
  api: ClassMovesApi;
  online: boolean;
  refreshMs: number;
  /** An archived class: no Agree, Accept, Cancel or Try again; the history stays. */
  readOnly: boolean;
  /** Classes this account owns or teaches directly (`directClassIds`), for Agree for both classes (T11). */
  direct: ReadonlySet<string>;
  /** The regenerate flow's confirm (the roster's `window.confirm`). */
  confirm: (question: string) => boolean;
  onPageState: (state: ClassPageState) => void;
}

// ---------------------------------------------------------------------------
// Styles (requests-page.md "Tokens")

/** `shadows.card` (a React Native shadow tuple) as a CSS box shadow: the colour token with the token's opacity as alpha. */
const CARD_SHADOW = `0 ${shadows.card.shadowOffset.height}px ${shadows.card.shadowRadius}px ${shadows.card.shadowColor}${Math.round(shadows.card.shadowOpacity * 255)
  .toString(16)
  .padStart(2, '0')}`;

const cardStyle: CSSProperties = {
  backgroundColor: colors.surface.paper,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  borderRadius: radii.lg,
  boxShadow: CARD_SHADOW,
  padding: spacing.lg,
  marginBottom: spacing.md,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.md,
};
const h2Style: CSSProperties = { fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, margin: `${spacing.lg}px 0 ${spacing.sm}px` };
const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' };
const metaStyle: CSSProperties = { ...rowStyle, columnGap: spacing.md, fontSize: typography.size.bodySm, color: colors.text.secondary };
const lineStyle: CSSProperties = { margin: 0, fontSize: typography.size.body, lineHeight: typography.leading.relaxed, color: colors.text.primary };
const sunkenStyle: CSSProperties = { margin: `0 0 ${spacing.md}px`, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.sunken, color: colors.text.primary };
const roomBlockStyle: CSSProperties = {
  ...rowStyle,
  flexWrap: 'nowrap',
  margin: 0,
  padding: spacing.md,
  borderRadius: radii.md,
  backgroundColor: colors.feedback.nudgeLight,
  borderInlineStart: `${borderWidth.thick}px solid ${colors.feedback.nudge}`,
  color: colors.text.primary,
};
const stepStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: spacing.sm,
  minHeight: spacing.xxxl,
  borderBottom: `${borderWidth.thin}px solid ${colors.border.subtle}`,
};
const quietButton: CSSProperties = {
  minHeight: touchTarget.min,
  minWidth: touchTarget.min,
  padding: `${spacing.sm}px ${spacing.lg}px`,
  border: 'none',
  background: 'none',
  color: colors.text.secondary,
  fontSize: typography.size.body,
  fontWeight: typography.weight.bold,
  cursor: 'pointer',
  marginInlineStart: 'auto',
};
const pillStyle: CSSProperties = {
  fontSize: typography.size.caption,
  color: colors.text.muted,
  padding: `${spacing.xxs}px ${spacing.sm}px`,
  backgroundColor: colors.surface.sunken,
  borderRadius: radii.pill,
};
const hidden: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

/** Steps from 45em are three boxes side by side (requests-page.md "Steps"); one per row on phones. */
const STEPS_CSS = `@media (min-width:45em){.hr-move-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${spacing.sm}px}.hr-move-steps>li{border:${borderWidth.thin}px solid ${colors.border.subtle};border-radius:${radii.md}px;padding:${spacing.sm}px}}`;

// ---------------------------------------------------------------------------
// Parts

function Steps({ view }: { view: TransferSourceView }): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.transfer;
  return (
    <ol className="hr-move-steps" aria-label={t.a11y.steps} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {(['learner', 'source', 'destination'] as const).map((slot) => {
        const word = stepWord(slot, view, locale);
        const yes = word !== t.steps.waiting;
        return (
          <li key={slot} style={stepStyle}>
            <IconSvg name={yes ? 'check' : 'dash'} size={20} color={yes ? colors.feedback.successDark : colors.text.muted} />
            <span style={{ fontWeight: typography.weight.semibold }}>{slotLabel(slot, view, locale)}</span>
            <span style={{ color: yes ? colors.feedback.successDark : colors.text.muted, fontWeight: yes ? typography.weight.semibold : typography.weight.regular }}>{word}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** The card's one status line: the room block (plain text, never a live region), the scheduled line or a sentence. */
function CardLine({ view, now }: { view: ClassView; now: Date }): JSX.Element | null {
  const { locale } = useConsoleLocale();
  const line = statusLine(view, now, locale);
  if (!line) return null;
  if (view.status === 'approved' && view.blockReason) {
    return (
      <p style={roomBlockStyle} data-testid="move-room-block">
        <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0 }}>
          <IconSvg name="pause" size={20} color={colors.text.primary} />
        </span>
        <span>{line}</span>
      </p>
    );
  }
  if (view.status === 'approved') {
    return (
      <p style={{ ...rowStyle, ...lineStyle, flexWrap: 'nowrap' }}>
        <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0 }}>
          <IconSvg name="check-circle" size={20} color={colors.feedback.successDark} />
        </span>
        <span>{line}</span>
      </p>
    );
  }
  return <p style={lineStyle}>{line}</p>;
}

type Note = { kind: 'failed'; again: () => void } | { kind: 'changed' };

interface CardProps {
  view: ClassView;
  now: Date;
  busy: boolean;
  online: boolean;
  readOnly: boolean;
  direct: ReadonlySet<string>;
  note: Note | null;
  run: (view: ClassView, call: () => Promise<ApiResult<unknown>>) => void;
  api: ClassMovesApi;
  spaceId: string;
  onRefresh: () => void;
}

function CardNote({ note, onRefresh }: { note: Note; onRefresh: () => void }): JSX.Element {
  const { messages } = useConsoleLocale();
  const t = messages.console.transfer;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: spacing.sm }}>
      <p role="alert" style={{ ...lineStyle, fontWeight: typography.weight.semibold }}>
        {note.kind === 'failed' ? t.states.failed : t.states.changed}
      </p>
      {note.kind === 'failed' ? (
        <MoveButton primary onClick={note.again} testId="move-try-again">
          {t.actions.tryAgain.cta}
        </MoveButton>
      ) : (
        <MoveButton primary onClick={onRefresh} testId="move-refresh">
          {t.actions.refresh.cta}
        </MoveButton>
      )}
    </div>
  );
}

function SourceCard({ view, now, busy, online, readOnly, direct, note, run, api, spaceId, onRefresh }: CardProps & { view: TransferSourceView }): JSX.Element {
  const { messages } = useConsoleLocale();
  const t = messages.console.transfer;
  const whoId = useId();
  const open = view.status === 'requested' || !!view.blockReason;
  const scheduled = view.status === 'approved' && !view.blockReason;
  const days = daysSince(view.createdAt, now);
  const answers = !readOnly && ownAnswerWaits(view);
  const both = answers && canAgreeBoth(view, direct);
  const cancel = !readOnly && canCancel(view);
  const off = busy || !online;
  return (
    <article style={cardStyle} aria-labelledby={whoId} data-testid="move-card" data-move-card="">
      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <span style={rowStyle}>
          {view.learner ? <AvatarChip avatar={view.learner.avatar} /> : null}
          <strong id={whoId} style={{ fontSize: typography.size.bodyLg }}>
            {view.learner?.name ?? ''}
          </strong>
        </span>
        {open ? (
          <span style={metaStyle}>
            <span>{view.initiator === 'source' ? t.meta.asked(days) : t.meta.askedByFamily(days)}</span>
            {view.initiator === 'source' ? <span>{t.meta.daysLeft(daysLeft(view.expiresAt, now))}</span> : null}
          </span>
        ) : null}
      </div>
      {!scheduled && view.steps ? <Steps view={view} /> : null}
      <CardLine view={view} now={now} />
      {view.initiator === 'source' && view.destination && view.status === 'requested' && view.steps?.learner === 'waiting' ? (
        <p style={lineStyle}>{t.lines.newClass(view.destination.name)}</p>
      ) : null}
      {view.agreedBySchoolAdmin ? <p style={lineStyle}>{t.lines.agreedBySchoolAdmin}</p> : null}
      {note ? <CardNote note={note} onRefresh={onRefresh} /> : null}
      {!note && (answers || cancel) ? (
        <div style={rowStyle}>
          {answers ? (
            <>
              <MoveButton primary disabled={off} onClick={() => run(view, () => api.approveTransfer(spaceId, view.id, { slots: both ? ['source', 'destination'] : ['source'] }))} testId="move-agree">
                {both ? t.actions.agreeBoth.cta : t.actions.agree.cta}
              </MoveButton>
              <span style={{ marginInlineStart: 'auto' }}>
                <MoveButton disabled={off} onClick={() => run(view, () => api.declineTransfer(spaceId, view.id, { slot: 'source' }))} testId="move-not-now">
                  {t.actions.notNow.cta}
                </MoveButton>
              </span>
            </>
          ) : (
            <button type="button" disabled={off} onClick={off ? undefined : () => run(view, () => api.cancelTransfer(spaceId, view.id))} style={quietButton} data-testid="move-cancel">
              {t.actions.cancelRequest.cta}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}

function DestinationCard({ view, now, busy, online, readOnly, note, run, api, spaceId, onRefresh }: CardProps & { view: TransferDestinationView }): JSX.Element {
  const { messages } = useConsoleLocale();
  const t = messages.console.transfer;
  const whoId = useId();
  const reasonsId = useId();
  const [reasons, setReasons] = useState(false);
  const answers = !readOnly && ownAnswerWaits(view);
  const retry = !readOnly && retryShown(view);
  const off = busy || !online;
  const level = view.learner ? levelPillLabel(view.learner.level) : null;
  const decline = (reason: 'not_now' | 'no_room'): void => run(view, () => api.declineTransfer(spaceId, view.id, { slot: 'destination', reason }));
  return (
    <article style={cardStyle} aria-labelledby={whoId} data-testid="move-card" data-move-card="">
      <div style={rowStyle}>
        {view.learner ? <AvatarChip avatar={view.learner.avatar} /> : null}
        <strong id={whoId} style={{ fontSize: typography.size.bodyLg, letterSpacing: typography.tracking.wide }}>
          {view.learner?.name ?? ''}
        </strong>
        {level ? <span style={pillStyle}>{level}</span> : null}
      </div>
      {view.comingFrom && answers ? <p style={lineStyle}>{t.lines.comingFrom(view.comingFrom.name)}</p> : null}
      <CardLine view={view} now={now} />
      {view.agreedBySchoolAdmin ? <p style={lineStyle}>{t.lines.agreedBySchoolAdmin}</p> : null}
      {note ? <CardNote note={note} onRefresh={onRefresh} /> : null}
      {!note && answers ? (
        <>
          <div style={rowStyle}>
            <MoveButton primary disabled={off} onClick={() => run(view, () => api.approveTransfer(spaceId, view.id, { slots: ['destination'] }))} testId="move-accept">
              {t.actions.accept.cta}
            </MoveButton>
            <button
              type="button"
              aria-expanded={reasons}
              aria-controls={reasonsId}
              aria-label={t.a11y.notNowReasons}
              disabled={off}
              onClick={off ? undefined : () => setReasons((r) => !r)}
              style={{
                ...rowStyle,
                flexWrap: 'nowrap',
                minHeight: touchTarget.min,
                minWidth: touchTarget.min,
                padding: `${spacing.sm}px ${spacing.xl}px`,
                borderRadius: radii.pill,
                border: `${borderWidth.thin}px solid ${colors.border.strong}`,
                backgroundColor: reasons ? colors.surface.sunken : colors.surface.paper,
                color: colors.text.primary,
                fontSize: typography.size.body,
                fontWeight: typography.weight.bold,
                cursor: 'pointer',
              }}
              data-testid="move-not-now-reasons"
            >
              <span>{t.actions.notNow.cta}</span>
              <span aria-hidden style={{ display: 'inline-flex', transform: reasons ? 'rotate(90deg)' : undefined }}>
                <IconSvg name="arrow-right" size={20} color={colors.text.secondary} />
              </span>
            </button>
          </div>
          {reasons ? (
            <div id={reasonsId} role="group" aria-label={t.a11y.reasons} style={{ ...rowStyle, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.sunken }}>
              <MoveButton disabled={off} onClick={() => decline('not_now')} testId="move-reason-not-now">
                {t.actions.notNow.cta}
              </MoveButton>
              <MoveButton disabled={off} onClick={() => decline('no_room')} testId="move-no-room">
                {t.actions.noRoom.cta}
              </MoveButton>
            </div>
          ) : null}
        </>
      ) : null}
      {!note && retry ? (
        <div style={rowStyle}>
          <MoveButton disabled={off} onClick={() => run(view, () => api.retryTransfer(spaceId, view.id))} testId="move-retry">
            {t.actions.tryAgain.cta}
          </MoveButton>
        </div>
      ) : null}
    </article>
  );
}

function History({ views }: { views: ClassView[] }): JSX.Element | null {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.transfer;
  if (views.length === 0) return null;
  return (
    <ul style={{ ...cardStyle, listStyle: 'none', gap: 0, paddingBlock: 0 }} aria-label={t.groups.history}>
      {views.map((view, i) => (
        <li
          key={view.id}
          data-testid="move-history-row"
          style={{ ...rowStyle, justifyContent: 'space-between', minHeight: touchTarget.min, borderTop: i === 0 ? 'none' : `${borderWidth.thin}px solid ${colors.border.subtle}` }}
        >
          <span>{statusLine(view, new Date(), locale)}</span>
          <span style={{ color: colors.text.muted, fontSize: typography.size.bodySm }}>{formatDate(locale, historyDate(view), 'monthDay')}</span>
        </li>
      ))}
    </ul>
  );
}

function Group({ title, children, empty }: { title: string; children: ReactNode; empty: boolean }): JSX.Element {
  const { messages } = useConsoleLocale();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} style={h2Style}>
        {title}
      </h2>
      {empty ? <p style={{ ...sunkenStyle, color: colors.text.secondary }}>{messages.console.transfer.empty}</p> : null}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// The page body

/** Whether keyboard or pointer focus sits inside a card: the 30 s refresh keeps the card order then. */
function focusInCard(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement as (Element & { closest?: (s: string) => Element | null }) | null;
  return !!active?.closest?.('[data-move-card]');
}

/**
 * Loads the class's requests, refreshes every `refreshMs` (one polite live region announces a change; nothing
 * auto-dismisses), and answers per card: Agree / Agree for both classes / Not now on the source, Accept / Not now
 * with reasons on the destination, Cancel request when this class started it, Try again for room.
 */
export function ClassMoves({ spaceId, spaceName, api, online, refreshMs, readOnly, direct, confirm, onPageState }: ClassMovesProps): JSX.Element {
  const { messages } = useConsoleLocale();
  const c = messages.console;
  const t = c.transfer;
  const [views, setViews] = useState<TransferView[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [announce, setAnnounce] = useState('');
  const [codeDone, setCodeDone] = useState(false);
  const [codeFailed, setCodeFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const lastJson = useRef<string | null>(null);
  const order = useRef<string[]>([]);
  const keep = useRef<string[] | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const result = await api.transferRequests(spaceId);
    if (!result.ok) {
      const outcome = actionOutcome(result);
      if (outcome === 'locked' || outcome === 'signIn' || outcome === 'forbidden') onPageState(outcome);
      else setLoadFailed(true);
      return;
    }
    const json = JSON.stringify(result.data.requests);
    if (lastJson.current !== null && lastJson.current !== json) setAnnounce(t.a11y.updated);
    lastJson.current = json;
    keep.current = focusInCard() ? order.current : null;
    setLoadFailed(false);
    setViews(result.data.requests);
    setNow(new Date());
  }, [api, spaceId, onPageState, t.a11y.updated]);

  useEffect(() => {
    void load();
    const handle = setInterval(() => void load(), refreshMs);
    return () => clearInterval(handle);
  }, [load, refreshMs]);

  const run = (view: ClassView, call: () => Promise<ApiResult<unknown>>): void => {
    const go = async (): Promise<void> => {
      setBusy(true);
      setNotes((n) => {
        const rest = { ...n };
        delete rest[view.id];
        return rest;
      });
      const result = await call();
      setBusy(false);
      const outcome = actionOutcome(result);
      if (outcome === 'locked' || outcome === 'signIn' || outcome === 'forbidden') {
        onPageState(outcome);
        return;
      }
      if (outcome === 'failed') {
        setNotes((n) => ({ ...n, [view.id]: { kind: 'failed', again: () => void go() } }));
        return;
      }
      if (outcome === 'changed') {
        setNotes((n) => ({ ...n, [view.id]: { kind: 'changed' } }));
        return;
      }
      // ok, ended meanwhile, or asked again: the reload draws the card as it is now, with no failure text.
      await load();
    };
    void go();
  };

  const refresh = (): void => {
    setNotes({});
    void load();
  };

  const newCode = async (): Promise<void> => {
    if (!confirm(`${c.space.regenerateAsk(spaceName)} ${c.oldCodeStops}`)) return;
    setBusy(true);
    setCodeFailed(false);
    const result = await api.regenerateCode(spaceId);
    setBusy(false);
    if (result.ok) setCodeDone(true);
    else setCodeFailed(true);
  };

  if (views === null) {
    return (
      <div aria-busy="true" data-testid="class-moves-loading">
        {loadFailed ? (
          <p style={sunkenStyle}>{t.states.failed}</p>
        ) : (
          [0, 1].map((i) => (
            <div key={i} style={{ ...cardStyle, boxShadow: 'none' }}>
              <div style={{ height: spacing.lg, width: '40%', borderRadius: radii.pill, backgroundColor: colors.surface.sunken }} />
              <div style={{ height: spacing.xxxl, borderRadius: radii.md, backgroundColor: colors.surface.sunken }} />
            </div>
          ))
        )}
      </div>
    );
  }

  const groups = classMoveGroups(views, keep.current);
  order.current = [...groups.leaving, ...groups.joining].map((v) => v.id);
  const card = { now, busy, online, readOnly, direct, run, api, spaceId, onRefresh: refresh };

  return (
    <div style={{ maxWidth: layout.maxWidth.reading }}>
      <style>{STEPS_CSS}</style>
      <p aria-live="polite" style={hidden}>
        {announce}
      </p>
      {loadFailed ? <p style={sunkenStyle}>{t.states.failed}</p> : null}
      {!online ? <p style={sunkenStyle}>{t.states.offline}</p> : null}
      <Group title={t.groups.leaving} empty={groups.leaving.length === 0 && groups.leavingHistory.length === 0}>
        {groups.leaving.map((view) => (
          <SourceCard key={view.id} view={view} note={notes[view.id] ?? null} {...card} />
        ))}
        <History views={groups.leavingHistory} />
      </Group>
      <Group title={t.groups.joining} empty={groups.joining.length === 0 && groups.joiningHistory.length === 0}>
        {groups.joining.map((view) => (
          <DestinationCard key={view.id} view={view} note={notes[view.id] ?? null} {...card} />
        ))}
        <History views={groups.joiningHistory} />
        {groups.movedIn && !codeDone && !readOnly ? (
          <div style={{ ...sunkenStyle, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: spacing.sm }} data-testid="move-new-code">
            <p style={lineStyle}>{t.lines.newCode}</p>
            {codeFailed ? <p style={lineStyle}>{t.states.failed}</p> : null}
            <MoveButton disabled={busy || !online} onClick={() => void newCode()} testId="move-new-code-button">
              {t.actions.newCode.cta}
            </MoveButton>
          </div>
        ) : null}
      </Group>
    </div>
  );
}
