import { isReadPickScope, isSpellingRound, spellingPickToListenPick } from '@hangul-route/content-schema';
import { romanizationShown } from '@hangul-route/i18n';
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
  layout,
  useLayoutClass,
  useMediaSize,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { shouldAutoReplay } from '../../logic/audio/prompt-view';
import {
  LISTEN_PICK_AUDIO_SOURCE,
  headerView,
  listenPickSpeech,
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
import { roundItemId, shuffleOptions, validRounds } from '../../logic/listen-pick';
import type { ListenPickRound } from '@hangul-route/content-schema';
import type { MinigameScope } from '../../logic/minigame-config';
import { hasClipFor, playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useReducedMotion } from '../../platform/motion';
import { GameColumns } from './GameColumns';
import type { DictationKit } from './dictation-entry';
import type { MinigameHost } from './host';
import { PictureArt } from './PictureArt';

/**
 * Listen & Pick (F-QUEST-002 §3.10, catalog 3): hear a Korean sound or word,
 * pick how it is written or what it shows. The behaviour lives in
 * `logic/listen-pick-flow.ts` (reducer, effects, view-models); this file only
 * renders it and runs the effects. One component serves the two-question
 * Check, a practice step and, later, the Hangul Check, through `host`.
 * The sound goes through the shared prompt slot (F-AUDIO-004 §3.8): sound off,
 * no Korean voice, a blocked or failed play show the prompt as text with why
 * and the one action (Turn sound on, Tap to hear, Try again).
 * Design: design/wireframes/minigame/listen-pick.md,
 * design/wireframes/minigame/audio-fallback.md (W1-W4).
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack?: () => void;
  /** The scaffold round (F-CURR-002 section 4.6, row CM-24): the right card is ringed from the start, under this line. */
  hint?: string;
  /** Text prompt mode (row CM-30); absent, the game is unchanged. */
  textPrompt?: ListenPickTextPrompt;
  /**
   * The dictation chunk, when the scope has spelling rounds with `game.spelling-pick` on (F-CURR-002 section 4.5, row
   * CM-31): their picture and meaning, and option labels spelled by letter name. Without it a spelling round plays as
   * its Listen & Pick fallback.
   */
  spelling?: DictationKit | null;
}

/**
 * Listen & Pick's text prompt mode (F-CURR-002 row CM-30, design/wireframes/minigame/cloze-pick.md "Fallback round"):
 * the round Cloze Pick renders when `game.cloze-pick` is off (and Match Shape's Read Pick later). No speaker and no
 * sound before the answer: `prompt` draws the round's prompt as text under `heading`, and the voice says the prompt's
 * `spokenKo` once after the right answer (the status panel says why when it cannot). Same options, answer and scoring.
 */
export interface ListenPickTextPrompt {
  /** Replaces "Listen, then pick". */
  heading: string;
  /** Hoya after a miss, in place of "Listen again". */
  missLine: string;
  /** The prompt as text; it receives focus from round 2 on. */
  prompt: (round: ListenPickRound, focusRef: (node: unknown) => void) => ReactNode;
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

/** A spelling round's options this short (in glyphs) sit two up at any width (row CM-31). */
const SPELLING_SIDE_BY_SIDE_GLYPHS = 4;

export function ListenPickGame({ scope, host, onBack, hint, textPrompt: textPromptProp, spelling = null }: Props): ReactElement {
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const rounds = useMemo(
    () => validRounds(scope).map((r, i) => shuffleOptions(spelling === null ? spellingPickToListenPick(r) : r, seed + i)),
    [scope, seed, spelling],
  );

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

  const [state, setState] = useState<ListenPickFlowState>(() => ({ ...startFlow(rounds.length), hint: hint !== undefined }));
  const stateRef = useRef(state);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakerRef = useRef<Focusable | null>(null);
  const hostRef = useRef(host);
  hostRef.current = host;
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;
  const dispatchRef = useRef<(event: FlowEvent) => void>(() => undefined);

  // The round's sound, or the same prompt as text (F-AUDIO-004 §3.8); a new round is a new slot. The spelling round
  // prints its meaning, never its Korean (the answer), so it shows only the status panel (W11); the text prompt mode
  // (row CM-30) draws its prompt as text.
  // Read Pick Meaning (F-CURR-002 section 7.1, the default Stage 2 Check; row CM-3A S2): a scope whose rounds show their
  // Korean prompt (`promptShown`) plays in the text prompt mode, the Korean read in the learner's romanization mode, under
  // the shipped "What does this mean?" heading and the picture miss line; the word is said once after the right pick.
  const textPrompt: ListenPickTextPrompt | undefined =
    textPromptProp ??
    (isReadPickScope(rounds)
      ? {
          heading: copy.cultureQuiz.heading,
          missLine: copy.picWord.missHoya,
          prompt: (r, focusRef) => (
            <View ref={focusRef} style={{ alignItems: 'center' }} testID="listen-pick-text-prompt">
              <KoreanText
                ko={r.prompt.ko}
                romanization={r.prompt.romanization}
                romanizationShown={romanizationShown(romanizationMode, false)}
                size="md"
                testID="listen-pick-prompt-text"
              />
            </View>
          ),
        }
      : undefined);
  const textMode = textPrompt !== undefined;
  const textModeRef = useRef(textMode);
  textModeRef.current = textMode;
  const current = rounds[state.roundIdx];
  const spellingNow = !textMode && spelling !== null && current !== undefined && isSpellingRound(current);
  const slot = usePromptSlot({
    source: spellingNow ? spelling.SPELLING_AUDIO_SOURCE : LISTEN_PICK_AUDIO_SOURCE,
    // The slot asks with the round's own spec, so a say clip of its text counts (AMENDMENTS-AUDIO-CLIPS AC-B7).
    hasClip: current !== undefined && hasClipFor(listenPickSpeech(current)),
    textOnScreen: spellingNow || textMode,
  });
  const { play: slotPlay, reset: slotReset } = slot;
  const viewRef = useRef(slot.view);
  viewRef.current = slot.view;
  const [helpOpen, setHelpOpen] = useState(false);

  const runEffect = useCallback((effect: FlowEffect): void => {
    switch (effect.type) {
      case 'play': {
        const current = stateRef.current;
        const round = roundsRef.current[current.roundIdx];
        if (!round) return;
        // Text prompt mode: nothing is said before the answer (it would answer the round), only the completed prompt
        // after it: the confirm, and a tap on the status panel once the round is answered (sound turned on, a blocked
        // play tapped again).
        const answered = current.status === 'resolved' || current.status === 'done';
        if (textModeRef.current && effect.why !== 'confirm' && !(effect.why === 'manual' && answered)) return;
        // The 800 ms replay after a wrong tap waits while the text stands in for a sound that is off or absent.
        if (effect.why === 'replay' && !shouldAutoReplay(viewRef.current)) return;
        // The autoplay opens a new round: a new prompt slot, so last round's text does not carry over.
        if (effect.why === 'autoplay') slotReset();
        const roundIdx = current.roundIdx;
        void slotPlay(() => playPrompt(listenPickSpeech(round))).then((result) =>
          dispatchRef.current({ type: 'audio', round: roundIdx, result }),
        );
        return;
      }
      case 'answer': {
        const round = roundsRef.current[effect.roundKey];
        // The Hangul Check names the item a symbol round credits (`itemId`, M7); any other round credits its own id.
        hostRef.current.answer(effect.roundKey, effect.correct, round ? { itemId: roundItemId(round) } : undefined);
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
  }, [slotPlay, slotReset]);

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
  const spellingKit = spellingNow ? spelling : null;
  // The spelling round's Korean is its answer: a sound that cannot play (no voice, sound off) shows only the status
  // panel, never the prompt text, until the round resolves.
  const prompt = promptView(
    round,
    spellingKit === null ? state : { ...state, textPrompt: false },
    host.mode,
    spellingKit === null ? slot.view.textShown || textMode : false,
  );
  const resolved = state.status === 'resolved' || state.status === 'done';
  const hear = (): void => dispatch({ type: 'hear' });
  // The speaker says the state when the sound is off or needs a tap (F-AUDIO-004 W4).
  const speakerLabel = slot.view.reason === 'muted' || slot.view.reason === 'blocked' ? slot.view.speakerLabel : m.a11y.minigame.hearAgain;
  const arrangement = pictureTextArrangement(layoutClass);
  // Beside the sound the answers get half the reading column (348 at 1180 x 820 and 844 x 390), so two cards
  // sit side by side only while each still holds its art (or a phone-size text card) next to the status mark;
  // stacked, the phone rule on the window width is unchanged.
  const art = round.options.some((o) => o.pictureRef !== undefined) ? pictureSize : touchTarget.hero;
  const columns =
    arrangement === 'side' &&
    !twoUpFits(answersColumnWidth(layoutClass, arrangement, spacing.xl), spacing.md, art + CARD_CHROME)
      ? 1
      : spellingKit !== null && round.options.every((o) => [...(o.text?.ko ?? '')].length <= SPELLING_SIDE_BY_SIDE_GLYPHS)
        ? // The spelling round's options are short spellings to compare: side by side even on a 320 phone, so both
          // are on the first screen (row CM-31).
          2
        : optionColumns(round, width);
  // Below 640 tall the spelling round's speaker is its one sound control (it replays on every tap), as the design's
  // single [ (speaker) Hear it ] reads, so the meaning, the speaker and both spellings fit the first screen.
  const hearAgainShown = spellingKit === null || !(layoutClass.windowHeight > 0 && layoutClass.windowHeight < layout.compactHeight);
  const showMissHoya = host.mode !== 'review' && state.status === 'asking' && state.wrongIds.length > 0;
  const textContent = textPrompt ? (
    <View style={{ gap: spacing.md }}>
      {textPrompt.prompt(round, (node) => {
        speakerRef.current = node as Focusable | null;
      })}
      {resolved ? (
        <PromptPanel variant="status" view={slot.view} onAction={(action) => slot.act(action, hear)} onHelp={() => setHelpOpen(true)} testID="listen-pick-prompt" />
      ) : null}
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </View>
  ) : null;
  const optionContext = { mode: host.mode, romanizationMode, ...(spellingKit === null ? {} : { labelOf: spellingKit.spellingOptionLabel }) };

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
        arrangement={arrangement}
        prompt={
          <>
            <Heading level="prompt">{textPrompt ? textPrompt.heading : spellingKit === null ? copy.listenPick.heading : copy.spellingPick.heading}</Heading>
            {hint ? (
              <Body tone="secondary" testID="listen-pick-hint">
                {hint}
              </Body>
            ) : null}
            <Spacer size="md" />

            {textContent ?? <View style={{ alignItems: 'center', gap: spacing.md }}>
              {spellingKit === null ? null : <spellingKit.SpellingCue round={round} />}
              <Animated.View style={roundIdx === 0 && !reducedMotion ? pulseStyle : undefined}>
                <Pressable
                  ref={(node) => {
                    speakerRef.current = node as unknown as Focusable | null;
                  }}
                  testID="listen-pick-speaker"
                  onPress={hear}
                  accessibilityRole="button"
                  accessibilityLabel={speakerLabel}
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
              {hearAgainShown ? (
                <View style={{ alignSelf: 'center' }}>
                  <Button
                    label={copy.listenPick.hearAgain.cta}
                    tone="secondary"
                    size="md"
                    onPress={hear}
                    testID="listen-pick-hear-again"
                  />
                </View>
              ) : null}

              <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: spacing.sm }}>
                {prompt.content ? (
                  <KoreanText
                    ko={prompt.content.ko}
                    romanization={prompt.content.romanization}
                    gloss={prompt.content.gloss}
                    size="md"
                    testID="listen-pick-prompt-text"
                  />
                ) : null}
              </View>
              {/* The Korean is drawn just above, so the panel carries the read line, why and the one action. */}
              <View style={{ alignSelf: 'stretch' }}>
                {spellingKit === null ? (
                  <PromptPanel
                    view={slot.view}
                    onAction={(action) => slot.act(action, hear)}
                    onHelp={() => setHelpOpen(true)}
                    testID="listen-pick-prompt"
                  />
                ) : (
                  <PromptPanel
                    view={slot.view}
                    variant="status"
                    onAction={(action) => slot.act(action, hear)}
                    onHelp={() => setHelpOpen(true)}
                    testID="listen-pick-prompt"
                  />
                )}
              </View>
              <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
            </View>}
          </>
        }
        answers={
          <View testID="listen-pick-options" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {round.options.map((option) => {
              const view = optionView(round, option, state, optionContext, m.a11y.minigame);
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
                <HoyaBubble tone="thinking" message={textPrompt ? textPrompt.missLine : spellingKit === null ? copy.listenPick.missHoya : copy.spellingPick.miss} />
              </>
            ) : null}
          </View>
        }
      />
      <Spacer size="xl" />
    </Screen>
  );
}
