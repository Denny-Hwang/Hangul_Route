import { Icon, borderWidth, colors, layout, motion, radii, spacing, touchTarget, typography, type IconName, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { forwardRef, useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import type { StatusChip } from '../../logic/lecture/tools';
import { BAR_BAND, CTL_MAX_WIDTH, NEXT_MIN_WIDTH, STATUS_MIN } from './stage-metrics';
import { usePresenterView } from './presenter-context';

/**
 * The docked control bar (design/screens/presenter/stage-and-bar.md, README D1, D3): nine labelled
 * 96 px buttons in real pixels, never stage units. Next reads Reveal while the slide has builds
 * left. The band stays when the bar auto-hides (its content fades; no fade under reduced motion),
 * so no slide moves. Timer, Helper, Blank and Slides open the class tools (PR 9); Helper is
 * disabled when the lesson has no helper picker. The status chips on the left are the only place
 * voice, sound, offline and update status appear (section 3.8); nothing about a learner ever does.
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
  onTimer: () => void;
  /** Absent when the lesson has no helper picker (the deck's picker is none). */
  onPicker?: () => void;
  onBlank: () => void;
  onGrid: () => void;
  /** Status chips, in order (`statusChips`). */
  chips: readonly StatusChip[];
  /** "Turn sound on" inside the Sound is off chip. */
  onTurnSoundOn: () => void;
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
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.body, fontWeight: typography.weight.bold, color: fg, textAlign: 'center', lineHeight: Math.round(typography.size.body * typography.leading.tight) }}>
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
      testID="presenter-bar-band"
      onLayout={onLayout}
      style={{
        minHeight: BAR_BAND,
        backgroundColor: colors.surface.sunken,
        paddingVertical: spacing.md,
        paddingHorizontal: layout.gutter.regular,
        justifyContent: 'center',
      }}
    >
      {/* Hidden, the controls take no pointer, so the tap that brings the bar back never also presses
          an unseen Exit or Back; keys and focus still reach them (focus shows the bar). */}
      <Animated.View pointerEvents={props.hidden ? 'none' : 'auto'} style={{ opacity, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm }}>
      {props.chips.length > 0 ? (
        <View testID="presenter-status" role="status" style={{ flexGrow: 1, flexShrink: 0, flexBasis: STATUS_MIN, minWidth: STATUS_MIN, maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {props.chips.map((chip) => (
            <Chip key={chip} chip={chip} onTurnSoundOn={props.onTurnSoundOn} onFocusWithin={focus} />
          ))}
        </View>
      ) : null}
      <View role="toolbar" aria-label={m.label} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm }}>
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
        <Ctl testID="presenter-timer" label={m.timer.cta} onPress={props.onTimer} onFocusWithin={focus} />
        <Ctl testID="presenter-picker-button" label={m.picker.cta} disabled={props.onPicker === undefined} {...(props.onPicker ? { onPress: props.onPicker } : {})} onFocusWithin={focus} />
        <Ctl testID="presenter-blank-button" label={m.blank.cta} onPress={props.onBlank} onFocusWithin={focus} />
        <Ctl testID="presenter-grid-button" label={m.grid.cta} onPress={props.onGrid} onFocusWithin={focus} />
        <Ctl
          testID="presenter-fullscreen"
          label={m.fullscreen.cta}
          pressed={props.fullscreen}
          disabled={!props.fullscreenSupported}
          onPress={props.onFullscreen}
          onFocusWithin={focus}
        />
        <Ctl ref={props.exitRef} testID="presenter-exit" label={m.exit.cta} icon="close" onPress={props.onExit} onFocusWithin={focus} />
      </View>
      </Animated.View>
    </View>
  );
}

/**
 * A status chip (stage-and-bar.md): a pill at `touchTarget.min`, `border.strong` on paper,
 * `text.primary` at 18 px. Sound is off carries a bordered Turn sound on button.
 */
function Chip({ chip, onTurnSoundOn, onFocusWithin }: { chip: StatusChip; onTurnSoundOn: () => void; onFocusWithin: (focused: boolean) => void }): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.bar;
  const text = chip === 'sound-off' ? messages.learner.audio.soundIsOff : chip === 'no-voice' ? m.noVoice : chip === 'offline' ? m.offline : m.update;
  return (
    <View
      testID={`presenter-chip-${chip}`}
      style={{
        flexShrink: 1,
        maxWidth: '100%',
        minHeight: touchTarget.min,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        borderWidth: borderWidth.base,
        borderColor: colors.border.strong,
        backgroundColor: colors.surface.paper,
      }}
    >
      {chip === 'no-voice' || chip === 'sound-off' ? <Icon name="speaker-off" size={spacing.xl} color={colors.text.primary} /> : null}
      <Text {...KOREAN_LINE_BREAK} style={{ flexShrink: 1, fontSize: typography.size.body, color: colors.text.primary }}>{text}</Text>
      {chip === 'sound-off' ? (
        <Pressable
          testID="presenter-turn-sound-on"
          role="button"
          accessibilityLabel={messages.learner.audio.action.turn_on.cta}
          onPress={onTurnSoundOn}
          onFocus={() => onFocusWithin(true)}
          onBlur={() => onFocusWithin(false)}
          style={(state) => {
            const { focused } = state as PressState;
            return {
              minHeight: touchTarget.min - 2 * spacing.sm,
              paddingHorizontal: spacing.md,
              justifyContent: 'center',
              borderRadius: radii.pill,
              borderWidth: focused ? borderWidth.thick : borderWidth.base,
              borderColor: focused ? colors.border.focus : colors.text.primary,
              backgroundColor: colors.surface.paper,
            };
          }}
        >
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.text.primary }}>{messages.learner.audio.action.turn_on.cta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
