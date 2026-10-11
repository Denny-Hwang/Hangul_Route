'use client';

import { SignIn } from '@clerk/clerk-react';
import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useConsoleAuth } from '@/components/console/auth-context';
import { Button, ConsoleShell, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import { createConsoleApi } from '@/lib/console/api';
import { apiBaseUrl, devAuthEnabled } from '@/lib/console/config';
import { ROUTES, landingAfterSignIn } from '@/lib/console/routing';
import { useMessages } from '@/lib/i18n/locale-context';

/**
 * console/sign-in — F-CONSOLE-001 §3.2 · F-AUTH-002 §3.1. Clerk's widget when the
 * build carries a publishable key (hash routing: no server, no catch-all route);
 * the dev form only on builds without one.
 */
export default function SignInPage(): JSX.Element {
  const router = useRouter();
  const auth = useConsoleAuth();
  const c = useMessages().console;
  const [accountId, setAccountId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // A key, not text: worded at render time, so it follows the header language select.
  const [message, setMessage] = useState<'cantReach' | null>(null);
  const devAuth = devAuthEnabled();
  const endpoint = apiBaseUrl();

  useEffect(() => {
    if (auth.ready && auth.session) router.replace(ROUTES.home);
  }, [auth.ready, auth.session, router]);

  const submitDev = async (): Promise<void> => {
    const id = accountId.trim();
    const name = displayName.trim();
    if (!id || !name || !endpoint) return;
    setBusy(true);
    setMessage(null);
    const api = createConsoleApi({ endpoint, token: id });
    const spaces = await api.listSpaces();
    setBusy(false);
    if (!spaces.ok) {
      setMessage('cantReach');
      return;
    }
    auth.devSignIn({ token: id, accountId: id, displayName: name, email: email.trim() || undefined });
    router.replace(landingAfterSignIn(spaces.data.length));
  };

  return (
    <ConsoleShell>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.sm}px` }}>{c.signIn.title}</h1>
        <ul style={{ color: colors.text.secondary, paddingLeft: spacing.lg, lineHeight: typography.leading.relaxed }}>
          {c.whySignIn.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <section style={{ ...panelStyle, marginTop: spacing.lg }} aria-label={c.signIn.panelLabel}>
          {!endpoint ? (
            <Muted>{c.shell.noApi}</Muted>
          ) : auth.mode === 'clerk' ? (
            <>
              <Muted>{c.clerkIntro}</Muted>
              <SignIn routing="hash" fallbackRedirectUrl={ROUTES.home} signUpFallbackRedirectUrl={ROUTES.start} />
            </>
          ) : devAuth ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitDev();
              }}
            >
              <Notice tone="nudge">{c.devSignInHint}</Notice>
              <Field name="accountId" label={c.signIn.accountId.label} value={accountId} onChange={setAccountId} placeholder={c.signIn.accountId.placeholder} required maxLength={64} />
              <Field name="displayName" label={c.signIn.displayName.label} value={displayName} onChange={setDisplayName} placeholder={c.signIn.displayName.placeholder} required maxLength={40} />
              <Field name="email" label={c.signIn.email.label} value={email} onChange={setEmail} type="email" placeholder={c.signIn.email.placeholder} />
              <Button type="submit" tone="primary" disabled={busy || !accountId.trim() || !displayName.trim()} testId="sign-in">
                {busy ? c.signIn.submitting.cta : c.signIn.submit.cta}
              </Button>
              {message ? <Muted>{c[message]}</Muted> : null}
            </form>
          ) : (
            <>
              <p style={{ margin: 0 }}>{c.clerkPending}</p>
              <Muted>
                <Link href="/">{c.signIn.backToSite}</Link>
              </Muted>
            </>
          )}
        </section>
        <Muted>{c.kidsNoAccount}</Muted>
      </div>
    </ConsoleShell>
  );
}
