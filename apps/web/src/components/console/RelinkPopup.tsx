'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CONFIRM_CSS, inertOthers, tabTarget } from '@/components/console/ConfirmSheet';
import type { ApiResult, ConsoleApi, RelinkView } from '@/lib/console/api';
import type { LearnerRelink } from '@/lib/console/learner-status';
import { minutesShown } from '@/lib/console/learner-status';
import { platformLabel, relinkNoteText, requestedLabel } from '@/lib/console/relink';
import { RELINK_REMINDED_KEY, RELINK_REMIND_MS, RELINK_SHOWN_KEY, addId, nextRelinkPopup, popupStorage, readIds, type PopupPick } from '@/lib/console/relink-popup';
import { announceRosterChange } from '@/lib/console/roster-broadcast';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The re-link decision dialog (AMENDMENTS-GROWNUP-UX section 5.3, GX-D12). Approving a re-link gives the new device a
 * class-scoped credential for the learner, so no surface approves one in a single tap: a re-link's action chip and every
 * re-link **Approve** open this dialog, which shows the platform, the request time and the shipped `relinkApproveHint`
 * next to its own **Approve**. **Deny** answers here too; **Later** (and Escape, and the backdrop) only closes, so the
 * chip stays. GX-1 opens it from the class page's card; GX-2 adds the sheet's Approve, its auto-open and the 2-minute
 * reminder (`useRelinkPopup` below).
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
  /** GX-2: the second (and last) automatic showing, at 2 minutes left after Later (marked for tests and the shots). */
  reminder?: boolean;
}

/**
 * The title takes focus programmatically (so the hint is read first). A pop-up that opens from a poll has no click before
 * it, so the browser would draw the focus ring round the heading; the heading is not a control, so it gets none (GX-2
 * review). Buttons keep the shared `:focus-visible` ring.
 */
const POPUP_CSS = '.hr-relink-pop h2:focus,.hr-relink-pop h2:focus-visible{outline:none}';

const TABBABLE = 'button:not([disabled])';

export function RelinkPopup({ api, spaceId, request, learnerName, online, now, onLater, onResult, focusOnClose, reminder }: RelinkPopupProps): JSX.Element {
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
      <style>{CONFIRM_CSS + POPUP_CSS}</style>
      <div className="hr-confirm-scrim" onClick={onLater} data-testid="relink-popup-backdrop" aria-hidden="true" />
      <div ref={sheet} className="hr-confirm hr-relink-pop" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={`${bodyId}-meta ${bodyId}-hint ${bodyId}-closes`} data-testid="relink-popup" data-reminder={reminder ? 'true' : undefined}>
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

/**
 * When the pop-up opens (section 5.3): after a read, while the page is in view and no other dialog is open, for a request
 * this tab has not shown, or once more at 2 minutes left for one put off with Later. A request first shown with 2 minutes
 * or less left counts as reminded too, so Later never brings it straight back. `openFor` is the action chip's tap: the
 * pop-up for that request, at any time. A request that leaves the list (answered elsewhere, expired) closes its pop-up.
 */
export function useRelinkPopup({
  relinks,
  blocked,
  enabled,
  auto = enabled,
  listed = [],
}: {
  relinks: readonly RelinkView[] | null;
  blocked: boolean;
  /** Whether the dialog may open at all here (`openFor`, the chip's and Approve's tap). */
  enabled: boolean;
  /** Whether it also opens on its own (the class roster; GX-5 adds the parent home). */
  auto?: boolean;
  /** Request ids the open review sheet lists: shown there, so they count as shown (no pop-up after the sheet closes). */
  listed?: readonly string[];
}): {
  pick: PopupPick | null;
  openFor: (requestId: string) => void;
  close: () => void;
} {
  const [pick, setPick] = useState<PopupPick | null>(null);
  // The ids are also kept in memory: where the tab has no session storage (a private window, blocked site data) a
  // request still opens the pop-up once, not again after each Later.
  const memory = useRef<Record<string, Set<string>>>({ [RELINK_SHOWN_KEY]: new Set(), [RELINK_REMINDED_KEY]: new Set() });
  const seen = (key: string): Set<string> => new Set([...readIds(popupStorage(), key), ...(memory.current[key] ?? [])]);
  const mark = (pickFor: PopupPick, now: Date): void => {
    const storage = popupStorage();
    for (const key of shownKeys(pickFor, now)) {
      addId(storage, key, pickFor.request.id);
      memory.current[key]?.add(pickFor.request.id);
    }
  };

  const listedKey = listed.join('|');
  useEffect(() => {
    if (!enabled || listedKey === '') return;
    const shown = seen(RELINK_SHOWN_KEY);
    const now = new Date();
    const reminded = seen(RELINK_REMINDED_KEY);
    // Listed in the sheet the grown-up opened: seen there, so neither the first pop-up nor the 2-minute reminder comes
    // back for it after the sheet closes (the reminder is for a request put off with Later, section 5.3).
    for (const request of relinks ?? []) {
      if (!listed.includes(request.id)) continue;
      if (!shown.has(request.id)) mark({ request, reminder: false }, now);
      if (!reminded.has(request.id)) mark({ request, reminder: true }, now);
    }
    // `listed` is keyed by its ids; `seen` and `mark` read refs and storage only.
  }, [listedKey, enabled, relinks]);

  useEffect(() => {
    if (!enabled) {
      if (pick) setPick(null);
      return;
    }
    if (pick) {
      if (relinks !== null && !relinks.some((r) => r.id === pick.request.id && r.status === 'pending')) setPick(null);
      return;
    }
    if (blocked || !auto) return;
    if (typeof document !== 'undefined' && typeof document.visibilityState === 'string' && document.visibilityState !== 'visible') return;
    // Any other modal dialog open (the frame's display sheet, for one), or a text field being typed in (a family's
    // rename): no dialog over it and no focus taken; the next read tries again.
    if (otherModalOpen() || typingInField()) return;
    const now = new Date();
    const next = nextRelinkPopup(relinks, seen(RELINK_SHOWN_KEY), seen(RELINK_REMINDED_KEY), now);
    if (!next) return;
    mark(next, now);
    setPick(next);
    // `seen` and `mark` read refs and storage only.
  }, [relinks, blocked, enabled, auto, pick]);

  const openFor = useCallback(
    (requestId: string) => {
      if (!enabled) return;
      const request = relinks?.find((r) => r.id === requestId && r.status === 'pending');
      if (!request) return;
      const pickFor: PopupPick = { request, reminder: false };
      mark(pickFor, new Date());
      setPick(pickFor);
    },
    [relinks, enabled],
  );
  // Closed (Later, an answer) with 2 minutes or less left: that was its last showing, so the reminder never opens
  // straight after it (section 5.3: never a third time, and never at once after Later).
  const shownPick = useRef(pick);
  shownPick.current = pick;
  const close = useCallback(() => {
    const current = shownPick.current;
    const now = new Date();
    if (current && closingLate(current.request, now)) mark({ request: current.request, reminder: true }, now);
    setPick(null);
    // `mark` reads refs and storage only.
  }, []);
  return { pick, openFor, close };
}

/** Whether `request` has `RELINK_REMIND_MS` or less left at `now` (its reminder's time has come). */
export function closingLate(request: RelinkView, now: Date): boolean {
  return Date.parse(request.expiresAt) - now.getTime() <= RELINK_REMIND_MS;
}

/** Whether focus is in a field the grown-up types in (an input, a text area, an editable region). */
export function typingInField(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement as (Element & { isContentEditable?: boolean }) | null;
  if (!active || typeof active.tagName !== 'string') return false;
  const tag = active.tagName.toLowerCase();
  if (tag === 'textarea' || active.isContentEditable === true) return true;
  if (tag !== 'input') return false;
  const type = (active.getAttribute?.('type') ?? 'text').toLowerCase();
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden'].includes(type);
}

/** Whether a modal dialog other than the re-link pop-up is open on the page (`aria-modal="true"`). */
export function otherModalOpen(): boolean {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return false;
  return document.querySelector('[aria-modal="true"]:not([data-testid="relink-popup"])') !== null;
}

/** Which sets a showing writes its id to: shown; reminded too for the reminder, or when 2 minutes or less are left. */
export function shownKeys(pick: PopupPick, now: Date): string[] {
  if (pick.reminder) return [RELINK_REMINDED_KEY];
  const left = Date.parse(pick.request.expiresAt) - now.getTime();
  return left <= RELINK_REMIND_MS ? [RELINK_SHOWN_KEY, RELINK_REMINDED_KEY] : [RELINK_SHOWN_KEY];
}
