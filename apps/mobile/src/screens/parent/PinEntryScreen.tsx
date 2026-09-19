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
import { Pressable, Text, View } from 'react-native';
import {
  PIN_LENGTH,
  attemptsRemaining,
  cooldownRemainingMs,
  createPinHash,
  verifyPin,
} from '../../logic/profiles/pin-hash';
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

  return (
    <Screen tone="canvas">
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={spacing.md}
        style={{ alignSelf: 'flex-start' }}
      >
        <Icon name="close" size={28} />
      </Pressable>
      <Spacer size="lg" />

      <Heading level="title">{title}</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">{subtitle}</Body>

      <Spacer size="xl" />
      <Card padding="lg" tone="brand">
        <View
          accessibilityLabel={`${entry.length} of ${PIN_LENGTH} digits entered`}
          style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <View
              key={i}
              style={{
                width: 20,
                height: 20,
                borderRadius: radii.circle,
                borderWidth: 2,
                borderColor: colors.brand.primary,
                backgroundColor: i < entry.length ? colors.brand.primary : colors.surface.paper,
              }}
            />
          ))}
        </View>
        <Spacer size="lg" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
            <Pressable
              key={n}
              disabled={locked || busy}
              onPress={() => {
                setHint(null);
                setEntry((e) => (e + String(n)).slice(0, PIN_LENGTH));
              }}
              accessibilityRole="button"
              accessibilityLabel={`Digit ${n}`}
              style={{
                width: touchTarget.child,
                height: touchTarget.child,
                borderRadius: radii.lg,
                backgroundColor: colors.surface.paper,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border.subtle,
                opacity: locked ? 0.5 : 1,
              }}
            >
              <Text style={{ fontSize: typography.size.title, fontWeight: '700', color: colors.text.primary }}>
                {n}
              </Text>
            </Pressable>
          ))}
          <Pressable
            disabled={entry.length === 0 || busy}
            onPress={() => setEntry((e) => e.slice(0, -1))}
            accessibilityRole="button"
            accessibilityLabel="Delete last digit"
            style={{
              width: touchTarget.child,
              height: touchTarget.child,
              borderRadius: radii.lg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="arrow-left" size={24} color={colors.text.muted} />
          </Pressable>
        </View>
      </Card>

      <Spacer size="lg" />
      <Button
        label={mode === 'verify' ? 'Unlock' : 'Next'}
        tone="primary"
        size="hero"
        fullWidth
        disabled={entry.length !== PIN_LENGTH || locked || busy}
        onPress={() => void submit()}
      />
      <Spacer size="sm" />
      <Button label="Cancel" tone="ghost" size="md" fullWidth onPress={() => navigation.goBack()} />

      {locked ? (
        <>
          <Spacer size="md" />
          <Caption tone="muted" align="center">
            Let&apos;s take a short break. Try again in {Math.ceil(cooldownMs / 1000)}s.
          </Caption>
        </>
      ) : hint ? (
        <>
          <Spacer size="md" />
          <Caption tone="muted" align="center">
            {hint}
          </Caption>
        </>
      ) : null}
    </Screen>
  );
}
