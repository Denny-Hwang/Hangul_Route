import { Hoya, colors, koreanTextLabel, presenter, spacing, typography } from '@hangul-route/design-system';
import React, { useRef } from 'react';
import { Text, View } from 'react-native';
import { PAUSE_WORD } from '../../../logic/lecture/content';
import { HOYA_STAGE, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { Cover, ToolButton } from './OverlayParts';

/**
 * Blank and Pause (design/screens/presenter/overlays.md "Blank and pause", README D18; spec
 * section 3.5). Blank: Hoya waving and "Eyes on me", with a ghost Pause button that swaps Blank
 * for Pause in the covering slot. The dialog focuses its container, not the button, so Space and
 * Enter from a keyboard or clicker still clear it. Pause: Hoya and the taught word (`PAUSE_WORD`)
 * as a Korean chip with its romanization and its gloss in the presenter language. Both leave the
 * slide untouched; the first next or back only closes them.
 */
export function BlankOverlay({ onPause }: { onPause: () => void }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const m = messages.learner.presenter.blank;
  const pause = useRef<View>(null);
  return (
    <Cover label={m.line} testID="presenter-blank" focusables={() => [pause.current]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: units(unit, STAGE_GAP_INNER) }}>
        <Hoya pose="waving" size={units(unit, HOYA_STAGE)} accessibilityLabel={messages.a11y.hoya('waving')} />
        <Text role="heading" style={{ fontSize: size(presenter.size.title), fontWeight: typography.weight.bold, color: colors.text.primary, textAlign: 'center' }}>
          {m.line}
        </Text>
        <ToolButton ref={pause} testID="presenter-blank-pause" label={m.pause.cta} onPress={onPause} />
      </View>
    </Cover>
  );
}

export function PauseOverlay(): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const promptSize = size(presenter.size.display);
  const bodySize = size(presenter.size.prompt);
  const gloss = messages.learner.presenter.pause.gloss;
  return (
    <Cover label={`${PAUSE_WORD.romanization}, ${gloss}`} testID="presenter-pause">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: units(unit, STAGE_GAP_INNER) }}>
        <Hoya pose="idle" size={units(unit, HOYA_STAGE)} accessibilityLabel={messages.a11y.hoya('idle')} />
        <View
          accessibilityLabel={koreanTextLabel(PAUSE_WORD.ko, PAUSE_WORD.romanization)}
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: units(unit, spacing.lg),
            paddingVertical: units(unit, spacing.sm),
            paddingHorizontal: units(unit, spacing.xxl),
            borderRadius: units(unit, STAGE_RADIUS),
            borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
            borderColor: colors.brand.secondary,
            backgroundColor: colors.brand.secondaryLight,
          }}
        >
          <TaughtKo size={promptSize}>{PAUSE_WORD.ko}</TaughtKo>
          {/* text.secondary misses 7:1 on brand.secondaryLight (presenter.v1.md), so the romanization is text.primary here. */}
          <Text style={{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: colors.text.primary }}>{PAUSE_WORD.romanization}</Text>
        </View>
        <Text testID="presenter-pause-gloss" style={{ fontSize: bodySize, fontWeight: typography.weight.bold, color: colors.text.secondary }}>
          {gloss}
        </Text>
      </View>
    </Cover>
  );
}
