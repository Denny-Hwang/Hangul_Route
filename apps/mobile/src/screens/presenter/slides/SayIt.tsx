import { colors, koreanTextLabel, presenter, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import type { SpokenForm } from '../../../logic/audio/spoken';
import { units } from '../../../logic/lecture/stage-constants';
import { STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';

/**
 * The teacher-says text (spec section 3.7; slide-letter.md "No Korean voice or sound off",
 * slide-quiz.md): when the room cannot hear the Korean, the speaker gives way to a "Say it:" box on
 * `surface.sunken` with the spoken syllable and its romanization at `presenter.size.prompt` (and a
 * letter's IPA in brackets), all `text.primary`, the only 7:1 text on sunken. The teacher reads it
 * aloud; nothing records or measures speech.
 */
export function SayIt({ spoken, ipa }: { spoken: SpokenForm; ipa?: string }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const promptSize = size(presenter.size.prompt);
  return (
    <View
      testID="presenter-say-it"
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: units(unit, spacing.md),
        paddingVertical: units(unit, spacing.xs),
        paddingHorizontal: units(unit, spacing.xl),
        borderRadius: units(unit, STAGE_RADIUS),
        backgroundColor: colors.surface.sunken,
        alignSelf: 'flex-start',
      }}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: size(presenter.size.caption), fontWeight: typography.weight.semibold, color: colors.text.primary }}>{messages.learner.presenter.slide.sayIt}</Text>
      <View accessibilityLabel={koreanTextLabel(spoken.text, spoken.romanization)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: units(unit, spacing.md) }}>
        <TaughtKo size={promptSize}>{spoken.text}</TaughtKo>
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.primary }}>{spoken.romanization}</Text>
      </View>
      {ipa !== undefined ? <Text {...KOREAN_LINE_BREAK} style={{ fontSize: promptSize, color: colors.text.primary }}>{`[${ipa}]`}</Text> : null}
    </View>
  );
}
