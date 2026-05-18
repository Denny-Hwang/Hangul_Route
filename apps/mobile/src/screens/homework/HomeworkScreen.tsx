import {
  Body,
  Caption,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Pill,
  Screen,
  Spacer,
  spacing,
} from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { questsAll } from '../../content';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

export function HomeworkScreen(): React.ReactElement {
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));

  const assigned = snap?.homework ?? [];
  const dueToday = assigned.filter((h) => !h.completedAt);
  const done = assigned.filter((h) => h.completedAt);

  // Synthesize a daily review if streak permits — a soft homework nudge
  const dailyReviewSuggestion = (snap?.quests.length ?? 0) > 0;

  return (
    <Screen tone="canvas" scrollable>
      <Heading level="title">Homework</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">Set by your grown-up — or Hoya if you have a streak.</Body>

      <Spacer size="lg" />
      <HoyaBubble
        tone="idle"
        message={
          dueToday.length === 0
            ? 'No homework today! Want to do a quick review?'
            : `You have ${dueToday.length} thing${dueToday.length === 1 ? '' : 's'} to do today.`
        }
      />

      <Spacer size="lg" />
      <Heading level="prompt">Today</Heading>
      <Spacer size="sm" />
      {dueToday.length === 0 ? (
        <Card padding="md" tone="brand">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Hoya pose="cheering" size={56} />
            <View style={{ flex: 1 }}>
              <Body weight="semibold">All clear!</Body>
              <Caption tone="secondary">{dailyReviewSuggestion ? 'Hoya suggests a 3-minute review.' : 'Try your first quest.'}</Caption>
            </View>
          </View>
        </Card>
      ) : (
        dueToday.map((h) => (
          <Card key={h.id} padding="md">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Body weight="semibold">{questsAll.find((q) => q.id === h.questId)?.titleEn ?? 'Quest'}</Body>
              <Pill tone="nudge" label={h.assignedBy} size="sm" />
            </View>
            <Spacer size="xs" />
            <Caption tone="muted">Due {h.dueAt ?? 'today'}</Caption>
          </Card>
        ))
      )}

      <Spacer size="lg" />
      <Heading level="prompt">Recently done</Heading>
      <Spacer size="sm" />
      {done.length === 0 ? (
        <Caption tone="muted">Nothing yet — finish today&apos;s to see them here.</Caption>
      ) : (
        done.map((h) => (
          <Card key={h.id} padding="sm" tone="success">
            <Body size="sm">{questsAll.find((q) => q.id === h.questId)?.titleEn ?? 'Quest'} ✓</Body>
          </Card>
        ))
      )}
      <Spacer size="xl" />
    </Screen>
  );
}
