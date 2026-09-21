'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, ConsoleShell, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import { createConsoleApi } from '@/lib/console/api';
import { apiBaseUrl, devAuthEnabled } from '@/lib/console/config';
import { COPY } from '@/lib/console/copy';
import { landingAfterSignIn } from '@/lib/console/routing';
import { readSession, writeSession } from '@/lib/console/session';

/** console/sign-in — F-CONSOLE-001 §3.2. Dev form until the Clerk widget (F-AUTH-002). */
export default function SignInPage(): JSX.Element {
  const router = useRouter();
  const [accountId, setAccountId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const devAuth = devAuthEnabled();
  const endpoint = apiBaseUrl();

  useEffect(() => {
    const existing = readSession();
    if (existing) router.replace('/teach/home');
  }, [router]);

  const submit = async (): Promise<void> => {
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
    writeSession({ token: id, accountId: id, displayName: name, email: email.trim() || undefined });
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
          ) : devAuth ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
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
