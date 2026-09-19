import {
  Body,
  Button,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Icon,
  Pill,
  Progress,
  Screen,
  Spacer,
  spacing,
} from '@hangul-route/design-system';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { questById } from '../../content';
import { questOutcome } from '../../logic/quest-outcome';
import { confirm } from '../../platform/dialog';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useQuestRunStore } from '../../store/quest-run-store';

type Props = NativeStackScreenProps<RootStackParamList, 'QuestPlayer'>;

export function QuestPlayerScreen({ route, navigation }: Props): React.ReactElement {
  const { questId, episodeId } = route.params;
  const quest = questById(questId);
  const profile = useProfileStore(activeProfileSelector);
  const beginSession = useProgressStore((s) => s.beginSession);
  const endSession = useProgressStore((s) => s.endSession);

  const begin = useQuestRunStore((s) => s.beginQuest);
  const consumePending = useQuestRunStore((s) => s.consumePendingAdvance);
  const stepIndex = useQuestRunStore((s) => s.stepIndex);

  // Initialize quest run state once per mount
  useEffect(() => {
    if (!profile) return;
    begin(questId, episodeId);
    beginSession(profile.id);
    return () => endSession(profile.id);
  }, [questId, episodeId, profile, begin, beginSession, endSession]);

  // When we re-focus (e.g., returning from a minigame), apply pending advance
  useFocusEffect(
    useCallback(() => {
      consumePending();
    }, [consumePending]),
  );

  const step = quest?.steps[stepIndex];

  const finishQuest = (): void => {
    // Honest outcome: a quest with every game skipped is 0 / 0, not 5 / 5.
    const run = useQuestRunStore.getState();
    const { stars, correct, total } = questOutcome(run.correctCount, run.totalCount);
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'Main' },
          { name: 'Results', params: { questId, episodeId, stars, correct, total } },
        ],
      }),
    );
  };

  // Quit control (wireframe quest/player): one-line confirm, then back to the
  // episode page with the run discarded. Progress already saved is untouched.
  const leaveQuest = (): void => {
    useQuestRunStore.getState().reset();
    navigation.replace('EpisodeDetail', { episodeId });
  };
  const confirmQuit = (): void => {
    void confirm({
      title: 'Leave this quest?',
      message: 'Stars from this try will not be saved.',
      confirmLabel: 'Leave',
      cancelLabel: 'Keep playing',
      destructive: true,
    }).then((yes) => {
      if (yes) leaveQuest();
    });
  };

  const advance = (): void => {
    if (!quest) return;
    if (stepIndex >= quest.steps.length - 1) {
      finishQuest();
    } else {
      useQuestRunStore.getState().goNextStep();
    }
  };

  if (!quest || !step) {
    return (
      <Screen>
        <Body>Quest not found.</Body>
        <Spacer size="lg" />
        <Button label="Go back" tone="secondary" size="md" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          onPress={confirmQuit}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel="Leave quest"
          style={{ padding: spacing.xs }}
        >
          <Icon name="close" size={24} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Progress value={stepIndex + 1} max={quest.steps.length} tone="primary" variant="dots" />
        </View>
        <Pill tone="neutral" label={`${stepIndex + 1} / ${quest.steps.length}`} size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="title">{step.titleEn}</Heading>
      <Spacer size="xs" />
      <Pill tone="primary" label={step.kind} size="sm" />

      <Spacer size="lg" />
      {step.minigameKind && step.minigameRef ? (
        <MinigameLauncher
          questId={questId}
          episodeId={episodeId}
          stepIndex={stepIndex}
          minigameKind={step.minigameKind}
          minigameRef={step.minigameRef}
          onLaunch={() => navigation.navigate('Minigame', { questId, episodeId, stepIndex })}
          onSkip={advance}
        />
      ) : (
        <NarrativeStepBody
          message={step.hoyaLineEn ?? step.bodyEn ?? "Let's keep going!"}
          onContinue={advance}
          isReward={step.kind === 'reward'}
        />
      )}
    </Screen>
  );
}

function NarrativeStepBody({
  message,
  onContinue,
  isReward,
}: {
  message: string;
  onContinue: () => void;
  isReward: boolean;
}): React.ReactElement {
  return (
    <View style={{ flex: 1 }}>
      <Card padding="lg" tone={isReward ? 'success' : 'brand'}>
        <View style={{ alignItems: 'center' }}>
          <Hoya pose={isReward ? 'cheering' : 'waving'} size={120} />
        </View>
        <Spacer size="md" />
        <HoyaBubble tone={isReward ? 'cheering' : 'idle'} message={message} />
      </Card>
      <View style={{ flex: 1 }} />
      <Button label={isReward ? 'See results' : 'Continue'} tone="primary" size="hero" fullWidth onPress={onContinue} />
      <Spacer size="lg" />
    </View>
  );
}

function MinigameLauncher({
  onLaunch,
  onSkip,
}: {
  questId: string;
  episodeId: string;
  stepIndex: number;
  minigameKind: string;
  minigameRef: string;
  onLaunch: () => void;
  onSkip: () => void;
}): React.ReactElement {
  return (
    <View style={{ flex: 1 }}>
      <Body weight="semibold" size="lg">
        Ready for a quick game?
      </Body>
      <Spacer size="sm" />
      <Body tone="secondary">Tap to play. When the game is done you&apos;ll come right back.</Body>
      <View style={{ flex: 1 }} />
      <Button label="Play minigame" tone="primary" size="hero" fullWidth onPress={onLaunch} />
      <Spacer size="md" />
      <Button label="Skip for now" tone="ghost" size="md" onPress={onSkip} />
      <Spacer size="lg" />
    </View>
  );
}
