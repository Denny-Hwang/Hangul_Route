'use client';

import { useEffect, useId, useRef, type RefObject } from 'react';
import { CLASS_CODE_OVERLAY_CSS, CODE_OVERLAY_ATTR, returnFocusTarget, type CodeOverlayView, type FocusNode } from '@/lib/console/class-code-overlay';
import { useMessages } from '@/lib/i18n/locale-context';
import { inertOthers } from './ConfirmSheet';
import { JoinLinkQrImage } from './JoinLinkParts';
import { buttonBase } from './ui';

/**
 * Show the code (AMENDMENTS-CLASS-CODE-OVERLAY, row CO-1; mock `design/screens/console/class-code-overlay.md`): the
 * class name, the class code and a QR code on an opaque full-window dialog, and nothing else, so the classroom screen
 * shows no learner. It takes the view (`codeOverlayView`), never the roster. ConfirmSheet's focus rules, with the review
 * sheet's first focus: the heading takes focus on open (the content is to be read, the one control comes next); Escape and
 * Tab are caught for the whole document; every other element of the page is `inert` and the root does not scroll while
 * it is open; on close focus goes to the opener from its ref, else the page head, else the error panel (`returnTo`, in
 * that order; never `document.activeElement`, which a click does not set in Safari and Firefox on macOS). The root
 * carries `data-hr-code-overlay` while it is open, the hook of the print rule: printing prints the overlay only.
 */

/** The part of a key event the overlay reads. */
interface OverlayKey {
  key: string;
  shiftKey: boolean;
  defaultPrevented?: boolean;
  preventDefault: () => void;
}

/** The parts of the root element the overlay marks. */
interface RootElement {
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
  style?: { overflow: string };
}

export function ClassCodeOverlay({ view, onClose, returnTo }: { view: CodeOverlayView; onClose: () => void; returnTo: ReadonlyArray<RefObject<FocusNode | null>> }): JSX.Element {
  const m = useMessages();
  const id = useId();
  const nameId = `${id}-name`;
  const captionId = `${id}-caption`;
  const spokenId = `${id}-spoken`;
  const expiryId = `${id}-expiry`;
  const dialog = useRef<HTMLDivElement | null>(null);
  const name = useRef<HTMLHeadingElement | null>(null);
  const close = useRef<HTMLButtonElement | null>(null);
  const latestClose = useRef(onClose);
  latestClose.current = onClose;
  const latestReturn = useRef(returnTo);
  latestReturn.current = returnTo;

  // On open: focus on the heading, the page behind inert, the root marked and not scrolling. On close: all of it put back,
  // then focus to the first target that is still connected. The return runs as a passive cleanup, after the commit that
  // removed the overlay, so a page head or an error panel drawn by that same commit already has its ref.
  useEffect(() => {
    const doc = typeof document === 'undefined' ? null : document;
    const root = (doc?.documentElement as RootElement | undefined) ?? null;
    const overflowBefore = root?.style?.overflow ?? '';
    name.current?.focus?.();
    const undoInert = inertOthers(dialog.current as Parameters<typeof inertOthers>[0], (doc?.body as Parameters<typeof inertOthers>[1] | undefined) ?? null);
    root?.setAttribute?.(CODE_OVERLAY_ATTR, '');
    if (root?.style) root.style.overflow = 'hidden';
    return () => {
      undoInert();
      root?.removeAttribute?.(CODE_OVERLAY_ATTR);
      if (root?.style) root.style.overflow = overflowBefore;
      const back = (): FocusNode | null => {
        const target = returnFocusTarget(latestReturn.current.map((ref) => ref.current));
        target?.focus?.();
        return target;
      };
      // Nothing to go back to yet: the read that ended the code may set the roster and the error in two renders (a root
      // that does not batch), so the page head or the error panel is tried once more when the current task has ended.
      if (back() === null) void Promise.resolve().then(back);
    };
    // Once per opening: the page mounts a new overlay each time.
  }, []);

  /** Escape closes; Tab and Shift+Tab stay on Close, the one control. */
  const keyAction = (event: OverlayKey): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      latestClose.current();
      return;
    }
    if (event.key !== 'Tab') return;
    event.preventDefault();
    close.current?.focus?.();
  };

  // The same keys for the whole document while it is open (focus can leave the dialog on a click on its words); a key the
  // dialog's own handler already answered is not answered twice.
  const keyRef = useRef(keyAction);
  keyRef.current = keyAction;
  useEffect(() => {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return undefined;
    const onDocumentKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      keyRef.current(event);
    };
    document.addEventListener('keydown', onDocumentKey);
    return () => document.removeEventListener('keydown', onDocumentKey);
  }, []);

  return (
    <>
      <style>{CLASS_CODE_OVERLAY_CSS}</style>
      <div
        ref={dialog}
        className="hr-co"
        role="dialog"
        aria-modal="true"
        aria-labelledby={nameId}
        aria-describedby={`${captionId} ${spokenId} ${expiryId}`}
        onKeyDown={keyAction}
        data-testid="class-code-overlay"
      >
        <div className="hr-co-body">
          <div className="hr-co-text">
            <h2 ref={name} id={nameId} tabIndex={-1} className="hr-co-name">
              {view.spaceName}
            </h2>
            <p id={captionId} className="hr-co-caption">
              {view.codeLabel}
            </p>
            <p aria-hidden="true" className="hr-co-code" data-testid="class-code">
              {view.code}
            </p>
            <span id={spokenId} className="hr-co-spoken">
              {view.spokenCode}
            </span>
            <p id={expiryId} className="hr-co-expiry">
              {view.expiry}
            </p>
            <p className="hr-co-how">{view.howToJoin}</p>
          </div>
          <figure className="hr-co-qr">
            <JoinLinkQrImage url={view.joinLink} label={m.console.space.joinLink.qr.label} side="100%" framed={false} testId="class-code-qr" />
            <figcaption className="hr-co-qr-caption">{m.console.space.joinLink.qr.caption}</figcaption>
          </figure>
        </div>
        <div className="hr-co-close">
          <button ref={close} type="button" onClick={() => latestClose.current()} style={buttonBase} data-testid="class-code-close">
            {m.common.buttons.close}
          </button>
        </div>
      </div>
    </>
  );
}
