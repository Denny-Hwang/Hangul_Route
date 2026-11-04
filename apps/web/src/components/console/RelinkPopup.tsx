'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CONFIRM_CSS, inertOthers, tabTarget } from '@/components/console/ConfirmSheet';
import type { ApiResult, ConsoleApi } from '@/lib/console/api';
import type { LearnerRelink } from '@/lib/console/learner-status';
import { minutesShown } from '@/lib/console/learner-status';
import { platformLabel, relinkNoteText, requestedLabel } from '@/lib/console/relink';
import { announceRosterChange } from '@/lib/console/roster-broadcast';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The re-link decision dialog (AMENDMENTS-GROWNUP-UX section 5.3, GX-D12). Approving a re-link gives the new device a
 * class-scoped credential for the learner, so no surface approves one in a single tap: a re-link's action chip and every
 * re-link **Approve** open this dialog, which shows the platform, the request time and the shipped `relinkApproveHint`
 * next to its own **Approve**. **Deny** answers here too; **Later** (and Escape, and the backdrop) only closes, so the
 * chip stays. GX-1 opens it from the class page's card only; its auto-open and the 2-minute reminder are GX-2.
 *
 * The ConfirmSheet frame: `role="alertdialog"`, modal, the page behind `inert`, Tab kept inside, a bottom sheet on a
 * phone and a centred dialog from 600 px. Focus starts on the title (the hint is read before any button) and goes, on
 * close, where `focusOnClose` says (the learner's name after an answer that closed the request), else back to the opener.
 */

export type RelinkDecideApi = Pick<ConsoleApi, 'decideRelink'>;

/**
 * Whether a decide answer closed the request: it was answered, or it closed meanwhile (409, except a learner who left
 * the class; 404). A network error or a 5xx leaves it open, so the answers stay.
 */
export function relinkSettled(result: ApiResult<unknown>): boolean {
  if (result.ok) return true;
  return (result.status === 409 && result.code !== 'not_a_member') || result.status === 404;
}

export interface RelinkPopupProps {
  api: RelinkDecideApi;
  spaceId: string;
  request: LearnerRelink;
  learnerName: string;
  online: boolean;
  now: Date;
  /** Later, Escape or the backdrop: the dialog closes and the request stays open. */
  onLater: () => void;
  /** An answer came back: `settled` when it closed the request (the dialog then closes; the card shows the line). */
  onResult: (text: string, settled: boolean) => void;
  /** Where focus goes when the dialog leaves; the opener when this returns null or a node no longer on the page. */
  focusOnClose?: () => HTMLElement | null;
}

const TABBABLE = 'button:not([disabled])';

export function RelinkPopup({ api, spaceId, request, learnerName, online, now, onLater, onResult, focusOnClose }: RelinkPopupProps): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const id = useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;
  const sheet = useRef<HTMLDivElement | null>(null);
  const title = useRef<HTMLHeadingElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const latest = useRef({ onLater, focusOnClose });
  latest.current = { onLater, focusOnClose };

  // Focus on the title, the page behind inert; on close focus goes where the card says, or back to the opener.
  useEffect(() => {
    const doc = typeof document === 'undefined' ? null : document;
    const opener = doc ? (doc.activeElement as HTMLElement | null) : null;
    title.current?.focus();
    const undoInert = inertOthers(sheet.current, doc?.body ?? null);
    return () => {
      undoInert();
      const target = latest.current.focusOnClose?.() ?? null;
      const onPage = (node: HTMLElement | null): node is HTMLElement => !!node && (typeof node.isConnected !== 'boolean' || node.isConnected);
      if (onPage(target)) target.focus();
      else if (onPage(opener)) opener.focus?.();
    };
  }, []);

  // Escape is Later; Tab goes round the buttons, and from anywhere outside the dialog comes back into it.
  useEffect(() => {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        latest.current.onLater();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(sheet.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? []);
      const active = document.activeElement;
      const inside = active !== null && items.includes(active as HTMLElement);
      const next = inside || items.length === 0 ? tabTarget(items, active, event.shiftKey) : event.shiftKey ? items[items.length - 1]! : items[0]!;
      if (next === null) return;
      event.preventDefault();
      next.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const decide = async (approve: boolean): Promise<void> => {
    if (busy || !online) return;
    setBusy(true);
    setFailed(null);
    const result = await api.decideRelink(spaceId, request.id, approve);
    setBusy(false);
    if (result.ok) {
      announceRosterChange();
      onResult(relinkNoteText({ kind: approve ? 'approved' : 'denied', name: learnerName }, locale), true);
      return;
    }
    const text = relinkNoteText({ kind: 'decideFailed', result }, locale);
    const settled = relinkSettled(result);
    // A failure that leaves the request open keeps the dialog and its buttons, with the line under them.
    if (!settled) setFailed(text);
    onResult(text, settled);
  };

  const platform = platformLabel(request.platform, locale);
  const meta = request.requestedAt ? c.relinkPopup.meta(platform, requestedLabel(request.requestedAt, now, locale)) : platform;
  const off = busy || !online;

  return (
    <>
      <style>{CONFIRM_CSS}</style>
      <div className="hr-confirm-scrim" onClick={onLater} data-testid="relink-popup-backdrop" aria-hidden="true" />
      <div ref={sheet} className="hr-confirm" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={`${bodyId}-meta ${bodyId}-hint ${bodyId}-closes`} data-testid="relink-popup">
        <h2 id={titleId} ref={title} tabIndex={-1}>
          {c.relinkPopup.title(learnerName)}
        </h2>
        <p id={`${bodyId}-meta`} data-testid="relink-popup-meta">
          {meta}
        </p>
        <p id={`${bodyId}-hint`} data-testid="relink-popup-hint">
          {c.relinkApproveHint}
        </p>
        <p id={`${bodyId}-closes`} data-testid="relink-popup-closes">
          {c.relinkPopup.closes(minutesShown(request.expiresAt, now))}
        </p>
        {failed ? (
          <p role="status" data-testid="relink-popup-failed">
            {failed}
          </p>
        ) : null}
        <div className="hr-confirm-actions">
          <button type="button" className="hr-confirm-button hr-confirm-ok" disabled={off} aria-busy={busy || undefined} onClick={() => void decide(true)} data-testid="relink-popup-approve">
            {c.relink.approve.cta}
          </button>
          <button type="button" className="hr-confirm-button hr-confirm-cancel" disabled={off} aria-busy={busy || undefined} onClick={() => void decide(false)} data-testid="relink-popup-deny">
            {c.relink.deny.cta}
          </button>
          <button type="button" className="hr-confirm-button hr-confirm-cancel" onClick={onLater} data-testid="relink-popup-later">
            {c.relinkPopup.later.cta}
          </button>
        </div>
      </div>
    </>
  );
}
