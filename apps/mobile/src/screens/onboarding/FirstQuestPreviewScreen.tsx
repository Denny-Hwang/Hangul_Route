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
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeEpisode, localizeQuest } from '../../logic/content-locale';
import { firstQuestFor } from '../../logic/onboarding/first-quest';
import type { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FirstQuestPreview'>;

/**
 * Last onboarding step (wireframe onboarding/first-quest-preview): summary is
 * content-driven and the CTA lands *inside* the first quest, with Main tabs
 * reset underneath so results return to Today.
 */
export function FirstQuestPreviewScreen({ navigation }: Props): React.ReactElement {
  const q = useMessages().learner.firstQuest;
  const locale = useLocale();
  const target = useMemo(() => {
    const found = firstQuestFor(episodesAll, questsAll);
    return found && { ...found, episode: localizeEpisode(found.episode, locale), quest: localizeQuest(found.quest, locale) };
  }, [locale]);

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
          {q.title}
        </Heading>
      </View>
      <Spacer size="xl" />
      <HoyaBubble
        tone="idle"
        message={target ? q.bubble : q.bubbleNoQuest}
      />
      {target ? (
        <>
          <Spacer size="lg" />
          <Card padding="md">
            <Heading level="prompt">{target.episode.titleEn}</Heading>
            <Spacer size="xs" />
            <Body tone="secondary">
              {q.summary(target.questCount, target.episode.estimatedMinutes, target.cardCount)}
            </Body>
            <Spacer size="md" />
            <Body weight="semibold">{q.firstUp}</Body>
            <Body tone="secondary">{q.questLine(target.quest.titleEn, target.quest.blurbEn ?? null)}</Body>
          </Card>
        </>
      ) : null}
      <Spacer size="xl" />
      <Button label={q.cta} tone="primary" size="hero" fullWidth onPress={start} />
    </Screen>
  );
}
