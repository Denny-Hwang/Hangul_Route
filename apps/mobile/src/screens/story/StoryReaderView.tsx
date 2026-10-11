import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import {
  Card,
  Pill,
  Screen,
  StoryScene,
  layout,
  motion,
  spacing,
  useLayoutClass,
  useMediaSize,
} from '@hangul-route/design-system';
import type { KoText, Story, StoryLevel, StoryTier } from '@hangul-route/content-schema';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useMessages } from '../../i18n/use-messages';
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
import { effectiveReadToMe } from '../../logic/story/reader-settings';
import { initReader, openEffects, reduceReader, type ReaderAction, type ReaderEffect, type ReaderState } from '../../logic/story/reader-state';
import { STORY_READER_AUDIO_SOURCE, planSceneAudio, type SceneAudioPart } from '../../logic/story/scene-audio';
import type { PlaySpec } from '../../logic/audio/controller';
import { buildSceneView, type SceneBlock } from '../../logic/story/scene-view';
import { subscribeReaderKeys } from '../../platform/keys';
import { useReducedMotion } from '../../platform/motion';
import { track } from '../../platform/telemetry';
import { useLocaleStore } from '../../store/locale-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import {
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
  /** Checkpoint rounds (`cp:<id>`), quest mode only (PR 2.9 draws the card). */
  onAnswer: (roundKey: string, correct: boolean) => void;
  /** End page primary (Continue / Done) and the fallback's Continue (quest mode). */
  onFinish: () => void;
  /** Close, the device back gesture and the fallback's Back. */
  onClose: () => void;
  /** Opens Sources (PR 2.7); without it the Sources buttons are not drawn. */
  onOpenSources?: (from: 'reader' | 'end', sceneIndex: number) => void;
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
  focus?: () => void;
}

/** Art may take at most this share of the body height when stacked, so the text always has room. */
const STACKED_ART_SHARE = 0.42;
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
  onClose,
  onOpenSources,
}: StoryReaderViewProps & { story: Story; tier: StoryTier }): React.ReactElement {
  const m = useMessages();
  const copy = m.learner.story.reader;
  const lc = useLayoutClass();
  const reducedMotion = useReducedMotion();
  const maxArt = useMediaSize(layout.maxWidth.reading * (2 / 3));

  // Profile settings: romanization mode (D2), Read to me (§3.4) with its level default.
  const profile = useProfileStore(activeProfileSelector);
  const profileId = profile?.id ?? null;
  const settings = useLocaleStore((s) => (profileId === null ? undefined : s.byProfile[profileId]));
  const setReadToMe = useLocaleStore((s) => s.setReadToMe);
  const romanizationMode = settings?.romanizationMode ?? 'always';
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
    initReader(tier.scenes.length, initialIndex, readerCheckpoints(tier, false)),
  );
  const stateRef = useRef(state);
  const view = useMemo(() => buildSceneView(story, level, state.index, { copy }), [story, level, state.index, copy]);

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
      const v = buildSceneView(story, level, index, { copy });
      return v ? planSceneAudio(v, { include }) : [];
    },
    [story, level, copy],
  );

  const runEffects = useCallback(
    (effects: readonly ReaderEffect[]): void => {
      for (const effect of effects) {
        const audio = audioRef.current;
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
          const v = buildSceneView(story, level, effect.index, { copy });
          if (v) AccessibilityInfo.announceForAccessibility(v.labels.announcement);
          if (plan.moveFocus) setTimeout(() => narrationRef.current?.focus?.(), 0);
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
    [sceneSteps, story, level, copy, profileId],
  );

  const dispatch = useCallback(
    (action: ReaderAction): ReaderState => {
      const step = reduceReader(stateRef.current, action);
      stateRef.current = step.state;
      setState(step.state);
      runEffects(step.effects);
      return step.state;
    },
    [runEffects],
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
  useEffect(() => {
    if (reducedMotion) {
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

  const changeReadToMe = (next: boolean): void => {
    setSessionReadToMe(next);
    if (profileId !== null) setReadToMe(profileId, next);
    if (!next) audio.stop();
  };

  const chip = (id: string): TermChipState => ({ romanizationShown: shown(id), open: state.openTerm === id });

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

  const chips =
    sayItYourselfShown({ canPlayKorean: audio.canPlayKorean, reason, hasKorean: view.korean !== null }) ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} testID="story-reader-chips">
        <Pill label={copy.sayItYourself.pill} tone="info" testID="story-reader-say-it" />
      </View>
    ) : null;

  const text = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      {view.blocks.filter((b) => b !== 'art').map(block)}
      {chips}
    </View>
  );

  const bottomBar = (
    <ReaderBottomBar
      copy={copy}
      readToMe={readToMeOn}
      onReadToMe={changeReadToMe}
      isFirst={view.isFirst}
      nextLabel={view.labels.next}
      nextSize={lc.windowHeight > 0 && lc.windowHeight < layout.compactHeight ? 'lg' : 'hero'}
      onBack={() => dispatch({ type: 'back' })}
      onNext={() => dispatch({ type: 'next' })}
    />
  );

  const endPage = (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <ReaderEndPage
        copy={m.learner.story.end}
        mode={mode}
        hoyaLabel={m.a11y.hoya('cheering')}
        retellingNote={view.traditional ? story.origin.retellingNoteEn ?? null : null}
        onPrimary={onFinish}
        onReadAgain={() => dispatch({ type: 'restart' })}
        onSources={sources}
      />
    </ScrollView>
  );

  return (
    <Screen
      tone="canvas"
      scrollable={false}
      width={side ? 'full' : 'reading'}
      footer={!end && !side ? bottomBar : undefined}
      testID="story-reader"
    >
      <ReaderTopBar
        copy={copy}
        furthest={state.furthest}
        total={state.sceneCount}
        position={end ? null : view.labels.position}
        positionLabel={view.labels.scene}
        onClose={onClose}
        onSources={sources}
      />
      {side && !end ? (
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
