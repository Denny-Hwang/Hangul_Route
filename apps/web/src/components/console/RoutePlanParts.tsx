'use client';

import type { CurriculumMeta, PlanItem } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { UiLocale } from '@hangul-route/i18n';
import { useEffect, useRef, useState } from 'react';
import { ItemText, WeekHeading } from '@/components/console/CurriculumParts';
import { DraftItemRow } from '@/components/console/PlanParts';
import { Button, Muted, Notice, panelStyle } from '@/components/console/ui';
import type { PlanView } from '@/lib/console/api';
import {
  dayText,
  isStaleCatalog,
  planSwitcherOrder,
  readoutLine,
  repacePlan,
  routeShownOrder,
  thisWeekOf,
  weekGroups,
  weeksToFit,
  type RepaceResult,
} from '@/lib/console/curriculum';
import { planStatusLabel, type ReadoutRow } from '@/lib/console/plans';
import { useMessages } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';

/**
 * The plan page's route views (F-PLAN-002 section 3.8 steps 5-6; wireframe
 * console/curriculum-planner E-F): the plan switcher, and the published readout of a
 * route plan with its This week block, the collapsible week list and **Re-pace from
 * today**. Learners stay in roster (activity) order; no ranking, no percentage.
 */

/** Active route first, then other live plans, then drafts (replaces "newest only"). */
export function PlanSwitcher({ plans, selectedId, onSelect, locale }: { plans: readonly PlanView[]; selectedId: string | null; onSelect: (plan: PlanView) => void; locale: UiLocale }): JSX.Element | null {
  const c = useMessages().console.curriculum.builder;
  const ordered = planSwitcherOrder(plans);
  if (ordered.length < 2) return null;
  const activeRoute = ordered[0]?.meta && ordered[0].publishedAt ? ordered[0].id : null;
  return (
    <nav aria-label={c.plans} style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.lg }}>
      <span style={{ color: colors.text.muted, fontSize: rem(typography.size.caption) }}>{c.plans}</span>
      {ordered.map((plan) => {
        const selected = plan.id === selectedId;
        const status = plan.id === activeRoute ? c.activeRoute : planStatusLabel(plan, locale);
        return (
          <button
            key={plan.id}
            type="button"
            aria-current={selected ? 'true' : undefined}
            onClick={() => onSelect(plan)}
            data-testid="plan-chip"
            style={{
              minHeight: spacing.xxxl,
              padding: `${spacing.xs}px ${spacing.md}px`,
              borderRadius: radii.pill,
              border: `${selected ? borderWidth.base : borderWidth.thin}px solid ${selected ? colors.brand.primary : colors.border.strong}`,
              backgroundColor: selected ? colors.brand.primaryLight : colors.surface.paper,
              color: colors.text.primary,
              fontSize: rem(typography.size.caption),
              fontWeight: selected ? typography.weight.bold : typography.weight.regular,
              cursor: 'pointer',
            }}
          >
            {c.planChip(plan.title, status)}
          </button>
        );
      })}
    </nav>
  );
}

/** The week groups of a route's items, read-only (the readout's week list). */
function WeekList({ meta, items, locale }: { meta: CurriculumMeta; items: readonly PlanItem[]; locale: UiLocale }): JSX.Element {
  const unscheduledLabel = useMessages().console.curriculum.builder.unscheduled;
  const { rows, unscheduled } = weekGroups(meta.weeks, items);
  const list = (entries: (typeof rows)[number]['items']): JSX.Element | null =>
    entries.length === 0 ? null : (
      <ul style={{ margin: `0 0 ${spacing.sm}px`, paddingLeft: spacing.lg, color: colors.text.secondary, fontSize: rem(typography.size.bodySm) }}>
        {entries.map((item) => (
          <li key={`${item.kind}:${item.id}:${item.index}`}>
            <ItemText item={item} locale={locale} />
          </li>
        ))}
      </ul>
    );
  return (
    <div>
      {rows.map((row) => (
        <div key={row.week.index} style={{ borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}` }}>
          <WeekHeading row={row} locale={locale} />
          {list(row.items)}
        </div>
      ))}
      {unscheduled.length > 0 ? (
        <div style={{ borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}` }}>
          <h3 style={{ fontSize: rem(typography.size.bodySm), margin: `${spacing.sm}px 0 ${spacing.xs}px` }}>{unscheduledLabel}</h3>
          {list(unscheduled)}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A route draft's items in the builder (section 3.8 step 5), grouped under the route's weeks
 * and numbered in the order shown. Up and down trade an item's place on the calendar with its
 * neighbour in that order (`swapRouteItems`); a date change moves it to the week that holds
 * the new date (the page recomputes `week`).
 */
export function RouteDraftItems({
  meta,
  items,
  locale,
  onSwap,
  onRemove,
  onUpdate,
}: {
  meta: CurriculumMeta;
  items: readonly PlanItem[];
  locale: UiLocale;
  onSwap: (a: number, b: number) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<PlanItem>) => void;
}): JSX.Element {
  const c = useMessages().console;
  const groups = weekGroups(meta.weeks, items);
  const shown = routeShownOrder(groups);
  const row = (index: number): JSX.Element | null => {
    const item = items[index];
    const at = shown.indexOf(index);
    if (item === undefined || at < 0) return null;
    const before = shown[at - 1];
    const after = shown[at + 1];
    return (
      <DraftItemRow
        key={`${item.kind}:${item.id}`}
        item={item}
        number={at + 1}
        canUp={before !== undefined}
        canDown={after !== undefined}
        onUp={() => before !== undefined && onSwap(index, before)}
        onDown={() => after !== undefined && onSwap(index, after)}
        onRemove={() => onRemove(index)}
        onUpdate={(patch) => onUpdate(index, patch)}
      />
    );
  };
  return (
    <>
      {items.length === 0 ? <Muted>{c.plan.yours.empty}</Muted> : null}
      {groups.rows.map((week) => (
        <div key={week.week.index} style={{ borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}` }} data-testid="builder-week">
          <WeekHeading row={week} locale={locale} />
          {week.items.map((entry) => row(entry.index))}
        </div>
      ))}
      {groups.unscheduled.length > 0 ? (
        <div style={{ borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}` }}>
          <h3 style={{ fontSize: rem(typography.size.bodySm), margin: `${spacing.sm}px 0 ${spacing.xs}px` }}>{c.curriculum.builder.unscheduled}</h3>
          {groups.unscheduled.map((entry) => row(entry.index))}
        </div>
      ) : null}
      <Muted>{c.curriculum.builder.datesFromCalendar}</Muted>
    </>
  );
}

type RepaceStep = { at: 'idle' } | { at: 'confirm'; result: RepaceResult; fit: number | null; longer: RepaceResult | null };

/**
 * A published route plan: This week first (its items and each learner's "so far" line), the
 * collapsible list of all weeks, then Re-pace from today with a confirm that names the next
 * session and what no longer fits. `onSave` stores the re-paced items and meta on the same plan;
 * the page renders this with `key={plan.id}`, so an open confirm never outlives a plan switch.
 */
export function RouteReadout({
  plan,
  rows,
  today,
  locale,
  busy,
  onSave,
  relativeDayOf,
}: {
  plan: PlanView & { meta: CurriculumMeta };
  rows: readonly ReadoutRow[];
  today: string;
  locale: UiLocale;
  busy: boolean;
  onSave: (result: RepaceResult) => Promise<boolean>;
  relativeDayOf: (iso: string) => string;
}): JSX.Element {
  const messages = useMessages().console;
  const c = messages.curriculum;
  const [step, setStep] = useState<RepaceStep>({ at: 'idle' });
  const [note, setNote] = useState<'repaced' | 'failed' | null>(null);
  const confirmText = useRef<HTMLParagraphElement>(null);
  const stale = isStaleCatalog(plan.meta);
  const where = thisWeekOf(plan.meta.weeks, today);
  const planned = plan.items.length;
  const thisWeek = where.status === 'in' ? weekGroups([where.week], plan.items).rows[0] : undefined;

  useEffect(() => {
    if (step.at === 'confirm') confirmText.current?.focus();
  }, [step.at]);

  const ask = (): void => {
    setNote(null);
    try {
      const result = repacePlan(plan, today, new Date().toISOString());
      const fit = result.leftOver > 0 ? weeksToFit(plan, today) : null;
      setStep({ at: 'confirm', result, fit, longer: fit === null ? null : repacePlan(plan, today, new Date().toISOString(), fit) });
    } catch {
      // A stored meta this build cannot read (a newer generator, a bad date): say so, never crash the readout.
      setNote('failed');
    }
  };
  const confirm = async (result: RepaceResult): Promise<void> => {
    const saved = await onSave(result);
    setNote(saved ? 'repaced' : 'failed');
    if (saved) setStep({ at: 'idle' });
  };

  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: spacing.md }} data-testid="route-this-week">
        <h2 style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.xs}px` }}>
          {where.status === 'in' ? c.readout.thisWeek(where.week.index) : where.status === 'before' ? c.readout.notStarted(dayText(where.startDate, locale)) : c.readout.ended}
        </h2>
        {thisWeek ? (
          <>
            <WeekHeading row={thisWeek} locale={locale} />
            {thisWeek.items.length > 0 ? (
              <ul style={{ margin: `0 0 ${spacing.sm}px`, paddingLeft: spacing.lg, color: colors.text.secondary, fontSize: rem(typography.size.bodySm) }}>
                {thisWeek.items.map((item) => (
                  <li key={`${item.kind}:${item.id}:${item.index}`}>
                    <ItemText item={item} locale={locale} />
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
        <Muted>{messages.readoutHint}</Muted>
        <div style={{ display: 'grid', gap: spacing.xs, marginTop: spacing.sm }}>
          {rows.map((row) => (
            <div key={row.learnerId} data-testid="readout-row" style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}`, paddingTop: spacing.xs }}>
              <strong>{row.name}</strong>
              <span style={{ color: colors.text.secondary }}>
                {readoutLine(row, planned, locale)} · {relativeDayOf(row.lastActiveAt)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <details style={{ ...panelStyle, marginBottom: spacing.md }}>
        <summary style={{ cursor: 'pointer', fontWeight: typography.weight.bold, minHeight: spacing.xxxl, display: 'flex', alignItems: 'center' }}>{c.readout.allWeeks}</summary>
        <WeekList meta={plan.meta} items={plan.items} locale={locale} />
      </details>

      {stale ? <Muted>{c.readout.refreshLine}</Muted> : null}
      {note === 'repaced' ? <Notice tone="success">{c.readout.repaced}</Notice> : null}
      {note === 'failed' ? <Notice tone="nudge">{c.readout.repaceFailed}</Notice> : null}
      {step.at === 'idle' ? (
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button onClick={ask} disabled={busy} testId="route-repace">
            {stale ? c.readout.refresh.cta : c.readout.repace.cta}
          </Button>
          <Muted>{c.readout.repaceHint}</Muted>
        </div>
      ) : (
        <div role="group" aria-label={stale ? c.readout.refresh.cta : c.readout.repace.cta} style={{ ...panelStyle, borderColor: colors.brand.primary }} data-testid="route-repace-confirm">
          <p ref={confirmText} tabIndex={-1} style={{ margin: `0 0 ${spacing.sm}px` }}>
            {step.result.nextDate ? (stale ? c.readout.refreshAsk : c.readout.repaceAsk)(dayText(step.result.nextDate, locale)) : c.readout.repaceNoSessions}
          </p>
          {step.result.leftOver > 0 ? <p style={{ margin: `0 0 ${spacing.sm}px`, color: colors.text.secondary }}>{c.readout.repaceLeftOver(step.result.leftOver, dayText(step.result.endDate, locale))}</p> : null}
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
            {step.result.nextDate ? (
              <Button tone="primary" disabled={busy} onClick={() => void confirm(step.result)} testId="route-repace-yes">
                {stale ? c.readout.refresh.cta : c.readout.repaceConfirm.cta}
              </Button>
            ) : null}
            {step.fit !== null && step.longer ? (
              <Button disabled={busy} onClick={() => step.longer && void confirm(step.longer)} testId="route-repace-longer">
                {c.readout.addWeeks.cta(step.fit)}
              </Button>
            ) : null}
            <Button onClick={() => setStep({ at: 'idle' })}>{c.readout.cancel.cta}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
