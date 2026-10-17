import { colors, presenter, radii, spacing, typography, KOREAN_LINE_BREAK, useTypeScale } from '@hangul-route/design-system';
import { LOCALE_META } from '@hangul-route/i18n';
import React, { useRef } from 'react';
import { Text, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RomanizationMode } from '@hangul-route/content-schema';
import type { BuildName } from '../../logic/lecture/build-steps';
import type { Slide } from '../../logic/lecture/deck-builder';
import { barOverlap, gestureCommand, inBarStrip, slideDetail } from '../../logic/lecture/shell';
import type { LectureSceneView } from '../../logic/lecture/sources/story';
import { units } from '../../logic/lecture/stage-constants';
import { STAGE_PADDING } from './stage-metrics';
import type { StageScale } from '../../logic/lecture/stage-scale';
import { usePresenterView, useStageText } from './presenter-context';
import { ActivitySlide } from './slides/ActivitySlide';
import { CardSlide } from './slides/CardSlide';
import { QuizSlide } from './slides/QuizSlide';
import { EndSlide } from './slides/EndSlide';
import { LetterSlide } from './slides/LetterSlide';
import { SequenceSlide } from './slides/SequenceSlide';
import { SyllableSlide } from './slides/SyllableSlide';
import { StoryCheckSlide, isStoryCheck } from './slides/StoryCheckSlide';
import { StorySlide } from './slides/StorySlide';
import { TitleSlide } from './slides/TitleSlide';
import { VocabSlide } from './slides/VocabSlide';

/**
 * The stage (design/screens/presenter/stage-and-bar.md): the slide on a logical 1280-unit stage,
 * centred in the stage box and letterboxed in paper, with the counter in its top-right padding and
 * a polite live region naming the slide. A tap on the left third goes back, elsewhere forward; a
 * horizontal swipe moves too (section 3.5). `touch-action: manipulation`: double taps never zoom.
 * In a phone window the compact bar floats over the stage's bottom edge and is out of the way
 * whenever the slide changes (F-TCH-004 section 3.6): a tap in its strip (`inBarStrip`) shows or
 * hides it instead of stepping, and a short grabber in the stage's bottom margin, where no slide
 * draws, marks the strip. The stage is marked with the slide language (`lang`), which may differ
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
  onCommand: (command: 'next' | 'prev') => void;
  onPlaySound: () => void;
  /** An activity slide's [ Start timer ]: opens the class timer with the slide's minutes. */
  onStartTimer?: (ms: number) => void;
  /** The deck's romanization mode now (the live Shift+R flip included), for quiz options (D2). */
  romanization: RomanizationMode;
  /** The room cannot hear the Korean: sound builds show the teacher-says text (section 3.7). */
  sayIt: boolean;
  /** A listed story's scene: its art, theme and accessible name (`sources/story.ts`). */
  storyScene: (storyId: string, sceneId: string) => LectureSceneView | undefined;
  /** A phone window: the compact bar's strip above the bottom inset, in window pixels (`PHONE_BAR_STRIP`). Absent: no strip. */
  barStrip?: number;
  /** A tap in the strip: show or hide the bar. */
  onStripTap?: () => void;
}

export function Stage(props: StageProps): React.ReactElement {
  const { scale, slides, slideIdx, reveal } = props;
  const { unit, messages, locale } = usePresenterView();
  const size = useStageText();
  const slide = slides[slideIdx]!;
  const lang = LOCALE_META[locale].htmlLang;
  const shown = new Set<BuildName>(slide.builds.slice(0, reveal + 1));
  const start = useRef<{ x: number; y: number; locationX: number } | null>(null);
  // In a phone window the stage is centred inside the safe area: its top is the top inset plus the
  // letterbox, and the bar's strip is what of it reaches above the letterbox.
  const insets = useSafeAreaInsets();
  const stageTop = insets.top + scale.offsetY;
  const strip = props.barStrip === undefined ? 0 : barOverlap(props.barStrip, 0, scale.offsetY);

  const kind = messages.learner.presenter.grid.kind[slide.kind];
  const detail = slideDetail(slide, { activity: (preset) => messages.learner.presenter.activity[preset] });
  const live = messages.a11y.presenter.slide(slideIdx + 1, slides.length, detail === '' ? kind : `${kind}, ${detail}`);

  const onGrant = (event: GestureResponderEvent): void => {
    const { pageX, pageY, locationX } = event.nativeEvent;
    start.current = { x: pageX, y: pageY, locationX };
  };
  const onRelease = (event: GestureResponderEvent): void => {
    const from = start.current;
    start.current = null;
    if (from === null) return;
    const dx = event.nativeEvent.pageX - from.x;
    const dy = event.nativeEvent.pageY - from.y;
    if (inBarStrip({ y: from.y - stageTop, height: scale.stageHeight, strip, dx, dy })) {
      props.onStripTap?.();
      return;
    }
    const command = gestureCommand({ x: from.locationX, width: scale.stageWidth, dx, dy });
    if (command !== null) props.onCommand(command);
  };

  return (
    <View
      testID="presenter-stage"
      role="main"
      {...{ lang, accessibilityLanguage: lang }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={onGrant}
      onResponderRelease={onRelease}
      onResponderTerminate={() => {
        start.current = null;
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
        ) : slide.kind === 'quiz' ? (
          <QuizSlide slide={slide} shown={shown} romanization={props.romanization} sayIt={props.sayIt} onPlaySound={props.onPlaySound} />
        ) : slide.kind === 'activity' ? (
          <ActivitySlide slide={slide} {...(props.onStartTimer ? { onStartTimer: props.onStartTimer } : {})} />
        ) : slide.kind === 'story' ? (
          <StorySlide slide={slide} shown={shown} scene={props.storyScene(slide.storyId, slide.sceneId)} />
        ) : slide.kind === 'end' ? (
          <EndSlide slide={slide} joinCta={props.joinCta} />
        ) : null}
      </View>
      {props.barStrip !== undefined ? <Grabber pad={units(unit, STAGE_PADDING)} /> : null}
    </View>
  );
}

/**
 * The bar strip's grabber (stage-and-bar.md "Phone"): a short pill (`spacing.xxxl` x `spacing.xs`,
 * `border.strong`, `radii.pill`) centred in the stage's bottom margin, where no slide draws, so it
 * covers nothing. Decorative: hidden from assistive tech and taking no touch.
 */
function Grabber({ pad }: { pad: number }): React.ReactElement {
  return (
    <View
      testID="presenter-grabber"
      aria-hidden
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(0, (pad - spacing.xs) / 2),
        alignItems: 'center',
      }}
    >
      <View style={{ width: spacing.xxxl, height: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.border.strong }} />
    </View>
  );
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
 * End hint sits at the top too, clear of the bar's strip.
 */
export function StageHint({ text, bottom }: { text: string; bottom?: boolean }): React.ReactElement {
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
