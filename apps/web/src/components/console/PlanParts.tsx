'use client';

import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { PlanItem, SpaceKind } from '@hangul-route/content-schema';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, Muted, panelStyle } from '@/components/console/ui';
import { catalogLabel } from '@/data/catalog';
import type { PlanView } from '@/lib/console/api';
import { type ReadoutRow, memberKind, planStatusLabel, planSummary, readoutLine } from '@/lib/console/plans';
import { relativeDay } from '@/lib/console/rollup';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The published plan's readout (wireframe console/plan-builder, F-PLAN-001 §3.5): summary,
 * actions, the item list and each learner's progress. Every word comes from the dictionary
 * (F-I18N-001 PR 10b); plan titles, catalog titles, notes and names are data.
 */
export function PlanReadout({
  plan,
  rows,
  kind,
  busy,
  now,
  onEdit,
  onArchive,
  onNew,
  route,
  presentHref,
}: {
  plan: PlanView;
  rows: readonly ReadoutRow[];
  kind: SpaceKind | null;
  busy: boolean;
  now: Date;
  onEdit: () => void;
  onArchive: () => void;
  onNew: () => void;
  /** A route plan's readout (F-PLAN-002 section 3.8 step 6), shown in place of the item list and progress. */
  route?: ReactNode;
  /** "Present this plan": the lecture setup with this plan preselected (F-TCH-004 §3.11). */
  presentHref?: string;
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const p = c.plan;
  return (
    <section aria-label={p.readoutLabel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: typography.size.title, margin: 0 }}>{plan.title}</h1>
        <span style={{ color: colors.text.muted }}>{planStatusLabel(plan, locale)}</span>
      </div>
      <Muted>{planSummary(plan.items.length, plan.targetLearnerIds ? plan.targetLearnerIds.length : null, kind, locale)}</Muted>
      <div style={{ display: 'flex', gap: spacing.sm, margin: `${spacing.md}px 0`, flexWrap: 'wrap' }}>
        <Button onClick={onEdit}>{p.edit.cta}</Button>
        <Button onClick={onArchive} disabled={busy}>{p.archive.cta}</Button>
        <Button onClick={onNew}>{p.newPlan.cta}</Button>
        {presentHref ? (
          <Link href={presentHref}>
            <Button testId="present-plan">{c.lecture.presentPlan.cta}</Button>
          </Link>
        ) : null}
      </div>
      {route ?? (
        <>
          <ul style={{ ...panelStyle, listStyle: 'none', margin: `0 0 ${spacing.lg}px`, padding: spacing.lg }}>
            {plan.items.map((item, k) => (
              <li key={`${item.kind}:${item.id}`} style={{ padding: `${spacing.xs}px 0`, color: colors.text.secondary }}>
                {/* TODO(F-I18N-001 §3.9): formatDate(locale, targetDate, 'monthDay', { utc: true }) once console text may change; the raw key keeps English byte-identical (§3.4 rule 1). */}
                {k + 1}. {catalogLabel(item.kind, item.id, locale)} {item.targetDate ? `· ${item.targetDate}` : ''} {item.note ? `· ${item.note}` : ''}
              </li>
            ))}
          </ul>
          <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>{p.progressTitle}</h2>
          <Muted>{c.readoutHint}</Muted>
          <div style={{ display: 'grid', gap: spacing.sm }}>
            {rows.length === 0 ? <Muted>{p.noMembers[memberKind(kind)]}</Muted> : null}
            {rows.map((row) => (
              <div key={row.learnerId} style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' }} data-testid="readout-row">
                <strong>{row.name}</strong>
                <span style={{ color: colors.text.secondary }}>
                  {readoutLine(row, locale)} · {relativeDay(row.lastActiveAt, now, locale)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * One draft item row in the plan builder: its number and label, reorder and remove, a target
 * date and a note. The header row wraps, so a long title or a longer locale never pushes the
 * buttons off a 320px screen. A route plan's week groups (F-PLAN-002) use the same row.
 */
export function DraftItemRow({
  item,
  number,
  canUp,
  canDown,
  onUp,
  onDown,
  onRemove,
  onUpdate,
}: {
  item: PlanItem;
  number: number;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<PlanItem>) => void;
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const y = messages.console.plan.yours;
  return (
    <div style={{ borderTop: `1px solid ${colors.border.subtle}`, padding: `${spacing.sm}px 0` }} data-testid="draft-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {number}. {catalogLabel(item.kind, item.id, locale)}
        </span>
        <span style={{ display: 'flex', gap: spacing.xxs }}>
          <Button disabled={!canUp} onClick={onUp}>{y.moveUp.cta}</Button>
          <Button disabled={!canDown} onClick={onDown}>{y.moveDown.cta}</Button>
          <Button onClick={onRemove}>{y.remove.cta}</Button>
        </span>
      </div>
      <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' }}>
        <input type="date" value={item.targetDate ?? ''} onChange={(e) => onUpdate({ targetDate: e.target.value || undefined })} aria-label={y.dateFor(number)} style={{ padding: spacing.xs, borderRadius: radii.sm, border: `1px solid ${colors.border.strong}` }} />
        <input type="text" value={item.note ?? ''} placeholder={y.notePlaceholder} maxLength={80} onChange={(e) => onUpdate({ note: e.target.value || undefined })} aria-label={y.noteFor(number)} style={{ flex: 1, minWidth: 0, padding: spacing.xs, borderRadius: radii.sm, border: `1px solid ${colors.border.strong}` }} />
      </div>
    </div>
  );
}

/** The draft's item list in the plan builder (wireframe console/plan-builder), in plan order. */
export function PlanDraftItems({
  items,
  onMove,
  onRemove,
  onUpdate,
}: {
  items: readonly PlanItem[];
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<PlanItem>) => void;
}): JSX.Element {
  const y = useConsoleLocale().messages.console.plan.yours;
  return (
    <>
      {items.length === 0 ? <Muted>{y.empty}</Muted> : null}
      {items.map((item, k) => (
        <DraftItemRow
          key={`${item.kind}:${item.id}`}
          item={item}
          number={k + 1}
          canUp={k > 0}
          canDown={k < items.length - 1}
          onUp={() => onMove(k, k - 1)}
          onDown={() => onMove(k, k + 1)}
          onRemove={() => onRemove(k)}
          onUpdate={(patch) => onUpdate(k, patch)}
        />
      ))}
    </>
  );
}
