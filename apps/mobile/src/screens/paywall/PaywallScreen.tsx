import { Body, Button, Caption, Card, Heading, Hoya, HoyaBubble, Icon, Screen, Spacer, colors, radii, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { consoleBillingUrl, lifetimeOffer, paywallState, premiumBullets } from '../../logic/paywall';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { effectiveTier, useTierStore } from '../../store/tier-store';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

/**
 * paywall/upgrade — F-ENT-001 §3.5. Reached only through the PIN gate.
 * Stage 1 free comes first; "covered by your class" shows no prices at all.
 */
export function PaywallScreen({ navigation, route }: Props): React.ReactElement {
  const { copy } = useAudience();
  const locale = useLocale();
  const messages = useMessages();
  const m = messages.caregiver.paywall;
  const offer = lifetimeOffer(locale, m);
  const profile = useProfileStore(activeProfileSelector);
  const cached = useTierStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const entitled = effectiveTier(profile?.id ?? '', new Date());
  const state = paywallState(entitled.tier, entitled.source);
  const [note, setNote] = useState<string | null>(null);
  const name = profile?.displayName ?? m.learnerFallback;
  const from = route.params?.from ?? 'settings';
  void cached; // re-render when the inbox updates the tier

  useEffect(() => {
    void track({ name: 'paywall.viewed', profileId: profile?.id, payload: { state, from } });
  }, [state, from, profile?.id]);

  const openConsole = async (): Promise<void> => {
    const url = consoleBillingUrl();
    void track({ name: 'paywall.console_opened', profileId: profile?.id, payload: { plan: offer.key } });
    try {
      await Linking.openURL(url);
    } catch {
      setNote(m.free.openFailed(url));
    }
  };

  const back = (): void => {
    if (from === 'journey') navigation.navigate('Main', { screen: 'Journey' });
    else navigation.goBack();
  };

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={back} hitSlop={spacing.md} accessibilityRole="button" accessibilityLabel={messages.a11y.goBack} style={{ padding: spacing.xs }}>
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
            {m.covered.title(name, entitled.source?.name ?? m.covered.sourceFallback)}
          </Heading>
          <Spacer size="xs" />
          <Body tone="secondary" align="center">{m.covered.note}</Body>
          <Spacer size="xl" />
          <Button label={m.backToJourney.cta} tone="primary" size="lg" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Journey' })} />
        </>
      ) : state === 'premium' ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <Hoya pose="cheering" size={96} />
          </View>
          <Spacer size="md" />
          <Heading level="title" align="center">{m.premium.title}</Heading>
          <Spacer size="xs" />
          <Body tone="secondary" align="center">{m.premium.note(name)}</Body>
          <Spacer size="xl" />
          <Button label={m.premium.manage.cta} tone="secondary" size="lg" fullWidth onPress={() => void openConsole()} />
          <Spacer size="sm" />
          <Button label={m.backToJourney.cta} tone="primary" size="lg" fullWidth onPress={() => navigation.navigate('Main', { screen: 'Journey' })} />
        </>
      ) : (
        <>
          <HoyaBubble tone="idle" message={m.free.bubble} />
          <Spacer size="lg" />
          <Heading level="prompt">{m.free.unlocks(offer.label)}</Heading>
          <Spacer size="xs" />
          {premiumBullets(m).map((line) => (
            <Body key={line} tone="secondary">
              · {line}
            </Body>
          ))}
          <Spacer size="lg" />
          <View
            accessibilityLabel={messages.a11y.lifetimeOffer(offer.label, offer.price)}
            style={{
              padding: spacing.md,
              borderRadius: radii.lg,
              borderWidth: 2,
              borderColor: colors.brand.primary,
              backgroundColor: colors.brand.primaryLight,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Body weight="semibold">{offer.label}</Body>
              <Body weight="semibold">{offer.price}</Body>
            </View>
            <Caption tone="muted">{offer.line}</Caption>
          </View>
          <Spacer size="lg" />
          <Card padding="md" tone="sunken">
            <Caption tone="secondary">
              {Platform.OS === 'web' ? copy.paywallBuyOnWeb : copy.paywallBuyLater}
            </Caption>
          </Card>
          <Spacer size="md" />
          <Button label={m.free.openConsole.cta} tone="primary" size="lg" fullWidth onPress={() => void openConsole()} />
          {note ? (
            <>
              <Spacer size="xs" />
              <Caption tone="muted" align="center">{note}</Caption>
            </>
          ) : null}
          <Spacer size="md" />
          <Caption tone="muted" align="center">{copy.promoHint}</Caption>
          <Spacer size="xs" />
          <Caption tone="muted" align="center">{m.free.terms}</Caption>
        </>
      )}
      <Spacer size="xl" />
    </Screen>
  );
}
