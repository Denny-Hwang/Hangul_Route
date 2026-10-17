import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import {
  Card,
  Pill,
  Screen,
  StoryScene,
  layout,
  supportedCardIds,
  motion,
  spacing,
  useLayoutClass,
  useMediaSize,
} from '@hangul-route/design-system';
import type { KoText, SpeechLang, Story, StoryLevel, StoryTier } from '@hangul-route/content-schema';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { checkHasKorean, checkOutcomeLine, uiSpeechLang } from '../../logic/story/check-game';
import { romanizationShown } from '../../logic/story/romanization';
import {
  KOREAN_BLOCK_ID,
  glossTarget,
  planSceneChange,
  readFinishedPayload,
  readerAvailability,
  readerCheckpoints,
  readerKeyAction,
  sayItYourselfShown,
  termId,
  wordId,
  type ReaderMode,
} from '../../logic/story/reader-effects';
import {
  NO_CHECKPOINT_CARDS,
  cardsAfterReader,
  checkpointAnnouncement,
  checkpointAnswered,
  checkpointCard,
  checkpointHeading,
  checkpointItem,
  checkpointNext,
  checkpointRevealId,
  checkpointSkip,
  checkpointSpeech,
  tapCheckpoint,
  type CheckpointCards,
} from '../../logic/story/reader-checkpoint';
import { advisoryAfter, advisoryInPhase, advisoryNote, cultureNoteView, noteOpen, recapScenes } from '../../logic/story/reader-extras';
import { effectiveReadToMe } from '../../logic/story/reader-settings';
import { initReader, openEffects, reduceReader, type ReaderAction, type ReaderEffect, type ReaderState } from '../../logic/story/reader-state';
import { STORY_READER_AUDIO_SOURCE, planSceneAudio, type SceneAudioPart } from '../../logic/story/scene-audio';
import type { PlaySpec } from '../../logic/audio/controller';
import { buildSceneView, type SceneBlock } from '../../logic/story/scene-view';
// Art may take at most this share of the body height when stacked, so the text always has room (shared with Story Order's replay).
import { STACKED_ART_SHARE } from '../../logic/story/sequence-art';
import { nudge, success, tapLight } from '../../platform/haptics';
import { subscribeReaderKeys } from '../../platform/keys';
import { useReducedMotion } from '../../platform/motion';
import { focusForScreenReader } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import { useLocaleStore } from '../../store/locale-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import {
  AdvisoryRow,
  CultureNoteCard,
  CultureNoteChip,
  GlossCard,
  InEnglishLabel,
  KoreanBlock,
  NarrationText,
  ReaderBottomBar,
  ReaderEndPage,
  ReaderFallback,
  ReaderTopBar,
  SpeakerButton,
  type TermChipState,
} from './ReaderParts';
import { CheckpointCard, type CheckpointFocusable } from './CheckpointCard';
import { useReaderAudio } from './use-reader-audio';

/**
 * The story reader (F-STORY-002 §3.3-3.7, §3.10; wireframe
 * design/wireframes/story/reader.md; component spec
 * design/components/StoryReaderView/spec.md). Hosted by `StoryReaderScreen`
 * (replay route) and, from PR 2.6b, `StoryReadGame` (quest step). It builds a
 * `SceneView` per scene, runs `reduceReader`, executes the effects the pure
 * rules return (`reader-effects.ts`) and draws. No business rule lives here.
 */
export interface StoryReaderViewProps {
  /** Undefined (unknown id) shows the one-line fallback. */
  story: Story | undefined;
  level: StoryLevel;
  mode: ReaderMode;
  /** The scene to open on (a bookmark or the replay route's `sceneIndex`); clamped. */
  initialIndex: number;
  /** Bookmark seam: called from the scene-changed effect in quest mode for scene 2 on. */
  onSceneChange: (index: number) => void;
  /** Checkpoint rounds (`cp:<id>`), quest mode only (the inline card, PR 2.9). */
  onAnswer: (roundKey: string, correct: boolean) => void;
  /** End page primary (Continue / Done) and the fallback's Continue (quest mode). */
  onFinish: () => void;
  /** The fallback's Back. Close and the device back are the route's ScreenHeader and its history (AMENDMENTS-DISPLAY-NAV section 7). */
  onClose: () => void;
  /** Opens Sources (PR 2.7); without it the Sources buttons are not drawn. */
  onOpenSources?: (from: 'reader' | 'end', sceneIndex: number) => void;
  /**
   * The narration voice of each scene (`readerStory`, PR 2.8): the UI locale's when its overlay is
   * shown, else `en-US` (the default for a missing entry).
   */
  narrationLangs?: readonly SpeechLang[];
  /** "More in Culture notes" (F-STORY-004 PR 4.7, `CultureNotes { noteId }`); without it the button is not drawn. */
  onOpenCultureNote?: (noteId: string) => void;
  /**
   * The story before the locale overlay (PR 2.9): a checkpoint read aloud uses the UI voice only for text an
   * overlay translated. Without it every checkpoint line is read as English.
   */
  sourceStory?: Story;
}

export function StoryReaderView(props: StoryReaderViewProps): React.ReactElement {
  const { story, level, mode, onClose, onFinish } = props;
  const m = useMessages();
  const availability = readerAvailability(story, level);
  const tier = story?.tiers.find((t) => t.level === level);

  if (!availability.ok || !story || !tier) {
    return (
      <Screen tone="canvas" testID="story-reader">
        <ReaderFallback
          copy={m.learner.story.reader}
          backLabel={m.learner.story.reader.back.cta}
          onBack={onClose}
          onContinue={mode === 'quest' ? onFinish : undefined}
        />
      </Screen>
    );
  }
  return <ReaderBody {...props} story={story} tier={tier} />;
}

/** Focus target on the web (react-native-web forwards `focus`); a no-op where the node has none. */
interface Focusable {
  focus?: (options?: { preventScroll?: boolean }) => void;
}

/** Art column share in the side-by-side layout (§3.3: art left, at most 55 %). */
const SIDE_ART_SHARE = 0.55;

function ReaderBody({
  story,
  tier,
  level,
  mode,
  initialIndex,
  onSceneChange,
  onAnswer,
  onFinish,
  onOpenSources,
  narrationLangs,
  onOpenCultureNote,
  sourceStory,
}: StoryReaderViewProps & { story: Story; tier: StoryTier }): React.ReactElement {
  const m = useMessages();
  const locale = useLocale();
  const copy = m.learner.story.reader;
  const lc = useLayoutClass();
  const reducedMotion = useReducedMotion();
  const maxArt = useMediaSize(layout.maxWidth.reading * (2 / 3));

  // Profile settings: romanization mode (D2), Read to me (§3.4) with its level default.
  const profile = useProfileStore(activeProfileSelector);
  const profileId = profile?.id ?? null;
  const settings = useLocaleStore((s) => (profileId === null ? undefined : s.byProfile[profileId]));
  const setReadToMe = useLocaleStore((s) => s.setReadToMe);
  const romanizationMode = useRomanizationMode();
  const readToMe = effectiveReadToMe(settings?.readToMe, profile?.ageGroup ?? '');
  const [sessionReadToMe, setSessionReadToMe] = useState<boolean | null>(null);
  const readToMeOn = sessionReadToMe ?? readToMe;

  const audio = useReaderAudio();
  const isFocused = useIsFocused();
  // The effect runner reads the audio through a ref so its identity (and the key listener) stays stable.
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const [helpOpen, setHelpOpen] = useState(false);

  const [state, setState] = useState<ReaderState>(() =>
    initReader(tier.scenes.length, initialIndex, readerCheckpoints(tier)),
  );
  const stateRef = useRef(state);
  // One check state per checkpoint card for this visit: Back and Next reopen a card as it was left (§3.7).
  const [cards, setCards] = useState<CheckpointCards>(NO_CHECKPOINT_CARDS);
  const cardsRef = useRef(cards);
  const checkpointRef = useRef<CheckpointFocusable | null>(null);
  const nextRef = useRef<View | null>(null);
  // The voice of the narration shown in a scene (an overlay's, else English; §3.2).
  const sceneCtx = useCallback(
    (index: number) => ({ copy, narrationLang: narrationLangs?.[index] ?? ('en-US' as const) }),
    [copy, narrationLangs],
  );
  const view = useMemo(() => buildSceneView(story, level, state.index, sceneCtx(state.index)), [story, level, state.index, sceneCtx]);
  // The grown-up note: a fresh quest-mode open of scene 1 only; it goes on Dismiss or the first page turn (§3.7).
  const [advisory, setAdvisory] = useState<string | null>(() => advisoryNote(story, { mode, startIndex: state.index }));
  const note = useMemo(() => cultureNoteView(view?.cultureNote ?? null, supportedCardIds), [view]);
  const recap = useMemo(() => recapScenes(story, level), [story, level]);
  // The open checkpoint card (§3.7, PR 2.9) and what its speakers say.
  const checkCopy = m.learner.story.check;
  const cpHeading = checkpointHeading(mode, copy);
  const cpItem = useMemo(
    () => (state.phase === 'checkpoint' ? checkpointItem(story, tier, state.checkpointId) : null),
    [story, tier, state.phase, state.checkpointId],
  );
  const cpSpeech = useMemo(() => {
    if (!cpItem) return null;
    const source = sourceStory ?? story;
    const sourceTier = source.tiers.find((t) => t.level === level);
    const sourceItem = sourceTier ? checkpointItem(source, sourceTier, cpItem.checkId) ?? undefined : undefined;
    return checkpointSpeech(cpItem, sourceItem, uiSpeechLang(locale));
  }, [cpItem, sourceStory, story, level, locale]);
  const justAnswered = useRef(false);
  // Checkpoints whose question Read to me has already read this visit: reopening a card (Back, then Next) is quiet.
  const spokenCheckpoints = useRef<Set<string>>(new Set());

  // Mutable inputs the effect runner reads at call time.
  const live = useRef({ readToMe: readToMeOn, unlocked: audio.unlocked, mode, onSceneChange, onAnswer });
  live.current = { readToMe: readToMeOn, unlocked: audio.unlocked, mode, onSceneChange, onAnswer };
  const pendingAutoplay = useRef<number | null>(null);
  const termsOpened = useRef(0);
  const finishedSent = useRef(false);
  const narrationRef = useRef<Focusable | null>(null);
  const textScrollRef = useRef<ScrollView | null>(null);
  // Page keys only while the reader is the screen in front and its voice-help sheet is closed (§3.10).
  const keysActive = useRef(true);
  keysActive.current = isFocused && !helpOpen;
  // The lowest scene shown in this mount, for `scenesSeen` (the reader may open past scene 1).
  const lowest = useRef(state.index);
  const fade = useRef(new Animated.Value(1)).current;

  const sceneSteps = useCallback(
    (index: number, include: readonly SceneAudioPart[]) => {
      const v = buildSceneView(story, level, index, sceneCtx(index));
      return v ? planSceneAudio(v, { include }) : [];
    },
    [story, level, sceneCtx],
  );

  const runEffects = useCallback(
    (effects: readonly ReaderEffect[]): void => {
      for (const effect of effects) {
        const audio = audioRef.current;
        setAdvisory((row) => advisoryAfter(row, effect));
        if (effect.type === 'scene-changed') {
          audio.resetForScene();
          pendingAutoplay.current = null;
          lowest.current = Math.min(lowest.current, effect.index);
          // Every scene starts at the top of its text, on native too (no focus scroll there).
          textScrollRef.current?.scrollTo({ y: 0, animated: false });
          const { readToMe: on, unlocked, mode: m0, onSceneChange: save } = live.current;
          const plan = planSceneChange({ mode: m0, index: effect.index, via: effect.via, readToMe: on, unlocked });
          if (plan.saveBookmark) save(effect.index);
          if (plan.autoplay === 'now') audio.play(sceneSteps(effect.index, ['narration', 'korean']));
          if (plan.autoplay === 'on-unlock') pendingAutoplay.current = effect.index;
          const v = buildSceneView(story, level, effect.index, sceneCtx(effect.index));
          if (v) AccessibilityInfo.announceForAccessibility(v.labels.announcement);
          // No focus scroll: the text is already at its top, and scrolling to the narration would hide a
          // read-along Korean line above it.
          if (plan.moveFocus) setTimeout(() => narrationRef.current?.focus?.({ preventScroll: true }), 0);
        } else if (effect.type === 'answer') {
          if (live.current.mode === 'quest') live.current.onAnswer(effect.roundKey, effect.correct);
        } else {
          audio.stop();
          if (!finishedSent.current) {
            finishedSent.current = true;
            const s = stateRef.current;
            void track({
              name: 'story.read.finished',
              ...(profileId === null ? {} : { profileId }),
              payload: { ...readFinishedPayload({
                storyId: story.id,
                level,
                mode: live.current.mode,
                sceneCount: s.sceneCount,
                furthest: s.furthest,
                lowest: lowest.current,
                linesPlayed: audio.playedCount(),
                termsOpened: termsOpened.current,
              }) },
            });
          }
        }
      }
    },
    [sceneSteps, story, level, sceneCtx, profileId],
  );

  const dispatch = useCallback(
    (action: ReaderAction): ReaderState => {
      const kept = cardsAfterReader(cardsRef.current, action);
      if (kept !== cardsRef.current) {
        cardsRef.current = kept;
        setCards(kept);
      }
      if (action.type === 'restart') spokenCheckpoints.current.clear();
      const prev = stateRef.current;
      const step = reduceReader(prev, action);
      // Leaving a checkpoint card (Back, Skip, Next): its question stops; a new scene may start its own sound.
      if (prev.phase === 'checkpoint' && step.state.phase !== 'checkpoint') audioRef.current.stop();
      stateRef.current = step.state;
      setState(step.state);
      runEffects(step.effects);
      // Back from a card returns to the same scene, so no scene-changed runs: say where the learner is and put
      // focus on the narration (the focused control on the card has just gone; §3.10).
      if (prev.phase === 'checkpoint' && step.state.phase === 'scene' && !step.effects.some((e) => e.type === 'scene-changed')) {
        const v = buildSceneView(story, level, step.state.index, sceneCtx(step.state.index));
        if (v) AccessibilityInfo.announceForAccessibility(v.labels.announcement);
        setTimeout(() => {
          if (Platform.OS === 'web') narrationRef.current?.focus?.({ preventScroll: true });
          else focusForScreenReader(narrationRef.current);
        }, 0);
      }
      return step.state;
    },
    [runEffects, story, level, sceneCtx],
  );

  // Opening: announce the scene, save nothing for scene 1, autoplay when allowed (§3.3, §3.4).
  useEffect(() => {
    runEffects(openEffects(stateRef.current));
    // Once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A scene that opened before the first gesture plays once the browser lets sound play (§3.4, row 6).
  useEffect(() => {
    if (!audio.unlocked || pendingAutoplay.current === null) return;
    const index = pendingAutoplay.current;
    pendingAutoplay.current = null;
    if (stateRef.current.phase === 'scene' && stateRef.current.index === index && live.current.readToMe) {
      audioRef.current.play(sceneSteps(index, ['narration', 'korean']));
    }
  }, [audio.unlocked, sceneSteps]);

  // Web keyboard: Right / Left turn the page, Escape closes the gloss card (§3.10).
  useEffect(
    () =>
      subscribeReaderKeys((key) => {
        if (!keysActive.current) return false;
        const action = readerKeyAction(key, stateRef.current);
        if (action === null) return false;
        dispatch(action);
        return true;
      }),
    [dispatch],
  );

  // Page turn: a 200 ms fade, instant with reduced motion (§3.3, §3.10). Never an auto-advance.
  // The opening shows at once: it is not a page turn, and `useReducedMotion` only learns the setting
  // after mount, so a fade there would play even with reduced motion on.
  const shownPage = useRef(`${state.index}:${state.phase}`);
  useEffect(() => {
    const page = `${state.index}:${state.phase}`;
    const turned = page !== shownPage.current;
    shownPage.current = page;
    if (reducedMotion || !turned) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    const anim = Animated.timing(fade, {
      toValue: 1,
      duration: motion.duration.base,
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [state.index, state.phase, reducedMotion, fade]);

  // Opening a checkpoint or the end page is a page turn too: the grown-up note goes and does not come back.
  useEffect(() => {
    setAdvisory((row) => advisoryInPhase(row, state.phase));
  }, [state.phase]);

  // A checkpoint card opens: the scene's sound stops, the text starts at the top, the card is announced and
  // takes focus, and Read to me reads the question on its first opening only (§3.4, §3.7, §3.10).
  const openedCheckpoint = state.phase === 'checkpoint' ? state.checkpointId : null;
  const cpLive = useRef({ item: cpItem, speech: cpSpeech, heading: cpHeading });
  cpLive.current = { item: cpItem, speech: cpSpeech, heading: cpHeading };
  useEffect(() => {
    if (openedCheckpoint === null) return;
    const { item, speech, heading } = cpLive.current;
    const a = audioRef.current;
    a.resetForScene();
    pendingAutoplay.current = null;
    textScrollRef.current?.scrollTo({ y: 0, animated: false });
    if (item) AccessibilityInfo.announceForAccessibility(checkpointAnnouncement(heading, item));
    // Web: the region takes keyboard focus without a scroll jump; native: VoiceOver / TalkBack move to it.
    setTimeout(() => {
      if (Platform.OS === 'web') checkpointRef.current?.focus?.({ preventScroll: true });
      else focusForScreenReader(checkpointRef.current);
    }, 0);
    if (speech && live.current.readToMe && a.unlocked && !spokenCheckpoints.current.has(openedCheckpoint)) {
      spokenCheckpoints.current.add(openedCheckpoint);
      a.play(speech.question);
    }
  }, [openedCheckpoint]);

  // The right card was tapped: focus moves to Next (its explanation is above), and native hears the outcome.
  const cpAnsweredId = cpItem && checkpointAnswered(cards, cpItem) ? cpItem.checkId : null;
  useEffect(() => {
    if (cpAnsweredId === null || !justAnswered.current) return;
    justAnswered.current = false;
    focusForScreenReader(nextRef.current);
    const item = cpLive.current.item;
    if (Platform.OS !== 'web' && item) {
      const line = checkOutcomeLine(item, checkpointCard(cardsRef.current, item), true, checkCopy);
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(line, { queue: true });
      else AccessibilityInfo.announceForAccessibility(line);
    }
  }, [cpAnsweredId, checkCopy]);

  // --- interactions ---------------------------------------------------------

  const shown = (id: string): boolean => romanizationShown(romanizationMode, state.revealed.includes(id));

  const termSteps = (text: Pick<KoText, 'ko' | 'spokenKo' | 'audioRef'>): PlaySpec[] => [
    {
      text: text.spokenKo ?? text.ko,
      language: 'ko-KR' as const,
      kind: 'word' as const,
      source: STORY_READER_AUDIO_SOURCE,
      ...(text.audioRef ? { audioRef: text.audioRef } : {}),
    },
  ];

  const hearKorean = (): void => {
    dispatch({ type: 'reveal', id: KOREAN_BLOCK_ID });
    audio.play(sceneSteps(state.index, ['korean']));
  };

  const openItem = (id: string): void => {
    const opened = dispatch({ type: 'tapTerm', id }).openTerm === id;
    if (!opened) return;
    termsOpened.current += 1;
    dispatch({ type: 'reveal', id });
    const target = glossTarget(view ?? { narrationParts: [], korean: null }, id);
    if (target) audio.play(termSteps(target.text));
  };

  // Dismiss unmounts the focused control: put a keyboard or screen-reader user back on the scene text (web).
  const dismissAdvisory = (): void => {
    setAdvisory(null);
    if (Platform.OS === 'web') setTimeout(() => narrationRef.current?.focus?.({ preventScroll: true }), 0);
  };

  // The note card shares the one inline-card slot with the gloss card; a second tap of its chip closes it.
  const toggleNote = (): void => {
    if (note) dispatch({ type: 'tapTerm', id: note.itemId });
  };

  const changeReadToMe = (next: boolean): void => {
    setSessionReadToMe(next);
    if (profileId !== null) setReadToMe(profileId, next);
    if (!next) audio.stop();
  };

  const chip = (id: string): TermChipState => ({ romanizationShown: shown(id), open: state.openTerm === id });

  // Checkpoint card: a miss is reported at once and the card stays; the right card waits for Next (§3.7).
  const chooseOption = (optionId: string): void => {
    if (!cpItem) return;
    const tap = tapCheckpoint(cardsRef.current, cpItem, optionId);
    if (tap.outcome === null) return;
    cardsRef.current = tap.cards;
    setCards(tap.cards);
    if (tap.outcome === 'correct') {
      tapLight();
      success();
      justAnswered.current = true;
    } else {
      nudge();
      // The Hoya bubble is a polite live region on the web; native hears the outcome and the hint at once.
      if (Platform.OS !== 'web') {
        AccessibilityInfo.announceForAccessibility(checkOutcomeLine(cpItem, checkpointCard(tap.cards, cpItem), false, checkCopy));
      }
    }
    if (tap.reader) dispatch(tap.reader);
  };

  const nextPage = (): void => {
    if (state.phase !== 'checkpoint') {
      dispatch({ type: 'next' });
      return;
    }
    const action = cpItem ? checkpointNext(cardsRef.current, cpItem) : { type: 'skipCheckpoint' as const };
    if (action) dispatch(action);
  };

  const skipCheckpointCard = (): void => {
    dispatch(cpItem ? checkpointSkip(cardsRef.current, cpItem) : { type: 'skipCheckpoint' });
  };

  // --- layout ----------------------------------------------------------------

  const [body, setBody] = useState({ width: 0, height: 0 });
  const onBodyLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setBody((prev) => (prev.width === Math.round(width) && prev.height === Math.round(height) ? prev : { width: Math.round(width), height: Math.round(height) }));
  };
  const side = lc.sideBySide;
  const artWidth = (() => {
    if (body.width === 0) return 0;
    if (side) return Math.floor(Math.min(body.width * SIDE_ART_SHARE - spacing.xl, ((body.height - spacing.xxxl) * 4) / 3, maxArt * 1.5));
    return Math.floor(Math.min(body.width, maxArt, (body.height * STACKED_ART_SHARE * 4) / 3));
  })();

  if (!view) return <Screen tone="canvas">{null}</Screen>;

  const end = state.phase === 'end';
  const atCheckpoint = state.phase === 'checkpoint';
  // Side by side is for scenes: a checkpoint card and the end page use the one reading column.
  const columns = side && state.phase === 'scene';
  // The grown-up note is drawn on the scene page only (never over a checkpoint or the end page).
  const advisoryRow = advisoryInPhase(advisory, state.phase);
  const sources = onOpenSources ? () => onOpenSources(end ? 'end' : 'reader', state.index) : undefined;
  const gloss = glossTarget(view, state.openTerm);
  const reason = audio.slot.view.reason;

  const art = (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      {artWidth > 0 ? (
        <StoryScene
          art={view.art}
          theme={story.theme}
          width={artWidth}
          accessibilityLabel={view.altEn === '' ? undefined : view.altEn}
          testID="story-reader-art"
        />
      ) : null}
      {view.traditional ? (
        <View style={{ alignSelf: 'center' }}>
          <Pill label={copy.traditionalTale.pill} tone="secondary" testID="story-reader-traditional" />
        </View>
      ) : null}
    </View>
  );

  const block = (b: SceneBlock): React.ReactNode => {
    if (b === 'narration') {
      return (
        <View key="narration" style={{ gap: spacing.xs }}>
          {level === 'read-along' ? <InEnglishLabel label={copy.inEnglish} /> : null}
          <View
            ref={(node) => {
              narrationRef.current = node as unknown as Focusable | null;
            }}
            tabIndex={-1}
            role="region"
            aria-label={view.labels.scene}
            testID="story-reader-narration"
          >
            <Card tone="paper" padding="lg" elevation="card">
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <NarrationText
                    parts={view.narrationParts}
                    copy={copy}
                    chipState={(id) => chip(termId(id))}
                    onTerm={(id) => openItem(termId(id))}
                  />
                </View>
                <SpeakerButton
                  label={copy.hearStory}
                  onPress={() => audio.play(sceneSteps(state.index, ['narration', 'korean']))}
                  testID="story-reader-hear-scene"
                />
              </View>
            </Card>
          </View>
          {gloss !== null && gloss.id.startsWith('kw:') ? (
            <GlossCard
              key={gloss.id}
              text={gloss.text}
              copy={copy}
              koreanItem={m.a11y.koreanItem}
              romanizationShown={shown(gloss.id)}
              onHear={() => audio.play(termSteps(gloss.text))}
              onClose={() => dispatch({ type: 'closeTerm' })}
            />
          ) : null}
        </View>
      );
    }
    if (b === 'korean' && view.korean) {
      return (
        <View key="korean" style={{ gap: spacing.sm }}>
          <KoreanBlock
            korean={view.korean}
            size={level === 'read' ? 'md' : 'sm'}
            copy={copy}
            koreanItem={m.a11y.koreanItem}
            romanizationShown={shown(KOREAN_BLOCK_ID)}
            wordState={(i) => chip(wordId(i))}
            onHear={hearKorean}
            onWord={(i) => openItem(wordId(i))}
          />
          {gloss !== null && gloss.id.startsWith('word:') ? (
            <GlossCard
              key={gloss.id}
              text={gloss.text}
              copy={copy}
              koreanItem={m.a11y.koreanItem}
              romanizationShown={shown(gloss.id)}
              onHear={() => audio.play(termSteps(gloss.text))}
              onClose={() => dispatch({ type: 'closeTerm' })}
            />
          ) : null}
          <PromptPanel
            view={audio.slot.view}
            onAction={(action) => audio.slot.act(action, hearKorean)}
            onHelp={() => setHelpOpen(true)}
            testID="story-reader-prompt"
          />
        </View>
      );
    }
    if (b === 'caption') {
      return (
        <View key="caption" style={{ gap: spacing.xs }} testID="story-reader-caption">
          <InEnglishLabel label={copy.inEnglish} />
          <Card tone="paper" padding="md" elevation="flat">
            <NarrationText parts={[{ text: view.captionEn }]} copy={copy} chipState={chip} onTerm={() => undefined} />
          </Card>
        </View>
      );
    }
    return null;
  };

  // Window height < layout.compactHeight (320x568, landscape phones): hero CTAs step down to lg.
  const compactHeight = lc.windowHeight > 0 && lc.windowHeight < layout.compactHeight;
  const sayIt = sayItYourselfShown({ canPlayKorean: audio.canPlayKorean, reason, hasKorean: view.korean !== null });
  const noteIsOpen = noteOpen(note, state.openTerm);
  // Chips row (§3.3 item 5): "Did you know?" and "Say it yourself", only when present.
  const chips =
    note || sayIt ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }} testID="story-reader-chips">
        {note ? <CultureNoteChip label={copy.didYouKnow.cta} open={noteIsOpen} onPress={toggleNote} /> : null}
        {sayIt ? <Pill label={copy.sayItYourself.pill} tone="info" testID="story-reader-say-it" /> : null}
      </View>
    ) : null;

  const noteCard =
    note && noteIsOpen ? (
      <CultureNoteCard
        key={note.id}
        note={note}
        copy={copy}
        koreanItem={m.a11y.koreanItem}
        cardArtLabel={m.a11y.cardArt(note.title)}
        romanizationShown={shown(note.itemId)}
        onHear={() => {
          dispatch({ type: 'reveal', id: note.itemId });
          audio.play(termSteps(note.term));
        }}
        onMore={
          onOpenCultureNote
            ? () => {
                // Narration or a term clip never plays on under the Culture notes screen.
                audio.stop();
                onOpenCultureNote(note.id);
              }
            : undefined
        }
        onClose={() => dispatch({ type: 'closeTerm' })}
        compact={compactHeight}
      />
    ) : null;

  const text = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      {view.blocks.filter((b) => b !== 'art').map(block)}
      {chips}
      {noteCard}
    </View>
  );

  const bottomBar = (
    <ReaderBottomBar
      copy={copy}
      readToMe={readToMeOn}
      onReadToMe={changeReadToMe}
      // Back from a checkpoint card returns to its scene, even on scene 1.
      isFirst={view.isFirst && !atCheckpoint}
      nextLabel={view.labels.next}
      nextSize={compactHeight ? 'lg' : 'hero'}
      nextDisabled={atCheckpoint && cpItem !== null && !checkpointAnswered(cards, cpItem)}
      nextRef={nextRef}
      onBack={() => dispatch({ type: 'back' })}
      onNext={nextPage}
    />
  );

  const hearQuestion = (): void => {
    if (cpSpeech) audio.play([...cpSpeech.question, ...cpSpeech.options]);
  };

  const checkpointBody = (
    <ScrollView
      ref={textScrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: spacing.md }}
      keyboardShouldPersistTaps="handled"
      testID="story-reader-scroll"
    >
      {cpItem ? (
        <CheckpointCard
          key={cpItem.checkId}
          item={cpItem}
          check={checkpointCard(cards, cpItem)}
          heading={cpHeading}
          checkCopy={checkCopy}
          readerCopy={copy}
          revealed={state.revealed.includes(checkpointRevealId(cpItem.checkId))}
          sayIt={sayItYourselfShown({ canPlayKorean: audio.canPlayKorean, reason, hasKorean: checkHasKorean(cpItem) })}
          onHearQuestion={hearQuestion}
          onHearTarget={() => {
            if (cpSpeech?.target) audio.play([cpSpeech.target]);
          }}
          onReveal={() => dispatch({ type: 'reveal', id: checkpointRevealId(cpItem.checkId) })}
          onChoose={chooseOption}
          onSkip={skipCheckpointCard}
          // Native has no scrollIntoView: once Hoya's hint or explanation is laid out, the text area scrolls to it.
          onBubbleShown={() => textScrollRef.current?.scrollToEnd({ animated: !reducedMotion })}
          promptPanel={
            audio.slot.view.textShown ? (
              <PromptPanel
                view={audio.slot.view}
                onAction={(action) => audio.slot.act(action, hearQuestion)}
                onHelp={() => setHelpOpen(true)}
                testID="story-reader-checkpoint-prompt-panel"
              />
            ) : undefined
          }
          regionRef={(node) => {
            checkpointRef.current = node;
          }}
        />
      ) : null}
    </ScrollView>
  );

  const endPage = (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <ReaderEndPage
        copy={m.learner.story.end}
        mode={mode}
        hoyaLabel={m.a11y.hoya('cheering')}
        retellingNote={view.traditional ? story.origin.retellingNoteEn ?? null : null}
        recap={recap}
        theme={story.theme}
        onPrimary={onFinish}
        onReadAgain={() => dispatch({ type: 'restart' })}
        onSources={sources}
        compact={compactHeight}
        landscape={lc.windowWidth > lc.windowHeight}
      />
    </ScrollView>
  );

  const topBar = (
    <ReaderTopBar
      copy={copy}
      furthest={state.furthest}
      total={state.sceneCount}
      position={end ? null : view.labels.position}
      positionLabel={view.labels.scene}
      onSources={sources}
    />
  );
  // From the regular width up (a phone held sideways, a tablet) the bar rides in the ScreenHeader, between Close and
  // Display, so a short window keeps the text area; on a narrow phone it has its own row under the header
  // (AMENDMENTS-DISPLAY-NAV DN-4).
  const topBarInHeader = lc.width !== 'compact';

  return (
    <Screen
      tone="canvas"
      scrollable={false}
      width={side && !atCheckpoint ? 'full' : 'reading'}
      footer={!end && !columns ? bottomBar : undefined}
      header={topBarInHeader ? { middle: topBar } : undefined}
      testID="story-reader"
    >
      {topBarInHeader ? null : topBar}
      {advisoryRow !== null ? (
        <AdvisoryRow
          text={copy.advisory(advisoryRow)}
          dismissLabel={copy.dismiss.cta}
          onDismiss={dismissAdvisory}
          compact={compactHeight}
        />
      ) : null}
      {columns ? (
        // Side by side: the art and the text fade on a page turn; the controls under the text stay put (§3.10).
        <View testID="story-reader-body" style={{ flex: 1, marginTop: spacing.sm }} onLayout={onBodyLayout}>
          <View style={{ flex: 1, flexDirection: 'row', gap: spacing.xl }} testID="story-reader-columns">
            <Animated.View style={{ width: artWidth, alignItems: 'center', opacity: fade }}>{art}</Animated.View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Animated.View style={{ flex: 1, opacity: fade }} testID="story-reader-text">
                <ScrollView
                  ref={textScrollRef}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingTop: spacing.xs }}
                  keyboardShouldPersistTaps="handled"
                  testID="story-reader-scroll"
                >
                  {text}
                </ScrollView>
              </Animated.View>
              {bottomBar}
            </View>
          </View>
        </View>
      ) : (
        <Animated.View testID="story-reader-body" style={{ flex: 1, opacity: fade, marginTop: spacing.sm }} onLayout={onBodyLayout}>
          {end ? (
            endPage
          ) : atCheckpoint ? (
            checkpointBody
          ) : (
            <View style={{ flex: 1, gap: spacing.md }}>
              {art}
              <ScrollView
                ref={textScrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: spacing.xs }}
                keyboardShouldPersistTaps="handled"
                testID="story-reader-scroll"
              >
                {text}
              </ScrollView>
            </View>
          )}
        </Animated.View>
      )}
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </Screen>
  );
}
