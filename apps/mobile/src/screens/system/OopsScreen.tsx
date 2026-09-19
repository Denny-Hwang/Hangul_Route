import { Body, Button, Heading, Hoya, HoyaBubble, Screen, Spacer, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';

/**
 * Top-level crash fallback (App Store readiness: a production JS error must
 * never close the app on a child). Copy stays warm and blame-free; the only
 * action restarts the React tree from the root navigator.
 */
export interface OopsScreenProps {
  onRetry: () => void;
}

export function OopsScreen({ onRetry }: OopsScreenProps): React.ReactElement {
  return (
    <Screen tone="canvas">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
        <Hoya pose="thinking" size={140} />
        <Spacer size="lg" />
        <Heading level="title" align="center">
          Hoya tripped over a rock.
        </Heading>
        <Spacer size="sm" />
        <Body tone="secondary" align="center">
          Your cards and stars are safe. Let&apos;s hop back in.
        </Body>
        <Spacer size="xl" />
        <HoyaBubble tone="thinking" message="Oops! That was not your fault. Tap the button and we go again." />
        <Spacer size="xl" />
        <Button label="Try again" tone="primary" size="hero" fullWidth onPress={onRetry} />
      </View>
    </Screen>
  );
}
