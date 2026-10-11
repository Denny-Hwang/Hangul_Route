'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Button, ConsoleShell, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { Promo } from '@hangul-route/content-schema';
import type { EntitlementView, SpaceListItem } from '@/lib/console/api';
import { type BillingNote, type PlanRow, type PromoNote, billingNoteText, checkoutReturnNote, currentPlanCards, planRowsFor, planTitle, promoNoteText, promoPriceLine, sourceLine } from '@/lib/console/billing';

/** console/billing — F-ENT-001 §3.6. Web only; one Choose per recommended row; family once, group yearly, contract beyond the caps. */
function BillingInner(): JSX.Element {
  const { ready, session, api, signOut, m, locale } = useConsole();
  const c = m.console;
  const b = c.billing;
  const params = useSearchParams();
  const [spaces, setSpaces] = useState<SpaceListItem[] | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementView[] | null>(null);
  // Keys and data, not text: the notes are worded at render time, so they follow the header language select.
  const [error, setError] = useState(false);
  const [note, setNote] = useState<BillingNote | null>(() => checkoutReturnNote(params.get('checkout')));
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoNote, setPromoNote] = useState<PromoNote | null>(null);
  const now = new Date();

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(false);
    const [s, e] = await Promise.all([api.listSpaces(), api.entitlements()]);
    if (!s.ok || !e.ok) {
      setError(true);
      return;
    }
    setSpaces(s.data);
    setEntitlements(e.data);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !session) return <ConsoleShell>{null}</ConsoleShell>;

  const cards = entitlements ? currentPlanCards(entitlements, now, locale) : [];
  const rows = spaces && entitlements ? planRowsFor(session.accountId, spaces, entitlements, now, locale) : [];
  const pastDue = cards.some((card) => card.entitlement.status === 'past_due');

  const applyCode = async (): Promise<void> => {
    if (!api) return;
    const code = codeInput.trim();
    if (!code) {
      setPromo(null);
      setPromoNote(null);
      return;
    }
    // Checked against the first purchasable row; the server re-checks at checkout.
    const planKey = rows.find((r) => r.action === 'choose' && (r.planKey === 'family_lifetime' || r.planKey === 'group_license'))?.planKey ?? 'family_lifetime';
    setBusy(true);
    setPromoNote(null);
    const result = await api.checkPromo({ code, planKey: planKey === 'group_license' ? 'group_license' : 'family_lifetime' });
    setBusy(false);
    if (!result.ok) {
      setPromo(null);
      setPromoNote({ kind: result.status === 429 ? 'tooMany' : result.code === 'stripe_not_configured' ? 'notConfigured' : 'invalid' });
      return;
    }
    setPromo(result.data.promo);
    setCodeInput(result.data.promo.code);
    setPromoNote({ kind: 'applied', code: result.data.promo.code, name: result.data.promo.name });
  };

  const choose = async (row: PlanRow): Promise<void> => {
    if (!api || !row.subjectKind || !row.subjectId || row.planKey === 'free' || row.planKey === 'school_seat') return;
    setBusy(true);
    setNote(null);
    const result = await api.checkout({ planKey: row.planKey, subjectKind: row.subjectKind, subjectId: row.subjectId, ...(promo ? { promoCode: promo.code } : {}) });
    setBusy(false);
    if (!result.ok) {
      if (result.code === 'promo_invalid') {
        setPromo(null);
        setPromoNote({ kind: 'invalid' });
        return;
      }
      setNote(result.code === 'stripe_not_configured' ? 'notConfigured' : 'checkoutFailed');
      return;
    }
    window.location.assign(result.data.url);
  };

  const manage = async (subjectKind: 'account' | 'space', subjectId: string): Promise<void> => {
    // Only yearly group licences have a Stripe subscription to manage; lifetime has nothing to cancel.
    if (!api) return;
    setBusy(true);
    setNote(null);
    const result = await api.portal({ subjectKind, subjectId });
    setBusy(false);
    if (!result.ok) {
      setNote(result.code === 'stripe_not_configured' ? 'notConfigured' : 'portalFailed');
      return;
    }
    window.location.assign(result.data.url);
  };

  return (
    <ConsoleShell onSignOut={signOut} title={b.title}>
      {!api ? <Notice tone="nudge">{c.shell.noApi}</Notice> : null}
      {note ? <Notice tone={note === 'success' ? 'success' : 'nudge'}>{billingNoteText(note, locale)}</Notice> : null}
      {pastDue ? <Notice tone="nudge">{c.billingPastDue}</Notice> : null}
      {error ? (
        <div style={{ ...panelStyle, marginBottom: spacing.lg }}>
          <p style={{ margin: 0 }}>{b.cantCheck}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}

      <section aria-label={b.current.title} style={{ marginBottom: spacing.xl }}>
        <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>{b.current.title}</h2>
        {entitlements && cards.length === 0 ? (
          <div style={panelStyle}>
            <strong>{planTitle('free', locale)}</strong>
            <Muted>{b.current.freeLine}</Muted>
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
              {card.canManage ? <Button disabled={busy} onClick={() => void manage(card.entitlement.subjectKind, card.entitlement.subjectId)}>{b.manage.cta}</Button> : null}
            </div>
          ))}
        </div>
      </section>

      <section aria-label={b.plans.title} style={{ marginBottom: spacing.xl }}>
        <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>{b.plans.title}</h2>
        <form
          aria-label={b.promo.formLabel}
          onSubmit={(e) => {
            e.preventDefault();
            void applyCode();
          }}
          style={{ ...panelStyle, marginBottom: spacing.sm }}
        >
          <Field label={c.promoLabel} name="promo" value={codeInput} onChange={setCodeInput} placeholder={b.promo.placeholder} maxLength={32} />
          <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button type="submit" disabled={busy || !api}>
              {promo ? b.promo.change.cta : b.promo.apply.cta}
            </Button>
            <Muted>{promoNote ? promoNoteText(promoNote, locale) : c.promoHint}</Muted>
          </div>
        </form>
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
                <Button tone={row.recommended ? 'primary' : 'secondary'} disabled={busy || !api} onClick={() => void choose(row)}>
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
      </section>

      <Muted>{c.billingKidsLine}</Muted>
    </ConsoleShell>
  );
}

export default function BillingPage(): JSX.Element {
  return (
    <Suspense fallback={<ConsoleShell>{null}</ConsoleShell>}>
      <BillingInner />
    </Suspense>
  );
}
