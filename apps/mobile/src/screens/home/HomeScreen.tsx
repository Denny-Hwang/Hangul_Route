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
  Progress,
  Screen,
  Spacer,
  StarRow,
  colors,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { episodesAll, questsAll } from '../../content';
import { computeStreak } from '../../logic/streak';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

export function HomeScreen(): React.ReactElement {
  const profile = useProfileStore(activeProfileSelector);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const ensure = useProgressStore((s) => s.ensure);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));

  useEffect(() => {
    if (profile) ensure(profile.id);
  }, [profile, ensure]);

  const stars3 = (snap?.quests.filter((q) => q.stars === 3).length ?? 0);
  const completed = snap?.quests.filter((q) => q.completedAt).length ?? 0;
  const totalStage1Quests = questsAll.length;
  const cardsUnlocked = snap?.cards.length ?? 0;
  const homeworkDue = snap?.homework?.filter((h) => !h.completedAt).length ?? 0;

  const streak = useMemo(() => {
    const dates = snap?.sessions.map((s) => s.startedAt) ?? [];
    return computeStreak(dates);
  }, [snap]);

  // Pick the next unfinished quest
  const nextQuest = useMemo(() => {
    const completedIds = new Set((snap?.quests ?? []).filter((q) => q.completedAt).map((q) => q.questId));
    return questsAll.find((q) => !completedIds.has(q.id)) ?? questsAll[0];
  }, [snap]);

  const nextEpisode = useMemo(() => {
    if (!nextQuest) return undefined;
    return episodesAll.find((e) => e.questIds.includes(nextQuest.id));
  }, [nextQuest]);

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Hoya pose="waving" size={72} />
        <View style={{ flex: 1 }}>
          <Heading level="title">Hi, {profile?.displayName ?? 'friend'}!</Heading>
          <Body tone="secondary">Ready for today&apos;s quest?</Body>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Profiles and settings"
          style={{
            width: touchTarget.min,
            height: touchTarget.min,
            borderRadius: radii.circle,
            borderWidth: 2,
            borderColor: colors.border.subtle,
            backgroundColor: colors.surface.paper,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Hoya pose="idle" size={44} />
        </Pressable>
      </View>

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Pill tone="primary" label={`Streak ${streak} day${streak === 1 ? '' : 's'}`} />
        <Pill tone="secondary" label={`${cardsUnlocked} cards`} />
        <Pill tone="success" label={`${stars3}★ quests`} />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">Today&apos;s quest</Heading>
      <Spacer size="sm" />
      {nextQuest && nextEpisode ? (
        <Card padding="md">
          <Body weight="semibold" size="lg">
            {nextQuest.titleEn}
          </Body>
          {nextQuest.blurbEn ? (
            <>
              <Spacer size="xxs" />
              <Body tone="secondary">{nextQuest.blurbEn}</Body>
            </>
          ) : null}
          <Spacer size="sm" />
          <Body tone="muted" size="sm">
            From {nextEpisode.titleEn} · {nextQuest.estimatedMinutes} min
          </Body>
          <Spacer size="md" />
          <Button
            label="Start quest"
            tone="primary"
            size="lg"
            fullWidth
            onPress={() =>
              navigation.navigate('QuestPlayer', {
                questId: nextQuest.id,
                episodeId: nextEpisode.id,
              })
            }
          />
        </Card>
      ) : (
        <Card padding="md">
          <Body>All Stage 1 quests complete — amazing!</Body>
        </Card>
      )}

      <Spacer size="xl" />
      <Heading level="prompt">Stage 1 progress</Heading>
      <Spacer size="sm" />
      <Progress value={completed} max={totalStage1Quests} tone="primary" label={`${completed} of ${totalStage1Quests} quests`} />

      <Spacer size="xl" />
      <Pressable
        onPress={() => navigation.navigate('Homework')}
        accessibilityRole="button"
        accessibilityLabel="Open homework"
      >
        <Card padding="md" tone="sunken">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Body weight="semibold">Homework</Body>
              <Caption tone="muted">
                {homeworkDue > 0 ? `${homeworkDue} to do today` : 'Reviews from your grown-up'}
              </Caption>
            </View>
            <Icon name="card" size={24} color={colors.text.muted} />
          </View>
        </Card>
      </Pressable>

      <Spacer size="xl" />
      <HoyaBubble
        tone="idle"
        message="Tip — finish today&apos;s quest to keep your streak alive!"
      />
      <Spacer size="lg" />
      <Card padding="md" tone="sunken">
        <Heading level="prompt">Recent stars</Heading>
        <Spacer size="sm" />
        <StarRow stars={(snap?.quests.slice(-1)[0]?.stars ?? 0) as 0 | 1 | 2 | 3} size={28} />
      </Card>
    </Screen>
  );
}
