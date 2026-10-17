'use client';

import { colors, radii, shadows, spacing, typography } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Button } from './ui';

/**
 * The console's confirm (owner request 2026-10-16, item 8; design/components/ConfirmSheet/as-built.md "Where it is used"):
 * a `<dialog>` element in the page instead of the browser's `window.confirm()`, whose OK / Cancel followed the
 * browser's language and not the console's. The question is the same string the page asked before; the two buttons
 * are the console language's Cancel and OK (`common.buttons`). Cancel comes first and has the focus, because
 * every console confirm guards a change (a new class code, a removal, an archive, a dropped draft). Escape cancels.
 * `showModal()` makes the page behind inert and keeps the focus inside; it returns the focus to the opener on close.
 */

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
  const answered = useRef(false);
  const once = (yes: boolean): void => {
    if (answered.current) return;
    answered.current = true;
    onAnswer(yes);
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    if (typeof el.showModal === 'function') {
      if (!el.open) el.showModal();
    } else el.setAttribute('open', '');
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
      <p id={questionId} style={{ margin: 0, whiteSpace: 'pre-line', fontSize: typography.size.body, lineHeight: typography.leading.normal }}>
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
