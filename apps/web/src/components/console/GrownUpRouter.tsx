'use client';

import type { AdultPersona } from '@hangul-route/content-schema';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DeviceGateRead } from '@/lib/console/grown-up-lock';
import { learnerHome } from '@/lib/console/grown-up-lock';
import { createConsoleApi } from '@/lib/console/api';
import { apiBaseUrl } from '@/lib/console/config';
import { readDeviceGate } from '@/lib/console/device-marker';
import { readLastPersona } from '@/lib/console/shell-store';
import { finishReverify, grantSignInUnlock, resolveDestination, settleSignIn, type RouteIo, type SignInIo } from '@/lib/console/signin-flow';
import { clearSignInRecord, readSignInRecord } from '@/lib/console/signin-record';
import { clearGrownUpTab } from '@/lib/console/unlock';
import { useMessages } from '@/lib/i18n/locale-context';
import { useConsoleAuth } from './auth-context';
import { ReverifyPanel, RetryPanel, RouterPanel } from './SignInParts';

/**
 * The router into the grown-up area (F-APP-001 A-4b, sections 3.5, 3.7, 3.9): `/signin` for a
 * signed-in visitor and the `/teach` router page. It spends the sign-in record of this tab (the
 * unlock after a secret-proving sign-in; reverification first after an OAuth one on a device the
 * lock can close), reads `GET /api/spaces` and the last persona, then makes one
 * `location.replace` to `next` or the persona home. "Taking you to your home…" is announced in a
 * polite live region with a visible Go now link; a failed spaces fetch shows one line and Try
 * again, never a wrong home.
 */

/** The browser side of the router, injectable for tests. */
export interface RouterEnvironment extends SignInIo {
  replace: (url: string) => void;
  assign: (url: string) => void;
  origin: () => string;
  clearGrownUpTab: () => void;
  readLastPersona: RouteIo['readLastPersona'];
}

export function browserRouterEnvironment(): RouterEnvironment {
  return {
    now: () => Date.now(),
    readRecord: () => readSignInRecord(),
    clearRecord: () => clearSignInRecord(),
    readDevice: () => readDeviceGate(),
    grant: (device, now) => grantSignInUnlock(device, now),
    readLastPersona: () => readLastPersona(),
    replace: (url) => window.location.replace(url),
    assign: (url) => window.location.assign(url),
    origin: () => window.location.origin,
    clearGrownUpTab: () => clearGrownUpTab(),
  };
}

type Phase = { at: 'settle' } | { at: 'reverify'; device: DeviceGateRead } | { at: 'route' } | { at: 'going'; href: string } | { at: 'error' };

/** Renders Clerk's reverification and reports whether it succeeded (`ClerkReverify`); absent outside Clerk mode. */
export type ReverifySlot = (props: { onDone: (verified: boolean) => void }) => ReactNode;

export interface GrownUpRouterProps {
  /** `?next=` as read (already decoded); `acceptedNext` decides whether it is followed. */
  next: string | null;
  hint: AdultPersona | null;
  /** Clerk mode passes its reverification; without it a reverification counts as cancelled (the lock then decides). */
  reverify?: ReverifySlot;
  environment?: RouterEnvironment;
}

export function GrownUpRouter({ next, hint, reverify, environment }: GrownUpRouterProps): JSX.Element {
  const auth = useConsoleAuth();
  const m = useMessages();
  const s = m.console.signIn;
  const envRef = useRef<RouterEnvironment | null>(environment ?? null);
  const env = (envRef.current ??= browserRouterEnvironment());
  const [phase, setPhase] = useState<Phase>({ at: 'settle' });
  const [attempt, setAttempt] = useState(0);
  const { sessionId, getToken } = auth;
  const api = useMemo(() => {
    const endpoint = apiBaseUrl();
    return endpoint ? createConsoleApi({ endpoint, token: getToken }) : null;
  }, [getToken]);

  // Step 1: the sign-in record of this tab (once per mount).
  useEffect(() => {
    if (phase.at !== 'settle') return undefined;
    let live = true;
    void settleSignIn(env, sessionId).then((result) => {
      if (live) setPhase(result ? { at: 'reverify', device: result.reverify } : { at: 'route' });
    });
    return () => {
      live = false;
    };
  }, [phase.at, env, sessionId]);

  // Step 2: spaces, last persona, one location.replace (again on Try again).
  useEffect(() => {
    if (phase.at !== 'route') return undefined;
    let live = true;
    const io: RouteIo = {
      listSpaces: async () => {
        if (!api) return { ok: false };
        const result = await api.listSpaces();
        return result.ok ? { ok: true, data: result.data } : { ok: false };
      },
      readLastPersona: env.readLastPersona,
    };
    void resolveDestination(io, { next, hint }).then((href) => {
      if (!live) return;
      if (!href) {
        setPhase({ at: 'error' });
        return;
      }
      setPhase({ at: 'going', href });
      env.replace(href);
    });
    return () => {
      live = false;
    };
  }, [phase.at, attempt, api, env, next, hint]);

  if (phase.at === 'reverify') {
    const device = phase.device;
    const done = (verified: boolean): void => {
      void finishReverify(env, device, verified).then(() => setPhase({ at: 'route' }));
    };
    return (
      <ReverifyPanel
        title={s.reverify.title}
        line={s.reverify.line}
        backLabel={m.console.lock.backToLearning.cta}
        onBack={() => {
          env.clearGrownUpTab();
          env.assign(learnerHome(env.origin()));
        }}
      >
        {reverify ? reverify({ onDone: done }) : <CancelNow onDone={done} />}
      </ReverifyPanel>
    );
  }
  if (phase.at === 'error') {
    return (
      <RetryPanel
        line={m.console.cantReach}
        retryLabel={m.console.tryAgain}
        testId="signin-router-error"
        onRetry={() => {
          setAttempt((n) => n + 1);
          setPhase({ at: 'route' });
        }}
      />
    );
  }
  return <RouterPanel line={m.a11y.shell.redirecting} goNowLabel={s.router.goNow} href={phase.at === 'going' ? phase.href : null} />;
}

/** Outside Clerk mode no reverification exists: it ends at once as cancelled, so the lock decides. */
function CancelNow({ onDone }: { onDone: (verified: boolean) => void }): null {
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    onDone(false);
  }, [onDone]);
  return null;
}
