import { Body, Button, Caption, Card, Heading, Hoya, HoyaBubble, Icon, Screen, Spacer, colors, radii, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { LIFETIME_OFFER, PREMIUM_BULLETS, PROMO_HINT, consoleBillingUrl, paywallState } from '../../logic/paywall';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { effectiveTier, useTierStore } from '../../store/tier-store';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

/**
 * paywall/upgrade — F-ENT-001 §3.5. Reached only through the PIN gate.
 * Stage 1 free comes first; "covered by your class" shows no prices at all.
 */
export function PaywallScreen({ navigation, route }: Props): React.ReactElement {
  const profile = useProfileStore(activeProfileSelector);
  const cached = useTierStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const entitled = effectiveTier(profile?.id ?? '', new Date());
  const state = paywallState(entitled.tier, entitled.source);
  const [note, setNote] = useState<string | null>(null);
  const name = profile?.displayName ?? 'Your learner';
  const from = route.params?.from ?? 'settings';
  void cached; // re-render when the inbox updates the tier

  useEffect(() => {
    void track({ name: 'paywall.viewed', profileId: profile?.id, payload: { state, from } });
  }, [state, from, profile?.id]);

  const openConsole = async (): Promise<void> => {
    const url = consoleBillingUrl();
    void track({ name: 'paywall.console_opened', profileId: profile?.id, payload: { plan: LIFETIME_OFFER.key } });
    try {
      await Linking.openURL(url);
    } catch {
      setNote(`Open ${url} on a computer or phone browser.`);
    }
  };

  const back = (): void => {
    if (from === 'journey') navigation.navigate('Main', { screen: 'Journey' });
    else navigation.goBack();
  };

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={back} hitSlop={spacing.md} accessibilityRole="button" accessibilityLabel="Go back" style={{ padding: spacing.xs }}>
          <Icon name="arrow-left" size={28} />
        </Pressable>
      </View>
      <Spacer size="sm" />

      {state === 'covered' ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <Hoya pose="cheering" size={96} />
          </View>
          <Spacer size="md" />
          <Heading level="title" align="center">
            {name} is covered by {entitled.source?.name ?? 'the class'}.
          </Heading>
          <Spacer size="xs" />
          <Body tone="secondary" align="center">Everything is unlocked while they are in it.</Body>
          <Spacer size="xl" />
          <Button label="Back to journey" tone="primary" size="lg" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Journey' })} />
        </>
      ) : state === 'premium' ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <Hoya pose="cheering" size={96} />
          </View>
          <Spacer size="md" />
          <Heading level="title" align="center">You&apos;re on Premium.</Heading>
          <Spacer size="xs" />
          <Body tone="secondary" align="center">The full journey is open for {name}. Manage your plan on the web console.</Body>
          <Spacer size="xl" />
          <Button label="Manage plan on the web" tone="secondary" size="lg" fullWidth onPress={() => void openConsole()} />
          <Spacer size="sm" />
          <Button label="Back to journey" tone="primary" size="lg" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Journey' })} />
        </>
      ) : (
        <>
          <HoyaBubble tone="idle" message="Stage 1 is always free." />
          <Spacer size="lg" />
          <Heading level="prompt">What {LIFETIME_OFFER.label} unlocks</Heading>
          <Spacer size="xs" />
          {PREMIUM_BULLETS.map((line) => (
            <Body key={line} tone="secondary">
              · {line}
            </Body>
          ))}
          <Spacer size="lg" />
          <View
            accessibilityLabel={`${LIFETIME_OFFER.label}, ${LIFETIME_OFFER.price}`}
            style={{
              padding: spacing.md,
              borderRadius: radii.lg,
              borderWidth: 2,
              borderColor: colors.brand.primary,
              backgroundColor: colors.brand.primaryLight,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Body weight="semibold">{LIFETIME_OFFER.label}</Body>
              <Body weight="semibold">{LIFETIME_OFFER.price}</Body>
            </View>
            <Caption tone="muted">{LIFETIME_OFFER.line}</Caption>
          </View>
          <Spacer size="lg" />
          <Card padding="md" tone="sunken">
            <Caption tone="secondary">
              {Platform.OS === 'web'
                ? 'Grown-ups buy it once on the web console, so no store fees reach your family. Sign in there and come back — this device updates on its next sync.'
                : 'Buying inside this app arrives with the store update. Until then, a grown-up can buy it once on the web console.'}
            </Caption>
          </Card>
          <Spacer size="md" />
          <Button label="Open the web console" tone="primary" size="lg" fullWidth onPress={() => void openConsole()} />
          {note ? (
            <>
              <Spacer size="xs" />
              <Caption tone="muted" align="center">{note}</Caption>
            </>
          ) : null}
          <Spacer size="md" />
          <Caption tone="muted" align="center">{PROMO_HINT}</Caption>
          <Spacer size="xs" />
          <Caption tone="muted" align="center">One payment, no renewal. Terms and privacy are on the website.</Caption>
        </>
      )}
      <Spacer size="xl" />
    </Screen>
  );
}
