import { a11yRomanization } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  Heading,
  Hoya,
  Icon,
  KOREAN_LANGUAGE,
  Pill,
  Progress,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
  useLayoutClass,
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { StrokeHint } from '../../components/StrokeHint';
import { strokesForJamo, type JamoStrokePoint } from '../../content/jamo-strokes';
import { useMessages } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import { describeStrokeOrder, pointsToPathD } from '../../logic/stroke-diagram';
import { TRACE_IDLE_MS, type TraceEvaluator } from '../../logic/trace-evaluator';
import { traceCanvasMax, traceLayoutMode, traceScreenWidth, traceSidePanelWidth } from '../../logic/trace-layout';
import { BLOCK_VIEWBOX, type PlacedLetter } from '../../logic/trace-word/block-strokes';
import { createTraceWordGate, everyLetterInked, scoreTraceUnit } from '../../logic/trace-word/evaluate';
import {
  answerOf,
  blocksPassed,
  initialTraceWordState,
  lettersPassed,
  traceWordReducer,
  type TraceWordAction,
  type TraceWordRoundShape,
  type TraceWordState,
} from '../../logic/trace-word/flow';
import { buildTraceWordRounds, letterCounts, type TraceWordBlock, type TraceWordPlayRound } from '../../logic/trace-word/rounds';
import { traceWordCanvases, traceWordMessage, traceWordTone, type TraceWordCoaching, type TraceWordTone } from '../../logic/trace-word/view';
import { playPrompt } from '../../platform/audio';
import { nudge, success } from '../../platform/haptics';
import type { MinigameHost } from './host';

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** The way out from the empty state (no word could be drawn). */
  onBack?: () => void;
}

/** The pass look stays this long before the next letter or block (Trace Stroke's pass pause). */
const PASS_MS = 1100;
/** The retry look stays this long, then the drawing clears (Trace Stroke's retry pause). */
const RETRY_MS = 1800;
/** The whole word shows in the strip this long before the next round. */
const WORD_DONE_MS = 1600;

// The shipped ghost and ink looks of Trace Stroke, in the 200 viewBox (design/screens/minigame-writing/README.md).
const GHOST_WIDTH = 18;
const GHOST_OPACITY = 0.12;
/** Letter mode: the letters waiting their turn drop to half the ghost. */
const GHOST_WAITING_OPACITY = 0.06;
const INK_WIDTH = 8;
/** Zone guides: a writing-paper look, never scored. */
const GUIDE_DASH = '3 5';
const GUIDE_OPACITY = 0.7;
/** The traced word drawn small in a done chip. */
const CHIP_INK_WIDTH = 14;

type Look = 'live' | 'pass' | 'retry' | 'waiting';

const fillOf: Record<Look, string> = {
  live: colors.brand.primaryLight,
  pass: colors.feedback.successLight,
  retry: colors.feedback.nudgeLight, // anti-shame: amber, never red
  waiting: colors.surface.paper,
};
const borderOf: Record<Look, string> = {
  live: colors.brand.primary,
  pass: colors.feedback.success,
  retry: colors.feedback.nudge,
  waiting: colors.border.subtle,
};

/**
 * Trace a Word (F-CURR-001 §3.7 item 3, row G-4; wireframe design/wireframes/minigame/trace-word.md,
 * mock design/screens/minigame-writing/trace-word.md): a one- or two-block word traced block by
 * block over a ghost drawn from the jamo stroke data, each letter in its zone of the block. The
 * Trace Stroke frame (canvas sizes, Hoya strip, Done and Skip always on screen, no scrolling)
 * with a word strip; letter-by-letter mode for a round whose ghost reads poorly at block size.
 * Order and direction coach, never fail; the round scores once, when the word is done.
 */
export function TraceWordGame({ scope, host, onBack }: Props): React.ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const a11y = m.a11y.minigame;
  const rounds = useMemo<TraceWordPlayRound[]>(() => buildTraceWordRounds(scope.traceWord?.rounds ?? [], strokesForJamo), [scope]);
  const shapes = useMemo<TraceWordRoundShape[]>(() => rounds.map((r) => ({ mode: r.mode, letterCounts: letterCounts(r) })), [rounds]);

  const [state, setState] = useState<TraceWordState>(() => initialTraceWordState(shapes));
  const stateRef = useRef(state);
  // The strokes of the live unit; a ref too, so the idle gate reads them as they are drawn.
  const [strokes, setStrokesState] = useState<JamoStrokePoint[][]>([]);
  const strokesRef = useRef<JamoStrokePoint[][]>([]);
  // The passed blocks' strokes, kept for the word-done strip and the tablet's done canvas, then dropped.
  const [traced, setTraced] = useState<JamoStrokePoint[][][]>([]);
  const [coaching, setCoaching] = useState<TraceWordCoaching | null>(null);
  const [hintToken, setHintToken] = useState(0);
  const [hintPlaying, setHintPlaying] = useState(false);
  const [box, setBox] = useState<Size | null>(null);
  const [slot, setSlot] = useState<Size | null>(null);
  const gateRef = useRef<TraceEvaluator | null>(null);
  const evaluateRef = useRef<() => void>(() => {});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);
  const layoutClass = useLayoutClass();

  const round = rounds[state.round];
  const block = round?.blocks[state.block];
  const letter = block?.placed.letters[state.letter];
  const unitLetters: PlacedLetter[] = round && block ? (round.mode === 'letter' && letter ? [letter] : block.placed.letters) : [];

  const setStrokes = (next: JamoStrokePoint[][]): void => {
    strokesRef.current = next;
    setStrokesState(next);
  };

  const finish = (): void => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    gateRef.current?.dispose();
    if (timerRef.current) clearTimeout(timerRef.current);
    host.complete();
  };

  const apply = (action: TraceWordAction): TraceWordState => {
    const prev = stateRef.current;
    const next = traceWordReducer(prev, action, shapes);
    stateRef.current = next;
    setState(next);
    const answer = answerOf(prev, next);
    if (answer) {
      const answered = rounds[answer.round];
      host.answer(answer.round, answer.correct, answered ? { itemId: answered.id } : undefined);
    }
    if (next.phase === 'finished') finish();
    return next;
  };

  const after = (ms: number, fn: () => void): void => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      fn();
    }, ms);
  };

  useEffect(() => {
    const gate = createTraceWordGate({
      idleMs: TRACE_IDLE_MS,
      onEvaluate: () => evaluateRef.current(),
      ready: () => {
        const s = stateRef.current;
        const r = rounds[s.round];
        if (!r || r.mode === 'letter') return true;
        return everyLetterInked(r.blocks[s.block]?.placed.letters ?? [], strokesRef.current);
      },
    });
    gateRef.current = gate;
    return () => {
      gate.dispose();
      gateRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // The gate lives as long as the screen; it reads the live state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each new block plays its sound once, as Trace Stroke plays its letter.
  useEffect(() => {
    if (block && state.phase === 'drawing' && state.letter === 0) void playPrompt({ text: block.syllable, kind: 'sound', source: 'trace-word' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.round, state.block]);

  if (!round || !block) {
    return (
      <Screen>
        <Body>{copy.noRounds}</Body>
        <Spacer size="lg" />
        {onBack ? <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={onBack} /> : null}
        <Button label={copy.skip.cta} tone="ghost" size="md" onPress={finish} />
      </Screen>
    );
  }

  const evaluate = (): void => {
    const drawn = strokesRef.current;
    if (drawn.length === 0 || stateRef.current.phase !== 'drawing') {
      gateRef.current?.reopen();
      return;
    }
    const result = scoreTraceUnit(unitLetters, drawn, round.tolerance);
    setCoaching({ orderCorrect: result.orderCorrect, directionNudge: result.directionNudge });
    setHintPlaying(false);
    const next = apply({ type: 'evaluated', passed: result.passed });
    if (!result.passed) {
      nudge();
      after(RETRY_MS, () => {
        setStrokes([]);
        setCoaching(null);
        apply({ type: 'continue' });
        gateRef.current?.reopen();
      });
      return;
    }
    success();
    // The block's ink so far (letter mode adds each letter's) stays for the word strip.
    const blockIdx = next.block;
    setTraced((prev) => {
      const out = [...prev];
      out[blockIdx] = [...(out[blockIdx] ?? []), ...drawn];
      return out;
    });
    after(next.phase === 'wordDone' ? WORD_DONE_MS : PASS_MS, () => {
      setStrokes([]);
      setCoaching(null);
      setHintToken(0);
      if (stateRef.current.phase === 'wordDone') setTraced([]);
      apply({ type: 'continue' });
      gateRef.current?.nextRound();
    });
  };
  evaluateRef.current = evaluate;

  const beginStroke = (point: JamoStrokePoint): void => {
    if (stateRef.current.phase !== 'drawing') return;
    setStrokes([...strokesRef.current, [point]]);
    gateRef.current?.strokeStarted();
  };
  const appendPoint = (point: JamoStrokePoint): void => {
    if (stateRef.current.phase !== 'drawing') return;
    const prev = strokesRef.current;
    if (prev.length === 0) return;
    const next = [...prev];
    next[next.length - 1] = [...next[next.length - 1]!, point];
    setStrokes(next);
  };
  const endStroke = (): void => {
    if (stateRef.current.phase !== 'drawing') return;
    gateRef.current?.strokeEnded();
  };

  const mode = box ? traceLayoutMode(box) : 'compact';
  const stacked = mode === 'roomy';
  const canvases = slot
    ? traceWordCanvases({
        blocks: round.blocks.length,
        slotWidth: slot.width,
        slotHeight: slot.height,
        max: traceCanvasMax(layoutClass),
        gap: spacing.lg,
        side: mode === 'side',
      })
    : null;
  const size = canvases?.size ?? 0;
  const toViewBox = (x: number, y: number): JamoStrokePoint => ({ x: (x * BLOCK_VIEWBOX) / size, y: (y * BLOCK_VIEWBOX) / size });

  const pan = Gesture.Pan()
    .onBegin((e) => {
      runOnJS(beginStroke)(toViewBox(e.x, e.y));
    })
    .onUpdate((e) => {
      runOnJS(appendPoint)(toViewBox(e.x, e.y));
    })
    .onEnd(() => {
      runOnJS(endStroke)();
    });

  const phase = state.phase;
  const liveLook: Look = phase === 'retry' ? 'retry' : phase === 'drawing' ? 'live' : 'pass';
  const done = blocksPassed(state);
  const unitStrokes = unitLetters.flatMap((l) => l.strokes);
  // Show me's still diagram reads the unit letter by letter (wireframe "Accessibility").
  const firstLetter = round.mode === 'letter' ? state.letter : 0;
  const orderLabel = unitLetters
    .map((l, i) => a11y.traceWordLetterOrder(firstLetter + i + 1, block.placed.letters.length, describeStrokeOrder(l.strokes, a11y.strokeOrder)))
    .join(' ');

  const liveCanvas = (
    <GestureDetector gesture={pan}>
      <View
        nativeID="trace-canvas"
        testID="trace-word-canvas"
        accessibilityLabel={
          round.mode === 'letter'
            ? a11y.traceBlockLetter(
                a11yRomanization(block.romanization),
                state.block + 1,
                round.blocks.length,
                state.letter + 1,
                block.placed.letters.length,
              )
            : a11y.traceBlock(a11yRomanization(block.romanization), state.block + 1, round.blocks.length)
        }
        style={canvasStyle(size, liveLook)}
      >
        <BlockArt
          block={block}
          size={size}
          focus={round.mode === 'letter' ? state.letter : null}
          ink={round.mode === 'letter' ? [...(traced[state.block] ?? []), ...strokes] : strokes}
          inkWidth={INK_WIDTH}
        />
        {hintPlaying ? (
          <StrokeHint
            target={unitStrokes}
            size={size}
            viewBox={BLOCK_VIEWBOX}
            playToken={hintToken}
            orderLabel={orderLabel}
            onComplete={() => setHintPlaying(false)}
          />
        ) : null}
      </View>
    </GestureDetector>
  );

  const otherCanvas = (index: number): React.ReactElement => {
    const other = round.blocks[index]!;
    const passed = index < done;
    return (
      <View key={other.syllable + index} testID={`trace-word-canvas-${passed ? 'done' : 'waiting'}`} style={canvasStyle(size, passed ? 'pass' : 'waiting', !passed)}>
        <BlockArt block={other} size={size} focus={null} ink={passed ? (traced[index] ?? []) : []} inkWidth={INK_WIDTH} />
      </View>
    );
  };

  const canvasSlot = (
    <View
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setSlot((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
      }}
      style={{ flex: 1, minHeight: 0, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      {size > 0 ? (
        canvases?.count === 2 ? (
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            {round.blocks.map((_, i) => (i === state.block ? <React.Fragment key="live">{liveCanvas}</React.Fragment> : otherCanvas(i)))}
          </View>
        ) : (
          liveCanvas
        )
      ) : null}
    </View>
  );

  const progressRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Progress value={state.round + 1} max={rounds.length} tone="primary" />
      </View>
      <Pill label={copy.progress.pill(state.round + 1, rounds.length)} size="sm" />
    </View>
  );

  const heading = (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={a11y.traceWord(a11yRomanization(round.word.romanization), round.word.en)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.sm }}
    >
      <Heading level="prompt">{copy.traceWord.heading}</Heading>
      <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={koreanWordStyle}>
        {round.word.ko}
      </Text>
    </View>
  );

  const letterCount = block.placed.letters.length;
  const lettersDone = lettersPassed(state, letterCount);
  const strip = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }} testID="trace-word-strip">
      {round.blocks.map((b, i) => (
        <BlockChip
          key={b.syllable + i}
          block={b}
          state={i < done ? 'done' : i === state.block ? 'current' : 'waiting'}
          ink={phase === 'wordDone' ? (traced[i] ?? null) : null}
          label={i < done ? a11y.hearBlockDone(a11yRomanization(b.romanization)) : a11y.hear(a11yRomanization(b.romanization))}
          onPress={() => void playPrompt({ text: b.syllable, kind: 'sound', source: 'trace-word' })}
        />
      ))}
      <Caption tone="muted">{`${round.word.romanization} · ${round.word.en}`}</Caption>
      {round.mode === 'letter' ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
          {block.placed.letters.map((l, i) => (
            <View key={l.role} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={[partMarkStyle, i === state.letter && phase === 'drawing' ? { fontWeight: typography.weight.bold, color: colors.text.primary } : null]}>
                {l.char}
              </Text>
              {i < lettersDone ? <Icon name="check" size={16} color={colors.feedback.success} /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  const helpers = (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}>
      <Button
        label={copy.trace.showMe.cta}
        tone="secondary"
        size="sm"
        disabled={hintPlaying || phase !== 'drawing'}
        onPress={() => {
          setHintToken((t) => t + 1);
          setHintPlaying(true);
          void playPrompt({ text: block.syllable, kind: 'sound', source: 'trace-word' });
        }}
      />
      <Button
        label={copy.trace.clear.cta}
        tone="ghost"
        size="sm"
        disabled={strokes.length === 0 || phase !== 'drawing'}
        onPress={() => {
          setStrokes([]);
          gateRef.current?.clear();
        }}
      />
    </View>
  );

  const doneButton = (
    <Button
      label={copy.trace.done.cta}
      tone="primary"
      size={stacked ? 'lg' : 'md'}
      fullWidth
      disabled={strokes.length === 0 || phase !== 'drawing'}
      onPress={() => {
        gateRef.current?.done();
      }}
    />
  );
  const skipButton = <Button label={copy.skip.cta} tone="ghost" size="md" fullWidth onPress={finish} />;
  const actions = stacked ? (
    <View style={{ gap: spacing.sm }}>
      {doneButton}
      {skipButton}
    </View>
  ) : (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <View style={{ flex: 1 }}>{doneButton}</View>
      <View style={{ flex: 1 }}>{skipButton}</View>
    </View>
  );

  const controls = (
    <View style={{ gap: spacing.sm }}>
      {helpers}
      <HoyaStrip tone={traceWordTone(phase)} message={traceWordMessage(phase, round.mode, coaching, copy)} lines={mode === 'side' ? 3 : 2} showHoya={stacked} />
      {actions}
    </View>
  );

  return (
    <Screen tone="canvas" scrollable={false} width={traceScreenWidth(layoutClass)}>
      <View
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setBox((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
        }}
        style={{ flex: 1, minHeight: 0 }}
      >
        {box === null ? null : mode === 'side' ? (
          <View style={{ flex: 1, flexDirection: 'row', gap: spacing.lg }}>
            {canvasSlot}
            <View style={{ width: traceSidePanelWidth(box.width), justifyContent: 'center', gap: spacing.sm }}>
              {progressRow}
              {heading}
              {strip}
              {controls}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, gap: spacing.md }}>
            {progressRow}
            {heading}
            {strip}
            {canvasSlot}
            {controls}
          </View>
        )}
      </View>
    </Screen>
  );
}

interface Size {
  width: number;
  height: number;
}

// Speech language for assistive tech on the Hangul (as KoreanText does); spread for the web-only `lang`.
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

const koreanWordStyle = {
  fontFamily: typography.family.sansKr,
  fontSize: typography.size.title,
  fontWeight: typography.weight.bold,
  color: colors.text.primary,
} as const;

const partMarkStyle = {
  fontFamily: typography.family.sansKr,
  fontSize: typography.size.bodyLg,
  color: colors.text.secondary,
} as const;

function canvasStyle(size: number, look: Look, quiet = false): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: radii.xxl,
    backgroundColor: fillOf[look],
    borderWidth: quiet ? borderWidth.base : borderWidth.thick,
    borderColor: borderOf[look],
    overflow: 'hidden',
  };
}

/**
 * One block: the zone guides, the ghost of every letter in its zone and the ink drawn over it.
 * `focus` (letter mode) lights that letter's zone and quiets the other letters' ghosts.
 */
function BlockArt({
  block,
  size,
  focus,
  ink,
  inkWidth,
}: {
  block: TraceWordBlock;
  size: number;
  focus: number | null;
  ink: JamoStrokePoint[][];
  inkWidth: number;
}): React.ReactElement {
  const letters = block.placed.letters;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BLOCK_VIEWBOX} ${BLOCK_VIEWBOX}`}>
      {letters.flatMap((l, li) =>
        l.zones.map((z, zi) => (
          <Rect
            key={`zone-${li}-${zi}`}
            x={z.x}
            y={z.y}
            width={z.width}
            height={z.height}
            rx={radii.sm}
            fill={focus === li ? colors.surface.paper : 'none'}
            stroke={focus === li ? colors.brand.primary : colors.border.shape}
            strokeWidth={1}
            strokeDasharray={focus === li ? undefined : GUIDE_DASH}
            strokeOpacity={focus === li ? 1 : GUIDE_OPACITY}
          />
        )),
      )}
      {letters.flatMap((l, li) =>
        l.strokes.map((stroke, si) => (
          <Path
            key={`ghost-${li}-${si}`}
            d={pointsToPathD(stroke)}
            stroke={colors.text.primary}
            strokeOpacity={focus !== null && focus !== li ? GHOST_WAITING_OPACITY : GHOST_OPACITY}
            strokeWidth={GHOST_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )),
      )}
      {ink.map((stroke, i) => (
        <Path
          key={`ink-${i}`}
          d={pointsToPathD(stroke)}
          stroke={colors.text.primary}
          strokeWidth={inkWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

/** A block in the word strip: tap to hear it. When the word is done it shows the learner's own strokes, small. */
function BlockChip({
  block,
  state,
  ink,
  label,
  onPress,
}: {
  block: TraceWordBlock;
  state: 'current' | 'done' | 'waiting';
  ink: JamoStrokePoint[][] | null;
  label: string;
  onPress: () => void;
}): React.ReactElement {
  const look: Look = state === 'current' ? 'live' : state === 'done' ? 'pass' : 'waiting';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: state === 'current' }}
      onPress={onPress}
      testID={`trace-word-chip-${state}`}
      style={{
        width: touchTarget.min,
        height: touchTarget.min,
        borderRadius: radii.md,
        borderWidth: state === 'waiting' ? borderWidth.base : borderWidth.thick,
        borderColor: borderOf[look],
        backgroundColor: fillOf[look],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {ink ? (
        <Svg width={touchTarget.min - 2 * borderWidth.thick} height={touchTarget.min - 2 * borderWidth.thick} viewBox={`0 0 ${BLOCK_VIEWBOX} ${BLOCK_VIEWBOX}`}>
          {ink.map((stroke, i) => (
            <Path key={i} d={pointsToPathD(stroke)} stroke={colors.text.primary} strokeWidth={CHIP_INK_WIDTH} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
        </Svg>
      ) : (
        <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontSize: typography.size.title, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {block.syllable}
        </Text>
      )}
      {state === 'done' && !ink ? (
        <View style={{ position: 'absolute', top: spacing.xxs, right: spacing.xxs }}>
          <Icon name="check" size={18} color={colors.feedback.success} />
        </View>
      ) : null}
    </Pressable>
  );
}

const stripBg: Record<TraceWordTone, string> = {
  idle: colors.surface.paper,
  cheering: colors.feedback.successLight,
  thinking: colors.feedback.nudgeLight,
};
const stripBorder: Record<TraceWordTone, string> = {
  idle: colors.border.subtle,
  cheering: colors.feedback.success,
  thinking: colors.feedback.nudge,
};
const STRIP_LINE = Math.ceil(typography.size.bodySm * typography.leading.normal);

/** Hoya's line in a strip of fixed height (Trace Stroke's), so a longer line never moves the canvas. */
function HoyaStrip({ tone, message, lines, showHoya }: { tone: TraceWordTone; message: string; lines: number; showHoya: boolean }): React.ReactElement {
  return (
    <View
      accessibilityLiveRegion="polite"
      testID="trace-word-hoya"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        height: lines * STRIP_LINE + 2 * spacing.sm + 2 * borderWidth.base,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.lg,
        borderWidth: borderWidth.base,
        borderColor: stripBorder[tone],
        backgroundColor: stripBg[tone],
        overflow: 'hidden',
      }}
    >
      {showHoya ? <Hoya pose={tone} size={40} /> : null}
      <View style={{ flex: 1 }}>
        <Body weight="semibold" size="sm">
          {message}
        </Body>
      </View>
    </View>
  );
}
