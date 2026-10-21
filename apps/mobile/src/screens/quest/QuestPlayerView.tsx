import {
  Body,
  Button,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Pill,
  Progress,
  Screen,
  Spacer,
  spacing,
} from '@hangul-route/design-system';
import { useFocusEffect } from '@react-navigation/native';
import type { QuestStepKind } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { questById } from '../../content';
import { useLessonTitlesVersion, useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest } from '../../logic/content-locale';
import { narrativeLine, type NarrativeLine } from '../../logic/korean-labels';
import {
  checkCompletedPayload,
  discoverCompletedPayload,
  launcherView,
  watchCheck,
  type CheckWatch,
} from '../../logic/quest-flow/check-launcher';
import {
  runQuestFinish,
  runQuestLeave,
  runQuestStart,
  type QuestPlayerPorts,
} from '../../logic/quest-flow/quest-player-ports';
import { questStepLabel } from '../../logic/quest-steps';
import { stop } from '../../platform/audio';
import { confirm } from '../../platform/dialog';
import { useQuestRunStore } from '../../store/quest-run-store';
import { LessonWaiting, useLessonQuestReady } from '../lesson-content';
import { useStoryQuestReady } from '../story-content';
import { useRouteBackGuard } from '../use-back-guard';
import { DiscoverStep } from './DiscoverStep';

type QuestMessages = Messages['learner']['quest'];

export interface QuestPlayerViewProps {
  questId: string;
  episodeId: string;
  /** Session, Results, Leave and telemetry (F-BROWSE-001 §4.7): learner or preview. */
  ports: QuestPlayerPorts;
  onOpenGame: (stepIndex: number) => void;
  /** The not-found state's Go back. */
  onBack: () => void;
  /**
   * A back while a step shows asks this instead of the learner's leave sheet: All lessons' preview
   * asks its own Leave this preview question, so the header's Close and the strip's Leave preview
   * ask the same thing (F-BROWSE-001 section 4.8). Absent, the quest's own sheet asks.
   */
  onAskLeave?: () => void;
}

/**
 * The quest player body (F-BROWSE-001 BR-5a): the step header, Discover, the game launcher and the
 * narrative steps, with the run kept in `quest-run-store` (memory only). It reaches no learner store,
 * no navigation stack and no telemetry client of its own: every exit goes through `ports`. Its one
 * navigation coupling is `useFocusEffect` (applying a game's pending advance on re-focus), which the
 * browse stack's own navigation container also provides.
 */
export function QuestPlayerView(props: QuestPlayerViewProps): React.ReactElement {
  // A lesson quest's steps come from its cell's chunk, and a story quest's story from the story's chunk
  // (F-CURR-002 §10): until it is in (a frame or two from the precache), the screen draws only its header (and a
  // calm status line if it takes longer), so the way back is always there.
  const lessonReady = useLessonQuestReady(props.questId);
  const storyReady = useStoryQuestReady(questById(props.questId));
  return lessonReady && storyReady ? <QuestPlayerBody {...props} /> : <LessonWaiting />;
}

function QuestPlayerBody({ questId, episodeId, ports, onOpenGame, onBack, onAskLeave }: QuestPlayerViewProps): React.ReactElement {
  const m = useMessages();
  const q = m.learner.quest;
  const locale = useLocale();
  // A title chunk that arrives late fills its titles in place, so the localized memos key on it too (F-CURR-002 §10).
  const titles = useLessonTitlesVersion();
  const quest = useMemo(() => {
    const source = questById(questId);
    return source && localizeQuest(source, locale);
  }, [questId, locale, titles]);

  const begin = useQuestRunStore((s) => s.beginQuest);
  // One leave question at a time (a second back while the sheet is open is the same question).
  const asking = useRef(false);
  const consumePending = useQuestRunStore((s) => s.consumePendingAdvance);
  const stepIndex = useQuestRunStore((s) => s.stepIndex);

  // Telemetry effects read the latest committed ports (updated after commit, never during render);
  // only `start` / `end` decide when a run begins again.
  const portsRef = useRef(ports);
  useLayoutEffect(() => {
    portsRef.current = ports;
  });
  const { start, end } = ports;

  // Initialize quest run state once per mount (and when the session changes). The ports pick the
  // first step (a resumed story quest opens on its story-read step, F-STORY-004 §3.8) or say that no
  // run may start.
  useEffect(() => runQuestStart({ start, end }, begin, questId, episodeId), [questId, episodeId, start, end, begin]);

  // When we re-focus (e.g., returning from a minigame), apply pending advance
  useFocusEffect(
    useCallback(() => {
      consumePending();
    }, [consumePending]),
  );

  const step = quest?.steps[stepIndex];
  // A new step (or leaving the quest) stops what the last one was saying: a Discover sentence, a game's word.
  useEffect(() => () => stop(), [stepIndex]);

  // `quest.check_completed` rides the step change: the Check ends when the player moves past it
  // (F-QUEST-002 §3.3), so leaving the game and coming back to the launcher never fires it twice.
  const checkWatch = useRef<CheckWatch | null>(null);
  const stepKind = step?.kind;
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
      portsRef.current.track({
        name: 'quest.check_completed',
        payload: checkCompletedPayload(questId, out.completed),
      });
    }
  }, [stepIndex, stepKind, questId]);

  // Honest outcome: a quest with every game skipped is 0 / 0, not 5 / 5.
  // Rounds are scored on the first try; retries ride along for telemetry.
  const finishQuest = (): void => {
    runQuestFinish(useQuestRunStore.getState(), ports);
  };

  // Quit control (wireframe quest/player): one-line confirm, then the run is discarded and the ports
  // take the player back. Progress already saved is untouched.
  const leaveQuest = (): void => {
    runQuestLeave(useQuestRunStore.getState().reset, ports);
  };

  const confirmQuit = (): void => {
    if (asking.current) return;
    asking.current = true;
    void confirm({
      title: q.leave.title,
      message: q.leave.message,
      confirmLabel: q.leave.confirm.cta,
      cancelLabel: q.leave.keep.cta,
      destructive: true,
    }).then((yes) => {
      asking.current = false;
      if (yes) leaveQuest();
    });
  };

  // Close is the route's ScreenHeader (AMENDMENTS-DISPLAY-NAV section 7.1): every back while a step shows (the
  // header's Close, the browser and the phone back through the history bridge, a swipe) asks first, as Close always
  // did; Leave in the sheet runs the ports' leave (a replace or a navigate, never held here), Keep playing stays.
  useRouteBackGuard(() => {
    if (!quest || !step) return false;
    if (onAskLeave) onAskLeave();
    else confirmQuit();
    return true;
  }, !!quest && !!step);

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
        <Button label={q.goBack.cta} tone="secondary" size="md" onPress={onBack} />
      </Screen>
    );
  }

  const discoverDone = (result: { pages: number; heard: number }): void => {
    ports.track({
      name: 'quest.discover_completed',
      payload: discoverCompletedPayload(questId, result),
    });
    advance();
  };

  // A Discover step keeps its header and Continue in view and scrolls only its pages.
  return (
    <Screen tone="canvas" scrollable={step.kind !== 'discover'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
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
          onLaunch={() => onOpenGame(stepIndex)}
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
