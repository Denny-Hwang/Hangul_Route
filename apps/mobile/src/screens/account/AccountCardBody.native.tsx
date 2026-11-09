import { Body, Caption, Card, ConfirmSheet, Spacer, spacing } from '@hangul-route/design-system';
import type { GrownUpUse } from '@hangul-route/content-schema';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useRef, useState, type ReactElement } from 'react';
import { View } from 'react-native';
import { GrownUpRow } from '../../components/GrownUpRow';
import { useMessages } from '../../i18n/use-messages';
import { freshProof } from '../../logic/account/account-lock';
import { accountCardView, cardUses, type AccountCardView } from '../../logic/account/account-card';
import type { NativeGateState } from '../../logic/account/gate-state';
import { accountQueryKey } from '../../logic/account/queries';
import { trustOfRead, usesOfSpaces, type TrustRead } from '../../logic/account/sign-in-records';
import { readTrust, readUsesRecord } from '../../platform/account-records';
import type { GrownUpStackParamList } from '../../navigation/types';
import { useAccountVisit } from '../../store/account-visit';
import { nativeGateState } from '../../store/native-gate-state';
import { useUiStore } from '../../store/ui-store';
import { AccountButton } from './AccountButton';
import { AccountHostContext } from './account-host';
import { useAccountOnline, useAccountSignOut, useDecisionMoments } from './account-session.native';

/**
 * F-AUTH-004 sections 6.6, 7.1 and 7.2, design D7 and D8 (`design/screens/account/lock.md` boards 8 to 15; rows NS-3,
 * NS-4; CS-N2, CS-N9, CS-N11, CS-N13): the Grown-up area's account card on iOS and Android, after Switch user and
 * before People on this device. It draws nothing while the native account is off (CS-N13) and on a `nopin` device.
 *
 * - Signed out: `card.signedOut` and **Sign in** (offline: waiting, with Needs the internet as its reason).
 * - Signed in and past the gate: the email line only with a fresh proof as well (a PIN typed, or a native sign-in,
 *   within 2 minutes: never after face or fingerprint alone, CS-N9), one row per known use (`cardUses`: the uses
 *   record on a `pin` device, this visit's spaces elsewhere; disabled offline with Needs the internet), the
 *   shared-device line and **Sign out** (enabled offline, section 6.6).
 * - Locked by the gate (7.2, 7.3): the lock's line and its button (**Sign in again**), no email. Gate `unknown`, or no
 *   Clerk for this visit: `lock.cantCheck` and **Try again**.
 * - The card decides on mount, on every focus and on every return to `active`, as AccountGate does (no timer).
 * - Row NS-4: **Sign in**, a use row and **Sign in again** open their account screen (`SignIn`, `AccountHome { use }`,
 *   `SignIn { again }`), whose `AccountGate` asks the typed PIN first on a `pin` device without a fresh proof (no face
 *   or fingerprint, CS-N11) and, for Sign in again, signs out on this device only after it. Sign out asks no PIN (it
 *   only deletes) and confirms in a ConfirmSheet with no danger colour (D8). */

export type CardNavigation = NativeStackNavigationProp<GrownUpStackParamList, 'ParentDashboard'>;

export interface ClerkSide {
  /** `pending`, `off`, or the provider is mounted and Clerk is still loading / loaded. */
  clerk: 'pending' | 'off' | 'loading' | 'ready';
  signedIn: boolean;
  email: string | null;
}

interface Decided {
  gate: NativeGateState | null;
  trust: TrustRead;
  /** The fresh proof as it stood when the card last decided (D7: no timer). */
  fresh: boolean;
  /** The use rows (`cardUses`), as read when the card last decided. */
  uses: GrownUpUse[];
}

/** The card itself, with what Clerk says (nothing while its provider is not mounted). Imports nothing of Clerk's. */
export function AccountCardBody({ navigation, side }: { navigation: CardNavigation; side: ClerkSide }): ReactElement | null {
  const messages = useMessages();
  const m = messages.caregiver.account;
  const host = useContext(AccountHostContext);
  const online = useAccountOnline();
  const signOut = useAccountSignOut();
  const queryClient = useQueryClient();
  const visit = useAccountVisit();
  const [decided, setDecided] = useState<Decided>({ gate: null, trust: { kind: 'none' }, fresh: false, uses: [] });
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);

  // Decisions answer out of order at times (two focus events close together): only the latest one is drawn.
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const decide = useCallback(() => {
    generation.current += 1;
    const mine = generation.current;
    void Promise.all([nativeGateState(), readTrust(), readUsesRecord()]).then(([gate, trust, record]) => {
      if (!mounted.current || mine !== generation.current) return;
      const fresh = freshProof(Date.now(), useUiStore.getState().lastPinTypedAt, useAccountVisit.getState().lastAccountSignInAt);
      // This visit's spaces (in memory only, ND-10), the rows of a device that keeps no record (ND-9).
      const memory = usesOfSpaces(queryClient.getQueryData(accountQueryKey('spaces')) ?? null);
      setDecided({ gate, trust, fresh, uses: cardUses(gate, record, memory) });
    });
  }, [queryClient]);
  useDecisionMoments(navigation, decide);

  const view: AccountCardView = accountCardView({
    gate: decided.gate,
    clerk: side.clerk,
    online,
    signedIn: side.signedIn,
    signedInThisVisit: visit.signedInThisVisit,
    trust: trustOfRead(decided.trust),
    retrustPending: visit.retrustPending,
    fresh: decided.fresh,
  });
  if (view.kind === 'hidden') return null;

  const confirmSignOut = async (): Promise<void> => {
    setAsking(false);
    setWorking(true);
    try {
      await signOut('user');
    } finally {
      setWorking(false);
    }
    decide();
  };

  const needsInternet = messages.learner.welcome.grownUps.needsInternet;
  const lockLine = (cause: Extract<AccountCardView, { kind: 'locked' }>['cause']): string => {
    if (cause === 'no_trust') return messages.console.lock.firstSignIn;
    if (cause === 'pin_changed') return messages.console.lock.pinChanged;
    if (cause === 'retrust_password') return m.lock.retrustPassword;
    return messages.console.lock.pinRenew;
  };

  return (
    <>
      <Card padding="md" testID="account-card">
        <Body size="lg" weight="bold">
          {m.card.title}
        </Body>
        <Spacer size="sm" />
        {view.kind === 'cant_check' ? (
          <>
            <Body>{m.lock.cantCheck}</Body>
            <Spacer size="md" />
            <AccountButton
              label={messages.common.buttons.tryAgain}
              tone="paper"
              onPress={() => {
                if (side.clerk === 'off') host.retry();
                else decide();
              }}
              testID="account-card-try-again"
            />
          </>
        ) : null}
        {view.kind === 'signed_out' ? (
          <>
            <Body tone="secondary">{m.card.signedOut}</Body>
            <Spacer size="md" />
            <AccountButton
              label={m.signIn.submit.cta}
              tone="paper"
              waiting={!online}
              hint={online ? undefined : needsInternet}
              // Row NS-4: through the sign-in's AccountGate, which asks the typed PIN first without a fresh proof.
              onPress={() => navigation.navigate('SignIn', undefined)}
              testID="account-card-sign-in"
            />
            {!online ? <Caption tone="muted">{needsInternet}</Caption> : null}
          </>
        ) : null}
        {view.kind === 'signed_in' ? (
          <>
            {view.email && side.email !== null ? (
              <>
                <Body weight="semibold" testID="account-card-email">
                  {messages.console.adminInvite.signedInAs(side.email)}
                </Body>
                <Spacer size="sm" />
              </>
            ) : null}
            {decided.uses.length > 0 ? (
              <>
                <View style={{ gap: spacing.sm }} testID="account-card-uses">
                  {decided.uses.map((use) => {
                    const label = messages.learner.who.use[use];
                    const pin = decided.gate?.state === 'pin';
                    return (
                      <GrownUpRow
                        key={use}
                        label={label}
                        locked={pin}
                        disabled={!online}
                        caption={online ? null : needsInternet}
                        accessibilityLabel={pin ? messages.a11y.who.grownUpRow(label) : label}
                        // Row NS-4: through the home's AccountGate (the typed PIN first without a fresh proof).
                        onPress={() => navigation.navigate('AccountHome', { use })}
                        testID={`account-card-use-${use}`}
                      />
                    );
                  })}
                </View>
                <Spacer size="sm" />
              </>
            ) : null}
            <Body size="sm" tone="secondary">
              {messages.console.billing.help.sharedDevice}
            </Body>
            <Spacer size="md" />
            <AccountButton
              label={messages.console.shell.signOut.cta}
              tone="paper"
              waiting={working}
              onPress={() => setAsking(true)}
              testID="account-card-sign-out"
            />
          </>
        ) : null}
        {view.kind === 'locked' ? (
          <>
            <Body>{lockLine(view.cause)}</Body>
            {view.action === 'sign_in_again' ? (
              <View style={{ marginTop: spacing.md }}>
                <AccountButton
                  label={messages.console.lock.signInAgain.cta}
                  tone="paper"
                  waiting={!online}
                  hint={online ? undefined : needsInternet}
                  // Row NS-4: the sign-in's AccountGate asks the typed PIN, then signs out on this device and signs in.
                  onPress={() => navigation.navigate('SignIn', { again: true })}
                  testID="account-card-sign-in-again"
                />
                {!online ? <Caption tone="muted">{needsInternet}</Caption> : null}
              </View>
            ) : null}
          </>
        ) : null}
      </Card>
      <Spacer size="lg" />
      <ConfirmSheet
        visible={asking}
        title={m.signOut.ask}
        cancelLabel={messages.common.buttons.cancel}
        confirmLabel={messages.console.shell.signOut.cta}
        onCancel={() => setAsking(false)}
        onConfirm={() => void confirmSignOut()}
        testID="account-sign-out-sheet"
      />
    </>
  );
}
