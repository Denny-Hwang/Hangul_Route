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
  useLayoutClass,
  useMediaSize,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import {
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
import { answersColumnWidth, pictureTextArrangement, twoUpFits } from '../../logic/layout/game-layout';
import { shuffleOptions, validRounds } from '../../logic/listen-pick';
import type { MinigameScope } from '../../logic/minigame-config';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useReducedMotion } from '../../platform/motion';
import { GameColumns } from './GameColumns';
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
  /** A close control at the start of the header (the Hangul Check's "Stop the check"); omitted: none. */
  onClose?: { label: string; onPress: () => void };
}

/**
 * What a `ChoiceCard` adds around its art: horizontal padding, the thickest state border, and the
 * status mark with its gap (ChoiceCard.tsx).
 */
const CARD_CHROME = 2 * spacing.lg + 2 * borderWidth.thick + spacing.xl + spacing.md;

/** Focus target for assistive tech when a round advances (web; a no-op where the node has no `focus`). */
interface Focusable {
  focus?: () => void;
}

export function ListenPickGame({ scope, host, onBack, onClose }: Props): React.ReactElement {
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const rounds = useMemo(() => validRounds(scope).map((r, i) => shuffleOptions(r, seed + i)), [scope, seed]);

  const m = useMessages();
  const copy = m.learner.minigame;
  const romanizationMode = useRomanizationMode();
  const reducedMotion = useReducedMotion();
  // F-LAYOUT-001 §3.6, §3.12: the sound and the answers side by side on a landscape window; the speaker
  // and the pictures grow with the window.
  const layoutClass = useLayoutClass();
  const width = layoutClass.windowWidth;
  const speakerSize = useMediaSize(touchTarget.hero);
  const speakerIcon = useMediaSize(spacing.xxxl);
  const pictureSize = useMediaSize(touchTarget.hero);

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
        <Body>{copy.listenPick.empty}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }

  const header = headerView(host.mode, state, copy);
  const prompt = promptView(round, state, host.mode);
  const arrangement = pictureTextArrangement(layoutClass);
  // Beside the sound the answers get half the reading column (348 at 1180 x 820 and 844 x 390), so two cards
  // sit side by side only while each still holds its art (or a phone-size text card) next to the status mark;
  // stacked, the phone rule on the window width is unchanged.
  const art = round.options.some((o) => o.pictureRef !== undefined) ? pictureSize : touchTarget.hero;
  const columns =
    arrangement === 'side' &&
    !twoUpFits(answersColumnWidth(layoutClass, arrangement, spacing.xl), spacing.md, art + CARD_CHROME)
      ? 1
      : optionColumns(round, width);
  const showMissHoya = host.mode !== 'review' && state.status === 'asking' && state.wrongIds.length > 0;

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {onClose ? (
          <Pressable
            onPress={onClose.onPress}
            accessibilityRole="button"
            accessibilityLabel={onClose.label}
            testID="listen-pick-close"
            style={{ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="close" size={spacing.xl} color={colors.text.secondary} />
          </Pressable>
        ) : null}
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
      <GameColumns
        arrangement={arrangement}
        prompt={
          <>
            <Heading level="prompt">{copy.listenPick.heading}</Heading>
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
                  accessibilityLabel={m.a11y.minigame.hearAgain}
                  hitSlop={spacing.md}
                  style={{
                    width: speakerSize,
                    height: speakerSize,
                    borderRadius: radii.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.brand.secondaryLight,
                    borderColor: colors.brand.secondary,
                    borderWidth: borderWidth.base,
                  }}
                >
                  <Icon name="speaker" size={speakerIcon} color={colors.brand.secondaryDark} />
                </Pressable>
              </Animated.View>
              <View style={{ alignSelf: 'center' }}>
                <Button
                  label={copy.listenPick.hearAgain.cta}
                  tone="secondary"
                  size="md"
                  onPress={() => dispatch({ type: 'hear' })}
                  testID="listen-pick-hear-again"
                />
              </View>

              <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: spacing.sm }}>
                {prompt.content ? (
                  <>
                    {prompt.showText ? <Body tone="muted">{m.learner.audio.readHere}</Body> : null}
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
          </>
        }
        answers={
          <View testID="listen-pick-options" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {round.options.map((option) => {
              const view = optionView(round, option, state, { mode: host.mode, romanizationMode }, m.a11y.minigame);
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
                        <PictureArt pictureRef={view.pictureRef} gloss={view.gloss ?? ''} size={pictureSize} />
                      ) : undefined
                    }
                    accessibilityLabel={view.accessibilityLabel}
                    onPress={() => dispatch({ type: 'tap', optionId: option.id, answerId: round.answerId, at: Date.now() })}
                  />
                </View>
              );
            })}
          </View>
        }
        feedback={
          <View accessibilityLiveRegion="polite">
            {showMissHoya ? (
              <>
                <Spacer size="lg" />
                <HoyaBubble tone="thinking" message={copy.listenPick.missHoya} />
              </>
            ) : null}
          </View>
        }
      />
      <Spacer size="xl" />
    </Screen>
  );
}
