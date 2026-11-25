import { a11yRomanization, isReadPickScope, isSpellingRound, spellingPickToListenPick } from '@hangul-route/content-schema';
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
  GuardedPressable,
  TapBoard,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { AskedRomanization } from '../../components/AskedRomanization';
import { CantHear } from '../../components/CantHear';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { soundCapMs } from '../../logic/audio/sound-pacing';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useSoundPacing } from '../../components/use-sound-pacing';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { afterMiss, afterRightAnswer, lookHereLine, type AnswerResult } from '../../logic/answer-feedback';
import { shouldAutoReplay } from '../../logic/audio/prompt-view';
import {
  LISTEN_PICK_AUDIO_SOURCE,
  askedTextIsRomanizationOnly,
  checkHoldsRomanization,
  headerView,
  listenPickSpeech,
  optionColumns,
  optionItem,
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
import { AnswerAnnouncer } from './answer-announcer';
import { GameColumns } from './GameColumns';
import type { DictationKit } from './dictation-entry';
import type { HostMode, MinigameHost } from './host';
import { PictureArt } from './PictureArt';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

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
 *
 * Answer feedback (F-A11Y-001 row AF-4b): each result is said once by the answer announcer (a right option by its
 * romanization and meaning, a miss by what was tapped; the miss that turns the look-here ring on carries the look-here
 * line), the miss bubble and the prompt line are not live regions, the advance waits the 1000 ms result floor with a
 * screen reader off, and with one on a right answer shows Next (OD-AF9 (b)), the last round included, and the clip it
 * would play starts after the line. A reader hears no replay after a miss; the learner taps Hear it.
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

/** The spelling round's option name (letter names), or none. */
type OptionItemLabel = ((text: { ko: string; romanization: string }) => string) | undefined;

/** The surfaces a Check's ask is counted under (`audio.fallback_shown` `asked`); a practice host has none and keeps `listen-pick`. */
const CHECK_ASK_SOURCE: Partial<Record<HostMode, string>> = { check: 'quest-check', review: 'hangul-check' };

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
  // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the next round, or the end of the step, waits for the sound that is playing.
  const pacing = useSoundPacing();
  const lastCap = useRef(soundCapMs(undefined));
  const speakerRef = useRef<Focusable | null>(null);
  // The same speaker as a view, for "Can't hear it?" to move screen-reader focus to it after Show the letters.
  const speakerNodeRef = useRef<View | null>(null);
  const hostRef = useRef(host);
  hostRef.current = host;
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;
  const dispatchRef = useRef<(event: FlowEvent) => void>(() => undefined);
  // F-A11Y-001 AF-4b: each result is said once, by the answer announcer; with a screen reader on a right answer shows Next.
  const a = useAnswerAnnouncement();
  const { clear, focusPrompt } = a;
  const nextButton = useRoundNext();
  const mounted = useRef(false);
  /** The round last moved on from: a second Next (or a late wait) for the same round does nothing; a clip is not started after it. */
  const movedFrom = useRef(-1);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
  const checkSource = CHECK_ASK_SOURCE[host.mode];
  const slot = usePromptSlot({
    source: spellingNow ? spelling.SPELLING_AUDIO_SOURCE : LISTEN_PICK_AUDIO_SOURCE,
    // The slot asks with the round's own spec, so a say clip of its text counts (AMENDMENTS-AUDIO-CLIPS AC-B7).
    hasClip: current !== undefined && hasClipFor(listenPickSpeech(current)),
    textOnScreen: spellingNow || textMode,
    // "Can't hear it?" (AMENDMENTS-AUDIO-CANT-HEAR CH-1b, CH-1e): on every host, the Checks included, never on a text
    // prompt round (no speaker). The spelling round's link is guidance only (the cue rule).
    cantHear: !textMode,
    guidanceOnly: spellingNow,
    // A Check stays sound-first (owner decision 2026-11-25): "Always show the letters" does not reach it, and its ask is
    // counted under its own surface id.
    soundFirst: checkSource !== undefined,
    ...(checkSource === undefined ? {} : { askSource: checkSource }),
  });
  const { play: slotPlay, reset: slotReset } = slot;
  const viewRef = useRef(slot.view);
  viewRef.current = slot.view;
  // The learner asked for this round's text (Show the letters): a right answer then reaches the memory store as hinted
  // (AMENDMENTS-AUDIO-CANT-HEAR CH-1f, section 3.13).
  const askedRef = useRef(slot.asked);
  askedRef.current = slot.asked;
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
        const speech = listenPickSpeech(round);
        lastCap.current = soundCapMs(speech.kind);
        void pacing.track(slotPlay(() => playPrompt(speech))).then((result) =>
          dispatchRef.current({ type: 'audio', round: roundIdx, result }),
        );
        return;
      }
      case 'answer': {
        const round = roundsRef.current[effect.roundKey];
        // The Hangul Check names the item a symbol round credits (`itemId`, M7); any other round credits its own id.
        // Hinted with a right answer only: a miss after the ask stays a plain miss, and the stars follow `correct`.
        hostRef.current.answer(
          effect.roundKey,
          effect.correct,
          round ? { itemId: roundItemId(round), ...(effect.correct && askedRef.current ? { hinted: true } : {}) } : undefined,
        );
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
        // The flow's delay is the least wait; the confirm's sound ends first (QS-4), within the cap for its kind.
        pacing.after(effect.ms, () => dispatchRef.current({ type: 'advance' }), lastCap.current);
        return;
      case 'complete':
        hostRef.current.complete();
        return;
    }
  }, [slotPlay, slotReset, pacing]);

  /** What a result needs from this render: read when the tap comes, so `dispatch` keeps one identity. */
  const latest = useRef({ a, next: nextButton, a11y: m.a11y, labelOf: undefined as OptionItemLabel });
  latest.current = {
    a,
    next: nextButton,
    a11y: m.a11y,
    labelOf: spellingNow ? (text) => spelling.spellingOptionLabel(text, m.a11y.romanizationOr) : undefined,
  };

  /** A tap that scored: the line is said once, and the effects that follow are the answer's own (§3.4). */
  const settle = useCallback(
    (before: ListenPickFlowState, after: ListenPickFlowState, tapped: string, effects: FlowEffect[]): void => {
      const round = roundsRef.current[before.roundIdx];
      const { a: say, next, a11y, labelOf } = latest.current;
      const option = round?.options.find((o) => o.id === tapped);
      const correct = effects.some((e) => e.type === 'answer' && e.correct);
      const play = effects.find((e) => e.type === 'play');
      const advanceNow = effects.find((e) => e.type === 'schedule-advance');
      const replay = effects.find((e) => e.type === 'schedule-replay');
      effects.filter((e) => e !== play && e !== advanceNow && e !== replay).forEach(runEffect);
      if (!round || !option) return;
      const asked = before.roundIdx;
      if (correct && advanceNow?.type === 'schedule-advance') {
        const item = optionItem(option, a11y, { gloss: true, labelOf });
        const speak = (): Promise<void> => say.announce({ kind: 'right', item });
        void afterRightAnswer({
          readerOn: say.readerOn,
          gameMinMs: advanceNow.ms,
          announce: say.readerOn ? () => next.afterFocus(speak) : speak,
          ...(play === undefined
            ? {}
            : {
                play: () => {
                  // A reader on may press Next before the line ends: the round has moved on, so its clip is not started.
                  if (movedFrom.current === asked || !mounted.current) return;
                  runEffect(play);
                },
              }),
          showNext: next.show,
          waitThenAdvance: (minMs) => runEffect({ type: 'schedule-advance', ms: minMs }),
        });
        return;
      }
      const item = optionItem(option, a11y, { gloss: false, labelOf });
      const answerOption = round.options.find((o) => o.id === round.answerId);
      // The miss that turns the ring on carries the look-here line; every other miss names a retry by the prompt's kind.
      const result: AnswerResult =
        after.hint && !before.hint && answerOption
          ? { kind: 'missHint', item, hint: lookHereLine(a11y, optionItem(answerOption, a11y, { gloss: false, labelOf })) }
          : textModeRef.current
            ? { kind: 'miss', item }
            : { kind: 'missListen', item };
      afterMiss({ readerOn: say.readerOn, announce: () => say.announce(result), ...(replay === undefined ? {} : { replay: () => runEffect(replay) }) });
    },
    [runEffect],
  );

  const dispatch = useCallback(
    (event: FlowEvent): void => {
      const before = stateRef.current;
      const out = stepFlow(before, event);
      stateRef.current = out.state;
      setState(out.state);
      if (event.type === 'tap' && out.effects.some((e) => e.type === 'answer')) settle(before, out.state, event.optionId, out.effects);
      else out.effects.forEach(runEffect);
    },
    [runEffect, settle],
  );
  dispatchRef.current = dispatch;

  useEffect(
    () => () => {
      if (replayTimer.current) clearTimeout(replayTimer.current);
      stop();
    },
    [],
  );

  // Round 1 never autoplays (the first sound needs a gesture). A new round empties the announcer; from round 2 on focus
  // goes to the round's header node with a screen reader on (§3.4), and otherwise follows the prompt button as before.
  const roundIdx = state.roundIdx;
  useEffect(() => {
    clear();
    if (roundIdx > 0) {
      if (latest.current.a.readerOn) focusPrompt();
      else speakerRef.current?.focus?.();
    }
  }, [roundIdx, clear, focusPrompt]);

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
  // A Check whose options hold or hide their romanization asks for the romanization only (CH-1e, section 3.12): the text
  // the learner asked for (or the Always switch brought up) is read as a sound, the Hangul is never printed above the options.
  const askedRomanizationOnly = askedTextIsRomanizationOnly(host.mode, romanizationMode, textMode);
  const prompt = promptView(
    round,
    spellingKit === null ? state : { ...state, textPrompt: false },
    host.mode,
    spellingKit === null ? slot.view.textShown || textMode : false,
    askedRomanizationOnly && slot.asked,
  );
  const content = prompt.content;
  const resolved = state.status === 'resolved' || state.status === 'done';
  const hear = (): void => dispatch({ type: 'hear' });
  /** Next (a reader on): the round moves on once; a second press, or one after the round has moved, does nothing. */
  const advanceNow = (): void => {
    if (movedFrom.current === roundIdx) return;
    movedFrom.current = roundIdx;
    nextButton.hide();
    dispatch({ type: 'advance' });
  };
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
  // The round's header node (§3.4): the heading, the scaffold line and, in the text prompt mode, the Korean it shows by
  // its romanization (never its Hangul); never a button.
  const headingText = textPrompt ? textPrompt.heading : spellingKit === null ? copy.listenPick.heading : copy.spellingPick.heading;
  const roundLabel = m.a11y.answer.round(
    roundIdx + 1,
    rounds.length,
    [headingText, hint, textMode && !spellingNow ? round.prompt.romanization : undefined].filter((part): part is string => part !== undefined && part !== '').join(' '),
  );
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
  const optionContext = {
    mode: host.mode,
    romanizationMode,
    // AU-8: a quest Check that plays its prompt shows no romanization on its options until the answer.
    holdRomanization: checkHoldsRomanization(host.mode, textMode),
    ...(spellingKit === null ? {} : { labelOf: (text: { ko: string; romanization: string }) => spellingKit.spellingOptionLabel(text, m.a11y.romanizationOr) }),
  };

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
            <View ref={a.promptRef} testID="listen-pick-round" accessible accessibilityRole="header" accessibilityLabel={roundLabel}>
              <Heading level="prompt">{headingText}</Heading>
              {hint ? (
                <Body tone="secondary" testID="listen-pick-hint">
                  {hint}
                </Body>
              ) : null}
            </View>
            <Spacer size="md" />

            {textContent ?? <View style={{ alignItems: 'center', gap: spacing.md }}>
              {spellingKit === null ? null : <spellingKit.SpellingCue round={round} />}
              <Animated.View style={roundIdx === 0 && !reducedMotion ? pulseStyle : undefined}>
                <GuardedPressable
                  setsLock={false}
                  ref={(node) => {
                    speakerRef.current = node as unknown as Focusable | null;
                    speakerNodeRef.current = node as unknown as View | null;
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
                </GuardedPressable>
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
              {slot.cantHear ? (
                // Centred under Hear again, as the speaker above it.
                <View style={{ alignSelf: 'center' }}>
                  {spellingKit !== null ? (
                    // The spelling round's picture and meaning settle it, so the sheet only helps with the sound (the cue rule).
                    <CantHear guidanceOnly round={roundIdx} active={slot.cantHearActive} onHear={hear} />
                  ) : (
                    <CantHear
                      round={roundIdx}
                      active={slot.cantHearActive}
                      onHear={hear}
                      onShowLetters={slot.showLetters}
                      focusAfter={speakerNodeRef}
                      lettersText={
                        askedRomanizationOnly
                          ? a11yRomanization(round.prompt.romanization, m.a11y.romanizationOr)
                          : m.a11y.koreanItem({ ko: round.prompt.ko, romanization: round.prompt.romanization })
                      }
                    />
                  )}
                </View>
              ) : null}

              {/* Not live: the answer's word is said once by the announcer (§3.3). */}
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                {content === undefined ? null : content.ko === undefined ? (
                  <AskedRomanization romanization={content.romanization} testID="listen-pick-prompt-text" />
                ) : (
                  <KoreanText ko={content.ko} romanization={content.romanization} gloss={content.gloss} size="md" testID="listen-pick-prompt-text" />
                )}
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
          // Held while the voice check may still bring the sound's text panel in above the cards; the text prompt mode
          // draws its prompt as text from the start (its status panel shows only once the round is answered).
          <>
          <TapBoard lock="board" held={!textMode && !slot.settled}>
            {/* One board for the answers (AMENDMENTS-TOUCH section 6, row KT-3): a graze still counts, a bounce never counts twice. */}
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
                      // A held line (AU-8) keeps its room, so the cards do not move when the answer shows it.
                      romanization={view.heldRomanization === '' ? view.romanization : view.heldRomanization}
                      romanizationReserved={view.heldRomanization !== ''}
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
          </TapBoard>
          {nextButton.shown ? (
            <>
              <Spacer size="lg" />
              <Button
                pressableRef={nextButton.nextRef}
                label={copy.trace.next.cta}
                tone="primary"
                size="hero"
                fullWidth
                onPress={advanceNow}
                testID="listen-pick-next"
              />
            </>
          ) : null}
          </>
        }
        feedback={
          <View>
            {showMissHoya ? (
              <>
                <Spacer size="lg" />
                {/* The announcer says the result once, so this result bubble is not a live region too (§3.3). */}
                <HoyaBubble tone="thinking" live={false} message={textPrompt ? textPrompt.missLine : spellingKit === null ? copy.listenPick.missHoya : copy.spellingPick.miss} />
              </>
            ) : null}
          </View>
        }
      />
      <AnswerAnnouncer line={a.line} />
      <Spacer size="xl" />
    </Screen>
  );
}
