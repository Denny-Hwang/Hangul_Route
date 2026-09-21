'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Button, ConsoleShell, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { EntitlementView, SpaceListItem } from '@/lib/console/api';
import { PROVIDER_LABEL, checkoutReturnNotice, currentPlanCards, planRowsFor, type PlanRow } from '@/lib/console/billing';
import { COPY } from '@/lib/console/copy';

/** console/billing — F-ENT-001 §3.6. Web only; one Choose per recommended row; prices are placeholders. */
function BillingInner(): JSX.Element {
  const { ready, session, api, signOut } = useConsole();
  const params = useSearchParams();
  const [spaces, setSpaces] = useState<SpaceListItem[] | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(() => checkoutReturnNotice(params.get('checkout')));
  const [busy, setBusy] = useState(false);
  const [interval, setInterval_] = useState<'monthly' | 'yearly'>('yearly');
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

  const choose = async (row: PlanRow): Promise<void> => {
    if (!api || !row.subjectKind || !row.subjectId || row.planKey === 'free' || row.planKey === 'school_seat') return;
    setBusy(true);
    setNote(null);
    const result = await api.checkout({ planKey: row.planKey, interval, subjectKind: row.subjectKind, subjectId: row.subjectId });
    setBusy(false);
    if (!result.ok) {
      setNote(result.code === 'stripe_not_configured' ? COPY.billingNotConfigured : "Couldn't start checkout. Try again.");
      return;
    }
    window.location.assign(result.data.url);
  };

  const manage = async (subjectKind: 'account' | 'space', subjectId: string): Promise<void> => {
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
            <Muted>Stage 1, 4 profiles, local progress, Rescue Code, file backup.</Muted>
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
                paid via {PROVIDER_LABEL[c.entitlement.provider]}
                {c.entitlement.seats ? ` · ${c.entitlement.seats} seats` : ''}
              </Muted>
              {c.canManage ? <Button disabled={busy} onClick={() => void manage(c.entitlement.subjectKind, c.entitlement.subjectId)}>Manage subscription</Button> : null}
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Plans" style={{ marginBottom: spacing.xl }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>Plans</h2>
          <label style={{ color: colors.text.secondary, fontSize: typography.size.bodySm }}>
            Billing{' '}
            <select value={interval} onChange={(e) => setInterval_(e.target.value === 'monthly' ? 'monthly' : 'yearly')} aria-label="Billing interval" style={{ padding: spacing.xs }}>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'grid', gap: spacing.sm }}>
          {rows.map((row) => (
            <div key={`${row.planKey}:${row.subjectId ?? 'me'}`} style={{ ...panelStyle, borderColor: row.recommended ? colors.brand.primary : colors.border.subtle, display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>{row.title}</strong>
                {row.subjectName ? <span style={{ color: colors.text.muted }}> · {row.subjectName}</span> : null}
                <Muted>{row.includes}</Muted>
                <Muted>{row.price}</Muted>
              </div>
              {row.action === 'choose' ? (
                <Button tone={row.recommended ? 'primary' : 'secondary'} disabled={busy || !api} onClick={() => void choose(row)}>
                  Choose
                </Button>
              ) : row.action === 'contact' ? (
                <a href="mailto:hello@hangulroute.com?subject=School%20seats" style={{ color: colors.text.secondary }}>
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
