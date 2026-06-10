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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, View } from 'react-native';
import { questsAll } from '../../content';
import type { RootStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentDashboard'>;

export function ParentDashboardScreen({ navigation }: Props): React.ReactElement {
  const profiles = useProfileStore((s) => s.profiles);
  const byProfile = useProgressStore((s) => s.byProfile);

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.md}>
          <Icon name="arrow-left" size={28} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Heading level="title">Family Dashboard</Heading>
          <Caption tone="muted">Read-only — data stays on this device.</Caption>
        </View>
      </View>

      <Spacer size="lg" />
      {profiles.length === 0 ? (
        <Body>No profiles yet.</Body>
      ) : (
        profiles.map((p) => {
          const snap = byProfile[p.id];
          const completed = snap?.quests.filter((q) => q.completedAt).length ?? 0;
          const cards = snap?.cards.length ?? 0;
          const sessions = snap?.sessions.length ?? 0;
          const sessionMinutes = Math.round(
            ((snap?.sessions ?? []).reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0)) / 60,
          );
          return (
            <Card key={p.id} padding="md" style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Body weight="bold" size="lg">
                  {p.displayName}
                </Body>
                <Pill tone="neutral" label={`Age ${p.ageGroup}`} size="sm" />
              </View>
              <Spacer size="sm" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Stat label="Quests" value={String(completed)} />
                <Stat label="Cards" value={String(cards)} />
                <Stat label="Sessions" value={String(sessions)} />
                <Stat label="Minutes" value={String(sessionMinutes)} />
              </View>
              {snap && snap.quests.length > 0 ? (
                <>
                  <Spacer size="md" />
                  <Caption tone="muted">Recent</Caption>
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
        <Heading level="prompt">Privacy</Heading>
        <Spacer size="xs" />
        <Body size="sm" tone="secondary">
          All learning data stays on this device unless you sign in. We do not share with third parties.
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
