'use client';

import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { buttonBase } from '@/components/console/ui';
import { useFrameAttention } from '@/components/console/use-persona-attention';
import { attentionHref, relinkBarView, type PersonaAttention } from '@/lib/console/persona-attention';
import { ROUTES } from '@/lib/console/routing';
import type { SchoolMoveLink } from '@/lib/console/transfer-requests';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';

/**
 * The teacher's counts outside the class page (AMENDMENTS-GROWNUP-UX GX-3, sections 5.5 and 6; mock
 * `design/screens/approvals/mock/home-{lc}.html`): the amber **{n} need your OK** chip after a class's name (home rows,
 * the school page's class rows), a school row's links to its classes with requests waiting, and the re-link bar the
 * frame draws at the top of every other teacher page. Counts and class names only; never a learner's name. Amber
 * (`feedback.nudge`) means "your action" and is a border, dot or bar only; text is `text.primary`.
 */

/** The chip's frame rules (`ATTENTION_CSS`, drawn by AdultFrame): pill height, with a hit area `touchTarget.min` tall. */
export const ATTENTION_CSS = `
.hr-attn-chip{position:relative;display:inline-flex;align-items:center;gap:${spacing.xs}px;padding:${spacing.xs}px ${spacing.md}px;border-radius:${radii.pill}px;border:${borderWidth.base}px solid ${colors.feedback.nudge};background:${colors.feedback.nudgeLight};color:${colors.text.primary};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};white-space:nowrap;text-decoration:none}
.hr-attn-chip::before{content:"";flex:none;width:${spacing.sm}px;height:${spacing.sm}px;border-radius:${radii.circle}px;background:${colors.feedback.nudge}}
.hr-attn-chip::after{content:"";position:absolute;left:0;right:0;top:50%;height:${touchTarget.min}px;transform:translateY(-50%)}
.hr-frame-count{display:inline-flex;align-items:center;justify-content:center;min-width:${spacing.lg}px;padding:0 ${spacing.xs}px;margin-inline-start:${spacing.xs}px;border-radius:${radii.pill}px;background:${colors.feedback.nudge};color:${colors.text.primary};font-size:${rem(typography.size.bodySm)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
`;

/** The class row's chip: the frame's count once GX-W is deployed, else the page's own (`fallback`). Nothing at 0. */
export function AttentionCountChip({ spaceId, fallback, testId }: { spaceId: string; fallback?: number; testId?: string }): JSX.Element | null {
  const attention = useFrameAttention();
  const { messages } = useConsoleLocale();
  const n = attention?.bySpace[spaceId]?.all ?? fallback ?? 0;
  if (n <= 0) return null;
  return (
    <Link className="hr-attn-chip" href={attentionHref(spaceId, 'class')} data-testid={testId ?? `class-attention-${spaceId}`}>
      {messages.console.home.attention(n)}
    </Link>
  );
}

const linkButton: CSSProperties = {
  ...buttonBase,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: touchTarget.min,
  boxSizing: 'border-box',
  textDecoration: 'none',
};
const linksRow: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.sm, paddingTop: spacing.sm, borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}` };

/** A school's classes with requests waiting, from the school's `attention` (null when the frame has none for it). */
export function schoolAttentionRows(attention: PersonaAttention | null, schoolId: string): Array<{ spaceId: string; name: string | null; n: number }> | null {
  const ids = attention?.schools[schoolId];
  if (!attention || !ids) return null;
  return ids.flatMap((spaceId) => {
    const n = attention.bySpace[spaceId]?.all ?? 0;
    return n > 0 ? [{ spaceId, name: attention.names[spaceId] ?? null, n }] : [];
  });
}

/**
 * A school row's links on the teacher home: one per child class with requests waiting, to that class's review. Before
 * GX-W (no school `attention`) the shipped links stay: waiting moves only, to the class's moves page.
 */
export function SchoolAttentionLinks({ schoolId, fallback }: { schoolId: string; fallback: readonly SchoolMoveLink[] }): JSX.Element | null {
  const attention = useFrameAttention();
  const { messages } = useConsoleLocale();
  const c = messages.console;
  const rows = schoolAttentionRows(attention, schoolId);
  if (rows) {
    if (rows.length === 0) return null;
    return (
      <div style={linksRow}>
        {rows.map((row) => (
          <Link key={row.spaceId} href={attentionHref(row.spaceId, 'class')} style={linkButton} data-testid={`school-attention-${row.spaceId}`}>
            {row.name ? c.home.schoolClassAttention(row.name, row.n) : c.home.attention(row.n)}
          </Link>
        ))}
      </div>
    );
  }
  if (fallback.length === 0) return null;
  return (
    <div style={linksRow}>
      {fallback.map((link) => (
        <Link key={link.spaceId} href={ROUTES.spaceTransfers(link.spaceId, 'class')} style={linkButton} data-testid={`school-moves-${link.spaceId}`}>
          {c.transfer.schoolRow(link.name, link.waiting)}
        </Link>
      ))}
    </div>
  );
}

const MINUTE_MS = 60_000;

/**
 * The re-link bar (section 5.5): while a new device waits in any class the teacher answers for, on every teacher page but
 * the class page, lecture mode and the presenter. Its sentence is the live region (announced when it appears and when
 * the count changes); the minutes line under it changes once a minute and is not announced. **Review** opens the class
 * page at its review; the bar never approves (GX-D12: the pop-up carries the safety hint). Not dismissible.
 */
export function RelinkBar({ attention, now = () => Date.now() }: { attention: PersonaAttention | null; now?: () => number }): JSX.Element | null {
  const { messages } = useConsoleLocale();
  const c = messages.console;
  const clock = useRef(now);
  clock.current = now;
  const [at, setAt] = useState(() => now());
  const waiting = (attention?.relinks ?? 0) > 0;
  // The minutes line moves once a minute while a re-link waits, and again whenever the counts are read.
  useEffect(() => {
    setAt(clock.current());
    if (!waiting) return undefined;
    const timer = setInterval(() => setAt(clock.current()), MINUTE_MS);
    return () => clearInterval(timer);
  }, [waiting, attention]);
  const view = relinkBarView(attention, new Date(at));
  if (!view) return null;
  const sentence = view.count === 1 && view.name ? c.relinkBar.one(view.name) : c.relinkBar.many(view.count);
  return (
    <div
      data-testid="relink-bar"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: `${spacing.sm}px ${spacing.md}px`,
        margin: `0 0 ${spacing.lg}px`,
        padding: `${spacing.md}px ${spacing.lg}px`,
        backgroundColor: colors.feedback.nudgeLight,
        borderInlineStart: `${borderWidth.thick}px solid ${colors.feedback.nudge}`,
        borderRadius: radii.md,
        color: colors.text.primary,
      }}
    >
      <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
        <p role="status" data-testid="relink-bar-text" style={{ margin: 0, fontWeight: typography.weight.bold, overflowWrap: 'anywhere' }}>
          {sentence}
        </p>
        {view.minutes !== null ? (
          <p data-testid="relink-bar-minutes" style={{ margin: 0, fontSize: rem(typography.size.bodySm) }}>
            {c.status.minutesLeft(view.minutes)}
          </p>
        ) : null}
      </div>
      <Link href={view.href} data-testid="relink-bar-review" style={{ ...linkButton, backgroundColor: colors.brand.primary, borderColor: colors.brand.primary, color: colors.text.onPrimary }}>
        {c.status.review.cta}
      </Link>
    </div>
  );
}
