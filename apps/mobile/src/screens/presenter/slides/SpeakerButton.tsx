import { Icon, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable } from 'react-native';
import { stageButtonSize, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN } from '../stage-metrics';
import { usePresenterView, useStageControlFloor } from '../presenter-context';

/**
 * The round speaker on the stage (slide-letter.md, slide-syllable.md): a `brand.secondary` ring
 * and a `brand.secondaryDark` glyph on paper, never below `touchTarget.hero` (`touchTarget.min`
 * in a phone window), named "Play the sound". Disabled while its build is not reached.
 */
export function SpeakerButton({ enabled, onPress, testID }: { enabled: boolean; onPress: () => void; testID?: string }): React.ReactElement {
  const { unit, messages, soundBlocked } = usePresenterView();
  const size = stageButtonSize(unit, touchTarget.hero, useStageControlFloor());
  return (
    <Pressable
      testID={testID}
      role="button"
      accessibilityLabel={soundBlocked ? messages.learner.audio.tapToHear : messages.learner.presenter.quiz.playPrompt}
      disabled={!enabled}
      onPress={onPress}
      style={(state) => ({
        width: size,
        height: size,
        borderRadius: radii.circle,
        borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
        borderColor: (state as { focused?: boolean }).focused ? colors.border.focus : colors.brand.secondary,
        backgroundColor: colors.surface.paper,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Icon name="speaker" size={Math.max(spacing.xxl, units(unit, spacing.xxxl))} color={colors.brand.secondaryDark} />
    </Pressable>
  );
}
