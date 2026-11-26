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
  choiceCardRingStyle,
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
  TapTarget,
  pressInset,
  pressTransform,
  usePressLook,
  TapBoard,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { SENTENCE_SOUND_MAX_MS } from '../../logic/audio/sound-pacing';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useSoundPacing } from '../../components/use-sound-pacing';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import type { ClozePickRound } from '@hangul-route/content-schema';
import { afterMiss, afterRightAnswer, lookHereLine } from '../../logic/answer-feedback';
import { koSpeech } from '../../logic/audio/ko-speech';
import { holdsRomanization, hostSurface } from '../../logic/locale/check-hold';
import { startCloze, stepCloze, type ClozeEffect, type ClozeEvent, type ClozeFlowState } from '../../logic/cloze-pick/flow';
import { clozeToListenPick, filledSentence, validClozeRounds } from '../../logic/cloze-pick/round';
import { clozeColumns, clozeView, type ClozeHoyaLine } from '../../logic/cloze-pick/view';
import { pictureTextArrangement } from '../../logic/layout/game-layout';
import { shuffleOptions } from '../../logic/listen-pick';
import { headerView, optionItem, optionView } from '../../logic/listen-pick-flow';
import type { MinigameScope } from '../../logic/minigame-config';
import { hasClipFor, playPrompt, stop, type PlaySpec } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useReducedMotion } from '../../platform/motion';
import { AnswerAnnouncer } from './answer-announcer';
import { ClozeRealia } from './ClozeRealia';
import { GameColumns } from './GameColumns';
import { HeldText } from './held-line';
import type { MinigameHost } from './host';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

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
 * - Answer feedback (F-A11Y-001 row AF-4b): a right tile shows `check` and a locked miss `replay`, each in a mark column
 *   that is kept in every state (a mark inside the word's own room covered it at 320 wide with 200 % text), named with
 *   its state first and never `disabled`. Each result is said once by the answer announcer (the miss that rings the
 *   fitting tile carries the look-here line), Hoya's line is not live, the advance waits the 1000 ms result floor with a
 *   screen reader off, and with one on a right tile shows Next (OD-AF9 (b)), the last round included, and the sentence
 *   is said after the line.
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

/** What a round says once answered: the filled sentence (its say clip is bundled; the gapped one has no recording). */
function clozeSpeech(round: ClozePickRound): PlaySpec {
  return koSpeech(filledSentence(round), 'sentence', CLOZE_PICK_AUDIO_SOURCE);
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
  const press = usePressLook();

  const [state, setState] = useState<ClozeFlowState>(() => startCloze(rounds.length));
  const stateRef = useRef(state);
  // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the next round, or the end of the step, waits for the sentence to be said (up to the sentence cap).
  const pacing = useSoundPacing();
  const cardRef = useRef<Focusable | null>(null);
  const hostRef = useRef(host);
  hostRef.current = host;
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;
  const dispatchRef = useRef<(event: ClozeEvent) => void>(() => undefined);
  // F-A11Y-001 AF-4b: each result is said once, by the answer announcer; with a screen reader on a right tile shows Next.
  const a = useAnswerAnnouncement();
  const { clear, focusPrompt } = a;
  const nextButton = useRoundNext();
  const mounted = useRef(false);
  /** The round last moved on from: a second Next (or a late wait) for the same round does nothing; the sentence is not said after it. */
  const movedFrom = useRef(-1);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const current = rounds[state.roundIdx];
  const slot = usePromptSlot({
    source: CLOZE_PICK_AUDIO_SOURCE,
    // [FU] FU-3: what plays is the filled sentence, whose say clip is bundled (the gapped sentence has no recording of its own).
    hasClip: current !== undefined && hasClipFor(clozeSpeech(current.round)),
    textOnScreen: true,
  });
  const { play: slotPlay, reset: slotReset } = slot;
  const [helpOpen, setHelpOpen] = useState(false);

  const runEffect = useCallback(
    (effect: ClozeEffect): void => {
      const entry = roundsRef.current[stateRef.current.roundIdx];
      switch (effect.type) {
        case 'say':
          if (entry) void pacing.track(slotPlay(() => playPrompt(clozeSpeech(entry.round))));
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
          pacing.after(effect.ms, () => dispatchRef.current({ type: 'advance' }), SENTENCE_SOUND_MAX_MS);
          return;
        case 'complete':
          hostRef.current.complete();
          return;
      }
    },
    [slotPlay, pacing],
  );

  /** What a result needs from this render: read when the tap comes, so `dispatch` keeps one identity. */
  const latest = useRef({ a, next: nextButton, a11y: m.a11y });
  latest.current = { a, next: nextButton, a11y: m.a11y };

  /** A tap that scored: the line is said once, and the effects that follow are the answer's own (§3.4). */
  const settle = useCallback(
    (before: ClozeFlowState, after: ClozeFlowState, tapped: string, effects: ClozeEffect[]): void => {
      const entry = roundsRef.current[before.roundIdx];
      const { a: say, next, a11y: texts } = latest.current;
      const option = entry?.pick.options.find((o) => o.id === tapped);
      const sentence = effects.find((e) => e.type === 'say');
      const advanceNow = effects.find((e) => e.type === 'schedule-advance');
      const correct = effects.some((e) => e.type === 'answer' && e.correct);
      effects.filter((e) => e !== sentence && e !== advanceNow).forEach(runEffect);
      if (!entry || !option) return;
      const asked = before.roundIdx;
      if (correct && advanceNow?.type === 'schedule-advance') {
        const item = optionItem(option, texts, { gloss: true });
        const speak = (): Promise<void> => say.announce({ kind: 'right', item });
        void afterRightAnswer({
          readerOn: say.readerOn,
          gameMinMs: advanceNow.ms,
          announce: say.readerOn ? () => next.afterFocus(speak) : speak,
          ...(sentence === undefined
            ? {}
            : {
                play: () => {
                  // A reader on may press Next before the line ends: the round has moved on, so its sentence is not said.
                  if (movedFrom.current === asked || !mounted.current) return;
                  runEffect(sentence);
                },
              }),
          showNext: next.show,
          waitThenAdvance: (minMs) => runEffect({ type: 'schedule-advance', ms: minMs }),
        });
        return;
      }
      const item = optionItem(option, texts, { gloss: false });
      const fits = entry.pick.options.find((o) => o.id === entry.pick.answerId);
      // The miss that rings the fitting tile carries the look-here line; every other miss is a plain retry.
      afterMiss({
        readerOn: say.readerOn,
        announce: () =>
          say.announce(
            after.hint && !before.hint && fits ? { kind: 'missHint', item, hint: lookHereLine(texts, optionItem(fits, texts, { gloss: false })) } : { kind: 'miss', item },
          ),
      });
    },
    [runEffect],
  );

  const dispatch = useCallback(
    (event: ClozeEvent): void => {
      const before = stateRef.current;
      const out = stepCloze(before, event);
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
      stop();
    },
    [],
  );

  // A new round is a new prompt slot and empties the announcer; focus moves to the round's header node with a screen reader
  // on (§3.4), and otherwise to the sentence card, from round 2 on.
  const roundIdx = state.roundIdx;
  useEffect(() => {
    slotReset();
    clear();
    if (roundIdx > 0) {
      if (latest.current.a.readerOn) focusPrompt();
      else cardRef.current?.focus?.();
    }
  }, [roundIdx, slotReset, clear, focusPrompt]);

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
  // A quest Check holds the sentence's, the card's and the tiles' romanization until the gap is filled (AMENDMENTS-STAGE1-DECODING-CHECK DC-1c).
  const hold = holdsRomanization(hostSurface(host.mode));
  const view = clozeView(round, state, { mode: host.mode, romanizationMode, hold, a11y: a11y.clozePick });
  const columns = clozeColumns(round, layoutClass.windowWidth);
  const koSize = layoutClass.width === 'compact' ? textScale.size.prompt : textScale.size.title;
  const hoyaLine: Record<ClozeHoyaLine, string> = {
    miss: copy.clozePick.miss,
    missParticle: copy.sentenceBuilder.missParticle,
    missValue: copy.realia.missHoya,
    lookHere: copy.clozePick.lookHere,
  };
  const hear = (): void => dispatch({ type: 'hear' });
  /** Next (a reader on): the round moves on once; a second press, or one after the round has moved, does nothing. */
  const advanceNow = (): void => {
    if (movedFrom.current === roundIdx) return;
    movedFrom.current = roundIdx;
    nextButton.hide();
    dispatch({ type: 'advance' });
  };
  // The round's header node (§3.4): the heading; the sentence card under it names the Korean by romanization already.
  const roundLabel = m.a11y.answer.round(roundIdx + 1, rounds.length, copy.clozePick.heading);

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
            <View ref={a.promptRef} testID="cloze-pick-round" accessible accessibilityRole="header" accessibilityLabel={roundLabel}>
              <Heading level="prompt">{copy.clozePick.heading}</Heading>
            </View>
            {round.gapKind === 'value' && realia ? <ClozeRealia realia={realia} held={hold && !view.found} testID="cloze-pick-realia" /> : null}
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
              ) : view.heldRomanization !== '' ? (
                <HeldText size="bodySm" tone="secondary" leading="body">{view.heldRomanization}</HeldText>
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
            <TapBoard lock="board">
              {/* One board for the tiles (AMENDMENTS-TOUCH section 6, row KT-3): a graze still counts, a bounce never counts twice. */}
              <View testID="cloze-pick-tiles" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                {pick.options.map((option) => {
                  const card = optionView(pick, option, state, { mode: host.mode, romanizationMode, holdRomanization: hold }, a11y);
                  const look = choiceCardStyle(card.cardState);
                  return (
                    <View key={option.id} style={{ flexGrow: 1, flexBasis: columns === 2 ? '45%' : '100%', minWidth: touchTarget.hero }}>
                      {/* The option card's looks (design/components/ChoiceCard) in the compact tile of the mock: centred
                          Korean over its romanization, 64 tall, a miss in amber with a thicker border and its mark. */}
                      <TapTarget
                        testID={`cloze-pick-tile-${option.id}`}
                        onCommit={() => dispatch({ type: 'tap', optionId: option.id, answerId: pick.answerId, at: Date.now() })}
                        // An answered tile (the fit, or a locked miss) takes no tap but stays a focusable button with its state.
                        inactive={!look.interactive}
                        accessibilityLabel={card.accessibilityLabel}
                        accessibilityState={{ disabled: look.disabled, selected: look.selected }}
                        style={{ alignSelf: 'stretch' }}
                      >
                        {({ pressed }) => {
                          // The press look (AMENDMENTS-TOUCH section 4.3) on the drawn box, never a state look.
                          const p = pressed && look.interactive ? press : null;
                          const rest = card.cardState === 'wrong' ? borderWidth.thick : look.borderWidth;
                          return (
                            <View
                              style={{
                                minHeight: touchTarget.min,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: spacing.sm,
                                paddingVertical: spacing.sm - pressInset(p, rest),
                                paddingHorizontal: spacing.md - pressInset(p, rest),
                                borderRadius: look.borderRadius,
                                borderWidth: p?.borderWidth ?? rest,
                                borderColor: p?.borderColor ?? look.borderColor,
                                backgroundColor: look.backgroundColor,
                                transform: pressTransform(p),
                              }}
                            >
                              {look.ring ? (
                                // F-A11Y-001 AF-1 (AnswerFeedback D4): look-here is the card's dashed ring outside the tile.
                                <View aria-hidden pointerEvents="none" style={choiceCardRingStyle(look.ring, look.borderRadius, p?.borderWidth ?? rest)} />
                              ) : null}
                              {/* A column as wide as the mark on each side, in every state: the word stays centred, the mark never
                                  covers it (it did at 320 wide with 200 % text), and answering never rewraps the word. */}
                              <View style={{ width: spacing.xl }} />
                              <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontFamily: typography.family.sansKr, fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary, textAlign: 'center' }}>
                                  {card.ko}
                                </Text>
                                {card.romanization !== '' ? (
                                  <Body size="sm" tone="secondary">
                                    {card.romanization}
                                  </Body>
                                ) : card.heldRomanization !== '' ? (
                                  <HeldText size="bodySm" tone="secondary" leading="body">{card.heldRomanization}</HeldText>
                                ) : null}
                              </View>
                              {look.mark ? (
                                <Icon name={look.mark.icon} size={spacing.xl} color={look.mark.color} />
                              ) : (
                                <View style={{ width: spacing.xl }} />
                              )}
                            </View>
                          );
                        }}
                      </TapTarget>
                    </View>
                  );
                })}
              </View>
            </TapBoard>
            {nextButton.shown ? (
              <Button
                pressableRef={nextButton.nextRef}
                label={copy.trace.next.cta}
                tone="primary"
                size="hero"
                fullWidth
                onPress={advanceNow}
                testID="cloze-pick-next"
              />
            ) : null}
          </View>
        }
        feedback={
          <View>
            {view.hoya ? (
              <>
                <Spacer size="lg" />
                {/* The announcer says the result once, so this result bubble is not a live region too (§3.3). */}
                <HoyaBubble tone="thinking" message={hoyaLine[view.hoya]} live={false} />
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
