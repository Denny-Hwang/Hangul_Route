import { levelOrder, localize, type RuntimeVocabItem, type VocabProgress, type VocabTopic } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Heading,
  HoyaBubble,
  Icon,
  Pill,
  Progress,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useMediaSize,
} from '@hangul-route/design-system';
import { romanizationShown as showRomanization } from '@hangul-route/i18n';
import type { EventArg, NavigationAction } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { FlipCard } from '../../components/FlipCard';
import { PromptPanel } from '../../components/PromptPanel';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { localizedGloss } from '../../content/vocab';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { canPlayKorean } from '../../logic/audio/capability';
import { isContentLocked } from '../../logic/content-access';
import { backOrHome } from '../../logic/navigation/screen-exits';
import { ACTIVITY_ROUTES, VOCAB_SCREENS } from '../../logic/vocab/caps';
import { cardsDispatch, learnerCardsPorts, type CardsSessionPorts } from '../../logic/vocab/cards-ports';
import {
  cardLabels,
  cardsCompleteEvent,
  cardsRun,
  cardsStartEvent,
  initCardsFlash,
  markButtonsStacked,
  mayAutoplay,
  quickCheckQuestions,
  summarySpeedShown,
  type CardsRun,
} from '../../logic/vocab/cards-view';
import { summaryPrimaryLabel, vocabCopyOf } from '../../logic/vocab/copy';
import {
  cardsSessionEvent,
  chunkSize,
  chunkTally,
  currentId,
  dotsFilled,
  quickCheckEvent,
  summaryPrimary,
  type FlashEvent,
  type FlashState,
} from '../../logic/vocab/flashcards';
import { emptyVocab, vocabOf } from '../../logic/vocab/progress';
import type { VocabQuestion } from '../../logic/vocab/question-builder';
import { optionCountFor } from '../../logic/vocab/topic-view';
import type { RootStackParamList } from '../../navigation/types';
import { hasClip, playPrompt } from '../../platform/audio';
import { focusForScreenReader, isScreenReaderEnabled, subscribeScreenReader } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import { useAudioStore } from '../../store/audio-store';
import { useLocaleStore } from '../../store/locale-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useAccessTier } from '../../store/tier-store';
import type { MinigameHost } from '../minigames/host';
import { PictureArt } from '../minigames/PictureArt';
import { BackButton } from './BackButton';
import { canRenderPicture, pickerTopic, topicWords } from './topic-data';
import { topicTintColor } from './TopicTile';
import { VocabQuestionView } from './VocabQuestionView';
import { WordCardBack, WordCardFront } from './WordCardFaces';

type Props = NativeStackScreenProps<RootStackParamList, 'VocabCards'>;
type Navigation = NativeStackNavigationProp<RootStackParamList, 'VocabCards'>;

/** Hides a view and everything in it from assistive technology on the web, iOS and Android. */
const HIDDEN = { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;
/** Read by assistive tech, not drawn (the web live line). */
const SCREEN_READER_ONLY = {
  position: 'absolute',
  width: borderWidth.thin,
  height: borderWidth.thin,
  margin: -borderWidth.thin,
  overflow: 'hidden',
} as const;
/** Where the card's voice comes from, for F-AUDIO-004 telemetry. */
const AUDIO_SOURCE = 'vocab-card';
/** The summary's row of the chunk's pictures. */
const SUMMARY_PICTURE = touchTarget.min;

/**
 * The flashcards (F-VOC-003 §3.5-§3.7, PR C-5; design/screens/vocab/cards.md,
 * wireframes vocab/flashcards D, E, F, H): a chunk of word cards that turn over
 * (`FlipCard`), the reading-practice switch, the voice with its text fallback,
 * Got it / Show me again, the quick check (F-VOC-004's `VocabQuestionView` in
 * check mode) and the chunk summary. Every rule is `logic/vocab/flashcards.ts`
 * and `cards-view.ts`; this file renders them, writes each event as it happens
 * (`recordVocab`) and sends the telemetry. A topic the picker does not show, or
 * a locked one (gating on only, D5), goes to the topic page, which says "Topic
 * not found" or opens the grown-up gate.
 */
export function VocabCardsScreen({ route, navigation }: Props): React.ReactElement {
  const { topicKey } = route.params;
  const topic = pickerTopic(topicKey);
  const profile = useProfileStore(activeProfileSelector);
  const tier = useAccessTier(profile?.id ?? '');
  const locked = topic !== undefined && isContentLocked({ kind: 'vocab-topic', id: topic.key, tier, gatingEnabled: gatingActive(flags, bundleOs()) });
  const usable = topic !== undefined && !locked;

  useEffect(() => {
    if (!usable) navigation.replace('VocabTopic', { topicKey });
  }, [usable, navigation, topicKey]);

  if (!usable) return <Screen tone="canvas" testID="vocab-cards-redirect">{null}</Screen>;
  return <LearnerCards key={topic.key} source={topic} params={route.params} navigation={navigation} />;
}

/** The learner's ports and exits: today's writes, telemetry and routes (`ACTIVITY_ROUTES`, the topic page). */
function LearnerCards({ source, params, navigation }: { source: VocabTopic; params: RootStackParamList['VocabCards']; navigation: Navigation }): React.ReactElement {
  const topicKey = source.key;
  const profileId = useProfileStore(activeProfileSelector)?.id ?? null;
  const ports = useMemo(
    () =>
      learnerCardsPorts({
        profileId,
        record: (id, events) => useProgressStore.getState().recordVocab(id, events),
        track,
      }),
    [profileId],
  );
  const exits = useMemo<CardsExits>(
    () => ({
      back: () => backOrHome(navigation, () => navigation.navigate('VocabTopic', { topicKey })),
      next: (next) => navigation.replace(ACTIVITY_ROUTES.learn, next),
      speed: () => navigation.replace(ACTIVITY_ROUTES.speed, { topicKey }),
      guard: (handler) => navigation.addListener('beforeRemove', handler),
      dispatch: (action) => navigation.dispatch(action),
    }),
    [navigation, topicKey],
  );
  return <CardsSession source={source} params={params} ports={ports} exits={exits} />;
}

/** A navigation about to leave the screen (`beforeRemove`), which the session may hold back. */
export type LeaveAttempt = EventArg<'beforeRemove', true, { action: NavigationAction }>;

/**
 * Where the session goes (the learner routes, or the All lessons stack, F-BROWSE-001 BR-9b).
 * `back` is the back button, Stop and Back to topic; `next` opens another run of the same topic
 * (Next words, Review these); `speed` the Speed round, or `null` where there is none.
 */
export interface CardsExits {
  back(): void;
  next(params: RootStackParamList['VocabCards']): void;
  speed: (() => void) | null;
  /** The summary showed: the chunk is done. */
  done?(): void;
  /** Subscribe to navigations leaving the screen; returns the unsubscribe. */
  guard(handler: (e: LeaveAttempt) => void): () => void;
  /** Replay a navigation the guard held back. */
  dispatch(action: NavigationAction): void;
}

export interface CardsSessionProps {
  source: VocabTopic;
  params: RootStackParamList['VocabCards'];
  ports: CardsSessionPorts;
  exits: CardsExits;
  /** Set to let a navigation from outside the session leave without the Keep going question (the preview strip's Leave). */
  leavingRef?: MutableRefObject<boolean>;
}

export function CardsSession({ source, params, ports, exits, leavingRef }: CardsSessionProps): React.ReactElement {
  const messages = useMessages();
  const copy = vocabCopyOf(messages).cards;
  const locale = useLocale();
  const topicKey = source.key;
  const activeProfile = useProfileStore(activeProfileSelector);
  // The ports say whose words these are: a preview is nobody's, whoever is active on the device.
  const profileId = ports.profileId;
  const profile = profileId !== null && activeProfile?.id === profileId ? activeProfile : null;
  const snap = useProgressStore((s) => (profileId ? s.byProfile[profileId] : undefined));
  // Not hydrated or unreadable: chunk 0 and nothing collected; writes wait for hydration (`recordVocab`).
  const progress = useMemo<VocabProgress>(() => (snap ? vocabOf(snap) : emptyVocab()), [snap]);
  const level = profile ? levelOrder(profile.ageGroup) : null;
  const optionCount = optionCountFor(level);
  const items = topicWords(topicKey);

  // The run and what was collected are fixed when the screen opens: a chunk does not move under the learner.
  const [run] = useState<CardsRun<RuntimeVocabItem>>(() =>
    cardsRun(items, { size: chunkSize(level), fixedOrder: source.fixedOrder, progress, params }),
  );
  const [collectedBefore] = useState<ReadonlySet<string>>(() => new Set(progress.items.map((s) => s.id)));

  // The card state lives in a ref that only `dispatch` advances, so two quick taps each see the other's state.
  const stateRef = useRef<FlashState>(initCardsFlash(run.words, run.startId));
  const [state, setState] = useState<FlashState>(stateRef.current);
  const dispatch = useCallback(
    (event: FlashEvent): void => {
      const before = stateRef.current;
      // Written as it happens (§3.6): a closed app loses nothing.
      const next = cardsDispatch(ports, before, event);
      if (next === before) return;
      stateRef.current = next;
      setState(next);
    },
    [ports],
  );

  // Once per opened chunk.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || run.words.length === 0) return;
    started.current = true;
    ports.track(cardsStartEvent({ topicKey, chunk: run.index, chunks: run.chunks.length, words: run.words.length, level }));
  }, [run, topicKey, level, ports]);

  // The quick check, built when the last card is done: the Show-me-again words first (§3.5).
  const [check, setCheck] = useState<{ questions: VocabQuestion[]; index: number; firstTry: number; asked: ReadonlySet<string> } | null>(null);
  useEffect(() => {
    if (state.phase !== 'check' || check !== null) return;
    const questions = quickCheckQuestions({
      // Padded in chunk order (§3.5), not the order a wall tile's startId gave the cards.
      chunk: run.inOrder,
      again: state.requeued,
      universe: items,
      optionCount,
      levelOrder: level ?? 1,
      seed: Date.now(),
      canRender: canRenderPicture,
    });
    if (questions.length === 0) dispatch('check-done');
    else setCheck({ questions, index: 0, firstTry: 0, asked: new Set() });
  }, [state.phase, state.requeued, check, run.inOrder, items, optionCount, level, dispatch]);

  const checkRef = useRef(check);
  checkRef.current = check;
  const checkHost = useMemo<MinigameHost>(
    () => ({
      mode: ports.hostMode,
      answer: (key, correct, meta) => {
        const c = checkRef.current;
        const id = meta?.itemId;
        const k = String(key);
        // The first answer per question is the one recorded (§3.5).
        if (c === null || id === undefined || c.asked.has(k)) return;
        ports.write([quickCheckEvent(id, correct)]);
        setCheck({ ...c, asked: new Set([...c.asked, k]), firstTry: c.firstTry + (correct ? 1 : 0) });
      },
      complete: () => undefined,
    }),
    [ports],
  );

  // The summary: the session and the telemetry, once.
  const finished = useRef(false);
  useEffect(() => {
    if (state.phase !== 'done' || finished.current) return;
    finished.current = true;
    ports.write([cardsSessionEvent(topicKey)]);
    ports.track(
      cardsCompleteEvent({
        topicKey,
        chunk: run.index,
        tally: chunkTally(state, collectedBefore),
        checkFirstTry: check?.firstTry ?? 0,
        checkQuestions: check?.questions.length ?? 0,
      }),
    );
    exits.done?.();
  }, [state, ports, exits, topicKey, run.index, collectedBefore, check]);

  // Leaving before the summary asks first (§3.5); what was turned is already written.
  const [asking, setAsking] = useState(false);
  const ownLeaving = useRef(false);
  const leaving = leavingRef ?? ownLeaving;
  // The navigation the sheet held back (a system back or swipe), replayed on Stop.
  const pending = useRef<NavigationAction | null>(null);
  const back = exits.back;
  const { guard } = exits;
  useEffect(
    () =>
      guard((e) => {
        if (leaving.current || stateRef.current.phase === 'done') return;
        e.preventDefault();
        pending.current = e.data.action;
        setAsking(true);
      }),
    [guard, leaving],
  );
  const leave = (): void => {
    leaving.current = true;
    setAsking(false);
    const action = pending.current;
    pending.current = null;
    if (action) exits.dispatch(action);
    else back();
  };
  const onBack = (): void => {
    if (stateRef.current.phase === 'done') back();
    else {
      pending.current = null;
      setAsking(true);
    }
  };

  const go = (next: () => void): void => {
    leaving.current = true;
    next();
  };

  const tint = topicTintColor(source.tint);
  return (
    <>
      {state.phase === 'cards' ? (
        <CardsPhase state={state} dispatch={dispatch} run={run} tint={tint} onBack={onBack} readingPractice={ports.readingPractice ? profile : null} />
      ) : state.phase === 'check' ? (
        <Screen tone="canvas" scrollable testID="vocab-cards-check">
          <BackButton onPress={onBack} />
          <Spacer size="sm" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Heading level="title">{copy.checkTitle}</Heading>
            <View {...HIDDEN}>
              <Progress variant="dots" value={check ? check.index + 1 : 0} max={2} />
            </View>
          </View>
          <Spacer size="md" />
          {check?.questions[check.index] ? (
            <CheckQuestion
              question={check.questions[check.index]!}
              host={checkHost}
              onAdvance={() => {
                const c = checkRef.current;
                if (c === null) return;
                if (c.index + 1 < c.questions.length) setCheck({ ...c, index: c.index + 1 });
                else dispatch('check-done');
              }}
            />
          ) : null}
          <Spacer size="xl" />
        </Screen>
      ) : (
        <Summary
          state={state}
          run={run}
          collectedBefore={collectedBefore}
          optionCount={optionCount}
          profileId={profileId}
          onBack={back}
          onNext={(chunk) =>
            // -1: "Review these" on an `ids` run opens the same words again, not chunk 0.
            go(() => exits.next(chunk < 0 ? { topicKey, ids: run.inOrder.map((w) => w.id) } : { topicKey, chunk }))
          }
          onSpeed={exits.speed ? () => go(exits.speed as () => void) : null}
          onTopic={() => go(back)}
          locale={locale}
        />
      )}
      <LeaveSheet visible={asking} copy={copy.leave} onKeep={() => setAsking(false)} onStop={leave} />
    </>
  );
}

function CardsPhase({
  state,
  dispatch,
  run,
  tint,
  onBack,
  readingPractice: profile,
}: {
  state: FlashState;
  dispatch: (event: FlashEvent) => void;
  run: CardsRun<RuntimeVocabItem>;
  tint: string;
  onBack: () => void;
  /** The profile whose reading practice switch is offered, or `null` (no profile, or a preview: no switch). */
  readingPractice: { id: string } | null;
}): React.ReactElement {
  const messages = useMessages();
  const copy = vocabCopyOf(messages).cards;
  const locale = useLocale();
  const id = currentId(state);
  const item = run.words.find((w) => w.id === id) ?? run.words[0]!;
  const gloss = localizedGloss(item, locale);
  const senseNote = useMemo(() => localize(item, item.id, locale).senseNote, [item, locale]);

  // Reading practice (T5): the profile's own setting, the same switch as the Profile screen.
  const mode = useRomanizationMode();
  const setMode = useLocaleStore((s) => s.setRomanizationMode);
  const [revealed, setRevealed] = useState(false);
  const shown = showRomanization(mode, revealed);
  const labels = cardLabels({ ko: item.ko, romanization: item.romanization, gloss }, shown, { koreanItem: messages.a11y.koreanItem, cards: messages.a11y.vocab.cards });

  // The voice (T6) through the F-AUDIO-004 prompt slot: the Korean is already on the card, so the slot only says why
  // there is no sound and offers its one action.
  const slot = usePromptSlot({ source: AUDIO_SOURCE, hasClip: hasClip(item.audioRef), textOnScreen: true });
  const tts = useAudioStore((s) => s.tts);
  const clips = useAudioStore((s) => s.clips);
  const unlocked = useAudioStore((s) => s.unlocked);
  const muted = useAudioStore((s) => s.muted);
  const canPlay = canPlayKorean({ tts, clips, unlocked }) && !muted;
  const [screenReader, setScreenReader] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void isScreenReaderEnabled().then((on) => {
      if (live) setScreenReader(on);
    });
    const off = subscribeScreenReader(setScreenReader);
    return () => {
      live = false;
      off();
    };
  }, []);

  const { play: slotPlay, reset: slotReset } = slot;
  const playWord = useCallback((): void => {
    void slotPlay(() => playPrompt({ text: item.spokenKo ?? item.ko, audioRef: item.audioRef, kind: 'word', source: AUDIO_SOURCE }));
  }, [slotPlay, item]);

  // Each new card: the reveal and the sound status start again, and focus moves to the card.
  const cardRef = useRef<View | null>(null);
  useEffect(() => {
    setRevealed(false);
    slotReset();
    focusForScreenReader(cardRef.current);
  }, [state.index, slotReset]);

  // A new front plays once by itself (T6, F-AUDIO-004 §3.6).
  const played = useRef<number | null>(null);
  useEffect(() => {
    if (state.face !== 'front') return;
    if (!mayAutoplay({ canPlay, unlocked, screenReader, played: played.current === state.index })) return;
    played.current = state.index;
    playWord();
  }, [state.face, state.index, canPlay, unlocked, screenReader, playWord]);

  // After a flip the new face is said (design/components/FlipCard/spec.md); never on a card's first showing.
  const [said, setSaid] = useState<{ n: number; text: string } | null>(null);
  const lastFace = useRef({ index: state.index, face: state.face });
  useEffect(() => {
    const before = lastFace.current;
    lastFace.current = { index: state.index, face: state.face };
    if (before.index !== state.index || before.face === state.face) return;
    const text = state.face === 'back' ? labels.turnedBack : labels.turnedFront;
    if (Platform.OS === 'web') setSaid((s) => ({ n: (s?.n ?? 0) + 1, text }));
    else AccessibilityInfo.announceForAccessibility(text);
  }, [state.index, state.face, labels.turnedBack, labels.turnedFront]);

  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent): void => setWidth(e.nativeEvent.layout.width);
  const stacked = width !== null && markButtonsStacked(width, fontScale);
  const inner = width === null ? null : width - 2 * (spacing.lg + borderWidth.thick);
  const speaker = useMediaSize(touchTarget.child);
  const speakerIcon = useMediaSize(spacing.xxl);

  const gotIt = (
    <View style={stacked ? undefined : { flex: 1 }}>
      <Button label={copy.gotIt} tone="primary" size="lg" fullWidth onPress={() => dispatch('got-it')} testID="vocab-card-got-it" />
    </View>
  );
  const marks =
    state.face === 'back' ? (
      // Tree order is the drawn order, so screen readers and Tab meet the buttons as they are seen:
      // side by side Show me again then Got it; stacked Got it on top.
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap: spacing.sm, paddingTop: spacing.sm }} testID="vocab-card-marks">
        {stacked ? gotIt : null}
        <View style={stacked ? undefined : { flex: 1 }}>
          <Button label={copy.again} tone="secondary" size="lg" fullWidth onPress={() => dispatch('again')} testID="vocab-card-again" />
        </View>
        {stacked ? null : gotIt}
      </View>
    ) : null;

  return (
    <Screen tone="canvas" scrollable testID="vocab-cards" footer={marks}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
        <BackButton onPress={onBack} />
        {profile ? (
          <Pressable
            testID="vocab-cards-reading-practice"
            onPress={() => setMode(profile.id, mode === 'tap' ? 'always' : 'tap')}
            accessibilityRole="switch"
            accessibilityState={{ checked: mode === 'tap' }}
            // RN-web drops `aria-checked` when it is false; a switch must always say its state.
            aria-checked={mode === 'tap'}
            accessibilityLabel={copy.readingPractice}
            style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }}
          >
            <Body weight="semibold">{copy.readingPractice}</Body>
            <View style={{ justifyContent: 'center' }}>
              <Pill tone={mode === 'tap' ? 'success' : 'neutral'} label={mode === 'tap' ? messages.learner.profile.reading.on : messages.learner.profile.reading.off} size="sm" />
            </View>
          </Pressable>
        ) : null}
      </View>
      <Spacer size="sm" />
      <View {...HIDDEN} testID="vocab-cards-dots">
        <Progress variant="dots" value={dotsFilled(state)} max={Math.max(run.words.length, 1)} />
      </View>
      <Spacer size="md" />

      <View onLayout={onLayout} testID="vocab-card">
        <FlipCard
          key={state.index}
          face={state.face}
          onFlip={() => dispatch('flip')}
          front={<WordCardFront item={item} gloss={gloss} tint={tint} romanizationShown={shown} width={inner} hint={copy.tapToFlip} />}
          back={<WordCardBack item={item} gloss={gloss} tint={tint} romanizationShown={shown} width={inner} senseNote={senseNote} />}
          accessibilityLabelFront={labels.front}
          accessibilityLabelBack={labels.back}
          pressableRef={cardRef}
          testID="vocab-card-flip"
        />
      </View>

      {shown ? null : (
        <View style={{ alignSelf: 'center' }}>
          <Spacer size="sm" />
          <Button label={copy.showSound} tone="ghost" size="md" onPress={() => setRevealed(true)} testID="vocab-card-reveal" />
        </View>
      )}

      <Spacer size="md" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          testID="vocab-card-speaker"
          onPress={() => {
            dispatch('hear');
            playWord();
          }}
          accessibilityRole="button"
          accessibilityLabel={slot.view.reason === 'muted' || slot.view.reason === 'blocked' ? slot.view.speakerLabel : copy.hear}
          style={{
            width: speaker,
            height: speaker,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brand.secondaryLight,
            borderColor: colors.brand.secondary,
            borderWidth: borderWidth.base,
          }}
        >
          <Icon name="speaker" size={speakerIcon} color={colors.brand.secondaryDark} />
        </Pressable>
        <View {...HIDDEN} style={{ flexShrink: 1 }}>
          <Body>{copy.hear}</Body>
        </View>
      </View>

      {/* One calm line when there is no sound (T6); the Korean and its romanization are already on the card. */}
      <View accessibilityLiveRegion="polite">
        {slot.view.textShown && slot.view.reason !== null ? (
          <>
            <Spacer size="sm" />
            <Body tone="secondary" testID="vocab-card-no-sound">
              {copy.noSound}
            </Body>
          </>
        ) : null}
      </View>
      {/* Its one action (Turn sound on, Try again, Tap to hear) when there is one; the calm line above says the rest. */}
      {slot.view.actionLabel !== null ? (
        <PromptPanel variant="status" view={slot.view} onAction={(action) => slot.act(action, playWord)} testID="vocab-card-sound" />
      ) : null}

      {Platform.OS === 'web' ? (
        <View accessibilityLiveRegion="polite">
          {said ? (
            <Text key={said.n} style={SCREEN_READER_ONLY} testID="vocab-card-said">
              {said.text}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}

function CheckQuestion({ question, host, onAdvance }: { question: VocabQuestion; host: MinigameHost; onAdvance: () => void }): React.ReactElement {
  const romanizationShown = showRomanization(useRomanizationMode(), false);
  const tts = useAudioStore((s) => s.tts);
  const clips = useAudioStore((s) => s.clips);
  const unlocked = useAudioStore((s) => s.unlocked);
  const muted = useAudioStore((s) => s.muted);
  // The check is word-to-picture: no sound changes nothing but the spoken reveal (§3.5).
  const canPlay = canPlayKorean({ tts, clips, unlocked }) && !muted;
  return (
    <VocabQuestionView
      question={question}
      mode="check"
      host={host}
      canPlay={canPlay}
      romanizationShown={romanizationShown}
      onAdvance={onAdvance}
      testID="vocab-question"
    />
  );
}

function Summary({
  state,
  run,
  collectedBefore,
  optionCount,
  profileId,
  onBack,
  onNext,
  onSpeed,
  onTopic,
  locale,
}: {
  state: FlashState;
  run: CardsRun<RuntimeVocabItem>;
  collectedBefore: ReadonlySet<string>;
  optionCount: 3 | 4;
  profileId: string | null;
  onBack: () => void;
  onNext: (chunk: number) => void;
  /** The Speed round, or `null` where the session has none (All lessons). */
  onSpeed: (() => void) | null;
  onTopic: () => void;
  locale: ReturnType<typeof useLocale>;
}): React.ReactElement {
  const vocabCopy = vocabCopyOf(useMessages());
  const copy = vocabCopy.cards;
  const snap = useProgressStore((s) => (profileId ? s.byProfile[profileId] : undefined));
  // What this run turned counts too, even before hydration has caught the writes up.
  const collected = useMemo(
    () => new Set([...(snap ? vocabOf(snap) : emptyVocab()).items.map((s) => s.id), ...state.flipped]),
    [snap, state.flipped],
  );
  const topicCollected = run.chunks.flat().filter((w) => collected.has(w.id)).length;
  const tally = chunkTally(state, collectedBefore);
  const primary = summaryPrimary(run.chunks, run.index, collected, collectedBefore);
  const picture = useMediaSize(SUMMARY_PICTURE);

  return (
    <Screen tone="canvas" scrollable testID="vocab-cards-summary">
      <BackButton onPress={onBack} />
      <Spacer size="md" />
      <HoyaBubble tone="cheering" message={copy.summary.newlyCollected(tally.newlyCollected)} testID="vocab-cards-summary-line" />
      <Spacer size="md" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} {...HIDDEN}>
        {run.words.map((w) => (
          <PictureArt key={w.id} pictureRef={w.visual} gloss={localizedGloss(w, locale)} size={picture} decorative />
        ))}
      </View>
      <Spacer size="lg" />
      <View style={{ gap: spacing.md }}>
        <Button
          label={summaryPrimaryLabel(vocabCopy, primary)}
          tone="primary"
          size="lg"
          fullWidth
          onPress={() => onNext(primary.chunk)}
          testID="vocab-cards-next"
        />
        {onSpeed && summarySpeedShown({ speedScreen: VOCAB_SCREENS.speed, collected: topicCollected, optionCount }) ? (
          <Button label={copy.summary.speed} tone="secondary" size="lg" fullWidth onPress={onSpeed} testID="vocab-cards-speed" />
        ) : null}
        <Button label={copy.summary.backToTopic} tone="secondary" size="lg" fullWidth onPress={onTopic} testID="vocab-cards-topic" />
      </View>
      <Spacer size="xl" />
    </Screen>
  );
}

/** "Keep going or stop for now?" (wireframe H): Keep going is the primary; Stop keeps every word already turned. */
function LeaveSheet({
  visible,
  copy,
  onKeep,
  onStop,
}: {
  visible: boolean;
  copy: { title: string; keep: string; stop: string };
  onKeep: () => void;
  onStop: () => void;
}): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay }} testID="vocab-cards-leave">
        {/* A tap on the dimmed area keeps going; hidden from assistive tech, which has the Keep going button. */}
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
          <Spacer size="sm" />
          <Button label={copy.keep} tone="primary" size="lg" fullWidth onPress={onKeep} testID="vocab-cards-keep" />
          <Button label={copy.stop} tone="secondary" size="lg" fullWidth onPress={onStop} testID="vocab-cards-stop" />
        </View>
      </View>
    </Modal>
  );
}
