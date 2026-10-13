import {
  apply as applyEngine,
  finishRun,
  levelOrder,
  startRun,
  type PaceId,
  type PlacementEvent,
  type PlacementResult,
  type PlacementRunState,
  type SpeechLang,
} from '@hangul-route/content-schema';
import { Screen } from '@hangul-route/design-system';
import { availableLocales, getMessages } from '@hangul-route/i18n';
import { CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { flags } from '../../config/flags';
import { episodesAll, questsAll } from '../../content';
import { PLACEMENT_BANK, PLACEMENT_WARMUP } from '../../content/placement.generated';
import { useLocale } from '../../i18n/use-messages';
import { isStageEntitled } from '../../logic/entitlement';
import { placementRouteCatalog } from '../../logic/placement/catalog';
import { completeEvent, itemAnsweredEvent, startEvent } from '../../logic/placement/events';
import {
  appStateEvent,
  flowReducer,
  hasScoredAnswer,
  previousExclude,
  resumedFlow,
  retakeFlow,
  runConfig,
  startFlow,
  type FlowEvent,
  type FlowState,
  type ResumeOffer,
  type SavedRun,
} from '../../logic/placement/flow';
import { bankHasClips, flowCapability, placementKoreanAudio, speechLangOf } from '../../logic/placement/options-view';
import { resultView } from '../../logic/placement/result-view';
import { proposalSkippedEvent, proposedEvent } from '../../logic/route/proposal-flow';
import { activeSelfRoute } from '../../logic/route/self-route';
import { completedAtOf, newResponse, placementStart, resultRoutes, rungPosition, startTarget } from '../../logic/placement/session';
import { isFreeContent } from '../../logic/content-access';
import { nextStartedEvent, routeNext } from '../../logic/route-next';
import { resolvePicture } from '../../logic/picture-ref';
import { effectiveLearnerType, gateRequired } from '../../logic/profiles/learner-type';
import type { PlacementStackParamList, RootStackParamList } from '../../navigation/types';
import { getCapability, hasVoiceFor, playPrompt, stop } from '../../platform/audio';
import { isScreenReaderEnabled, subscribeScreenReader } from '../../platform/screen-reader';
import { CONTENT_VERSION } from '../../platform/sync-api';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { usePlacementRunStore } from '../../store/placement-run-store';
import { acceptPlanOffer, applyPlanUpdate, planOfferNow } from '../../store/plan-offer-store';
import { useRouteStore } from '../../store/route-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { usePracticeSession } from '../use-practice-session';
import { routeNextInputFor } from '../../store/route-next-input';
import { accessTier } from '../../store/tier-store';
import { pickerTopics, wordsOffered } from '../vocab/topic-data';
import { useUiStore } from '../../store/ui-store';
import { HandoffScreen } from './HandoffScreen';
import { ItemScreen } from './ItemScreen';
import { LanguageScreen } from './LanguageScreen';
import { OptionsScreen } from './OptionsScreen';
import { ResultScreen } from './ResultScreen';
import { ResumeScreen } from './ResumeScreen';
import { SoundNeededScreen } from './SoundNeededScreen';
import { PICTURE_CONTEXT } from '../minigames/PictureArt';
import { WarmupScreen } from './WarmupScreen';
import {
  PlacementProvider,
  flowRoute,
  type FinishedCheck,
  type PlacementContextValue,
  type PlacementRoute,
  type ResultAction,
} from './context';

/**
 * The level check (F-PLC-001 section 3.1, section 3.10, wireframe placement
 * B to L2): the root route `Placement` holding the nested stack of its
 * screens. This host owns the flow state machine (`logic/placement/flow`),
 * starts and saves the run (`placement-run-store`), records the finished
 * result (`recordPlacement`, never a completion) and sends the telemetry; the
 * screens render what it gives them. Back is the exit sheet while a run is
 * open. Entry points (P-7): the onboarding fork (`PlacementInvite`), the Home
 * card and the Profile row; `flags.placementEnabled` hides them.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'Placement'>;

const Stack = createNativeStackNavigator<PlacementStackParamList>();
const resolvesPicture = (ref: string): boolean => resolvePicture(ref, PICTURE_CONTEXT).kind !== 'text';
/** The bank's prompts are spoken by the Korean voice until it carries clips (section 3.11). */
const PLACEMENT_HAS_CLIPS = bankHasClips(PLACEMENT_BANK, PLACEMENT_WARMUP);
const koreanAudioNow = (): boolean => placementKoreanAudio(getCapability(), PLACEMENT_HAS_CLIPS);

const ROUTES = {
  PlacementBoot: flowRoute('PlacementBoot', () => <Screen tone="canvas" testID="placement-boot">{null}</Screen>),
  PlacementResume: flowRoute('PlacementResume', ResumeScreen),
  PlacementLanguage: flowRoute('PlacementLanguage', LanguageScreen),
  PlacementOptions: flowRoute('PlacementOptions', OptionsScreen),
  PlacementHandoff: flowRoute('PlacementHandoff', HandoffScreen),
  PlacementWarmup: flowRoute('PlacementWarmup', WarmupScreen),
  PlacementSoundNeeded: flowRoute('PlacementSoundNeeded', SoundNeededScreen),
  PlacementItem: flowRoute('PlacementItem', ItemScreen),
  PlacementResult: flowRoute('PlacementResult', ResultScreen),
} satisfies Record<PlacementRoute, React.ComponentType>;

type Phase = 'boot' | 'offer' | 'flow';

function routeOf(phase: Phase, flow: FlowState | null, finished: FinishedCheck | null): PlacementRoute {
  if (phase === 'offer') return 'PlacementResume';
  if (phase === 'boot' || flow === null) return 'PlacementBoot';
  switch (flow.screen) {
    case 'language':
      return 'PlacementLanguage';
    case 'options':
      return 'PlacementOptions';
    case 'handoff':
      return 'PlacementHandoff';
    case 'warmup':
      return 'PlacementWarmup';
    case 'sound-needed':
      return 'PlacementSoundNeeded';
    case 'item':
      return 'PlacementItem';
    case 'result':
      return finished === null ? 'PlacementBoot' : 'PlacementResult';
    default:
      // invite (answered before this route opens), declined and left: nothing to draw.
      return 'PlacementBoot';
  }
}

/** A route of a root stack reset. */
interface RootRoute {
  name: keyof RootStackParamList;
  params?: object;
}

export function PlacementScreen({ route, navigation }: Props): React.ReactElement {
  const { source, retakeMode } = route.params;
  const profile = useProfileStore(activeProfileSelector);
  const profiles = useProfileStore((s) => s.profiles);
  const parentPinHash = useAccountStore((s) => s.parentPinHash);
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const resetParentGate = useUiStore((s) => s.resetParentGate);
  const uiLocale = useLocale();
  const profileId = profile?.id ?? null;
  // The level check records practice time only (F-REPORT-001 section 3.3.2, OD-19): never the streak.
  usePracticeSession(profileId, 'placement');
  const saved = usePlacementRunStore((s) => (profileId === null ? undefined : s.active[profileId]));
  const run = saved?.run ?? null;

  const [phase, setPhase] = useState<Phase>('boot');
  const phaseRef = useRef<Phase>('boot');
  phaseRef.current = phase;
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [offer, setOffer] = useState<ResumeOffer | null>(null);
  const [finished, setFinished] = useState<FinishedCheck | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const baseFlow = useRef<FlowState | null>(null);
  const flowRef = useRef<FlowState | null>(null);
  flowRef.current = flow;
  const runRef = useRef<PlacementRunState | null>(null);
  runRef.current = run;
  const allowLeave = useRef(false);
  const finishing = useRef(false);
  const grownUpAskedAt = useRef<number | null>(null);

  const capability = useCallback(
    (testLocale: FlowState['testLocale']) =>
      flowCapability({ koreanAudio: koreanAudioNow(), hasVoiceFor: (lang: SpeechLang) => hasVoiceFor(lang), testLocale }),
    [],
  );

  const leave = useCallback((): void => {
    allowLeave.current = true;
    stop();
    if (source === 'onboarding' && profileId !== null) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Onboarding', params: { screen: 'FirstQuestPreview', params: { profileId } } }],
        }),
      );
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
    }
  }, [navigation, profileId, source]);

  // --- Boot: the snapshot, the screen reader, a saved run -------------------------------
  useEffect(() => {
    if (profile === null) return;
    let alive = true;
    void (async () => {
      await useProgressStore.getState().hydrate(profile.id);
      const reader = await isScreenReaderEnabled();
      const resume = await usePlacementRunStore.getState().resume(profile.id, Date.now(), PLACEMENT_BANK.version);
      if (!alive) return;
      const placements = useProgressStore.getState().byProfile[profile.id]?.placements ?? [];
      let base = startFlow({
        source,
        levelOrder: levelOrder(profile.ageGroup),
        locales: availableLocales(),
        uiLocale,
        placements,
        screenReader: reader,
        capability: capability(uiLocale),
      });
      // The fork ("I already know some Korean") is answered before this route opens.
      if (base.screen === 'invite') base = flowReducer(base, { type: 'acceptFork', capability: capability(base.testLocale) });
      // "Try it with the sound guide hidden": a one-tap retake that starts at once.
      if (retakeMode !== undefined) base = retakeFlow(base, retakeMode, capability);
      baseFlow.current = base;
      if (resume?.kind === 'continue') {
        setFlow(base);
        setOffer(resume);
        setPhase('offer');
        return;
      }
      if (resume?.kind === 'finish') {
        setFlow(resumedFlow(base, resume));
      } else {
        setFlow(base);
      }
      setPhase('flow');
    })();
    return () => {
      alive = false;
    };
    // Boot once per mount; later locale or profile changes do not restart a check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const dispatch = useCallback((event: FlowEvent): void => {
    setFlow((current) => (current === null ? current : flowReducer(current, event)));
  }, []);

  // A screen reader turned on or off during the check: auto-play and the speaker labels follow
  // (a run already started keeps its own settings). The web reports nothing (spec assumption 5).
  useEffect(() => subscribeScreenReader((on) => dispatch({ type: 'setScreenReader', on })), [dispatch]);

  const applyRun = useCallback(
    (event: PlacementEvent): void => {
      if (profileId === null) return;
      const before = runRef.current;
      if (before === null || before.stop !== null) return;
      const now = Date.now();
      // Ticks that change nothing are not written to the store (no re-render each second).
      if (event.type === 'tick' && applyEngine(before, event, now) === before) return;
      const position = rungPosition(before);
      const after = usePlacementRunStore.getState().apply(profileId, event, now);
      if (after === null) return;
      const response = newResponse(before, after);
      if (response !== null && position !== null) void track(itemAnsweredEvent(profileId, response, position.gate));
    },
    [profileId],
  );

  // --- Start the run when the flow reaches the first scored question --------------------
  useEffect(() => {
    // Never again once a run has ended (a run stopped before any answer leaves with nothing recorded).
    if (profile === null || flow === null || flow.screen !== 'item' || run !== null || finished !== null || finishing.current) return;
    const placements = useProgressStore.getState().byProfile[profile.id]?.placements ?? [];
    const now = Date.now();
    const config = runConfig(flow, {
      profileId: profile.id,
      startedAtMs: now,
      koreanAudio: koreanAudioNow(),
      exclude: previousExclude(placements),
      resolvesPicture,
      warmup: PLACEMENT_WARMUP,
    });
    const fresh = startRun(PLACEMENT_BANK, config, now);
    usePlacementRunStore.getState().begin(
      profile.id,
      { testLocale: flow.testLocale, source: flow.source, ...(flow.motivation === null ? {} : { motivation: flow.motivation }) },
      fresh,
      now,
    );
    void track(
      startEvent(profile.id, {
        source: flow.source,
        testLocale: flow.testLocale,
        mode: flow.mode,
        revealMode: config.revealMode,
        level: profile.ageGroup,
      }),
    );
  }, [profile, flow, run, finished]);

  // --- Finish: record the result (never a completion), then the result screen -----------
  const finish = useCallback(
    (savedRun: SavedRun, kind: 'live' | 'finish'): void => {
      if (profile === null || finishing.current) return;
      finishing.current = true;
      const store = usePlacementRunStore.getState();
      if (!hasScoredAnswer(savedRun.run)) {
        // Stopped before any answer, or only prompts that could not play: nothing to record (section 3.11).
        store.discard(profile.id);
        leave();
        return;
      }
      const snapshot = useProgressStore.getState().byProfile[profile.id];
      const completed = new Set((snapshot?.quests ?? []).filter((q) => q.completedAt !== undefined).map((q) => q.questId));
      const tier = accessTier(profile.id, new Date());
      const opts = { isEntitled: (stage: string) => isStageEntitled(stage, tier), completedQuestIds: completed };
      const catalog = placementRouteCatalog(questsAll, episodesAll);
      const result: PlacementResult = finishRun(savedRun.run, {
        catalog,
        ...opts,
        completedAt: completedAtOf(kind, savedRun.savedAtMs, Date.now()),
        ...(savedRun.motivation === undefined ? {} : { motivation: savedRun.motivation }),
        contentVer: CONTENT_VERSION,
        testLocale: savedRun.testLocale,
        source: savedRun.source,
      });
      // A result recorded before the app closed is not counted twice.
      const previous = (snapshot?.placements ?? []).filter((p) => p.id !== result.id);
      // A result that could not be stored keeps the saved run, so reopening the check records it
      // (the `finish` offer); it is not reported as complete until then.
      if (useProgressStore.getState().recordPlacement(profile.id, result)) {
        void track(completeEvent(profile.id, result));
        store.discard(profile.id);
      }
      const { before, after } = resultRoutes(previous, result, catalog, opts);
      // The weekly plan offered with this result (P-7b): read after the result is stored, so the
      // proposal starts from it; the dismissal was read when the check opened.
      const offer = planOfferNow(profile.id, flags.routeEnabled, new Date());
      const view = resultView({
        result,
        before,
        after,
        catalog,
        completedQuestIds: completed,
        profileType: effectiveLearnerType(profile),
        // The weekly-plan strip (P-7b) behind `flags.routeEnabled`. "See Learning Route" opens the Route tab, which
        // exists only while `flags.myRouteEnabled` is on (AMENDMENTS-ROUTE-LEARNING-ROUTE section 5.2, LR-4).
        routeEnabled: flags.routeEnabled,
        myRouteEnabled: flags.myRouteEnabled,
        proposalAvailable: offer?.kind === 'new',
        // A dismissal is already folded into the offer (OD-16): the strip follows `proposalAvailable`.
        planPromptDismissed: false,
        hasActivePlan: activeSelfRoute(useProgressStore.getState().byProfile[profile.id]) !== null,
        planUpdateAvailable: offer?.kind === 'update',
        // The story shelf (F-STORY-004) is not in the app yet: "See the whole map".
        hasReviewedShelfStory: false,
        gateRequired: gateRequired({ profiles, parentPinHash }),
      });
      setFinished({
        result,
        view,
        catalog,
        placedOut: new Set(after.placedOutQuestIds),
        completed,
        startQuest: startTarget(after),
        offer,
      });
      // `route.proposed` once, for the proposal the learner sees (the strip or the update card).
      const shown = view.strip && offer?.kind === 'new' ? offer.byPace[offer.pace] : view.planUpdate && offer?.kind === 'update' ? offer.proposal : undefined;
      if (shown !== undefined) {
        const event = proposedEvent(profile.id, 'placement', shown);
        void track({ name: event.name, profileId: profile.id, payload: { ...event.payload } });
      }
      dispatch({ type: 'runFinished' });
    },
    [profile, profiles, parentPinHash, leave, dispatch],
  );

  useEffect(() => {
    if (flow?.screen === 'item' && saved !== undefined && saved.run.stop !== null && finished === null) finish(saved, 'live');
  }, [flow?.screen, saved, finished, finish]);

  // The plan prompt's dismissal (OD-16), read once so the result can offer the plan at once.
  useEffect(() => {
    if (profileId !== null && flags.routeEnabled) void useRouteStore.getState().loadUi(profileId);
  }, [profileId]);

  // --- Clocks, the app leaving the foreground, the grown-up gate ------------------------
  // Not while the Resume offer waits: Continue starts the clocks again from that moment.
  const runOpen = phase === 'flow' && run !== null && run.stop === null;
  useEffect(() => {
    if (!runOpen) return;
    const tick = setInterval(() => applyRun({ type: 'tick' }), 1_000);
    const sub = AppState.addEventListener('change', (state) => {
      const event = appStateEvent(state);
      if (event !== null) applyRun(event);
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [runOpen, applyRun]);

  useEffect(() => {
    const askedAt = grownUpAskedAt.current;
    if (askedAt !== null && parentGateOpenedAt !== null && parentGateOpenedAt >= askedAt) {
      grownUpAskedAt.current = null;
      applyRun({ type: 'quit', by: 'grown-up' });
      // The PIN only ended the check: it does not open the 15-minute grown-up session for the child.
      resetParentGate();
    }
  }, [parentGateOpenedAt, applyRun, resetParentGate]);

  const finishForGrownUp = useCallback((): void => {
    if (gateRequired({ profiles, parentPinHash })) {
      grownUpAskedAt.current = Date.now();
      navigation.navigate('PinEntry', { next: 'PlacementFinish' });
    } else {
      applyRun({ type: 'quit', by: 'grown-up' });
    }
  }, [profiles, parentPinHash, navigation, applyRun]);

  // Back: the exit sheet while a run is open; the language screen from the options.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        // Back on the Resume offer leaves; the saved run stays as it is for the next visit.
        if (allowLeave.current || phaseRef.current === 'offer') return;
        const open = runRef.current;
        if (open !== null && open.stop === null) {
          e.preventDefault();
          applyRun({ type: 'exit' });
          return;
        }
        const current = flowRef.current;
        if (current !== null && current.screen === 'options' && flowReducer(current, { type: 'back' }) !== current) {
          e.preventDefault();
          dispatch({ type: 'back' });
        }
      }),
    [navigation, applyRun, dispatch],
  );

  // The flow's own exits ("Start learning" on the sound-needed screen).
  useEffect(() => {
    if (flow?.screen === 'left' || flow?.screen === 'declined') leave();
  }, [flow?.screen, leave]);

  useEffect(() => () => stop(), []);

  const testLocale = flow?.testLocale ?? offer?.saved.testLocale ?? uiLocale;
  const m = useMemo(() => getMessages(testLocale), [testLocale]);
  const say = useCallback(
    (text: string) => playPrompt({ text, language: speechLangOf(testLocale), kind: 'narration', source: 'placement' }),
    [testLocale],
  );

  const resetTo = useCallback(
    (routes: RootRoute[]): void => {
      allowLeave.current = true;
      stop();
      navigation.dispatch(CommonActions.reset({ index: routes.length - 1, routes }));
    },
    [navigation],
  );

  const onResultAction = useCallback(
    (action: ResultAction): void => {
      const check = finished;
      switch (action) {
        case 'start': {
          // The start quest while it is open; else the one next, or the first free word topic at the
          // end of the free lessons (F-PLC-001 section 3.1 step 7, amended by F-ENT-003 E3-4).
          const startQuest = check?.startQuest ?? null;
          const input = profileId === null ? null : routeNextInputFor(profileId, new Date());
          const freeTopicKey = wordsOffered() ? (pickerTopics().find((t) => isFreeContent('vocab-topic', t.key))?.key ?? null) : null;
          const start =
            input === null
              ? placementStart({ start: startQuest, isQuestOpen: () => true, next: { kind: 'rest' }, freeTopicKey })
              : placementStart({ start: startQuest, isQuestOpen: input.isQuestOpen, next: routeNext(input), freeTopicKey });
          if (start.kind === 'quest') {
            if (start.source !== null && profileId !== null) void track(nextStartedEvent(profileId, start.source, 'placement'));
            resetTo([{ name: 'Main' }, { name: 'QuestPlayer', params: { questId: start.questId, episodeId: start.episodeId } }]);
          } else if (start.kind === 'topic') {
            resetTo([{ name: 'Main' }, { name: 'VocabTopic', params: { topicKey: start.topicKey } }]);
          } else {
            resetTo([{ name: 'Main', params: { screen: 'Journey' } }]);
          }
          return;
        }
        case 'seeMap':
          resetTo([{ name: 'Main', params: { screen: 'Journey' } }]);
          return;
        case 'seeMyRoute':
          resetTo([{ name: 'Main', params: { screen: 'Route' } }]);
          return;
        case 'openStories':
          resetTo([{ name: 'Main', params: { screen: 'Library' } }]);
          return;
        case 'forGrownUps':
          // The grown-up report of this learner (F-PLC-001 section 3.9), behind the PIN when the gate is required.
          if (profileId === null) return;
          if (gateRequired({ profiles, parentPinHash })) navigation.navigate('PinEntry', { next: 'PlacementReport', profileId });
          else navigation.navigate('PlacementReport', { profileId });
          return;
        case 'tryStandard':
          allowLeave.current = true;
          navigation.replace('Placement', { source });
          return;
        case 'retryHidden': {
          const mode = check?.result.mode;
          allowLeave.current = true;
          navigation.replace('Placement', { source, ...(mode === 'standard' || mode === 'deep' ? { retakeMode: mode } : {}) });
          return;
        }
        case 'changePlan':
          // The proposal screen on top; back returns here (the strip gives way once a plan exists).
          if (profileId !== null) navigation.navigate('RouteProposal', { source: 'placement', profileId });
          return;
        case 'justStart': {
          // Skip and play: hides the plan prompt for 14 days or until the next result (AM-6, OD-16).
          if (profileId !== null) {
            void useRouteStore.getState().markDismissed(profileId, new Date().toISOString());
            const event = proposalSkippedEvent(profileId, 'placement');
            void track({ name: event.name, profileId, payload: { ...event.payload } });
          }
          onResultAction('start');
          return;
        }
      }
    },
    [finished, resetTo, navigation, profiles, parentPinHash, source, profileId],
  );

  const acceptPlan = useCallback(
    async (pace: PaceId): Promise<boolean> => {
      const offer = finished?.offer ?? null;
      const proposal = offer?.kind === 'new' ? offer.byPace[pace] : undefined;
      if (profileId === null || offer?.kind !== 'new' || proposal === undefined) return false;
      const route = await acceptPlanOffer(profileId, proposal, { changed: pace !== offer.pace }, new Date());
      if (route === null) return false;
      onResultAction('start');
      return true;
    },
    [finished, profileId, onResultAction],
  );

  const updatePlan = useCallback(async (): Promise<boolean> => {
    if (profileId === null || !(await applyPlanUpdate(profileId, new Date()))) return false;
    onResultAction('start');
    return true;
  }, [profileId, onResultAction]);

  const continueRun = useCallback((): void => {
    const base = baseFlow.current;
    if (offer === null || base === null || profileId === null) return;
    // Time spent on the offer is time away: the idle clock and the backstop start again now.
    void usePlacementRunStore.getState().resume(profileId, Date.now(), PLACEMENT_BANK.version);
    setNeedsGesture(true);
    setFlow(resumedFlow(base, offer));
    setOffer(null);
    setPhase('flow');
  }, [offer, profileId]);

  const startAgain = useCallback((): void => {
    if (profileId !== null) usePlacementRunStore.getState().discard(profileId);
    setOffer(null);
    setFlow(baseFlow.current);
    setPhase('flow');
  }, [profileId]);

  // A stopped run found on reopening is recorded as soon as the flow shows its result.
  useEffect(() => {
    if (phase === 'flow' && flow?.screen === 'result' && finished === null && saved !== undefined && saved.run.stop !== null) {
      finish(saved, 'finish');
    }
  }, [phase, flow?.screen, finished, saved, finish]);

  const target = routeOf(phase, flow, finished);
  // The nested stack opens on the screen the flow is on when it first renders.
  const initialRoute = useRef<PlacementRoute | null>(null);
  if (initialRoute.current === null && flow !== null) initialRoute.current = target;

  if (profileId === null || flow === null) {
    // No active profile (never reached through the app) or still booting.
    return (
      <Screen tone="canvas" testID="placement-boot">
        {null}
      </Screen>
    );
  }

  const value: PlacementContextValue = {
    profileId,
    flow,
    dispatch,
    m,
    screenReader: flow.screenReader,
    capability,
    say,
    run,
    applyRun,
    finished,
    offer,
    continueRun,
    startAgain,
    needsGesture,
    markGesture: () => setNeedsGesture(false),
    finishForGrownUp,
    onResultAction,
    acceptPlan,
    updatePlan,
    leave,
    target,
  };

  return (
    <PlacementProvider value={value}>
      <Stack.Navigator initialRouteName={initialRoute.current ?? 'PlacementBoot'} screenOptions={{ headerShown: false, animation: 'fade', gestureEnabled: false }}>
        {(Object.keys(ROUTES) as PlacementRoute[]).map((name) => (
          <Stack.Screen key={name} name={name} component={ROUTES[name]} />
        ))}
      </Stack.Navigator>
    </PlacementProvider>
  );
}
