'use client';

import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { inertOthers, tabTarget } from '@/components/console/ConfirmSheet';
import { MoveButton } from '@/components/console/TransferParts';
import type { ConsoleApi, RelinkView } from '@/lib/console/api';
import { minutesShown } from '@/lib/console/learner-status';
import { relinkNoteText } from '@/lib/console/relink';
import { relinkSettled } from '@/components/console/LearnerStatusParts';
import { RELINK_REMINDED_KEY, RELINK_REMIND_MS, RELINK_SHOWN_KEY, addId, nextRelinkPopup, popupStorage, readIds, type PopupPick } from '@/lib/console/relink-popup';
import { rem } from '@/lib/console/rem';
import { announceRosterChange } from '@/lib/console/roster-broadcast';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The re-link pop-up of the class page (AMENDMENTS-GROWNUP-UX GX-D4, section 5.3; wireframe `design/wireframes/console/
 * approvals.md` "re-link pop-up", mock `design/screens/approvals/mock/popup-*.html`; owner request 2026-10-31: "a pop-up or
 * a clearer alert"). An `alertdialog` named by its title, which takes focus: "New device request: {name}", the shipped
 * approve hint and "This request closes in {m} min."; **Approve** (primary), **Deny**, **Later**. Escape is Later; Tab
 * stays inside; the page behind is inert; focus goes back where it was. Re-links only: a move never opens it.
 */

export type RelinkPopupApi = Pick<ConsoleApi, 'decideRelink'>;

const alphaHex = Math.round(shadows.modal.shadowOpacity * 255)
  .toString(16)
  .padStart(2, '0');
const MODAL_SHADOW = `0 ${shadows.modal.shadowOffset.height}px ${shadows.modal.shadowRadius}px ${shadows.modal.shadowColor}${alphaHex}`;

const POPUP_CSS = `
.hr-relink-pop-scrim{position:fixed;inset:0;z-index:${z.modal};background:${colors.surface.overlay}}
.hr-relink-pop{position:fixed;left:0;right:0;bottom:0;z-index:${z.modal};max-height:90vh;overflow-y:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:${rem(spacing.sm)};background:${colors.surface.paper};color:${colors.text.primary};border-radius:${radii.xl}px ${radii.xl}px 0 0;border-top:${borderWidth.thick}px solid ${colors.feedback.nudge};padding:${rem(spacing.xl)} ${layout.gutter.compact}px;box-shadow:${MODAL_SHADOW};text-align:left}
.hr-relink-pop h2{margin:0;font-size:${rem(typography.size.prompt)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};overflow-wrap:anywhere}
.hr-relink-pop p{margin:0;font-size:${rem(typography.size.body)};line-height:${typography.leading.normal};overflow-wrap:anywhere}
.hr-relink-pop-actions{display:flex;flex-wrap:wrap;gap:${rem(spacing.sm)};margin-top:${rem(spacing.sm)}}
.hr-relink-pop-actions>*{flex:1 1 ${rem(spacing.xxxl * 3)}}
.hr-relink-pop-actions button{width:100%}
.hr-relink-pop :focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${borderWidth.base}px}
.hr-relink-pop h2:focus,.hr-relink-pop h2:focus-visible{outline:none}
@media (min-width:45em){.hr-relink-pop{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-50%);width:calc(100% - ${2 * layout.gutter.regular}px);max-width:${layout.maxWidth.reading}px;border-radius:${radii.xl}px;border-top:none;border-inline-start:${borderWidth.thick}px solid ${colors.feedback.nudge};padding:${rem(spacing.xl)} ${rem(spacing.xxl)}}}`;

const TABBABLE = 'button:not([disabled])';

export function RelinkPopup({
  pick,
  now,
  api,
  spaceId,
  online,
  onResult,
  onLater,
}: {
  pick: PopupPick;
  now: Date;
  api: RelinkPopupApi;
  spaceId: string;
  online: boolean;
  /**
   * After Approve or Deny: the result line for the page's polite region. `settled` (answered, or closed meanwhile): the
   * pop-up closes and the learner's card shows the line. Otherwise (offline, a 5xx) the pop-up stays with its line under
   * the buttons, so the grown-up can try again while the minutes run.
   */
  onResult: (learnerId: string, text: string, settled: boolean) => void;
  /** Later, Escape: the pop-up closes; the chip and the banner stay. */
  onLater: () => void;
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const id = useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;
  const box = useRef<HTMLDivElement | null>(null);
  const title = useRef<HTMLHeadingElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const latestLater = useRef(onLater);
  latestLater.current = onLater;
  const request = pick.request;

  useEffect(() => {
    const doc = typeof document === 'undefined' ? null : document;
    const opener = doc ? (doc.activeElement as HTMLElement | null) : null;
    title.current?.focus?.();
    const undoInert = inertOthers(box.current as Parameters<typeof inertOthers>[0], (doc?.body as Parameters<typeof inertOthers>[1] | undefined) ?? null);
    return () => {
      undoInert();
      opener?.focus?.();
    };
    // One opening per request: the page draws a new pop-up (a new key) for the next one.
  }, []);

  const keyAction = useCallback((event: { key: string; shiftKey: boolean; preventDefault: () => void }): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      latestLater.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(box.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? []);
    const active = typeof document === 'undefined' ? null : document.activeElement;
    const inside = active !== null && !!box.current?.contains?.(active);
    const next = inside ? tabTarget(items, active, event.shiftKey) : event.shiftKey ? (items[items.length - 1] ?? null) : (items[0] ?? null);
    if (next === null) return;
    event.preventDefault();
    next.focus();
  }, []);
  useEffect(() => {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return undefined;
    const onDocumentKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      keyAction(event);
    };
    document.addEventListener('keydown', onDocumentKey);
    return () => document.removeEventListener('keydown', onDocumentKey);
  }, [keyAction]);

  const decide = async (approve: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setFailed(null);
    const result = await api.decideRelink(spaceId, request.id, approve);
    setBusy(false);
    if (result.ok) {
      announceRosterChange();
      onResult(request.learnerId, relinkNoteText({ kind: approve ? 'approved' : 'denied', name: request.learnerName }, locale), true);
      return;
    }
    const text = relinkNoteText({ kind: 'decideFailed', result }, locale);
    const settled = relinkSettled(result);
    if (!settled) setFailed(text);
    onResult(request.learnerId, text, settled);
  };

  return (
    <>
      <style>{POPUP_CSS}</style>
      <div className="hr-relink-pop-scrim" aria-hidden="true" data-testid="relink-popup-backdrop" />
      <div ref={box} className="hr-relink-pop" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} onKeyDown={keyAction} data-testid="relink-popup" data-reminder={pick.reminder ? 'true' : undefined}>
        <h2 id={titleId} ref={title} tabIndex={-1}>
          {c.relinkPopup.title(request.learnerName)}
        </h2>
        <div id={bodyId} style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          <p style={{ color: colors.text.secondary }}>{c.relinkApproveHint}</p>
          <p style={{ fontWeight: typography.weight.bold }} data-testid="relink-popup-closes">
            {c.relinkPopup.closes(minutesShown(request.expiresAt, now))}
          </p>
        </div>
        {failed ? (
          <p style={{ fontWeight: typography.weight.semibold }} data-testid="relink-popup-failed">
            {failed}
          </p>
        ) : null}
        <div className="hr-relink-pop-actions">
          <MoveButton primary waiting={busy} disabled={!online} onClick={() => void decide(true)} testId="relink-popup-approve">
            {c.relink.approve.cta}
          </MoveButton>
          <MoveButton waiting={busy} disabled={!online} onClick={() => void decide(false)} testId="relink-popup-deny">
            {c.relink.deny.cta}
          </MoveButton>
          <button
            type="button"
            onClick={onLater}
            data-testid="relink-popup-later"
            style={{
              minHeight: touchTarget.min,
              minWidth: touchTarget.min,
              padding: `${spacing.sm}px ${spacing.lg}px`,
              border: 'none',
              borderRadius: radii.pill,
              background: 'none',
              color: colors.text.secondary,
              fontSize: rem(typography.size.body),
              fontWeight: typography.weight.bold,
              cursor: 'pointer',
            }}
          >
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
  listed = [],
}: {
  relinks: readonly RelinkView[] | null;
  blocked: boolean;
  enabled: boolean;
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
    if (blocked) return;
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
  }, [relinks, blocked, enabled, pick]);

  const openFor = useCallback(
    (requestId: string) => {
      const request = relinks?.find((r) => r.id === requestId && r.status === 'pending');
      if (!request) return;
      const pickFor: PopupPick = { request, reminder: false };
      mark(pickFor, new Date());
      setPick(pickFor);
    },
    [relinks],
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
