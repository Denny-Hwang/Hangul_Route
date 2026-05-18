import { Body, Button, Heading, Hoya, Screen, Spacer, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import type { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props): React.ReactElement {
  return (
    <Screen tone="canvas">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Hoya pose="waving" size={180} />
        <Spacer size="xl" />
        <Heading level="display" align="center">
          Hi! I&apos;m Hoya.
        </Heading>
        <Spacer size="md" />
        <Body align="center" tone="secondary" size="lg" style={{ maxWidth: 320 }}>
          Want to learn Korean letters with me? It only takes a few minutes a day.
        </Body>
      </View>

      <View style={{ paddingBottom: spacing.xl, alignItems: 'center', gap: spacing.md }}>
        <Button
          label="Let's start"
          tone="primary"
          size="hero"
          fullWidth
          onPress={() => navigation.navigate('CreateProfile', { firstRun: true })}
        />
        <Body tone="muted" size="sm" align="center" style={{ maxWidth: 280 }}>
          Made for kids 5–11. Built with kids, parents, and grandparents in mind.
        </Body>
      </View>
    </Screen>
  );
}
