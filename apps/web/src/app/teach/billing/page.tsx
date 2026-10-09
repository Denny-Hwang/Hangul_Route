'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Button, ConsoleShell, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { Promo } from '@hangul-route/content-schema';
import type { EntitlementView, SpaceListItem } from '@/lib/console/api';
import { checkoutReturnNotice, currentPlanCards, planRowsFor, promoPriceLine, sourceLine, type PlanRow } from '@/lib/console/billing';
import { COPY } from '@/lib/console/copy';

/** console/billing — F-ENT-001 §3.6. Web only; one Choose per recommended row; family once, group yearly, contract beyond the caps. */
function BillingInner(): JSX.Element {
  const { ready, session, api, signOut } = useConsole();
  const params = useSearchParams();
  const [spaces, setSpaces] = useState<SpaceListItem[] | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(() => checkoutReturnNotice(params.get('checkout')));
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoNote, setPromoNote] = useState<string | null>(null);
  const now = new Date();

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(null);
    const [s, e] = await Promise.all([api.listSpaces(), api.entitlements()]);
    if (!s.ok || !e.ok) {
      setError("Can't check your plan right now.");
      return;
    }
    setSpaces(s.data);
    setEntitlements(e.data);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !session) return <ConsoleShell>{null}</ConsoleShell>;

  const cards = entitlements ? currentPlanCards(entitlements, now) : [];
  const rows = spaces && entitlements ? planRowsFor(session.accountId, spaces, entitlements, now) : [];
  const pastDue = cards.some((c) => c.entitlement.status === 'past_due');

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
      setPromoNote(result.status === 429 ? COPY.promoTooMany : result.code === 'stripe_not_configured' ? COPY.promoNotConfigured : COPY.promoInvalid);
      return;
    }
    setPromo(result.data.promo);
    setCodeInput(result.data.promo.code);
    setPromoNote(`${result.data.promo.code} applied${result.data.promo.name ? ` · ${result.data.promo.name}` : ''}.`);
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
        setPromoNote(COPY.promoInvalid);
        return;
      }
      setNote(result.code === 'stripe_not_configured' ? COPY.billingNotConfigured : "Couldn't start checkout. Try again.");
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
      setNote(result.code === 'stripe_not_configured' ? COPY.billingNotConfigured : "Couldn't open the billing portal.");
      return;
    }
    window.location.assign(result.data.url);
  };

  return (
    <ConsoleShell onSignOut={signOut} title="Billing">
      {!api ? <Notice tone="nudge">The console needs an API address (NEXT_PUBLIC_API_BASE_URL) on this build.</Notice> : null}
      {note ? <Notice tone={note === COPY.billingSuccess ? 'success' : 'nudge'}>{note}</Notice> : null}
      {pastDue ? <Notice tone="nudge">{COPY.billingPastDue}</Notice> : null}
      {error ? (
        <div style={{ ...panelStyle, marginBottom: spacing.lg }}>
          <p style={{ margin: 0 }}>{error}</p>
          <Button onClick={() => void load()}>{COPY.tryAgain}</Button>
        </div>
      ) : null}

      <section aria-label="Current plan" style={{ marginBottom: spacing.xl }}>
        <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>Current plan</h2>
        {entitlements && cards.length === 0 ? (
          <div style={panelStyle}>
            <strong>Free</strong>
            <Muted>Stage 1, local progress, Rescue Code, file backup. Classes hold up to 20 students.</Muted>
          </div>
        ) : null}
        <div style={{ display: 'grid', gap: spacing.sm }}>
          {cards.map((c) => (
            <div key={c.entitlement.id} style={{ ...panelStyle, opacity: c.active ? 1 : 0.7 }} data-testid="plan-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' }}>
                <strong>
                  {c.title} <span style={{ color: colors.text.muted, fontWeight: typography.weight.regular }}>· {c.subject}</span>
                </strong>
                <span style={{ color: colors.text.secondary }}>{c.status}</span>
              </div>
              <Muted>
                {sourceLine(c.entitlement)}
                {c.entitlement.seats ? ` · ${c.entitlement.seats} seats` : ''}
              </Muted>
              {c.canManage ? <Button disabled={busy} onClick={() => void manage(c.entitlement.subjectKind, c.entitlement.subjectId)}>Manage subscription</Button> : null}
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Plans" style={{ marginBottom: spacing.xl }}>
        <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>Plans</h2>
        <form
          aria-label="Promo code"
          onSubmit={(e) => {
            e.preventDefault();
            void applyCode();
          }}
          style={{ ...panelStyle, marginBottom: spacing.sm }}
        >
          <Field label={COPY.promoLabel} name="promo" value={codeInput} onChange={setCodeInput} placeholder="HOYA20" maxLength={32} />
          <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button type="submit" disabled={busy || !api}>
              {promo ? 'Change code' : 'Apply code'}
            </Button>
            <Muted>{promoNote ?? COPY.promoHint}</Muted>
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
                  <strong>{promoPriceLine(row.planKey, promo) ?? row.price}</strong>
                  {row.planKey === 'family_lifetime' ? ` · ${COPY.lifetimeLine}` : row.planKey === 'group_license' ? ` · ${COPY.groupLine}` : row.planKey === 'school_seat' ? ` · ${COPY.contactLine}` : ''}
                </Muted>
              </div>
              {row.action === 'choose' ? (
                <Button tone={row.recommended ? 'primary' : 'secondary'} disabled={busy || !api} onClick={() => void choose(row)}>
                  Choose
                </Button>
              ) : row.action === 'contact' ? (
                <a href="mailto:hello@hangulroute.com?subject=School%20contract" style={{ color: colors.text.secondary }}>
                  Contact us
                </a>
              ) : row.action === 'current' ? (
                <span style={{ color: colors.feedback.success, fontWeight: typography.weight.bold }}>current</span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <Muted>{COPY.billingKidsLine}</Muted>
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
