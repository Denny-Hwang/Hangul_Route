'use client';

import type { CurriculumWarning, WeekKind } from '@hangul-route/content-schema';
import { borderWidth, colors, layout, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button, Notice } from '@/components/console/ui';
import { dateRangeText, dayText, extraText, warningText, weekLabel, type FreePlanWording, type WeekItem, type WeekRow } from '@/lib/console/curriculum';
import { ROUTES } from '@/lib/console/routing';
import { useMessages } from '@/lib/i18n/locale-context';
import { rem } from '@/lib/console/rem';

/**
 * Building blocks of the curriculum planner (F-PLAN-002 section 3.8; wireframe
 * console/curriculum-planner A-F). Tokens only; every word comes from
 * `console.curriculum` messages. Kinds and tags are always written out, never
 * shown by colour alone (section 3.11).
 */

/** A chip or card with a visible selected state; `role` radio inside a radiogroup, checkbox for a multi-select. */
export function Chip({
  selected,
  onClick,
  children,
  role = 'radio',
  testId,
  wide = false,
  disabled = false,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  role?: 'radio' | 'checkbox';
  testId?: string;
  wide?: boolean;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      style={{
        minHeight: wide ? undefined : spacing.xxxl,
        padding: wide ? spacing.lg : `${spacing.sm}px ${spacing.lg}px`,
        borderRadius: wide ? radii.lg : radii.pill,
        border: `${selected ? borderWidth.base : borderWidth.thin}px solid ${selected ? colors.brand.primary : colors.border.strong}`,
        backgroundColor: selected ? colors.brand.primaryLight : colors.surface.paper,
        color: colors.text.primary,
        fontSize: rem(typography.size.bodySm),
        fontWeight: selected ? typography.weight.bold : typography.weight.regular,
        textAlign: wide ? 'left' : 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * Arrow keys inside a radiogroup move to the next or previous radio and select it (the ARIA
 * radio group pattern); Tab still reaches every chip, so nothing is hidden from the keyboard.
 */
export function onRadioKeys(event: KeyboardEvent<HTMLElement>): void {
  const step = NEXT_KEYS.has(event.key) ? 1 : PREVIOUS_KEYS.has(event.key) ? -1 : 0;
  if (step === 0) return;
  const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([disabled])'));
  if (radios.length === 0) return;
  const at = radios.findIndex((radio) => radio === event.target);
  const next = radios[(at + step + radios.length) % radios.length];
  if (!next) return;
  event.preventDefault();
  next.focus();
  next.click();
}

/** The narrowest wide card in a grid group: three across a regular window, one on a phone (like the starting-point cards). */
const CARD_MIN = layout.breakpoint.regular / 3;

/** A group label and its chips, wrapping on a narrow window; `grid` lays wide cards in columns that fold to one on a phone. */
export function ChipGroup({ label, children, role = 'radiogroup', grid = false }: { label: string; children: ReactNode; role?: 'radiogroup' | 'group'; grid?: boolean }): JSX.Element {
  const layoutStyle = grid
    ? { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${CARD_MIN}px, 1fr))`, gap: spacing.sm }
    : { display: 'flex', flexWrap: 'wrap' as const, gap: spacing.sm };
  return (
    <div style={{ marginBottom: spacing.lg }}>
      <div style={{ fontSize: rem(typography.size.caption), color: colors.text.muted, marginBottom: spacing.xs }}>{label}</div>
      <div role={role} aria-label={label} onKeyDown={role === 'radiogroup' ? onRadioKeys : undefined} style={layoutStyle}>
        {children}
      </div>
    </div>
  );
}

/**
 * The *Suggested* tag on the recommended pace and length (F-PLAN-002 P2-6b, FP-B5; wireframe
 * journey/my-route-overview K2): written text inside the chip, so a screen reader hears it with
 * the choice and it never rests on colour alone.
 */
export function SuggestedTag(): JSX.Element {
  const words = useMessages().console.curriculum.rhythm;
  return (
    <span
      data-testid="suggested-tag"
      style={{
        display: 'inline-block',
        marginLeft: spacing.sm,
        fontSize: rem(typography.size.caption),
        fontWeight: typography.weight.bold,
        padding: `${spacing.xxs}px ${spacing.sm}px`,
        borderRadius: radii.pill,
        border: `${borderWidth.thin}px solid ${colors.border.strong}`,
        backgroundColor: colors.surface.paper,
        color: colors.text.secondary,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      {words.suggested}
    </span>
  );
}

/** The kind of a week as a text badge (Learn, Culture, Review, Days off). */
export function KindBadge({ kind }: { kind: WeekKind }): JSX.Element {
  const words = useMessages().console.curriculum.preview.kind;
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: rem(typography.size.caption),
        padding: `${spacing.xxs}px ${spacing.sm}px`,
        borderRadius: radii.pill,
        border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
        backgroundColor: kind === 'learn' ? colors.surface.paper : colors.surface.sunken,
        color: colors.text.secondary,
        whiteSpace: 'nowrap',
      }}
    >
      {words[kind]}
    </span>
  );
}

/** One item of a week: its title, a written tag for a story or a coming-soon episode, and its day when it has one. */
export function ItemText({ item, locale }: { item: WeekItem; locale: UiLocale }): JSX.Element {
  const preview = useMessages().console.curriculum.preview;
  const tag = item.category === 'story' ? preview.itemTag.story : item.category === 'coming-soon' ? preview.itemTag.comingSoon : null;
  const title = tag ? preview.taggedItem(item.title, tag) : item.title;
  return <>{item.date ? preview.itemLine(dayText(item.date, locale), title) : title}</>;
}

/** Below the regular breakpoint the week table becomes a list of week cards (wireframe states: small phone). */
const NARROW_CSS = `.hr-week-cards{display:none}@media (max-width:${layout.breakpoint.regular - 1}px){.hr-week-table{display:none}.hr-week-cards{display:block}}`;

/**
 * The preview's week table (section 3.4 columns): a real table with header cells and row
 * headers on a regular or wide window, a list of week cards on a narrow one, so a phone
 * never scrolls the page sideways.
 */
export function WeekTable({ rows, locale }: { rows: readonly WeekRow[]; locale: UiLocale }): JSX.Element {
  return (
    <>
      <style>{NARROW_CSS}</style>
      <div className="hr-week-table">
        <WeekGrid rows={rows} locale={locale} />
      </div>
      <ol className="hr-week-cards" aria-label={useMessages().console.curriculum.preview.table.label} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((row) => (
          <li key={row.week.index} data-testid="week-card" style={{ borderTop: row.week.index === rows[0]?.week.index ? 'none' : `${borderWidth.thin}px solid ${colors.border.subtle}` }}>
            <WeekHeading row={row} locale={locale} />
            {row.items.length > 0 ? (
              <ul style={{ margin: `0 0 ${spacing.sm}px`, paddingLeft: spacing.lg, color: colors.text.secondary, fontSize: rem(typography.size.bodySm) }}>
                {row.items.map((item) => (
                  <li key={`${item.kind}:${item.id}:${item.index}`}>
                    <ItemText item={item} locale={locale} />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </>
  );
}

function WeekGrid({ rows, locale }: { rows: readonly WeekRow[]; locale: UiLocale }): JSX.Element {
  const preview = useMessages().console.curriculum.preview;
  const cell = { padding: `${spacing.sm}px`, borderTop: `${borderWidth.thin}px solid ${colors.border.subtle}`, verticalAlign: 'top' as const, textAlign: 'left' as const };
  const head = { ...cell, color: colors.text.muted, fontSize: rem(typography.size.caption), fontWeight: typography.weight.semibold, borderTop: 'none' };
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table aria-label={preview.table.label} style={{ borderCollapse: 'collapse', width: '100%', fontSize: rem(typography.size.bodySm), color: colors.text.secondary }}>
        <thead>
          <tr>
            <th scope="col" style={head}>{preview.table.week}</th>
            <th scope="col" style={head}>{preview.table.dates}</th>
            <th scope="col" style={head}>{preview.table.kind}</th>
            <th scope="col" style={head}>{preview.table.what}</th>
            <th scope="col" style={head}>{preview.table.items}</th>
            <th scope="col" style={head}>{preview.table.extras}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.week.index} data-testid="week-row">
              <th scope="row" style={{ ...cell, color: colors.text.primary }}>{row.week.index}</th>
              <td style={{ ...cell, whiteSpace: 'nowrap' }}>{dateRangeText(row.week.startDate, row.endDate, locale)}</td>
              <td style={cell}>
                <KindBadge kind={row.week.kind} />
              </td>
              <td style={{ ...cell, color: colors.text.primary }}>{weekLabel(row, locale)}</td>
              <td style={cell}>
                {row.items.length === 0 ? (
                  preview.noItems
                ) : (
                  <ul style={{ margin: 0, paddingLeft: spacing.lg }}>
                    {row.items.map((item) => (
                      <li key={`${item.kind}:${item.id}:${item.index}`}>
                        <ItemText item={item} locale={locale} />
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td style={cell}>{row.week.extras.map((extra) => extraText(extra, locale)).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The generator's warnings in plain words; a class's Premium line links to billing (section 3.8
 * step 4). With `free` (an unlicensed space while the free-plan switch is on, F-ENT-003 section
 * 3.9.3) the left-out line names the free plan and the product by space kind, and links
 * **Open billing** for a class and a family alike.
 */
export function WarningList({
  warnings,
  locale,
  billingLink,
  free = null,
  neutral = false,
}: {
  warnings: readonly CurriculumWarning[];
  locale: UiLocale;
  billingLink: boolean;
  free?: FreePlanWording | null;
  /** `leftOutNeutral`: the switch is on but this viewer cannot tell the coverage, so neutral product words and no link. */
  neutral?: boolean;
}): JSX.Element | null {
  const words = useMessages().console;
  if (warnings.length === 0) return null;
  const link = free ? words.access.openBilling.cta : neutral ? null : billingLink ? words.curriculum.preview.warnings.seePlans.cta : null;
  return (
    <Notice tone="nudge">
      <ul style={{ margin: 0, paddingLeft: spacing.lg, lineHeight: typography.leading.relaxed }}>
        {warnings.map((warning) => (
          <li key={`${warning.code}:${warning.week ?? 0}`} data-testid="route-warning">
            {warningText(warning, locale, free, neutral)}
            {warning.code === 'premium-needed' && link ? (
              <>
                {' '}
                <Link href={ROUTES.billing}>{link}</Link>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </Notice>
  );
}

/**
 * F-ENT-003 section 3.9.3: the plan's lessons end before the plan does (an unlicensed space with
 * the free-plan switch on). Shown above **Use this route**; the line says whether stories or only
 * practice follow; `shorterWeeks` adds **Use {weeks} weeks**, which re-runs the preview with that
 * length preset. Using the long plan stays allowed.
 */
export function ShortPlanLine({
  lastWeek,
  storiesAfter,
  soonAfter = false,
  shorterWeeks,
  onUseWeeks,
}: {
  lastWeek: number;
  storiesAfter: boolean;
  /** Coming-soon episodes sit after the last lesson week: the line says they are listed there. */
  soonAfter?: boolean;
  shorterWeeks: number | null;
  onUseWeeks: () => void;
}): JSX.Element {
  const words = useMessages().console.curriculum.freeDays;
  return (
    <div data-testid="route-short-plan" style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', margin: `${spacing.sm}px 0 ${spacing.md}px` }}>
      <p style={{ margin: 0, color: colors.text.secondary, fontSize: rem(typography.size.bodySm), lineHeight: typography.leading.relaxed }}>
        {storiesAfter ? words.shortPlan(lastWeek) : words.shortPlanPractice(lastWeek)}
        {soonAfter ? ` ${words.shortPlanSoon}` : null}
      </p>
      {shorterWeeks !== null ? (
        <Button onClick={onUseWeeks} testId="route-use-weeks">
          {words.useWeeks.cta(shorterWeeks)}
        </Button>
      ) : null}
    </div>
  );
}

/** A week heading of the builder and the readout: "Week 3 · Nov 1 – Nov 7 · Learn", the label, and the extras. */
export function WeekHeading({ row, locale }: { row: WeekRow; locale: UiLocale }): JSX.Element {
  const c = useMessages().console.curriculum;
  const extras = row.week.extras.map((extra) => extraText(extra, locale)).join(' · ');
  return (
    <div style={{ padding: `${spacing.sm}px 0 ${spacing.xs}px` }}>
      <h3 style={{ fontSize: rem(typography.size.bodySm), margin: 0, color: colors.text.primary }}>
        {c.builder.weekHeader(row.week.index, dateRangeText(row.week.startDate, row.endDate, locale), c.preview.kind[row.week.kind])}
      </h3>
      <div style={{ fontSize: rem(typography.size.caption), color: colors.text.muted }}>
        {weekLabel(row, locale)}
        {extras ? ` · ${extras}` : ''}
      </div>
      {row.items.length === 0 ? (
        <div style={{ fontSize: rem(typography.size.caption), color: colors.text.muted }}>
          {row.week.kind === 'review' ? c.builder.reviewWeek : row.week.kind === 'break' ? c.builder.breakWeek : c.builder.emptyWeek}
        </div>
      ) : null}
    </div>
  );
}
