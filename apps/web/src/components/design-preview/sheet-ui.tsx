import { resolveColor, type ColorToken } from '@hangul-route/design-system/scene-art';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

/** Shared pieces of the two contact-sheet pages (F-STORY-002 §3.9.6). Server components. */

export const mono: CSSProperties = { fontFamily: typography.family.mono, fontSize: typography.size.caption };
export const muted: CSSProperties = { color: colors.text.muted, fontSize: typography.size.caption };
export const frame: CSSProperties = {
  backgroundColor: colors.surface.paper,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  borderRadius: radii.md,
};
/** A frame around a drawing: flex, so the inline svg leaves no baseline gap. */
export const artFrame: CSSProperties = { ...frame, display: 'flex', overflow: 'hidden' };

export function PreviewShell({ title, intro, links, children }: { title: string; intro: ReactNode; links: Array<{ href: string; label: string }>; children: ReactNode }): JSX.Element {
  return (
    <main style={{ maxWidth: 1600, margin: '0 auto', padding: `${spacing.xxl}px ${spacing.lg}px`, backgroundColor: colors.surface.canvas, minHeight: '100vh' }}>
      <header style={{ marginBottom: spacing.xl }}>
        <nav style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap' }}>
          {links.map((l) => (
            // no prefetch: the contact sheet's RSC payload is large (it grows with the art)
            <Link key={l.href} href={l.href} prefetch={false} style={{ color: colors.brand.primary, fontWeight: 600 }}>
              {l.label}
            </Link>
          ))}
        </nav>
        <h1 style={{ fontSize: typography.size.display, fontWeight: 700, color: colors.text.primary, margin: `${spacing.sm}px 0` }}>{title}</h1>
        <div style={{ fontSize: typography.size.body, color: colors.text.secondary, maxWidth: 900 }}>{intro}</div>
      </header>
      {children}
    </main>
  );
}

export function StatRow({ items }: { items: Array<{ label: string; value: number | string; testId?: string }> }): JSX.Element {
  return (
    <dl style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', margin: `${spacing.lg}px 0` }}>
      {items.map((s) => (
        <div key={s.label} style={{ ...frame, padding: `${spacing.sm}px ${spacing.md}px`, minWidth: 96 }}>
          <dt style={muted}>{s.label}</dt>
          <dd data-testid={s.testId} style={{ margin: 0, fontSize: typography.size.title, fontWeight: 700, color: colors.text.primary }}>
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'draft' | 'ready' | 'tale' }): JSX.Element {
  const bg = { plain: colors.surface.sunken, draft: colors.feedback.nudgeLight, ready: colors.feedback.successLight, tale: colors.brand.secondaryLight }[tone];
  return (
    <span style={{ display: 'inline-block', padding: `${spacing.xxs}px ${spacing.sm}px`, borderRadius: radii.pill, backgroundColor: bg, color: colors.text.primary, fontSize: typography.size.caption, fontWeight: 600 }}>
      {children}
    </span>
  );
}

export interface FindingLike {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  source?: string;
}

export function FindingList({ findings }: { findings: readonly FindingLike[] }): JSX.Element {
  if (findings.length === 0) return <p style={{ ...muted, margin: 0 }}>No findings</p>;
  return (
    <ul style={{ margin: 0, paddingLeft: spacing.lg, display: 'grid', gap: spacing.xs }}>
      {findings.map((f, i) => (
        <li key={`${f.rule}-${i}`} data-severity={f.severity} style={{ fontSize: typography.size.caption, color: colors.text.primary }}>
          <strong style={{ color: f.severity === 'error' ? colors.brand.primaryDark : colors.text.secondary }}>{f.severity}</strong>{' '}
          <code style={mono}>{f.source ? `${f.source}:${f.rule}` : f.rule}</code> {f.message}
        </li>
      ))}
    </ul>
  );
}

export function Swatches({ tokens }: { tokens: readonly ColorToken[] }): JSX.Element {
  return (
    <ul style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, margin: 0, padding: 0, listStyle: 'none' }}>
      {tokens.map((t) => (
        <li key={t} style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, ...mono }}>
          <span aria-hidden style={{ width: spacing.md, height: spacing.md, borderRadius: radii.xs, backgroundColor: resolveColor(t), border: `${borderWidth.thin}px solid ${colors.border.strong}` }} />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** The review checklist of F-STORY-002 §3.9.6, printed on both pages and pasted into every art PR. */
export const REVIEW_CHECKLIST = [
  'Brief represented (deviations listed in the PR)',
  'Artefacts and costume match their sourceRef',
  'Palette and bands (Hoya’s own palette is outside the scene cap)',
  'One focal point',
  'Readable at 96 px',
  'Faces smile or are calm; people are faceless',
  'No text, emoji or raster',
  'Alt text says what is shown and what it means',
  'No violence or fear',
  'Budgets pass',
] as const;

export function ReviewChecklist(): JSX.Element {
  return (
    <details style={{ ...frame, padding: spacing.md, margin: `${spacing.lg}px 0` }}>
      <summary style={{ fontWeight: 600, color: colors.text.primary, cursor: 'pointer' }}>Review checklist</summary>
      <ol style={{ margin: `${spacing.sm}px 0 0`, paddingLeft: spacing.xl, color: colors.text.secondary, fontSize: typography.size.bodySm }}>
        {REVIEW_CHECKLIST.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
    </details>
  );
}
