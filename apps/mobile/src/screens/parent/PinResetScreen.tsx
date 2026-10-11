import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Icon,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { pinResetRequested } from '../../logic/onboarding/onboarding-events';
import { cooldownRemainingMs } from '../../logic/profiles/pin-hash';
import type { PinResetMethod } from '../../logic/profiles/pin-flow';
import {
  attemptRescueCode,
  collectRescueCodes,
  rescueFailureMessage,
  resetWaitState,
  waitCardView,
} from '../../logic/profiles/pin-reset';
import { RESCUE_INPUT_MAX, cleanRescueInput, rescueInputRows } from '../../logic/sync/rescue-code';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useProfileStore } from '../../store/profile-store';
import { useSyncStore } from '../../store/sync-store';

type Props = NativeStackScreenProps<RootStackParamList, 'PinReset'>;

/** The code field's text metrics, fixed so its height can be planned for the worst case (same as Restore). */
const CODE_LINE_HEIGHT = Math.round(typography.size.bodyLg * 1.3);
const CODE_BORDER = 2;

/** Local date and time, e.g. "Oct 11, 2026, 4:30 PM". */
function formatReadyAt(readyAt: number): string {
  return new Date(readyAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Forgot PIN — F-LEARN-001 §3.5, L9. Wireframe: design/wireframes/onboarding/all-ages-onboarding.md
 * boxes F and G (and profiles/pin-entry.md). Two offline ways to a new PIN, both keep
 * the learners, cards and progress: re-enter a Rescue Code this device already
 * stores, or wait 24 hours. Adult tone, nothing here teaches a child to try.
 */
export function PinResetScreen({ route, navigation }: Props): React.ReactElement {
  const { next } = route.params;
  const profiles = useProfileStore((s) => s.profiles);
  const hydrateSync = useSyncStore((s) => s.hydrate);
  const byLearner = useSyncStore((s) => s.byLearner);
  const attempts = useAccountStore((s) => s.pinAttempts);
  const setPinAttempts = useAccountStore((s) => s.setPinAttempts);
  const requestedAt = useAccountStore((s) => s.pinResetRequestedAt);
  const requestPinReset = useAccountStore((s) => s.requestPinReset);

  const [loaded, setLoaded] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [waitOpen, setWaitOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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
    navigation.replace('PinEntry', { next, mode: 'setup', via });
  };

  const submitCode = (): void => {
    const at = Date.now();
    setNow(at);
    const result = attemptRescueCode({ entry: codeInput, storedCodes: codes, state: attempts, now: at });
    if (result.state !== attempts) setPinAttempts(result.state);
    if (!result.ok) {
      setMessage(rescueFailureMessage(result));
      return;
    }
    void track(pinResetRequested('rescue_code'));
    goToSetup('rescue_code');
  };

  const view = waitCardView(wait, formatReadyAt);
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

  const codeRows = rescueInputRows(codeInput);
  const codeLine = locked ? `Let's take a short break. Try again in ${Math.ceil(cooldownMs / 1000)}s.` : message;
  const showWait = !hasCode || waitOpen || wait.status !== 'idle';

  return (
    <Screen tone="canvas">
      <Pressable
        onPress={() => navigation.replace('PinEntry', { next })}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{ alignSelf: 'flex-start', padding: spacing.xs }}
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">Reset the PIN</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">Your learners, cards and progress are kept.</Body>
      <Spacer size="lg" />

      {loaded ? (
        <>
          {hasCode ? (
            <Card padding="lg" tone="paper">
              <Heading level="prompt">Use a Rescue Code</Heading>
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
                placeholder="TIGER-MOON-RIVER-APPLE-482139"
                placeholderTextColor={colors.text.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                returnKeyType="go"
                maxLength={RESCUE_INPUT_MAX}
                accessibilityLabel="Rescue code"
                testID="pin-reset-code-input"
                style={{
                  minHeight: Math.max(
                    touchTarget.child,
                    codeRows * CODE_LINE_HEIGHT + 2 * spacing.sm + 2 * CODE_BORDER,
                  ),
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  fontSize: typography.size.bodyLg,
                  lineHeight: CODE_LINE_HEIGHT,
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
                Four words and six digits. Older codes: two words and four digits.
              </Caption>
              <Spacer size="md" />
              <Button
                label="Continue"
                tone="primary"
                size="lg"
                fullWidth
                disabled={locked || codeInput.trim().length === 0}
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
                  I don't have the code
                </Body>
              </Pressable>
            </>
          ) : null}

          {showWait ? (
            <>
              <Spacer size="sm" />
              <Card padding="lg" tone="paper">
                <Heading level="prompt">Wait 24 hours</Heading>
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
