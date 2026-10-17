'use client';

import { APP_ROUTES, personaHint, type AdultPersona, type UiLocale } from '@hangul-route/content-schema';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ClerkReverify, ClerkWidget } from '@/components/console/ClerkSignIn';
import { GrownUpRouter } from '@/components/console/GrownUpRouter';
import { AdultStep, BelowWidget, InfoLine, QuietBack, SignInColumn, SignInHead, WidgetBox } from '@/components/console/SignInParts';
import { useConsoleAuth } from '@/components/console/auth-context';
import { Button, Field, Muted, Notice } from '@/components/console/ui';
import { createConsoleApi } from '@/lib/console/api';
import { apiBaseUrl, devAuthEnabled } from '@/lib/console/config';
import { learnerHome } from '@/lib/console/grown-up-lock';
import { createModeUrl, isStandaloneDisplay, showStandaloneFinish, signInReturnUrl } from '@/lib/console/signin-flow';
import { readAffirmation, readSignInRecord, writeAffirmation, writeSignInProof } from '@/lib/console/signin-record';
import { clearGrownUpTab } from '@/lib/console/unlock';
import { useLocale, useMessages } from '@/lib/i18n/locale-context';

/**
 * `/signin` — grown-up sign-in on the app host and the router into the grown-up area (F-APP-001
 * A-4b, section 3.7; wireframe design/wireframes/shell/signin.md; mock
 * design/screens/app-shell/signin.md, Panels A to D). Exempt from the lock, no adult frame.
 *
 * - Signed out: the persona intro (`?persona=`, or its alias `?as=`), Clerk's sign-in with no
 *   sign-up link, "New here? Create a grown-up account" (`?mode=create`), the learners line and
 *   I'm here to learn. Builds without Clerk keep the dev form (F-AUTH-001) or the "not set up" line.
 * - `?mode=create`: the adult step first (OD-13); Clerk's sign-up renders only after the tick.
 * - Signed in (or just signed in): the router (`GrownUpRouter`), which writes the unlock after a
 *   secret-proving sign-in, runs reverification after an OAuth one on a lockable device, and
 *   replaces the page with `?next=` or the persona home.
 */

/** The page's origin after mount (`''` in the static HTML), for `learnerHome()`. */
function useOrigin(): string {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

/** An installed PWA, read after mount (OD-15: email code first). */
function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => setStandalone(isStandaloneDisplay(window)), []);
  return standalone;
}

function backToLearning(origin: string, locale: UiLocale): void {
  clearGrownUpTab();
  window.location.assign(learnerHome(origin, locale));
}

/** The dev sign-in form (F-AUTH-001 fallback; never on a production build with Clerk, `devAuthEnabled`). */
function DevSignInForm(): JSX.Element {
  const auth = useConsoleAuth();
  const c = useMessages().console;
  const [accountId, setAccountId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // A key, not text: worded at render time, so it follows the language.
  const [message, setMessage] = useState<'cantReach' | null>(null);
  const endpoint = apiBaseUrl();

  const submit = async (): Promise<void> => {
    const id = accountId.trim();
    const name = displayName.trim();
    if (!id || !name || !endpoint) return;
    setBusy(true);
    setMessage(null);
    const spaces = await createConsoleApi({ endpoint, token: id }).listSpaces();
    setBusy(false);
    if (!spaces.ok) {
      setMessage('cantReach');
      return;
    }
    // The dev bearer stands in for a password: it counts as a secret-proving sign-in in this tab.
    writeSignInProof({ sessionId: id, secret: true }, Date.now());
    auth.devSignIn({ token: id, accountId: id, displayName: name, email: email.trim() || undefined });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
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
  );
}

/** The widget's place: Clerk, the dev form, or the "not set up on this build" line. */
function SignInWidget({ kind, params, hint, affirmedAt }: { kind: 'signIn' | 'signUp'; params: URLSearchParams; hint: AdultPersona | null; affirmedAt?: string }): JSX.Element {
  const auth = useConsoleAuth();
  const c = useMessages().console;
  const standalone = useStandalone();
  const [finishHere, setFinishHere] = useState(false);

  // "Finish signing in here with an email code": an installed PWA whose Google sign-in left the window (section 3.19).
  useEffect(() => {
    const check = (): void => setFinishHere(showStandaloneFinish({ standalone, signedIn: !!auth.session, record: readSignInRecord(), now: Date.now() }));
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [standalone, auth.session]);

  if (!apiBaseUrl()) {
    return (
      <WidgetBox>
        <Muted>{c.shell.noApi}</Muted>
      </WidgetBox>
    );
  }
  if (auth.mode === 'clerk') {
    return (
      <>
        {finishHere ? <InfoLine>{c.signIn.standaloneFinish}</InfoLine> : null}
        <ClerkWidget
          kind={kind}
          record={auth.ready && !auth.session}
          returnUrl={signInReturnUrl(params)}
          startUrl={hint ? `${APP_ROUTES.start}?persona=${hint}` : APP_ROUTES.start}
          standalone={standalone}
          affirmedAt={affirmedAt}
        />
      </>
    );
  }
  return <WidgetBox>{devAuthEnabled() ? <DevSignInForm /> : <p style={{ margin: 0 }}>{c.clerkPending}</p>}</WidgetBox>;
}

function SignInView({ params, hint }: { params: URLSearchParams; hint: AdultPersona | null }): JSX.Element {
  const m = useMessages();
  const s = m.console.signIn;
  const origin = useOrigin();
  const locale = useLocale();
  return (
    <SignInColumn>
      <QuietBack label={m.console.lock.backToLearning.cta} onClick={() => backToLearning(origin, locale)} testId="signin-back" />
      <SignInHead mark={m.landing.brand.mark} title={s.title} intro={hint ? s.persona[hint].intro : s.neutralIntro} />
      <SignInWidget kind="signIn" params={params} hint={hint} />
      <BelowWidget createHref={createModeUrl(params, true)} createLabel={s.create.link} learnersLine={s.learnersNoAccount} learnHref={learnerHome(origin, locale)} learnLabel={s.imLearning} />
    </SignInColumn>
  );
}

/**
 * `?mode=create`: the adult step, then Clerk's sign-up (behaviour 27: never before the tick). The
 * tick is kept for this tab (`hr:grownup:affirmed`), so a Google sign-up returning to
 * `#/sso-callback`, or a reload during the email code, comes back to `<SignUp>` and not to the
 * checkbox. Until the tab has been read, the widget's place stays empty.
 */
function CreateView({ params, hint }: { params: URLSearchParams; hint: AdultPersona | null }): JSX.Element {
  const router = useRouter();
  const m = useMessages();
  const s = m.console.signIn;
  const [ticked, setTicked] = useState(false);
  const [affirmedAt, setAffirmedAt] = useState<string | null>(null);
  const [read, setRead] = useState(false);
  useEffect(() => {
    setAffirmedAt(readAffirmation(Date.now()));
    setRead(true);
  }, []);
  const affirm = (): void => {
    const at = new Date().toISOString();
    writeAffirmation(at);
    setAffirmedAt(at);
  };
  return (
    <SignInColumn>
      <QuietBack label={s.create.back.cta} onClick={() => router.replace(createModeUrl(params, false))} testId="signin-create-back" />
      <SignInHead mark={m.landing.brand.mark} title={s.title} />
      {!read ? null : affirmedAt ? (
        <SignInWidget kind="signUp" params={params} hint={hint} affirmedAt={affirmedAt} />
      ) : (
        <AdultStep lead={s.create.lead} affirm={s.create.affirm} continueLabel={s.create.continue.cta} ticked={ticked} onTick={setTicked} onContinue={affirm} />
      )}
    </SignInColumn>
  );
}

function SignInInner(): JSX.Element {
  const params = useSearchParams() ?? new URLSearchParams();
  const auth = useConsoleAuth();
  const hint = personaHint(params);
  if (auth.ready && auth.session) {
    return (
      <SignInColumn>
        <GrownUpRouter next={params.get('next')} hint={hint} reverify={auth.mode === 'clerk' ? (props) => <ClerkReverify {...props} /> : undefined} />
      </SignInColumn>
    );
  }
  return params.get('mode') === 'create' ? <CreateView params={new URLSearchParams(params.toString())} hint={hint} /> : <SignInView params={new URLSearchParams(params.toString())} hint={hint} />;
}

export default function SignInPage(): JSX.Element {
  return (
    <Suspense fallback={<SignInColumn>{null}</SignInColumn>}>
      <SignInInner />
    </Suspense>
  );
}
