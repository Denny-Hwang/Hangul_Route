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
import { DEFAULT_PASS_THRESHOLD, scoreTrace } from '../../logic/stroke-scoring';
import { StrokeHint } from './StrokeHint';
import { speak } from '../../platform/audio';
import { nudge, success } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
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
 * passes the round.
 */
export function TraceStrokeGame({ scope, onFinish }: Props): React.ReactElement {
  const rounds = useMemo<TraceStrokeRound[]>(
    () =>
      buildTraceStrokeRounds({
        scopeJamoIds: scope.jamoIds ?? [],
        rounds: scope.rounds ?? 4,
      }),
    [scope],
  );

  const recordRound = useQuestRunStore((s) => s.recordRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [roundIdx, setRoundIdx] = useState(0);
  const [strokes, setStrokes] = useState<JamoStrokePoint[][]>([]);
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setStrokes([]);
    setFeedback('idle');
    setOrderCorrect(null);
    setDirectionsCorrect(null);
    setHintToken(0);
    setHintPlaying(false);
    if (round) speak(round.jamo.char, { language: 'ko-KR' });
  }, [roundIdx, round]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  if (!round) {
    return (
      <Screen>
        <Body>No rounds.</Body>
      </Screen>
    );
  }

  const evaluate = (): void => {
    setFeedback('evaluating');
    // F-005 + F-006 — request order + direction in the result envelope so we
    // can surface "next time try ..." hints on a pass, without gating progress.
    const result = scoreTrace({
      target,
      drawn: strokes,
      checkOrder: true,
      checkDirection: true,
    });
    setOrderCorrect(result.orderCorrect ?? null);
    setDirectionsCorrect(result.directionsCorrect ?? null);
    if (result.coverage >= DEFAULT_PASS_THRESHOLD) {
      success();
      recordRound(true);
      setFeedback('pass');
      setTimeout(() => {
        if (roundIdx >= rounds.length - 1) {
          markStepComplete();
          onFinish();
        } else {
          setRoundIdx(roundIdx + 1);
        }
      }, 1100);
    } else {
      nudge();
      recordRound(false);
      setFeedback('fail');
      setTimeout(() => {
        setStrokes([]);
        setFeedback('idle');
        setOrderCorrect(null);
        setDirectionsCorrect(null);
      }, 1800);
    }
  };

  const beginStroke = (point: JamoStrokePoint): void => {
    setStrokes((prev) => [...prev, [point]]);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
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
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (feedback === 'idle') {
        evaluate();
      }
    }, 1500);
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
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
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
        <HoyaBubble tone="thinking" message="Try again — start at the top!" />
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
        onPress={evaluate}
      />
      <Spacer size="sm" />
      <Button
        label="Skip"
        tone="ghost"
        size="md"
        fullWidth
        onPress={() => {
          markStepComplete();
          onFinish();
        }}
      />
    </Screen>
  );
}

/**
 * F-005 + F-006 success-side hint copy. Coverage is the pass criterion;
 * order + direction are auxiliary — surfaced as "next time" nudges only
 * when the child PASSED but did the auxiliary signal wrong.
 */
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

function pointsToPathD(points: JamoStrokePoint[]): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const pt = points[i]!;
    d += ` L ${pt.x} ${pt.y}`;
  }
  return d;
}
