'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import type { Promo } from '@hangul-route/content-schema';
import { Button, Muted, panelStyle } from '@/components/console/ui';
import { type CurrentPlanCard, type PlanRow, freePlanLine, planTitle, promoPriceLine, sourceLine } from '@/lib/console/billing';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The billing page's current-plan list (wireframe console/billing, F-ENT-001 §3.6): the free
 * card when nothing is active, else one card per entitlement. Every word comes from the
 * dictionary (F-I18N-001 PR 10b); space names and promo codes are data.
 */
export function CurrentPlanList({
  cards,
  showFree,
  busy,
  onManage,
}: {
  cards: readonly CurrentPlanCard[];
  showFree: boolean;
  busy: boolean;
  onManage: (subjectKind: 'account' | 'space', subjectId: string) => void;
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const b = messages.console.billing;
  return (
    <>
      {showFree ? (
        <div style={panelStyle}>
          <strong>{planTitle('free', locale)}</strong>
          <Muted>{freePlanLine(locale)}</Muted>
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: spacing.sm }}>
        {cards.map((card) => (
          <div key={card.entitlement.id} style={{ ...panelStyle, opacity: card.active ? 1 : 0.7 }} data-testid="plan-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' }}>
              <strong>
                {card.title} <span style={{ color: colors.text.muted, fontWeight: typography.weight.regular }}>· {card.subject}</span>
              </strong>
              <span style={{ color: colors.text.secondary }}>{card.status}</span>
            </div>
            <Muted>
              {sourceLine(card.entitlement, locale)}
              {card.entitlement.seats ? ` · ${b.seats(card.entitlement.seats)}` : ''}
            </Muted>
            {card.canManage ? <Button disabled={busy} onClick={() => onManage(card.entitlement.subjectKind, card.entitlement.subjectId)}>{b.manage.cta}</Button> : null}
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * The plan rows to choose from (wireframe console/billing): one Choose on the recommended row,
 * the contract row's mail link, a "current" pill. Prices come from `promoPriceLine` / `row.price`.
 */
export function PlanRowList({
  rows,
  promo,
  disabled,
  onChoose,
}: {
  rows: readonly PlanRow[];
  promo: Promo | null;
  disabled: boolean;
  onChoose: (row: PlanRow) => void;
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const b = c.billing;
  return (
    <div style={{ display: 'grid', gap: spacing.sm }}>
      {rows.map((row) => (
        <div key={`${row.planKey}:${row.subjectId ?? 'me'}`} style={{ ...panelStyle, borderColor: row.recommended ? colors.brand.primary : colors.border.subtle, display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <strong>{row.title}</strong>
            {row.subjectName ? <span style={{ color: colors.text.muted }}> · {row.subjectName}</span> : null}
            <Muted>{row.includes}</Muted>
            <Muted>
              <strong>{promoPriceLine(row.planKey, promo, locale) ?? row.price}</strong>
              {row.planKey === 'family_lifetime' ? ` · ${c.lifetimeLine}` : row.planKey === 'group_license' ? ` · ${c.groupLine}` : row.planKey === 'school_seat' ? ` · ${c.contactLine}` : ''}
            </Muted>
          </div>
          {row.action === 'choose' ? (
            <Button tone={row.recommended ? 'primary' : 'secondary'} disabled={disabled} onClick={() => onChoose(row)}>
              {b.choose.cta}
            </Button>
          ) : row.action === 'contact' ? (
            <a href="mailto:hello@hangulroute.com?subject=School%20contract" style={{ color: colors.text.secondary }}>
              {b.contact.cta}
            </a>
          ) : row.action === 'current' ? (
            <span style={{ color: colors.feedback.success, fontWeight: typography.weight.bold }}>{b.isCurrent.pill}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
