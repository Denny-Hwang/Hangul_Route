import {
  Body,
  Button,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Screen,
  Spacer,
  StarRow,
  spacing,
} from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { episodeById, questById } from '../../content';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export function ResultsScreen({ route, navigation }: Props): React.ReactElement {
  const { questId, episodeId, stars, correct, total } = route.params;
  const quest = questById(questId);
  const episode = episodeById(episodeId);
  const profile = useProfileStore(activeProfileSelector);
  const recordQuestComplete = useProgressStore((s) => s.recordQuestComplete);
  const unlockCard = useProgressStore((s) => s.unlockCard);

  useEffect(() => {
    if (!profile || !quest) return;
    recordQuestComplete(profile.id, {
      questId,
      episodeId,
      stars,
      accuracy: total > 0 ? correct / total : 0,
      attempts: 1,
    });
    if (quest.rewardCardId) {
      unlockCard(profile.id, quest.rewardCardId);
    }
  }, [profile, quest, questId, episodeId, stars, correct, total, recordQuestComplete, unlockCard]);

  const cheerMessage = useMemo(() => {
    if (stars === 3) return 'Perfect! You got every one!';
    if (stars === 2) return 'Nice work! Try one more for three stars.';
    if (stars === 1) return 'Good start. Want to play it again?';
    return 'Brave try! Let&apos;s do it together.';
  }, [stars]);

  return (
    <Screen tone="canvas">
      <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
        <Hoya pose={stars >= 2 ? 'cheering' : 'thinking'} size={140} />
        <Spacer size="lg" />
        <Heading level="display">{stars === 3 ? 'Wonderful!' : stars >= 2 ? 'Great!' : 'You tried!'}</Heading>
        <Spacer size="sm" />
        <StarRow stars={stars} size={48} />
      </View>

      <Spacer size="lg" />
      <HoyaBubble tone={stars >= 2 ? 'cheering' : 'thinking'} message={cheerMessage} />

      {quest?.rewardCardId ? (
        <>
          <Spacer size="lg" />
          <Card padding="md" tone="brand">
            <Body weight="semibold">Card added to your library!</Body>
            <Body tone="secondary" size="sm">
              Visit Library to see all your cards.
            </Body>
          </Card>
        </>
      ) : null}

      <View style={{ flex: 1 }} />
      <Button
        label="Back to journey"
        tone="primary"
        size="hero"
        fullWidth
        onPress={() => {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            }),
          );
        }}
      />
      <Spacer size="sm" />
      {episode ? (
        <Button
          label="Episode page"
          tone="ghost"
          size="md"
          fullWidth
          onPress={() => navigation.navigate('EpisodeDetail', { episodeId: episode.id })}
        />
      ) : null}
      <Spacer size="lg" />
    </Screen>
  );
}
