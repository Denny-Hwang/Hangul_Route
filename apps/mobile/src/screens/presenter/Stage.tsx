import { colors, presenter, radii, spacing, typography } from '@hangul-route/design-system';
import React, { useRef } from 'react';
import { Text, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import type { BuildName } from '../../logic/lecture/build-steps';
import type { Slide } from '../../logic/lecture/deck-builder';
import { gestureCommand, slideDetail } from '../../logic/lecture/shell';
import { units } from '../../logic/lecture/stage-constants';
import { STAGE_PADDING } from './stage-metrics';
import type { StageScale } from '../../logic/lecture/stage-scale';
import { usePresenterView, useStageText } from './presenter-context';
import { ActivitySlide } from './slides/ActivitySlide';
import { CardSlide } from './slides/CardSlide';
import { EndSlide } from './slides/EndSlide';
import { LetterSlide } from './slides/LetterSlide';
import { SequenceSlide } from './slides/SequenceSlide';
import { SyllableSlide } from './slides/SyllableSlide';
import { TitleSlide } from './slides/TitleSlide';
import { VocabSlide } from './slides/VocabSlide';

/**
 * The stage (design/screens/presenter/stage-and-bar.md): the slide on a logical 1280-unit stage,
 * centred in the stage box and letterboxed in paper, with the counter in its top-right padding and
 * a polite live region naming the slide. A tap on the left third goes back, elsewhere forward; a
 * horizontal swipe moves too (section 3.5). `touch-action: manipulation`: double taps never zoom.
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
  /** An activity slide's [ Start timer ]; absent until the timer overlay ships (PR 9), so the button is disabled. */
  onStartTimer?: (ms: number) => void;
}

export function Stage(props: StageProps): React.ReactElement {
  const { scale, slides, slideIdx, reveal } = props;
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const slide = slides[slideIdx]!;
  const shown = new Set<BuildName>(slide.builds.slice(0, reveal + 1));
  const start = useRef<{ x: number; y: number; locationX: number } | null>(null);

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
    const command = gestureCommand({ x: from.locationX, width: scale.stageWidth, dx: event.nativeEvent.pageX - from.x, dy: event.nativeEvent.pageY - from.y });
    if (command !== null) props.onCommand(command);
  };

  return (
    <View
      testID="presenter-stage"
      role="main"
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
      <Text
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
      <Text testID="presenter-live" aria-live="polite" accessibilityLiveRegion="polite" style={visuallyHidden}>
        {live}
      </Text>
      <View style={{ flex: 1 }} key={slide.key}>
        {slide.kind === 'title' ? (
          <TitleSlide slide={slide} {...(slideIdx === 0 ? { deckTitle: props.deckTitle } : {})} />
        ) : slide.kind === 'letter' ? (
          <LetterSlide slide={slide} shown={shown} strokeToken={props.strokeToken} onPlaySound={props.onPlaySound} />
        ) : slide.kind === 'syllable' ? (
          <SyllableSlide slide={slide} reveal={reveal} onPlaySound={props.onPlaySound} />
        ) : slide.kind === 'vocab' ? (
          <VocabSlide slide={slide} reveal={reveal} />
        ) : slide.kind === 'sequence' ? (
          <SequenceSlide slide={slide} reveal={reveal} />
        ) : slide.kind === 'card' ? (
          <CardSlide slide={slide} reveal={reveal} />
        ) : slide.kind === 'activity' ? (
          <ActivitySlide slide={slide} {...(props.onStartTimer ? { onStartTimer: props.onStartTimer } : {})} />
        ) : slide.kind === 'end' ? (
          <EndSlide slide={slide} joinCta={props.joinCta} />
        ) : null}
      </View>
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
 * bottom, above the bar, for the End slide's "To finish, choose Exit." (slide-end.md).
 */
export function StageHint({ text, bottom }: { text: string; bottom?: boolean }): React.ReactElement {
  return (
    <View
      testID={bottom ? 'presenter-end-hint' : 'presenter-portrait-hint'}
      role="status"
      pointerEvents="none"
      style={{
        position: 'absolute',
        ...(bottom ? { bottom: spacing.md } : { top: spacing.md }),
        alignSelf: 'center',
        backgroundColor: colors.surface.sunken,
        borderRadius: radii.pill,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Text style={{ fontSize: typography.size.body, color: colors.text.primary }}>{text}</Text>
    </View>
  );
}
