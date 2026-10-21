import { colors, koreanTextLabel, presenter, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import type { SpokenForm } from '../../../logic/audio/spoken';
import { units } from '../../../logic/lecture/stage-constants';
import { STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { revealProps } from './reveal';

/**
 * The teacher-says text (spec section 3.7; slide-letter.md "No Korean voice or sound off",
 * slide-quiz.md): when the room cannot hear the Korean, the speaker gives way to a "Say it:" box on
 * `surface.sunken` with the spoken syllable and its romanization at `presenter.size.prompt` (and a
 * letter's IPA in brackets), all `text.primary`, the only 7:1 text on sunken. The teacher reads it
 * aloud; nothing records or measures speech.
 */
export function SayIt({
  spoken,
  ipa,
  koShown,
}: {
  spoken: SpokenForm;
  ipa?: string;
  /**
   * A listen question (AMENDMENTS-LECTURE-V2 section 5.1, LV-S2): the romanization comes first, as the
   * teacher reads it, and the Hangul waits in its place, unread, until `koShown` (its answer build),
   * because showing it at once would give the answer away. Absent: the Hangul first, always shown.
   */
  koShown?: boolean;
}): React.ReactElement {
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
      {koShown === undefined ? (
        <View accessibilityLabel={koreanTextLabel(spoken.text, spoken.romanization)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: units(unit, spacing.md) }}>
          <TaughtKo size={promptSize}>{spoken.text}</TaughtKo>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.primary }}>{spoken.romanization}</Text>
        </View>
      ) : (
        <View
          accessibilityLabel={koShown ? koreanTextLabel(spoken.text, spoken.romanization) : spoken.romanization}
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.lg) }}
        >
          <Text {...KOREAN_LINE_BREAK} testID="presenter-say-it-rom" style={{ fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.primary }}>{spoken.romanization}</Text>
          <View testID="presenter-say-it-ko" {...revealProps(koShown)}>
            <TaughtKo size={promptSize}>{spoken.text}</TaughtKo>
          </View>
        </View>
      )}
      {ipa !== undefined ? <Text {...KOREAN_LINE_BREAK} style={{ fontSize: promptSize, color: colors.text.primary }}>{`[${ipa}]`}</Text> : null}
    </View>
  );
}
