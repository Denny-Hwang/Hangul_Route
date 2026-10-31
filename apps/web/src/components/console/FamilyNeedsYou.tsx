'use client';

import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { UiLocale } from '@hangul-route/i18n';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { AvatarChip } from '@/components/AvatarChip';
import { ConsentSheet, ReloadNotice, familyFailure, sheetFromView } from '@/components/console/FamilyTransferParts';
import { DECIDED_HOLD_MS } from '@/components/console/LearnerStatusParts';
import { MoveButton, TransferSheet } from '@/components/console/TransferParts';
import type { ApiResult, ConsoleApi, TransferLearnerSideView } from '@/lib/console/api';
import { foldNeedsYou, needsYouWords, type NeedsYouItem } from '@/lib/console/parent-home';
import { relinkNoteText } from '@/lib/console/relink';
import { rem } from '@/lib/console/rem';
import { announceRosterChange } from '@/lib/console/roster-broadcast';
import { consentRecord } from '@/lib/console/transfer-consent';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The family's **Needs you** strip (AMENDMENTS-GROWNUP-UX GX-4, section 7.1, GX-D7; wireframe
 * `design/wireframes/parent/needs-you.md`, mock `design/screens/approvals/mock/parent-*.html`). Directly under the family
 * heading, before every card: one compact row per thing only the family can answer (a child's re-link, a class move whose
 * family step waits, a class-scope update to read), soonest-closing first, each with its button(s) inline. With 3 or more
 * the first keeps its row and the rest fold into "{n} more things need you · See all", which lists them all in a sheet, so
 * the first child stays on the first phone screen.
 *
 * - A re-link: **Approve** · **Deny** inline (`decideRelink`); the result goes to a polite region that outlives the row.
 * - A move: **Review** opens the shipped consent sheet directly (2 taps; was 3 to 4 through the moves page).
 * - A class-scope update: **Read and OK** hands the learner to the page, which scrolls to and focuses the shipped card
 *   (until the owner answers GX-OD-3; row GX-5b may open a sheet instead).
 * Amber is the family's action only (a light fill and an inline-start bar); text is always `text.primary`; never red.
 */

export type NeedsYouApi = Pick<ConsoleApi, 'decideRelink' | 'approveTransfer' | 'declineTransfer'>;

/** The row layout of the mock (`.need`): the text takes the room, the buttons sit inline and wrap under it only when narrow. */
const STRIP_CSS = `
.hr-ny-row{display:flex;flex-wrap:wrap;align-items:center;gap:${spacing.xs}px ${spacing.sm}px;padding:${spacing.sm}px ${spacing.md}px;border-radius:${radii.md}px}
.hr-ny-text{flex:1 1 9rem;min-width:0;display:flex;flex-direction:column;gap:${spacing.xxs}px}
.hr-ny-actions{display:flex;flex-wrap:wrap;gap:${spacing.sm}px;margin-inline-start:auto}
`;

const rowStyle: CSSProperties = {
  backgroundColor: colors.feedback.nudgeLight,
  borderInlineStart: `${borderWidth.thick}px solid ${colors.feedback.nudge}`,
  color: colors.text.primary,
};
const sentence: CSSProperties = { margin: 0, fontSize: rem(typography.size.bodySm), fontWeight: typography.weight.semibold, color: colors.text.primary, overflowWrap: 'anywhere' };
const metaLine: CSSProperties = { margin: 0, fontSize: rem(typography.size.bodySm), color: colors.text.secondary, overflowWrap: 'anywhere' };
const resultStyle: CSSProperties = { margin: 0, fontSize: rem(typography.size.bodySm), fontWeight: typography.weight.semibold, color: colors.text.primary };

type Reviewing = { id: string; updated: boolean };

export function FamilyNeedsYou({
  familyId,
  familyName,
  items,
  views,
  avatars,
  api,
  online,
  now,
  onChanged,
  onReadScope,
}: {
  familyId: string;
  familyName: string;
  /** `needsYou(asks, now)`: already ordered. */
  items: readonly NeedsYouItem[];
  /** The family's learner-side views, for the consent sheet of a move row. */
  views: readonly TransferLearnerSideView[];
  /** Each learner's picture by id (the roster's), when known. */
  avatars: Readonly<Record<string, string>>;
  api: NeedsYouApi;
  online: boolean;
  now: Date;
  /** After an answer: the page reads its family again (quietly). */
  onChanged: () => Promise<void>;
  /** Read and OK: the page scrolls to and focuses that learner's class-scope card. */
  onReadScope: (learnerId: string) => void;
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const w = c.parentHome.needsYou;
  const t = c.transfer;
  const base = useId();
  const headingId = `${base}-heading`;
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [reviewing, setReviewing] = useState<Reviewing | null>(null);
  const [sheetFailed, setSheetFailed] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    },
    [],
  );

  /** The result line: said once by the polite region and shown for `DECIDED_HOLD_MS`, as on the class page. */
  const say = (text: string | null): void => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setNote(text);
    if (text) noteTimer.current = setTimeout(() => setNote(null), DECIDED_HOLD_MS);
  };

  const failureText = (result: ApiResult<unknown>): string | null => {
    const f = familyFailure(result);
    if (!f || f.kind === 'ended' || f.kind === 'refind') return null;
    if (f.kind === 'stale') {
      setStale(true);
      return null;
    }
    if (f.kind === 'notice') return t.states[f.notice];
    if (f.kind === 'page') return f.state === 'signIn' ? c.start.signInAgain : t.states[f.state];
    return t.states.failed;
  };

  const decideRelink = async (item: NeedsYouItem, approve: boolean): Promise<void> => {
    if (busy || !online) return;
    setBusy(item.id);
    const result = await api.decideRelink(familyId, item.id, approve).catch((): ApiResult<never> => ({ ok: false, error: 'network', status: -1 }));
    setBusy(null);
    if (result.ok) {
      announceRosterChange();
      say(relinkNoteText({ kind: approve ? 'approved' : 'denied', name: item.name }, locale));
      await onChanged();
      return;
    }
    say(relinkNoteText({ kind: 'decideFailed', result }, locale));
    // A request that closed meanwhile (409): read again, so the row leaves.
    if (result.error === 'unknown') await onChanged();
  };

  const reviewed = reviewing ? views.find((v) => v.id === reviewing.id) ?? null : null;

  const approveMove = async (view: TransferLearnerSideView, sheetLocale: UiLocale, introduce: boolean): Promise<void> => {
    if (busy) return;
    setBusy(view.id);
    setSheetFailed(false);
    const result = await api.approveTransfer(familyId, view.id, { slots: ['learner'], consent: consentRecord(sheetLocale, view.termsDigest), introduce }).catch((): ApiResult<never> => ({ ok: false, error: 'network', status: -1 }));
    setBusy(null);
    if (result.ok) {
      // The family's yes can move the learner at once: an open class roster in another console tab reads again now.
      announceRosterChange();
      setReviewing(null);
      say(t.a11y.updated);
      await onChanged();
      return;
    }
    const f = familyFailure(result);
    if (f?.kind === 'refind') {
      // The request or its terms changed: read again and show the sheet once more, marked as updated.
      await onChanged();
      setReviewing({ id: view.id, updated: true });
      return;
    }
    if (f?.kind === 'line') {
      setSheetFailed(true);
      return;
    }
    setReviewing(null);
    say(failureText(result));
    await onChanged();
  };

  const declineMove = async (view: TransferLearnerSideView): Promise<void> => {
    setReviewing(null);
    if (busy) return;
    setBusy(view.id);
    const result = await api.declineTransfer(familyId, view.id, { slot: 'learner' }).catch((): ApiResult<never> => ({ ok: false, error: 'network', status: -1 }));
    setBusy(null);
    if (result.ok) {
      announceRosterChange();
      say(t.a11y.updated);
    } else say(failureText(result));
    await onChanged();
  };

  const row = (item: NeedsYouItem, where: 'strip' | 'sheet', index: number): JSX.Element => {
    const { text, meta } = needsYouWords(item, now, locale);
    const textId = `${base}-${where}-${index}-text`;
    const metaId = `${base}-${where}-${index}-meta`;
    const describedBy = meta ? `${textId} ${metaId}` : textId;
    const avatar = avatars[item.learnerId];
    const off = !online;
    const waiting = busy === item.id;
    return (
      <div key={`${item.kind}:${item.id}`} className="hr-ny-row" style={rowStyle} data-testid="needs-you-row" data-kind={item.kind}>
        {avatar ? <AvatarChip avatar={avatar} /> : null}
        <div className="hr-ny-text">
          <p id={textId} style={sentence}>
            {text}
          </p>
          {meta ? (
            <p id={metaId} style={metaLine}>
              {meta}
            </p>
          ) : null}
        </div>
        <div className="hr-ny-actions">
          {item.kind === 'relink' ? (
            <>
              <MoveButton primary waiting={waiting} disabled={off} describedBy={describedBy} onClick={() => void decideRelink(item, true)} testId="needs-you-approve">
                {c.relink.approve.cta}
              </MoveButton>
              <MoveButton waiting={waiting} disabled={off} describedBy={describedBy} onClick={() => void decideRelink(item, false)} testId="needs-you-deny">
                {c.relink.deny.cta}
              </MoveButton>
            </>
          ) : item.kind === 'move' ? (
            <MoveButton
              primary
              waiting={waiting}
              disabled={off}
              describedBy={describedBy}
              onClick={() => {
                setAllOpen(false);
                setSheetFailed(false);
                setReviewing({ id: item.id, updated: false });
              }}
              testId="needs-you-review"
            >
              {c.status.review.cta}
            </MoveButton>
          ) : (
            <MoveButton
              primary
              describedBy={describedBy}
              onClick={() => {
                setAllOpen(false);
                onReadScope(item.learnerId);
              }}
              testId="needs-you-read"
            >
              {w.readOk.cta}
            </MoveButton>
          )}
        </div>
      </div>
    );
  };

  const { rows, more } = foldNeedsYou(items);
  const moreId = `${base}-more`;

  return (
    <>
      <style>{STRIP_CSS}</style>
      {/* Mounted always, so a result is still said when its row (or the whole strip) has gone. */}
      <div role="status" aria-live="polite" data-testid="needs-you-result" style={note ? { padding: `0 ${spacing.xs}px` } : undefined}>
        {note ? <p style={resultStyle}>{note}</p> : null}
      </div>
      {items.length > 0 || stale ? (
        <section role="region" aria-labelledby={headingId} data-testid="needs-you" style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <h3 id={headingId} style={{ margin: 0, fontSize: rem(typography.size.bodyLg), fontWeight: typography.weight.bold }}>
            {w.title}
          </h3>
          {stale ? <ReloadNotice /> : null}
          {rows.map((item, index) => row(item, 'strip', index))}
          {more > 0 ? (
            <div className="hr-ny-row" style={rowStyle} data-testid="needs-you-more">
              <div className="hr-ny-text">
                <p id={moreId} style={sentence}>
                  {w.more(more)}
                </p>
              </div>
              <div className="hr-ny-actions">
                <MoveButton primary describedBy={moreId} onClick={() => setAllOpen(true)} testId="needs-you-see-all">
                  {w.seeAll.cta}
                </MoveButton>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      {allOpen ? (
        <TransferSheet title={w.title} onClose={() => setAllOpen(false)} testId="needs-you-sheet">
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {items.length > 0 ? items.map((item, index) => row(item, 'sheet', index)) : <p style={{ margin: 0, color: colors.text.secondary }}>{t.empty}</p>}
          </div>
        </TransferSheet>
      ) : null}
      {reviewing && reviewed ? (
        <ConsentSheet
          key={`${reviewed.id}:${reviewed.termsDigest ?? ''}:${reviewing.updated ? 'u' : ''}`}
          data={sheetFromView(reviewed, familyName)}
          initialLocale={locale}
          notNowEnds={reviewed.initiator === 'source'}
          busy={busy === reviewed.id}
          failed={sheetFailed}
          updated={reviewing.updated}
          onYes={(l, intro) => void approveMove(reviewed, l, intro)}
          onNotNow={() => void declineMove(reviewed)}
          onClose={() => setReviewing(null)}
        />
      ) : null}
    </>
  );
}
