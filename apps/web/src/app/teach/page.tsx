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
import { COPY } from '@/lib/console/copy';
import { ROUTES, landingAfterSignIn } from '@/lib/console/routing';

/**
 * console/sign-in — F-CONSOLE-001 §3.2 · F-AUTH-002 §3.1. Clerk's widget when the
 * build carries a publishable key (hash routing: no server, no catch-all route);
 * the dev form only on builds without one.
 */
export default function SignInPage(): JSX.Element {
  const router = useRouter();
  const auth = useConsoleAuth();
  const [accountId, setAccountId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
      setMessage(COPY.cantReach);
      return;
    }
    auth.devSignIn({ token: id, accountId: id, displayName: name, email: email.trim() || undefined });
    router.replace(landingAfterSignIn(spaces.data.length));
  };

  return (
    <ConsoleShell>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.sm}px` }}>Grown-ups sign in</h1>
        <ul style={{ color: colors.text.secondary, paddingLeft: spacing.lg, lineHeight: typography.leading.relaxed }}>
          {COPY.whySignIn.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <section style={{ ...panelStyle, marginTop: spacing.lg }} aria-label="Sign in">
          {!endpoint ? (
            <Muted>The console needs an API address (NEXT_PUBLIC_API_BASE_URL) on this build.</Muted>
          ) : auth.mode === 'clerk' ? (
            <>
              <Muted>{COPY.clerkIntro}</Muted>
              <SignIn routing="hash" fallbackRedirectUrl={ROUTES.home} signUpFallbackRedirectUrl={ROUTES.start} />
            </>
          ) : devAuth ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitDev();
              }}
            >
              <Notice tone="nudge">{COPY.devSignInHint}</Notice>
              <Field name="accountId" label="Account id" value={accountId} onChange={setAccountId} placeholder="teacher-kim" required maxLength={64} />
              <Field name="displayName" label="Your name" value={displayName} onChange={setDisplayName} placeholder="Ms Kim" required maxLength={40} />
              <Field name="email" label="Email (optional)" value={email} onChange={setEmail} type="email" placeholder="kim@example.com" />
              <Button type="submit" tone="primary" disabled={busy || !accountId.trim() || !displayName.trim()} testId="sign-in">
                {busy ? 'Signing in…' : 'Continue'}
              </Button>
              {message ? <Muted>{message}</Muted> : null}
            </form>
          ) : (
            <>
              <p style={{ margin: 0 }}>{COPY.clerkPending}</p>
              <Muted>
                <Link href="/">Back to Hangul Route</Link>
              </Muted>
            </>
          )}
        </section>
        <Muted>{COPY.kidsNoAccount}</Muted>
      </div>
    </ConsoleShell>
  );
}
