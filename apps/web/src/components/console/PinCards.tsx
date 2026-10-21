'use client';

import { GROWN_UP_FRESH_PIN_MS, type GrownUpUnlock, type PinOwner } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { readDeviceGate } from '@/lib/console/device-marker';
import type { DeviceGateRead } from '@/lib/console/grown-up-lock';
import { freshPinUnlock, pinOwnerFingerprint, pinOwnerOffer, pinOwnerRecord, pinPromptShown, pinPromptTarget, realPinEpoch } from '@/lib/console/one-account';
import { rem } from '@/lib/console/rem';
import { readPinOwner, readPinPromptSeen, writePinOwner, writePinPromptSeen } from '@/lib/console/shell-store';
import { withTimeout } from '@/lib/console/signin-flow';
import { clearGrownUpTab, readUnlock } from '@/lib/console/unlock';
import { useMessages } from '@/lib/i18n/locale-context';
import type { SecretReverify } from './auth-context';

/**
 * [OA] The two persona-home cards of AMENDMENTS-ONE-ACCOUNT-MANY-USERS (row OA-3; design/screens/profiles/console-pin.md
 * boards 9 to 12, decisions D13 and D14; wireframe design/wireframes/profiles/console-pin.md Panels C and D). The adult
 * frame renders this above the page on the Family and Teacher homes only. The two never show together (`nopin`
 * against `pin`).
 *
 * - **Set a grown-up PIN** (section 7.6): on a `nopin` browser, the first persona home after a sign-in, once per
 *   browser. It is marked seen (`pinPromptSeen`) once it has been in view in a visible tab, or when **Open the app** is
 *   pressed, never on a render nobody saw; it has no dismiss button. **Open the app** leaves the grown-up pages like
 *   the Learner app exit (`clearGrownUpTab()`, so Back never reopens them) and goes to the learner app's PIN gate with
 *   this home as `next` (`/?gate=grown-up&next=…`), which runs PIN setup on a `nopin` device.
 * - **Let this account reset the PIN here** (section 7.2 moment 3): only while the tab's `pin` unlock is under 2
 *   minutes old for the marker's real epoch and this account is not the owner of that epoch. It names the signed-in
 *   account (`adminInvite.signedInAs`, on screen only), so a grown-up handed off to the wrong account sees it. Clerk
 *   reverification with a password or a code (`reverifySecret`); the fresh PIN unlock is checked again when the button
 *   is pressed and when the reverification completes, and a lapsed one writes nothing and removes the card. Success
 *   writes `pinOwner` and shows the done status until the page is left. A cancel returns to the offer while the window
 *   lasts; a refusal shows the calm "Can't confirm right now" line of the step-up dialog. One status region stays
 *   mounted, so the done and refusal lines are announced.
 *
 * No id and no number is shown; nothing is sent anywhere.
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
  /** Open the app leaves the grown-up pages as the Learner app exit does. */
  clearGrownUpTab: () => void;
  origin: () => string;
  /** Calls `onSeen` once the element has been in view in a visible tab; returns the way to stop. */
  observeSeen: (element: Element, onSeen: () => void) => () => void;
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
    clearGrownUpTab: () => clearGrownUpTab(),
    origin: () => window.location.origin,
    observeSeen: observeSeenInView,
  };
}

/** In view (IntersectionObserver) while `document.visibilityState` is `visible`; without the observer, visible alone. */
export function observeSeenInView(element: Element, onSeen: () => void): () => void {
  let inView = typeof IntersectionObserver === 'undefined';
  let done = false;
  const visible = (): boolean => document.visibilityState === 'visible';
  const settle = (): void => {
    if (done || !inView || !visible()) return;
    stop();
    onSeen();
  };
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          inView = entries.some((entry) => entry.isIntersecting);
          settle();
        });
  const stop = (): void => {
    done = true;
    observer?.disconnect();
    document.removeEventListener('visibilitychange', settle);
  };
  observer?.observe(element);
  document.addEventListener('visibilitychange', settle);
  settle();
  return stop;
}

type Card = { kind: 'none' } | { kind: 'prompt' } | { kind: 'offer'; epoch: number; busy: boolean; line: 'unavailable' | null } | { kind: 'done' };

/** The offer and the done status share one card, so its status region stays mounted and announces the change. */
type OwnerCard = Extract<Card, { kind: 'offer' | 'done' }>;

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
  /** The account's own email (or display name), named on the PIN-owner card for the person signed in; never stored. */
  accountLabel?: string | null;
  /** This persona home (`/parent`, `/teach/...`), where the learner app returns after PIN setup. */
  home: string;
  /** Moment 3's reverification (`useConsoleAuth().reverifySecret`). */
  reverifySecret: () => Promise<SecretReverify>;
  env?: PinCardsEnvironment;
}

function SeenMarker({ target, observe, onSeen }: { target: RefObject<HTMLElement>; observe: PinCardsEnvironment['observeSeen']; onSeen: () => void }): null {
  const seenRef = useRef(onSeen);
  seenRef.current = onSeen;
  useEffect(() => {
    const element = target.current;
    if (!element) return undefined;
    return observe(element, () => seenRef.current());
  }, [target, observe]);
  return null;
}

export function PinCards({ accountId, accountLabel = null, home, reverifySecret, env }: PinCardsProps): JSX.Element | null {
  const m = useMessages().console;
  const [browser] = useState<PinCardsEnvironment>(() => env ?? browserPinCardsEnvironment());
  const [card, setCard] = useState<Card>({ kind: 'none' });
  const ownerRef = useRef<string | null>(null);
  const expiryRef = useRef<(() => void) | null>(null);
  const promptRef = useRef<HTMLElement>(null);
  const markedRef = useRef(false);
  /** The `pin` unlock the offer was made for (its `at`), or null once it has lapsed. */
  const unlockAtRef = useRef<number | null>(null);

  const markSeen = (): void => {
    if (markedRef.current) return;
    markedRef.current = true;
    browser.markPromptSeen();
  };
  /** The tab still holds the same fresh `pin` unlock for `epoch`. */
  const stillFresh = (epoch: number): boolean => {
    const unlock = browser.readUnlock();
    return !!unlock && unlock.at === unlockAtRef.current && freshPinUnlock(unlock, epoch, browser.now());
  };
  /** Removes the card once the PIN hand-off is 2 minutes old (no dismiss button, design D13), unless Clerk is asking. */
  const armExpiry = (at: number): void => {
    expiryRef.current?.();
    expiryRef.current = browser.setTimer(
      () => {
        unlockAtRef.current = null;
        setCard((current) => (current.kind === 'offer' && !current.busy ? { kind: 'none' } : current));
      },
      Math.max(0, at + GROWN_UP_FRESH_PIN_MS - browser.now()),
    );
  };
  /** Back to the offer after a cancel or a refusal while the window lasts; gone at once when it has lapsed. */
  const backToOffer = (epoch: number, line: 'unavailable' | null): void => {
    const at = unlockAtRef.current;
    if (at === null || !stillFresh(epoch)) {
      unlockAtRef.current = null;
      setCard({ kind: 'none' });
      return;
    }
    setCard({ kind: 'offer', epoch, busy: false, line });
    armExpiry(at);
  };

  useEffect(() => {
    if (!accountId) return undefined;
    let live = true;
    void (async () => {
      const [device, seen, stored, owner] = await Promise.all([browser.readDevice(), browser.readPromptSeen(), browser.readPinOwner(), browser.fingerprint(accountId)]);
      if (!live) return;
      ownerRef.current = owner;
      if (pinPromptShown(device, seen)) {
        // Marked seen once it has been in view in a visible tab (`SeenMarker`) or on Open the app (design D14).
        setCard({ kind: 'prompt' });
        return;
      }
      const now = browser.now();
      const unlock = browser.readUnlock();
      const epoch = pinOwnerOffer({ unlock, device, stored, owner, now });
      if (epoch === null || !unlock) return;
      unlockAtRef.current = unlock.at;
      setCard({ kind: 'offer', epoch, busy: false, line: null });
      armExpiry(unlock.at);
    })();
    return () => {
      live = false;
      expiryRef.current?.();
      expiryRef.current = null;
    };
  }, [accountId, browser]);

  const confirm = (epoch: number): void => {
    if (card.kind !== 'offer' || card.busy) return;
    // The window is checked again at the press: a card left up past it asks nothing and goes.
    if (!stillFresh(epoch)) {
      unlockAtRef.current = null;
      setCard({ kind: 'none' });
      return;
    }
    setCard({ kind: 'offer', epoch, busy: true, line: null });
    void (async () => {
      let outcome: SecretReverify;
      try {
        outcome = await reverifySecret();
      } catch {
        outcome = 'unavailable';
      }
      if (outcome === 'cancelled') {
        backToOffer(epoch, null);
        return;
      }
      if (outcome !== 'done') {
        backToOffer(epoch, 'unavailable');
        return;
      }
      // Section 7.2: the same `pin` unlock must still be under 2 minutes old when the reverification completes; a
      // lapsed one writes nothing and removes the card.
      if (!stillFresh(epoch)) {
        unlockAtRef.current = null;
        setCard({ kind: 'none' });
        return;
      }
      // Written as in moment 1: the marker must still be `pin` at the epoch the fresh PIN was for.
      const device = await browser.readDevice();
      const record = realPinEpoch(device) === epoch ? pinOwnerRecord(ownerRef.current, epoch) : null;
      const written = record ? await browser.writePinOwner(record) : false;
      if (written) {
        expiryRef.current?.();
        expiryRef.current = null;
        setCard({ kind: 'done' });
      } else backToOffer(epoch, 'unavailable');
    })();
  };

  const openApp = (): void => {
    markSeen();
    browser.clearGrownUpTab();
    browser.assign(pinPromptTarget(browser.origin(), home));
  };

  if (card.kind === 'none') return null;
  if (card.kind === 'prompt') {
    return (
      <section ref={promptRef} style={cardStyle} data-testid="pin-prompt-card">
        <SeenMarker target={promptRef} observe={browser.observeSeen} onSeen={markSeen} />
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}>
          <span aria-hidden="true" style={{ flex: 'none', display: 'inline-flex', marginTop: spacing.xxs }}>
            <IconSvg name="lock" size={spacing.xl} color={colors.text.secondary} />
          </span>
          <p style={{ ...lineStyle, fontWeight: typography.weight.bold }}>{m.pinPrompt.body}</p>
        </span>
        <CardButton onClick={openApp} testId="pin-prompt-open">
          {m.pinPrompt.cta}
        </CardButton>
      </section>
    );
  }
  return <OwnerCardView card={card} label={accountLabel} onConfirm={confirm} />;
}

const doneStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: spacing.sm,
  alignSelf: 'stretch',
  margin: 0,
  padding: `${spacing.md}px ${spacing.lg}px`,
  borderRadius: radii.md,
  backgroundColor: colors.feedback.successLight,
  color: colors.text.primary,
  fontSize: rem(typography.size.body),
  overflowWrap: 'anywhere',
};

/** Boards 9 to 12: the offer, busy while Clerk asks, then the done status inside the same card until the page is left. */
function OwnerCardView({ card, label, onConfirm }: { card: OwnerCard; label: string | null; onConfirm: (epoch: number) => void }): JSX.Element {
  const m = useMessages().console;
  const offer = card.kind === 'offer' ? card : null;
  return (
    <section style={cardStyle} data-testid="pin-owner-card" data-state={card.kind}>
      {offer && label ? (
        <p style={{ ...lineStyle, color: colors.text.secondary }} data-testid="pin-owner-account">
          {m.adminInvite.signedInAs(label)}
        </p>
      ) : null}
      {offer ? <p style={lineStyle}>{m.pinOwner.hint}</p> : null}
      {offer ? (
        <CardButton onClick={() => onConfirm(offer.epoch)} busy={offer.busy} testId="pin-owner-cta">
          {m.pinOwner.cta}
        </CardButton>
      ) : null}
      {/* One region, always mounted, so a screen reader announces the line that appears in it. */}
      <div role="status" data-testid="pin-owner-status" style={{ alignSelf: 'stretch' }}>
        {offer?.line ? (
          <p data-testid="pin-owner-line" style={{ ...lineStyle, color: colors.text.secondary }}>
            {m.billing.stepUp.unavailable}
          </p>
        ) : null}
        {card.kind === 'done' ? (
          <p data-testid="pin-owner-done" style={doneStyle}>
            <span aria-hidden="true" style={{ flex: 'none', display: 'inline-flex', marginTop: spacing.xxs }}>
              <IconSvg name="check" size={spacing.lg + spacing.xs} color={colors.feedback.successDark} />
            </span>
            <span>{m.pinOwner.done}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
