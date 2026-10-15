import { Hoya, colors, motion, presenter, radii, shadows, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { HOYA_STAGE, RING_STAGE, units } from '../../../logic/lecture/stage-constants';
import { TIMER_PRESETS_MS, type TimerState } from '../../../logic/lecture/timer';
import { presetLabel, timerView } from '../../../logic/lecture/tools';
import { RING_CORNER, STAGE_GAP } from '../stage-metrics';
import { usePresenterView, useStageText } from '../presenter-context';
import { Cover, TimerRing, ToolButton } from './OverlayParts';

/**
 * The class timer (design/screens/presenter/overlays.md "Timer", README D12; spec section 3.5,
 * TD5): a teacher tool that paces the room and scores no one. Corner: a real-pixel card at the
 * bottom right of the stage box, over the slide, which still advances. Full: the ring at 420 units
 * with m:ss at `presenter.size.display` and the presets and controls beside it. At zero the ring is
 * complete, Hoya cheers and the line is "All done!", with one slow fade (none under reduced
 * motion); no alarm word, no red.
 */
export interface TimerControls {
  onPreset: (ms: number) => void;
  onAdd: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onMode: (mode: 'corner' | 'full') => void;
  onClose: () => void;
  onToggleNumbers: () => void;
}

export function TimerOverlay({ mode, timer, showNumbers, controls }: { mode: 'corner' | 'full'; timer: TimerState; showNumbers: boolean; controls: TimerControls }): React.ReactElement {
  const view = timerView(timer);
  return mode === 'corner' ? <CornerTimer view={view} timer={timer} showNumbers={showNumbers} controls={controls} /> : <FullTimer view={view} timer={timer} showNumbers={showNumbers} controls={controls} />;
}

type View_ = ReturnType<typeof timerView>;

/** One slow fade when the timer reaches zero (`motion.duration.slow`), from the dimmed level; none under reduced motion. */
function useDonePulse(done: boolean): Animated.Value {
  const { reducedMotion } = usePresenterView();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!done || reducedMotion) {
      pulse.setValue(1);
      return;
    }
    pulse.setValue(presenter.dimOpacity);
    Animated.timing(pulse, { toValue: 1, duration: motion.duration.slow, useNativeDriver: false }).start();
  }, [done, reducedMotion, pulse]);
  return pulse;
}

function RunButton({ view, timer, controls }: { view: View_; timer: TimerState; controls: TimerControls }): React.ReactElement | null {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.timer;
  // Nothing to run yet (choose a preset) or the run is over (+30 s starts another).
  if (view.done || timer.totalMs === 0) return null;
  return view.running ? (
    <ToolButton testID="presenter-timer-pause" label={m.pause.cta} onPress={controls.onPause} />
  ) : (
    <ToolButton testID="presenter-timer-resume" label={m.resume.cta} onPress={controls.onResume} />
  );
}

function CornerTimer({ view, timer, showNumbers, controls }: { view: View_; timer: TimerState; showNumbers: boolean; controls: TimerControls }): React.ReactElement {
  const { messages } = usePresenterView();
  const m = messages.learner.presenter.timer;
  const pulse = useDonePulse(view.done);
  return (
    <Animated.View
      testID="presenter-timer-corner"
      role="region"
      aria-label={m.title}
      style={{
        position: 'absolute',
        right: spacing.lg,
        bottom: spacing.lg,
        backgroundColor: colors.surface.paper,
        borderRadius: radii.xl,
        padding: spacing.lg,
        gap: spacing.md,
        alignItems: 'center',
        opacity: pulse,
        ...shadows.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <TimerRing
          size={RING_CORNER}
          fraction={view.fraction}
          text={view.text}
          numberSize={typography.size.display}
          showNumbers={showNumbers}
          label={messages.a11y.presenter.timerLeft(view.text)}
        />
        {view.done ? (
          <Text {...KOREAN_LINE_BREAK} testID="presenter-timer-done" role="status" style={{ fontSize: typography.size.title, fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {m.done}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
        <RunButton view={view} timer={timer} controls={controls} />
        <ToolButton testID="presenter-timer-add" label={m.add.cta} onPress={controls.onAdd} />
        <ToolButton testID="presenter-timer-big" label={m.big.cta} onPress={() => controls.onMode('full')} />
        <ToolButton testID="presenter-timer-close" label={messages.common.buttons.close} onPress={controls.onClose} />
      </View>
    </Animated.View>
  );
}

function FullTimer({ view, timer, showNumbers, controls }: { view: View_; timer: TimerState; showNumbers: boolean; controls: TimerControls }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const m = messages.learner.presenter.timer;
  const pulse = useDonePulse(view.done);
  const first = useRef<View>(null);
  const label = (ms: number): string => {
    const { unit: u, n } = presetLabel(ms);
    return u === 's' ? m.seconds(n) : m.minutes(n);
  };
  return (
    <Cover label={m.title} testID="presenter-timer-full" initialFocus={first}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: units(unit, STAGE_GAP), padding: units(unit, spacing.xxxl) }}>
        <Animated.View style={{ alignItems: 'center', gap: spacing.md, opacity: pulse }}>
          <TimerRing
            size={units(unit, RING_STAGE)}
            fraction={view.fraction}
            text={view.text}
            numberSize={size(presenter.size.display)}
            showNumbers={showNumbers}
            label={messages.a11y.presenter.timerLeft(view.text)}
          />
        </Animated.View>
        <View style={{ flexShrink: 1, gap: spacing.lg, alignItems: 'flex-start' }}>
          {view.done ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, spacing.xl) }}>
              <Hoya pose="cheering" size={units(unit, HOYA_STAGE / 2)} accessibilityLabel={messages.a11y.hoya('cheering')} />
              <Text {...KOREAN_LINE_BREAK} testID="presenter-timer-done" role="status" style={{ fontSize: size(presenter.size.title), fontWeight: typography.weight.bold, color: colors.text.primary }}>
                {m.done}
              </Text>
            </View>
          ) : (
            <Text {...KOREAN_LINE_BREAK} role="heading" style={{ fontSize: typography.size.title, fontWeight: typography.weight.bold, color: colors.text.primary }}>
              {m.title}
            </Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {TIMER_PRESETS_MS.map((ms, i) => (
              <ToolButton
                key={ms}
                ref={i === 0 ? first : undefined}
                testID={`presenter-timer-preset-${ms / 1000}`}
                label={label(ms)}
                selected={view.preset === ms && timer.status !== 'idle'}
                onPress={() => controls.onPreset(ms)}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <ToolButton testID="presenter-timer-add" label={m.add.cta} onPress={controls.onAdd} />
            <RunButton view={view} timer={timer} controls={controls} />
            <ToolButton testID="presenter-timer-reset" label={m.reset.cta} onPress={controls.onReset} disabled={timer.totalMs === 0} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <ToolButton testID="presenter-timer-small" label={m.small.cta} onPress={() => controls.onMode('corner')} />
            <ToolButton
              testID="presenter-timer-numbers"
              label={showNumbers ? m.hideNumbers.cta : m.showNumbers.cta}
              onPress={controls.onToggleNumbers}
            />
            <ToolButton testID="presenter-timer-close" label={messages.common.buttons.close} onPress={controls.onClose} />
          </View>
        </View>
      </View>
    </Cover>
  );
}
