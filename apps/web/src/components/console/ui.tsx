'use client';

import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

/** Token-only building blocks for the console — F-CONSOLE-001. */
export const panelStyle: CSSProperties = {
  padding: spacing.lg,
  backgroundColor: colors.surface.paper,
  borderRadius: radii.lg,
  border: `1px solid ${colors.border.subtle}`,
};

const buttonBase: CSSProperties = {
  padding: `${spacing.sm}px ${spacing.lg}px`,
  borderRadius: radii.pill,
  fontWeight: typography.weight.bold,
  fontSize: typography.size.bodySm,
  border: `1px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  cursor: 'pointer',
};

export function Button({ children, tone = 'secondary', disabled, onClick, type = 'button', testId }: { children: ReactNode; tone?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit'; testId?: string }): JSX.Element {
  const toneStyle: CSSProperties =
    tone === 'primary'
      ? { backgroundColor: colors.brand.primary, color: colors.text.onPrimary, borderColor: colors.brand.primary }
      : tone === 'danger'
        ? { color: colors.feedback.danger, borderColor: colors.feedback.danger }
        : {};
  return (
    <button type={type} disabled={disabled} onClick={onClick} data-testid={testId} style={{ ...buttonBase, ...toneStyle, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  );
}

export function Field({ label, value, onChange, placeholder, type = 'text', maxLength, required, name }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: 'text' | 'email'; maxLength?: number; required?: boolean; name: string }): JSX.Element {
  return (
    <label style={{ display: 'block', marginBottom: spacing.md }}>
      <span style={{ display: 'block', fontSize: typography.size.caption, color: colors.text.muted, marginBottom: spacing.xxs }}>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: `${spacing.sm}px ${spacing.md}px`,
          fontSize: typography.size.body,
          borderRadius: radii.md,
          border: `1px solid ${colors.border.strong}`,
          backgroundColor: colors.surface.paper,
          color: colors.text.primary,
        }}
      />
    </label>
  );
}

export function Muted({ children }: { children: ReactNode }): JSX.Element {
  return <p style={{ color: colors.text.muted, fontSize: typography.size.bodySm, margin: `${spacing.xs}px 0` }}>{children}</p>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'nudge' | 'success' }): JSX.Element {
  const bg = tone === 'nudge' ? colors.feedback.nudgeLight : tone === 'success' ? colors.feedback.successLight : colors.feedback.infoLight;
  return (
    <div role="status" style={{ ...panelStyle, backgroundColor: bg, borderColor: 'transparent', marginBottom: spacing.md }}>
      {children}
    </div>
  );
}

export function ConsoleShell({ children, onSignOut, title }: { children: ReactNode; onSignOut?: () => void; title?: string }): JSX.Element {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: `${spacing.xl}px ${spacing.lg}px` }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl, gap: spacing.md, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <Link href="/" style={{ color: colors.text.muted, fontSize: typography.size.caption }}>
            ← Hangul Route
          </Link>
          <Link href="/teach/home" style={{ fontWeight: typography.weight.bold, fontSize: typography.size.bodyLg, color: colors.text.primary }}>
            Console
          </Link>
          {title ? <span style={{ color: colors.text.secondary }}>· {title}</span> : null}
        </div>
        <nav style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
          <Button disabled>Account</Button>
          <Link href="/teach/billing">
            <Button>Billing</Button>
          </Link>
          {onSignOut ? <Button onClick={onSignOut}>Sign out</Button> : null}
        </nav>
      </header>
      {children}
    </main>
  );
}
