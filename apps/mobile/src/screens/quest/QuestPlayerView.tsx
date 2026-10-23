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
  touchTarget,
} from '@hangul-route/design-system';
import { useFocusEffect } from '@react-navigation/native';
import type { QuestStepKind } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { questById } from '../../content';
import { useLessonTitlesVersion, useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest } from '../../logic/content-locale';
import type { MinigameScope } from '../../logic/minigame-config';
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
import { handTryAgainToResults, preloadQuestReviews, questReviewChunk, tryAgainWanted, warmupWanted, type QuestReviewChunk } from './quest-reviews';
import { pacingWanted, questPacingChunk, type QuestPacingChunk } from './quest-pacing';

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
  /**
   * The learner whose quest may open with a warm-up and end with Try these again (F-CURR-002 section 4.5, row
   * CM-15), each behind its own switch. Absent (the All lessons preview): neither shows.
   */
  reviewsFor?: string | null;
  /**
   * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 7.2 (row GU-3): one plain line under Hoya's hello (step 1), between
   * Hoya's card and Continue: the guest run's storage-blocked line. Not a live region, read in order.
   */
  introNote?: string;
  /**
   * [GU] Section 6.2: the quest opens its stack (the guest run), so the navigator cannot go back; the header still
   * draws Close, which asks the same leave question as every back.
   */
  ownClose?: boolean;
}

type QuestReviewPlan = NonNullable<Awaited<ReturnType<QuestReviewChunk['planQuestWarmup']>>>;
/** A session outside the six steps: being planned (at most a moment), none, offered, or on screen (Try these again plays on Results). */
type ReviewPhase =
  | { kind: 'none' }
  | { kind: 'deciding' }
  | { kind: 'offer' | 'playing'; chunk: QuestReviewChunk; plan: QuestReviewPlan };
const NO_REVIEW: ReviewPhase = { kind: 'none' };
const DECIDING: ReviewPhase = { kind: 'deciding' };
/** How long the first step waits for a warm-up plan before the quest starts without one. */
export const WARMUP_DECIDE_MS = 1500;
/** How long the reward step holds its buttons for Try these again's plan (so a button never moves under a finger). */
export const TRY_AGAIN_DECIDE_MS = 800;

/**
 * Plans a session once and settles on the first of the plan and the time limit; a plan that comes later is
 * dropped, so a session never opens on a step that has already begun.
 */
function decide(plan: () => Promise<{ chunk: QuestReviewChunk; plan: QuestReviewPlan | null }>, ms: number, set: (phase: ReviewPhase) => void): () => void {
  let settled = false;
  const settle = (phase: ReviewPhase): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    set(phase);
  };
  const timer = setTimeout(() => settle(NO_REVIEW), ms);
  plan().then(
    (out) => settle(out.plan ? { kind: 'offer', chunk: out.chunk, plan: out.plan } : NO_REVIEW),
    () => settle(NO_REVIEW),
  );
  return () => {
    settled = true;
    clearTimeout(timer);
  };
}

/**
 * The quest player body (F-BROWSE-001 BR-5a): the step header, Discover, the game launcher and the
 * narrative steps, with the run kept in `quest-run-store` (memory only). It reaches no learner store,
 * no navigation stack and no telemetry client of its own: every exit goes through `ports`. Its one
 * navigation coupling is `useFocusEffect` (applying a game's pending advance on re-focus), which the
 * browse stack's own navigation container also provides.
 */
export function QuestPlayerView(props: QuestPlayerViewProps): React.ReactElement {
  // The warm-up and Try these again load while the lesson does (F-CURR-002 row CM-15); with their switches off, nothing.
  const reviewsFor = props.reviewsFor ?? null;
  useEffect(() => preloadQuestReviews(reviewsFor), [reviewsFor]);
  // A lesson quest's steps come from its cell's chunk, and a story quest's story from the story's chunk
  // (F-CURR-002 §10): until it is in (a frame or two from the precache), the screen draws only its header (and a
  // calm status line if it takes longer), so the way back is always there.
  const lessonReady = useLessonQuestReady(props.questId);
  const storyReady = useStoryQuestReady(questById(props.questId));
  return lessonReady && storyReady ? <QuestPlayerBody {...props} /> : <LessonWaiting />;
}

function QuestPlayerBody({ questId, episodeId, ports, onOpenGame, onBack, onAskLeave, reviewsFor = null, introNote, ownClose = false }: QuestPlayerViewProps): React.ReactElement {
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

  // Adaptive pacing (F-CURR-002 section 4.6, row CM-24): a learner's lesson quest with `questAdapt` on loads the pacing
  // chunk as the run begins, which sets the run's pace (a compact second Discover page, a shorter Apply). Off, or before
  // the chunk is in, the quest plays its standard path.
  const [pacing, setPacing] = useState<{ chunk: QuestPacingChunk; plan: ReturnType<QuestPacingChunk['planPacing']> } | null>(null);
  useEffect(() => {
    if (!pacingWanted(reviewsFor, episodeId)) return undefined;
    let live = true;
    questPacingChunk().then(
      (chunk) => {
        if (live) setPacing({ chunk, plan: chunk.planPacing({ profileId: reviewsFor, episodeId, questId, track: (e) => portsRef.current.track(e) }) });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [reviewsFor, episodeId, questId, start, end]);

  // The warm-up (F-CURR-002 section 4.5): before the first step of a Stage 2+ quest, outside the six steps, so the
  // quest's steps, timing and stars are as they always were. Planned once per mount; with nothing due it is skipped.
  const [warmup, setWarmup] = useState<ReviewPhase>(() => (warmupWanted(reviewsFor, episodeId, 0) ? DECIDING : NO_REVIEW));
  const warmupNow = useRef(warmup);
  warmupNow.current = warmup;
  useEffect(() => {
    if (warmupNow.current.kind !== 'deciding' || reviewsFor === null) return undefined;
    // A run that resumes past its first step (a story quest's bookmark) starts as it is.
    if (useQuestRunStore.getState().stepIndex !== 0) {
      setWarmup(NO_REVIEW);
      return undefined;
    }
    return decide(
      async () => {
        const chunk = await questReviewChunk();
        return { chunk, plan: await chunk.planQuestWarmup({ profileId: reviewsFor, episodeId, locale }) };
      },
      WARMUP_DECIDE_MS,
      (phase) => setWarmup(phase.kind === 'offer' ? { ...phase, kind: 'playing' } : phase),
    );
  }, [reviewsFor, episodeId, locale]);

  // When we re-focus (e.g., returning from a minigame), apply pending advance
  useFocusEffect(
    useCallback(() => {
      consumePending();
    }, [consumePending]),
  );

  const step = quest?.steps[stepIndex];

  // Past Practice, once: the chunk notes a strong round for the cell and, after a hard one, gives the scaffold round,
  // played before Apply outside the steps and the score. Before paint, so Apply's card never flashes under it.
  const [scaffold, setScaffold] = useState<MinigameScope | null>(null);
  const practiceAt = quest?.steps.findIndex((s) => s.kind === 'practice') ?? -1;
  const pastPractice = practiceAt >= 0 && stepIndex === practiceAt + 1;
  const practiceRead = useRef(false);
  useLayoutEffect(() => {
    if (!pacing || !pastPractice || practiceRead.current || reviewsFor === null) return;
    practiceRead.current = true;
    setScaffold(pacing.chunk.afterPractice({ profileId: reviewsFor, episodeId, questId, plan: pacing.plan, practiceAt, locale, track: (e) => portsRef.current.track(e) }));
  }, [pacing, pastPractice, practiceAt, reviewsFor, episodeId, questId, locale]);

  // Try these again (F-CURR-002 section 4.5, F-QUEST-002 L13 as amended): on the reward step, the default suggestion
  // when this play had first-try misses; See results stays right under it. Planned once the reward step shows.
  const onReward = !!quest && step?.kind === 'reward' && stepIndex === quest.steps.length - 1;
  const [again, setAgain] = useState<ReviewPhase>(NO_REVIEW);
  useEffect(() => {
    if (!onReward) return undefined;
    const missed = useQuestRunStore.getState().missed;
    if (!tryAgainWanted(reviewsFor, missed.length)) return undefined;
    setAgain(DECIDING);
    return decide(
      async () => {
        const chunk = await questReviewChunk();
        return { chunk, plan: await chunk.planQuestTryAgain({ profileId: reviewsFor, episodeId, missed, locale }) };
      },
      TRY_AGAIN_DECIDE_MS,
      setAgain,
    );
  }, [onReward, reviewsFor, episodeId, locale]);

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
  const askLeave = (): void => {
    if (onAskLeave) onAskLeave();
    else confirmQuit();
  };
  useRouteBackGuard(() => {
    if (!quest || !step) return false;
    askLeave();
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

  if (warmup.kind === 'deciding') return <LessonWaiting />;
  if (warmup.kind === 'playing' && reviewsFor !== null) {
    const { QuestReviewSession } = warmup.chunk;
    return <QuestReviewSession plan={warmup.plan} profileId={reviewsFor} onDone={() => setWarmup(NO_REVIEW)} />;
  }

  if (scaffold && pacing) {
    const { ScaffoldRound } = pacing.chunk;
    return <ScaffoldRound scope={scaffold} onDone={() => setScaffold(null)} />;
  }

  // A Discover step keeps its header and Continue in view and scrolls only its pages.
  return (
    <Screen tone="canvas" scrollable={step.kind !== 'discover'} header={ownClose ? { leading: { kind: 'close', onPress: askLeave } } : undefined}>
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
          compact={pacing?.plan.compact === true}
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
          actions={
            onReward && again.kind === 'deciding' ? (
              <View style={{ minHeight: touchTarget.hero }} testID="quest-try-again-deciding" />
            ) : onReward && again.kind === 'offer' ? (
              <again.chunk.TryAgainOffer
                onTry={() => {
                  // The quest is done: Results writes its score and card first, then plays Try these again over it.
                  if (reviewsFor !== null) handTryAgainToResults({ questId, profileId: reviewsFor, chunk: again.chunk, plan: again.plan });
                  advance();
                }}
                onSeeResults={advance}
              />
            ) : undefined
          }
          note={stepIndex === 0 ? introNote : undefined}
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
  actions,
  note,
}: {
  copy: QuestMessages;
  line: NarrativeLine;
  onContinue: () => void;
  isReward: boolean;
  /** In place of the step's own button: the reward step's Try these again, offered or being planned (F-CURR-002 row CM-15). */
  actions?: React.ReactNode;
  /** [GU] A plain line between Hoya's card and Continue (the guest run's storage-blocked line, section 7.2). */
  note?: string;
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
      {note !== undefined ? (
        <>
          <Spacer size="md" />
          <Body tone="secondary" testID="quest-intro-note">
            {note}
          </Body>
        </>
      ) : null}
      <View style={{ flex: 1 }} />
      {actions ?? <Button label={isReward ? copy.seeResults.cta : copy.continue.cta} tone="primary" size="hero" fullWidth onPress={onContinue} />}
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
