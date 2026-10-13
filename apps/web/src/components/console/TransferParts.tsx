'use client';

import { normalizeJoinCode, JOIN_CODE_LENGTH } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { ApiResult, ConsoleApi, TransferPreview, TransferView } from '@/lib/console/api';
import { startError, startErrorText, type StartError } from '@/lib/console/transfer';
import { subscribeTransferLock, transfersShown } from '@/lib/console/transfer-lock';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * Class-move parts of the console (F-SPACE-002 section 4.8, PR T-6c): the settings row's Move button, the sheet frame
 * and the class start sheet with its code field. Design authority: the T-0b mockups (`design/screens/transfer/`,
 * `start-sheet.md`; spec section 7 row T-0b, owner decision 2026-10-12: agent-made mocks approved by multi-agent
 * review). Every word comes from `console.transfer` (`useConsoleLocale`), every value is a token; no `feedback.danger`
 * anywhere (Move is never in the Danger zone). Nothing renders while `NEXT_PUBLIC_CLASS_TRANSFER` is unset.
 */

// ---------------------------------------------------------------------------
// Hooks

/** Whether the class-move entry points render: the build flag, and no `transfers_locked` seen this session. */
export function useTransfersShown(): boolean {
  return useSyncExternalStore(subscribeTransferLock, () => transfersShown(), () => transfersShown());
}

/** The browser's online state; true on the server and where the browser cannot tell. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const on = (): void => setOnline(true);
    const off = (): void => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// ---------------------------------------------------------------------------
// Buttons

/** `shadows.modal` (a React Native shadow tuple) as a CSS box shadow: the colour token with the token's opacity as alpha. */
const modalAlpha = Math.round(shadows.modal.shadowOpacity * 255)
  .toString(16)
  .padStart(2, '0');
const MODAL_SHADOW = `0 ${shadows.modal.shadowOffset.height}px ${shadows.modal.shadowRadius}px ${shadows.modal.shadowColor}${modalAlpha}`;

const btnBase: CSSProperties = {
  minHeight: touchTarget.min,
  minWidth: touchTarget.min,
  padding: `${spacing.sm}px ${spacing.xl}px`,
  borderRadius: radii.pill,
  borderWidth: borderWidth.thin,
  borderStyle: 'solid',
  borderColor: colors.border.strong,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  fontSize: typography.size.body,
  fontWeight: typography.weight.bold,
  cursor: 'pointer',
};

const btnPrimary: CSSProperties = { ...btnBase, backgroundColor: colors.brand.primary, borderColor: colors.brand.primary, color: colors.text.onPrimary };

/**
 * A 64 px move button. `waiting` is `aria-disabled` (still focusable, so a keyboard user hears why through
 * `describedBy`); `disabled` is a plain disabled button (offline, busy).
 */
export function MoveButton({
  children,
  primary,
  disabled,
  waiting,
  label,
  describedBy,
  onClick,
  testId,
}: {
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
  waiting?: boolean;
  label?: string;
  describedBy?: string;
  onClick?: () => void;
  testId?: string;
}): JSX.Element {
  const inactive = disabled || waiting;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={waiting ? true : undefined}
      aria-label={label}
      aria-describedby={describedBy}
      data-testid={testId}
      onClick={inactive ? undefined : onClick}
      style={{ ...(primary ? btnPrimary : btnBase), ...(inactive ? { backgroundColor: colors.surface.sunken, borderColor: colors.border.subtle, color: colors.text.muted, cursor: 'default' } : {}) }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// The sheet frame

/**
 * Below 45em the sheet fills the screen; from 45em a centred card at most `layout.maxWidth.reading` wide (start-sheet.md).
 * The card centres with auto margins, never a transform: a transformed card would become the containing block of a
 * sheet opened inside it (the family consent sheet) and clip it.
 */
const SHEET_CSS =
  `.hr-move-sheet{position:fixed;inset:0;overflow-y:auto;background:${colors.surface.paper};padding:${spacing.lg}px ${layout.gutter.compact}px}` +
  `@media (min-width:45em){.hr-move-scrim{position:fixed;inset:0;background:${colors.surface.overlay}}` +
  `.hr-move-sheet{inset:auto;top:${spacing.xxl}px;left:0;right:0;margin-inline:auto;width:calc(100% - ${2 * layout.gutter.regular}px);max-width:${layout.maxWidth.reading}px;max-height:calc(100% - ${2 * spacing.xxl}px);border-radius:${radii.lg}px;padding:${spacing.xl}px ${spacing.xxl}px;box-shadow:${MODAL_SHADOW}}}`;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The parts of a DOM element the frame touches; absent under a test renderer. */
interface FocusTarget {
  focus?: (options?: { preventScroll?: boolean }) => void;
  querySelectorAll?: (selector: string) => ArrayLike<FocusTarget>;
}

/**
 * A modal sheet: `role="dialog"`, `aria-modal`, labelled by its heading, which takes focus on open (never the
 * primary); Tab stays inside; Escape and the 64 px close button close it; focus returns to the opener.
 */
export function TransferSheet({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId?: string }): JSX.Element {
  const { messages } = useConsoleLocale();
  const headingId = useId();
  const sheetRef = useRef<FocusTarget | null>(null);
  const headingRef = useRef<FocusTarget | null>(null);

  useEffect(() => {
    const opener = typeof document === 'undefined' ? null : (document.activeElement as FocusTarget | null);
    headingRef.current?.focus?.({ preventScroll: true });
    return () => {
      opener?.focus?.();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = sheetRef.current?.querySelectorAll?.(FOCUSABLE);
    if (!items || items.length === 0 || typeof document === 'undefined') return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as FocusTarget | null;
    if (event.shiftKey && (active === first || active === headingRef.current)) {
      event.preventDefault();
      last?.focus?.();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus?.();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: z.modal }}>
      <style>{SHEET_CSS}</style>
      <div className="hr-move-scrim" aria-hidden onClick={onClose} />
      <div
        ref={(el) => {
          sheetRef.current = el as FocusTarget | null;
        }}
        className="hr-move-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid={testId}
        onKeyDown={onKeyDown}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.md }}>
          <h2
            id={headingId}
            tabIndex={-1}
            ref={(el) => {
              headingRef.current = el as FocusTarget | null;
            }}
            style={{ fontSize: typography.size.prompt, fontWeight: typography.weight.bold, margin: 0, color: colors.text.primary, outline: 'none' }}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label={messages.console.transfer.a11y.close}
            onClick={onClose}
            style={{ ...btnBase, width: touchTarget.min, height: touchTarget.min, padding: 0, borderRadius: radii.circle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <IconSvg name="close" size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The class code field (the learner app's join field: one input, never six boxes)

export function ClassCodeField({
  value,
  onChange,
  label,
  rules,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  rules: string;
  /** One sentence under the field (`role="alert"`); the field gets `aria-invalid`. */
  error: string | null;
  disabled?: boolean;
}): JSX.Element {
  const inputId = useId();
  const rulesId = useId();
  const errorId = useId();
  return (
    <div style={{ marginBottom: spacing.md }}>
      <label htmlFor={inputId} style={{ display: 'block', fontSize: typography.size.body, fontWeight: typography.weight.bold, marginBottom: spacing.xs, color: colors.text.primary }}>
        {label}
      </label>
      <input
        id={inputId}
        name="classCode"
        value={value}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        maxLength={JOIN_CODE_LENGTH + 4}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${rulesId} ${errorId}` : rulesId}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        style={{
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          minHeight: touchTarget.hero,
          padding: `0 ${spacing.md}px`,
          fontSize: typography.size.display,
          fontWeight: typography.weight.bold,
          letterSpacing: spacing.sm,
          textAlign: 'center',
          textTransform: 'uppercase',
          border: `${borderWidth.base}px solid ${colors.border.subtle}`,
          borderRadius: radii.lg,
          backgroundColor: colors.surface.paper,
          color: colors.text.primary,
        }}
      />
      <p id={rulesId} style={{ margin: `${spacing.xs}px 0 0`, fontSize: typography.size.bodySm, color: colors.text.muted }}>
        {rules}
      </p>
      {error ? (
        <p id={errorId} role="alert" style={{ margin: `${spacing.xs}px 0 0`, fontSize: typography.size.body, fontWeight: typography.weight.semibold, color: colors.text.primary }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The class start sheet (start-sheet.md)

const foundStyle: CSSProperties = {
  backgroundColor: colors.surface.canvas,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  borderRadius: radii.md,
  padding: spacing.lg,
  margin: `${spacing.md}px 0`,
};

const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' };

export type StartMoveApi = Pick<ConsoleApi, 'previewTransfer' | 'createTransfer'>;

export interface StartMoveSheetProps {
  /** The source class (the acting space). */
  spaceId: string;
  learner: { id: string; name: string };
  api: StartMoveApi;
  online: boolean;
  onClose: () => void;
  /** The request was created (or the caller's own open one came back, idempotent create). */
  onSent: (view: TransferView) => void;
  /** A page state the sheet cannot show: the lock (the entry points hide), a sign-out. */
  onPageState: (state: 'locked' | 'signIn') => void;
}

type Busy = null | 'looking' | 'sending';

/**
 * Move a student to another class (start-sheet.md): the code, **Find class** (a preview that writes nothing), the
 * class name from the server, **Send request** for that exact class. One primary at a time; the learner id travels in
 * the body only. A lost response is safe to repeat (create is idempotent).
 */
export function StartMoveSheet({ spaceId, learner, api, online, onClose, onSent, onPageState }: StartMoveSheetProps): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.transfer;
  const [code, setCode] = useState('');
  const [found, setFound] = useState<{ id: string; name: string; code: string } | null>(null);
  const [error, setError] = useState<StartError | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const foundTitleId = useId();

  /** Handles a failed answer; true when the sheet should look the code up again. */
  const fail = useCallback(
    (result: ApiResult<unknown>): boolean => {
      const err = startError(result, 'class');
      if (!err) return false;
      if (err.kind === 'locked' || err.kind === 'signIn') {
        onPageState(err.kind);
        return false;
      }
      if (err.kind === 'refind') return true;
      setError(err);
      return false;
    },
    [onPageState],
  );

  const find = async (typed: string): Promise<void> => {
    const normalized = normalizeJoinCode(typed);
    setError(null);
    if (!online) {
      setError({ kind: 'line', key: 'offline' });
      return;
    }
    if (!normalized) {
      setFound(null);
      setError({ kind: 'line', key: 'codeNotFound' });
      return;
    }
    setBusy('looking');
    const result: ApiResult<TransferPreview> = await api.previewTransfer(spaceId, { learnerId: learner.id, code: normalized });
    setBusy(null);
    if (!result.ok) {
      setFound(null);
      fail(result);
      return;
    }
    setFound({ id: result.data.destination.id, name: result.data.destination.name, code: normalized });
  };

  const send = async (): Promise<void> => {
    if (!found) return;
    setError(null);
    if (!online) {
      setError({ kind: 'line', key: 'offline' });
      return;
    }
    setBusy('sending');
    const result = await api.createTransfer(spaceId, { learnerId: learner.id, destinationSpaceId: found.id, code: found.code });
    setBusy(null);
    if (result.ok) {
      onSent(result.data);
      return;
    }
    // The code now opens another class: nothing was sent; look it up again and redraw step 2 from the new preview.
    if (fail(result)) await find(found.code);
  };

  const errorText = error?.kind === 'line' ? startErrorText(error, learner.name, locale) : error?.kind === 'forbidden' ? t.states.forbidden : null;

  return (
    <TransferSheet title={t.start.title(learner.name)} onClose={onClose} testId="move-start-sheet">
      <p style={{ margin: `0 0 ${spacing.md}px`, fontSize: typography.size.body, color: colors.text.primary }}>
        <strong>1.</strong> {t.start.step1}
      </p>
      <ClassCodeField
        value={code}
        onChange={(next) => {
          setCode(next);
          setError(null);
          // A different code drops step 2, so Send request never goes to a class the field no longer shows.
          setFound((prev) => (prev && normalizeJoinCode(next) !== prev.code ? null : prev));
        }}
        label={messages.console.space.codeLabel.class}
        rules={messages.caregiver.join.code.rules}
        error={errorText}
        disabled={busy !== null}
      />
      <MoveButton primary={!found} waiting={busy === 'looking'} disabled={busy === 'sending'} onClick={() => void find(code)} testId="move-find">
        {busy === 'looking' ? t.start.looking.cta : t.start.find.cta}
      </MoveButton>
      {found ? (
        <section style={foundStyle} aria-labelledby={foundTitleId} data-testid="move-found">
          <h3 id={foundTitleId} style={{ margin: `0 0 ${spacing.sm}px`, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold }}>
            2. {t.start.found(found.name)}
          </h3>
          <ul style={{ margin: 0, paddingInlineStart: spacing.lg, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>
            <li>{t.start.familyFirst}</li>
            <li>{t.start.nothingUntil}</li>
            <li>{t.start.keeps(learner.name)}</li>
          </ul>
        </section>
      ) : null}
      <div style={{ ...rowStyle, marginTop: spacing.lg }}>
        {found ? (
          <MoveButton primary waiting={busy === 'sending'} disabled={busy === 'looking'} onClick={() => void send()} testId="move-send">
            {busy === 'sending' ? t.start.sending.cta : t.start.send.cta}
          </MoveButton>
        ) : null}
        <MoveButton onClick={onClose} testId="move-cancel">
          {t.actions.cancel.cta}
        </MoveButton>
      </div>
    </TransferSheet>
  );
}

// ---------------------------------------------------------------------------
// The settings learner row's Move action (start-sheet.md, "Settings learner row")

export function MoveRowAction({ name, online, onMove }: { name: string; online: boolean; onMove: () => void }): JSX.Element {
  const { messages } = useConsoleLocale();
  const t = messages.console.transfer;
  const helpId = useId();
  return (
    <>
      <MoveButton label={t.a11y.moveRow(name)} waiting={!online} describedBy={online ? undefined : helpId} onClick={onMove} testId="move-row">
        {t.start.move.class.cta}
      </MoveButton>
      {!online ? (
        <span id={helpId} style={{ flexBasis: '100%', fontSize: typography.size.bodySm, color: colors.text.secondary }}>
          {t.states.offline}
        </span>
      ) : null}
    </>
  );
}
