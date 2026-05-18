import {
  Body,
  Button,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Screen,
  Spacer,
  spacing,
} from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import type { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FirstQuestPreview'>;

export function FirstQuestPreviewScreen({ navigation }: Props): React.ReactElement {
  return (
    <Screen tone="canvas" scrollable>
      <View style={{ alignItems: 'center', paddingTop: spacing.xl }}>
        <Hoya pose="cheering" size={120} />
        <Spacer size="md" />
        <Heading level="title" align="center">
          Your first card is waiting.
        </Heading>
      </View>
      <Spacer size="xl" />
      <HoyaBubble
        tone="idle"
        message="In your first quest you'll meet four Korean letters and earn a Heritage card."
      />
      <Spacer size="lg" />
      <Card padding="md">
        <Heading level="prompt">Episode 1 · Meet the Letters</Heading>
        <Spacer size="xs" />
        <Body tone="secondary">3 quests · about 12 minutes total · 5 cards waiting</Body>
        <Spacer size="md" />
        <Body weight="semibold">You&apos;ll learn</Body>
        <Body tone="secondary">ㄱ ㄴ ㄷ ㄹ → g, n, d, l</Body>
      </Card>
      <Spacer size="xl" />
      <Button
        label="Start my journey"
        tone="primary"
        size="hero"
        fullWidth
        onPress={() => {
          navigation.getParent()?.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            }),
          );
        }}
      />
    </Screen>
  );
}
