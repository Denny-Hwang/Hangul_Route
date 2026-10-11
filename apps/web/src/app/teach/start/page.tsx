'use client';

import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { SpaceKind } from '@hangul-route/content-schema';
import { Button, ConsoleShell, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import { codeExpiry } from '@/lib/console/rollup';
import { ROUTES, landingAfterCreate, prefillName, roleCards } from '@/lib/console/routing';

type Step = { at: 'role' } | { at: 'name'; kind: SpaceKind } | { at: 'code'; spaceId: string; code: string; expiresAt: string | null };

/** console/onboarding-role — F-CONSOLE-001 §3.3. */
function StartInner(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const fromHome = params.get('from') === 'home';
  const { ready, session, api, signOut, m, locale } = useConsole();
  const c = m.console;
  const [kind, setKind] = useState<SpaceKind | null>(null);
  const [name, setName] = useState('');
  const [step, setStep] = useState<Step>({ at: 'role' });
  const [busy, setBusy] = useState(false);
  // A key, not text: worded at render time, so it follows the header language select.
  const [message, setMessage] = useState<'signInAgain' | 'createFailed' | null>(null);
  const [copied, setCopied] = useState(false);

  if (!ready || !session) return <ConsoleShell>{null}</ConsoleShell>;

  const create = async (): Promise<void> => {
    if (step.at !== 'name' || !api) return;
    setBusy(true);
    setMessage(null);
    const result = await api.createSpace({ kind: step.kind, name: name.trim(), email: session.email, displayName: session.displayName });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error === 'unauthorized' ? 'signInAgain' : 'createFailed');
      return;
    }
    if (step.kind === 'class' && result.data.joinCode) {
      setStep({ at: 'code', spaceId: result.data.space.id, code: result.data.joinCode, expiresAt: result.data.joinCodeExpiresAt });
      return;
    }
    router.replace(landingAfterCreate(step.kind, result.data.space.id, fromHome));
  };

  const copy = async (code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ConsoleShell onSignOut={signOut} title={c.start.title}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {step.at === 'role' ? (
          <>
            <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.md}px` }}>{c.start.roleTitle}</h1>
            <div style={{ display: 'grid', gap: spacing.sm }} role="radiogroup" aria-label={c.start.roleLabel}>
              {roleCards(locale).map((card) => {
                const selected = kind === card.kind;
                return (
                  <button
                    key={card.kind}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setKind(card.kind)}
                    style={{
                      ...panelStyle,
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderColor: selected ? colors.brand.primary : colors.border.subtle,
                      backgroundColor: selected ? colors.brand.primaryLight : colors.surface.paper,
                    }}
                  >
                    <div style={{ fontWeight: typography.weight.bold }}>{card.title}</div>
                    <div style={{ color: colors.text.secondary, fontSize: typography.size.bodySm }}>{card.line}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: spacing.lg, display: 'flex', gap: spacing.sm }}>
              <Button
                tone="primary"
                disabled={!kind}
                onClick={() => {
                  if (!kind) return;
                  setName(prefillName(kind, session.displayName, locale));
                  setStep({ at: 'name', kind });
                }}
              >
                {c.start.continue.cta}
              </Button>
              {fromHome ? <Button onClick={() => router.push(ROUTES.home)}>{c.start.back.cta}</Button> : null}
            </div>
          </>
        ) : step.at === 'name' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.md}px` }}>{c.start.nameTitle[step.kind]}</h1>
            <Field name="name" label={c.start.nameLabel} value={name} onChange={setName} required maxLength={40} />
            {step.kind === 'class' ? <Muted>{c.start.classJoinHint}</Muted> : null}
            {!api ? <Muted>{c.shell.noApi}</Muted> : null}
            <div style={{ display: 'flex', gap: spacing.sm }}>
              <Button type="submit" tone="primary" disabled={busy || !api || name.trim().length === 0} testId="create-space">
                {busy ? c.start.creating.cta : c.start.create.cta}
              </Button>
              <Button onClick={() => setStep({ at: 'role' })}>{c.start.back.cta}</Button>
            </div>
            {message ? <Muted>{c.start[message]}</Muted> : null}
          </form>
        ) : (
          <>
            <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.md}px` }}>{c.start.codeTitle}</h1>
            <div style={{ ...panelStyle, textAlign: 'center' }}>
              <div data-testid="class-code" style={{ fontSize: typography.size.hero, fontWeight: typography.weight.bold, letterSpacing: spacing.sm, fontFamily: typography.family.mono, borderRadius: radii.md }}>
                {step.code}
              </div>
              <Muted>{codeExpiry(step.expiresAt, new Date(), locale)}</Muted>
              <Button onClick={() => void copy(step.code)}>{copied ? c.joinCode.copied.cta : c.joinCode.copy.cta}</Button>
            </div>
            <Notice tone="success">{c.writeOnBoard}</Notice>
            <Button tone="primary" onClick={() => router.replace(ROUTES.space(step.spaceId))}>
              {c.start.goToClass.cta}
            </Button>
          </>
        )}
      </div>
    </ConsoleShell>
  );
}

export default function StartPage(): JSX.Element {
  return (
    <Suspense fallback={<ConsoleShell>{null}</ConsoleShell>}>
      <StartInner />
    </Suspense>
  );
}
