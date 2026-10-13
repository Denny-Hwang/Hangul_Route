'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { isStepUpHint } from '@/lib/console/step-up';
import { useMessages } from '@/lib/i18n/locale-context';
import { useConsoleAuth } from './auth-context';

/**
 * "Confirm it's you" — F-BILL-002 B-8b (sections 4.4, 4.12, 8; screen spec `design/screens/billing/step-up.md`,
 * mock `step-up.html`). A money call (checkout, portal; B-8c adds the receipt link) that the Worker answers with
 * Clerk's reverification hint opens this dialog. **Continue** runs Clerk's reverification (`useReverification`,
 * through `useConsoleAuth().reverify`), which retries the request once; **Not now** or Escape closes it ("Nothing
 * was changed."). A second refusal, or Clerk out of reach, shows "Can't confirm right now" and only Not now: no loop.
 *
 * The page behind is inert while the dialog is open (every sibling on the way up to `body`), focus stays inside it,
 * and on close focus goes back to the button that was pressed.
 */

export type StepUpPhase = 'asking' | 'verifying' | 'unavailable';

/** A money call after step-up: its result, or closed without a change. */
export type StepUpResult<T> = { kind: 'result'; result: T } | { kind: 'cancelled' };

interface Pending<T> {
  fetcher: () => Promise<T>;
  resolve: (result: StepUpResult<T>) => void;
}

export interface StepUpControl {
  /** Runs `fetcher`; on a reverification hint, asks first and resolves once the dialog settles. */
  run: <T>(fetcher: () => Promise<T>) => Promise<StepUpResult<T>>;
  /** The open dialog, or null. */
  dialog: { phase: StepUpPhase; onContinue: () => void; onCancel: () => void } | null;
}

export function useStepUp(): StepUpControl {
  const { reverify } = useConsoleAuth();
  const [phase, setPhase] = useState<StepUpPhase | null>(null);
  const pending = useRef<Pending<unknown> | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const restore = useRef(false);

  const run = useCallback(async <T,>(fetcher: () => Promise<T>): Promise<StepUpResult<T>> => {
    // The pressed button, before the page disables it while the request runs.
    opener.current = typeof HTMLElement !== 'undefined' && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = await fetcher();
    if (!isStepUpHint(first)) return { kind: 'result', result: first };
    return new Promise<StepUpResult<T>>((resolve) => {
      pending.current = { fetcher, resolve: resolve as (result: StepUpResult<unknown>) => void };
      setPhase('asking');
    });
  }, []);

  const settle = useCallback((result: StepUpResult<unknown>): void => {
    const current = pending.current;
    pending.current = null;
    restore.current = true;
    setPhase(null);
    current?.resolve(result);
  }, []);

  const onContinue = useCallback((): void => {
    const current = pending.current;
    if (!current) return;
    setPhase('verifying');
    void reverify(current.fetcher).then((outcome) => {
      if (outcome.kind === 'result') settle(outcome);
      else if (outcome.kind === 'cancelled') settle({ kind: 'cancelled' });
      else setPhase('unavailable');
    });
  }, [reverify, settle]);

  const onCancel = useCallback((): void => settle({ kind: 'cancelled' }), [settle]);

  // Back to the button that was pressed, once the page has enabled it again.
  useEffect(() => {
    if (phase !== null || !restore.current) return undefined;
    restore.current = false;
    const target = opener.current;
    const timer = setTimeout(() => {
      if (target?.isConnected) target.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [phase]);

  return { run, dialog: phase ? { phase, onContinue, onCancel } : null };
}

/** Makes every element outside the dialog's ancestor chain inert; returns the undo. */
function inertOutside(dialog: HTMLElement): () => void {
  const changed: Element[] = [];
  let node: HTMLElement | null = dialog;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || sibling.hasAttribute('inert') || sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') continue;
      sibling.setAttribute('inert', '');
      changed.push(sibling);
    }
    node = parent;
  }
  return () => {
    for (const el of changed) el.removeAttribute('inert');
  };
}

export function StepUpDialog({ phase, onContinue, onCancel }: { phase: StepUpPhase; onContinue: () => void; onCancel: () => void }): JSX.Element {
  const s = useMessages().console.billing.stepUp;
  const titleId = useId();
  const bodyId = useId();
  const box = useRef<HTMLDivElement | null>(null);
  const continueRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof document === 'undefined') return undefined;
    return inertOutside(el);
  }, []);

  // Asking: focus on Continue. Unavailable: only Not now remains, focused.
  useEffect(() => {
    if (phase === 'asking') continueRef.current?.focus();
    if (phase === 'unavailable') cancelRef.current?.focus();
  }, [phase]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (phase !== 'verifying') onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [continueRef.current, cancelRef.current].filter((b): b is HTMLButtonElement => b !== null && !b.disabled);
    if (controls.length === 0) {
      event.preventDefault();
      return;
    }
    const first = controls[0] as HTMLButtonElement;
    const last = controls[controls.length - 1] as HTMLButtonElement;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const verifying = phase === 'verifying';
  return (
    <div className="hr-bill-scrim" ref={box}>
      <div className="hr-bill-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} onKeyDown={onKeyDown} data-testid="step-up">
        <h2 id={titleId}>{s.title}</h2>
        {phase === 'unavailable' ? (
          <p id={bodyId} role="status">
            {s.unavailable}
          </p>
        ) : (
          <>
            <p id={bodyId}>{s.body}</p>
            <p className="hr-bill-reason">{s.reason}</p>
          </>
        )}
        <div className="hr-bill-dialog-actions">
          {phase === 'unavailable' ? null : (
            <button type="button" ref={continueRef} className="hr-bill-btn hr-bill-btn-primary hr-bill-btn-block" onClick={onContinue} disabled={verifying}>
              {s.cta}
            </button>
          )}
          <button type="button" ref={cancelRef} className="hr-bill-btn hr-bill-btn-block" onClick={onCancel} disabled={verifying}>
            {s.cancel.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
