import {
  Body,
  Caption,
  Card,
  Heading,
  Icon,
  Pill,
  Screen,
  Spacer,
  colors,
  spacing,
} from '@hangul-route/design-system';
import { levelLabel } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, View } from 'react-native';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { useMessages } from '../../i18n/use-messages';
import { questsAll } from '../../content';
import type { RootStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

/** Learner's cub beside the name (F-LEARN-001 §3.6). */
const AVATAR_SIZE = 40;

type Props = NativeStackScreenProps<RootStackParamList, 'ParentDashboard'>;

export function ParentDashboardScreen({ navigation }: Props): React.ReactElement {
  const m = useMessages().caregiver.dashboard;
  const profiles = useProfileStore((s) => s.profiles);
  const byProfile = useProgressStore((s) => s.byProfile);

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.md}>
          <Icon name="arrow-left" size={28} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Heading level="title">{m.title}</Heading>
          <Caption tone="muted">{m.readOnly}</Caption>
        </View>
      </View>

      <Spacer size="lg" />
      {profiles.length === 0 ? (
        <Body>{m.noProfiles}</Body>
      ) : (
        profiles.map((p) => {
          const snap = byProfile[p.id];
          const level = levelLabel(p.ageGroup);
          const completed = snap?.quests.filter((q) => q.completedAt).length ?? 0;
          const cards = snap?.cards.length ?? 0;
          const sessions = snap?.sessions.length ?? 0;
          const sessionMinutes = Math.round(
            ((snap?.sessions ?? []).reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0)) / 60,
          );
          return (
            <Card key={p.id} padding="md" style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <ProfileAvatar avatar={p.avatar} size={AVATAR_SIZE} />
                  <Body weight="bold" size="lg">
                    {p.displayName}
                  </Body>
                </View>
                {level ? <Pill tone="neutral" label={level} size="sm" /> : null}
              </View>
              <Spacer size="sm" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Stat label={m.stats.quests} value={String(completed)} />
                <Stat label={m.stats.cards} value={String(cards)} />
                <Stat label={m.stats.sessions} value={String(sessions)} />
                <Stat label={m.stats.minutes} value={String(sessionMinutes)} />
              </View>
              {snap && snap.quests.length > 0 ? (
                <>
                  <Spacer size="md" />
                  <Caption tone="muted">{m.recent}</Caption>
                  {snap.quests.slice(-3).reverse().map((q) => {
                    const quest = questsAll.find((x) => x.id === q.questId);
                    return (
                      <View
                        key={q.questId + (q.completedAt ?? '')}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingVertical: spacing.xs,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border.subtle,
                        }}
                      >
                        <Body size="sm">{quest?.titleEn ?? q.questId}</Body>
                        <Caption tone="muted">{q.stars}★</Caption>
                      </View>
                    );
                  })}
                </>
              ) : null}
            </Card>
          );
        })
      )}

      <Spacer size="lg" />
      <Card padding="md" tone="sunken">
        <Heading level="prompt">{m.privacy.title}</Heading>
        <Spacer size="xs" />
        <Body size="sm" tone="secondary">
          {m.privacy.body}
        </Body>
      </Card>
      <Spacer size="xl" />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={{ alignItems: 'center' }}>
      <Body weight="bold" size="lg">
        {value}
      </Body>
      <Caption tone="muted">{label}</Caption>
    </View>
  );
}
