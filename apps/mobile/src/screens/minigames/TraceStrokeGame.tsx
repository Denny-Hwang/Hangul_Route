import {
  Body,
  Button,
  Caption,
  Heading,
  HoyaBubble,
  Pill,
  Progress,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { JamoStrokePoint } from '../../content/jamo-strokes';
import { strokesForJamo } from '../../content/jamo-strokes';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildTraceStrokeRounds, type TraceStrokeRound } from '../../logic/round-builder';
import { pointsToPathD } from '../../logic/stroke-diagram';
import { DEFAULT_PASS_THRESHOLD, scoreTrace } from '../../logic/stroke-scoring';
import { TRACE_IDLE_MS, createTraceEvaluator, type TraceEvaluator } from '../../logic/trace-evaluator';
import { StrokeHint } from './StrokeHint';
import { speak } from '../../platform/audio';
import { nudge, success } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';
import { useUiStore } from '../../store/ui-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
  /** F-008 — when true, pass requires coverage ≥ 0.65 AND correct stroke order. */
  strictMode?: boolean;
}

type Feedback = 'idle' | 'evaluating' | 'pass' | 'fail';

const TRACE_BOX_SIZE = 280; // dp — large for kid fingers
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
  const rounds = useMemo<TraceStrokeRound[]>(
    () =>
      buildTraceStrokeRounds({
        scopeJamoIds: scope.jamoIds ?? [],
        rounds: scope.rounds ?? 4,
      }),
    [scope],
  );

  const soundOn = useUiStore((s) => s.soundOn);

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
  const [directionsCorrect, setDirectionsCorrect] = useState<boolean | null>(null);
  // F-007 — increment to (re)play the animated demonstration
  const [hintToken, setHintToken] = useState(0);
  const [hintPlaying, setHintPlaying] = useState(false);

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
    setDirectionsCorrect(null);
    setHintToken(0);
    setHintPlaying(false);
    if (round) speak(round.jamo.char, { language: 'ko-KR' });
  }, [roundIdx, round]);

  if (!round) {
    return (
      <Screen>
        <Body>No rounds.</Body>
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
    setDirectionsCorrect(result.directionsCorrect ?? null);
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
        setDirectionsCorrect(null);
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
    const scale = VIEWBOX / TRACE_BOX_SIZE;
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

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={roundIdx + 1} max={rounds.length} tone="primary" />
        </View>
        <Pill label={`${roundIdx + 1} / ${rounds.length}`} size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">Trace the letter {round.jamo.romanization}</Heading>
      <Spacer size="xs" />
      <Caption tone="muted">Draw the letter with your finger.</Caption>

      <Spacer size="lg" />
      <View style={{ alignItems: 'center' }}>
        <GestureDetector gesture={panGesture}>
          <View
            nativeID="trace-canvas"
            accessibilityLabel={`Draw the letter ${round.jamo.romanization} with your finger`}
            style={{
              width: TRACE_BOX_SIZE,
              height: TRACE_BOX_SIZE,
              borderRadius: radii.xxl,
              backgroundColor: traceFillByFeedback[feedback],
              borderWidth: 3,
              borderColor: traceBorderByFeedback[feedback],
              overflow: 'hidden',
            }}
          >
            <Svg
              width={TRACE_BOX_SIZE}
              height={TRACE_BOX_SIZE}
              viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
            >
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
                size={TRACE_BOX_SIZE}
                viewBox={VIEWBOX}
                playToken={hintToken}
                onComplete={() => setHintPlaying(false)}
              />
            ) : null}
          </View>
        </GestureDetector>
      </View>

      <Spacer size="md" />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}>
        <Button
          label="Show me"
          tone="secondary"
          size="sm"
          disabled={hintPlaying}
          onPress={() => {
            setHintToken((t) => t + 1);
            setHintPlaying(true);
            // F-009 — narrate the jamo at demo start (skipped if sound is muted).
            if (soundOn) {
              speak(round.jamo.char, { language: 'ko-KR' });
            }
          }}
        />
        <Button
          label="Clear"
          tone="ghost"
          size="sm"
          onPress={handleClear}
          disabled={strokes.length === 0}
        />
      </View>

      <Spacer size="md" />
      {feedback === 'fail' ? (
        <HoyaBubble
          tone="thinking"
          message={failMessage(strictMode, orderCorrect)}
        />
      ) : feedback === 'pass' ? (
        <HoyaBubble
          tone="cheering"
          message={passMessage(orderCorrect, directionsCorrect)}
        />
      ) : (
        <HoyaBubble
          tone="idle"
          message="Slowly draw the letter. Lift your finger to finish."
        />
      )}

      <Spacer size="lg" />
      <Button
        label="Done"
        tone="primary"
        size="lg"
        fullWidth
        disabled={strokes.length === 0 || feedback !== 'idle'}
        onPress={() => {
          gateRef.current?.done();
        }}
      />
      <Spacer size="sm" />
      <Button
        label="Skip"
        tone="ghost"
        size="md"
        fullWidth
        onPress={finishStep}
      />
    </Screen>
  );
}

/**
 * F-005 + F-006 success-side hint copy. Coverage is the pass criterion;
 * order + direction are auxiliary — surfaced as "next time" nudges only
 * when the child PASSED but did the auxiliary signal wrong.
 */
/**
 * F-008 — fail message branches. When strict mode is on AND order was the
 * only thing wrong (coverage passed), use the order-coaching message.
 * Otherwise use the standard "try again — start at the top!".
 */
function failMessage(strictMode: boolean, orderCorrect: boolean | null): string {
  if (strictMode && orderCorrect === false) {
    return 'Almost! Try drawing the strokes in the right order. Tap Show me to see.';
  }
  return 'Try again — start at the top!';
}

function passMessage(
  orderCorrect: boolean | null,
  directionsCorrect: boolean | null,
): string {
  if (orderCorrect === false) {
    return 'You got it! Next time, try drawing the top line first.';
  }
  if (directionsCorrect === false) {
    return 'Nice! Try drawing left-to-right next time.';
  }
  return 'Beautiful! That looks like the letter.';
}
