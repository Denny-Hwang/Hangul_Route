import { Body, Button, Heading, Hoya, HoyaBubble, Screen, Spacer, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';

/**
 * Top-level crash fallback (App Store readiness: a production JS error must
 * never close the app on a child). Copy stays warm and blame-free; the only
 * action restarts the React tree from the root navigator.
 */
export interface OopsScreenProps {
  onRetry: () => void;
  /** The one action's label; default "Try again". All lessons says "Back to the lesson page" (F-BROWSE-001 section 4.7). */
  actionLabel?: string;
}

export function OopsScreen({ onRetry, actionLabel }: OopsScreenProps): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.oops;
  return (
    <Screen tone="canvas">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
        <Hoya pose="thinking" size={140} />
        <Spacer size="lg" />
        <Heading level="title" align="center">
          {m.title}
        </Heading>
        <Spacer size="sm" />
        <Body tone="secondary" align="center">
          {m.body}
        </Body>
        <Spacer size="xl" />
        <HoyaBubble tone="thinking" message={m.bubble} />
        <Spacer size="xl" />
        <Button label={actionLabel ?? messages.common.buttons.tryAgain} tone="primary" size="hero" fullWidth onPress={onRetry} />
      </View>
    </Screen>
  );
}
