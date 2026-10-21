'use client';

import type { GrownUpUnlock, PinOwner, PinResetTicket } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useRef, useState } from 'react';
import { pinResetSignInEnabled } from '@/lib/console/config';
import { readDeviceGate } from '@/lib/console/device-marker';
import { learnerHome, type DeviceGateRead } from '@/lib/console/grown-up-lock';
import { passkeyUsedSince, pinOwnerFingerprint } from '@/lib/console/one-account';
import { decidePinReset, freshResetSignIn, pinResetTarget, pinResetTicket, writePinResetTicket, type PinResetDecision, type PinResetLine } from '@/lib/console/pin-reset';
import { headRem, rem } from '@/lib/console/rem';
import { readPinOwner } from '@/lib/console/shell-store';
import { withTimeout } from '@/lib/console/signin-flow';
import { clearGrownUpTab, readUnlock } from '@/lib/console/unlock';
import { browserStorage } from '@/lib/i18n/safe-storage';
import { useLocale, useMessages } from '@/lib/i18n/locale-context';
import type { SecretReverify } from './auth-context';
import { LockButton, columnStyle, pageStyle, sectionStyle } from './GrownUpLock';

/**
 * [OA] `/account/pin-reset` (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 7.5 and 8.5 steps 2 to 4, row OA-6; design
 * `design/screens/profiles/console-pin.md` boards 4 to 8, wireframe `profiles/pin-entry-v2.md` Panels D and E). Inside
 * the grown-up layout, so behind the lock: the forgotten PIN leaves Sign in again, which is the point. No API call, no
 * frame: the lock's single paper card titled **New grown-up PIN** and one line.
 *
 * The decision is `lib/console/pin-reset.ts`. A sign-in older than 2 minutes runs Clerk reverification first (a
 * password or a code; a passkey refuses it, `reverifySecret`). A refusal shows its line and Back to learning and writes
 * nothing. Success writes the ticket (`hr:shell:pinReset`, a time and the marker epoch), clears the console session of
 * this tab and opens the learner app's `/?gate=pin-reset` in this tab, where a new PIN is chosen.
 */

/** Everything the page reads and writes in the browser, injectable for tests. */
export interface PinResetEnvironment {
  now: () => number;
  readDevice: () => Promise<DeviceGateRead>;
  readUnlock: () => GrownUpUnlock | null;
  readPinOwner: () => Promise<PinOwner | null>;
  fingerprint: (accountId: string) => Promise<string | null>;
  writeTicket: (ticket: PinResetTicket) => boolean;
  clearGrownUpTab: () => void;
  origin: () => string;
  assign: (url: string) => void;
}

/** How long a device or shell-store read may take before the page answers without it. */
export const PIN_RESET_READ_MS = 3_000;

const FAILED: DeviceGateRead = { readable: false, reason: 'failed' };

export function browserPinResetEnvironment(): PinResetEnvironment {
  return {
    now: () => Date.now(),
    readDevice: () => withTimeout(() => readDeviceGate(), FAILED, PIN_RESET_READ_MS),
    readUnlock: () => readUnlock(),
    readPinOwner: () => withTimeout(() => readPinOwner(), null, PIN_RESET_READ_MS),
    fingerprint: (accountId) => pinOwnerFingerprint(accountId),
    writeTicket: (ticket) => writePinResetTicket(ticket, browserStorage('session')),
    clearGrownUpTab: () => clearGrownUpTab(),
    origin: () => (typeof window === 'undefined' ? '' : window.location.origin),
    assign: (url) => window.location.assign(url),
  };
}

type View = { kind: 'checking' } | { kind: 'going' } | { kind: 'refused'; line: PinResetLine };

export interface PinResetViewProps {
  /** The signed-in account (fingerprinted, never shown or stored). */
  accountId: string;
  /** Clerk reverification with a password or a code (`useConsoleAuth().reverifySecret`). */
  reverifySecret: () => Promise<SecretReverify>;
  /** The account's passkeys as Clerk last read them (`lastUsedAt` only); null outside Clerk. */
  passkeys: readonly { lastUsedAt?: Date | null }[] | null;
  /** `NEXT_PUBLIC_PIN_RESET_SIGNIN`, read once by default. */
  flag?: boolean;
  env?: PinResetEnvironment;
}

const TITLE_ID = 'pin-reset-title';

export function PinResetView({ accountId, reverifySecret, passkeys, flag, env }: PinResetViewProps): JSX.Element {
  const m = useMessages().console;
  const locale = useLocale();
  const [browser] = useState<PinResetEnvironment>(() => env ?? browserPinResetEnvironment());
  const [on] = useState(() => flag ?? pinResetSignInEnabled());
  const [view, setView] = useState<View>(() => (on ? { kind: 'checking' } : { kind: 'refused', line: 'unavailable' }));
  const started = useRef(false);
  const mounted = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Read when the check runs: a new function or list from the auth bridge never starts it again.
  const latest = useRef({ accountId, reverifySecret, passkeys, locale });
  latest.current = { accountId, reverifySecret, passkeys, locale };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!on || started.current) return;
    started.current = true;
    const decide = async (reverified: boolean): Promise<PinResetDecision> => {
      const [device, stored, owner] = await Promise.all([browser.readDevice(), browser.readPinOwner(), browser.fingerprint(latest.current.accountId)]);
      const unlock = browser.readUnlock();
      // A passkey of the account used around this sign-in never counts on the reset leg, on any browser (CS-17).
      const passkeyUsed = unlock?.src === 'signin' && passkeyUsedSince(latest.current.passkeys ?? [], unlock.at, false);
      const signInFresh = reverified || freshResetSignIn({ unlock, now: browser.now(), passkeyUsed });
      return decidePinReset({ flag: on, signInFresh, device, stored, owner });
    };
    const finish = (decision: PinResetDecision): void => {
      if (!mounted.current) return;
      if (decision.kind !== 'go') {
        setView({ kind: 'refused', line: decision.kind === 'refused' ? decision.line : 'unavailable' });
        return;
      }
      const ticket = pinResetTicket(browser.now(), decision.epoch);
      if (!ticket || !browser.writeTicket(ticket)) {
        setView({ kind: 'refused', line: 'unavailable' });
        return;
      }
      setView({ kind: 'going' });
      browser.clearGrownUpTab();
      browser.assign(pinResetTarget(latest.current.locale));
    };
    void (async () => {
      try {
        const first = await decide(false);
        if (first.kind !== 'reverify') return finish(first);
        let outcome: SecretReverify;
        try {
          outcome = await latest.current.reverifySecret();
        } catch {
          outcome = 'unavailable';
        }
        // A cancel, a refusal (a passkey) or Clerk out of reach: nothing is written.
        if (outcome !== 'done') return finish({ kind: 'refused', line: 'unavailable' });
        finish(await decide(true));
      } catch {
        finish({ kind: 'refused', line: 'unavailable' });
      }
    })();
    // Runs once per mount: the decision reads the browser when the page opens, never again.
  }, [on, browser]);

  const backToLearning = (): void => {
    browser.clearGrownUpTab();
    browser.assign(learnerHome(browser.origin(), locale));
  };

  const r = m.pinReset;
  return (
    <main style={pageStyle}>
      <div style={{ ...columnStyle, marginTop: spacing.xl }}>
        <section role="region" aria-labelledby={TITLE_ID} aria-busy={view.kind === 'checking' || undefined} data-testid="pin-reset" style={sectionStyle}>
          <IconSvg name="lock" size={spacing.xxxl} color={colors.text.secondary} />
          <h1 id={TITLE_ID} tabIndex={-1} ref={headingRef} style={{ margin: 0, fontSize: headRem(typography.size.title), fontWeight: typography.weight.bold, lineHeight: typography.leading.tight, outline: 'none' }}>
            {r.title}
          </h1>
          {view.kind === 'going' ? (
            <p role="status" data-testid="pin-reset-line" data-line="going" style={lineStyle}>
              {r.going}
            </p>
          ) : null}
          {view.kind === 'refused' ? (
            <>
              <p role="status" data-testid="pin-reset-line" data-line={view.line} style={{ ...lineStyle, marginBottom: spacing.sm }}>
                {r[view.line]}
              </p>
              <LockButton tone="primary" onClick={backToLearning} testId="pin-reset-back">
                {m.lock.backToLearning.cta}
              </LockButton>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

const lineStyle = { margin: 0, fontSize: rem(typography.size.body), lineHeight: typography.leading.relaxed, color: colors.text.secondary } as const;
