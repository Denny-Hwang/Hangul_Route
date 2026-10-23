import { Body, KOREAN_LANGUAGE, KOREAN_LINE_BREAK, KoreanText, TEXT_SIZE_FACTORS, borderWidth, colors, layout, motion, radii, spacing, touchTarget, useEffectiveFontScale, useLayoutClass } from '@hangul-route/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, Text, View } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary';
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import { useMessages } from '../../i18n/use-messages';
import { BOARD_LINES, BOARD_VIEW, YUT_STATIONS, boardAfter, framesDuration, homeTray, moveFrames, type Frame, type Leg, type Move } from '../../logic/reviews/yut-board';

/**
 * Yut Review (F-CURR-002 section 7.1 F10, row CM-39; design design/wireframes/minigame/yut-review.md,
 * design/screens/minigame-variety/ D1 layout C, D9, the constants table and board B): a board band over the Daily Review
 * and Keep going, behind `game.yut-review`. The item area is the plain review screen's, unchanged.
 *
 * - Every finished item throws (the screen counts finished items; the board reads the session seed and that count and
 *   nothing else, `boardAfter`), so the board never shows a miss and gives nothing: no star, point, card or unlock.
 * - The band: the board (29 stations, the piece in `brand.primary`), the last throw named in Korean with its
 *   romanization and how far the piece went, the sticks, and the home tray, which draws only the pieces that went home.
 *   The stations are not tap targets; the board is one image, and each throw is described once in a polite live region.
 * - Sizes (constants table): 128 on a phone from 600 tall, 96 below 600 tall with the throw beside it and no sticks, and
 *   two panes from window class regular with the board at 320.
 * - Reduced motion: no walk and no falling sticks; every throw of the item shows at once.
 * - Large text (an effective font scale from `YUT_STACK_FONT_SCALE`): on a phone the throw wraps under the board.
 * - A band that fails to draw hides (an error boundary around the band alone): the round under it stays mounted and the
 *   session goes on as on the plain screen.
 */

/** The board on a phone from 600 tall: 2 x `touchTarget.min` (128). */
export const YUT_BOARD_PHONE = 2 * touchTarget.min;
/** The board below 600 tall: `touchTarget.hero` (96). */
export const YUT_BOARD_SHORT = touchTarget.hero;
/** The board from window class regular, beside the item: 5 x `touchTarget.min` (320). */
export const YUT_BOARD_PANE = 5 * touchTarget.min;
/** Below this window height the band shrinks (constants table: "128 from 600 tall; 96 below"). */
export const YUT_FULL_BAND_MIN_HEIGHT = 600;
/** From this effective font scale (the largest text size step, 150 %) the throw stacks under the board on a phone. */
export const YUT_STACK_FONT_SCALE = TEXT_SIZE_FACTORS.largest;

/** Station and piece radii in board units (the 120 viewBox of the mock). */
const STATION_R = 5;
const PIECE_R = 8;
/** The sticks drawing: four plain bars in one colour, so the art shows no rule on which side counts. */
const STICKS_W = 72;
const STICKS_H = 40;
const STICK_BARS: ReadonlyArray<{ x: number; y: number; rot: number }> = [
  { x: 4, y: 6, rot: -8 },
  { x: 14, y: 16, rot: 6 },
  { x: 8, y: 26, rot: -3 },
  { x: 22, y: 30, rot: 10 },
];
const STICK_LEN = 44;
const STICK_THICK = 7;
/** The tray's piece token. */
const TRAY_PIECE = spacing.md;
/** The sticks tumble from this angle as they fall. */
const TUMBLE_DEG = 14;

/** Visually hidden, still read. */
const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };
const korean = { lang: KOREAN_LANGUAGE, accessibilityLanguage: KOREAN_LANGUAGE };

const FRAME_TIMES = { fall: motion.duration.base, step: motion.duration.fast, again: motion.duration.slow };

/**
 * How long the plain result waits after the last round ends, so the last item's throw is seen (and read) too: with
 * motion, the last move's walk and then `motion.duration.slow` on its final station (at most three throws, so bounded);
 * with reduced motion, a still `motion.duration.celebration` with nothing moving. 0 when there is no move to show.
 */
export function yutResultHold(seed: number, ended: number, reducedMotion: boolean): number {
  try {
    const move = boardAfter(seed, ended).last;
    if (move === null) return 0;
    if (reducedMotion) return motion.duration.celebration;
    return framesDuration(moveFrames(move, FRAME_TIMES, false)) + motion.duration.slow;
  } catch {
    // A board that cannot be worked out is hidden (the band's error boundary); the result does not wait for it.
    return 0;
  }
}

/** A sentence ends with its full stop (the visible lines have none: "Throw again"). */
const sentence = (text: string): string => (/[.!?。]$/.test(text) ? text : `${text}.`);

/**
 * Runs the frames of the latest move; returns the one on screen. The frame index belongs to its frames: a new move
 * starts at its own first frame in the same render (no frame of the move before, or of its end, flashes first).
 */
function useFrame(move: Move | null, reducedMotion: boolean): Frame | null {
  const frames = useMemo(() => (move === null ? [] : moveFrames(move, FRAME_TIMES, reducedMotion)), [move, reducedMotion]);
  const startAt = reducedMotion ? Math.max(0, frames.length - 1) : 0;
  const [run, setRun] = useState({ frames, index: startAt });
  let current = run;
  if (run.frames !== frames) {
    current = { frames, index: startAt };
    setRun(current);
  }
  useEffect(() => {
    if (reducedMotion || frames.length <= 1) return undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    frames.forEach((f, i) => {
      if (i === 0) return;
      at += f.delay;
      timers.push(setTimeout(() => setRun((r) => (r.frames === frames ? { frames, index: i } : r)), at));
    });
    return () => timers.forEach(clearTimeout);
  }, [frames, reducedMotion]);
  return frames[Math.min(current.index, frames.length - 1)] ?? null;
}

/** Says a move on native: VoiceOver queues it after the next round's own announcements; Android and the web read the live region. Never throws. */
function announceMove(text: string): void {
  if (Platform.OS !== 'ios') return;
  try {
    AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
  } catch {
    // Nothing to say it with: the throw is still on screen.
  }
}

function Board({ size, position, label }: { size: number; position: number; label: string }): ReactElement {
  const at = YUT_STATIONS[position] ?? YUT_STATIONS[0]!;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} testID="yut-board" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${BOARD_VIEW} ${BOARD_VIEW}`}>
        <Path d={BOARD_LINES} fill="none" stroke={colors.border.strong} strokeWidth={borderWidth.base} />
        {YUT_STATIONS.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={STATION_R} fill={colors.surface.paper} stroke={colors.border.shape} strokeWidth={borderWidth.base} />
        ))}
        <Circle cx={at.x} cy={at.y} r={PIECE_R} fill={colors.brand.primary} stroke={colors.surface.paper} strokeWidth={borderWidth.thick} testID={`yut-piece-${position}`} />
      </Svg>
    </View>
  );
}

function Sticks({ throwKey, reducedMotion }: { throwKey: string; reducedMotion: boolean }): ReactElement {
  const fall = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) {
      fall.setValue(1);
      return undefined;
    }
    fall.setValue(0);
    const run = Animated.timing(fall, { toValue: 1, duration: motion.duration.base, useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [fall, throwKey, reducedMotion]);
  const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: [`${-TUMBLE_DEG}deg`, '0deg'] });
  return (
    <Animated.View {...hidden} testID="yut-sticks" style={{ width: STICKS_W, height: STICKS_H, transform: [{ rotate }] }}>
      <Svg width={STICKS_W} height={STICKS_H} viewBox={`0 0 ${STICKS_W} ${STICKS_H}`}>
        {STICK_BARS.map((b, i) => (
          <Rect
            key={i}
            x={b.x}
            y={b.y}
            width={STICK_LEN}
            height={STICK_THICK}
            rx={STICK_THICK / 2}
            transform={`rotate(${b.rot} ${b.x + STICK_LEN / 2} ${b.y + STICK_THICK / 2})`}
            fill={colors.hoya.furDark}
            stroke={colors.border.shape}
            strokeWidth={borderWidth.thin}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

function Tray({ laps, label }: { laps: number; label: string }): ReactElement {
  return (
    <View
      testID="yut-tray"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        alignSelf: 'flex-start',
        maxWidth: '100%',
        gap: spacing.sm,
        backgroundColor: colors.surface.sunken,
        borderRadius: radii.pill,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
      }}
    >
      <Body size="sm" weight="semibold">
        {label}
      </Body>
      {Array.from({ length: homeTray(laps) }, (_, i) => (
        <View
          key={i}
          {...hidden}
          testID="yut-tray-piece"
          style={{ width: TRAY_PIECE, height: TRAY_PIECE, borderRadius: radii.circle, backgroundColor: colors.brand.primary, borderWidth: borderWidth.thin, borderColor: colors.surface.paper }}
        />
      ))}
    </View>
  );
}

/** The live description of a move: each throw, "Throw again" between, and "A piece went home!" when one did. */
function useDescription(move: Move | null): { text: string; parts: Array<{ before: string; ko: string; after: string }>; tail: string } | null {
  const m = useMessages();
  return useMemo(() => {
    if (move === null) return null;
    const mark = '\u0000';
    const parts = move.legs.map((leg: Leg) => {
      const line = m.a11y.yutReview.throw(mark, leg.throw.romanization, leg.path.length);
      const [before = '', after = ''] = line.split(mark);
      return { before, ko: leg.throw.ko, after: leg.throw.again ? `${after} ${sentence(m.learner.yutReview.throwAgain)}` : after };
    });
    // The legs join with a space, carried by the next leg's text so the region reads it as one sentence run.
    parts.forEach((p, i) => {
      if (i > 0) p.before = ` ${p.before}`;
    });
    const tail = move.legs.some((l) => l.home) ? ` ${sentence(m.learner.yutReview.pieceHome)}` : '';
    const text = `${parts.map((p) => `${p.before}${p.ko}${p.after}`).join('')}${tail}`;
    return { text, parts, tail };
  }, [m, move]);
}

export interface YutReviewSkinProps {
  /** The session's seed (`sessionSeed`): the throws depend on it and on each item's place, never on an answer. */
  seed: number;
  /** Items finished so far in this session, whatever their results. */
  finished: number;
  reducedMotion: boolean;
  /** The plain review screen's item area. */
  children: ReactNode;
}

/** The band's layout, worked out by the shell (outside the error boundary) so the round keeps its place if the band fails. */
interface BandLayout {
  /** From 600 tall: the full band with the sticks. */
  tall: boolean;
  /** Two panes from window class regular: the band beside the item. */
  panes: boolean;
  /** Large text on a phone: the throw under the board. */
  stacked: boolean;
  size: number;
}

function YutBand({ seed, finished, reducedMotion, band }: { seed: number; finished: number; reducedMotion: boolean; band: BandLayout }): ReactElement {
  const m = useMessages();
  const copy = m.learner.yutReview;
  const board = useMemo(() => boardAfter(seed, finished), [seed, finished]);
  const frame = useFrame(board.last, reducedMotion);
  const description = useDescription(board.last);

  // VoiceOver hears each throw once, queued after the next round's own announcements; Android and the web read the
  // polite region below.
  useEffect(() => {
    if (description !== null) announceMove(description.text);
  }, [description]);

  const { tall, panes, stacked, size } = band;
  const move = board.last;
  const position = frame?.position ?? board.state.position;
  const laps = frame?.laps ?? board.state.laps;
  const shownLegs = move === null || frame === null ? [] : move.legs.slice(0, frame.legs);
  const wentHome = move !== null && laps > move.from.laps;
  const column = tall || stacked;

  const throwPanel = (
    <View style={{ gap: spacing.sm, flexShrink: 1, maxWidth: '100%' }} testID="yut-throw">
      {shownLegs.map((leg, i) => (
        <View key={`${finished}-${i}`} testID="yut-throw-leg" style={{ flexDirection: column ? 'column' : 'row', flexWrap: 'wrap', alignItems: column ? 'flex-start' : 'center', gap: spacing.xs }}>
          <KoreanText ko={leg.throw.ko} romanization={leg.throw.romanization} size="sm" testID={`yut-throw-name-${leg.throw.name}`} />
          <Body size="sm" tone="secondary" testID="yut-throw-stations">
            {copy.stations(leg.path.length)}
          </Body>
          {leg.throw.again ? (
            <Body size="sm" weight="semibold" testID="yut-throw-again">
              {copy.throwAgain}
            </Body>
          ) : null}
        </View>
      ))}
      {wentHome ? (
        <Body weight="semibold" testID="yut-piece-home">
          {copy.pieceHome}
        </Body>
      ) : null}
      {tall && move !== null ? <Sticks throwKey={`${finished}-${frame?.legs ?? 0}`} reducedMotion={reducedMotion} /> : null}
      <Tray laps={laps} label={copy.home} />
    </View>
  );

  // The polite region (the web and Android; iOS is told above): the whole move once, the Korean names tagged Korean
  // (shell rule 12).
  const words =
    description === null
      ? ''
      : description.parts.map((p, i) => (
          <Text {...KOREAN_LINE_BREAK} key={`${finished}-${i}`}>
            {p.before}
            <Text {...KOREAN_LINE_BREAK} {...korean}>
              {p.ko}
            </Text>
            {p.after}
          </Text>
        ));
  const live =
    Platform.OS === 'web' ? (
      <Text {...KOREAN_LINE_BREAK} style={srOnly} accessibilityLiveRegion="polite" aria-live="polite" testID="yut-live">
        {words}
        {description?.tail ?? ''}
      </Text>
    ) : Platform.OS === 'android' ? (
      <View style={srOnly} accessibilityLiveRegion="polite" testID="yut-live">
        <Text {...KOREAN_LINE_BREAK}>
          {words}
          {description?.tail ?? ''}
        </Text>
      </View>
    ) : null;

  const boardView = <Board size={size} position={position} label={m.a11y.yutReview.board} />;

  if (panes) {
    return (
      <View style={{ width: size, gap: spacing.md }} testID="yut-band">
        {boardView}
        {throwPanel}
        {live}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: 'flex-start', gap: spacing.md }} testID="yut-band">
      {boardView}
      {throwPanel}
      {live}
    </View>
  );
}

export function YutReviewSkin({ seed, finished, reducedMotion, children }: YutReviewSkinProps): ReactElement {
  const lc = useLayoutClass();
  const fontScale = useEffectiveFontScale();
  const tall = lc.windowHeight === 0 || lc.windowHeight >= YUT_FULL_BAND_MIN_HEIGHT;
  const panes = tall && lc.width !== 'compact';
  const band: BandLayout = { tall, panes, stacked: !panes && fontScale >= YUT_STACK_FONT_SCALE, size: !tall ? YUT_BOARD_SHORT : panes ? YUT_BOARD_PANE : YUT_BOARD_PHONE };
  // Only the band sits in the boundary: if it fails to draw it hides, and the round (a sibling) stays mounted as is.
  const bandView = (
    <ErrorBoundary fallback={null}>
      <YutBand seed={seed} finished={finished} reducedMotion={reducedMotion} band={band} />
    </ErrorBoundary>
  );

  if (panes) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: layout.pane.gap }} testID="yut-review-skin">
        {bandView}
        <View style={{ flex: 1, maxWidth: layout.maxWidth.reading, gap: spacing.md }}>{children}</View>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.md }} testID="yut-review-skin">
      {bandView}
      {children}
    </View>
  );
}
