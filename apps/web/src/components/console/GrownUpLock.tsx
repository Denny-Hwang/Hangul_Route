'use client';

import type { GrownUpUnlock } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { readDeviceGate } from '@/lib/console/device-marker';
import { decideGrownUpLock, learnerHome, pinPathUrl, signInAgainUrl, type DeviceGateRead, type LockDecision } from '@/lib/console/grown-up-lock';
import { clearSession } from '@/lib/console/session';
import { readTrustedEpoch } from '@/lib/console/shell-store';
import { clearGrownUpTab, readUnlock, touchUnlock } from '@/lib/console/unlock';
import { useMessages } from '@/lib/i18n/locale-context';

/**
 * The grown-up lock (F-APP-001 section 3.9, OD-3; wireframe design/wireframes/shell/grown-up-lock.md).
 * Wraps every grown-up page except `/signin`. Before the decision it renders no page content,
 * so the page makes no API call; locked, it renders the lock screen and removes the console
 * session from this tab; open, it renders the page. A back/forward-cache restore or a return to
 * the tab hides the page synchronously and decides again; a new `path` (a client navigation)
 * decides again before the new page renders. The decision itself is `lib/console/grown-up-lock.ts`.
 */

/** Everything the lock touches in the browser, injectable for tests. */
export interface GrownUpLockEnvironment {
  now: () => number;
  readDevice: () => Promise<DeviceGateRead>;
  readTrustedEpoch: () => Promise<number | null>;
  readUnlock: () => GrownUpUnlock | null;
  touchUnlock: (now: number) => void;
  clearConsoleSession: () => void;
  clearGrownUpTab: () => void;
  origin: () => string;
  assign: (url: string) => void;
  window: EventTarget | null;
  document: (EventTarget & { visibilityState: DocumentVisibilityState }) | null;
}

export function browserLockEnvironment(): GrownUpLockEnvironment {
  const win = typeof window === 'undefined' ? null : window;
  const doc = typeof document === 'undefined' ? null : document;
  return {
    now: () => Date.now(),
    readDevice: () => readDeviceGate(),
    readTrustedEpoch: () => readTrustedEpoch(),
    readUnlock: () => readUnlock(),
    touchUnlock: (now) => {
      touchUnlock(now);
    },
    clearConsoleSession: () => clearSession(),
    clearGrownUpTab: () => clearGrownUpTab(),
    origin: () => win?.location.origin ?? '',
    assign: (url) => win?.location.assign(url),
    window: win,
    document: doc,
  };
}

/** A decision, the path it was made for, and whether the page is hidden while a re-check runs. */
export interface LockState {
  path: string;
  decision: LockDecision;
  hidden: boolean;
}

export interface GrownUpLockController {
  /** Listens for back/forward-cache restores and returns to the tab. */
  start: () => void;
  /** Reads and decides for the current path; only the latest check reports. */
  check: () => void;
  stop: () => void;
}

export function createGrownUpLockController(options: {
  env: GrownUpLockEnvironment;
  getPath: () => string;
  onState: (state: LockState) => void;
  /** Must hide the page before the next paint (the component flushes synchronously). */
  onHide: () => void;
}): GrownUpLockController {
  const { env, getPath, onState, onHide } = options;
  let latest = 0;
  let stopped = false;

  const run = async (): Promise<void> => {
    const id = ++latest;
    const path = getPath();
    const [device, trustedEpoch] = await Promise.all([env.readDevice(), env.readTrustedEpoch()]);
    if (stopped || id !== latest) return;
    const now = env.now();
    const decision = decideGrownUpLock({ device, unlock: env.readUnlock(), trustedEpoch, now });
    if (decision.state === 'locked') env.clearConsoleSession();
    else env.touchUnlock(now);
    onState({ path, decision, hidden: false });
  };

  const recheck = (): void => {
    onHide();
    void run();
  };
  const onPageShow = (event: Event): void => {
    if ((event as PageTransitionEvent).persisted) recheck();
  };
  // Hidden before the page enters the back/forward cache, so a restore never paints it.
  const onPageHide = (event: Event): void => {
    if ((event as PageTransitionEvent).persisted) onHide();
  };
  const onVisibility = (): void => {
    if (env.document?.visibilityState === 'visible') recheck();
  };

  return {
    start: () => {
      env.window?.addEventListener('pageshow', onPageShow);
      env.window?.addEventListener('pagehide', onPageHide);
      env.document?.addEventListener('visibilitychange', onVisibility);
    },
    check: () => {
      if (!stopped) void run();
    },
    stop: () => {
      stopped = true;
      env.window?.removeEventListener('pageshow', onPageShow);
      env.window?.removeEventListener('pagehide', onPageHide);
      env.document?.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

type LockedDecision = Extract<LockDecision, { state: 'locked' }>;

export type LockView = { kind: 'pending' } | { kind: 'open'; hidden: boolean } | { kind: 'locked'; decision: LockedDecision };

/** Pending until a decision exists for this very path; the lock screen shows no data, so it stays during a re-check. */
export function lockView(state: LockState | null, path: string): LockView {
  if (!state || state.path !== path) return { kind: 'pending' };
  if (state.decision.state === 'open') return { kind: 'open', hidden: state.hidden };
  return { kind: 'locked', decision: state.decision };
}

interface LockHandlers {
  onUsePin: () => void;
  onSignInAgain: () => void;
  onBackToLearning: () => void;
}

export function GrownUpLockGate({ view, children, ...handlers }: LockHandlers & { view: LockView; children: ReactNode }): JSX.Element {
  if (view.kind === 'pending') return <div aria-busy="true" data-testid="grown-up-lock-pending" />;
  if (view.kind === 'locked') return <GrownUpLockScreen decision={view.decision} {...handlers} />;
  // One wrapper in both states, so hiding during a re-check keeps the page mounted (a half-typed form survives).
  return (
    <div hidden={view.hidden || undefined} aria-hidden={view.hidden || undefined} style={view.hidden ? { display: 'none' } : undefined} data-testid="grown-up-content">
      {children}
    </div>
  );
}

export interface GrownUpLockProps {
  children: ReactNode;
  /** This page's path and query; a change (a client navigation) decides again. */
  path: string;
  /** `/signin` is exempt (section 3.7). */
  exempt?: boolean;
  /** Sign in again: sign out, then go to `signInUrl` (`/signin?next=…`). */
  onSignInAgain: (signInUrl: string) => void;
  environment?: GrownUpLockEnvironment;
}

export function GrownUpLock({ children, path, exempt = false, onSignInAgain, environment }: GrownUpLockProps): JSX.Element {
  const [state, setState] = useState<LockState | null>(null);
  const pathRef = useRef(path);
  const envRef = useRef<GrownUpLockEnvironment | null>(environment ?? null);
  const controllerRef = useRef<GrownUpLockController | null>(null);
  const envOf = (): GrownUpLockEnvironment => (envRef.current ??= browserLockEnvironment());

  useEffect(() => {
    if (exempt) return undefined;
    const controller = createGrownUpLockController({
      env: envOf(),
      getPath: () => pathRef.current,
      onState: setState,
      onHide: () => flushSync(() => setState((s) => (s ? { ...s, hidden: true } : s))),
    });
    controllerRef.current = controller;
    controller.start();
    return () => {
      controller.stop();
      controllerRef.current = null;
    };
    // The controller lives as long as the exemption does; envOf and the path are read through refs.
  }, [exempt]);

  useEffect(() => {
    pathRef.current = path;
    controllerRef.current?.check();
  }, [path, exempt]);

  if (exempt) return <>{children}</>;
  return (
    <GrownUpLockGate
      view={lockView(state, path)}
      onUsePin={() => envOf().assign(pinPathUrl(path))}
      onSignInAgain={() => onSignInAgain(signInAgainUrl(path))}
      onBackToLearning={() => {
        const env = envOf();
        env.clearGrownUpTab();
        env.assign(learnerHome(env.origin()));
      }}
    >
      {children}
    </GrownUpLockGate>
  );
}

const TITLE_ID = 'grown-up-lock-title';

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  boxSizing: 'border-box',
  padding: spacing.lg,
  backgroundColor: colors.surface.canvas,
  color: colors.text.primary,
};

const columnStyle: CSSProperties = { maxWidth: layout.maxWidth.reading, margin: '0 auto' };

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: spacing.md,
  marginTop: spacing.xl,
  padding: `${spacing.xxl}px ${spacing.lg}px`,
  textAlign: 'center',
  backgroundColor: colors.surface.paper,
  borderRadius: radii.lg,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
};

const buttonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.sm,
  minHeight: touchTarget.min,
  boxSizing: 'border-box',
  padding: `${spacing.sm}px ${spacing.xl}px`,
  borderRadius: radii.pill,
  fontSize: typography.size.body,
  fontWeight: typography.weight.bold,
  cursor: 'pointer',
};

const TONE: Readonly<Record<'primary' | 'secondary' | 'quiet', CSSProperties>> = {
  primary: { width: '100%', maxWidth: layout.pane.master, backgroundColor: colors.brand.primary, color: colors.text.onPrimary, border: `${borderWidth.thin}px solid ${colors.brand.primary}` },
  secondary: { width: '100%', maxWidth: layout.pane.master, backgroundColor: colors.surface.paper, color: colors.text.primary, border: `${borderWidth.thin}px solid ${colors.border.strong}` },
  quiet: { paddingLeft: spacing.sm, backgroundColor: 'transparent', color: colors.text.secondary, border: 'none' },
};

function LockButton({ tone, onClick, testId, children }: { tone: keyof typeof TONE; onClick: () => void; testId: string; children: ReactNode }): JSX.Element {
  return (
    <button type="button" onClick={onClick} style={{ ...buttonBase, ...TONE[tone] }} data-tone={tone} data-testid={testId}>
      {children}
    </button>
  );
}

/**
 * Panel A (PIN path available) and Panel B (sign-in only). No frame navigation, no name, no
 * number, no countdown; the same single column at every width. Focus moves to the heading.
 */
export function GrownUpLockScreen({ decision, onUsePin, onSignInAgain, onBackToLearning }: LockHandlers & { decision: LockedDecision }): JSX.Element {
  const lock = useMessages().console.lock;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const line = decision.line === 'default' ? lock.line : lock[decision.line];
  return (
    <main style={pageStyle}>
      <div style={columnStyle}>
        <LockButton tone="quiet" onClick={onBackToLearning} testId="grown-up-lock-back">
          <IconSvg name="arrow-left" size={spacing.xl} color={colors.text.secondary} />
          {lock.backToLearning.cta}
        </LockButton>
        <section role="region" aria-labelledby={TITLE_ID} data-testid="grown-up-lock" style={sectionStyle}>
          <IconSvg name="lock" size={spacing.xxxl} color={colors.text.secondary} />
          <h1 id={TITLE_ID} tabIndex={-1} ref={headingRef} style={{ margin: 0, fontSize: typography.size.title, fontWeight: typography.weight.bold, lineHeight: typography.leading.tight }}>
            {lock.title}
          </h1>
          <p style={{ margin: 0, marginBottom: spacing.sm, fontSize: typography.size.body, lineHeight: typography.leading.relaxed, color: colors.text.secondary }}>{line}</p>
          {decision.pinPath ? (
            <LockButton tone="primary" onClick={onUsePin} testId="grown-up-lock-pin">
              {lock.usePin.cta}
            </LockButton>
          ) : null}
          <LockButton tone={decision.pinPath ? 'secondary' : 'primary'} onClick={onSignInAgain} testId="grown-up-lock-signin">
            {lock.signInAgain.cta}
          </LockButton>
        </section>
      </div>
    </main>
  );
}
