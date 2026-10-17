import {
  Body,
  Button,
  Caption,
  Heading,
  Hoya,
  Pill,
  Progress,
  Screen,
  borderWidth,
  colors,
  radii,
  spacing,
  typography,
  useLayoutClass,
  useTypeScale,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { JamoStrokePoint } from '../../content/jamo-strokes';
import { strokesForJamo } from '../../content/jamo-strokes';
import { useMessages } from '../../i18n/use-messages';
import type { LayoutChangeEvent } from 'react-native';
import { traceCanvasA11yLabel, traceHeadingText, traceTargetA11yText } from '../../logic/korean-labels';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildTraceStrokeRounds, type TraceStrokeRound } from '../../logic/round-builder';
import { pointsToPathD } from '../../logic/stroke-diagram';
import { DEFAULT_PASS_THRESHOLD, scoreTrace } from '../../logic/stroke-scoring';
import { directionNudgeFor, failMessage, passMessage, type DirectionNudge } from '../../logic/trace-copy';
import {
  traceCanvasMax,
  traceCanvasSize,
  traceLayoutMode,
  traceScreenWidth,
  traceSidePanelWidth,
} from '../../logic/trace-layout';
import { TRACE_IDLE_MS, createTraceEvaluator, type TraceEvaluator } from '../../logic/trace-evaluator';
import { StrokeHint } from '../../components/StrokeHint';
import { playJamo } from '../../platform/audio';
import { nudge, success } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
  /** F-008 — when true, pass requires coverage ≥ 0.65 AND correct stroke order. */
  strictMode?: boolean;
}

type Feedback = 'idle' | 'evaluating' | 'pass' | 'fail';

// The canvas is as large for kid fingers as the screen allows (logic/trace-layout).
const VIEWBOX = 200; // jamo skeletons authored against 200x200

/**
 * F-004 Trace Stroke — real gesture-driven implementation.
 *
 * Replaces the v1 3-tap placeholder. Child draws the jamo with their
 * finger; PanGestureHandler captures stroke points; on Done / 1.5s idle,
 * scoreTrace() compares against the predefined skeleton; coverage ≥ 0.65
 * passes the round. Done and the idle timer share one gate
 * (logic/trace-evaluator), so a drawing is scored once.
 */
export function TraceStrokeGame({
  scope,
  onFinish,
  strictMode = false,
}: Props): React.ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const rounds = useMemo<TraceStrokeRound[]>(
    () =>
      buildTraceStrokeRounds({
        scopeJamoIds: scope.jamoIds ?? [],
        rounds: scope.rounds ?? 4,
      }),
    [scope],
  );

  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [roundIdx, setRoundIdx] = useState(0);
  const [strokes, setStrokes] = useState<JamoStrokePoint[][]>([]);
  const [feedback, setFeedback] = useState<Feedback>('idle');
  // Done and the idle timer share one gate; its idle timer calls the latest
  // evaluate() so it sees the current strokes.
  const evaluateRef = useRef<() => void>(() => {});
  const gateRef = useRef<TraceEvaluator | null>(null);
  // Pass-advance / fail-reset timer, and a guard so the step finishes once.
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);
  // F-005/F-006 — score result envelope for the most recent evaluate()
  const [orderCorrect, setOrderCorrect] = useState<boolean | null>(null);
  const [directionNudge, setDirectionNudge] = useState<DirectionNudge>('none');
  // F-007 — increment to (re)play the animated demonstration
  const [hintToken, setHintToken] = useState(0);
  const [hintPlaying, setHintPlaying] = useState(false);
  // Measured: the screen's content box (picks the layout) and the canvas slot (sizes the canvas).
  const [box, setBox] = useState<Size | null>(null);
  const [slot, setSlot] = useState<Size | null>(null);
  // F-LAYOUT-001 §3.6: the canvas grows with the window class (320 x mediaScale, at most 448), and a
  // wide landscape window takes the full width so the controls go beside the canvas.
  const layoutClass = useLayoutClass();
  const canvasSize = slot ? traceCanvasSize(slot.width, slot.height, traceCanvasMax(layoutClass)) : 0;

  const round = rounds[roundIdx];
  const target = useMemo(
    () => (round ? (strokesForJamo(round.jamo.id) ?? []) : []),
    [round],
  );

  useEffect(() => {
    const gate = createTraceEvaluator({
      idleMs: TRACE_IDLE_MS,
      onEvaluate: () => evaluateRef.current(),
    });
    gateRef.current = gate;
    return () => {
      gate.dispose();
      gateRef.current = null;
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  useEffect(() => {
    gateRef.current?.nextRound();
    setStrokes([]);
    setFeedback('idle');
    setOrderCorrect(null);
    setDirectionNudge('none');
    setHintToken(0);
    setHintPlaying(false);
    if (round) void playJamo(round.jamo, 'sound');
  }, [roundIdx, round]);

  if (!round) {
    return (
      <Screen>
        <Body>{copy.noRounds}</Body>
      </Screen>
    );
  }

  const afterResult = (fn: () => void, ms: number): void => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => {
      resultTimerRef.current = null;
      fn();
    }, ms);
  };

  const finishStep = (): void => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    gateRef.current?.dispose();
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    markStepComplete();
    onFinish();
  };

  const evaluate = (): void => {
    if (strokes.length === 0) {
      // Nothing drawn (e.g. cleared just before the timer): not an answer.
      gateRef.current?.reopen();
      return;
    }
    setFeedback('evaluating');
    const result = scoreTrace({
      target,
      drawn: strokes,
      checkOrder: true,
      checkDirection: true,
    });
    setOrderCorrect(result.orderCorrect ?? null);
    setDirectionNudge(directionNudgeFor(result));
    // F-008 — strict mode requires coverage AND order; default keeps coverage-only.
    const passed = strictMode
      ? result.passWithOrder === true
      : result.coverage >= DEFAULT_PASS_THRESHOLD;
    if (passed) {
      success();
      answerRound(roundIdx, true);
      setFeedback('pass');
      afterResult(() => {
        if (roundIdx >= rounds.length - 1) {
          finishStep();
        } else {
          setRoundIdx(roundIdx + 1);
        }
      }, 1100);
    } else {
      nudge();
      answerRound(roundIdx, false);
      setFeedback('fail');
      // F-008 — strict-mode fail gets a longer retry window (2000ms vs 1800ms)
      const retryDelay = strictMode && result.coverage >= DEFAULT_PASS_THRESHOLD ? 2000 : 1800;
      afterResult(() => {
        setStrokes([]);
        setFeedback('idle');
        setOrderCorrect(null);
        setDirectionNudge('none');
        gateRef.current?.reopen();
      }, retryDelay);
    }
  };
  evaluateRef.current = evaluate;

  const beginStroke = (point: JamoStrokePoint): void => {
    setStrokes((prev) => [...prev, [point]]);
    gateRef.current?.strokeStarted();
  };

  const appendStrokePoint = (point: JamoStrokePoint): void => {
    setStrokes((prev) => {
      if (prev.length === 0) return [[point]];
      const next = [...prev];
      const last = next[next.length - 1]!;
      next[next.length - 1] = [...last, point];
      return next;
    });
  };

  const endStroke = (): void => {
    gateRef.current?.strokeEnded();
  };

  const toViewBoxPoint = (x: number, y: number): JamoStrokePoint => {
    const scale = VIEWBOX / canvasSize;
    return { x: x * scale, y: y * scale };
  };

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      const pt = toViewBoxPoint(e.x, e.y);
      runOnJS(beginStroke)(pt);
    })
    .onUpdate((e) => {
      const pt = toViewBoxPoint(e.x, e.y);
      runOnJS(appendStrokePoint)(pt);
    })
    .onEnd(() => {
      runOnJS(endStroke)();
    });

  const handleClear = (): void => {
    setStrokes([]);
    setFeedback('idle');
    gateRef.current?.clear();
  };

  const traceFillByFeedback: Record<Feedback, string> = {
    idle: colors.brand.primaryLight,
    evaluating: colors.brand.primaryLight,
    pass: colors.feedback.successLight,
    fail: colors.feedback.nudgeLight,
  };
  const traceBorderByFeedback: Record<Feedback, string> = {
    idle: colors.brand.primary,
    evaluating: colors.brand.primary,
    pass: colors.feedback.success,
    fail: colors.feedback.nudge,
  };

  const mode = box ? traceLayoutMode(box) : 'compact';
  const stacked = mode === 'roomy';

  const progressRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Progress value={roundIdx + 1} max={rounds.length} tone="primary" />
      </View>
      <Pill label={copy.progress.pill(roundIdx + 1, rounds.length)} size="sm" />
    </View>
  );

  const prompt = (
    <View style={{ gap: spacing.xs }}>
      <View accessible accessibilityRole="header" accessibilityLabel={traceTargetA11yText(round.jamo, m.a11y.minigame)}>
        <Heading level="prompt">{traceHeadingText(round.jamo, copy.trace)}</Heading>
      </View>
      {stacked ? <Caption tone="muted">{copy.trace.instruction}</Caption> : null}
    </View>
  );

  const canvas =
    canvasSize > 0 ? (
      <GestureDetector gesture={panGesture}>
        <View
          nativeID="trace-canvas"
          accessibilityLabel={traceCanvasA11yLabel(round.jamo.romanization, m.a11y.minigame.traceCanvas)}
          style={{
            width: canvasSize,
            height: canvasSize,
            borderRadius: radii.xxl,
            backgroundColor: traceFillByFeedback[feedback],
            borderWidth: borderWidth.thick,
            borderColor: traceBorderByFeedback[feedback],
            overflow: 'hidden',
          }}
        >
          <Svg width={canvasSize} height={canvasSize} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
            {target.map((stroke, i) => (
              <Path
                key={`tgt-${i}`}
                d={pointsToPathD(stroke)}
                stroke={colors.text.primary}
                strokeOpacity={0.12}
                strokeWidth={18}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
            {strokes.map((stroke, i) => (
              <Path
                key={`drawn-${i}`}
                d={pointsToPathD(stroke)}
                stroke={colors.text.primary}
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
          {hintPlaying ? (
            <StrokeHint
              target={target}
              size={canvasSize}
              viewBox={VIEWBOX}
              playToken={hintToken}
              onComplete={() => setHintPlaying(false)}
            />
          ) : null}
        </View>
      </GestureDetector>
    ) : null;

  // flex:1 sizes the slot from what the controls leave, so its own content never feeds back into it.
  const canvasSlot = (
    <View
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setSlot((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
      }}
      style={{ flex: 1, minHeight: 0, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      {canvas}
    </View>
  );

  const helpers = (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}>
      <Button
        label={copy.trace.showMe.cta}
        tone="secondary"
        size="sm"
        disabled={hintPlaying}
        onPress={() => {
          setHintToken((t) => t + 1);
          setHintPlaying(true);
          // F-009 §3.1 (revised) — narrate the SOUND of the jamo at demo start; muting is enforced inside the audio controller.
          void playJamo(round.jamo, 'sound');
        }}
      />
      <Button label={copy.trace.clear.cta} tone="ghost" size="sm" onPress={handleClear} disabled={strokes.length === 0} />
    </View>
  );

  const feedbackMessage =
    feedback === 'fail'
      ? failMessage(strictMode, orderCorrect, copy.trace)
      : feedback === 'pass'
        ? passMessage(orderCorrect, directionNudge, copy.trace)
        : copy.trace.idle;
  const feedbackTone: HoyaTone = feedback === 'fail' ? 'thinking' : feedback === 'pass' ? 'cheering' : 'idle';
  const feedbackLines = mode === 'side' ? 3 : 2;

  const doneButton = (
    <Button
      label={copy.trace.done.cta}
      tone="primary"
      size={stacked ? 'lg' : 'md'}
      fullWidth
      disabled={strokes.length === 0 || feedback !== 'idle'}
      onPress={() => {
        gateRef.current?.done();
      }}
    />
  );
  const skipButton = <Button label={copy.skip.cta} tone="ghost" size="md" fullWidth onPress={finishStep} />;
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
      <TraceFeedback tone={feedbackTone} message={feedbackMessage} lines={feedbackLines} showHoya={stacked} />
      {actions}
    </View>
  );

  return (
    // The canvas owns vertical drags, so this screen opts out of scrolling and instead
    // sizes the canvas from the height the controls leave (UX-09: Done and Skip stay on screen).
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
              {prompt}
              {controls}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, gap: spacing.md }}>
            {progressRow}
            {prompt}
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

type HoyaTone = 'idle' | 'cheering' | 'thinking';

const feedbackBg: Record<HoyaTone, string> = {
  idle: colors.surface.paper,
  cheering: colors.feedback.successLight,
  thinking: colors.feedback.nudgeLight, // anti-shame: amber, never red
};
const feedbackBorder: Record<HoyaTone, string> = {
  idle: colors.border.subtle,
  cheering: colors.feedback.success,
  thinking: colors.feedback.nudge,
};

/**
 * Hoya's feedback as a strip of fixed height (a set number of text lines), so
 * a longer pass / fail message never resizes the canvas under the child's
 * finger. HoyaBubble is ~110dp tall, too much for the short layouts.
 */
function TraceFeedback({
  tone,
  message,
  lines,
  showHoya,
}: {
  tone: HoyaTone;
  message: string;
  lines: number;
  showHoya: boolean;
}): React.ReactElement {
  const textScale = useTypeScale();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        // A line of the feedback text at the chosen text size, so a longer message is never clipped.
        // The planned lines keep the canvas steady as the message changes; a message that wraps to more lines (a large
        // text size in a narrow window, a wider font) grows the box instead of being cut (AMENDMENTS-DISPLAY-NAV section 4).
        minHeight: lines * Math.ceil(textScale.size.bodySm * typography.leading.normal) + 2 * spacing.sm + 2 * borderWidth.base,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.lg,
        borderWidth: borderWidth.base,
        borderColor: feedbackBorder[tone],
        backgroundColor: feedbackBg[tone],
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
