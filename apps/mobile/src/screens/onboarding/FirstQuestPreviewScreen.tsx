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
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { episodesAll, questsAll } from '../../content';
import { firstQuestFor } from '../../logic/onboarding/first-quest';
import type { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FirstQuestPreview'>;

/**
 * Last onboarding step (wireframe onboarding/first-quest-preview): summary is
 * content-driven and the CTA lands *inside* the first quest, with Main tabs
 * reset underneath so results return to Today.
 */
export function FirstQuestPreviewScreen({ navigation }: Props): React.ReactElement {
  const target = useMemo(() => firstQuestFor(episodesAll, questsAll), []);

  const start = (): void => {
    const routes = target
      ? [
          { name: 'Main' },
          {
            name: 'QuestPlayer',
            params: { questId: target.quest.id, episodeId: target.episode.id },
          },
        ]
      : [{ name: 'Main' }];
    navigation.getParent()?.dispatch(CommonActions.reset({ index: routes.length - 1, routes }));
  };

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
        message={
          target
            ? `In your first quest you'll meet Korean letters and earn a Heritage card.`
            : 'Let me show you around first!'
        }
      />
      {target ? (
        <>
          <Spacer size="lg" />
          <Card padding="md">
            <Heading level="prompt">{target.episode.titleEn}</Heading>
            <Spacer size="xs" />
            <Body tone="secondary">
              {target.questCount} {target.questCount === 1 ? 'quest' : 'quests'} · about{' '}
              {target.episode.estimatedMinutes} minutes · {target.cardCount}{' '}
              {target.cardCount === 1 ? 'card' : 'cards'} waiting
            </Body>
            <Spacer size="md" />
            <Body weight="semibold">First up</Body>
            <Body tone="secondary">
              {target.quest.titleEn}
              {target.quest.blurbEn ? ` — ${target.quest.blurbEn}` : ''}
            </Body>
          </Card>
        </>
      ) : null}
      <Spacer size="xl" />
      <Button label="Start my journey" tone="primary" size="hero" fullWidth onPress={start} />
    </Screen>
  );
}
