import { Icon, borderWidth, colors, layout, motion, radii, spacing, touchTarget, typography, z, type IconName, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { BAR_SHOW_GRACE_MS, NO_INSETS, type StageInsets } from '../../logic/lecture/stage-constants';
import type { StatusChip } from '../../logic/lecture/tools';
import { BAR_BAND, CTL_MAX_WIDTH, NEXT_MIN_WIDTH, NEXT_MIN_WIDTH_COMPACT, STATUS_MIN } from './stage-metrics';
import { usePresenterView } from './presenter-context';

/**
 * The control bar (design/screens/presenter/stage-and-bar.md, README D1, D3), in real pixels,
 * never stage units. Next reads Reveal while the slide has builds left. Timer, Blank and Slides
 * open the class tools (PR 9). The status chips are the only place voice, sound, offline and
 * update status appear (section 3.8); nothing about a learner ever does. A control the device
 * cannot use (Full screen on a browser without it) is not drawn, never drawn disabled.
 *
 * - **Docked** (every window but a phone's): eight labelled 96 px buttons in their own band under
 *   the stage. The band stays when the bar auto-hides (its content fades; no fade under reduced
 *   motion), so no slide moves.
 * - **Compact** (a phone window, owner report 2026-10-16 item 1): one row of `touchTarget.min`
 *   buttons (Back, Next / Reveal at 1.5 x, Sound, Slides, More, Exit) floating over the stage's
 *   bottom edge, padded by the safe-area insets. More opens a sheet above it with Timer, Blank,
 *   Full screen (when the browser has it) and the status chips. It shows on any touch and hides
 *   after `presenter.autoHideMs`; while hidden it takes no pointer.
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
  onBlank: () => void;
  onGrid: () => void;
  /** Status chips, in order (`statusChips`). */
  chips: readonly StatusChip[];
  /** "Turn sound on" inside the Sound is off chip. */
  onTurnSoundOn: () => void;
  /** A bar button has focus (the bar then stays visible). */
  onFocusWithin: (focused: boolean) => void;
  /** The bar's height: the docked band grows when the controls wrap (the stage letterboxes); the compact bar's height guards the stage's bottom edge. */
  onBandHeight: (height: number) => void;
  exitRef?: React.Ref<View>;
  /** A phone window: the compact bar over the stage (default: docked). */
  compact?: boolean;
  /** The safe-area insets the compact bar keeps clear of. */
  insets?: StageInsets;
  /** The compact bar's More sheet is open (the presenter holds it, so Esc and hiding close it). */
  moreOpen?: boolean;
  onMore?: (open: boolean) => void;
}

type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

interface CtlProps {
  label: string;
  icon?: IconName;
  primary?: boolean;
  pressed?: boolean;
  /** The compact bar's `touchTarget.min` size. */
  small?: boolean;
  expanded?: boolean;
  onPress?: () => void;
  onFocusWithin: (focused: boolean) => void;
  testID?: string;
}

const Ctl = forwardRef<View, CtlProps>(function Ctl({ label, icon, primary, pressed, small, expanded, onPress, onFocusWithin, testID }, ref) {
  const fg = primary ? colors.text.onPrimary : colors.text.primary;
  const target = small ? touchTarget.min : touchTarget.hero;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      role="button"
      accessibilityLabel={label}
      accessibilityState={{ ...(pressed !== undefined ? { selected: pressed } : {}), ...(expanded !== undefined ? { expanded } : {}) }}
      aria-pressed={pressed}
      {...(expanded !== undefined ? { 'aria-expanded': expanded } : {})}
      onPress={onPress}
      onFocus={() => onFocusWithin(true)}
      onBlur={() => onFocusWithin(false)}
      style={(state) => {
        const { focused } = state as PressState;
        return {
          minWidth: primary ? (small ? NEXT_MIN_WIDTH_COMPACT : NEXT_MIN_WIDTH) : target,
          maxWidth: primary || small ? undefined : CTL_MAX_WIDTH,
          minHeight: target,
          padding: small ? spacing.xs : spacing.sm,
          gap: small ? spacing.xxs : spacing.xs,
          flexShrink: small ? 1 : 0,
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
      {icon !== undefined ? <Icon name={icon} size={small ? spacing.xl : spacing.xxl} color={fg} /> : null}
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.body, fontWeight: typography.weight.bold, color: fg, textAlign: 'center', lineHeight: Math.round(typography.size.body * typography.leading.tight) }}>
        {label}
      </Text>
    </Pressable>
  );
});

export function ControlBar(props: ControlBarProps): React.ReactElement {
  const { reducedMotion } = usePresenterView();
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
  // Hidden, the controls take no pointer, and they take it again only a moment after they show: the
  // touch that brings the bar back (its press lands after the bar is drawn) never presses an unseen
  // Exit or Back. Keys and focus still reach them (focus shows the bar).
  const [live, setLive] = useState(!props.hidden);
  useEffect(() => {
    if (props.hidden) {
      setLive(false);
      return undefined;
    }
    const timer = setTimeout(() => setLive(true), BAR_SHOW_GRACE_MS);
    return () => clearTimeout(timer);
  }, [props.hidden]);
  const parts = { ...props, opacity, onLayout, live };
  return props.compact ? <CompactBar {...parts} /> : <DockedBar {...parts} />;
}

type BarParts = ControlBarProps & { opacity: Animated.Value; onLayout: (event: LayoutChangeEvent) => void; live: boolean };

function DockedBar(props: BarParts): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.bar;
  const focus = props.onFocusWithin;
  return (
    <View
      testID="presenter-bar-band"
      onLayout={props.onLayout}
      style={{
        minHeight: BAR_BAND,
        backgroundColor: colors.surface.sunken,
        paddingVertical: spacing.md,
        paddingHorizontal: layout.gutter.regular,
        justifyContent: 'center',
      }}
    >
      <Animated.View pointerEvents={props.live ? 'auto' : 'none'} style={{ opacity: props.opacity, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm }}>
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
        <Ctl testID="presenter-blank-button" label={m.blank.cta} onPress={props.onBlank} onFocusWithin={focus} />
        <Ctl testID="presenter-grid-button" label={m.grid.cta} onPress={props.onGrid} onFocusWithin={focus} />
        {props.fullscreenSupported ? (
          <Ctl testID="presenter-fullscreen" label={m.fullscreen.cta} pressed={props.fullscreen} onPress={props.onFullscreen} onFocusWithin={focus} />
        ) : null}
        <Ctl ref={props.exitRef} testID="presenter-exit" label={m.exit.cta} icon="close" onPress={props.onExit} onFocusWithin={focus} />
      </View>
      </Animated.View>
    </View>
  );
}

function CompactBar(props: BarParts): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.bar;
  const focus = props.onFocusWithin;
  const insets = props.insets ?? NO_INSETS;
  const moreOpen = props.moreOpen === true && !props.hidden;
  const firstItem = useRef<View>(null);
  useEffect(() => {
    if (moreOpen) firstItem.current?.focus?.();
  }, [moreOpen]);
  const closeMore = (): void => props.onMore?.(false);
  // A sheet item runs its tool and closes the sheet.
  const item = (run: () => void) => (): void => {
    closeMore();
    run();
  };
  return (
    <Animated.View
      testID="presenter-bar-compact"
      onLayout={props.onLayout}
      pointerEvents={props.live ? 'box-none' : 'none'}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        // Over the covering tools of the stage (Blank, the grid), so a touch can always clear or leave them;
        // the Exit confirm, a later sibling of the whole stage area, stays on top.
        zIndex: z.modal,
        opacity: props.opacity,
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm + insets.bottom,
        paddingLeft: layout.gutter.compact + insets.left,
        paddingRight: layout.gutter.compact + insets.right,
        gap: spacing.sm,
      }}
    >
      {moreOpen ? (
        <View
          testID="presenter-more-sheet"
          role="group"
          aria-label={m.more}
          style={{
            alignSelf: 'flex-end',
            maxWidth: '100%',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: spacing.sm,
            padding: spacing.sm,
            borderRadius: radii.lg,
            backgroundColor: colors.surface.sunken,
          }}
        >
          {props.chips.length > 0 ? (
            <View testID="presenter-status" role="status" style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {props.chips.map((chip) => (
                <Chip key={chip} chip={chip} onTurnSoundOn={props.onTurnSoundOn} onFocusWithin={focus} />
              ))}
            </View>
          ) : null}
          <Ctl ref={firstItem} small testID="presenter-timer" label={m.timer.cta} onPress={item(props.onTimer)} onFocusWithin={focus} />
          <Ctl small testID="presenter-blank-button" label={m.blank.cta} onPress={item(props.onBlank)} onFocusWithin={focus} />
          {props.fullscreenSupported ? (
            <Ctl small testID="presenter-fullscreen" label={m.fullscreen.cta} pressed={props.fullscreen} onPress={item(props.onFullscreen)} onFocusWithin={focus} />
          ) : null}
        </View>
      ) : null}
      <View
        role="toolbar"
        aria-label={m.label}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          padding: spacing.xs,
          borderRadius: radii.lg,
          backgroundColor: colors.surface.sunken,
        }}
      >
        <Ctl small testID="presenter-back" label={messages.common.buttons.back} icon="arrow-left" onPress={props.onBack} onFocusWithin={focus} />
        <Ctl
          small
          testID="presenter-next"
          label={props.revealNext ? m.reveal.cta : messages.common.buttons.next}
          icon="arrow-right"
          primary
          onPress={props.onNext}
          onFocusWithin={focus}
        />
        <Ctl small testID="presenter-sound" label={m.sound.cta} icon={props.muted ? 'speaker-off' : 'speaker'} onPress={props.onSound} onFocusWithin={focus} />
        <Ctl small testID="presenter-grid-button" label={m.grid.cta} onPress={item(props.onGrid)} onFocusWithin={focus} />
        <Ctl small testID="presenter-more" label={m.more} expanded={moreOpen} onPress={() => props.onMore?.(!moreOpen)} onFocusWithin={focus} />
        <Ctl ref={props.exitRef} small testID="presenter-exit" label={m.exit.cta} icon="close" onPress={item(props.onExit)} onFocusWithin={focus} />
      </View>
    </Animated.View>
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
