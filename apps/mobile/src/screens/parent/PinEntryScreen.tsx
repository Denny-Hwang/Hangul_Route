import {
  Body,
  Button,
  Heading,
  Icon,
  Screen,
  Spacer,
  colors,
  layout,
  radii,
  spacing,
  touchTarget,
  useLayoutClass,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PIN_PAD_GAP, PinPad } from '../../components/PinPad';
import { useMessages } from '../../i18n/use-messages';
import { pinCreated, pinResetCompleted } from '../../logic/onboarding/onboarding-events';
import { initialPinMode, pinCreatedWhere, showForgotPin, type PinMode } from '../../logic/profiles/pin-flow';
import {
  PIN_LENGTH,
  attemptsRemaining,
  cooldownRemainingMs,
  createPinHash,
  verifyPin,
} from '../../logic/profiles/pin-hash';
import { pinKeyMax, pinPadBudget, pinPadFirstWidth, pinPadLayout } from '../../logic/profiles/pin-pad-layout';
import type { RootStackParamList } from '../../navigation/types';
import { pinHasher } from '../../platform/crypto';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useAudience } from '../../store/audience';
import { useUiStore } from '../../store/ui-store';

type Props = NativeStackScreenProps<RootStackParamList, 'PinEntry'>;

/**
 * Grown-up gate — F-PROF-001 §3.1 (PIN, 5 attempts / 60 s, 30 s cooldown)
 * and §10 (interim: the first entry creates the family PIN because
 * parent-first onboarding has not shipped yet). Replaces the v1.0 math gate
 * (10-app-map §7 #1). Digits are never echoed as text — dots only (§3.5).
 */

const DOT_SIZE = 20;
/** First-frame guess for the title block until it is measured. */
const HEADER_ESTIMATE = 120;
/**
 * Everything but the header and the keys that must stay on screen: screen
 * padding (top + bottom), the gaps around the dots and above the CTA, the dots
 * and the CTA itself. Cancel may scroll — Close stays in the header.
 */
const PAD_CHROME = 2 * spacing.lg + 3 * spacing.md + DOT_SIZE + touchTarget.child;

export function PinEntryScreen({ route, navigation }: Props): React.ReactElement {
  const storedHash = useAccountStore((s) => s.parentPinHash);
  const attempts = useAccountStore((s) => s.pinAttempts);
  const setParentPinHash = useAccountStore((s) => s.setParentPinHash);
  const setPinAttempts = useAccountStore((s) => s.setPinAttempts);
  const clearPinResetRequest = useAccountStore((s) => s.clearPinResetRequest);
  const pinResetRequestedAt = useAccountStore((s) => s.pinResetRequestedAt);
  const { copy } = useAudience();
  const messages = useMessages();
  const m = messages.caregiver.pin;
  const openParentGate = useUiStore((s) => s.openParentGate);

  const [mode, setMode] = useState<PinMode>(() => initialPinMode(route.params, storedHash));
  const [entry, setEntry] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [headerHeight, setHeaderHeight] = useState(HEADER_ESTIMATE);
  const { windowWidth, windowHeight, gutter, mediaScale } = useLayoutClass();
  const insets = useSafeAreaInsets();
  // First-frame guess until the pad's box is measured: the `Screen` reading column less its gutter.
  const [padWidth, setPadWidth] = useState(() =>
    pinPadFirstWidth({ windowWidth, maxWidth: layout.maxWidth.reading, sidePadding: 2 * gutter }),
  );
  const pad = pinPadLayout({
    width: padWidth,
    height: pinPadBudget({
      windowHeight,
      insetTop: insets.top,
      insetBottom: insets.bottom,
      header: headerHeight,
      chrome: PAD_CHROME,
    }),
    minKey: touchTarget.min,
    // F-LAYOUT-001 §3.6: keys scale with the window up to touchTarget.hero (80 on a phone, as before).
    maxKey: pinKeyMax({ base: touchTarget.child, mediaScale, ceiling: touchTarget.hero }),
    gap: PIN_PAD_GAP,
  });

  const cooldownMs = cooldownRemainingMs(attempts, now);
  const locked = cooldownMs > 0;

  // Tick once a second only while a cooldown is showing.
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  const proceed = (): void => {
    openParentGate();
    if (route.params.next === 'PlacementFinish') {
      // The level check is underneath: it sees the gate open and ends the run for the grown-up.
      navigation.goBack();
    } else if (route.params.next === 'AddProfile') {
      navigation.replace('Onboarding', { screen: 'CreateProfile', params: { firstRun: false } });
    } else if (route.params.next === 'Restore') {
      navigation.replace('Restore', { from: 'settings' });
    } else if (route.params.next === 'SaveProgress') {
      navigation.replace('SaveProgress');
    } else if (route.params.next === 'Paywall') {
      navigation.replace('Paywall', { from: route.params.from ?? 'journey' });
    } else if (route.params.next === 'EditProfile') {
      const { profileId } = route.params;
      if (profileId === undefined) navigation.goBack();
      else navigation.replace('EditProfile', { profileId });
    } else if (route.params.next === 'ExternalLink') {
      // Back to Sources with the gate open: native opens the waiting link, the web asks for one more tap (F-STORY-002 §3.8).
      navigation.goBack();
    } else {
      navigation.replace('ParentDashboard');
    }
  };

  const submit = async (): Promise<void> => {
    if (entry.length !== PIN_LENGTH || busy) return;
    setBusy(true);
    try {
      if (mode === 'setup-1') {
        setFirstPin(entry);
        setEntry('');
        setHint(null);
        setMode('setup-2');
        return;
      }
      if (mode === 'setup-2') {
        if (entry !== firstPin) {
          setEntry('');
          setFirstPin('');
          setMode('setup-1');
          setHint(m.mismatch);
          return;
        }
        setParentPinHash(await createPinHash(entry, pinHasher));
        void track(pinCreated(pinCreatedWhere(route.params)));
        if (route.params.via) void track(pinResetCompleted(route.params.via));
        proceed();
        return;
      }
      const result = await verifyPin({
        pin: entry,
        storedHash,
        state: attempts,
        now: Date.now(),
        hasher: pinHasher,
      });
      setPinAttempts(result.state);
      setEntry('');
      if (result.ok) {
        // Remembering the PIN settles a pending Forgot PIN wait (F-LEARN-001 §3.5).
        if (pinResetRequestedAt !== null) clearPinResetRequest();
        proceed();
        return;
      }
      setNow(Date.now());
      if (result.reason === 'cooldown') {
        setHint(null);
      } else {
        const left = attemptsRemaining(result.state, Date.now());
        setHint(left > 0 ? m.entry.triesLeft(left) : null);
      }
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'verify' ? copy.pinVerifyTitle : mode === 'setup-1' ? copy.pinCreateTitle : m.entry.createAgain;
  const subtitle =
    mode === 'verify'
      ? m.entry.verifySubtitle
      : mode === 'setup-1'
        ? copy.pinCreateSubtitle
        : m.entry.createAgainSubtitle;

  const hintText = locked ? m.cooldown(Math.ceil(cooldownMs / 1000)) : hint;

  return (
    <Screen tone="canvas">
      {/* Measured: the keypad gets whatever height this block leaves (p1-L1). */}
      <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={messages.common.buttons.close}
            hitSlop={spacing.md}
            style={{ paddingTop: spacing.xxs }}
          >
            <Icon name="close" size={28} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Heading level="title">{title}</Heading>
          </View>
        </View>
        <Spacer size="xs" />
        {/*
          Feedback takes the subtitle's place instead of growing the header: it
          is never taller than the subtitle it covers (2 lines of 16sp vs 2-3 of
          18sp on a phone, 1 vs 1 on a wide column), so the measured header, and
          with it the keypad, keeps its size when a hint appears (p1-L1 follow-up).
        */}
        <View style={{ position: 'relative' }}>
          <View
            style={{ opacity: hintText ? 0 : 1 }}
            accessibilityElementsHidden={Boolean(hintText)}
            importantForAccessibility={hintText ? 'no-hide-descendants' : 'auto'}
          >
            <Body tone="secondary">{subtitle}</Body>
          </View>
          {hintText ? (
            <View accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
              <Body tone="secondary" size="sm" weight="semibold">
                {hintText}
              </Body>
            </View>
          ) : null}
        </View>
      </View>

      <Spacer size="md" />
      <View
        accessibilityLabel={messages.a11y.pinDots(entry.length, PIN_LENGTH)}
        style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: radii.circle,
              borderWidth: 2,
              borderColor: colors.brand.primary,
              backgroundColor: i < entry.length ? colors.brand.primary : colors.surface.paper,
            }}
          />
        ))}
      </View>
      <Spacer size="md" />

      <View onLayout={(e) => setPadWidth(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }}>
        <PinPad
          value={entry}
          onChange={(next) => {
            if (next.length >= entry.length) setHint(null);
            setEntry(next);
          }}
          disabled={locked || busy}
          layout={pad}
        />
      </View>

      <Spacer size="md" />
      <Button
        label={mode === 'verify' ? m.entry.unlock.cta : messages.common.buttons.next}
        tone="primary"
        size="lg"
        fullWidth
        disabled={entry.length !== PIN_LENGTH || locked || busy}
        onPress={() => void submit()}
      />
      <Spacer size="sm" />
      <Button label={messages.common.buttons.cancel} tone="ghost" size="md" fullWidth onPress={() => navigation.goBack()} />
      {/* Quiet on purpose: plain text, no icon, nothing for a child to gain from poking it. */}
      {showForgotPin(mode) ? (
        <Button
          label={m.entry.forgot.cta}
          tone="ghost"
          size="md"
          fullWidth
          onPress={() => navigation.replace('PinReset', { next: route.params.next, profileId: route.params.profileId })}
        />
      ) : null}
    </Screen>
  );
}
