'use client';

import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useMessages } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';

/**
 * ConfirmSheet of the grown-up pages (AMENDMENTS-DISPLAY-NAV section 8, row DN-6; design/components/ConfirmSheet/
 * spec.md, `mock/confirm-sheet-console.html`): the one confirm step, in place of the browser's `confirm()`, so its
 * question and buttons are in the console language and it works in an installed iOS app. `role="alertdialog"`, modal,
 * named by its question and described by its line; a bottom sheet below 600 px and a centred dialog of the reading
 * width from 600 px. The safe choice (Cancel) comes first and takes focus; the confirm is a verb, never "OK"
 * (`console.confirm.*`), and a destructive one says so in its words, never by colour. Escape and the backdrop cancel;
 * Tab stays inside; focus goes back to the control that opened it. Escape and Tab are caught for the whole document
 * while it is open, and the page behind is `inert`, so focus that left the sheet (a click on its words puts it on the
 * page) can neither reach the page nor lose Escape. The console has no history bridge (the App Router owns the
 * history), so the browser back is not caught here: it leaves the page as it always did, and the sheet with it.
 */
export interface ConfirmAsk {
  /** The question, the sheet's name (the page's existing question). */
  title: string;
  /** One line under it (what else happens), when the page has one. */
  message?: string;
  /** The verb (`console.confirm.*`). */
  confirmLabel: string;
}

const alphaHex = Math.round(shadows.modal.shadowOpacity * 255)
  .toString(16)
  .padStart(2, '0');
const MODAL_SHADOW = `0 ${shadows.modal.shadowOffset.height}px ${shadows.modal.shadowRadius}px ${shadows.modal.shadowColor}${alphaHex}`;

// `max-height: 90vh` keeps a strip of the page in view above the sheet on a short phone, as the console's Display
// sheet does (a viewport share, not a size token); the buttons' row basis is the design-system ConfirmSheet's 4 x xxxl.
const CONFIRM_CSS = `
.hr-confirm-scrim{position:fixed;inset:0;z-index:${z.modal};background:${colors.surface.overlay}}
.hr-confirm{position:fixed;left:0;right:0;bottom:0;z-index:${z.modal};max-height:90vh;overflow-y:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:${rem(spacing.md)};background:${colors.surface.paper};color:${colors.text.primary};border-radius:${radii.xl}px ${radii.xl}px 0 0;padding:${rem(spacing.xl)} ${layout.gutter.compact}px;box-shadow:${MODAL_SHADOW};text-align:left}
.hr-confirm h2{margin:0;font-size:${rem(typography.size.prompt)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};overflow-wrap:anywhere;white-space:pre-line}
.hr-confirm p{margin:0;color:${colors.text.secondary};font-size:${rem(typography.size.body)};line-height:${typography.leading.normal};overflow-wrap:anywhere;white-space:pre-line}
.hr-confirm-actions{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-confirm-button{display:inline-flex;align-items:center;justify-content:center;min-height:${touchTarget.min}px;min-width:${touchTarget.min}px;box-sizing:border-box;padding:${rem(spacing.xs)} ${rem(spacing.lg)};border-radius:${radii.pill}px;font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};text-align:center;overflow-wrap:anywhere;cursor:pointer}
.hr-confirm-cancel{border:${borderWidth.base}px solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary}}
.hr-confirm-ok{border:${borderWidth.base}px solid ${colors.brand.primary};background:${colors.brand.primary};color:${colors.text.onPrimary}}
.hr-confirm :focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${borderWidth.base}px}
@media (min-width:${layout.breakpoint.regular / 16}em){.hr-confirm{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-50%);width:calc(100% - ${2 * layout.gutter.regular}px);max-width:${layout.maxWidth.reading}px;border-radius:${radii.xl}px;padding:${rem(spacing.xl)} ${rem(spacing.xxl)}}.hr-confirm-actions{flex-direction:row;flex-wrap:wrap}.hr-confirm-button{flex:1 1 ${rem(spacing.xxxl * 4)}}}`;

const TABBABLE = 'button:not([disabled])';

/** Where Tab goes inside the sheet: from the last control to the first, with Shift from the first to the last; null otherwise. */
export function tabTarget<T>(items: readonly T[], active: unknown, shiftKey: boolean): T | null {
  if (items.length === 0) return null;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (shiftKey && active === first) return last;
  if (!shiftKey && active === last) return first;
  return null;
}

/** The part of a key event the sheet reads. */
interface SheetKey {
  key: string;
  shiftKey: boolean;
  defaultPrevented?: boolean;
  preventDefault: () => void;
}

/** A node of the page, as far as the sheet walks it to make the rest of the page inert. */
interface PageNode {
  parentElement?: PageNode | null;
  children?: ArrayLike<PageNode>;
  tagName?: string;
  classList?: { contains: (name: string) => boolean };
  hasAttribute?: (name: string) => boolean;
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
}

/** Marks every element of the page that is not the sheet (or its scrim, or a stylesheet) `inert`; returns the undo. */
export function inertOthers(sheetNode: PageNode | null, body: PageNode | null): () => void {
  const marked: PageNode[] = [];
  for (let node = sheetNode; node && node !== body && node.parentElement; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children ?? [])) {
      if (sibling === node || sibling.tagName === 'STYLE' || sibling.tagName === 'SCRIPT' || sibling.classList?.contains('hr-confirm-scrim')) continue;
      if (typeof sibling.setAttribute !== 'function' || sibling.hasAttribute?.('inert')) continue;
      sibling.setAttribute('inert', '');
      marked.push(sibling);
    }
  }
  return () => {
    for (const node of marked) node.removeAttribute?.('inert');
  };
}

export function ConfirmSheet({ ask, onAnswer }: { ask: ConfirmAsk; onAnswer: (yes: boolean) => void }): JSX.Element {
  const m = useMessages();
  const id = useId();
  const titleId = `${id}-title`;
  const messageId = `${id}-message`;
  const sheet = useRef<HTMLDivElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);
  const latest = useRef(onAnswer);
  latest.current = onAnswer;

  // The safe choice takes focus; the opener gets it back when the sheet goes. The page behind is inert meanwhile.
  useEffect(() => {
    const doc = typeof document === 'undefined' ? null : document;
    const opener = doc ? (doc.activeElement as HTMLElement | null) : null;
    cancel.current?.focus();
    const undoInert = inertOthers(sheet.current as PageNode | null, (doc?.body as PageNode | undefined) ?? null);
    return () => {
      undoInert();
      opener?.focus?.();
    };
  }, []);

  /** Escape answers no; Tab goes round the two buttons, and from anywhere outside the sheet comes back into it. */
  const keyAction = (event: SheetKey): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      latest.current(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(sheet.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? []);
    const active = typeof document === 'undefined' ? null : document.activeElement;
    const inside = active !== null && items.includes(active as HTMLElement);
    const next = inside || items.length === 0 ? tabTarget(items, active, event.shiftKey) : event.shiftKey ? items[items.length - 1]! : items[0]!;
    if (next === null) return;
    event.preventDefault();
    next.focus();
  };
  const onKeyDown = (event: SheetKey): void => keyAction(event);

  // The same keys for the whole document while the sheet is open (focus can leave the sheet on a click on its words);
  // a key the sheet's own handler already answered is not answered twice.
  useEffect(() => {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return undefined;
    const onDocumentKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      keyAction(event);
    };
    document.addEventListener('keydown', onDocumentKey);
    return () => document.removeEventListener('keydown', onDocumentKey);
    // keyAction reads the sheet and the answer through refs: one listener for the sheet's life.
  }, []);

  return (
    <>
      <style>{CONFIRM_CSS}</style>
      <div className="hr-confirm-scrim" onClick={() => onAnswer(false)} data-testid="confirm-sheet-backdrop" aria-hidden="true" />
      <div
        ref={sheet}
        className="hr-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ask.message ? messageId : undefined}
        onKeyDown={onKeyDown}
        data-testid="confirm-sheet"
      >
        <h2 id={titleId}>{ask.title}</h2>
        {ask.message ? <p id={messageId}>{ask.message}</p> : null}
        <div className="hr-confirm-actions">
          <button ref={cancel} type="button" className="hr-confirm-button hr-confirm-cancel" onClick={() => onAnswer(false)} data-testid="confirm-sheet-cancel">
            {m.common.buttons.cancel}
          </button>
          <button type="button" className="hr-confirm-button hr-confirm-ok" onClick={() => onAnswer(true)} data-testid="confirm-sheet-confirm">
            {ask.confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * One confirm step for a page or a part: `confirm(ask)` opens the sheet and resolves with the answer (true only on the
 * confirm); the caller renders `sheet` once, anywhere in its tree. A second question while one is open answers the
 * first with the safe choice; a part that goes away answers the open one the same way.
 */
export function useConfirm(): { confirm: (ask: ConfirmAsk) => Promise<boolean>; sheet: JSX.Element | null } {
  const [open, setOpen] = useState<{ ask: ConfirmAsk; resolve: (yes: boolean) => void } | null>(null);
  const current = useRef<typeof open>(null);
  current.current = open;
  useEffect(() => () => current.current?.resolve(false), []);
  const confirm = useCallback(
    (ask: ConfirmAsk) =>
      new Promise<boolean>((resolve) => {
        current.current?.resolve(false);
        setOpen({ ask, resolve });
      }),
    [],
  );
  const answer = useCallback((yes: boolean): void => {
    const asked = current.current;
    setOpen(null);
    asked?.resolve(yes);
  }, []);
  return { confirm, sheet: open ? <ConfirmSheet ask={open.ask} onAnswer={answer} /> : null };
}
