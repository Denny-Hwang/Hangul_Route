import {
  Body,
  Button,
  Heading,
  HoyaBubble,
  Icon,
  Pill,
  Progress,
  Screen,
  Spacer,
  borderWidth,
  choiceCardStyle,
  colors,
  motion,
  radii,
  shadows,
  spacing,
  touchTarget,
  typography,
  useLayoutClass,
  useTypeScale,
  KOREAN_LANGUAGE,
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { koSpeech } from '../../logic/audio/ko-speech';
import { startCloze, stepCloze, type ClozeEffect, type ClozeEvent, type ClozeFlowState } from '../../logic/cloze-pick/flow';
import { clozeToListenPick, filledSentence, validClozeRounds } from '../../logic/cloze-pick/round';
import { clozeColumns, clozeView, type ClozeHoyaLine } from '../../logic/cloze-pick/view';
import { pictureTextArrangement } from '../../logic/layout/game-layout';
import { shuffleOptions } from '../../logic/listen-pick';
import { headerView, optionView } from '../../logic/listen-pick-flow';
import type { MinigameScope } from '../../logic/minigame-config';
import { hasClip, playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useReducedMotion } from '../../platform/motion';
import { ClozeRealia } from './ClozeRealia';
import { GameColumns } from './GameColumns';
import type { MinigameHost } from './host';

/**
 * Cloze Pick (F-CURR-002 section 7.1 F1, row CM-30): read a Korean sentence with one gap and pick the tile that fills
 * it. It is the Listen & Pick shell (layout A of design/wireframes/minigame/shell.md: the progress row, the prompt over
 * the option cards, Hoya's slot) with a text prompt card in place of the speaker. Design:
 * design/wireframes/minigame/cloze-pick.md, design/screens/minigame-variety/ (mock/cloze-pick.html, board C).
 *
 * - A reading round: nothing is said while the gap is open. The right tile drops into the gap (no slide with reduced
 *   motion), the completed sentence is said once and Hear it replays it; the next round follows the shell's pause.
 * - A tile that does not fit takes the amber nudge with its mark and stays locked; never red (D2). Tiles show Korean
 *   and romanization only (D3): a gloss would answer a word gap. The sentence keeps its meaning, the input it reads.
 * - The rules are `logic/cloze-pick/` (the flow, the prompt view, the tile columns); this file draws them. It is the
 *   `cloze-pick-chunk` (`./cloze-pick-chunk.tsx`), loaded by `./cloze-pick-entry.tsx` while `game.cloze-pick` is on.
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack?: () => void;
}

/** The surface id of Cloze Pick for the audio telemetry (`audio.fallback_shown`). */
export const CLOZE_PICK_AUDIO_SOURCE = 'cloze-pick';

/** Taught Korean is read in Korean by a screen reader (the RealiaSheet's props). */
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

/** Focus target for assistive tech when a round advances (web; a no-op where the node has no `focus`). */
interface Focusable {
  focus?: () => void;
}

export function ClozePickGame({ scope, host, onBack }: Props): ReactElement {
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  // Each round with its tiles as Listen & Pick options, shuffled per round: the option ids and states are the shared ones.
  const rounds = useMemo(() => validClozeRounds(scope).map((round, i) => ({ round, pick: shuffleOptions(clozeToListenPick(round), seed + i) })), [scope, seed]);
  const realia = scope.clozePick?.realia;

  const m = useMessages();
  const copy = m.learner.minigame;
  const a11y = m.a11y.minigame;
  const romanizationMode = useRomanizationMode();
  const reducedMotion = useReducedMotion();
  const layoutClass = useLayoutClass();
  const textScale = useTypeScale();

  const [state, setState] = useState<ClozeFlowState>(() => startCloze(rounds.length));
  const stateRef = useRef(state);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<Focusable | null>(null);
  const hostRef = useRef(host);
  hostRef.current = host;
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;
  const dispatchRef = useRef<(event: ClozeEvent) => void>(() => undefined);

  const current = rounds[state.roundIdx];
  const slot = usePromptSlot({ source: CLOZE_PICK_AUDIO_SOURCE, hasClip: hasClip(current?.round.sentence.audioRef), textOnScreen: true });
  const { play: slotPlay, reset: slotReset } = slot;
  const [helpOpen, setHelpOpen] = useState(false);

  const runEffect = useCallback(
    (effect: ClozeEffect): void => {
      const entry = roundsRef.current[stateRef.current.roundIdx];
      switch (effect.type) {
        case 'say':
          if (entry) void slotPlay(() => playPrompt(koSpeech(filledSentence(entry.round), 'sentence', CLOZE_PICK_AUDIO_SOURCE)));
          return;
        case 'answer': {
          const round = roundsRef.current[effect.roundKey]?.round;
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
        case 'schedule-advance':
          advanceTimer.current = setTimeout(() => dispatchRef.current({ type: 'advance' }), effect.ms);
          return;
        case 'complete':
          hostRef.current.complete();
          return;
      }
    },
    [slotPlay],
  );

  const dispatch = useCallback(
    (event: ClozeEvent): void => {
      const out = stepCloze(stateRef.current, event);
      stateRef.current = out.state;
      setState(out.state);
      out.effects.forEach(runEffect);
    },
    [runEffect],
  );
  dispatchRef.current = dispatch;

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      stop();
    },
    [],
  );

  // A new round is a new prompt slot; focus moves to its card from round 2 on.
  const roundIdx = state.roundIdx;
  useEffect(() => {
    slotReset();
    if (roundIdx > 0) cardRef.current?.focus?.();
  }, [roundIdx, slotReset]);

  // The tile's text drops into the gap; at once with reduced motion.
  const fill = useSharedValue(1);
  const found = state.status === 'resolved' || state.status === 'done';
  useEffect(() => {
    if (!found || reducedMotion) {
      fill.value = 1;
      return;
    }
    fill.value = 0;
    fill.value = withTiming(1, { duration: motion.duration.base });
  }, [found, reducedMotion, fill]);
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ translateY: (1 - fill.value) * spacing.md }] }));

  if (state.status === 'empty' || !current) {
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

  const { round, pick } = current;
  const header = headerView(host.mode, state, copy);
  const view = clozeView(round, state, { mode: host.mode, romanizationMode, a11y: a11y.clozePick });
  const columns = clozeColumns(round, layoutClass.windowWidth);
  const koSize = layoutClass.width === 'compact' ? textScale.size.prompt : textScale.size.title;
  const hoyaLine: Record<ClozeHoyaLine, string> = {
    miss: copy.clozePick.miss,
    missParticle: copy.sentenceBuilder.missParticle,
    missValue: copy.realia.missHoya,
    lookHere: copy.clozePick.lookHere,
  };
  const hear = (): void => dispatch({ type: 'hear' });

  const gap = (
    <Animated.View
      testID="cloze-pick-gap"
      style={[
        {
          minWidth: touchTarget.min,
          marginHorizontal: spacing.xxs,
          paddingHorizontal: spacing.xs,
          borderBottomWidth: borderWidth.thick,
          borderBottomColor: view.found ? colors.feedback.success : colors.brand.secondaryDark,
          backgroundColor: view.found ? colors.feedback.successLight : 'transparent',
          borderRadius: radii.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xxs,
        },
        view.found ? fillStyle : undefined,
      ]}
    >
      <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontSize: koSize, fontWeight: typography.weight.bold, color: colors.text.primary }}>
        {view.gapText ?? ' '}
      </Text>
      {view.found ? <Icon name="check" size={spacing.lg} color={colors.feedback.success} /> : null}
    </Animated.View>
  );

  const korean = (text: string): ReactElement | null =>
    text.trim() === '' ? null : (
      <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontSize: koSize, fontWeight: typography.weight.bold, color: colors.text.primary }}>
        {text}
      </Text>
    );

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
      <GameColumns
        arrangement={pictureTextArrangement(layoutClass)}
        resetKey={round.id}
        prompt={
          <View style={{ gap: spacing.md }}>
            <Heading level="prompt">{copy.clozePick.heading}</Heading>
            {round.gapKind === 'value' && realia ? <ClozeRealia realia={realia} testID="cloze-pick-realia" /> : null}
            <View
              ref={(node) => {
                cardRef.current = node as unknown as Focusable | null;
              }}
              accessible
              accessibilityLabel={view.label}
              testID="cloze-pick-sentence"
              style={{
                gap: spacing.xs,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderRadius: radii.lg,
                borderWidth: borderWidth.base,
                borderColor: colors.border.subtle,
                backgroundColor: colors.surface.paper,
                ...shadows.card,
              }}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                {korean(view.before)}
                {gap}
                {korean(view.after)}
              </View>
              {view.romanization !== '' ? (
                <Body size="sm" tone="secondary" testID="cloze-pick-romanization">
                  {view.romanization}
                </Body>
              ) : null}
              <Body size="sm" tone="secondary" testID="cloze-pick-meaning">
                {view.meaning}
              </Body>
            </View>
            {/* Outside the accessible card: VoiceOver and TalkBack read an accessible View as one element, so a control
                inside it could not be reached (Sentence Builder keeps its Hear it outside the grouped text too). */}
            {view.hearIt ? (
              <View style={{ alignItems: 'flex-start' }}>
                <Button
                  label={m.learner.audio.hearIt.cta}
                  tone="secondary"
                  size="md"
                  leading={<Icon name="speaker" size={spacing.xl} color={colors.text.onSecondary} />}
                  onPress={hear}
                  testID="cloze-pick-hear-it"
                />
              </View>
            ) : null}
            {view.found ? (
              <PromptPanel variant="status" view={slot.view} onAction={(action) => slot.act(action, hear)} onHelp={() => setHelpOpen(true)} testID="cloze-pick-sound" />
            ) : null}
            <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
          </View>
        }
        answers={
          <View style={{ gap: spacing.md }}>
            <Body tone="secondary" testID="cloze-pick-instruction">
              {copy.clozePick.instruction[view.instruction]}
            </Body>
            <View testID="cloze-pick-tiles" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {pick.options.map((option) => {
                const card = optionView(pick, option, state, { mode: host.mode, romanizationMode }, a11y);
                const look = choiceCardStyle(card.cardState);
                return (
                  <View key={option.id} style={{ flexGrow: 1, flexBasis: columns === 2 ? '45%' : '100%', minWidth: touchTarget.hero }}>
                    {/* The option card's looks (design/components/ChoiceCard) in the compact tile of the mock: centred
                        Korean over its romanization, 64 tall, a miss in amber with a thicker border and its mark. */}
                    <Pressable
                      testID={`cloze-pick-tile-${option.id}`}
                      onPress={look.interactive ? () => dispatch({ type: 'tap', optionId: option.id, answerId: pick.answerId, at: Date.now() }) : undefined}
                      accessibilityRole="button"
                      accessibilityLabel={card.accessibilityLabel}
                      accessibilityState={{ disabled: look.disabled, selected: look.selected }}
                      style={{
                        minHeight: touchTarget.min,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.xxl,
                        borderRadius: look.borderRadius,
                        borderWidth: card.cardState === 'wrong' ? borderWidth.thick : look.borderWidth,
                        borderColor: look.borderColor,
                        backgroundColor: look.backgroundColor,
                      }}
                    >
                      <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
                        {card.ko}
                      </Text>
                      {card.romanization !== '' ? (
                        <Body size="sm" tone="secondary">
                          {card.romanization}
                        </Body>
                      ) : null}
                      {look.mark ? (
                        <View style={{ position: 'absolute', right: spacing.md }}>
                          <Icon name={look.mark.icon} size={spacing.xl} color={look.mark.color} />
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        }
        feedback={
          <View accessibilityLiveRegion="polite">
            {view.hoya ? (
              <>
                <Spacer size="lg" />
                <HoyaBubble tone="thinking" message={hoyaLine[view.hoya]} />
              </>
            ) : null}
          </View>
        }
      />
      <Spacer size="xl" />
    </Screen>
  );
}
