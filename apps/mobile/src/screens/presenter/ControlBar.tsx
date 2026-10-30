import { Icon, borderWidth, colors, layout, motion, radii, shadows, spacing, touchTarget, typography, z, type IconName, KOREAN_LINE_BREAK, useTypeScale } from '@hangul-route/design-system';
import { forwardRef, useEffect, useRef, useState } from 'react';
import type { Ref, ReactElement } from 'react';
import { Animated, Pressable, ScrollView, Text, View, type LayoutChangeEvent, type TextStyle, type ViewStyle } from 'react-native';
import { DOCKED_TOOLS, bandTools, dockedBarLayout, dockedBarMeasured, dockedOrder, moreTools, type DockedSlot, type DockedTool } from '../../logic/lecture/bar-layout';
import { BAR_SHOW_GRACE_MS, NO_INSETS, railNextHeight, type StageInsets } from '../../logic/lecture/stage-constants';
import { railLabelsFit, type RailSize } from '../../logic/lecture/stage-scale';
import type { StatusChip } from '../../logic/lecture/tools';
import { focusablesIn, rememberFocus, trapFocus } from '../../platform/presenter';
import {
  BAR_BAND,
  BAR_GROUP_GAP,
  BAR_ROW_GAP,
  CTL_MAX_WIDTH,
  NEXT_MIN_WIDTH,
  NEXT_MIN_WIDTH_COMPACT,
  PHONE_RAIL,
  PHONE_RAIL_COMPACT,
  PHONE_RAIL_GAP,
  RAIL_BUTTON,
  RAIL_BUTTON_COMPACT,
  RAIL_LABEL_ROOM,
  STAGE_BORDER,
  STATUS_MIN,
} from './stage-metrics';
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
 *   the stage (AMENDMENTS-PRESENTER-NAV section 5.1, O6): Previous at the start, the status chips,
 *   Exit, Full screen, Slides, Blank, Timer, Sound, and Next / Reveal at the end, so Sound always
 *   sits between Exit and Next; on a wide touch window (O9, `wideTouch`) Previous sits just before
 *   Next. The focus order is the visual order. When one row does not hold them the tools take a row
 *   above, Previous and Next stay on the bottom row, and if the tools do not fit that row either,
 *   Timer, Blank and Slides go into More (`dockedBarLayout`, measured on the real labels; mock
 *   stage-and-bar.md "Navigation (PN-0b)", "Docked bar"); the band
 *   grows by `BAR_BAND` per row and the stage shrinks, so nothing overlaps it. The band stays when
 *   the bar auto-hides (its content fades; no fade under reduced motion), so no slide moves. Once
 *   touch is seen (`pinNav`) Previous and Next sit outside the fading part, in the same places:
 *   always opaque, always taking taps, with no grace after a show; the chips, the tools and More
 *   keep the fade and the grace. After a touch tap on empty stage Next shows a ring for `NUDGE_MS`
 *   (`nudge`).
 * - **Compact** (a phone window, section 3.6 phone exception; stage-and-bar.md "Phone"): one row of
 *   `touchTarget.min` controls (Previous, Next / Reveal at 1.5 x, Sound, More) floating over the
 *   stage bottom, inside the bottom safe-area inset. More opens a sheet over the stage ("Lesson
 *   controls", Close, the status chips, then Slides, Timer, Blank, Full screen where the browser has
 *   it, Keys and help, Exit); the row hides while the sheet is open. When the row shows and hides is
 *   the presenter's (it never covers a new slide); hidden, it takes no pointer but stays in the
 *   focus order. Since row PN-4 it is the overlay layout only (568 x 320 class phones, and every phone
 *   with `EXPO_PUBLIC_PRESENTER_RAIL` off).
 * - **Rail** (a phone window with room, `rail`; AMENDMENTS-PRESENTER-NAV section 5.2, O1 a, O3 a,
 *   O10 a; stage-and-bar.md "Navigation (PN-0b)", "Phone rail"): a column at the right of the stage
 *   box, inside the right inset, between the top and bottom insets, on `surface.sunken` with a
 *   `border.strong` rule and the 12 px inert gap on its stage side. Top to bottom More, Next / Reveal
 *   and Previous as a pair centred in its height, Sound. The full rail's buttons are 88 wide with the
 *   glyph above the label; the compact rail's are 64 px squares, icon only, named by their labels
 *   (More keeps its word). It never hides and takes taps at once. More opens the sheet beside it,
 *   over the stage. The label fallback measures each word on the real text: a full-rail word wider
 *   than its room asks for the compact rail (`onRailLabels`), a More word wider than the compact
 *   room shows the `more` glyph.
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
  exitRef?: Ref<View>;
  /** A phone window: the compact bar over the stage (default: docked). */
  compact?: boolean;
  /** The safe-area insets the compact bar keeps clear of. */
  insets?: StageInsets;
  /** The More sheet is open, the compact bar's or the wrapped docked band's (the presenter holds it, so Esc and the browser's Back close it). */
  moreOpen?: boolean;
  onMore?: (open: boolean) => void;
  /** Docked, touch seen: Previous and Next never fade and take taps at once (section 5.1). */
  pinNav?: boolean;
  /** Docked, a touch window `WIDE_TOUCH_MIN` px wide or wider (O9): Previous sits just before Next. */
  wideTouch?: boolean;
  /** Docked and the rail: Next shows its ring (a touch tap on empty stage, `'nudge-next'`, section 7.2). */
  nudge?: boolean;
  /** A phone window with room (section 5.2, `railSize`): the rail beside the stage instead of the floating bar. */
  rail?: RailSize | null;
  /** The rail's height (the window less the top and bottom insets): Next is 96 tall from `railNeed` (328) up, else 64. */
  railHeight?: number;
  /** The label fallback: false when a full-rail word is wider than its button, so the presenter draws the compact rail. */
  onRailLabels?: (fullFits: boolean) => void;
}

type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

function focusRing(focused: boolean): ViewStyle {
  return focused
    ? ({ outlineStyle: 'solid', outlineWidth: borderWidth.thick, outlineColor: colors.border.focus, outlineOffset: borderWidth.base } as ViewStyle)
    : {};
}

/** Next's "tap here" ring (section 7.2): drawn at once and removed at once, outside the button, so nothing moves. */
const nudgeRing = { outlineStyle: 'solid', outlineWidth: STAGE_BORDER, outlineColor: colors.border.focus, outlineOffset: borderWidth.base } as ViewStyle;

interface CtlProps {
  label: string;
  icon?: IconName;
  primary?: boolean;
  pressed?: boolean;
  /** The ring that says "tap here": a static `border.focus` outline `STAGE_BORDER` wide, no motion. */
  nudge?: boolean;
  /** The compact bar's `touchTarget.min` size, the glyph beside the label. */
  small?: boolean;
  expanded?: boolean;
  /** `dialog`: the control opens one (More). */
  popup?: 'dialog';
  onPress?: () => void;
  /** Focus in or out of the bar; the press-in just before a focus marks it as the pointer's. */
  focus: FocusTracker;
  testID?: string;
  /** The docked bar measures each control's real width for its wrap rule. */
  onLayout?: (event: LayoutChangeEvent) => void;
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

const Ctl = forwardRef<View, CtlProps>(function Ctl({ label, icon, primary, pressed, nudge, small, expanded, popup, onPress, focus, testID, onLayout }, ref) {
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
      {...(nudge === true ? { dataSet: { nudge: 'on' } } : {})}
      onPressIn={focus.pressIn}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      {...(onLayout !== undefined ? { onLayout } : {})}
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
          ...(nudge === true && focused !== true ? nudgeRing : focusRing(focused === true)),
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

export function ControlBar(props: ControlBarProps): ReactElement {
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
  if (props.rail === 'full' || props.rail === 'compact') return <PhoneRail {...parts} rail={props.rail} />;
  return props.compact ? <CompactBar {...parts} /> : <DockedBar {...parts} />;
}

type BarParts = ControlBarProps & { opacity: Animated.Value; live: boolean; focus: FocusTracker };

function StatusChips({ chips, onTurnSoundOn, focus }: { chips: readonly StatusChip[]; onTurnSoundOn: () => void; focus: FocusTracker }): ReactElement | null {
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((chip) => (
        <Chip key={chip} chip={chip} onTurnSoundOn={onTurnSoundOn} focus={focus} />
      ))}
    </>
  );
}

/** The docked bar's measured widths, per control, for one set of labels at one text size. */
interface Measured {
  key: string;
  sizes: Readonly<Record<string, number>>;
}

/**
 * The docked bar: one tree for both pointer facts, so the first touch (which pins Previous and Next)
 * never remounts the button it lands on. Mouse only, the whole row fades as one (README D3); touch
 * seen (`pinNav`), only the chips, the tools and More fade, each group taking the pointer only
 * `live`, and Previous and Next stand outside them in the same places, opaque, taking taps at all
 * times. The parts are drawn in `dockedOrder`, which is the focus order; a wrapped band draws its
 * tools on a row above (out of the flow, so the focus order stays Previous, the chips, the tools,
 * More, Next) and grows by `BAR_BAND`.
 */
function DockedBar(props: BarParts): ReactElement {
  const { messages } = usePresenterView();
  const textScale = useTypeScale();
  const m = messages.learner.presenter.bar;
  const focus = props.focus;
  const pinned = props.pinNav === true;
  const wideTouch = props.wideTouch === true;
  const moreOpen = props.moreOpen === true;
  const pointer = props.live ? ('auto' as const) : ('none' as const);
  // The row fades as one (mouse only), or its groups do (touch seen). Pinned, the row is `box-none`
  // (no pointer of its own) and each group sets its own (react-native-web writes `auto` and `none`
  // as !important, so a group's value wins); mouse only, the groups set none and follow the row.
  const row = pinned ? { opacity: 1, pointerEvents: 'box-none' as const } : { opacity: props.opacity, pointerEvents: pointer };
  const groupOpacity = pinned ? props.opacity : 1;
  const groupPointer = pinned ? { pointerEvents: pointer } : {};

  // The wrap rule runs on real widths (labels in the device language at the chosen text size). Each
  // control reports its own; a width is kept per set of labels and text size, so a tool More holds
  // keeps its last width, and only grows (Next and Reveal take turns), so the band never flips
  // between two builds of a slide.
  const labelsKey = [m.prev.cta, m.reveal.cta, messages.common.buttons.next, m.exit.cta, m.fullscreen.cta, m.grid.cta, m.blank.cta, m.timer.cta, m.sound.cta, String(textScale.size.body)].join('\n');
  const [measured, setMeasured] = useState<Measured>({ key: labelsKey, sizes: {} });
  const sizes = measured.key === labelsKey ? measured.sizes : {};
  const measure =
    (id: 'prev' | 'next' | DockedTool) =>
    (event: LayoutChangeEvent): void => {
      const width = event.nativeEvent.layout.width;
      setMeasured((current) => {
        const known = current.key === labelsKey ? current.sizes : {};
        if ((known[id] ?? -1) >= width - 0.5) return current.key === labelsKey ? current : { key: labelsKey, sizes: known };
        return { key: labelsKey, sizes: { ...known, [id]: width } };
      });
    };
  const [room, setRoom] = useState(0);
  const [band, setBand] = useState<number>(BAR_BAND);
  const onBand = (event: LayoutChangeEvent): void => {
    const height = event.nativeEvent.layout.height;
    setBand(height);
    props.onBandHeight?.(height);
  };

  const present = DOCKED_TOOLS.filter((tool) => tool !== 'fullscreen' || props.fullscreenSupported);
  const input = { room, prev: sizes.prev, next: sizes.next, tools: sizes, present, statusMin: STATUS_MIN, gap: BAR_GROUP_GAP, toolGap: spacing.sm };
  const fit = dockedBarLayout(input);
  const decided = dockedBarMeasured(input);
  const wrapped = fit.rows === 2;
  const onMore = props.onMore;
  // A band that no longer needs More (a wider window, once measured) closes its sheet.
  useEffect(() => {
    if (decided && !fit.more && moreOpen) onMore?.(false);
  }, [decided, fit.more, moreOpen, onMore]);

  const tool = (id: DockedTool): ReactElement => {
    switch (id) {
      case 'exit':
        return <Ctl key={id} ref={props.exitRef} testID="presenter-exit" label={m.exit.cta} icon="close" onPress={props.onExit} focus={focus} onLayout={measure(id)} />;
      case 'fullscreen':
        return <Ctl key={id} testID="presenter-fullscreen" label={m.fullscreen.cta} pressed={props.fullscreen} onPress={props.onFullscreen} focus={focus} onLayout={measure(id)} />;
      case 'grid':
        return <Ctl key={id} testID="presenter-grid-button" label={m.grid.cta} onPress={props.onGrid} focus={focus} onLayout={measure(id)} />;
      case 'blank':
        return <Ctl key={id} testID="presenter-blank-button" label={m.blank.cta} onPress={props.onBlank} focus={focus} onLayout={measure(id)} />;
      case 'timer':
        return <Ctl key={id} testID="presenter-timer" label={m.timer.cta} onPress={props.onTimer} focus={focus} onLayout={measure(id)} />;
      case 'sound':
        return <Ctl key={id} testID="presenter-sound" label={m.sound.cta} icon={props.muted ? 'speaker-off' : 'speaker'} onPress={props.onSound} focus={focus} onLayout={measure(id)} />;
    }
  };
  // Pinned, Previous and Next take taps whatever the row does; mouse only, they follow the row (no pointer of their own).
  const pin = { dataSet: { pinned: pinned ? 'true' : 'false' }, ...(pinned ? { pointerEvents: 'auto' as const } : {}) };
  const part = (slot: DockedSlot): ReactElement => {
    switch (slot) {
      case 'prev':
        return (
          <View key={slot} testID="presenter-nav-prev" {...pin}>
            <Ctl testID="presenter-back" label={m.prev.cta} icon="arrow-left" onPress={props.onPrev} focus={focus} onLayout={measure('prev')} />
          </View>
        );
      case 'next':
        return (
          <View key={slot} testID="presenter-nav-next" {...pin}>
            <Ctl testID="presenter-next" label={props.revealNext ? m.reveal.cta : messages.common.buttons.next} icon="arrow-right" primary nudge={props.nudge} onPress={props.onNext} focus={focus} onLayout={measure('next')} />
          </View>
        );
      case 'chips':
        // The chips keep their basis on one row even when none shows, so a chip that appears never wraps the band;
        // the status region is mounted with the band, so a chip that arrives is announced into a region already there.
        return (
          <Animated.View
            key={slot}
            testID="presenter-status"
            role="status"
            {...groupPointer}
            style={{
              opacity: groupOpacity,
              ...(wrapped ? { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 } : { flexGrow: 1, flexShrink: 0, flexBasis: STATUS_MIN, minWidth: STATUS_MIN }),
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <StatusChips chips={props.chips} onTurnSoundOn={props.onTurnSoundOn} focus={focus} />
          </Animated.View>
        );
      case 'tools':
        // Wrapped, the tools row is drawn above the bottom row (out of the flow, right-aligned), in the same place in the focus order.
        return (
          <Animated.View
            key={slot}
            testID="presenter-bar-tools"
            {...groupPointer}
            style={{ opacity: groupOpacity, flexDirection: 'row', flexShrink: 0, alignItems: 'center', gap: spacing.sm, ...(wrapped ? { position: 'absolute' as const, top: 0, right: 0 } : {}) }}
          >
            {bandTools(present, fit.more).map(tool)}
          </Animated.View>
        );
      case 'more':
        return (
          <Animated.View key={slot} {...groupPointer} style={{ opacity: groupOpacity }}>
            <Ctl testID="presenter-more" label={m.more.cta} popup="dialog" expanded={moreOpen} onPress={() => onMore?.(!moreOpen)} focus={focus} />
          </Animated.View>
        );
    }
  };
  return (
    <>
      <View
        testID="presenter-bar-band"
        onLayout={onBand}
        style={{
          minHeight: BAR_BAND,
          backgroundColor: colors.surface.sunken,
          paddingVertical: spacing.md,
          paddingHorizontal: layout.gutter.regular,
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          testID="presenter-bar-docked"
          role="toolbar"
          aria-label={m.label}
          onLayout={(event: LayoutChangeEvent) => setRoom(event.nativeEvent.layout.width)}
          pointerEvents={row.pointerEvents}
          {...{ dataSet: { rows: String(fit.rows), more: fit.more ? 'true' : 'false', order: wideTouch ? 'o9' : 'o6' } }}
          style={{ opacity: row.opacity, flexDirection: 'row', alignItems: 'center', gap: BAR_GROUP_GAP, ...(wrapped ? { paddingTop: touchTarget.hero + BAR_ROW_GAP } : {}) }}
        >
          {dockedOrder(fit, wideTouch).map(part)}
        </Animated.View>
      </View>
      {fit.more && moreOpen ? <MoreSheet {...props} insets={NO_INSETS} docked={{ bottom: band + spacing.sm, tools: moreTools(present) }} /> : null}
    </>
  );
}

function CompactBar(props: BarParts): ReactElement {
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

/** A label's words never break inside the button (mock `presenter-nav.css` `.rail .ctl`): web only, ignored natively. */
const KEEP_WORDS = { overflowWrap: 'normal', wordBreak: 'keep-all' } as unknown as TextStyle;
/** The probe measures each word on one line. */
const ONE_LINE = { whiteSpace: 'nowrap' } as unknown as TextStyle;

const wordsOf = (label: string): string[] => label.split(/\s+/).filter((word) => word !== '');

interface RailCtlProps {
  label: string;
  icon?: IconName;
  primary?: boolean;
  /** The compact rail: a `touchTarget.min` square (64). */
  compact: boolean;
  /** The label is drawn (the full rail, and the compact rail's More while its word fits); else it is the accessible name only. */
  showLabel: boolean;
  /** The least height on the full rail (Next 96 or 64, the rest 64). */
  height: number;
  nudge?: boolean;
  expanded?: boolean;
  popup?: 'dialog';
  /** Marks the `more` glyph standing in for More's word (the label fallback). */
  glyph?: 'more';
  onPress?: () => void;
  focus: FocusTracker;
  testID: string;
}

/**
 * A rail button: 88 wide with no side padding (the 2 px border is the edge, so a label has 84 px),
 * at least `height` tall, the glyph above the label at the body size, up to two lines with no word
 * broken; or, compact, a 64 px square with the glyph alone and the label as its accessible name.
 */
const RailCtl = forwardRef<View, RailCtlProps>(function RailCtl({ label, icon, primary, compact, showLabel, height, nudge, expanded, popup, glyph, onPress, focus, testID }, ref) {
  const textScale = useTypeScale();
  const fg = primary ? colors.text.onPrimary : colors.text.primary;
  const size = compact ? RAIL_BUTTON_COMPACT : RAIL_BUTTON;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      role="button"
      accessibilityLabel={label}
      {...(expanded !== undefined ? { 'aria-expanded': expanded, accessibilityState: { expanded } } : {})}
      {...(popup !== undefined ? { 'aria-haspopup': popup } : {})}
      {...(nudge === true || glyph !== undefined ? { dataSet: { ...(nudge === true ? { nudge: 'on' } : {}), ...(glyph !== undefined ? { glyph } : {}) } } : {})}
      onPressIn={focus.pressIn}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={(state) => {
        const { focused } = state as PressState;
        return {
          width: size,
          ...(compact ? { height: size } : { minHeight: height }),
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.xs,
          paddingLeft: compact ? spacing.xs : spacing.none,
          paddingRight: compact ? spacing.xs : spacing.none,
          borderRadius: radii.lg,
          borderWidth: borderWidth.base,
          borderColor: primary ? colors.brand.primaryDark : colors.border.strong,
          backgroundColor: primary ? colors.brand.primaryDark : colors.surface.paper,
          ...(nudge === true && focused !== true ? nudgeRing : focusRing(focused === true)),
        };
      }}
    >
      {icon !== undefined ? <Icon name={icon} size={spacing.xxl} color={fg} /> : null}
      {showLabel ? (
        <Text
          {...KOREAN_LINE_BREAK}
          style={{ fontSize: textScale.size.body, fontWeight: typography.weight.bold, color: fg, textAlign: 'center', lineHeight: Math.round(textScale.size.body * typography.leading.tight), ...KEEP_WORDS }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
});

/** Measured word widths, per set of labels and text size (so a new language or text size measures again). */
interface RailWords {
  key: string;
  full: Readonly<Record<number, number>>;
  more: Readonly<Record<number, number>>;
}

/**
 * The phone rail (section 5.2): see `ControlBarProps` and the file header. It ignores `hidden` (it
 * never hides) and takes taps at once; its More sheet sits over the stage box beside it.
 */
function PhoneRail(props: BarParts & { rail: RailSize }): ReactElement {
  const { messages } = usePresenterView();
  const textScale = useTypeScale();
  const m = messages.learner.presenter.bar;
  const focus = props.focus;
  const insets = props.insets ?? NO_INSETS;
  const moreOpen = props.moreOpen === true;
  const compact = props.rail === 'compact';
  const width = compact ? PHONE_RAIL_COMPACT : PHONE_RAIL;

  // The label fallback (PN-0b N8): every word of every full-rail label (Next and Reveal both, so the
  // rail never flips between two builds of a slide) and More's own, measured at the chosen text size.
  const fullWords = [...new Set([m.more.cta, messages.common.buttons.next, m.reveal.cta, m.prev.cta, m.sound.cta].flatMap(wordsOf))];
  const moreWords = wordsOf(m.more.cta);
  const key = [...fullWords, '|', ...moreWords, String(textScale.size.body)].join('\n');
  const [words, setWords] = useState<RailWords>({ key, full: {}, more: {} });
  const known = words.key === key ? words : { key, full: {}, more: {} };
  const record =
    (group: 'full' | 'more', index: number) =>
    (event: LayoutChangeEvent): void => {
      const measuredWidth = event.nativeEvent.layout.width;
      setWords((current) => {
        const base = current.key === key ? current : { key, full: {}, more: {} };
        if (base[group][index] === measuredWidth) return base;
        return { ...base, [group]: { ...base[group], [index]: measuredWidth } };
      });
    };
  const fit = railLabelsFit({ full: Object.values(known.full), more: Object.values(known.more) }, RAIL_LABEL_ROOM);
  const onRailLabels = props.onRailLabels;
  useEffect(() => {
    onRailLabels?.(fit.full);
  }, [fit.full, onRailLabels]);

  const nextHeight = compact ? RAIL_BUTTON_COMPACT : railNextHeight(props.railHeight ?? Number.POSITIVE_INFINITY, touchTarget.min, spacing.sm);
  const moreDots = compact && !fit.moreText;
  const section = (grow: 'flex-start' | 'flex-end'): ViewStyle => ({ flexGrow: 1, flexShrink: 1, flexBasis: 0, justifyContent: grow, alignItems: 'center' });
  const probeText: TextStyle = { fontSize: textScale.size.body, fontWeight: typography.weight.bold, ...ONE_LINE };
  return (
    <>
      <View
        testID="presenter-rail"
        style={{
          width,
          alignSelf: 'stretch',
          marginTop: insets.top,
          marginBottom: insets.bottom,
          marginRight: insets.right,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          // The border.strong rule and this padding are the inert gap (PHONE_RAIL_GAP, 12): no button reaches it.
          paddingLeft: PHONE_RAIL_GAP - borderWidth.base,
          paddingRight: spacing.xs,
          borderLeftWidth: borderWidth.base,
          borderLeftColor: colors.border.strong,
          backgroundColor: colors.surface.sunken,
          overflow: 'hidden',
        }}
      >
        <View testID="presenter-rail-toolbar" role="toolbar" aria-orientation="vertical" aria-label={m.label} style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'center', gap: spacing.sm }}>
          <View testID="presenter-rail-top" style={section('flex-start')}>
            <RailCtl
              ref={props.exitRef}
              testID="presenter-more"
              label={m.more.cta}
              compact={compact}
              showLabel={!moreDots}
              {...(moreDots ? { icon: 'more' as const, glyph: 'more' as const } : {})}
              height={touchTarget.min}
              popup="dialog"
              expanded={moreOpen}
              onPress={() => props.onMore?.(!moreOpen)}
              focus={focus}
            />
          </View>
          <View testID="presenter-rail-pair" style={{ flexShrink: 0, alignItems: 'center', gap: spacing.sm }}>
            <RailCtl
              testID="presenter-next"
              label={props.revealNext ? m.reveal.cta : messages.common.buttons.next}
              icon="arrow-right"
              primary
              compact={compact}
              showLabel={!compact}
              height={nextHeight}
              {...(props.nudge !== undefined ? { nudge: props.nudge } : {})}
              onPress={props.onNext}
              focus={focus}
            />
            <RailCtl testID="presenter-back" label={m.prev.cta} icon="arrow-left" compact={compact} showLabel={!compact} height={touchTarget.min} onPress={props.onPrev} focus={focus} />
          </View>
          <View testID="presenter-rail-bottom" style={section('flex-end')}>
            <RailCtl testID="presenter-sound" label={m.sound.cta} icon={props.muted ? 'speaker-off' : 'speaker'} compact={compact} showLabel={!compact} height={touchTarget.min} onPress={props.onSound} focus={focus} />
          </View>
        </View>
        {/* The word probe: drawn transparent and out of the flow, taking no pointer and hidden from screen readers. */}
        <View testID="presenter-rail-probe" aria-hidden style={{ position: 'absolute', left: 0, top: 0, opacity: 0, pointerEvents: 'none', alignItems: 'flex-start' }}>
          {fullWords.map((word, index) => (
            <Text {...KOREAN_LINE_BREAK} key={`full-${word}`} testID={`presenter-rail-word-full-${index}`} onLayout={record('full', index)} style={probeText}>
              {word}
            </Text>
          ))}
          {moreWords.map((word, index) => (
            <Text {...KOREAN_LINE_BREAK} key={`more-${word}`} testID={`presenter-rail-word-more-${index}`} onLayout={record('more', index)} style={probeText}>
              {word}
            </Text>
          ))}
        </View>
      </View>
      {moreOpen ? <MoreSheet {...props} insets={{ ...insets, right: insets.right + width }} /> : null}
    </>
  );
}

/**
 * The compact bar's More (stage-and-bar.md "Phone", wireframe `classroom/lecture-phone.md` Panel D):
 * a modal sheet over the stage, the slide underneath. Its title, Close (focused on open), the status
 * chips, then the rest of the controls as `touchTarget.min` buttons; Tab stays inside and focus goes
 * back to More when it closes. A control runs its tool and closes the sheet.
 * The wrapped docked band's More (`docked`, AMENDMENTS-PRESENTER-NAV section 5.1; stage-and-bar.md
 * "Navigation (PN-0b)", the More fallback) is the same sheet over the stage, just above the band at
 * its right, holding only the tools it took (Slides, Timer, Blank); the band keeps the chips and the rest.
 */
function MoreSheet(props: BarParts & { insets: StageInsets; docked?: { bottom: number; tools: readonly DockedTool[] } }): ReactElement {
  const textScale = useTypeScale();
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.bar;
  const docked = props.docked;
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
  const button = (testID: string, label: string, onPress: () => void, pressed?: boolean): ReactElement => (
    <SheetButton key={testID} testID={testID} label={label} onPress={item(onPress)} {...(pressed !== undefined ? { pressed } : {})} />
  );
  return (
    <View
      ref={self}
      testID="presenter-more-sheet"
      role="dialog"
      aria-modal
      aria-label={m.label}
      style={
        docked
          ? { position: 'absolute', left: layout.gutter.regular, right: layout.gutter.regular, bottom: docked.bottom, alignItems: 'flex-end', zIndex: z.modal }
          : {
              position: 'absolute',
              left: props.insets.left + spacing.sm,
              right: props.insets.right + spacing.sm,
              bottom: props.insets.bottom + spacing.sm,
              top: props.insets.top + spacing.sm,
              alignItems: 'center',
              justifyContent: 'flex-end',
              zIndex: z.modal,
            }
      }
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
          {!docked && props.chips.length > 0 ? (
            <View testID="presenter-status" role="status" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <StatusChips chips={props.chips} onTurnSoundOn={props.onTurnSoundOn} focus={props.focus} />
            </View>
          ) : null}
          {docked ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {docked.tools.map((tool) =>
                tool === 'grid'
                  ? button('presenter-grid-button', m.grid.cta, props.onGrid)
                  : tool === 'timer'
                    ? button('presenter-timer', m.timer.cta, props.onTimer)
                    : button('presenter-blank-button', m.blank.cta, props.onBlank),
              )}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {button('presenter-grid-button', m.grid.cta, props.onGrid)}
              {button('presenter-timer', m.timer.cta, props.onTimer)}
              {button('presenter-blank-button', m.blank.cta, props.onBlank)}
              {props.fullscreenSupported ? button('presenter-fullscreen', m.fullscreen.cta, props.onFullscreen, props.fullscreen) : null}
              {button('presenter-help-button', messages.learner.presenter.home.help.cta, props.onHelp)}
              {button('presenter-exit', m.exit.cta, props.onExit)}
            </View>
          )}
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
function Chip({ chip, onTurnSoundOn, focus }: { chip: StatusChip; onTurnSoundOn: () => void; focus: FocusTracker }): ReactElement {
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
