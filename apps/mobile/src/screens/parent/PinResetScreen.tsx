import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  touchTarget,
  useTypeScale,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { flags } from '../../config/flags';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { pinResetRequested } from '../../logic/onboarding/onboarding-events';
import { cooldownRemainingMs } from '../../logic/profiles/pin-hash';
import type { PinResetMethod } from '../../logic/profiles/pin-flow';
import { pauseText } from '../../logic/profiles/pin-pause';
import {
  collectRescueCodes,
  formatReadyAt,
  rescueFailureMessage,
  resetWaitState,
  waitCardView,
} from '../../logic/profiles/pin-reset';
import { signInResetShown } from '../../logic/shell/pin-reset-ticket';
import { RESCUE_INPUT_MAX, cleanRescueInput, rescueInputRows } from '../../logic/sync/rescue-code';
import type { RootStackParamList } from '../../navigation/types';
import { subscribePageRestore } from '../../platform/app-visibility';
import { openPinResetSignIn } from '../../platform/pin-reset';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useProfileStore } from '../../store/profile-store';
import { useSyncStore } from '../../store/sync-store';
import { useBackGuard } from '../use-back-guard';

type Props = NativeStackScreenProps<RootStackParamList, 'PinReset'>;

/** The code field's line height at the chosen text size (bodyLg x 1.3), so its height can be planned for the worst case. */
const codeLineHeight = (fontSize: number): number => Math.round(fontSize * 1.3);
const CODE_BORDER = 2;

/**
 * Forgot PIN — F-LEARN-001 §3.5, L9. Wireframe: design/wireframes/onboarding/all-ages-onboarding.md
 * boxes F and G (and profiles/pin-entry.md). Two offline ways to a new PIN, both keep
 * the learners, cards and progress: re-enter a Rescue Code this device already
 * stores, or wait 24 hours. Adult tone, nothing here teaches a child to try.
 *
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 step 1 (row OA-6; mock `design/screens/profiles/pin-entry-v2.md`
 * boards 7 and 8): on the web, online, with `EXPO_PUBLIC_PIN_RESET_SIGNIN` on, **Sign in to the account** comes first.
 * Its Sign in opens `/signin?next=/account/pin-reset` in this tab and writes no unlock; the console checks that the
 * PIN owner signed in with a password or a code and sends the tab back with a ticket (`gate=pin-reset`).
 */
export function PinResetScreen({ route, navigation }: Props): React.ReactElement {
  const textScale = useTypeScale();
  const fieldLineHeight = codeLineHeight(textScale.size.bodyLg);
  const { next, profileId } = route.params;
  const locale = useLocale();
  const messages = useMessages();
  const m = messages.caregiver.pin;
  const profiles = useProfileStore((s) => s.profiles);
  const hydrateSync = useSyncStore((s) => s.hydrate);
  const byLearner = useSyncStore((s) => s.byLearner);
  // [OA] The Rescue Code's own counter (section 8.3): a PIN pause never blocks it.
  const attempts = useAccountStore((s) => s.rescueAttempts);
  const attemptRescue = useAccountStore((s) => s.attemptRescue);
  const [busy, setBusy] = useState(false);
  const requestedAt = useAccountStore((s) => s.pinResetRequestedAt);
  const requestPinReset = useAccountStore((s) => s.requestPinReset);

  const [loaded, setLoaded] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [waitOpen, setWaitOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const online = useOnline();
  const signInShown = signInResetShown({ os: Platform.OS, online, flag: flags.pinResetSignInEnabled });
  const [leaving, setLeaving] = useState(false);

  // The Rescue Codes live in the per-learner sync records; load them all before
  // choosing which cards to draw, so the layout does not jump.
  useEffect(() => {
    let alive = true;
    void Promise.all(profiles.map((p) => hydrateSync(p.id))).then(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [profiles, hydrateSync]);

  const ids = new Set(profiles.map((p) => p.id));
  const codes = collectRescueCodes(
    Object.fromEntries(Object.entries(byLearner).filter(([id]) => ids.has(id))),
  );
  const hasCode = codes.length > 0;

  const wait = resetWaitState(requestedAt, now);
  const cooldownMs = cooldownRemainingMs(attempts, now);
  const locked = cooldownMs > 0;

  // Tick once a second only while something is counting down.
  useEffect(() => {
    if (!locked && wait.status !== 'waiting') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked, wait.status]);

  const goToSetup = (via: PinResetMethod): void => {
    navigation.replace('PinEntry', { next, profileId, mode: 'setup', via });
  };

  const submitCode = (): void => {
    if (busy) return;
    setBusy(true);
    void attemptRescue(codeInput, codes)
      .then((result) => {
        setNow(Date.now());
        if (!result.ok) {
          setMessage(rescueFailureMessage(result, m));
          return;
        }
        void track(pinResetRequested('rescue_code'));
        goToSetup('rescue_code');
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  const view = waitCardView(wait, (readyAt) => formatReadyAt(locale, readyAt), m);
  const pressWait = (): void => {
    if (wait.status === 'ready') {
      goToSetup('wait');
      return;
    }
    if (wait.status === 'idle') {
      requestPinReset();
      void track(pinResetRequested('wait'));
      setNow(Date.now());
    }
  };

  // Back returns to the PIN screen this one replaced (the header's Back, the browser and the phone back alike,
  // AMENDMENTS-DISPLAY-NAV section 7.1); the replace is the screen's own way on, so the guard lets it through.
  useBackGuard(
    navigation,
    () => {
      void Promise.resolve().then(() => navigation.replace('PinEntry', { next, profileId }));
      return true;
    },
    true,
  );

  // [OA] Row OA-6 review round 2: Back from `/signin` can bring this page back from the back/forward cache with the
  // hand-off already left; Sign in is pressable again then, as the page it shows is the one the grown-up returned to.
  useEffect(() => subscribePageRestore(() => setLeaving(false)), []);

  const signIn = (): void => {
    if (leaving) return;
    setLeaving(true);
    void openPinResetSignIn().catch(() => setLeaving(false));
  };

  const codeRows = rescueInputRows(codeInput);
  const codeLine = locked ? pauseText(cooldownMs, m) : message;
  const showWait = !hasCode || waitOpen || wait.status !== 'idle';

  return (
    <Screen tone="canvas">
      <Heading level="title">{m.reset.title}</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">{m.reset.subtitle}</Body>
      <Spacer size="lg" />

      {loaded ? (
        <>
          {signInShown ? (
            <>
              <Card padding="lg" tone="paper" testID="pin-reset-signin">
                <Heading level="prompt">{m.reset.signIn.heading}</Heading>
                <Spacer size="sm" />
                <Body tone="secondary">{m.reset.signIn.caption}</Body>
                <Spacer size="md" />
                <Button label={m.reset.signIn.button} tone="primary" size="lg" fullWidth disabled={leaving} onPress={signIn} testID="pin-reset-signin-button" />
              </Card>
              <Spacer size="md" />
            </>
          ) : null}
          {hasCode ? (
            <Card padding="lg" tone="paper">
              <Heading level="prompt">{m.reset.code.heading}</Heading>
              <Spacer size="sm" />
              <TextInput
                value={codeInput}
                onChangeText={(v) => {
                  setMessage(null);
                  setCodeInput(cleanRescueInput(v));
                }}
                onSubmitEditing={submitCode}
                // Wraps instead of scrolling sideways, one row per word typed so no font clips the last one at 320 px.
                multiline
                numberOfLines={codeRows}
                blurOnSubmit
                placeholder={m.reset.code.placeholder}
                placeholderTextColor={colors.text.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                returnKeyType="go"
                maxLength={RESCUE_INPUT_MAX}
                accessibilityLabel={messages.a11y.rescueCode}
                testID="pin-reset-code-input"
                style={{
                  minHeight: Math.max(
                    touchTarget.child,
                    codeRows * fieldLineHeight + 2 * spacing.sm + 2 * CODE_BORDER,
                  ),
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  fontSize: textScale.size.bodyLg,
                  lineHeight: fieldLineHeight,
                  fontWeight: '700',
                  color: colors.text.primary,
                  backgroundColor: colors.surface.sunken,
                  borderWidth: CODE_BORDER,
                  borderColor: colors.border.subtle,
                  borderRadius: radii.lg,
                }}
              />
              <Spacer size="xs" />
              <Caption tone="muted" align="center">
                {m.reset.code.formats}
              </Caption>
              <Spacer size="md" />
              <Button
                label={messages.common.buttons.continue}
                tone="primary"
                size="lg"
                fullWidth
                disabled={locked || busy || codeInput.trim().length === 0}
                onPress={submitCode}
              />
              {codeLine ? (
                <View accessibilityLiveRegion="polite" style={{ paddingTop: spacing.sm }}>
                  <Caption tone="secondary" align="center">
                    {codeLine}
                  </Caption>
                </View>
              ) : null}
            </Card>
          ) : null}

          {hasCode ? (
            <>
              <Spacer size="md" />
              <Pressable
                onPress={() => setWaitOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showWait }}
                style={{
                  minHeight: touchTarget.min,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <Body weight="semibold" tone="brand">
                  {m.reset.noCode.cta}
                </Body>
              </Pressable>
            </>
          ) : null}

          {showWait ? (
            <>
              <Spacer size="sm" />
              <Card padding="lg" tone="paper">
                <Heading level="prompt">{m.reset.wait.heading}</Heading>
                <Spacer size="sm" />
                <View accessibilityLiveRegion="polite">
                  <Body tone="secondary">{view.caption}</Body>
                </View>
                <Spacer size="md" />
                <Button
                  label={view.buttonLabel}
                  tone={wait.status === 'ready' ? 'primary' : 'secondary'}
                  size="lg"
                  fullWidth
                  disabled={view.buttonDisabled}
                  onPress={pressWait}
                />
              </Card>
            </>
          ) : null}
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
