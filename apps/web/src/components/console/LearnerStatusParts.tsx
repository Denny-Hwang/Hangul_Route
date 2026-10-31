'use client';

import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { AvatarChip } from '@/components/AvatarChip';
import { MoveButton } from '@/components/console/TransferParts';
import type { ApiResult, ConsoleApi } from '@/lib/console/api';
import { moveError } from '@/lib/console/class-moves';
import type { ChipTone, IncomingItem, LearnerStatus, StatusWords } from '@/lib/console/learner-status';
import { levelPillLabel } from '@/lib/console/level-label';
import { relinkNoteText } from '@/lib/console/relink';
import { rem } from '@/lib/console/rem';
import { announceRosterChange } from '@/lib/console/roster-broadcast';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The status chip next to every learner's name, its reason line, the inline answers and the "Asking to join this class"
 * cards (AMENDMENTS-GROWNUP-UX GX-1, sections 4 and 4.1; wireframe `design/wireframes/console/approvals.md`, mock
 * `design/screens/approvals/mock/class-*.html`). Text always, colour second (WCAG 1.4.1); amber (`feedback.nudge`) only on
 * the states that need the grown-up's answer; never the danger colour; text always `text.primary`.
 */

/** A decided card keeps its place and its result line this long, then the roster re-sorts (section 4 "Ordering"). */
export const DECIDED_HOLD_MS = 5_000;

const DOT = spacing.sm;

const chipBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing.xs,
  padding: `${spacing.xs}px ${spacing.md}px`,
  borderRadius: radii.pill,
  fontSize: rem(typography.size.bodySm),
  fontWeight: typography.weight.semibold,
  lineHeight: typography.leading.tight,
  color: colors.text.primary,
  whiteSpace: 'nowrap',
};

const TONE_FILL: Readonly<Record<ChipTone, string>> = {
  action: colors.feedback.nudgeLight,
  in: colors.feedback.successLight,
  info: colors.feedback.infoLight,
  quiet: colors.surface.sunken,
};

function Dot({ color }: { color: string }): JSX.Element {
  return <span aria-hidden style={{ display: 'inline-block', flexShrink: 0, width: DOT, height: DOT, borderRadius: radii.circle, backgroundColor: color }} />;
}

/**
 * One chip. An action chip is a button at least `touchTarget.min` tall whose accessible name is "{chip}: {reason}"; its
 * tap opens the decision for that item (`onActivate`). Every other chip is a span read with the name.
 */
export function StatusChip({ words, onActivate, testId = 'learner-status' }: { words: StatusWords; onActivate?: () => void; testId?: string }): JSX.Element {
  const { messages } = useConsoleLocale();
  if (words.tone === 'action') {
    return (
      <button
        type="button"
        data-testid={testId}
        data-tone="action"
        aria-label={words.reason ? messages.console.status.chipName(words.chip, words.reason) : words.chip}
        onClick={onActivate}
        style={{
          ...chipBase,
          minHeight: touchTarget.min,
          padding: `${spacing.sm}px ${spacing.lg}px`,
          border: `${borderWidth.base}px solid ${colors.feedback.nudge}`,
          backgroundColor: TONE_FILL.action,
          fontWeight: typography.weight.bold,
          cursor: 'pointer',
        }}
      >
        <Dot color={colors.feedback.nudge} />
        {words.chip}
      </button>
    );
  }
  return (
    <span data-testid={testId} data-tone={words.tone} style={{ ...chipBase, backgroundColor: TONE_FILL[words.tone] }}>
      {words.tone === 'in' ? <Dot color={colors.feedback.success} /> : null}
      {words.chip}
    </span>
  );
}

/** The reason line under a card's header; `id` lets the inline answers name whose request it is. */
export function ReasonLine({ id, text }: { id: string; text: string }): JSX.Element {
  return (
    <p id={id} data-testid="learner-status-reason" style={{ margin: `${spacing.xs}px 0 0`, color: colors.text.primary, fontSize: rem(typography.size.bodySm), fontWeight: typography.weight.semibold }}>
      {text}
    </p>
  );
}

/** The card style of a learner whose state needs the grown-up's answer: the amber border. */
export const actionCardStyle: CSSProperties = { border: `${borderWidth.base}px solid ${colors.feedback.nudge}` };

const actionsRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm };
const resultLine: CSSProperties = { margin: `${spacing.sm}px 0 0`, color: colors.text.primary, fontSize: rem(typography.size.bodySm), fontWeight: typography.weight.semibold };

/**
 * The cards just decided: a result line per learner for `DECIDED_HOLD_MS`, and the ids the roster holds in place meanwhile.
 * Lines are data (a kind and a name) worded at render time, so they follow the header's language select.
 */
export function useDecided(): {
  lines: Readonly<Record<string, string>>;
  pinned: ReadonlySet<string>;
  note: (learnerId: string, text: string) => void;
} {
  const [lines, setLines] = useState<Record<string, string>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const t of all.values()) clearTimeout(t);
      all.clear();
    };
  }, []);
  const note = useCallback((learnerId: string, text: string) => {
    setLines((prev) => ({ ...prev, [learnerId]: text }));
    const old = timers.current.get(learnerId);
    if (old) clearTimeout(old);
    timers.current.set(
      learnerId,
      setTimeout(() => {
        timers.current.delete(learnerId);
        setLines((prev) => {
          const next = { ...prev };
          delete next[learnerId];
          return next;
        });
      }, DECIDED_HOLD_MS),
    );
  }, []);
  return { lines, pinned: new Set(Object.keys(lines)), note };
}

export type RelinkApi = Pick<ConsoleApi, 'decideRelink'>;

/**
 * A re-link card's inline **Approve** (primary) and **Deny** (`api.decideRelink`). Each is described by the learner's name
 * and the reason line, so "Approve" is read with whose request it is. The result goes to `onResult` (the card's line and
 * the page's polite region); the page reads again after.
 */
export function RelinkAnswer({
  api,
  spaceId,
  status,
  learnerName,
  describedBy,
  online,
  rowRef,
  onResult,
}: {
  api: RelinkApi;
  spaceId: string;
  status: LearnerStatus;
  learnerName: string;
  describedBy: string;
  online: boolean;
  /** The row of answers: the action chip's tap moves focus to its first button (GX-2 opens the pop-up instead). */
  rowRef?: RefObject<HTMLDivElement>;
  onResult: (text: string) => void;
}): JSX.Element | null {
  const { messages, locale } = useConsoleLocale();
  const [busy, setBusy] = useState(false);
  const request = status.relink;
  if (!request) return null;
  const t = messages.console.relink;
  const decide = async (approve: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const result = await api.decideRelink(spaceId, request.id, approve);
    setBusy(false);
    if (result.ok) {
      announceRosterChange();
      onResult(relinkNoteText({ kind: approve ? 'approved' : 'denied', name: learnerName }, locale));
    } else onResult(relinkNoteText({ kind: 'decideFailed', result }, locale));
  };
  return (
    <div style={actionsRow} data-testid="relink-answer" ref={rowRef}>
      <MoveButton primary waiting={busy} disabled={!online} describedBy={describedBy} onClick={() => void decide(true)} testId="relink-approve-inline">
        {t.approve.cta}
      </MoveButton>
      <MoveButton waiting={busy} disabled={!online} describedBy={describedBy} onClick={() => void decide(false)} testId="relink-deny-inline">
        {t.deny.cta}
      </MoveButton>
    </div>
  );
}

/** A decided card's result line (also said by the page's polite region). */
export function DecidedLine({ text }: { text: string }): JSX.Element {
  return (
    <p style={resultLine} data-testid="learner-decided">
      {text}
    </p>
  );
}

export type IncomingApi = Pick<ConsoleApi, 'acceptClassMove' | 'declineClassMove' | 'approveTransfer' | 'declineTransfer'>;

const cardStyle: CSSProperties = {
  padding: spacing.lg,
  backgroundColor: colors.surface.paper,
  borderRadius: radii.lg,
  ...actionCardStyle,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.xs,
};
const headRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm };
const levelPill: CSSProperties = {
  marginInlineStart: 'auto',
  fontSize: rem(typography.size.caption),
  color: colors.text.secondary,
  padding: `${spacing.xxs}px ${spacing.sm}px`,
  backgroundColor: colors.surface.sunken,
  borderRadius: radii.pill,
};

/**
 * "Asking to join this class" (section 4.1): one card per learner asking to join (a transfer whose destination step waits
 * for this class, or another teacher's move into it), above the roster, on an empty class too. Initials, picture and level
 * only until accepted (F-SPACE-002 T8); the **Needs your OK** chip; "From {class}" when the source class is known; and
 * **Accept** (primary, first) · **Not now** inline. Not now on a transfer keeps the shipped reason step (Not now / No room).
 * Absent when nothing is incoming.
 */
export function AskingToJoin({
  items,
  api,
  spaceId,
  online,
  readOnly,
  onDecided,
}: {
  items: readonly IncomingItem[];
  api: IncomingApi;
  spaceId: string;
  online: boolean;
  readOnly: boolean;
  /** After an answer (or an answer that found the ask gone): the page reads again and says `text` in its polite region. */
  onDecided: (text: string | null) => void;
}): JSX.Element | null {
  const { messages } = useConsoleLocale();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={headingId} data-testid="asking-to-join" style={{ marginBottom: spacing.lg }}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.sm}px` }}>
        {messages.console.attention.incomingHeading}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: spacing.md }}>
        {items.map((item) => (
          <IncomingCard
            key={`${item.source}:${item.id}`}
            item={item}
            api={api}
            spaceId={spaceId}
            online={online}
            readOnly={readOnly}
            onDecided={(text) => {
              // The card leaves on the reread: focus goes to the group's heading, never lost to the page's top.
              headingRef.current?.focus();
              onDecided(text);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function IncomingCard({
  item,
  api,
  spaceId,
  online,
  readOnly,
  onDecided,
}: {
  item: IncomingItem;
  api: IncomingApi;
  spaceId: string;
  online: boolean;
  readOnly: boolean;
  onDecided: (text: string | null) => void;
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const nameId = useId();
  const reasonId = useId();
  const reasonsId = useId();
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<'noRoom' | 'failed' | null>(null);
  const [reasons, setReasons] = useState(false);
  const acceptRef = useRef<HTMLDivElement>(null);
  const level = item.level ? levelPillLabel(item.level, locale) : null;
  const from = item.from ? c.attention.from(item.from) : null;
  const words: StatusWords = { chip: c.status.needsOk, reason: from, tone: 'action' };

  const run = async (call: () => Promise<ApiResult<unknown>>): Promise<void> => {
    if (busy || !online) return;
    setBusy(true);
    setLine(null);
    const r = await call();
    setBusy(false);
    if (r.ok) {
      announceRosterChange();
      onDecided(c.transfer.a11y.updated);
      return;
    }
    const err = moveError(r);
    if (r.code === 'move_blocked' || (err?.kind === 'line' && err.key === 'full')) {
      setLine('noRoom');
      return;
    }
    // An ask that ended meanwhile, a locked feature, a lost access: the page reads again and shows what is true now.
    if (r.code === 'not_open' || r.code === 'expired' || (err && err.kind !== 'line')) {
      onDecided(null);
      return;
    }
    setLine('failed');
  };
  const accept = (): Promise<void> => run(() => (item.source === 'teacher' ? api.acceptClassMove(spaceId, item.id) : api.approveTransfer(spaceId, item.id, { slots: ['destination'] })));
  const decline = (reason?: 'not_now' | 'no_room'): Promise<void> =>
    run(() => (item.source === 'teacher' ? api.declineClassMove(spaceId, item.id) : api.declineTransfer(spaceId, item.id, { slot: 'destination', reason: reason ?? 'not_now' })));
  const describedBy = from ? `${nameId} ${reasonId}` : nameId;
  const off = !online;

  return (
    <article style={cardStyle} aria-labelledby={nameId} data-testid="incoming-card" data-source={item.source}>
      <div style={headRow}>
        {item.avatar ? <AvatarChip avatar={item.avatar} /> : null}
        <strong id={nameId} style={{ fontSize: rem(typography.size.bodyLg), letterSpacing: typography.tracking.wide }}>
          {item.alias}
        </strong>
        <StatusChip words={words} onActivate={() => acceptRef.current?.querySelector('button')?.focus()} testId="incoming-status" />
        {level ? <span style={levelPill}>{level}</span> : null}
      </div>
      {from ? <ReasonLine id={reasonId} text={from} /> : null}
      {line === 'noRoom' ? <p style={resultLine}>{c.teacherMove.section.noRoom}</p> : null}
      {line === 'failed' ? <p style={resultLine}>{c.teacherMove.section.failed}</p> : null}
      {readOnly ? null : (
        <div style={actionsRow} ref={acceptRef}>
          <MoveButton primary waiting={busy} disabled={off} describedBy={describedBy} onClick={() => void accept()} testId="incoming-accept">
            {line === 'noRoom' ? c.teacherMove.section.tryAgain.cta : c.teacherMove.section.accept.cta}
          </MoveButton>
          {item.source === 'teacher' ? (
            <MoveButton waiting={busy} disabled={off} describedBy={describedBy} onClick={() => void decline()} testId="incoming-not-now">
              {c.teacherMove.section.notNow.cta}
            </MoveButton>
          ) : (
            <button
              type="button"
              aria-expanded={reasons}
              aria-controls={reasonsId}
              aria-label={c.transfer.a11y.notNowReasons}
              aria-describedby={describedBy}
              disabled={off || busy}
              onClick={() => setReasons((open) => !open)}
              data-testid="incoming-not-now"
              style={{
                minHeight: touchTarget.min,
                minWidth: touchTarget.min,
                padding: `${spacing.sm}px ${spacing.xl}px`,
                borderRadius: radii.pill,
                border: `${borderWidth.thin}px solid ${colors.border.strong}`,
                backgroundColor: reasons ? colors.surface.sunken : colors.surface.paper,
                color: colors.text.primary,
                fontSize: rem(typography.size.body),
                fontWeight: typography.weight.bold,
                cursor: 'pointer',
              }}
            >
              {c.transfer.actions.notNow.cta}
            </button>
          )}
        </div>
      )}
      {!readOnly && reasons && item.source === 'transfer' ? (
        <div id={reasonsId} role="group" aria-label={c.transfer.a11y.reasons} style={{ ...actionsRow, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.sunken }}>
          <MoveButton waiting={busy} disabled={off} describedBy={describedBy} onClick={() => void decline('not_now')} testId="incoming-reason-not-now">
            {c.transfer.actions.notNow.cta}
          </MoveButton>
          <MoveButton waiting={busy} disabled={off} describedBy={describedBy} onClick={() => void decline('no_room')} testId="incoming-reason-no-room">
            {c.transfer.actions.noRoom.cta}
          </MoveButton>
        </div>
      ) : null}
    </article>
  );
}
