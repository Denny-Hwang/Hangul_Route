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
  useLayoutClass,
} from '@hangul-route/design-system';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import type { QuestStepKind } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { questById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest } from '../../logic/content-locale';
import { narrativeLine, type NarrativeLine } from '../../logic/korean-labels';
import { episodeReturn } from '../../logic/layout/quest-return';
import { questOutcome } from '../../logic/quest-outcome';
import {
  checkCompletedPayload,
  discoverCompletedPayload,
  launcherView,
  watchCheck,
  type CheckWatch,
} from '../../logic/quest-flow/check-launcher';
import { questStepLabel } from '../../logic/quest-steps';
import { confirm } from '../../platform/dialog';
import { track } from '../../platform/telemetry';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useQuestRunStore } from '../../store/quest-run-store';
import { DiscoverStep } from './DiscoverStep';

type Props = NativeStackScreenProps<RootStackParamList, 'QuestPlayer'>;

type QuestMessages = Messages['learner']['quest'];

export function QuestPlayerScreen({ route, navigation }: Props): React.ReactElement {
  const m = useMessages();
  const q = m.learner.quest;
  const { questId, episodeId } = route.params;
  const locale = useLocale();
  const quest = useMemo(() => {
    const source = questById(questId);
    return source && localizeQuest(source, locale);
  }, [questId, locale]);
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

  // `quest.check_completed` rides the step change: the Check ends when the player moves past it
  // (F-QUEST-002 §3.3), so leaving the game and coming back to the launcher never fires it twice.
  const checkWatch = useRef<CheckWatch | null>(null);
  const stepKind = step?.kind;
  const profileId = profile?.id;
  useEffect(() => {
    const run = useQuestRunStore.getState();
    const out = watchCheck(checkWatch.current, {
      stepIndex,
      kind: stepKind,
      correct: run.correctCount,
      retries: run.retryCount,
    });
    checkWatch.current = out.watch;
    if (out.completed) {
      void track({
        name: 'quest.check_completed',
        profileId,
        payload: checkCompletedPayload(questId, out.completed),
      });
    }
  }, [stepIndex, stepKind, questId, profileId]);

  const finishQuest = (): void => {
    // Honest outcome: a quest with every game skipped is 0 / 0, not 5 / 5.
    // Rounds are scored on the first try; retries ride along for telemetry.
    const run = useQuestRunStore.getState();
    const { stars, correct, total } = questOutcome(run.correctCount, run.totalCount);
    const retries = run.retryCount;
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'Main' },
          { name: 'Results', params: { questId, episodeId, stars, correct, total, retries } },
        ],
      }),
    );
  };

  // Quit control (wireframe quest/player): one-line confirm, then back to the
  // episode page with the run discarded. Progress already saved is untouched.
  // Two panes: back to the Journey with this episode selected in its pane (F-LAYOUT-001 §3.7), unless
  // the quest was opened from another screen (Homework, an episode page), which stays under it.
  const { panes } = useLayoutClass();
  const leaveQuest = (): void => {
    useQuestRunStore.getState().reset();
    const state = navigation.getState();
    const back = episodeReturn(panes, episodeId, state.routes[state.index - 1]?.name);
    if (back.to === 'journeyPane') navigation.navigate('Main', { screen: 'Journey', params: { episodeId: back.episodeId } });
    else navigation.replace('EpisodeDetail', { episodeId: back.episodeId });
  };
  const confirmQuit = (): void => {
    void confirm({
      title: q.leave.title,
      message: q.leave.message,
      confirmLabel: q.leave.confirm.cta,
      cancelLabel: q.leave.keep.cta,
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
        <Body>{q.notFound}</Body>
        <Spacer size="lg" />
        <Button label={q.goBack.cta} tone="secondary" size="md" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const discoverDone = (result: { pages: number; heard: number }): void => {
    void track({
      name: 'quest.discover_completed',
      profileId,
      payload: discoverCompletedPayload(questId, result),
    });
    advance();
  };

  // A Discover step keeps its header and Continue in view and scrolls only its pages.
  return (
    <Screen tone="canvas" scrollable={step.kind !== 'discover'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          onPress={confirmQuit}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel={m.a11y.leaveQuest}
          style={{ padding: spacing.xs }}
        >
          <Icon name="close" size={24} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Progress value={stepIndex + 1} max={quest.steps.length} tone="primary" variant="dots" />
        </View>
        <Pill tone="neutral" label={q.progress(stepIndex + 1, quest.steps.length)} size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="title">{step.titleEn}</Heading>
      <Spacer size="xs" />
      <Pill tone="primary" label={questStepLabel(step.kind, q.step)} size="sm" />

      <Spacer size="lg" />
      {step.kind === 'discover' && step.discover ? (
        <DiscoverStep
          key={step.id}
          pages={step.discover.pages}
          hoyaLine={step.hoyaLineEn}
          onDone={discoverDone}
        />
      ) : step.minigameKind && step.minigameRef ? (
        <MinigameLauncher
          copy={q}
          kind={step.kind}
          onLaunch={() => navigation.navigate('Minigame', { questId, episodeId, stepIndex })}
          onSkip={advance}
        />
      ) : (
        <NarrativeStepBody
          copy={q}
          line={narrativeLine(step, q.keepGoing)}
          onContinue={advance}
          isReward={step.kind === 'reward'}
        />
      )}
    </Screen>
  );
}

function NarrativeStepBody({
  copy,
  line,
  onContinue,
  isReward,
}: {
  copy: QuestMessages;
  line: NarrativeLine;
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
        <HoyaBubble
          tone={isReward ? 'cheering' : 'idle'}
          message={line.message}
          korean={line.korean}
          romanization={line.romanization}
        />
        {line.glossEn ? (
          <>
            <Spacer size="sm" />
            <Body tone="secondary">{line.glossEn}</Body>
          </>
        ) : null}
      </Card>
      <View style={{ flex: 1 }} />
      <Button label={isReward ? copy.seeResults.cta : copy.continue.cta} tone="primary" size="hero" fullWidth onPress={onContinue} />
      <Spacer size="lg" />
    </View>
  );
}

function MinigameLauncher({
  copy,
  kind,
  onLaunch,
  onSkip,
}: {
  copy: QuestMessages;
  kind: QuestStepKind;
  onLaunch: () => void;
  onSkip: () => void;
}): React.ReactElement {
  const view = launcherView(kind, copy.launcher);
  return (
    <View style={{ flex: 1 }}>
      {view.hoya ? (
        <HoyaBubble tone="idle" message={view.heading} />
      ) : (
        <Body weight="semibold" size="lg">
          {view.heading}
        </Body>
      )}
      {view.body ? (
        <>
          <Spacer size="sm" />
          <Body tone="secondary">{view.body}</Body>
        </>
      ) : null}
      <View style={{ flex: 1 }} />
      <Button label={view.primaryLabel} tone="primary" size="hero" fullWidth onPress={onLaunch} />
      {view.showSkip ? (
        <>
          <Spacer size="md" />
          <Button label={view.skipLabel} tone="ghost" size="md" onPress={onSkip} />
        </>
      ) : null}
      <Spacer size="lg" />
    </View>
  );
}
