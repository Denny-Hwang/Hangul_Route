'use client';

import { GROWN_UP_FRESH_PIN_MS, type GrownUpUnlock, type PinOwner } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { readDeviceGate } from '@/lib/console/device-marker';
import type { DeviceGateRead } from '@/lib/console/grown-up-lock';
import { PIN_PROMPT_TARGET, pinOwnerFingerprint, pinOwnerOffer, pinOwnerRecord, pinPromptShown, realPinEpoch } from '@/lib/console/one-account';
import { rem } from '@/lib/console/rem';
import { readPinOwner, readPinPromptSeen, writePinOwner, writePinPromptSeen } from '@/lib/console/shell-store';
import { withTimeout } from '@/lib/console/signin-flow';
import { readUnlock } from '@/lib/console/unlock';
import { useMessages } from '@/lib/i18n/locale-context';
import type { SecretReverify } from './auth-context';

/**
 * [OA] The two persona-home cards of AMENDMENTS-ONE-ACCOUNT-MANY-USERS (row OA-3; design/screens/profiles/console-pin.md
 * boards 9 to 12, decisions D13 and D14; wireframe design/wireframes/profiles/console-pin.md Panels C and D). The adult
 * frame renders this above the page on the Family and Teacher homes only. The two never show together (`nopin`
 * against `pin`).
 *
 * - **Set a grown-up PIN** (section 7.6): on a `nopin` browser, the first persona home after a sign-in, once per
 *   browser. It is marked seen (`pinPromptSeen`) when it first renders, so it has no dismiss button; **Open the app**
 *   goes to `/?gate=grown-up`, which runs PIN setup.
 * - **Let this account reset the PIN here** (section 7.2 moment 3): only while the tab's `pin` unlock is under 2
 *   minutes old for the marker's real epoch and this account is not the owner of that epoch. Clerk reverification with
 *   a password or a code (`reverifySecret`); success writes `pinOwner` and shows the done status until the page is left.
 *   A cancel returns to the offer; a refusal shows the calm "Can't confirm right now" line of the step-up dialog.
 *
 * No name, no email, no account and no number is shown; nothing is sent anywhere.
 */

/** Everything the cards read and write in the browser, injectable for tests. */
export interface PinCardsEnvironment {
  now: () => number;
  readDevice: () => Promise<DeviceGateRead>;
  readUnlock: () => GrownUpUnlock | null;
  readPinOwner: () => Promise<PinOwner | null>;
  fingerprint: (accountId: string) => Promise<string | null>;
  readPromptSeen: () => Promise<boolean | null>;
  markPromptSeen: () => void;
  writePinOwner: (record: PinOwner) => Promise<boolean>;
  assign: (url: string) => void;
  setTimer: (run: () => void, ms: number) => () => void;
}

/** How long a card's reads may take before the home renders without it. */
export const PIN_CARDS_READ_MS = 3_000;

const FAILED: DeviceGateRead = { readable: false, reason: 'failed' };

export function browserPinCardsEnvironment(): PinCardsEnvironment {
  return {
    now: () => Date.now(),
    readDevice: () => withTimeout(() => readDeviceGate(), FAILED, PIN_CARDS_READ_MS),
    readUnlock: () => readUnlock(),
    readPinOwner: () => withTimeout(() => readPinOwner(), null, PIN_CARDS_READ_MS),
    fingerprint: (accountId) => pinOwnerFingerprint(accountId),
    readPromptSeen: () => withTimeout(() => readPinPromptSeen(), null, PIN_CARDS_READ_MS),
    markPromptSeen: () => {
      void writePinPromptSeen();
    },
    writePinOwner: (record) => writePinOwner(record),
    assign: (url) => window.location.assign(url),
    setTimer: (run, ms) => {
      const timer = setTimeout(run, ms);
      return () => clearTimeout(timer);
    },
  };
}

type Card = { kind: 'none' } | { kind: 'prompt' } | { kind: 'offer'; epoch: number; busy: boolean; line: 'unavailable' | null } | { kind: 'done' };

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: spacing.md,
  margin: `0 0 ${spacing.lg}px`,
  padding: `${spacing.lg}px`,
  backgroundColor: colors.surface.paper,
  borderRadius: radii.lg,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  overflowWrap: 'anywhere',
};

const lineStyle: CSSProperties = { margin: 0, fontSize: rem(typography.size.body), lineHeight: typography.leading.relaxed, color: colors.text.primary };

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: touchTarget.min,
  maxWidth: '100%',
  boxSizing: 'border-box',
  padding: `${spacing.sm}px ${spacing.xl}px`,
  borderRadius: radii.pill,
  border: `${borderWidth.thin}px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  fontSize: rem(typography.size.body),
  fontWeight: typography.weight.bold,
  lineHeight: typography.leading.tight,
  textAlign: 'center',
  cursor: 'pointer',
};

function CardButton({ onClick, busy, testId, children }: { onClick: () => void; busy?: boolean; testId: string; children: ReactNode }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      data-testid={testId}
      // Board 11: while Clerk asks, the button sits back on the sunken surface (no new colour).
      style={{ ...buttonStyle, maxWidth: layout.pane.master, ...(busy ? { backgroundColor: colors.surface.sunken, borderColor: colors.border.subtle, color: colors.text.secondary, cursor: 'progress' } : {}) }}
    >
      {children}
    </button>
  );
}

export interface PinCardsProps {
  /** The signed-in account; without one neither card shows. */
  accountId: string | null;
  /** Moment 3's reverification (`useConsoleAuth().reverifySecret`). */
  reverifySecret: () => Promise<SecretReverify>;
  env?: PinCardsEnvironment;
}

export function PinCards({ accountId, reverifySecret, env }: PinCardsProps): JSX.Element | null {
  const m = useMessages().console;
  const [browser] = useState<PinCardsEnvironment>(() => env ?? browserPinCardsEnvironment());
  const [card, setCard] = useState<Card>({ kind: 'none' });
  const ownerRef = useRef<string | null>(null);
  const expiryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!accountId) return undefined;
    let live = true;
    void (async () => {
      const [device, seen, stored, owner] = await Promise.all([browser.readDevice(), browser.readPromptSeen(), browser.readPinOwner(), browser.fingerprint(accountId)]);
      if (!live) return;
      ownerRef.current = owner;
      if (pinPromptShown(device, seen)) {
        // Marked seen as it first renders (design D14), so it never shows twice in this browser.
        browser.markPromptSeen();
        setCard({ kind: 'prompt' });
        return;
      }
      const now = browser.now();
      const unlock = browser.readUnlock();
      const epoch = pinOwnerOffer({ unlock, device, stored, owner, now });
      if (epoch === null || !unlock) return;
      setCard({ kind: 'offer', epoch, busy: false, line: null });
      // Gone by itself once the PIN hand-off is 2 minutes old (no dismiss button, design D13).
      expiryRef.current = browser.setTimer(
        () => setCard((current) => (current.kind === 'offer' && !current.busy ? { kind: 'none' } : current)),
        Math.max(0, unlock.at + GROWN_UP_FRESH_PIN_MS - now),
      );
    })();
    return () => {
      live = false;
      expiryRef.current?.();
      expiryRef.current = null;
    };
  }, [accountId, browser]);

  const confirm = (epoch: number): void => {
    if (card.kind !== 'offer' || card.busy) return;
    setCard({ kind: 'offer', epoch, busy: true, line: null });
    void (async () => {
      let outcome: SecretReverify;
      try {
        outcome = await reverifySecret();
      } catch {
        outcome = 'unavailable';
      }
      if (outcome === 'cancelled') {
        setCard({ kind: 'offer', epoch, busy: false, line: null });
        return;
      }
      if (outcome !== 'done') {
        setCard({ kind: 'offer', epoch, busy: false, line: 'unavailable' });
        return;
      }
      // Written as in moment 1: the marker must still be `pin` at the epoch the fresh PIN was for.
      const device = await browser.readDevice();
      const record = realPinEpoch(device) === epoch ? pinOwnerRecord(ownerRef.current, epoch) : null;
      const written = record ? await browser.writePinOwner(record) : false;
      setCard(written ? { kind: 'done' } : { kind: 'offer', epoch, busy: false, line: 'unavailable' });
    })();
  };

  if (card.kind === 'none') return null;
  if (card.kind === 'prompt') {
    return (
      <section style={cardStyle} data-testid="pin-prompt-card">
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}>
          <span aria-hidden="true" style={{ flex: 'none', display: 'inline-flex', marginTop: spacing.xxs }}>
            <IconSvg name="lock" size={spacing.xl} color={colors.text.secondary} />
          </span>
          <p style={{ ...lineStyle, fontWeight: typography.weight.bold }}>{m.pinPrompt.body}</p>
        </span>
        <CardButton onClick={() => browser.assign(PIN_PROMPT_TARGET)} testId="pin-prompt-open">
          {m.pinPrompt.cta}
        </CardButton>
      </section>
    );
  }
  if (card.kind === 'done') {
    // Board 12: the done status inside the same card, until the page is left.
    return (
      <section style={cardStyle}>
        <p
          role="status"
          data-testid="pin-owner-done"
          style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm, alignSelf: 'stretch', margin: 0, padding: `${spacing.md}px ${spacing.lg}px`, borderRadius: radii.md, backgroundColor: colors.feedback.successLight, color: colors.text.primary, fontSize: rem(typography.size.body), overflowWrap: 'anywhere' }}
        >
          <span aria-hidden="true" style={{ flex: 'none', display: 'inline-flex', marginTop: spacing.xxs }}>
            <IconSvg name="check" size={spacing.lg + spacing.xs} color={colors.feedback.successDark} />
          </span>
          <span>{m.pinOwner.done}</span>
        </p>
      </section>
    );
  }
  const offer = card;
  return (
    <section style={cardStyle} data-testid="pin-owner-card">
      <p style={lineStyle}>{m.pinOwner.hint}</p>
      <CardButton onClick={() => confirm(offer.epoch)} busy={offer.busy} testId="pin-owner-cta">
        {m.pinOwner.cta}
      </CardButton>
      {offer.line ? (
        <p role="status" data-testid="pin-owner-line" style={{ ...lineStyle, color: colors.text.secondary }}>
          {m.billing.stepUp.unavailable}
        </p>
      ) : null}
    </section>
  );
}
