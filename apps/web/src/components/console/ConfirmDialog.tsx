'use client';

import { colors, radii, shadows, spacing, typography } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { rem } from '@/lib/console/rem';
import { Button } from './ui';

/**
 * The console's confirm (owner request 2026-10-16, item 8; design/components/ConfirmSheet/as-built.md "Where it is used"):
 * a `<dialog>` element in the page instead of the browser's `window.confirm()`, whose OK / Cancel followed the
 * browser's language and not the console's. The question is the same string the page asked before; the two buttons
 * are the console language's Cancel and OK (`common.buttons`). Cancel comes first and has the focus, because
 * every console confirm guards a change (a new class code, a removal, an archive, a dropped draft). Escape cancels.
 * `showModal()` makes the page behind inert and keeps the focus inside; on an answer the dialog closes while it is
 * still in the page and the focus goes back to the control that opened it.
 *
 * A browser without `HTMLDialogElement.prototype.showModal` (Safari before 15.4: iOS 14 and the first iOS 15 iPads)
 * would draw a `<dialog>` as a plain box at the end of the page, out of sight, so there the question goes to the
 * browser's own `window.confirm()` as before this dialog existed: its buttons follow the browser's language, but it
 * always shows and always answers.
 */

/** Whether this browser draws a modal `<dialog>` (`showModal`); false on the server and in Safari before 15.4. */
export function modalDialogSupported(): boolean {
  const ctor = (globalThis as { HTMLDialogElement?: { prototype?: { showModal?: unknown } } }).HTMLDialogElement;
  return typeof ctor?.prototype?.showModal === 'function';
}

/** The browser's own confirm, for a browser with no modal dialog; no window (never in a page) answers no. */
function browserConfirm(question: string): boolean {
  const win = (globalThis as { window?: { confirm?: (message: string) => boolean } }).window;
  return typeof win?.confirm === 'function' ? win.confirm(question) : false;
}

export interface ConfirmLabels {
  ok: string;
  cancel: string;
}

export interface ConfirmControl {
  /** Asks `question` (line breaks kept); resolves true on OK, false on Cancel or Escape. */
  ask: (question: string) => Promise<boolean>;
  /** The open dialog to render once in the page, or null. */
  dialog: JSX.Element | null;
}

interface Pending {
  question: string;
  resolve: (yes: boolean) => void;
}

export function useConfirmDialog(labels: ConfirmLabels): ConfirmControl {
  const [pending, setPending] = useState<Pending | null>(null);
  const current = useRef<Pending | null>(null);
  const ask = useCallback(
    (question: string): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        // A second ask while one is open answers the first as Cancel: one question at a time.
        current.current?.resolve(false);
        if (!modalDialogSupported()) {
          current.current = null;
          setPending(null);
          resolve(browserConfirm(question));
          return;
        }
        const next = { question, resolve };
        current.current = next;
        setPending(next);
      }),
    [],
  );
  const answer = useCallback((yes: boolean): void => {
    const open = current.current;
    current.current = null;
    setPending(null);
    open?.resolve(yes);
  }, []);
  // A page that unmounts with the dialog open says no.
  useEffect(() => () => current.current?.resolve(false), []);
  return {
    ask,
    dialog: pending ? <ConfirmDialog key={pending.question} question={pending.question} labels={labels} onAnswer={answer} /> : null,
  };
}

const dialogStyle: CSSProperties = {
  maxWidth: spacing.jumbo * 8,
  width: `calc(100% - ${2 * spacing.lg}px)`,
  padding: spacing.xl,
  border: 'none',
  borderRadius: radii.xl,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  boxShadow: `0 ${shadows.modal.shadowOffset.height}px ${shadows.modal.shadowRadius}px ${colors.surface.overlay}`,
};

export function ConfirmDialog({ question, labels, onAnswer }: { question: string; labels: ConfirmLabels; onAnswer: (yes: boolean) => void }): JSX.Element {
  const questionId = useId();
  const box = useRef<HTMLDialogElement | null>(null);
  // The control that had the focus when the question opened (the Regenerate, Remove or Archive button).
  const opener = useRef<{ focus?: () => void; isConnected?: boolean } | null>(null);
  const answered = useRef(false);
  const once = (yes: boolean): void => {
    if (answered.current) return;
    answered.current = true;
    // Close while the dialog is still in the page and modal (the page drops it right after the answer), then give the
    // focus back to its opener, so a keyboard or screen-reader user does not land on the page body.
    const el = box.current;
    if (el?.open && typeof el.close === 'function') el.close();
    const back = opener.current;
    if (back?.isConnected !== false) back?.focus?.();
    onAnswer(yes);
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const doc = (globalThis as { document?: { activeElement?: unknown } }).document;
    opener.current = (doc?.activeElement as { focus?: () => void; isConnected?: boolean } | null | undefined) ?? null;
    if (typeof el.showModal === 'function' && !el.open) el.showModal();
    // Cancel has the focus (the first button).
    el.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (el.open && typeof el.close === 'function') el.close();
    };
  }, []);

  return (
    <dialog
      ref={box}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={questionId}
      data-testid="console-confirm"
      style={dialogStyle}
      onCancel={(event) => {
        // Escape: the browser would close the dialog itself; the page closes it with the answer instead.
        event.preventDefault();
        once(false);
      }}
    >
      {/* rem, so the console text size (--hr-text-scale) and the browser's text size grow it like every console line. */}
      <p id={questionId} style={{ margin: 0, whiteSpace: 'pre-line', fontSize: rem(typography.size.body), lineHeight: typography.leading.normal }}>
        {question}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg }}>
        <Button onClick={() => once(false)} testId="console-confirm-cancel">
          {labels.cancel}
        </Button>
        <Button tone="primary" onClick={() => once(true)} testId="console-confirm-ok">
          {labels.ok}
        </Button>
      </div>
    </dialog>
  );
}
