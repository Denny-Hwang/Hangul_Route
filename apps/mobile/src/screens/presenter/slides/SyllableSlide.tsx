import { Icon, colors, motion, presenter, spacing, typography } from '@hangul-route/design-system';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { syllableView } from '../../../logic/lecture/slide-view';
import { units } from '../../../logic/lecture/stage-constants';
import { STAGE_GAP, STAGE_GAP_INNER } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { SayIt } from './SayIt';
import { SpeakerButton } from './SpeakerButton';
import { revealProps } from './reveal';

type SyllableBody = Extract<Slide, { kind: 'syllable' }>;

/**
 * Syllable slide (design/screens/presenter/slide-syllable.md, README D5): build 0 shows the parts
 * (giyeok + a) at `presenter.size.display`; `join` makes them the
 * block at `presenter.size.glyph`, with the parts kept small beside it (`aria-hidden`); then the
 * romanization (the `syllableSplit` reading, D13) and the speaker, which plays on arrival forward.
 * The join slides a two-part syllable's parts together and fades them over `motion.duration.base`;
 * a syllable of three or more parts (one with a final consonant) only fades, since one fixed travel
 * cannot bring three glyphs to one centre. Under reduced motion the join is an instant swap with no
 * animation (spec sections 3.4 and 3.13). Going back to the parts is instant.
 */
export function SyllableSlide({
  slide,
  reveal,
  sayIt = false,
  onPlaySound,
}: {
  slide: SyllableBody;
  reveal: number;
  /** The room cannot hear the Korean: the speaker becomes the "Say it:" box (section 3.7, PR 9). */
  sayIt?: boolean;
  onPlaySound: () => void;
}): React.ReactElement {
  const { unit, reducedMotion } = usePresenterView();
  const size = useStageText();
  const view = syllableView(slide, reveal);
  const progress = useRef(new Animated.Value(view.joined ? 1 : 0)).current;
  const wasJoined = useRef(view.joined);
  const [sliding, setSliding] = useState(false);
  const displaySize = size(presenter.size.display);
  const promptSize = size(presenter.size.prompt);

  useEffect(() => {
    const forward = view.joined && !wasJoined.current;
    wasJoined.current = view.joined;
    if (!forward || reducedMotion) {
      progress.setValue(view.joined ? 1 : 0);
      setSliding(false);
      return undefined;
    }
    progress.setValue(0);
    setSliding(true);
    const run = Animated.timing(progress, { toValue: 1, duration: motion.duration.base, useNativeDriver: false });
    run.start(() => setSliding(false));
    return () => run.stop();
  }, [view.joined, progress, reducedMotion]);

  // How far each of two parts travels to meet the other: half a display glyph plus the gap between them.
  const twoParts = slide.parts.length === 2;
  const travel = units(unit, presenter.size.display / 2 + STAGE_GAP);
  const partsRow = (plus: number, fontSize: number, slideTogether: boolean) => (
    <>
      {slide.parts.map((part, i) => {
        const sign = i === 0 ? 1 : -1;
        const shift = slideTogether && twoParts ? [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, sign * travel] }) }] : [];
        return (
          <React.Fragment key={`${i}-${part}`}>
            {i > 0 ? <Icon name="plus" size={units(unit, plus)} color={colors.text.secondary} /> : null}
            <Animated.View style={{ transform: shift }}>
              <TaughtKo size={fontSize} style={{ lineHeight: fontSize }}>
                {part}
              </TaughtKo>
            </Animated.View>
          </React.Fragment>
        );
      })}
    </>
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {view.joined ? (
        <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP), opacity: progress }}>
          <TaughtKo size={size(presenter.size.glyph)} testID="presenter-syllable" style={{ lineHeight: size(presenter.size.glyph) }}>
            {slide.ko}
          </TaughtKo>
          <View style={{ gap: units(unit, STAGE_GAP_INNER), alignItems: 'flex-start' }}>
            <View aria-hidden style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP_INNER) }}>
              {partsRow(spacing.xxl, promptSize, false)}
            </View>
            <View {...revealProps(view.rom)}>
              <Text testID="presenter-syllable-rom" style={{ fontSize: promptSize, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
                {slide.split}
              </Text>
            </View>
            <View {...revealProps(view.sound)}>
              {sayIt ? <SayIt spoken={slide.spoken} /> : <SpeakerButton testID="presenter-syllable-speaker" enabled={view.sound} onPress={onPlaySound} />}
            </View>
          </View>
        </Animated.View>
      ) : null}
      {/* The parts: alone on build 0; while the join plays they slide together and fade over the block
          (`presenter-syllable-parts-leaving` for as long as they are drawn there). */}
      {!view.joined || sliding ? (
      <Animated.View
        aria-hidden={view.joined}
        pointerEvents="none"
        testID={view.joined ? 'presenter-syllable-parts-leaving' : 'presenter-syllable-parts'}
        style={[
          { flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP) },
          view.joined ? { position: 'absolute', opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) } : null,
        ]}
      >
        {partsRow(spacing.jumbo, displaySize, view.joined)}
      </Animated.View>
      ) : null}
    </View>
  );
}
