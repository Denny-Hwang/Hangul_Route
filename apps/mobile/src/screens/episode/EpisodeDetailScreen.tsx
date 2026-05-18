import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Icon,
  Pill,
  Screen,
  Spacer,
  StarRow,
  colors,
  radii,
  spacing,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { cardById, episodeById, questsAll, stageByKey, themeByKey } from '../../content';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

type Props = NativeStackScreenProps<RootStackParamList, 'EpisodeDetail'>;

export function EpisodeDetailScreen({ route, navigation }: Props): React.ReactElement {
  const episode = episodeById(route.params.episodeId);
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));

  const questProgress = useMemo(() => {
    if (!episode || !snap) return new Map<string, number>();
    return new Map(snap.quests.filter((q) => q.episodeId === episode.id).map((q) => [q.questId, q.stars]));
  }, [episode, snap]);

  if (!episode) {
    return (
      <Screen>
        <Body>Episode not found.</Body>
      </Screen>
    );
  }

  const stage = stageByKey(episode.stage);
  const theme = themeByKey(episode.theme);
  const stageColor = colors.stage[episode.stage];
  const quests = episode.questIds.map((id) => questsAll.find((q) => q.id === id)).filter((q): q is NonNullable<typeof q> => Boolean(q));
  const isPreview = episode.status === 'preview';

  return (
    <Screen tone="canvas" scrollable>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={spacing.md}
        accessibilityLabel="Go back"
        style={{ alignSelf: 'flex-start', padding: spacing.xs }}
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pill tone="primary" label={stage?.titleEn ?? ''} size="sm" />
        <Pill tone="secondary" label={theme?.titleEn ?? ''} size="sm" />
        {isPreview ? <Pill tone="neutral" label="Coming soon" size="sm" /> : null}
      </View>

      <Spacer size="md" />
      <Heading level="display" style={{ color: stageColor }}>
        {episode.titleEn}
      </Heading>
      {episode.subtitleEn ? (
        <>
          <Spacer size="xs" />
          <Body tone="secondary">{episode.subtitleEn}</Body>
        </>
      ) : null}

      <Spacer size="lg" />
      <HoyaBubble tone="idle" message={episode.hoyaIntroEn} />

      {isPreview ? (
        <>
          <Spacer size="xl" />
          <Card padding="md" tone="sunken">
            <View style={{ alignItems: 'center' }}>
              <Hoya pose="reading" size={96} />
              <Spacer size="md" />
              <Body weight="semibold">Coming soon</Body>
              <Caption tone="muted" align="center">
                Finish Stage 1 to help Hoya unlock this episode.
              </Caption>
            </View>
          </Card>
        </>
      ) : (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">Quests</Heading>
          <Spacer size="sm" />
          {quests.map((q, i) => {
            const stars = questProgress.get(q.id) ?? 0;
            return (
              <Card key={q.id} padding="md" style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radii.circle,
                      backgroundColor: stars > 0 ? colors.feedback.successLight : colors.surface.sunken,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Body weight="bold">{i + 1}</Body>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body weight="semibold">{q.titleEn}</Body>
                    {q.blurbEn ? <Caption tone="muted">{q.blurbEn}</Caption> : null}
                    <Spacer size="xs" />
                    <StarRow stars={stars as 0 | 1 | 2 | 3} size={18} />
                  </View>
                </View>
                <Spacer size="md" />
                <Button
                  label={stars > 0 ? 'Play again' : 'Start'}
                  tone={stars > 0 ? 'secondary' : 'primary'}
                  size="md"
                  fullWidth
                  onPress={() =>
                    navigation.navigate('QuestPlayer', {
                      questId: q.id,
                      episodeId: episode.id,
                    })
                  }
                />
              </Card>
            );
          })}

          <Spacer size="lg" />
          <Heading level="prompt">Cards in this episode</Heading>
          <Spacer size="sm" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {episode.rewardCardIds.map((cid) => {
              const c = cardById(cid);
              if (!c) return null;
              return (
                <View
                  key={cid}
                  style={{
                    flexBasis: '47%',
                    padding: spacing.md,
                    backgroundColor: colors.surface.paper,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border.subtle,
                  }}
                >
                  <Body weight="semibold">{c.titleEn}</Body>
                  {c.subtitleKo ? <Caption tone="brand">{c.subtitleKo}</Caption> : null}
                  <Pill tone="neutral" size="sm" label={c.rarity} />
                </View>
              );
            })}
          </View>
        </>
      )}
      <Spacer size="xxl" />
    </Screen>
  );
}
