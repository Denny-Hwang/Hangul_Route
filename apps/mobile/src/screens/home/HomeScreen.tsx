import {
  Body,
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
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { episodesAll, questsAll } from '../../content';
import {
  buildTodaysMission,
  dayKey,
  type MissionCard,
  type MissionPlan,
} from '../../logic/homework/mission-builder';
import { computeStreak } from '../../logic/streak';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

const ICON_FOR: Record<MissionCard['kind'], 'replay' | 'play' | 'library' | 'star'> = {
  replay: 'replay',
  new: 'play',
  story: 'library',
  'daily-test': 'star',
};

/**
 * One of the three Today's mission cards (F-HW-001 §3.1).
 * A collected card keeps its slot and switches tone — it never disappears and
 * the cards below it never move up (§3.2).
 */
function MissionTile({
  card,
  onPress,
}: {
  card: MissionCard;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Card
      padding="md"
      tone={card.collected ? 'success' : 'paper'}
      onPress={onPress}
      accessibilityLabel={`${card.titleEn}. ${card.subtitleEn}.${
        card.collected ? ' Collected.' : ''
      }`}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: touchTarget.hero,
        }}
      >
        <Icon name={ICON_FOR[card.kind]} size={32} color={colors.text.secondary} />
        <View style={{ flex: 1 }}>
          <Body weight="semibold" size="lg">
            {card.titleEn}
          </Body>
          <Caption tone="muted">{card.subtitleEn}</Caption>
        </View>
        {card.collected ? <Icon name="sparkle" size={28} color={colors.brand.primary} /> : null}
      </View>
    </Card>
  );
}

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

  // Today's mission — the plan is pinned for the day so finishing one card
  // never reshuffles the other two under the learner (F-HW-001 §3.2).
  const pinnedPlan = useRef<MissionPlan | null>(null);
  const mission = useMemo(() => {
    if (!profile || !snap) return null;
    const built = buildTodaysMission({
      profileId: profile.id,
      snapshot: snap,
      quests: questsAll,
      episodes: episodesAll,
      today: dayKey(new Date().toISOString()),
      pinned: pinnedPlan.current,
    });
    pinnedPlan.current = built;
    return built;
  }, [profile, snap]);

  const openCard = (card: MissionCard): void => {
    if (card.questId && card.episodeId) {
      navigation.navigate('QuestPlayer', { questId: card.questId, episodeId: card.episodeId });
    } else if (card.episodeId) {
      navigation.navigate('EpisodeDetail', { episodeId: card.episodeId });
    }
  };

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

      {mission && mission.cards.length > 0 ? (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">Today with Hoya</Heading>
          <Spacer size="sm" />
          <View style={{ gap: spacing.sm }}>
            {mission.cards.map((card) => (
              <MissionTile key={card.slot} card={card} onPress={() => openCard(card)} />
            ))}
          </View>
        </>
      ) : null}

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
