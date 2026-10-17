import { Icon, borderWidth, colors, layout, motion, radii, shadows, spacing, touchTarget, typography, z, type IconName, KOREAN_LINE_BREAK, useTypeScale } from '@hangul-route/design-system';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { BAR_SHOW_GRACE_MS, NO_INSETS, type StageInsets } from '../../logic/lecture/stage-constants';
import type { StatusChip } from '../../logic/lecture/tools';
import { focusablesIn, rememberFocus, trapFocus } from '../../platform/presenter';
import { BAR_BAND, CTL_MAX_WIDTH, NEXT_MIN_WIDTH, NEXT_MIN_WIDTH_COMPACT, STATUS_MIN } from './stage-metrics';
import { usePresenterView } from './presenter-context';

/**
 * The control bar (design/screens/presenter/stage-and-bar.md, README D1, D3), in real pixels,
 * never stage units. Next reads Reveal while the slide has builds left; the slide step back reads
 * Previous on both bars, so "Back" only ever means leaving a screen (F-TCH-004 section 3.6). Timer,
 * Blank and Slides open the class tools (PR 9). The status chips are the only place voice, sound,
 * offline and update status appear (section 3.8); nothing about a learner ever does. A control the
 * device cannot use (Full screen on a browser without it) is not drawn, never drawn disabled.
 *
 * - **Docked** (every window but a phone's): eight labelled 96 px buttons in their own band under
 *   the stage. The band stays when the bar auto-hides (its content fades; no fade under reduced
 *   motion), so no slide moves.
 * - **Compact** (a phone window, section 3.6 phone exception; stage-and-bar.md "Phone"): one row of
 *   `touchTarget.min` controls (Previous, Next / Reveal at 1.5 x, Sound, More) floating over the
 *   stage bottom, inside the bottom safe-area inset. More opens a sheet over the stage ("Lesson
 *   controls", Close, the status chips, then Slides, Timer, Blank, Full screen where the browser has
 *   it, Keys and help, Exit); the row hides while the sheet is open. When the row shows and hides is
 *   the presenter's (it never covers a new slide); hidden, it takes no pointer but stays in the
 *   focus order.
 */
export interface ControlBarProps {
  hidden: boolean;
  revealNext: boolean;
  muted: boolean;
  fullscreenSupported: boolean;
  fullscreen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSound: () => void;
  onFullscreen: () => void;
  onExit: () => void;
  onTimer: () => void;
  onBlank: () => void;
  onGrid: () => void;
  /** Keys and help (the compact bar's More sheet; the docked bar leaves Help to H or ?). */
  onHelp: () => void;
  /** Status chips, in order (`statusChips`). */
  chips: readonly StatusChip[];
  /** "Turn sound on" inside the Sound is off chip. */
  onTurnSoundOn: () => void;
  /** Focus moved into a bar control (true) or out of the bar (false); `pointer`: a press of a pointer brought it. */
  onFocusWithin: (focused: boolean, pointer: boolean) => void;
  /** The docked band's height: it grows when the controls wrap (the stage letterboxes). */
  onBandHeight?: (height: number) => void;
  /** The docked bar's Exit, or the compact bar's More (which holds Exit): Next on the End slide moves focus there. */
  exitRef?: React.Ref<View>;
  /** A phone window: the compact bar over the stage (default: docked). */
  compact?: boolean;
  /** The safe-area insets the compact bar keeps clear of. */
  insets?: StageInsets;
  /** The compact bar's More sheet is open (the presenter holds it, so Esc and the browser's Back close it). */
  moreOpen?: boolean;
  onMore?: (open: boolean) => void;
}

type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

function focusRing(focused: boolean): ViewStyle {
  return focused
    ? ({ outlineStyle: 'solid', outlineWidth: borderWidth.thick, outlineColor: colors.border.focus, outlineOffset: borderWidth.base } as ViewStyle)
    : {};
}

interface CtlProps {
  label: string;
  icon?: IconName;
  primary?: boolean;
  pressed?: boolean;
  /** The compact bar's `touchTarget.min` size, the glyph beside the label. */
  small?: boolean;
  expanded?: boolean;
  /** `dialog`: the control opens one (More). */
  popup?: 'dialog';
  onPress?: () => void;
  /** Focus in or out of the bar; the press-in just before a focus marks it as the pointer's. */
  focus: FocusTracker;
  testID?: string;
}

/** Tells a focus a pointer press brought (it does not hold the bar) from a keyboard, switch or screen-reader focus (it does). */
interface FocusTracker {
  pressIn: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

/** How soon after a press-in a focus counts as the pointer's own (a click focuses the button it lands on). */
const POINTER_FOCUS_MS = 500;

function useFocusTracker(onFocusWithin: (focused: boolean, pointer: boolean) => void): FocusTracker {
  const pressedAt = useRef(-Infinity);
  return {
    pressIn: () => {
      pressedAt.current = Date.now();
    },
    onFocus: () => onFocusWithin(true, Date.now() - pressedAt.current < POINTER_FOCUS_MS),
    onBlur: () => onFocusWithin(false, false),
  };
}

const Ctl = forwardRef<View, CtlProps>(function Ctl({ label, icon, primary, pressed, small, expanded, popup, onPress, focus, testID }, ref) {
  const textScale = useTypeScale();
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
      {...(popup !== undefined ? { 'aria-haspopup': popup } : {})}
      onPressIn={focus.pressIn}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={(state) => {
        const { focused } = state as PressState;
        return {
          minWidth: primary ? (small ? NEXT_MIN_WIDTH_COMPACT : NEXT_MIN_WIDTH) : target,
          maxWidth: primary || small ? undefined : CTL_MAX_WIDTH,
          minHeight: target,
          flexDirection: small ? 'row' : 'column',
          paddingVertical: small ? spacing.xs : spacing.sm,
          paddingHorizontal: small ? spacing.md : spacing.sm,
          gap: spacing.xs,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.lg,
          borderWidth: pressed ? borderWidth.thick : borderWidth.base,
          borderColor: primary ? colors.brand.primaryDark : pressed ? colors.text.primary : colors.border.strong,
          backgroundColor: primary ? colors.brand.primaryDark : colors.surface.paper,
          ...focusRing(focused === true),
        };
      }}
    >
      {icon !== undefined ? <Icon name={icon} size={small ? spacing.xl : spacing.xxl} color={fg} /> : null}
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, fontWeight: typography.weight.bold, color: fg, textAlign: 'center', lineHeight: Math.round(textScale.size.body * typography.leading.tight) }}>
        {label}
      </Text>
    </Pressable>
  );
});

export function ControlBar(props: ControlBarProps): React.ReactElement {
  const { reducedMotion } = usePresenterView();
  const opacity = useRef(new Animated.Value(props.hidden ? 0 : 1)).current;
  useEffect(() => {
    const to = props.hidden ? 0 : 1;
    if (reducedMotion) {
      opacity.setValue(to);
      return;
    }
    Animated.timing(opacity, { toValue: to, duration: motion.duration.base, useNativeDriver: false }).start();
  }, [props.hidden, reducedMotion, opacity]);
  // Hidden, the controls take no pointer, and they take it again only a moment after they show: the
  // touch that brings the bar back (its press lands after the bar is drawn) never presses an unseen
  // control. Keys and focus still reach them (focus shows the bar).
  const [live, setLive] = useState(!props.hidden);
  useEffect(() => {
    if (props.hidden) {
      setLive(false);
      return undefined;
    }
    const timer = setTimeout(() => setLive(true), BAR_SHOW_GRACE_MS);
    return () => clearTimeout(timer);
  }, [props.hidden]);
  const focus = useFocusTracker(props.onFocusWithin);
  const parts = { ...props, opacity, live, focus };
  return props.compact ? <CompactBar {...parts} /> : <DockedBar {...parts} />;
}

type BarParts = ControlBarProps & { opacity: Animated.Value; live: boolean; focus: FocusTracker };

function StatusChips({ chips, onTurnSoundOn, focus }: { chips: readonly StatusChip[]; onTurnSoundOn: () => void; focus: FocusTracker }): React.ReactElement | null {
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((chip) => (
        <Chip key={chip} chip={chip} onTurnSoundOn={onTurnSoundOn} focus={focus} />
      ))}
    </>
  );
}

function DockedBar(props: BarParts): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.bar;
  const focus = props.focus;
  const onLayout = (event: LayoutChangeEvent): void => props.onBandHeight?.(event.nativeEvent.layout.height);
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
      <Animated.View pointerEvents={props.live ? 'auto' : 'none'} style={{ opacity: props.opacity, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm }}>
        {props.chips.length > 0 ? (
          <View testID="presenter-status" role="status" style={{ flexGrow: 1, flexShrink: 0, flexBasis: STATUS_MIN, minWidth: STATUS_MIN, maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <StatusChips chips={props.chips} onTurnSoundOn={props.onTurnSoundOn} focus={focus} />
          </View>
        ) : null}
        <View role="toolbar" aria-label={m.label} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm }}>
          <Ctl testID="presenter-back" label={m.prev.cta} icon="arrow-left" onPress={props.onPrev} focus={focus} />
          <Ctl testID="presenter-next" label={props.revealNext ? m.reveal.cta : messages.common.buttons.next} icon="arrow-right" primary onPress={props.onNext} focus={focus} />
          <Ctl testID="presenter-sound" label={m.sound.cta} icon={props.muted ? 'speaker-off' : 'speaker'} onPress={props.onSound} focus={focus} />
          <Ctl testID="presenter-timer" label={m.timer.cta} onPress={props.onTimer} focus={focus} />
          <Ctl testID="presenter-blank-button" label={m.blank.cta} onPress={props.onBlank} focus={focus} />
          <Ctl testID="presenter-grid-button" label={m.grid.cta} onPress={props.onGrid} focus={focus} />
          {props.fullscreenSupported ? <Ctl testID="presenter-fullscreen" label={m.fullscreen.cta} pressed={props.fullscreen} onPress={props.onFullscreen} focus={focus} /> : null}
          <Ctl ref={props.exitRef} testID="presenter-exit" label={m.exit.cta} icon="close" onPress={props.onExit} focus={focus} />
        </View>
      </Animated.View>
    </View>
  );
}

function CompactBar(props: BarParts): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.bar;
  const focus = props.focus;
  const insets = props.insets ?? NO_INSETS;
  const moreOpen = props.moreOpen === true;
  return (
    <>
      <Animated.View
        testID="presenter-bar-compact"
        pointerEvents={props.live && !moreOpen ? 'box-none' : 'none'}
        style={{
          position: 'absolute',
          left: insets.left + spacing.sm,
          right: insets.right + spacing.sm,
          bottom: insets.bottom + spacing.sm,
          alignItems: 'center',
          // Over the stage and the covering tools (a later sibling at the same level), so a touch can
          // always clear or leave them; the More sheet and the Exit confirm come after it and stay on top.
          zIndex: z.modal,
          opacity: props.opacity,
        }}
      >
        <View
          testID="presenter-bar-row"
          role="toolbar"
          aria-label={m.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.sm,
            borderRadius: radii.lg,
            backgroundColor: colors.surface.sunken,
            ...shadows.card,
          }}
        >
          <Ctl small testID="presenter-back" label={m.prev.cta} icon="arrow-left" onPress={props.onPrev} focus={focus} />
          <Ctl small testID="presenter-next" label={props.revealNext ? m.reveal.cta : messages.common.buttons.next} icon="arrow-right" primary onPress={props.onNext} focus={focus} />
          <Ctl small testID="presenter-sound" label={m.sound.cta} icon={props.muted ? 'speaker-off' : 'speaker'} onPress={props.onSound} focus={focus} />
          <Ctl ref={props.exitRef} small testID="presenter-more" label={m.more.cta} popup="dialog" expanded={moreOpen} onPress={() => props.onMore?.(!moreOpen)} focus={focus} />
        </View>
      </Animated.View>
      {moreOpen ? <MoreSheet {...props} insets={insets} /> : null}
    </>
  );
}

/**
 * The compact bar's More (stage-and-bar.md "Phone", wireframe `classroom/lecture-phone.md` Panel D):
 * a modal sheet over the stage, the slide underneath. Its title, Close (focused on open), the status
 * chips, then the rest of the controls as `touchTarget.min` buttons; Tab stays inside and focus goes
 * back to More when it closes. A control runs its tool and closes the sheet.
 */
function MoreSheet(props: BarParts & { insets: StageInsets }): React.ReactElement {
  const textScale = useTypeScale();
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.bar;
  const self = useRef<View>(null);
  const close = useRef<View>(null);
  useEffect(() => {
    const restore = rememberFocus();
    close.current?.focus?.();
    const release = trapFocus(() => focusablesIn(self.current));
    return () => {
      release();
      restore();
    };
  }, []);
  const item = (run: () => void) => (): void => {
    props.onMore?.(false);
    run();
  };
  const button = (testID: string, label: string, onPress: () => void, pressed?: boolean): React.ReactElement => (
    <SheetButton key={testID} testID={testID} label={label} onPress={item(onPress)} {...(pressed !== undefined ? { pressed } : {})} />
  );
  return (
    <View
      ref={self}
      testID="presenter-more-sheet"
      role="dialog"
      aria-modal
      aria-label={m.label}
      style={{
        position: 'absolute',
        left: props.insets.left + spacing.sm,
        right: props.insets.right + spacing.sm,
        bottom: props.insets.bottom + spacing.sm,
        top: props.insets.top + spacing.sm,
        alignItems: 'center',
        justifyContent: 'flex-end',
        zIndex: z.modal,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          width: '100%',
          maxWidth: layout.maxWidth.reading,
          maxHeight: '100%',
          borderRadius: radii.lg,
          borderWidth: borderWidth.base,
          borderColor: colors.border.strong,
          backgroundColor: colors.surface.paper,
          ...shadows.card,
        }}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <Text {...KOREAN_LINE_BREAK} role="heading" aria-level={2} style={{ flexShrink: 1, fontSize: textScale.size.bodyLg, fontWeight: typography.weight.bold, color: colors.text.primary }}>
              {m.label}
            </Text>
            <SheetButton ref={close} testID="presenter-more-close" label={messages.common.buttons.close} onPress={() => props.onMore?.(false)} />
          </View>
          {props.chips.length > 0 ? (
            <View testID="presenter-status" role="status" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <StatusChips chips={props.chips} onTurnSoundOn={props.onTurnSoundOn} focus={props.focus} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {button('presenter-grid-button', m.grid.cta, props.onGrid)}
            {button('presenter-timer', m.timer.cta, props.onTimer)}
            {button('presenter-blank-button', m.blank.cta, props.onBlank)}
            {props.fullscreenSupported ? button('presenter-fullscreen', m.fullscreen.cta, props.onFullscreen, props.fullscreen) : null}
            {button('presenter-help-button', messages.learner.presenter.home.help.cta, props.onHelp)}
            {button('presenter-exit', m.exit.cta, props.onExit)}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

/** A More sheet button: `touchTarget.min` tall, paper with a `border.strong` outline, the label at body size. */
const SheetButton = forwardRef<View, { label: string; onPress: () => void; pressed?: boolean; testID: string }>(function SheetButton({ label, onPress, pressed, testID }, ref) {
  const textScale = useTypeScale();
  return (
    <Pressable
      ref={ref}
      testID={testID}
      role="button"
      accessibilityLabel={label}
      {...(pressed !== undefined ? { 'aria-pressed': pressed, accessibilityState: { selected: pressed } } : {})}
      onPress={onPress}
      style={(state) => {
        const { focused } = state as PressState;
        return {
          minHeight: touchTarget.min,
          minWidth: touchTarget.min,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.pill,
          borderWidth: pressed ? borderWidth.thick : borderWidth.base,
          borderColor: pressed ? colors.text.primary : colors.border.strong,
          backgroundColor: colors.surface.paper,
          ...focusRing(focused === true),
        };
      }}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, fontWeight: typography.weight.bold, color: colors.text.primary, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
});

/**
 * A status chip (stage-and-bar.md): a pill at `touchTarget.min`, `border.strong` on paper,
 * `text.primary` at 18 px. Sound is off carries a bordered Turn sound on button.
 */
function Chip({ chip, onTurnSoundOn, focus }: { chip: StatusChip; onTurnSoundOn: () => void; focus: FocusTracker }): React.ReactElement {
  const textScale = useTypeScale();
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
      <Text {...KOREAN_LINE_BREAK} style={{ flexShrink: 1, fontSize: textScale.size.body, color: colors.text.primary }}>{text}</Text>
      {chip === 'sound-off' ? (
        <Pressable
          testID="presenter-turn-sound-on"
          role="button"
          accessibilityLabel={messages.learner.audio.action.turn_on.cta}
          onPressIn={focus.pressIn}
          onPress={onTurnSoundOn}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
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
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, fontWeight: typography.weight.bold, color: colors.text.primary }}>{messages.learner.audio.action.turn_on.cta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
