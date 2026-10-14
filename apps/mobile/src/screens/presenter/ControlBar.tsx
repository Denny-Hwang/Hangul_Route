import { Icon, borderWidth, colors, layout, motion, radii, spacing, touchTarget, typography, type IconName } from '@hangul-route/design-system';
import React, { forwardRef, useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { BAR_BAND, CTL_MAX_WIDTH, NEXT_MIN_WIDTH } from '../../logic/lecture/stage-constants';
import { usePresenterView } from './presenter-context';

/**
 * The docked control bar (design/screens/presenter/stage-and-bar.md, README D1, D3): nine labelled
 * 96 px buttons in real pixels, never stage units. Next reads Reveal while the slide has builds
 * left. The band stays when the bar auto-hides (its content fades; no fade under reduced motion),
 * so no slide moves. Timer, Helper, Blank and Slides open the class tools of PR 9; until those
 * overlays ship they are drawn and disabled, so a press never opens an invisible overlay.
 */
export interface ControlBarProps {
  hidden: boolean;
  revealNext: boolean;
  muted: boolean;
  fullscreenSupported: boolean;
  fullscreen: boolean;
  onBack: () => void;
  onNext: () => void;
  onSound: () => void;
  onFullscreen: () => void;
  onExit: () => void;
  /** A bar button has focus (the bar then stays visible). */
  onFocusWithin: (focused: boolean) => void;
  /** The band's height, which grows when the controls wrap (the stage box letterboxes). */
  onBandHeight: (height: number) => void;
  exitRef?: React.Ref<View>;
}

type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

interface CtlProps {
  label: string;
  icon?: IconName;
  primary?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onFocusWithin: (focused: boolean) => void;
  testID?: string;
}

const Ctl = forwardRef<View, CtlProps>(function Ctl({ label, icon, primary, pressed, disabled, onPress, onFocusWithin, testID }, ref) {
  const fg = primary ? colors.text.onPrimary : colors.text.primary;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      role="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true, ...(pressed !== undefined ? { selected: pressed } : {}) }}
      aria-pressed={pressed}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => onFocusWithin(true)}
      onBlur={() => onFocusWithin(false)}
      style={(state) => {
        const { focused } = state as PressState;
        return {
          minWidth: primary ? NEXT_MIN_WIDTH : touchTarget.hero,
          maxWidth: primary ? undefined : CTL_MAX_WIDTH,
          minHeight: touchTarget.hero,
          padding: spacing.sm,
          gap: spacing.xs,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.lg,
          borderWidth: pressed ? borderWidth.thick : borderWidth.base,
          borderColor: primary ? colors.brand.primaryDark : pressed ? colors.text.primary : colors.border.strong,
          backgroundColor: primary ? colors.brand.primaryDark : colors.surface.paper,
          outlineStyle: focused ? 'solid' : undefined,
          outlineWidth: focused ? borderWidth.thick : undefined,
          outlineColor: focused ? colors.border.focus : undefined,
          outlineOffset: focused ? borderWidth.base : undefined,
        };
      }}
    >
      {icon !== undefined ? <Icon name={icon} size={spacing.xxl} color={fg} /> : null}
      <Text style={{ fontSize: typography.size.body, fontWeight: typography.weight.bold, color: fg, textAlign: 'center', lineHeight: Math.round(typography.size.body * typography.leading.tight) }}>
        {label}
      </Text>
    </Pressable>
  );
});

export function ControlBar(props: ControlBarProps): React.ReactElement {
  const { messages, reducedMotion } = usePresenterView();
  const m = messages.learner.presenter.bar;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const to = props.hidden ? 0 : 1;
    if (reducedMotion) {
      opacity.setValue(to);
      return;
    }
    Animated.timing(opacity, { toValue: to, duration: motion.duration.base, useNativeDriver: false }).start();
  }, [props.hidden, reducedMotion, opacity]);
  const onLayout = (event: LayoutChangeEvent): void => props.onBandHeight(event.nativeEvent.layout.height);
  const focus = props.onFocusWithin;
  return (
    <View
      onLayout={onLayout}
      style={{
        minHeight: BAR_BAND,
        backgroundColor: colors.surface.sunken,
        paddingVertical: spacing.md,
        paddingHorizontal: layout.gutter.regular,
        justifyContent: 'center',
      }}
    >
      <Animated.View role="toolbar" aria-label={m.label} style={{ opacity, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm }}>
        <Ctl testID="presenter-back" label={messages.common.buttons.back} icon="arrow-left" onPress={props.onBack} onFocusWithin={focus} />
        <Ctl
          testID="presenter-next"
          label={props.revealNext ? m.reveal.cta : messages.common.buttons.next}
          icon="arrow-right"
          primary
          onPress={props.onNext}
          onFocusWithin={focus}
        />
        <Ctl testID="presenter-sound" label={m.sound.cta} icon={props.muted ? 'speaker-off' : 'speaker'} onPress={props.onSound} onFocusWithin={focus} />
        <Ctl label={m.timer.cta} disabled onFocusWithin={focus} />
        <Ctl label={m.picker.cta} disabled onFocusWithin={focus} />
        <Ctl label={m.blank.cta} disabled onFocusWithin={focus} />
        <Ctl label={m.grid.cta} disabled onFocusWithin={focus} />
        <Ctl
          testID="presenter-fullscreen"
          label={m.fullscreen.cta}
          pressed={props.fullscreen}
          disabled={!props.fullscreenSupported}
          onPress={props.onFullscreen}
          onFocusWithin={focus}
        />
        <Ctl ref={props.exitRef} testID="presenter-exit" label={m.exit.cta} icon="close" onPress={props.onExit} onFocusWithin={focus} />
      </Animated.View>
    </View>
  );
}
