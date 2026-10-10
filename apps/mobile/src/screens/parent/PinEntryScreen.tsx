import {
  Body,
  Button,
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
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PIN_LENGTH,
  attemptsRemaining,
  cooldownRemainingMs,
  createPinHash,
  verifyPin,
} from '../../logic/profiles/pin-hash';
import { pinPadBudget, pinPadLayout } from '../../logic/profiles/pin-pad-layout';
import type { RootStackParamList } from '../../navigation/types';
import { pinHasher } from '../../platform/crypto';
import { useAccountStore } from '../../store/account-store';
import { useUiStore } from '../../store/ui-store';

type Props = NativeStackScreenProps<RootStackParamList, 'PinEntry'>;

/**
 * Grown-up gate — F-PROF-001 §3.1 (PIN, 5 attempts / 60 s, 30 s cooldown)
 * and §10 (interim: the first entry creates the family PIN because
 * parent-first onboarding has not shipped yet). Replaces the v1.0 math gate
 * (10-app-map §7 #1). Digits are never echoed as text — dots only (§3.5).
 */
type Mode = 'setup-1' | 'setup-2' | 'verify';

const KEY_GAP = spacing.sm;
const DOT_SIZE = 20;
/** First-frame guess for the title block until it is measured. */
const HEADER_ESTIMATE = 120;
/** The web build centres a 480px column on wide screens (pwa-postbuild). */
const WEB_COLUMN_MAX = 480;
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
  const openParentGate = useUiStore((s) => s.openParentGate);

  const [mode, setMode] = useState<Mode>(storedHash ? 'verify' : 'setup-1');
  const [entry, setEntry] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [headerHeight, setHeaderHeight] = useState(HEADER_ESTIMATE);
  const screenSize = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [padWidth, setPadWidth] = useState(() => Math.min(screenSize.width, WEB_COLUMN_MAX) - 2 * spacing.lg);
  const pad = pinPadLayout({
    width: padWidth,
    height: pinPadBudget({
      windowHeight: screenSize.height,
      insetTop: insets.top,
      insetBottom: insets.bottom,
      header: headerHeight,
      chrome: PAD_CHROME,
    }),
    minKey: touchTarget.min,
    maxKey: touchTarget.child,
    gap: KEY_GAP,
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
    if (route.params.next === 'AddProfile') {
      navigation.replace('Onboarding', { screen: 'CreateProfile', params: { firstRun: false } });
    } else if (route.params.next === 'Restore') {
      navigation.replace('Restore', { from: 'settings' });
    } else if (route.params.next === 'SaveProgress') {
      navigation.replace('SaveProgress');
    } else if (route.params.next === 'Paywall') {
      navigation.replace('Paywall', { from: 'journey' });
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
          setHint("Those didn't match. Let's start again.");
          return;
        }
        setParentPinHash(await createPinHash(entry, pinHasher));
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
        proceed();
        return;
      }
      setNow(Date.now());
      if (result.reason === 'cooldown') {
        setHint(null);
      } else {
        const left = attemptsRemaining(result.state, Date.now());
        setHint(left > 0 ? `Not quite. ${left} more ${left === 1 ? 'try' : 'tries'}.` : null);
      }
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'verify' ? 'Grown-up zone' : mode === 'setup-1' ? 'Create a grown-up PIN' : 'Enter it once more';
  const subtitle =
    mode === 'verify'
      ? 'Enter your 4-digit PIN to continue.'
      : mode === 'setup-1'
        ? 'Pick 4 digits only grown-ups will know. It protects settings and grown-up pages.'
        : 'Type the same 4 digits again.';

  const hintText = locked
    ? `Let's take a short break. Try again in ${Math.ceil(cooldownMs / 1000)}s.`
    : hint;

  const keys: Array<number | 'delete'> = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 'delete'];
  const gridWidth = pad.columns * pad.keySize + (pad.columns - 1) * KEY_GAP;

  return (
    <Screen tone="canvas">
      {/* Measured: the keypad gets whatever height this block leaves (p1-L1). */}
      <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Close"
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
        accessibilityLabel={`${entry.length} of ${PIN_LENGTH} digits entered`}
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
        <View
          style={{
            width: gridWidth,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: KEY_GAP,
            justifyContent: 'center',
          }}
        >
          {keys.map((k) =>
            k === 'delete' ? (
              <Pressable
                key={k}
                disabled={entry.length === 0 || busy}
                onPress={() => setEntry((e) => e.slice(0, -1))}
                accessibilityRole="button"
                accessibilityLabel="Delete last digit"
                style={{
                  width: pad.keySize,
                  height: pad.keySize,
                  borderRadius: radii.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="arrow-left" size={24} color={colors.text.secondary} />
              </Pressable>
            ) : (
              <Pressable
                key={k}
                disabled={locked || busy}
                onPress={() => {
                  setHint(null);
                  setEntry((e) => (e + String(k)).slice(0, PIN_LENGTH));
                }}
                accessibilityRole="button"
                accessibilityLabel={`Digit ${k}`}
                style={{
                  width: pad.keySize,
                  height: pad.keySize,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface.paper,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border.strong,
                  opacity: locked ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: typography.size.title, fontWeight: '700', color: colors.text.primary }}>
                  {k}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      </View>

      <Spacer size="md" />
      <Button
        label={mode === 'verify' ? 'Unlock' : 'Next'}
        tone="primary"
        size="lg"
        fullWidth
        disabled={entry.length !== PIN_LENGTH || locked || busy}
        onPress={() => void submit()}
      />
      <Spacer size="sm" />
      <Button label="Cancel" tone="ghost" size="md" fullWidth onPress={() => navigation.goBack()} />
    </Screen>
  );
}
