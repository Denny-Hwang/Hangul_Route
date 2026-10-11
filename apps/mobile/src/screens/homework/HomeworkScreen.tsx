import type { HomeworkAssignment, UiLocale } from '@hangul-route/content-schema';
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
  colors,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { questsAll } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest } from '../../logic/content-locale';
import { assignedByLabel, dueLabel, groupAssignments, homeworkWindow } from '../../logic/homework/assignment-groups';
import type { RootStackParamList } from '../../navigation/types';
import { useAudience } from '../../store/audience';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

/**
 * Homework list (wireframe homework/list, F-HW-001 §3.4): the assignment
 * queue behind Today's mission. Rows open the quest; nothing here scolds.
 * The week window (F-PLAN-002 section 3.6, wireframe console/curriculum-planner
 * H): at most three Today rows and one neutral line when more are due, the
 * next seven days of Coming up, then one collapsed "later" row.
 */
export function HomeworkScreen(): React.ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const m = messages.learner.homework;
  const { copy } = useAudience();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));

  const todayKey = new Date().toISOString().slice(0, 10);
  const groups = useMemo(() => groupAssignments(snap?.homework ?? [], todayKey), [snap, todayKey]);
  const view = useMemo(() => homeworkWindow(groups, todayKey), [groups, todayKey]);
  const [laterOpen, setLaterOpen] = useState(false);
  const hasPlayed = (snap?.quests.length ?? 0) > 0;

  const open = (h: HomeworkAssignment): void =>
    navigation.navigate('QuestPlayer', { questId: h.questId, episodeId: h.episodeId });

  return (
    <Screen tone="canvas" scrollable>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel={messages.a11y.goBack}
        style={{ alignSelf: 'flex-start', padding: spacing.xs }}
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">{m.title}</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">{copy.homeworkIntro}</Body>

      <Spacer size="lg" />
      <HoyaBubble
        tone="idle"
        message={
          groups.today.length === 0 ? m.bubble.none : m.bubble.some(groups.today.length)
        }
      />

      <Spacer size="lg" />
      <Heading level="prompt">{m.section.today}</Heading>
      <Spacer size="sm" />
      {groups.today.length === 0 ? (
        <Card padding="md" tone="brand">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Hoya pose="cheering" size={56} accessibilityLabel={messages.a11y.hoya('cheering')} />
            <View style={{ flex: 1 }}>
              <Body weight="semibold">{m.allClear.title}</Body>
              <Caption tone="secondary">
                {hasPlayed ? m.allClear.played : m.allClear.fresh}
              </Caption>
            </View>
          </View>
        </Card>
      ) : (
        view.today.map((h) => <AssignmentRow key={h.id} assignment={h} todayKey={todayKey} onPress={open} />)
      )}
      {view.moreToday ? (
        <Caption tone="secondary" testID="homework-more-today">
          {m.moreToday}
        </Caption>
      ) : null}

      {groups.upcoming.length > 0 ? (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">{m.section.comingUp}</Heading>
          <Spacer size="sm" />
          {view.comingUp.map((h) => (
            <AssignmentRow key={h.id} assignment={h} todayKey={todayKey} onPress={open} />
          ))}
          {view.later.length > 0 ? (
            <>
              <Pressable
                onPress={() => setLaterOpen((wasOpen) => !wasOpen)}
                accessibilityRole="button"
                aria-expanded={laterOpen}
                testID="homework-later"
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget.min }}
              >
                <Icon name={laterOpen ? 'close' : 'plus'} size={spacing.xl} color={colors.text.secondary} />
                <Body size="sm" style={{ flex: 1 }}>
                  {m.later}
                </Body>
              </Pressable>
              {laterOpen
                ? view.later.map((h) => <AssignmentRow key={h.id} assignment={h} todayKey={todayKey} onPress={open} />)
                : null}
            </>
          ) : null}
        </>
      ) : null}

      <Spacer size="lg" />
      <Heading level="prompt">{m.section.recentlyDone}</Heading>
      <Spacer size="sm" />
      {groups.done.length === 0 ? (
        <Caption tone="muted">{m.doneEmpty}</Caption>
      ) : (
        groups.done.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => open(h)}
            accessibilityRole="button"
            accessibilityLabel={messages.a11y.playAgainQuest(questTitle(h.questId, m.questFallback, locale))}
            style={{ marginBottom: spacing.xs }}
          >
            <Card padding="sm" tone="success">
              <Body size="sm">{questTitle(h.questId, m.questFallback, locale)} ✓</Body>
            </Card>
          </Pressable>
        ))
      )}
      <Spacer size="xl" />
    </Screen>
  );
}

function questTitle(questId: string, fallback: string, locale: UiLocale): string {
  const quest = questsAll.find((q) => q.id === questId);
  return quest ? localizeQuest(quest, locale).titleEn : fallback;
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
  const messages = useMessages();
  const locale = useLocale();
  const m = messages.learner.homework;
  const title = questTitle(assignment.questId, m.questFallback, locale);
  const due = dueLabel(assignment.targetDate, todayKey, m.due);
  return (
    <Pressable
      onPress={() => onPress(assignment)}
      accessibilityRole="button"
      accessibilityLabel={messages.a11y.homeworkRow(title, due)}
      style={{ marginBottom: spacing.sm, minHeight: touchTarget.min }}
    >
      <Card padding="md">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
          <Body weight="semibold" style={{ flex: 1 }}>
            {title}
          </Body>
          <Pill tone="nudge" label={assignedByLabel(assignment, m.from)} size="sm" />
        </View>
        <Spacer size="xs" />
        <Caption tone="muted">{due}</Caption>
      </Card>
    </Pressable>
  );
}
