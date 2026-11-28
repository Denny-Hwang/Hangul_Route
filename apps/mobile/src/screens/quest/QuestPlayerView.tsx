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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import { questById } from '../../content';
import { useLessonTitlesVersion, useLocale, useMessages } from '../../i18n/use-messages';
import { useReadingNotice } from '../../i18n/use-romanization-mode';
import { localizeQuest } from '../../logic/content-locale';
import { scopeFor, type MinigameScope } from '../../logic/minigame-config';
import { narrativeLine, type NarrativeLine } from '../../logic/korean-labels';
import { cardWaits } from '../../logic/reward';
import {
  checkCompletedPayload,
  discoverCompletedPayload,
  launcherView,
  watchCheck,
  type CheckWatch,
} from '../../logic/quest-flow/check-launcher';
import {
  questFinish,
  runQuestFinish,
  runQuestLeave,
  runQuestStart,
  type QuestPlayerPorts,
} from '../../logic/quest-flow/quest-player-ports';
import type { TracePadPlan } from '../../logic/stage1/trace-pad-layout';
import { questStepLabel } from '../../logic/quest-steps';
import { CONTRAST_APPROVED_SET_IDS } from '../../content/__generated__/contrast-approved';
import { contrastStepVerdict, passByDirection, passesAtOnce, type ContrastVerdict } from '../../logic/quest-flow/contrast-pass';
import { hasClipFor, stop } from '../../platform/audio';
import { confirm } from '../../platform/dialog';
import { useQuestRunStore } from '../../store/quest-run-store';
import { LaterNeedsInternet, LessonWaiting, combinedChunkState, useLessonQuestState } from '../lesson-content';
import { useStoryQuestState } from '../story-content';
import { useRouteBackGuard } from '../use-back-guard';
import { DiscoverStep } from './DiscoverStep';
import { PREVIOUS_TEST_ID, StepActions } from './StepActions';
import { CultureTip } from './culture-tip-entry';
import { useQuestCardLines } from './reward-card-note';
import { handTryAgainToResults, preloadQuestReviews, questReviewChunk, tryAgainWanted, warmupWanted, type QuestReviewChunk } from './quest-reviews';
import { pacingWanted, questPacingChunk, type QuestPacingChunk } from './quest-pacing';
import { useLessonClips, waitForClipPacks } from '../../platform/audio-assets-store';
import { useAudioStore } from '../../store/audio-store';
import { loadContrastKit } from '../minigames/contrast-entry';

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
  /**
   * [AU] AMENDMENTS-AUDIT-2026-11 row AU-10: a Look and learn page says its first letter once as it opens. The learner's
   * and the guest's player set it; absent (the All lessons preview), a page stays quiet until a tap.
   */
  autoHear?: boolean;
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
 * narrative steps, with the run kept in `quest-run-store` (memory). The device copy of the run (per profile, 24
 * hours, AU-12: `store/quest-run-saved.ts`, read by Home's hero, LR-2) is the screen's: this body writes none of it
 * (the ports clear it on Leave and on a finish). It reaches no learner store,
 * no navigation stack and no telemetry client of its own: every exit goes through `ports`. Its one
 * navigation coupling is `useFocusEffect` (applying a game's pending advance on re-focus), which the
 * browse stack's own navigation container also provides.
 */
export function QuestPlayerView(props: QuestPlayerViewProps): ReactElement {
  // This lesson's and the next one's clip packs and clips (AMENDMENTS-AUDIO-CLIPS AC-B6): heard offline once opened.
  useLessonClips(props.questId, props.episodeId);
  // The warm-up and Try these again load while the lesson does (F-CURR-002 row CM-15); with their switches off, nothing.
  const reviewsFor = props.reviewsFor ?? null;
  useEffect(() => preloadQuestReviews(reviewsFor), [reviewsFor]);
  // A lesson quest's steps come from its cell's chunk, and a story quest's story from the story's chunk
  // (F-CURR-002 §10): until it is in (a frame or two from the precache), the screen draws only its header (and a
  // calm status line if it takes longer), so the way back is always there.
  // A later volume that is not on the device and cannot load (row CM-5B) says so calmly, with a way back.
  const state = combinedChunkState(useLessonQuestState(props.questId), useStoryQuestState(questById(props.questId)));
  if (state === 'needs-internet') return <LaterNeedsInternet onBack={props.onBack} />;
  return state === 'ready' ? <QuestPlayerBody {...props} /> : <LessonWaiting />;
}

function QuestPlayerBody({ questId, episodeId, ports, onOpenGame, onBack, onAskLeave, reviewsFor = null, introNote, ownClose = false, autoHear = false }: QuestPlayerViewProps): ReactElement {
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
  // [QB] AMENDMENTS-QUEST-SOUND-BACK QB-2: Previous shows the step before. The run keeps the furthest step it reached,
  // so a step behind it is a revisit (a step shown again), and `cameBack` says the step on screen was reached by Previous.
  const furthestStep = useQuestRunStore((s) => s.furthestStep);
  const cameBack = useQuestRunStore((s) => s.cameBack);
  const revisit = stepIndex < furthestStep;

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

  // [RF] Hoya's one-time reading line (AMENDMENTS-ROMANIZATION-FADE section 3.9): decided once for the run, on its first
  // step, and held (so marking it shown never takes it off the screen, and Previous back to Hello shows it again). Only the
  // learner's player passes `reviewsFor`; a guest and the All lessons preview never get it.
  // The run has begun once the store holds this quest (before that the first render shows step 0 whatever step the run opens on).
  const runBegun = useQuestRunStore((s) => s.questId === questId);
  const readingNotice = useReadingNotice(reviewsFor, questId, runBegun && stepIndex === 0);

  // [MP] AMENDMENTS-MINIMAL-PAIRS section 3.6 (row MP-2b): a contrast step decides, each time it is entered, whether it has rounds
  // to play. With none of its sets approved (`CONTRAST_APPROVED_SET_IDS`, a few bytes of the start bundle; empty until the owner
  // approves a set) it is passed by at once, before paint, with no clip wait and no chunk: no frame of it is ever drawn. With an
  // approved set it waits for the clip packs, loads the contrast chunk and asks it with the device as it is now. Passed by, the
  // player moves on the way the learner was going, as if the step were done (no screen, no `minigame.finished`, not in
  // `skippedSteps`; its dot fills as the run passes it). The verdict resets on leaving the step, so a step entered again decides again.
  const contrastRef = step?.contrast === true ? (step.minigameRef ?? '') : undefined;
  const contrastAtOnce = contrastRef !== undefined && passesAtOnce(scopeFor(contrastRef)?.listenPick?.rounds ?? [], CONTRAST_APPROVED_SET_IDS);
  const [contrastVerdict, setContrastVerdict] = useState<ContrastVerdict | null>(null);
  const passBy = (): void => {
    const run = useQuestRunStore.getState();
    if (passByDirection(run.cameBack) === 'prev') run.goPrevStep();
    else run.goNextStep();
  };
  useLayoutEffect(() => {
    if (contrastAtOnce) passBy();
  }, [stepIndex, contrastAtOnce]);
  useEffect(() => {
    if (contrastRef === undefined || contrastAtOnce) return undefined;
    let live = true;
    const rounds = scopeFor(contrastRef)?.listenPick?.rounds ?? [];
    void contrastStepVerdict(rounds, {
      waitForPacks: () => waitForClipPacks(),
      loadKit: () => loadContrastKit(),
      env: () => ({
        // The clip of a contrast member is its own ref and nothing else (`clipOnly`), asked as the game asks.
        hasClip: (ref) => hasClipFor({ text: '', audioRef: ref, clipOnly: true }),
        soundOn: !useAudioStore.getState().muted,
        alwaysShowLetters: useAudioStore.getState().showLetters,
        host: 'quest',
      }),
    }).then((verdict) => {
      if (!live) return;
      if (verdict === 'play') setContrastVerdict('play');
      else passBy();
    });
    return () => {
      live = false;
      setContrastVerdict(null);
    };
  }, [stepIndex, contrastRef, contrastAtOnce]);

  // Past Practice, once: the chunk notes a strong round for the cell and, after a hard one, gives the scaffold round,
  // played before Apply outside the steps and the score. Before paint, so Apply's card never flashes under it. The
  // trigger is Apply (`applyAt`), not the step after Practice: a contrast step between the two does not move it (MP-2b).
  const [scaffold, setScaffold] = useState<MinigameScope | null>(null);
  // [TC] The trace page's arrangement while it shows (the Discover step reports it); null on every other page and step.
  const [trace, setTrace] = useState<TracePadPlan | null>(null);
  const onPageKind = useCallback((kind: 'cards' | 'trace', plan: TracePadPlan | null): void => {
    setTrace((prev) => {
      const next = kind === 'trace' ? plan : null;
      return prev?.arrangement === next?.arrangement && prev?.canvasSlot === next?.canvasSlot ? prev : next;
    });
  }, []);
  const practiceAt = quest?.steps.findIndex((s) => s.kind === 'practice' && s.contrast !== true) ?? -1;
  const applyAt = quest?.steps.findIndex((s) => s.kind === 'apply') ?? -1;
  const pastPractice = practiceAt >= 0 && applyAt > practiceAt && stepIndex === applyAt;
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
  // The quest's own card is earned at 2 stars and kept for later under that (F-STORY-006 §3.1, F-MOTION-003 §3.5): on the
  // reward step the card lines say what this run did, so "joins your library" is never said of a card the run did not earn.
  // The All lessons preview has no `ownsCard` and keeps the authored lines.
  const runCorrect = useQuestRunStore((s) => s.correctCount);
  const runTotal = useQuestRunStore((s) => s.totalCount);
  // [AU] A skipped game caps the run's stars (AMENDMENTS-AUDIT-2026-11 row AU-9), so the card lines read the same outcome Results will.
  const runSkipped = useQuestRunStore((s) => s.skippedSteps);
  const runOutcome = questFinish({ correctCount: runCorrect, totalCount: runTotal, retryCount: 0, skippedSteps: runSkipped }, quest?.steps);
  const rewardCardId = quest?.rewardCardId;
  const cardLines = useQuestCardLines(
    questId,
    onReward &&
      !!ports.ownsCard &&
      cardWaits({
        rewardCardId,
        stars: runOutcome.stars,
        held: !!rewardCardId && ports.ownsCard(rewardCardId),
        played: runOutcome.played,
        episodeCompletes: ports.completesEpisode?.(episodeId, questId) ?? false,
      }),
  );
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
      furthestStep: run.furthestStep,
    });
    const checkAt = checkWatch.current?.index;
    checkWatch.current = out.watch;
    // [QB] Once per step per run (QB-3), whatever the way the Check is left and shown again.
    if (out.completed && checkAt !== undefined && run.reportOnce('quest.check_completed', checkAt)) {
      portsRef.current.track({
        name: 'quest.check_completed',
        payload: checkCompletedPayload(questId, out.completed),
      });
    }
  }, [stepIndex, stepKind, questId]);

  // Honest outcome: a quest with every game skipped is 0 / 0, not 5 / 5.
  // Rounds are scored on the first try; retries ride along for telemetry.
  const finishQuest = (): void => {
    runQuestFinish(useQuestRunStore.getState(), ports, quest?.steps);
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
  // On the reward step every game is done, so a Close or a back there finishes the run as See results does (F-QUEST-002
  // amendment NB-1, F-TCH-004 section 3.5 amendment NB-1): a quest played to its end is never discarded as left. The
  // All lessons preview records nothing and keeps asking its own question.
  const askLeave = (): void => {
    if (onAskLeave) onAskLeave();
    else if (onReward) finishQuest();
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

  // [QB] Previous (QB-2): from the second step on. It is the run's own move, never the navigation's back, so the
  // header's Close and the browser's back keep asking the leave question. The step-change effect above stops any sound.
  const goPrevious = stepIndex > 0 ? (): void => useQuestRunStore.getState().goPrevStep() : undefined;

  if (!quest || !step) {
    return (
      <Screen>
        <Body>{q.notFound}</Body>
        <Spacer size="lg" />
        <Button label={q.goBack.cta} tone="secondary" size="md" onPress={onBack} />
      </Screen>
    );
  }

  const discoverDone = (result: { pages: number; heard: number; written?: number; writeSeconds?: number }): void => {
    // [QB] Once per step per run (QB-3): Continue on the last page of a step shown again reports nothing.
    if (useQuestRunStore.getState().reportOnce('quest.discover_completed', stepIndex)) {
      ports.track({
        name: 'quest.discover_completed',
        payload: discoverCompletedPayload(questId, { ...result, written: result.written ?? 0, writeSeconds: result.writeSeconds ?? 0 }),
      });
    }
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

  // [MP] A contrast step shows nothing until it has decided to play (a moment: the packs, the chunk); one with nothing to play never shows.
  // A step passed by at once draws nothing (its layout effect has already moved the run on, before paint).
  if (step.contrast === true && contrastVerdict !== 'play') return contrastAtOnce ? <Screen tone="canvas">{null}</Screen> : <LessonWaiting />;

  // [TC] On the trace page of a Discover step (AMENDMENTS-STAGE1-TRACE-COVERAGE §3.4) the chrome follows the page's arrangement: the
  // title slot reads "Trace the new letters" (or is not drawn when the page is short), the step pill is hidden, and the step dots
  // ride in the ScreenHeader between Close and Aa when the page is short.
  const tracePlan = step.kind === 'discover' ? trace : null;
  const stepDots = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        {/* [QB] The dots keep the furthest step (they only fill); a step shown again is ringed, and the pill and the meter's words name it (QB-2). */}
        <Progress
          value={Math.max(furthestStep, stepIndex) + 1}
          max={quest.steps.length}
          tone="primary"
          variant="dots"
          testID="quest-step-dots"
          {...(revisit ? { current: stepIndex + 1, accessibilityValueText: m.a11y.progress.value(stepIndex + 1, quest.steps.length) } : {})}
        />
      </View>
      {tracePlan === null || tracePlan.pill ? <Pill tone="neutral" label={q.progress(stepIndex + 1, quest.steps.length)} size="sm" /> : null}
    </View>
  );
  const headerLeading = ownClose ? ({ leading: { kind: 'close', onPress: askLeave } } as const) : {};
  const headerOptions = tracePlan?.dotsInHeader ? { ...headerLeading, middle: stepDots } : ownClose ? headerLeading : undefined;

  // A Discover step keeps its header and Continue in view and scrolls only its pages.
  return (
    <Screen tone="canvas" scrollable={step.kind !== 'discover'} header={headerOptions}>
      {tracePlan?.dotsInHeader ? null : stepDots}

      {tracePlan === null ? (
        <>
          <Spacer size="lg" />
          <Heading level="title">{cardLines?.title ?? step.titleEn}</Heading>
          <Spacer size="xs" />
          <Pill tone="primary" label={questStepLabel(step.kind, q.step)} size="sm" />
          <Spacer size="lg" />
        </>
      ) : tracePlan.title ? (
        <>
          <Spacer size="lg" />
          <Heading level="title">{q.discover.write.title}</Heading>
          <Spacer size="lg" />
        </>
      ) : (
        <Spacer size={tracePlan.dotsInHeader ? 'sm' : 'lg'} />
      )}
      {step.kind === 'discover' && step.discover ? (
        <DiscoverStep
          key={step.id}
          pages={step.discover.pages}
          hoyaLine={step.hoyaLineEn}
          onDone={discoverDone}
          compact={pacing?.plan.compact === true}
          autoHear={autoHear}
          // [QB] On page 1 Previous is the step's; reached by Previous the step opens on its last page (QB-2).
          onPrevious={goPrevious}
          start={{ lastPage: cameBack, seen: revisit }}
          // [TC] The trace page after the letter pages, in every Discover step the player renders (the All lessons preview too:
          // a grown-up sees what the learner sees).
          writeOnce
          onPageKind={onPageKind}
        />
      ) : step.minigameKind && step.minigameRef ? (
        <MinigameLauncher
          copy={q}
          kind={step.kind}
          revisit={revisit}
          onContinue={advance}
          onPrevious={goPrevious}
          onLaunch={() => onOpenGame(stepIndex)}
          onSkip={() => {
            // [AU] Skip for now is noted on the run: a skipped game caps the stars (row AU-9).
            useQuestRunStore.getState().markStepSkipped();
            advance();
          }}
        />
      ) : (
        <NarrativeStepBody
          copy={q}
          line={cardLines ? { ...narrativeLine(step, q.keepGoing), message: cardLines.line } : narrativeLine(step, q.keepGoing)}
          onContinue={advance}
          onPrevious={goPrevious}
          isReward={step.kind === 'reward'}
          actions={
            onReward && again.kind === 'deciding' ? (
              <View style={{ minHeight: touchTarget.hero }} testID="quest-try-again-deciding" />
            ) : onReward && again.kind === 'offer' ? (
              <>
                <again.chunk.TryAgainOffer
                  onTry={() => {
                    // The quest is done: Results writes its score and card first, then plays Try these again over it.
                    if (reviewsFor !== null) handTryAgainToResults({ questId, profileId: reviewsFor, chunk: again.chunk, plan: again.plan });
                    advance();
                  }}
                  onSeeResults={advance}
                />
                {/* [QB] The offer keeps its two buttons; Previous sits under them (QB-2), and not while the offer is being planned, so no button moves under a finger. */}
                {goPrevious ? (
                  <>
                    <Spacer size="md" />
                    <Button label={q.previous.cta} tone="ghost" size="md" fullWidth onPress={goPrevious} testID={PREVIOUS_TEST_ID} />
                  </>
                ) : null}
              </>
            ) : undefined
          }
          note={stepIndex === 0 ? introNote : undefined}
          // [RF] On the Hello step only (the first, `intro` step): the line, and no Hoya 120 on the card then (RF-0b Q5).
          readingNotice={runBegun && stepIndex === 0 && step.kind === 'intro' && readingNotice.show ? { message: q.readingNotice, onShown: readingNotice.markShown } : undefined}
          // The Did you know? tip (F-CURR-002 row CM-3C): the quest's note of its cell, behind `upperCards`.
          tip={onReward ? <CultureTip questId={questId} /> : undefined}
        />
      )}
    </Screen>
  );
}

function NarrativeStepBody({
  copy,
  line,
  onContinue,
  onPrevious,
  isReward,
  actions,
  note,
  tip,
  readingNotice,
}: {
  copy: QuestMessages;
  line: NarrativeLine;
  onContinue: () => void;
  /** [QB] Previous beside the step's button (QB-2); absent on the first step. */
  onPrevious?: () => void;
  isReward: boolean;
  /** In place of the step's own button: the reward step's Try these again, offered or being planned (F-CURR-002 row CM-15). */
  actions?: ReactNode;
  /** [GU] A plain line between Hoya's card and Continue (the guest run's storage-blocked line, section 7.2). */
  note?: string;
  /** Under Hoya's card on the reward step: the Did you know? tip (F-CURR-002 row CM-3C), which draws nothing while off. */
  tip?: ReactNode;
  /**
   * [RF] Hoya's one-time reading line (AMENDMENTS-ROMANIZATION-FADE section 3.9): a second bubble with no figure under the
   * quest's own line, inside the same card; `onShown` marks it shown when it mounts. On the run that shows it the card draws
   * no Hoya 120, so Continue stays on screen where it is today (RF-0b Q5): the quest bubble's Hoya speaks both lines.
   */
  readingNotice?: { message: string; onShown: () => void };
}): ReactElement {
  return (
    <View style={{ flex: 1 }}>
      <Card padding="lg" tone={isReward ? 'success' : 'brand'}>
        {readingNotice ? null : (
          <>
            <View style={{ alignItems: 'center' }}>
              <Hoya pose={isReward ? 'cheering' : 'waving'} size={120} />
            </View>
            <Spacer size="md" />
          </>
        )}
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
        {readingNotice ? <ReadingNoticeLine message={readingNotice.message} onShown={readingNotice.onShown} /> : null}
      </Card>
      {tip}
      {note !== undefined ? (
        <>
          <Spacer size="md" />
          <Body tone="secondary" testID="quest-intro-note">
            {note}
          </Body>
        </>
      ) : null}
      <View style={{ flex: 1 }} />
      {actions ?? (
        <StepActions main={{ label: isReward ? copy.seeResults.cta : copy.continue.cta, size: 'hero', onPress: onContinue }} previousLabel={copy.previous.cta} onPrevious={onPrevious} />
      )}
      <Spacer size="lg" />
    </View>
  );
}

/**
 * [RF] Hoya's reading line (section 3.9): a `HoyaBubble` tone `idle`, no figure and not a live region (it is read in order,
 * never announced over the quest's own line). It marks itself shown when it mounts, once per profile on this device.
 */
function ReadingNoticeLine({ message, onShown }: { message: string; onShown: () => void }): ReactElement {
  useEffect(() => {
    onShown();
  }, [onShown]);
  return (
    <>
      <Spacer size="sm" />
      <HoyaBubble tone="idle" message={message} figure={false} live={false} testID="quest-reading-notice" />
    </>
  );
}

function MinigameLauncher({
  copy,
  kind,
  revisit,
  onLaunch,
  onSkip,
  onContinue,
  onPrevious,
}: {
  copy: QuestMessages;
  kind: QuestStepKind;
  /** [QB] The step is shown again after Previous (QB-2): Continue is the main button and Play again opens the game. */
  revisit: boolean;
  onLaunch: () => void;
  onSkip: () => void;
  /** [QB] Forward from a revisit. */
  onContinue: () => void;
  /** [QB] Previous beside the main button; absent on the first step. */
  onPrevious?: () => void;
}): ReactElement {
  const view = launcherView(kind, copy.launcher, revisit);
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
      <StepActions
        main={view.revisit ? { label: copy.continue.cta, size: 'hero', onPress: onContinue } : { label: view.primaryLabel, size: 'hero', onPress: onLaunch }}
        previousLabel={copy.previous.cta}
        onPrevious={onPrevious}
      />
      {view.revisit ? (
        <>
          <Spacer size="md" />
          <Button label={view.againLabel} tone="ghost" size="md" onPress={onLaunch} testID="quest-play-again" />
        </>
      ) : view.showSkip ? (
        <>
          <Spacer size="md" />
          <Button label={view.skipLabel} tone="ghost" size="md" onPress={onSkip} />
        </>
      ) : null}
      <Spacer size="lg" />
    </View>
  );
}
