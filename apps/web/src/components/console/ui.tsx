'use client';

import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import type { CSSProperties, ReactNode } from 'react';
import type { LoadError } from '@/lib/console/routing';
import { useMessages } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';

/** Token-only building blocks for the console — F-CONSOLE-001. */
export const panelStyle: CSSProperties = {
  padding: spacing.lg,
  backgroundColor: colors.surface.paper,
  borderRadius: radii.lg,
  border: `1px solid ${colors.border.subtle}`,
};

/**
 * The console button look; also used by a link that navigates (one interactive element, not a button inside a link).
 * It owns the size (AMENDMENTS-GROWNUP-UX GX-D11, row GX-6): never shorter than `touchTarget.min`, never narrower than
 * `touchTarget.child`, the label centred, so a short label never turns into a circle and no row mixes heights. A spread
 * of it sets no size or box of its own (`button-size.test.tsx` scans the console for that).
 */
export const buttonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  minHeight: touchTarget.min,
  minWidth: touchTarget.child,
  textAlign: 'center',
  textDecoration: 'none',
  padding: `${spacing.sm}px ${spacing.lg}px`,
  borderRadius: radii.pill,
  fontWeight: typography.weight.bold,
  fontSize: rem(typography.size.bodySm),
  border: `1px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  cursor: 'pointer',
};

/**
 * The console's pill select (the notes filter's look, AMENDMENTS-GROWNUP-UX T12): as tall as a button, never wider than
 * its row, the label in the button type.
 */
export const selectBase: CSSProperties = {
  minHeight: touchTarget.min,
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: `0 ${spacing.lg}px`,
  borderRadius: radii.pill,
  border: `${borderWidth.thin}px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  fontFamily: 'inherit',
  fontSize: rem(typography.size.bodySm),
  fontWeight: typography.weight.bold,
};

export function Button({ children, tone = 'secondary', disabled, onClick, type = 'button', testId, ariaLabel, describedBy }: { children: ReactNode; tone?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit'; testId?: string; ariaLabel?: string; describedBy?: string }): JSX.Element {
  const toneStyle: CSSProperties =
    tone === 'primary'
      ? { backgroundColor: colors.brand.primary, color: colors.text.onPrimary, borderColor: colors.brand.primary }
      : tone === 'danger'
        ? { color: colors.feedback.danger, borderColor: colors.feedback.danger }
        : {};
  return (
    <button type={type} disabled={disabled} onClick={onClick} data-testid={testId} aria-label={ariaLabel} aria-describedby={describedBy} style={{ ...buttonBase, ...toneStyle, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  );
}

export function Field({ label, value, onChange, placeholder, type = 'text', maxLength, required, name, describedBy }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: 'text' | 'email'; maxLength?: number; required?: boolean; name: string; describedBy?: string }): JSX.Element {
  return (
    <label style={{ display: 'block', marginBottom: spacing.md }}>
      <span style={{ display: 'block', fontSize: rem(typography.size.caption), color: colors.text.muted, marginBottom: spacing.xxs }}>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: `${spacing.sm}px ${spacing.md}px`,
          fontSize: rem(typography.size.body),
          borderRadius: radii.md,
          border: `1px solid ${colors.border.strong}`,
          backgroundColor: colors.surface.paper,
          color: colors.text.primary,
        }}
      />
    </label>
  );
}

export function Muted({ children, id }: { children: ReactNode; id?: string }): JSX.Element {
  return <p id={id} style={{ color: colors.text.muted, fontSize: rem(typography.size.bodySm), margin: `${spacing.xs}px 0` }}>{children}</p>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'nudge' | 'success' }): JSX.Element {
  const bg = tone === 'nudge' ? colors.feedback.nudgeLight : tone === 'success' ? colors.feedback.successLight : colors.feedback.infoLight;
  return (
    <div role="status" style={{ ...panelStyle, backgroundColor: bg, borderColor: 'transparent', marginBottom: spacing.md }}>
      {children}
    </div>
  );
}

/**
 * The panel a console page shows when its data did not load (settings, school admin): the page's
 * own `forbidden` words, or "can't reach" for anything else, and Try again. `error` is a key, so the
 * words follow the header language select.
 */
export function LoadErrorPanel({ error, forbidden, onRetry }: { error: LoadError; forbidden: string; onRetry: () => void }): JSX.Element {
  const c = useMessages().console;
  return (
    <div style={panelStyle}>
      <p style={{ margin: 0 }}>{error === 'forbidden' ? forbidden : c.cantReach}</p>
      <Button onClick={onRetry}>{c.tryAgain}</Button>
    </div>
  );
}
