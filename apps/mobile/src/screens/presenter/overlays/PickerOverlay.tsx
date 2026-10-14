import type { PickerMode } from '@hangul-route/content-schema';
import { Hoya, borderWidth, colors, motion, presenter, spacing, typography } from '@hangul-route/design-system';
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import type { PickerEvent, PickerState } from '../../../logic/lecture/picker';
import { PICKER_BOX_HEIGHT, PICKER_BOX_WIDTH, QUIZ_ANSWER_HOYA, units } from '../../../logic/lecture/stage-constants';
import { STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { usePresenterView, useStageText } from '../presenter-context';
import { ChipRadios, Cover, ToolButton } from './OverlayParts';

/**
 * The helper picker (design/screens/presenter/overlays.md "Helper picker", README D11; spec
 * section 3.5, TD5): "Who's helping next?", one drawn label in a bordered box, Draw / Undo /
 * Another / Close, and the mode chips of the modes the presenter has. A turn-taking tool, never a
 * score: no count of who is left, no list of who has gone, no history and no "skipped" mark.
 * Another puts the label back and draws again with no reason given. The draw fades in over
 * `motion.duration.crawl`; instant under reduced motion.
 */
export function PickerOverlay({
  picker,
  modes,
  onEvent,
  onMode,
  onClose,
}: {
  picker: PickerState;
  modes: readonly PickerMode[];
  onEvent: (event: PickerEvent) => void;
  onMode: (mode: PickerMode) => void;
  onClose: () => void;
}): React.ReactElement {
  const { unit, messages, reducedMotion } = usePresenterView();
  const size = useStageText();
  const m = messages.learner.presenter.picker;
  const draw = useRef<View>(null);
  const shown = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (picker.current === null || reducedMotion) {
      shown.setValue(1);
      return;
    }
    shown.setValue(0);
    Animated.timing(shown, { toValue: 1, duration: motion.duration.crawl, useNativeDriver: false }).start();
  }, [picker.current, picker.bag, reducedMotion, shown]);

  const empty = picker.phase === 'empty';
  const drawn = picker.current !== null;
  const titleSize = size(presenter.size.title);
  return (
    <Cover label={m.title} testID="presenter-picker" initialFocus={draw}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: units(unit, STAGE_GAP_INNER), padding: units(unit, spacing.xxxl) }}>
        <Text role="heading" style={{ fontSize: size(presenter.size.prompt), fontWeight: typography.weight.bold, color: colors.text.primary, textAlign: 'center' }}>
          {m.title}
        </Text>
        <View
          style={{
            minWidth: units(unit, PICKER_BOX_WIDTH),
            minHeight: units(unit, PICKER_BOX_HEIGHT),
            paddingHorizontal: units(unit, spacing.xxl),
            borderRadius: units(unit, STAGE_RADIUS),
            borderWidth: borderWidth.thick,
            borderColor: colors.border.strong,
            backgroundColor: colors.surface.paper,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: units(unit, spacing.xl),
          }}
        >
          {empty ? <Hoya pose="cheering" size={units(unit, QUIZ_ANSWER_HOYA)} accessibilityLabel={messages.a11y.hoya('cheering')} /> : null}
          <Animated.Text
            testID="presenter-picker-label"
            aria-live="polite"
            accessibilityLiveRegion="polite"
            numberOfLines={1}
            style={{
              opacity: shown,
              fontSize: drawn ? titleSize : size(presenter.size.body),
              fontWeight: drawn ? typography.weight.bold : typography.weight.semibold,
              color: drawn ? colors.text.primary : colors.text.secondary,
            }}
          >
            {empty ? m.empty : drawn ? picker.current : m.ready}
          </Animated.Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
          {empty ? (
            <ToolButton ref={draw} testID="presenter-picker-start-again" primary label={m.startAgain.cta} onPress={() => onEvent('reset')} />
          ) : (
            <ToolButton ref={draw} testID="presenter-picker-draw" primary label={m.draw.cta} onPress={() => onEvent('draw')} />
          )}
          <ToolButton testID="presenter-picker-undo" label={m.undo.cta} disabled={!drawn} onPress={() => onEvent('undo')} />
          <ToolButton testID="presenter-picker-another" label={m.another.cta} disabled={!drawn || picker.bag.length === 0} onPress={() => onEvent('skip')} />
          <ToolButton testID="presenter-picker-close" label={messages.common.buttons.close} onPress={onClose} />
        </View>
        {modes.length > 1 ? (
          <ChipRadios
            testID="presenter-picker-mode"
            label={messages.learner.presenter.start.picker.title}
            options={modes.map((mode) => ({ value: mode, label: m.mode[mode] }))}
            selected={picker.mode}
            onSelect={onMode}
          />
        ) : null}
      </View>
    </Cover>
  );
}
