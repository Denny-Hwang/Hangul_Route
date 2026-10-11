import {
  Body,
  Button,
  ChoiceCard,
  Heading,
  HoyaBubble,
  Icon,
  KoreanText,
  Pill,
  Progress,
  Screen,
  Spacer,
  borderWidth,
  colors,
  motion,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import {
  LISTEN_PICK_COPY,
  headerView,
  optionColumns,
  optionView,
  promptView,
  startFlow,
  stepFlow,
  type FlowEffect,
  type FlowEvent,
  type ListenPickFlowState,
} from '../../logic/listen-pick-flow';
import { shuffleOptions, validRounds } from '../../logic/listen-pick';
import type { MinigameScope } from '../../logic/minigame-config';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useReducedMotion } from '../../platform/motion';
import { useLocaleStore } from '../../store/locale-store';
import { useProfileStore } from '../../store/profile-store';
import type { MinigameHost } from './host';
import { PictureArt } from './PictureArt';

/**
 * Listen & Pick (F-QUEST-002 §3.10, catalog 3): hear a Korean sound or word,
 * pick how it is written or what it shows. The behaviour lives in
 * `logic/listen-pick-flow.ts` (reducer, effects, view-models); this file only
 * renders it and runs the effects. One component serves the two-question
 * Check, a practice step and, later, the Hangul Check, through `host`.
 * Design: design/wireframes/minigame/listen-pick.md.
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack?: () => void;
}

/** Focus target for assistive tech when a round advances (web; a no-op where the node has no `focus`). */
interface Focusable {
  focus?: () => void;
}

export function ListenPickGame({ scope, host, onBack }: Props): React.ReactElement {
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const rounds = useMemo(() => validRounds(scope).map((r, i) => shuffleOptions(r, seed + i)), [scope, seed]);

  const activeProfileId = useProfileStore((s) => s.activeId);
  const romanizationMode = useLocaleStore((s) =>
    activeProfileId === null ? 'always' : (s.byProfile[activeProfileId]?.romanizationMode ?? 'always'),
  );
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();

  const [state, setState] = useState<ListenPickFlowState>(() => startFlow(rounds.length));
  const stateRef = useRef(state);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakerRef = useRef<Focusable | null>(null);
  const hostRef = useRef(host);
  hostRef.current = host;
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;
  const dispatchRef = useRef<(event: FlowEvent) => void>(() => undefined);

  const runEffect = useCallback((effect: FlowEffect): void => {
    switch (effect.type) {
      case 'play': {
        const current = stateRef.current;
        const round = roundsRef.current[current.roundIdx];
        if (!round) return;
        const roundIdx = current.roundIdx;
        void playPrompt({ text: round.prompt.spokenKo ?? round.prompt.ko, audioRef: round.prompt.audioRef }).then(
          (result) => dispatchRef.current({ type: 'audio', round: roundIdx, result }),
        );
        return;
      }
      case 'answer': {
        const round = roundsRef.current[effect.roundKey];
        hostRef.current.answer(effect.roundKey, effect.correct, round ? { itemId: round.id } : undefined);
        return;
      }
      case 'haptic':
        if (effect.kind === 'success') {
          tapLight();
          success();
        } else {
          nudge();
        }
        return;
      case 'cancel-replay':
        if (replayTimer.current) clearTimeout(replayTimer.current);
        replayTimer.current = null;
        return;
      case 'schedule-replay':
        replayTimer.current = setTimeout(() => dispatchRef.current({ type: 'replay-due' }), effect.ms);
        return;
      case 'schedule-advance':
        advanceTimer.current = setTimeout(() => dispatchRef.current({ type: 'advance' }), effect.ms);
        return;
      case 'complete':
        hostRef.current.complete();
        return;
    }
  }, []);

  const dispatch = useCallback(
    (event: FlowEvent): void => {
      const out = stepFlow(stateRef.current, event);
      stateRef.current = out.state;
      setState(out.state);
      out.effects.forEach(runEffect);
    },
    [runEffect],
  );
  dispatchRef.current = dispatch;

  useEffect(
    () => () => {
      if (replayTimer.current) clearTimeout(replayTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      stop();
    },
    [],
  );

  // Round 1 never autoplays (the first sound needs a gesture); focus follows the prompt button from round 2.
  const roundIdx = state.roundIdx;
  useEffect(() => {
    if (roundIdx > 0) speakerRef.current?.focus?.();
  }, [roundIdx]);

  // The speaker pulses once while round 1 waits for a tap; static under reduced motion.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withSequence(
      withTiming(1.12, { duration: motion.duration.slow }),
      withTiming(1, { duration: motion.duration.slow }),
    );
  }, [reducedMotion, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const round = rounds[roundIdx];
  if (state.status === 'empty' || !round) {
    return (
      <Screen>
        <Body>{LISTEN_PICK_COPY.empty}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={LISTEN_PICK_COPY.back} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }

  const header = headerView(host.mode, state);
  const prompt = promptView(round, state, host.mode);
  const columns = optionColumns(round, width);
  const showMissHoya = host.mode !== 'review' && state.status === 'asking' && state.wrongIds.length > 0;

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          {header.kind === 'dots' ? (
            <Progress variant="dots" value={header.value} max={header.max} tone="primary" />
          ) : (
            <Progress value={header.value} max={header.max} tone="primary" />
          )}
        </View>
        {header.title ? <Pill label={header.title} tone="primary" size="sm" /> : null}
        {header.label ? <Pill label={header.label} tone="neutral" size="sm" /> : null}
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">{LISTEN_PICK_COPY.heading}</Heading>
      <Spacer size="md" />

      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Animated.View style={roundIdx === 0 && !reducedMotion ? pulseStyle : undefined}>
          <Pressable
            ref={(node) => {
              speakerRef.current = node as unknown as Focusable | null;
            }}
            testID="listen-pick-speaker"
            onPress={() => dispatch({ type: 'hear' })}
            accessibilityRole="button"
            accessibilityLabel={LISTEN_PICK_COPY.hearAgainA11y}
            hitSlop={spacing.md}
            style={{
              width: touchTarget.hero,
              height: touchTarget.hero,
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand.secondaryLight,
              borderColor: colors.brand.secondary,
              borderWidth: borderWidth.base,
            }}
          >
            <Icon name="speaker" size={spacing.xxxl} color={colors.brand.secondaryDark} />
          </Pressable>
        </Animated.View>
        <View style={{ alignSelf: 'center' }}>
          <Button
            label={LISTEN_PICK_COPY.hearAgain}
            tone="secondary"
            size="md"
            onPress={() => dispatch({ type: 'hear' })}
            testID="listen-pick-hear-again"
          />
        </View>

        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: spacing.sm }}>
          {prompt.content ? (
            <>
              {prompt.showText ? <Body tone="muted">{LISTEN_PICK_COPY.noSound}</Body> : null}
              <KoreanText
                ko={prompt.content.ko}
                romanization={prompt.content.romanization}
                gloss={prompt.content.gloss}
                size="md"
                testID="listen-pick-prompt-text"
              />
            </>
          ) : null}
        </View>
      </View>

      <Spacer size="xl" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {round.options.map((option) => {
          const view = optionView(round, option, state, { mode: host.mode, romanizationMode });
          return (
            <View
              key={option.id}
              style={{ flexGrow: 1, flexBasis: columns === 2 ? '45%' : '100%', minWidth: touchTarget.hero }}
            >
              <ChoiceCard
                testID={`listen-pick-option-${option.id}`}
                state={view.cardState}
                ko={view.ko}
                romanization={view.romanization}
                label={view.label}
                art={
                  view.pictureRef !== undefined ? (
                    <PictureArt pictureRef={view.pictureRef} gloss={view.gloss ?? ''} size={touchTarget.hero} />
                  ) : undefined
                }
                accessibilityLabel={view.accessibilityLabel}
                onPress={() => dispatch({ type: 'tap', optionId: option.id, answerId: round.answerId, at: Date.now() })}
              />
            </View>
          );
        })}
      </View>

      <View accessibilityLiveRegion="polite">
        {showMissHoya ? (
          <>
            <Spacer size="lg" />
            <HoyaBubble tone="thinking" message={LISTEN_PICK_COPY.missHoya} />
          </>
        ) : null}
      </View>
      <Spacer size="xl" />
    </Screen>
  );
}
