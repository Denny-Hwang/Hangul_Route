import { useAuth } from '@clerk/clerk-expo';
import type { GrownUpUse } from '@hangul-route/content-schema';
import { Body, Caption, Icon, Screen, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { AppState, Keyboard, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { accountTitleUse } from '../../logic/account/account-entry';
import { freshProof } from '../../logic/account/account-lock';
import { enteredFromOutside, gateStep, lockCauseOf, type GateScreen, type GateStep } from '../../logic/account/account-gate';
import { trustOfRead } from '../../logic/account/sign-in-records';
import type { GrownUpStackParamList, RootStackParamList } from '../../navigation/types';
import { holdAccountCapture } from '../../platform/account-capture';
import { readTrust } from '../../platform/account-records';
import { useAccountVisit } from '../../store/account-visit';
import { nativeGateState } from '../../store/native-gate-state';
import { useUiStore } from '../../store/ui-store';
import { AccountButton } from './AccountButton';
import { AccountCover } from './AccountCover';
import { AccountHostContext, ClerkMountContext } from './account-host';
import { trackLock, useAccountOnline, useAccountSignOut, useDecisionMoments } from './account-session.native';

/**
 * F-AUTH-004 sections 7.2, 7.3 and 7.4, design `lock.md` boards 1 to 7, 16 and 17 and D6 (row NS-4; CS-N2, CS-N3,
 * CS-N11, CS-N12, CS-N14): the gate every account screen renders inside, on iOS and Android. It decides on mount, on
 * every focus and on every return of the app to `active` (`useDecisionMoments`), from exact reads only
 * (`nativeGateState`, the trust record) and this run's memory (Clerk's session, this visit's sign-in, the typed PIN's
 * time), through `gateStep` (`logic/account/account-gate.ts`):
 *
 * - **Open**: the screen's content (`children`). Locked: one lock card under the ScreenHeader titled with the use the
 *   grown-up came for (`learner.who.use.*`, or **Grown-up account**), with the lock glyph, the result's line and its
 *   buttons, and nothing of the account (no email, name, space or number; D6).
 * - **The typed PIN** (ND-5): `PinEntry { next: 'FreshPin', typedOnly: true, use }` (no face or fingerprint, titled
 *   with the use, D17); a return without a typed PIN leaves the screen.
 * - **`nopin`**: the Grown-up area goes, PIN setup takes its place (`PinEntry { next: 'ParentDashboard' }`, ND-7).
 * - Each locked decision sends `auth.native.lock { cause }`, at most once per mount (section 15).
 * - **Capture protection** (7.4) while the screen is focused, whatever it shows: Android's `FLAG_SECURE` and the iOS
 *   native cover's flag (`holdAccountCapture`); and the JavaScript cover (the splash, D12) while the app is not
 *   `active`, kept until the decision on the return has answered, so a lock decided then never shows the content;
 *   the keyboard is dismissed then too (its window is beyond both covers). A decision on focus over an open screen
 *   hides it (the canvas alone) until it answers.
 *
 * Clerk's hooks are read only under its provider (`ClerkMountContext` `ready`); without it nothing can be checked and
 * the `unknown` lock shows, whose Try again asks the area to decide its provider again.
 */

export type AccountGateNavigation = NativeStackNavigationProp<GrownUpStackParamList, 'SignIn' | 'AccountHome'>;

export interface AccountGateProps {
  screen: GateScreen;
  /** The use the grown-up came for (the title, D6; the next route's param); none is **Grown-up account**. */
  use: GrownUpUse | 'account' | undefined;
  /** `SignIn { again }`: the account card's Sign in again (signs out on this device first, after the typed PIN). */
  again?: boolean;
  navigation: AccountGateNavigation;
  /** This screen's route key (where it sits in its stack: entered from outside the account routes or not). */
  routeKey: string;
  children: ReactNode;
}

export function AccountGate(props: AccountGateProps): ReactElement {
  const mount = useContext(ClerkMountContext);
  if (mount === 'ready') return <GateWithClerk {...props} />;
  return <GateCore {...props} clerk={mount === 'pending' ? 'loading' : 'off'} clerkSignedIn={false} />;
}

/** The gate under Clerk's provider: whether Clerk has loaded, and whether it holds a session. */
function GateWithClerk(props: AccountGateProps): ReactElement {
  const { isLoaded, isSignedIn } = useAuth();
  return <GateCore {...props} clerk={isLoaded ? 'ready' : 'loading'} clerkSignedIn={isLoaded && isSignedIn === true} />;
}

type Cover = 'none' | 'image' | 'plain';

function GateCore({ screen, use, again = false, navigation, routeKey, children, clerk, clerkSignedIn }: AccountGateProps & { clerk: 'off' | 'loading' | 'ready'; clerkSignedIn: boolean }): ReactElement {
  const messages = useMessages();
  const host = useContext(AccountHostContext);
  const online = useAccountOnline();
  const signOut = useAccountSignOut();
  const [step, setStep] = useState<GateStep | null>(null);
  const [cover, setCover] = useState<Cover>(() => (AppState.currentState === 'active' || AppState.currentState === undefined ? 'none' : 'image'));
  const [working, setWorking] = useState(false);

  // Clerk's answer as of now, read by the decision (the latest render's).
  const clerkNow = useRef({ clerk, clerkSignedIn });
  clerkNow.current = { clerk, clerkSignedIn };
  const stepNow = useRef<GateStep | null>(null);
  const opened = useRef(false);
  const askedPin = useRef(false);
  const againNow = useRef(again);
  const lockSent = useRef(false);
  const generation = useRef(0);
  const live = useRef(true);
  // Where this screen was entered from is a fact of this mount (ND-5): read once.
  const outside = useRef<boolean | null>(null);
  if (outside.current === null) {
    const state = navigation.getState?.();
    outside.current = state === undefined ? true : enteredFromOutside(state.routes, routeKey);
  }

  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  const show = (next: GateStep): void => {
    stepNow.current = next;
    setStep(next);
  };

  const decide = useCallback(() => {
    generation.current += 1;
    const mine = generation.current;
    // A decision over an open screen hides it until it answers (7.2): a lock decided now never shows the content first.
    if (stepNow.current?.kind === 'open') setCover((c) => (c === 'none' ? 'plain' : c));
    void Promise.all([nativeGateState(), readTrust()]).then(([gate, trust]) => {
      if (!live.current || mine !== generation.current) return;
      const visit = useAccountVisit.getState();
      const fresh = freshProof(Date.now(), useUiStore.getState().lastPinTypedAt, visit.lastAccountSignInAt);
      const next = gateStep({
        screen,
        gate,
        clerk: clerkNow.current.clerk,
        // After a Sign out this run (offline, Clerk may still hold the session: R-2) the account reads as signed out.
        signedIn: clerkNow.current.clerkSignedIn && !visit.signedOutThisRun,
        signedInThisVisit: visit.signedInThisVisit,
        trust: trustOfRead(trust),
        retrustPending: visit.retrustPending,
        fresh,
        enteredFromOutside: outside.current === true,
        opened: opened.current,
        askedPin: askedPin.current,
        again: againNow.current,
      });
      if (next.kind !== 'ask_pin' && next.kind !== 'sign_out_then_sign_in') againNow.current = false;
      if (next.kind !== 'ask_pin') askedPin.current = false;
      const cause = lockCauseOf(next);
      if (cause !== null && !lockSent.current) {
        lockSent.current = true;
        trackLock(cause);
      }
      if (AppState.currentState === 'active' || AppState.currentState === undefined) setCover('none');
      switch (next.kind) {
        case 'open':
          opened.current = true;
          show(next);
          return;
        case 'wait':
        case 'locked':
          show(next);
          return;
        case 'to_sign_in':
          navigation.replace('SignIn', use === undefined ? {} : { use });
          return;
        case 'to_home':
          navigation.replace('AccountHome', { use: use ?? 'account' });
          return;
        case 'ask_pin':
          askedPin.current = true;
          show({ kind: 'wait' });
          navigation.navigate('PinEntry', { next: 'FreshPin', typedOnly: true, ...(use === undefined ? {} : { use }) });
          return;
        case 'leave':
          navigation.goBack();
          return;
        case 'setup':
          // The Grown-up area itself gives way to PIN setup (ND-7); setup then opens a new area.
          (navigation.getParent<NativeStackNavigationProp<RootStackParamList>>() ?? navigation).replace('PinEntry', { next: 'ParentDashboard' });
          return;
        case 'sign_out_then_sign_in':
          againNow.current = false;
          show({ kind: 'wait' });
          setWorking(true);
          void signOut('lock')
            .catch(() => false)
            .then(() => {
              if (!live.current) return;
              setWorking(false);
              if (screen === 'sign_in') decideRef.current();
              else navigation.replace('SignIn', use === undefined ? {} : { use });
            });
          return;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the latest values through refs; `screen` and `use` are this mount's
  }, [navigation, screen, use, signOut]);
  const decideRef = useRef(decide);
  decideRef.current = decide;

  useDecisionMoments(navigation, decide);

  // Clerk answered after a decision that waited for it.
  useEffect(() => {
    if (stepNow.current?.kind === 'wait' && !askedPin.current && clerk !== 'loading') decideRef.current();
  }, [clerk]);

  // The JavaScript cover while the app is not `active` (the decision on the return to `active` takes it away). The
  // keyboard goes too: it is a window of its own, which neither cover reaches (the NS-2 limitation), and its
  // suggestion bar may hold what was typed (an email, a code).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      setCover('image');
      Keyboard.dismiss();
    });
    return () => sub.remove();
  }, []);

  // Capture protection while this screen is focused (7.4, CS-N12).
  useEffect(() => {
    let release: (() => void) | null = holdAccountCapture();
    const offFocus = navigation.addListener('focus', () => {
      if (release === null) release = holdAccountCapture();
    });
    const offBlur = navigation.addListener('blur', () => {
      release?.();
      release = null;
    });
    return () => {
      offFocus();
      offBlur();
      release?.();
    };
  }, [navigation]);

  const titleUse = accountTitleUse(use);
  const title = titleUse === 'account' ? messages.caregiver.account.card.title : messages.learner.who.use[titleUse];
  const coverLayer = cover === 'none' ? null : <AccountCover image={cover === 'image'} />;

  if (step?.kind === 'open') {
    return (
      <View style={{ flex: 1 }}>
        {children}
        {coverLayer}
      </View>
    );
  }

  const content = step?.kind === 'locked' ? <LockCard step={step} online={online} working={working} host={host} decide={decide} navigation={navigation} again={() => {
    againNow.current = true;
    decide();
  }} /> : null;
  return (
    <View style={{ flex: 1 }}>
      <Screen tone="canvas" scrollable header={{ title }}>
        {content}
      </Screen>
      {coverLayer}
    </View>
  );
}

function LockCard({
  step,
  online,
  working,
  host,
  decide,
  navigation,
  again,
}: {
  step: Extract<GateStep, { kind: 'locked' }>;
  online: boolean;
  working: boolean;
  host: { mount: string; retry: () => void };
  decide: () => void;
  navigation: AccountGateNavigation;
  again: () => void;
}): ReactElement {
  const messages = useMessages();
  const needsInternet = messages.learner.welcome.grownUps.needsInternet;
  const line =
    step.cause === 'unknown'
      ? messages.caregiver.account.lock.cantCheck
      : step.cause === 'epoch_zero'
        ? messages.console.lock.pinRenew
        : step.cause === 'no_trust'
          ? messages.console.lock.firstSignIn
          : step.cause === 'pin_changed'
            ? messages.console.lock.pinChanged
            : messages.caregiver.account.lock.retrustPassword;
  return (
    <View
      testID={`account-lock-${step.cause}`}
      style={{
        backgroundColor: colors.surface.paper,
        borderWidth: borderWidth.thin,
        borderColor: colors.border.subtle,
        borderRadius: radii.lg,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: touchTarget.min, height: touchTarget.min, borderRadius: radii.circle, backgroundColor: colors.surface.sunken, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}
      >
        <Icon name="lock" size={24} color={colors.text.secondary} />
      </View>
      <Body>{line}</Body>
      {step.action === 'try_again' ? (
        <>
          <AccountButton
            label={messages.common.buttons.tryAgain}
            tone="primary"
            fullWidth
            onPress={() => {
              // No Clerk for this visit: the area decides its provider again; else the stores are read again.
              if (host.mount === 'off') host.retry();
              else decide();
            }}
            testID="account-lock-try-again"
          />
          <AccountButton label={messages.common.buttons.back} tone="paper" fullWidth onPress={() => navigation.goBack()} testID="account-lock-back" />
        </>
      ) : null}
      {step.action === 'back' ? <AccountButton label={messages.common.buttons.back} tone="paper" fullWidth onPress={() => navigation.goBack()} testID="account-lock-back" /> : null}
      {step.action === 'sign_in_again' ? (
        <>
          <AccountButton
            label={messages.console.lock.signInAgain.cta}
            tone="primary"
            fullWidth
            waiting={!online || working}
            hint={online ? undefined : needsInternet}
            onPress={again}
            testID="account-lock-sign-in-again"
          />
          {!online ? <Caption tone="muted">{needsInternet}</Caption> : null}
        </>
      ) : null}
    </View>
  );
}
