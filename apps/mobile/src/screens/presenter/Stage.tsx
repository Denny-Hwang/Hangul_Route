import { colors, presenter, radii, spacing, KOREAN_LINE_BREAK, useTypeScale } from '@hangul-route/design-system';
import { LOCALE_META } from '@hangul-route/i18n';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { Text, View, useWindowDimensions, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RomanizationMode } from '@hangul-route/content-schema';
import type { BuildName } from '../../logic/lecture/build-steps';
import type { Slide } from '../../logic/lecture/deck-builder';
import { buildLive, slideDetail, type BuildLive } from '../../logic/lecture/shell';
import {
  edgeGuard,
  gesturePointer,
  parseStageTarget,
  slideHasTargets,
  stageGesture,
  type GesturePointer,
  type StageCommand,
  type StageCovering,
  type StageTarget,
} from '../../logic/lecture/stage-gesture';
import { gridKindKey } from '../../logic/lecture/tools';
import type { LectureSceneView } from '../../logic/lecture/sources/story';
import { units } from '../../logic/lecture/stage-constants';
import { STAGE_PADDING } from './stage-metrics';
import type { NavLayout, StageScale } from '../../logic/lecture/stage-scale';
import { usePresenterView, useStageText } from './presenter-context';
import { ActivitySlide } from './slides/ActivitySlide';
import { CardSlide } from './slides/CardSlide';
import { QuizSlide } from './slides/QuizSlide';
import { QuestionSlide, isListenOrReply } from './slides/QuestionSlide';
import { EndSlide } from './slides/EndSlide';
import { LetterSlide } from './slides/LetterSlide';
import { PatternSlide } from './slides/PatternSlide';
import { ReadAlongSlide } from './slides/ReadAlongSlide';
import { RealiaQuestionSlide, isRealiaQuestion } from './slides/RealiaQuestionSlide';
import { RealiaSlide } from './slides/RealiaSlide';
import { SentenceBuildSlide } from './slides/SentenceBuildSlide';
import { SentenceSlide } from './slides/SentenceSlide';
import { SequenceSlide } from './slides/SequenceSlide';
import { SyllableSlide } from './slides/SyllableSlide';
import { WriteTogetherSlide } from './slides/WriteTogetherSlide';
import { StoryCheckSlide, isStoryCheck } from './slides/StoryCheckSlide';
import { StorySlide } from './slides/StorySlide';
import { TitleSlide } from './slides/TitleSlide';
import { VocabSlide } from './slides/VocabSlide';

/**
 * The stage (design/screens/presenter/stage-and-bar.md): the slide on a logical 1280-unit stage,
 * centred in the stage box and letterboxed in paper, with the counter in its top-right padding and
 * a polite live region naming the slide. The stage is the only owner of a gesture on the slide
 * (AMENDMENTS-PRESENTER-NAV sections 6 and 7): it reads, at the grant, the content target the
 * gesture started on (`data-stage-target`) and the gesture's own pointer, follows the first touch
 * by its identifier and counts the most touches down at once, and on release hands the rule's
 * command (`stageGesture`) to the presenter: a swipe steps, a tap never steps by touch nor on a
 * content target, and no part of the stage is a hidden zone. `touch-action: manipulation`: double
 * taps never zoom. The stage is marked with the slide language (`lang`), which may differ
 * from the chrome's (`<html lang>`, the device's) when the deck names one, so a screen reader reads
 * the slides in their own voice (WCAG 3.1.2).
 */
export interface StageProps {
  scale: StageScale;
  slides: readonly Slide[];
  slideIdx: number;
  reveal: number;
  deckTitle: string;
  strokeToken: number;
  joinCta: string;
  /** A gesture's command (`stageGesture`), never null. */
  onGesture: (command: Exclude<StageCommand, null>) => void;
  /** Where Previous and Next live (`navLayout`): a touch tap on empty stage shows or hides the overlay bar, elsewhere rings Next. */
  layout: NavLayout;
  /** What covers the stage now: the More sheet (a tap closes it), another covering overlay, or nothing. */
  covering: StageCovering;
  /** A tap on an option points at it (owner choice O2, row PN-5); false: it does nothing. */
  pointing: boolean;
  /** The last `pointerdown`'s kind (`subscribeInputKind`), so a pen's mouse-type events count as touch. */
  lastPointer: () => GesturePointer | null;
  onPlaySound: () => void;
  /** An activity slide's [ Start timer ]: opens the class timer with the slide's minutes. */
  onStartTimer?: (ms: number) => void;
  /** The deck's romanization mode now (the live Shift+R flip included), for quiz options (D2). */
  romanization: RomanizationMode;
  /** The room cannot hear the Korean: sound builds show the teacher-says text (section 3.7). */
  sayIt: boolean;
  /** A listed story's scene: its art, theme and accessible name (`sources/story.ts`). */
  storyScene: (storyId: string, sceneId: string) => LectureSceneView | undefined;
  /** The read-along line Sound is playing on this slide, lit while it plays (V6); null when none. */
  playingLine?: number | null;
}

export function Stage(props: StageProps): ReactElement {
  const { scale, slides, slideIdx, reveal } = props;
  const { unit, messages, locale } = usePresenterView();
  const size = useStageText();
  const slide = slides[slideIdx]!;
  const lang = LOCALE_META[locale].htmlLang;
  const shown = new Set<BuildName>(slide.builds.slice(0, reveal + 1));
  const gesture = useRef<Gesture | null>(null);
  const insets = useSafeAreaInsets();
  const windowWidth = useWindowDimensions().width;

  const kind = messages.learner.presenter.grid.kind[gridKindKey(slide.kind)];
  const detail = slideDetail(slide, {
    activity: (preset) => messages.learner.presenter.activity[preset],
    slot: messages.a11y.presenter.slot,
    listen: messages.learner.presenter.quiz.listen,
    reply: messages.learner.presenter.quiz.reply,
    build: messages.learner.presenter.slide.build.next,
    particle: messages.learner.presenter.slide.build.particle,
    frame: messages.learner.presenter.slide.write.frame,
    ownName: messages.learner.presenter.slide.write.ownName,
  }, reveal);
  // A sentence-build move says what it placed (section 10, LV-S3), a write-together build what it showed (LV-S4); anything else announces the slide.
  const lastLive = useRef<BuildLive | null>(null);
  const liveNow = buildLive(slide, reveal, lastLive.current, messages.a11y.presenter.tilePlaced, messages.learner.presenter.slide.write.example);
  useEffect(() => {
    lastLive.current = liveNow;
  });
  const live = liveNow.words ?? messages.a11y.presenter.slide(slideIdx + 1, slides.length, detail === '' ? kind : `${kind}, ${detail}`);

  const onGrant = (event: GestureResponderEvent): void => {
    const native = event.nativeEvent as unknown as ResponderNative;
    const first = native.changedTouches?.[0] ?? native;
    const id = first.identifier ?? 0;
    gesture.current = {
      id,
      x0: first.pageX,
      y0: first.pageY,
      x: first.pageX,
      y: first.pageY,
      touches: Math.max(1, native.touches?.length ?? 1),
      pointer: gesturePointer(native.type, props.lastPointer()),
      target: parseStageTarget(markerAt(event.target ?? native.target)),
    };
  };
  /** A finger down, moved or lifted during the gesture: the most touches at once, and where the tracked one is. */
  const onTouches = (event: GestureResponderEvent): void => {
    const g = gesture.current;
    if (g === null) return;
    const native = event.nativeEvent as unknown as ResponderNative;
    g.touches = Math.max(g.touches, native.touches?.length ?? 0);
    const tracked = findTouch(native, g.id);
    if (tracked) {
      g.x = tracked.pageX;
      g.y = tracked.pageY;
    }
  };
  const onRelease = (event: GestureResponderEvent): void => {
    onTouches(event);
    const g = gesture.current;
    gesture.current = null;
    if (g === null) return;
    const command = stageGesture({
      pointer: g.pointer,
      dx: g.x - g.x0,
      dy: g.y - g.y0,
      startX: g.x0,
      windowWidth,
      edgeGuard: edgeGuard(insets),
      touches: g.touches,
      target: g.target,
      slideHasTargets: slideHasTargets(slide),
      layout: props.layout,
      covering: props.covering,
      pointing: props.pointing,
    });
    if (command !== null) props.onGesture(command);
  };

  return (
    <View
      testID="presenter-stage"
      role="main"
      {...{ lang, accessibilityLanguage: lang }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={onGrant}
      onResponderStart={onTouches}
      onResponderMove={onTouches}
      onResponderEnd={onTouches}
      onResponderRelease={onRelease}
      onResponderTerminate={() => {
        gesture.current = null;
      }}
      style={{
        width: scale.stageWidth,
        height: scale.stageHeight,
        padding: units(unit, STAGE_PADDING),
        backgroundColor: colors.surface.paper,
        ...manipulation,
        overflow: 'hidden',
      }}
    >
      <Text {...KOREAN_LINE_BREAK}
        aria-hidden
        testID="presenter-counter"
        style={{
          position: 'absolute',
          top: units(unit, spacing.lg),
          right: units(unit, spacing.xl),
          fontSize: size(presenter.size.caption),
          color: colors.text.secondary,
          fontVariant: ['tabular-nums'],
        }}
      >
        {messages.learner.presenter.bar.counter(slideIdx + 1, slides.length)}
      </Text>
      <Text {...KOREAN_LINE_BREAK} testID="presenter-live" aria-live="polite" accessibilityLiveRegion="polite" style={visuallyHidden}>
        {live}
      </Text>
      <View style={{ flex: 1 }} key={slide.key}>
        {slide.kind === 'title' ? (
          <TitleSlide
            slide={slide}
            {...(slideIdx === 0 ? { deckTitle: props.deckTitle } : {})}
            {...(slide.cover !== undefined ? { cover: props.storyScene(slide.cover.storyId, slide.cover.sceneId) } : {})}
          />
        ) : slide.kind === 'letter' ? (
          <LetterSlide slide={slide} shown={shown} strokeToken={props.strokeToken} sayIt={props.sayIt} onPlaySound={props.onPlaySound} />
        ) : slide.kind === 'syllable' ? (
          <SyllableSlide slide={slide} reveal={reveal} sayIt={props.sayIt} onPlaySound={props.onPlaySound} />
        ) : slide.kind === 'vocab' ? (
          <VocabSlide slide={slide} reveal={reveal} />
        ) : slide.kind === 'sequence' ? (
          <SequenceSlide slide={slide} reveal={reveal} />
        ) : slide.kind === 'card' ? (
          <CardSlide slide={slide} reveal={reveal} />
        ) : isStoryCheck(slide) ? (
          <StoryCheckSlide slide={slide} shown={shown} romanization={props.romanization} />
        ) : isListenOrReply(slide) ? (
          <QuestionSlide slide={slide} shown={shown} romanization={props.romanization} sayIt={props.sayIt} onPlaySound={props.onPlaySound} />
        ) : isRealiaQuestion(slide) ? (
          <RealiaQuestionSlide slide={slide} shown={shown} romanization={props.romanization} />
        ) : slide.kind === 'quiz' ? (
          <QuizSlide slide={slide} shown={shown} romanization={props.romanization} sayIt={props.sayIt} onPlaySound={props.onPlaySound} />
        ) : slide.kind === 'activity' ? (
          <ActivitySlide slide={slide} {...(props.onStartTimer ? { onStartTimer: props.onStartTimer } : {})} />
        ) : slide.kind === 'story' ? (
          <StorySlide slide={slide} shown={shown} scene={props.storyScene(slide.storyId, slide.sceneId)} />
        ) : slide.kind === 'end' ? (
          <EndSlide slide={slide} joinCta={props.joinCta} />
        ) : slide.kind === 'sentence' ? (
          <SentenceSlide slide={slide} reveal={reveal} />
        ) : slide.kind === 'pattern' ? (
          <PatternSlide slide={slide} reveal={reveal} />
        ) : slide.kind === 'read-along' ? (
          <ReadAlongSlide slide={slide} reveal={reveal} playing={props.playingLine ?? null} />
        ) : slide.kind === 'realia' ? (
          <RealiaSlide slide={slide} reveal={reveal} />
        ) : slide.kind === 'sentence-build' ? (
          <SentenceBuildSlide slide={slide} reveal={reveal} />
        ) : slide.kind === 'write-together' ? (
          <WriteTogetherSlide slide={slide} reveal={reveal} romanization={props.romanization} />
        ) : null}
      </View>
    </View>
  );
}

/** A gesture on the stage, from its grant: the first touch (by identifier) and where it is now, in window px. */
interface Gesture {
  id: number | string;
  x0: number;
  y0: number;
  x: number;
  y: number;
  /** The most touches down at once so far. */
  touches: number;
  pointer: GesturePointer;
  target: StageTarget;
}

interface ResponderTouch {
  /** A number on the web (react-native-web normalizes it); typed as React Native's string too. */
  identifier?: number | string;
  pageX: number;
  pageY: number;
}

/** The responder event's native part (react-native-web: a mouse event is one emulated touch, `type` the DOM event's). */
interface ResponderNative extends ResponderTouch {
  type?: string;
  target?: unknown;
  touches?: readonly ResponderTouch[];
  changedTouches?: readonly ResponderTouch[];
}

/** The tracked touch in this event: lifted (`changedTouches`) or still down (`touches`); never another finger. */
function findTouch(native: ResponderNative, id: number | string): ResponderTouch | undefined {
  const match = (t: ResponderTouch): boolean => (t.identifier ?? 0) === id;
  return native.changedTouches?.find(match) ?? native.touches?.find(match);
}

/** The content-target marker of the node a gesture started on, or of the nearest node above it (web); null when none. */
function markerAt(target: unknown): string | null {
  const node = target as { closest?: (selector: string) => { getAttribute?: (name: string) => string | null } | null } | null | undefined;
  if (!node || typeof node.closest !== 'function') return null;
  return node.closest('[data-stage-target]')?.getAttribute?.('data-stage-target') ?? null;
}

/** `touch-action: manipulation` (web): no double-tap zoom on the stage. Not in the native style types. */
const manipulation = { touchAction: 'manipulation' } as unknown as ViewStyle;

/** Read by assistive tech, not drawn (a 1 px clipped box). */
const visuallyHidden = {
  position: 'absolute' as const,
  width: 1,
  height: 1,
  overflow: 'hidden' as const,
  opacity: 0,
};

/**
 * A non-blocking pill over the stage box: at the top for the portrait hint (section 3.8), at the
 * bottom, above the bar, for the End slide's "To finish, choose Exit." (slide-end.md). On a phone the
 * End hint sits at the top too, clear of the floating bar.
 */
export function StageHint({ text, bottom }: { text: string; bottom?: boolean }): ReactElement {
  const textScale = useTypeScale();
  return (
    <View
      testID={bottom === undefined ? 'presenter-portrait-hint' : 'presenter-end-hint'}
      role="status"
      pointerEvents="none"
      style={{
        position: 'absolute',
        ...(bottom === true ? { bottom: spacing.md } : { top: spacing.md }),
        alignSelf: 'center',
        backgroundColor: colors.surface.sunken,
        borderRadius: radii.pill,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, color: colors.text.primary }}>{text}</Text>
    </View>
  );
}
