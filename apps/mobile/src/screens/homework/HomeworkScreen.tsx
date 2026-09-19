import type { HomeworkAssignment } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Icon,
  Pill,
  Screen,
  Spacer,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { questsAll } from '../../content';
import { assignedByLabel, dueLabel, groupAssignments } from '../../logic/homework/assignment-groups';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

/**
 * Homework list (wireframe homework/list, F-HW-001 §3.4): the assignment
 * queue behind Today's mission. Rows open the quest; nothing here scolds.
 */
export function HomeworkScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));

  const todayKey = new Date().toISOString().slice(0, 10);
  const groups = useMemo(() => groupAssignments(snap?.homework ?? [], todayKey), [snap, todayKey]);
  const hasPlayed = (snap?.quests.length ?? 0) > 0;

  const open = (h: HomeworkAssignment): void =>
    navigation.navigate('QuestPlayer', { questId: h.questId, episodeId: h.episodeId });

  return (
    <Screen tone="canvas" scrollable>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{ alignSelf: 'flex-start', padding: spacing.xs }}
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">Homework</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">Picked by your grown-ups. Hoya sometimes adds a review.</Body>

      <Spacer size="lg" />
      <HoyaBubble
        tone="idle"
        message={
          groups.today.length === 0
            ? 'Nothing waiting today! Want to play a quest anyway?'
            : `You have ${groups.today.length} thing${groups.today.length === 1 ? '' : 's'} to do today.`
        }
      />

      <Spacer size="lg" />
      <Heading level="prompt">Today</Heading>
      <Spacer size="sm" />
      {groups.today.length === 0 ? (
        <Card padding="md" tone="brand">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Hoya pose="cheering" size={56} />
            <View style={{ flex: 1 }}>
              <Body weight="semibold">All clear!</Body>
              <Caption tone="secondary">
                {hasPlayed ? 'Hoya suggests a quick review from Today.' : 'Try your first quest from Today.'}
              </Caption>
            </View>
          </View>
        </Card>
      ) : (
        groups.today.map((h) => <AssignmentRow key={h.id} assignment={h} todayKey={todayKey} onPress={open} />)
      )}

      {groups.upcoming.length > 0 ? (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">Coming up</Heading>
          <Spacer size="sm" />
          {groups.upcoming.map((h) => (
            <AssignmentRow key={h.id} assignment={h} todayKey={todayKey} onPress={open} />
          ))}
        </>
      ) : null}

      <Spacer size="lg" />
      <Heading level="prompt">Recently done</Heading>
      <Spacer size="sm" />
      {groups.done.length === 0 ? (
        <Caption tone="muted">Finished homework shows up here.</Caption>
      ) : (
        groups.done.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => open(h)}
            accessibilityRole="button"
            accessibilityLabel={`Play again: ${questTitle(h.questId)}`}
            style={{ marginBottom: spacing.xs }}
          >
            <Card padding="sm" tone="success">
              <Body size="sm">{questTitle(h.questId)} ✓</Body>
            </Card>
          </Pressable>
        ))
      )}
      <Spacer size="xl" />
    </Screen>
  );
}

function questTitle(questId: string): string {
  return questsAll.find((q) => q.id === questId)?.titleEn ?? 'Quest';
}

function AssignmentRow({
  assignment,
  todayKey,
  onPress,
}: {
  assignment: HomeworkAssignment;
  todayKey: string;
  onPress: (h: HomeworkAssignment) => void;
}): React.ReactElement {
  const title = questTitle(assignment.questId);
  return (
    <Pressable
      onPress={() => onPress(assignment)}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${dueLabel(assignment.targetDate, todayKey)}`}
      style={{ marginBottom: spacing.sm, minHeight: touchTarget.min }}
    >
      <Card padding="md">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
          <Body weight="semibold" style={{ flex: 1 }}>
            {title}
          </Body>
          <Pill tone="nudge" label={assignedByLabel(assignment.assignedBy)} size="sm" />
        </View>
        <Spacer size="xs" />
        <Caption tone="muted">{dueLabel(assignment.targetDate, todayKey)}</Caption>
      </Card>
    </Pressable>
  );
}
