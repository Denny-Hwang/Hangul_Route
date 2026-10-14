import { Hoya, borderWidth, colors, presenter, radii, spacing, touchTarget, typography } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { activityTimerMs } from '../../../logic/lecture/slide-view';
import { HOYA_STAGE, STAGE_CTA_HEIGHT, units } from '../../../logic/lecture/stage-constants';
import { STAGE_GAP, STAGE_GAP_INNER } from '../stage-metrics';
import { usePresenterView, useStageText } from '../presenter-context';

type ActivityBody = Extract<Slide, { kind: 'activity' }>;

/**
 * Activity slide (design/screens/presenter/slide-activity.md): Hoya cheering, "Activity", the
 * preset's name, its minutes and a big [ Start timer ] that opens the class timer with those
 * minutes. The timer never starts by itself, only fills and shows the time left, and scores no
 * one (TD5). One build. Until the timer overlay ships (PR 9) the button is drawn and disabled, as
 * the bar's Timer is, so a press never opens an invisible timer; while disabled it is drawn as an
 * outlined button (`text.primary` on paper, `border.strong` ring) instead of the filled
 * `brand.primaryDark` action, so it never looks pressable.
 */
export function ActivitySlide({ slide, onStartTimer }: { slide: ActivityBody; onStartTimer?: (ms: number) => void }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const m = messages.learner.presenter;
  const titleSize = size(presenter.size.title);
  const promptSize = size(presenter.size.prompt);
  const enabled = onStartTimer !== undefined;
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP) }}>
      <Hoya pose="cheering" size={units(unit, HOYA_STAGE)} accessibilityLabel={messages.a11y.hoya('cheering')} />
      <View style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER), alignItems: 'flex-start' }}>
        <Text style={{ fontSize: size(presenter.size.caption), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>{m.grid.kind.activity}</Text>
        <Text role="heading" style={{ fontSize: titleSize, lineHeight: Math.round(titleSize * typography.leading.tight), fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {m.activity[slide.preset]}
        </Text>
        <Text style={{ fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.secondary }}>{m.slide.activity.minutes(slide.minutes)}</Text>
        <Pressable
          testID="presenter-start-timer"
          role="button"
          accessibilityLabel={m.slide.activity.startTimer.cta}
          accessibilityState={{ disabled: !enabled }}
          disabled={!enabled}
          onPress={() => onStartTimer?.(activityTimerMs(slide))}
          style={(state) => {
            const focused = (state as { focused?: boolean }).focused === true;
            return {
              minHeight: Math.max(touchTarget.hero, units(unit, STAGE_CTA_HEIGHT)),
              paddingVertical: units(unit, spacing.lg),
              paddingHorizontal: units(unit, spacing.xxxl),
              borderRadius: radii.pill,
              borderWidth: borderWidth.thick,
              borderColor: enabled ? colors.brand.primaryDark : colors.border.strong,
              backgroundColor: enabled ? colors.brand.primaryDark : colors.surface.paper,
              alignItems: 'center',
              justifyContent: 'center',
              outlineStyle: focused ? 'solid' : undefined,
              outlineWidth: focused ? borderWidth.thick : undefined,
              outlineColor: focused ? colors.border.focus : undefined,
              outlineOffset: focused ? borderWidth.base : undefined,
            };
          }}
        >
          <Text style={{ fontSize: promptSize, fontWeight: typography.weight.bold, color: enabled ? colors.text.onPrimary : colors.text.primary, textAlign: 'center' }}>{m.slide.activity.startTimer.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}
