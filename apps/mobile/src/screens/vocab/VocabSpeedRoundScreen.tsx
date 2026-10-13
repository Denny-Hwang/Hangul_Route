import { levelOrder, type ClockScale, type VocabProgress, type VocabTopic } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Heading,
  Progress,
  Screen,
  Spacer,
  SparkMeter,
  colors,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import { romanizationShown as showRomanization } from '@hangul-route/i18n';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, View } from 'react-native';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { localizedGloss, vocabItem } from '../../content/vocab';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { canPlayKorean } from '../../logic/audio/capability';
import { isContentLocked } from '../../logic/content-access';
import { backOrHome } from '../../logic/navigation/screen-exits';
import { ACTIVITY_ROUTES, VOCAB_SCREENS } from '../../logic/vocab/caps';
import { emptyVocab, localDay, vocabOf } from '../../logic/vocab/progress';
import {
  TIME_UP_MS,
  challengeLine,
  challengeSettings,
  clockView,
  initialMode,
  pausedFor,
  scaleOnOptIn,
  tryChallengeLine,
} from '../../logic/vocab/challenge';
import { clockFor, type SpeedMode } from '../../logic/vocab/session-clock';
import {
  buildRound,
  collectedWords,
  hoyaLine,
  isNewBest,
  previousBest,
  roundCompleteEvent,
  roundPlan,
  roundStartEvent,
  sheetState,
  sparkLabel,
  type RoundPlan,
} from '../../logic/vocab/speed-round';
import { initSession, reduce, type SessionConfig, type SpeedEvent, type SpeedState } from '../../logic/vocab/speed-session';
import { summarize } from '../../logic/vocab/stars';
import { localizedTopic } from '../../logic/vocab/topic-view';
import type { RootStackParamList } from '../../navigation/types';
import { subscribeAppActive } from '../../platform/app-state';
import { focusForScreenReader, isScreenReaderEnabled } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import { useAudioStore } from '../../store/audio-store';
import { useLocaleStore } from '../../store/locale-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useAccessTier } from '../../store/tier-store';
import { speedHost, useVocabRunStore } from '../../store/vocab-run-store';
import { PictureArt } from '../minigames/PictureArt';
import { BackButton } from './BackButton';
import { ChoiceChips, ClockBar, ClockDigits, PausedPanel, ScaleChips, SwitchRow } from './ChallengeControls';
import { canRenderPicture, pickerTopic, topicWords } from './topic-data';
import { VocabQuestionView } from './VocabQuestionView';
import { useSpeedClock } from './useSpeedClock';

type Props = NativeStackScreenProps<RootStackParamList, 'VocabSpeedRound'>;
type Navigation = NativeStackNavigationProp<RootStackParamList, 'VocabSpeedRound'>;

/** Hides a view and everything in it from assistive technology on the web, iOS and Android. */
const HIDDEN = { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/**
 * The Speed Round (F-VOC-004 §3.5, §3.6; PR S-5, Relaxed only): the start
 * sheet, then the questions with the spark meter, then the results. Every rule
 * of the round is the pure session reducer (`logic/vocab/speed-session.ts`)
 * and the screen decisions are `logic/vocab/speed-round.ts`; this file renders
 * them, drives the tick (`useSpeedClock`), writes each first tap at once and
 * the session at the end (`vocab-run-store`), and sends the telemetry.
 * A topic the picker does not show goes back to the topic page, which says
 * "Topic not found" or opens the grown-up gate for a locked topic (D5).
 * Design: design/screens/vocab/speed-round.md.
 */
export function VocabSpeedRoundScreen({ route, navigation }: Props): React.ReactElement {
  const topicKey = route.params.topicKey;
  const topic = pickerTopic(topicKey);
  const profile = useProfileStore(activeProfileSelector);
  const tier = useAccessTier(profile?.id ?? '');
  const locked = topic !== undefined && isContentLocked({ kind: 'vocab-topic', id: topic.key, tier, gatingEnabled: gatingActive(flags, bundleOs()) });
  const usable = topic !== undefined && !locked;

  useEffect(() => {
    if (!usable) navigation.replace('VocabTopic', { topicKey });
  }, [usable, navigation, topicKey]);

  if (!usable) return <Screen tone="canvas" testID="vocab-speed-redirect">{null}</Screen>;
  // Keyed by topic: Play again on another topic starts a fresh sheet.
  return <SpeedRound key={topic.key} source={topic} requested={route.params.mode} navigation={navigation} />;
}

interface Playing {
  config: SessionConfig;
  plan: RoundPlan;
  /** The learner's earlier Challenge best for the topic, read before the round wrote anything (S9). */
  earlierBest: number;
  /** A Korean voice or clip could play and sound was on when Start was tapped (S7). */
  canPlay: boolean;
}

function SpeedRound({
  source,
  requested,
  navigation,
}: {
  source: VocabTopic;
  requested: SpeedMode | undefined;
  navigation: Navigation;
}): React.ReactElement {
  const [playing, setPlaying] = useState<Playing | null>(null);
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  // Not hydrated or unreadable: as for nothing collected (§3.5); answers write once hydration completes.
  const progress = useMemo(() => (snap ? vocabOf(snap) : emptyVocab()), [snap]);
  const back = useCallback(
    () => backOrHome(navigation, () => navigation.navigate('VocabTopic', { topicKey: source.key })),
    [navigation, source.key],
  );

  if (playing) return <RoundPlay topicKey={source.key} playing={playing} navigation={navigation} onLeave={back} />;
  return (
    <StartSheet
      source={source}
      requested={requested}
      progress={progress}
      onBack={back}
      onLearn={() => navigation.replace(ACTIVITY_ROUTES.learn, { topicKey: source.key })}
      onStart={setPlaying}
    />
  );
}

function StartSheet({
  source,
  requested,
  progress,
  onBack,
  onLearn,
  onStart,
}: {
  source: VocabTopic;
  requested: SpeedMode | undefined;
  progress: VocabProgress;
  onBack: () => void;
  onLearn: () => void;
  onStart: (start: Playing) => void;
}): React.ReactElement {
  const messages = useMessages();
  const copy = messages.learner.vocab.speed;
  const locale = useLocale();
  const topic = useMemo(() => localizedTopic(source, locale), [source, locale]);
  const profile = useProfileStore(activeProfileSelector);
  const items = topicWords(topic.key);
  const collected = useMemo(() => collectedWords(items, progress), [items, progress]);
  const level = profile ? levelOrder(profile.ageGroup) : null;

  // Challenge (S8): a per-profile opt-in, never preselected for a profile that has not opted in.
  const settings = useLocaleStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const challenge = challengeSettings(settings);
  const setChallengeMode = useLocaleStore((s) => s.setChallengeMode);
  const setClockScale = useLocaleStore((s) => s.setClockScale);
  const [mode, setMode] = useState<SpeedMode>(() => initialMode(challenge.on, requested));
  const [readerScale, setReaderScale] = useState(false);
  const plan = useMemo(() => roundPlan(level, mode), [level, mode]);
  const state = sheetState(collected.length, plan.optionCount);

  // A Korean voice or a bundled clip, and sound on (S7); the round keeps what it was built with.
  const tts = useAudioStore((s) => s.tts);
  const clips = useAudioStore((s) => s.clips);
  const unlocked = useAudioStore((s) => s.unlocked);
  const muted = useAudioStore((s) => s.muted);
  const canPlay = canPlayKorean({ tts, clips, unlocked }) && !muted;

  // Hints are off while a screen reader is on (§3.6); `null` (not known yet) counts as on, the safe side.
  const [screenReader, setScreenReader] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void isScreenReaderEnabled().then((on) => {
      if (live) setScreenReader(on);
    });
    return () => {
      live = false;
    };
  }, []);

  const cover = items.find((item) => item.id === topic.coverItemId) ?? items[0];

  // The round is built while the sheet shows (seeded when it opened), so its line names the real number of
  // questions: the words allow each format once, which can be fewer than the level's count (§3.3).
  const [seed] = useState(() => Date.now());
  const questions = useMemo(
    () =>
      state === 'ready'
        ? buildRound({ collected, universe: items, progress, today: localDay(new Date()), plan, seed, canRender: canRenderPicture, canPlay })
        : [],
    [state, collected, items, progress, plan, seed, canPlay],
  );
  const nothing = state === 'ready' && questions.length === 0;

  // "Try Challenge" is the explicit opt-in: it turns the profile setting on and picks Challenge for this round;
  // with a screen reader on, the clock is set to twice as long first (§3.8).
  // A tap before the screen-reader check resolves asks again, so a fast opt-in still gets 2x; the mode and the
  // scale are written together, so one `vocab.challenge_toggled` reports the clock the round will use.
  const optIn = async (): Promise<void> => {
    if (!profile) return;
    const reader = screenReader ?? (await isScreenReaderEnabled());
    const scale = scaleOnOptIn(challenge.scale, reader);
    setChallengeMode(profile.id, true, 'start_sheet', scale);
    setReaderScale(scale !== challenge.scale);
    setMode('challenge');
  };
  // The switch that was tapped is replaced by the Relaxed | Challenge control: screen-reader focus goes to the
  // Challenge line (with "Twice as long is chosen for you" when the clock was doubled), not back to the top.
  const modeRef = useRef<View>(null);
  const focusMode = useRef(false);
  useEffect(() => {
    if (!focusMode.current || mode !== 'challenge') return;
    focusMode.current = false;
    focusForScreenReader(modeRef.current);
  }, [mode]);
  const chooseScale = (scale: ClockScale): void => {
    if (!profile) return;
    setClockScale(profile.id, scale, 'start_sheet');
    setReaderScale(false);
  };

  const start = (): void => {
    if (questions.length === 0) return;
    const config: SessionConfig = {
      mode,
      questions,
      clockMs: clockFor(mode, challenge.scale),
      // Hints are Relaxed only, and off with a screen reader (§3.6): only a check that has answered
      // "no screen reader" turns them on, so a tap before it answers gets none.
      hintsEnabled: mode === 'relaxed' && screenReader === false,
    };
    if (profile) useVocabRunStore.getState().begin(profile.id, topic.key, 'speed');
    void track({
      ...roundStartEvent({ topicKey: topic.key, mode, clockScale: challenge.scale, plan, questions: questions.length, audio: canPlay }),
      profileId: profile?.id,
    });
    onStart({ config, plan, earlierBest: previousBest(progress, topic.key), canPlay });
  };

  return (
    <Screen tone="canvas" scrollable testID="vocab-speed-sheet">
      <BackButton onPress={onBack} />
      <Spacer size="sm" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {cover ? <PictureArt pictureRef={cover.visual} gloss={localizedGloss(cover, locale)} size={touchTarget.hero} decorative /> : null}
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Heading level="display" testID="vocab-speed-topic">
            {topic.titleEn}
          </Heading>
          <Heading level="title">{copy.title}</Heading>
        </View>
      </View>
      <Spacer size="lg" />

      {nothing ? (
        <View style={{ gap: spacing.lg }} testID="vocab-speed-nothing">
          <Body>{copy.nothingToPlay}</Body>
          <Button label={copy.back} tone="primary" size="lg" fullWidth onPress={onBack} />
        </View>
      ) : state === 'learn-first' ? (
        <View style={{ gap: spacing.lg }} testID="vocab-speed-learn-first">
          <Body>{copy.learnFirst}</Body>
          {VOCAB_SCREENS.learn ? (
            <Button label={copy.learn} tone="primary" size="lg" fullWidth onPress={onLearn} testID="vocab-speed-learn" />
          ) : (
            <Button label={copy.backToTopic} tone="primary" size="lg" fullWidth onPress={onBack} testID="vocab-speed-back-to-topic" />
          )}
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          {challenge.on ? (
            <ChoiceChips
              choices={[
                { value: 'relaxed', label: copy.relaxed.label },
                { value: 'challenge', label: copy.challenge.label },
              ]}
              selected={mode}
              onSelect={setMode}
              groupLabel={messages.a11y.vocab.speed.modes}
              testID="vocab-speed-modes"
            />
          ) : null}
          <View ref={modeRef} accessible={Platform.OS !== 'web'} style={{ gap: spacing.xs }} testID="vocab-speed-mode">
            {challenge.on ? null : <Body weight="semibold">{copy.relaxed.label}</Body>}
            <Body tone="secondary">
              {mode === 'challenge' ? challengeLine(challenge.scale, copy.challenge) : copy.relaxed.line(questions.length)}
            </Body>
          </View>
          {mode === 'challenge' ? (
            <View style={{ gap: spacing.sm }} testID="vocab-speed-challenge">
              <Body weight="semibold">{copy.challenge.scale.title}</Body>
              <ScaleChips
                scale={challenge.scale}
                onSelect={chooseScale}
                copy={copy.challenge}
                groupLabel={messages.a11y.vocab.speed.scales}
                testID="vocab-speed-scale"
              />
              {/* Said when the clock was doubled for a screen reader (§3.8 "and says so"). */}
              <View accessibilityLiveRegion="polite">
                {readerScale ? <Body tone="secondary">{copy.challenge.screenReaderLine}</Body> : null}
              </View>
              <Body tone="secondary">{copy.challenge.stopsLine}</Body>
            </View>
          ) : null}
          {!challenge.on && profile ? (
            <SwitchRow
              title={copy.challenge.try}
              line={tryChallengeLine(challenge.scale, screenReader === true, copy.challenge)}
              on={false}
              onLabel={copy.challenge.profile.on}
              offLabel={copy.challenge.profile.off}
              onToggle={() => {
                focusMode.current = true;
                void optIn();
              }}
              testID="vocab-speed-try-challenge"
            />
          ) : null}
          {canPlay ? null : (
            <Body tone="secondary" testID="vocab-speed-no-sound">
              {copy.noSound}
            </Body>
          )}
          <Button label={copy.start} tone="primary" size="lg" fullWidth onPress={start} testID="vocab-speed-start" />
        </View>
      )}
      <Spacer size="xl" />
    </Screen>
  );
}

function RoundPlay({
  topicKey,
  playing,
  navigation,
  onLeave,
}: {
  topicKey: string;
  playing: Playing;
  navigation: Navigation;
  onLeave: () => void;
}): React.ReactElement {
  const { config, canPlay } = playing;
  const messages = useMessages();
  const copy = messages.learner.vocab.speed;
  const locale = useLocale();
  const romanizationShown = showRomanization(useRomanizationMode(), false);

  // The session lives in a ref that only `dispatch` advances, so two events in one tick each see the other's state.
  const stateRef = useRef<SpeedState>(reduce(initSession(config), { type: 'start' }, config));
  const [state, setState] = useState<SpeedState>(stateRef.current);
  const [stopping, setStopping] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const leaving = useRef(false);
  // When the round paused (wall clock), for the `resume` event's `pausedMs`.
  const pausedAt = useRef<number | null>(null);
  const timeUpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dispatch = useCallback(
    (event: SpeedEvent): void => {
      const before = stateRef.current;
      const next = reduce(before, event, config);
      if (next === before) return;
      if (next.phase === 'paused' && before.phase !== 'paused') pausedAt.current = Date.now();
      stateRef.current = next;
      setState(next);
      // A first tap: written at once, so a closed app loses nothing (§3.6).
      const answered = next.results[next.results.length - 1];
      if (next.results.length > before.results.length && answered) useVocabRunStore.getState().speedAnswer(answered);
    },
    [config],
  );

  // Active time only: a question on screen and nothing over it (the reveal, the stop sheet).
  useSpeedClock(state.phase === 'question' && !stopping, (dtMs) => dispatch({ type: 'tick', dtMs }));

  // The app going to the background pauses a clocked round (§3.8); Relaxed has no clock and ignores it.
  useEffect(
    () =>
      subscribeAppActive((active) => {
        if (!active) dispatch({ type: 'pause', reason: 'background' });
      }),
    [dispatch],
  );

  // The end of the round: the session once, then the results in place of this screen.
  useEffect(() => {
    if (state.phase !== 'done' || leaving.current) return;
    leaving.current = true;
    const run = useVocabRunStore.getState();
    if (state.endedBy === 'quit' || state.endedBy === null) {
      run.reset();
      onLeave();
      return;
    }
    const summary = summarize(state.results, config, state.endedBy);
    const newBest = isNewBest(summary, playing.earlierBest);
    const profileId = run.profileId ?? undefined;
    run.finishSpeed(summary);
    const complete = roundCompleteEvent({ topicKey, summary, pauses: state.pauses, activeMs: state.totalActiveMs, newBest });
    if (complete === null) {
      onLeave();
      return;
    }
    void track({ ...complete, profileId });
    const open = (): void => navigation.replace('VocabResults', { topicKey, summary, newBest });
    if (state.endedBy !== 'clock') {
      open();
      return;
    }
    // The clock ended the round: a calm second of "That's the time! Nice work." first (§3.6).
    setTimeUp(true);
    setStopping(false);
    // A live region mounted with its text is not read by every screen reader, so native says it as well.
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(copy.challenge.timeUp);
    timeUpTimer.current = setTimeout(open, TIME_UP_MS);
  }, [state, config, playing.earlierBest, topicKey, navigation, onLeave, copy.challenge.timeUp]);
  useEffect(
    () => () => {
      if (timeUpTimer.current !== null) clearTimeout(timeUpTimer.current);
    },
    [],
  );

  // Leaving before the end any other way (system back, a swipe) asks "Stop for now?" first.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (leaving.current || stateRef.current.phase === 'done') return;
        e.preventDefault();
        setStopping(true);
      }),
    [navigation],
  );
  // Unmounted mid-round (the app closed the screen): the run ends; the answers given are already written.
  useEffect(
    () => () => {
      if (stateRef.current.phase !== 'done') useVocabRunStore.getState().reset();
    },
    [],
  );

  const question = config.questions[Math.min(state.index, config.questions.length - 1)];
  const glossOf = useCallback(
    (id: string): string | undefined => {
      const item = vocabItem(id);
      return item ? localizedGloss(item, locale) : undefined;
    },
    [locale],
  );
  const nudge = hoyaLine(state, glossOf, copy);
  const clock = clockView(state.remainingMs, config.clockMs, copy.challenge, messages.a11y.vocab.speed);
  const paused = state.phase === 'paused';
  const resume = (): void => {
    dispatch({ type: 'resume', pausedMs: pausedFor(pausedAt.current, Date.now()) });
    pausedAt.current = null;
  };
  const meter = (
    // Read politely when a spark lights: at most once a question; a miss changes nothing, so nothing is read.
    <View accessibilityLiveRegion="polite">
      <SparkMeter
        value={state.sparks}
        reserveRows={clock !== null}
        accessibilityLabel={sparkLabel(state.sparks, messages.a11y.vocab.speed)}
        testID="vocab-speed-sparks"
      />
    </View>
  );

  return (
    <Screen tone="canvas" scrollable testID="vocab-speed-round">
      {clock ? (
        // Challenge (frame G): two lines at any width; Back, the digits and Pause, then the meter and the bar.
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {/* The time-up beat (frame G''): the round is over and saved, so there is nothing to stop. */}
            {timeUp ? null : <BackButton onPress={() => setStopping(true)} />}
            <View style={{ flex: 1 }} />
            <ClockDigits view={clock} />
            {paused || timeUp ? null : (
              <Button
                label={copy.challenge.pause}
                tone="secondary"
                size="md"
                onPress={() => dispatch({ type: 'pause', reason: 'user' })}
                testID="vocab-speed-pause"
              />
            )}
          </View>
          {meter}
          <ClockBar view={clock} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <BackButton onPress={() => setStopping(true)} />
          <View style={{ flexShrink: 1, gap: spacing.xs }}>
            {meter}
            <View {...HIDDEN} testID="vocab-speed-dots">
              <Progress variant="dots" value={state.results.length} max={Math.max(config.questions.length, 1)} />
            </View>
          </View>
        </View>
      )}
      <Spacer size="md" />
      {timeUp ? (
        <View accessibilityLiveRegion="polite" style={{ paddingVertical: spacing.xxl }} testID="vocab-speed-time-up">
          <Heading level="title" align="center">
            {copy.challenge.timeUp}
          </Heading>
        </View>
      ) : paused ? (
        <PausedPanel copy={copy.challenge} onResume={resume} onStop={() => setStopping(true)} />
      ) : question ? (
        <VocabQuestionView
          question={question}
          mode="speed"
          host={speedHost}
          canPlay={canPlay}
          romanizationShown={romanizationShown}
          ring={state.hint === 'ring'}
          hoya={nudge ? { tone: nudge.pose, message: nudge.line } : null}
          onAnswer={(optionId) => dispatch({ type: 'answer', optionId })}
          onAdvance={() => dispatch({ type: 'reveal-done' })}
          testID="vocab-question"
        />
      ) : null}
      <Spacer size="xl" />
      <StopSheet
        visible={stopping}
        copy={copy.stop}
        onKeep={() => setStopping(false)}
        onStop={() => {
          setStopping(false);
          // A round the clock already ended keeps its results (the session is written).
          if (stateRef.current.phase === 'done') return;
          dispatch({ type: 'quit' });
        }}
      />
    </Screen>
  );
}

/** "Stop for now?" (wireframe I): Keep playing is the primary; Stop keeps every answer already given. */
function StopSheet({
  visible,
  copy,
  onKeep,
  onStop,
}: {
  visible: boolean;
  copy: ReturnType<typeof useMessages>['learner']['vocab']['speed']['stop'];
  onKeep: () => void;
  onStop: () => void;
}): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay }} testID="vocab-speed-stop">
        {/* A tap on the dimmed area keeps playing; hidden from assistive tech, which has the Keep playing button. */}
        <Pressable onPress={onKeep} focusable={false} {...HIDDEN} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <Heading level="prompt">{copy.title}</Heading>
          <Body tone="secondary">{copy.body}</Body>
          <Spacer size="sm" />
          <Button label={copy.keep} tone="primary" size="lg" fullWidth onPress={onKeep} testID="vocab-speed-keep" />
          <Button label={copy.stop} tone="ghost" size="md" fullWidth onPress={onStop} testID="vocab-speed-stop-confirm" />
        </View>
      </View>
    </Modal>
  );
}
