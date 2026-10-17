import {
  Body,
  Button,
  ChoiceCard,
  HoyaBubble,
  Hoya,
  KoreanText,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useLayoutClass,
  useMediaSize,
  useEffectiveFontScale,
} from '@hangul-route/design-system';
import { currentQuestion, type AssessmentQuestion } from '@hangul-route/content-schema';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { cheerLine } from '../../logic/placement/copy';
import { acknowledgement, choicesEnableAtMs, choicesEnabled, pauseSheet, promptPlayback, speaksInstruction } from '../../logic/placement/flow';
import {
  NO_SOUND_SKIP,
  choiceColumns,
  estimatedPromptMs,
  fallbackRomanization,
  instructionFor,
  instructionOnTap,
  optionViews,
  promptOutcome,
  promptView,
  questionLabel,
  revealAvailable,
  shortLayout,
  type OptionView,
} from '../../logic/placement/item-view';
import { rungPosition } from '../../logic/placement/session';
import { playPrompt, stop } from '../../platform/audio';
import { focusForScreenReader } from '../../platform/screen-reader';
import { PictureArt } from '../minigames/PictureArt';
import { usePlacement } from './context';
import { PauseSheet } from './PauseSheet';
import { LearnerScreenHeader } from '../../components/LearnerScreenHeader';
import { ChoiceGrid, FootstepTrail, SpeakerButton } from './parts';

/** How long the neutral "Got it" stays (Standard and Deep). */
const ACK_MS = 900;

/**
 * Items (F-PLC-001 section 3.1 step 5, wireframe placement E and E2): one
 * question at a time. Answers are final: no right or wrong, no retry, no
 * hint; a neutral "Got it" (not in Short) and the next question. "I am not
 * sure" is the same size as a choice and never red; the footstep trail only
 * fills; the exit is always there. Prompts play on open (the warm-up tap
 * unlocked audio), except the first one after a resume, and never with a
 * screen reader on. Short keeps a 2 x 2 grid (two columns in landscape) and
 * enables the cards when the prompt ends or after the fallback delay, timed
 * from when the Korean prompt starts. A heard letter or syllable that cannot
 * play asks for a tap first and is skipped (kept out of scoring) only when
 * that fails too (section 3.11).
 */
export function ItemScreen(): React.ReactElement | null {
  const { run } = usePlacement();
  // "Got it" outlives the question it acknowledges (the next one is already showing).
  const [ack, setAck] = useState(false);
  useEffect(() => {
    if (!ack) return;
    const id = setTimeout(() => setAck(false), ACK_MS);
    return () => clearTimeout(id);
  }, [ack]);
  const question = run === null ? null : currentQuestion(run);
  if (run === null || question === null || run.stop !== null) return <Screen tone="canvas">{null}</Screen>;
  return <ItemView key={`${question.id}:${run.responses.length}`} question={question} ack={ack} onAck={() => setAck(true)} />;
}

function ItemView({ question, ack, onAck }: { question: AssessmentQuestion; ack: boolean; onAck: () => void }): React.ReactElement {
  const { m, flow, run, applyRun, say, screenReader, needsGesture, markGesture } = usePlacement();
  const copy = m.learner.placement.item;
  const state = run as NonNullable<typeof run>;
  const mode = state.config.mode;
  const short = mode === 'short';
  const position = rungPosition(state);
  const answered = state.responses.length;
  const sheet = pauseSheet(state);

  const [revealed, setRevealed] = useState(false);
  const prompt = promptView(question, revealed);
  const heard = prompt.kind === 'speaker';
  const [playbackEnded, setPlaybackEnded] = useState(!heard);
  const [textFallback, setTextFallback] = useState(false);
  // The first play failed: the speaker asks for a tap before the question is skipped.
  const [retry, setRetry] = useState(false);
  const [shownAt] = useState(() => Date.now());
  const [promptStartedAt, setPromptStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(shownAt);
  const playing = useRef(false);
  const failures = useRef(0);
  // This view is keyed by the question and the answer count, so once it is gone a late result belongs to nothing.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop();
    };
  }, []);
  const autoStarted = useRef(false);
  const promptRef = useRef<object | null>(null);

  const instruction = instructionFor(m, question.format, flow.testLocale);
  const options = optionViews(question, { revealed, mode, testLocale: flow.testLocale, m });
  const cheer = cheerLine(m, mode, answered);
  const canReveal = revealAvailable(question, state.config) && !revealed;
  const gate = {
    mode,
    playbackEnded,
    shownAtMs: shownAt,
    promptStartedAtMs: heard ? promptStartedAt : shownAt,
    estimatedPromptMs: heard ? estimatedPromptMs(prompt.text) : 0,
  };
  const enabled = choicesEnabled({ ...gate, nowMs: now });

  const playKorean = (): void => {
    if (!heard || playing.current) return;
    playing.current = true;
    // Short's fallback delay runs from here, after any cheer and instruction.
    setPromptStartedAt((at) => at ?? Date.now());
    void playPrompt({
      text: prompt.text,
      ...(prompt.audioRef === undefined ? {} : { audioRef: prompt.audioRef }),
      kind: question.format === 'reply-pick' ? 'sentence' : question.format === 'hear-pick-picture' ? 'word' : 'sound',
      source: 'placement',
    }).then((result) => {
      if (!alive.current) return;
      playing.current = false;
      // Section 3.11 (sound switched off or not playable): read the words or the reply
      // instead; a heard letter or syllable would be the answer: tap to try again, then skip.
      const outcome = promptOutcome(result, question.format, failures.current);
      if (outcome !== 'played') failures.current += 1;
      if (outcome === 'retry') {
        setRetry(true);
        return;
      }
      setRetry(false);
      setPlaybackEnded(true);
      if (outcome === 'text') setTextFallback(true);
      else if (outcome === 'skip') applyRun(NO_SOUND_SKIP);
    });
  };

  useEffect(() => {
    focusForScreenReader(promptRef.current);
  }, []);

  // On open: a cheer every few answers, the instruction (Short: first item of a rung only), then the prompt.
  // Never under a pause sheet (a question can open under the sound sheet): it starts once the sheet closes.
  const paused = sheet !== null;
  useEffect(() => {
    if (autoStarted.current || paused || promptPlayback({ screenReader, needsGesture }) !== 'auto') return;
    autoStarted.current = true;
    void (async () => {
      if (cheer !== null) await say(cheer);
      if (alive.current && speaksInstruction(mode, position?.indexInRung ?? 0)) await say(instruction.spoken);
      if (alive.current) playKorean();
    })();
    // Once per question (this view is keyed by it), when no sheet is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Short: the cards enable after the fallback delay even if the prompt never reports its end.
  const enableAt = choicesEnableAtMs(gate);
  useEffect(() => {
    if (!Number.isFinite(enableAt)) return;
    const id = setTimeout(() => setNow(Date.now()), Math.max(0, enableAt - Date.now()));
    return () => clearTimeout(id);
  }, [enableAt]);

  // Any tap is the gesture that unlocks audio after a resume, so later prompts play on open again.
  const hear = (): void => {
    const spokenFirst = instructionOnTap(instruction, { screenReader, needsGesture });
    markGesture();
    applyRun({ type: 'touch' });
    if (spokenFirst === null) {
      playKorean();
      return;
    }
    void say(spokenFirst).then(() => playKorean());
  };
  const reveal = (): void => {
    markGesture();
    applyRun({ type: 'touch' });
    setRevealed(true);
  };
  const choose = (option: OptionView): void => {
    if (!enabled || sheet !== null) return;
    markGesture();
    stop();
    if (acknowledgement(mode) === 'got-it') onAck();
    applyRun({ type: 'answer', optionId: option.id, assisted: revealed });
  };
  const notSure = (): void => {
    if (sheet !== null) return;
    markGesture();
    stop();
    applyRun({ type: 'notSure' });
  };

  const layout = useLayoutClass();
  const window = useWindowDimensions();
  const contentWidth = Math.min(layout.windowWidth - 2 * layout.gutter, layout.maxWidth.reading);
  // OS text size x the chosen Display text size (owner items 6 and 7).
  const fontScale = useEffectiveFontScale();
  const columns = choiceColumns({ mode, contentWidth, fontScale });
  const arrangement = short ? shortLayout(window, fontScale) : 'portrait';
  // Short in landscape: smaller pictures so two rows and "I am not sure" fit 568 x 320 (cards keep touchTarget.child).
  const artSize = useMediaSize(short ? (arrangement === 'portrait' ? touchTarget.child : spacing.xxxl) : touchTarget.hero);
  // Standard and Deep: the speaker grows with the window like the games' speakers.
  const speakerSize = useMediaSize(touchTarget.hero);

  /** Focus lands here on each question: "Question, 4 choices" and the instruction. */
  const announced = (children: React.ReactNode): React.ReactElement => (
    <View
      ref={(node) => {
        promptRef.current = node;
      }}
      accessible
      accessibilityRole="header"
      accessibilityLabel={instruction.visible === null ? questionLabel(m, question) : `${questionLabel(m, question)}. ${instruction.visible}`}
    >
      {children}
    </View>
  );

  const promptBlock = (
    <View style={{ alignItems: 'center', gap: spacing.md }}>
      {prompt.kind === 'speaker' ? (
        <SpeakerButton
          onPress={hear}
          label={needsGesture || screenReader || retry ? copy.tapToHear : copy.hearAgain}
          size={short ? touchTarget.hero : speakerSize}
          testID="placement-speaker"
        />
      ) : null}
      {prompt.kind === 'speaker' && (needsGesture || retry) ? (
        <Body tone="secondary" align="center" testID="placement-tap-to-hear">
          {copy.tapToHear}
        </Body>
      ) : null}
      {prompt.kind === 'written' ? <KoreanText ko={prompt.ko} romanization={prompt.romanization} size="lg" /> : null}
      {textFallback && (question.promptKo !== undefined || question.spokenKo !== undefined) ? (
        <View style={{ alignItems: 'center', gap: spacing.xs }} testID="placement-text-fallback">
          <Body tone="secondary" align="center">
            {copy.noSoundFallback}
          </Body>
          <KoreanText
            ko={question.promptKo ?? question.spokenKo ?? ''}
            romanization={fallbackRomanization(question, { revealMode: state.config.revealMode, revealed })}
            size="lg"
          />
        </View>
      ) : null}
      {canReveal ? <Button label={copy.showSound} tone="ghost" size="sm" onPress={reveal} testID="placement-reveal" /> : null}
    </View>
  );

  const cards = options.map((option) => (
    <ChoiceCard
      key={option.id}
      testID={`placement-option-${option.id}`}
      {...(option.kind === 'picture'
        ? { art: <PictureArt pictureRef={option.pictureRef} gloss={option.label} size={artSize} /> }
        : option.kind === 'korean'
          ? { ko: option.ko, romanization: option.romanization }
          : { label: option.sound })}
      state={enabled ? 'idle' : 'disabled'}
      onPress={() => choose(option)}
      accessibilityLabel={option.label}
    />
  ));

  const notSureButton = (
    <Pressable
      testID="placement-not-sure"
      onPress={notSure}
      accessibilityRole="button"
      accessibilityLabel={copy.notSure}
      style={({ pressed }) => ({
        // The same size as a choice (section 3.1 step 5).
        minHeight: touchTarget.child,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.lg,
        borderWidth: borderWidth.base,
        borderColor: colors.border.subtle,
        backgroundColor: pressed ? colors.surface.sunken : colors.surface.paper,
      })}
    >
      {short ? <Hoya pose="thinking" size={spacing.xxl} /> : null}
      <Body weight="semibold">{copy.notSure}</Body>
    </Pressable>
  );

  // Short (wireframe E2): Hoya beside the speaker, nothing to read; the instruction and cheers are spoken.
  // Standard and Deep: Hoya says the cheer, and the written instruction stays on the item whenever there is one.
  const hoyaLine = cheer ?? instruction.visible;
  const hoya = short ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
      {announced(<Hoya pose={cheer === null ? 'idle' : 'cheering'} size={touchTarget.min} />)}
      {promptBlock}
    </View>
  ) : (
    announced(
      <View style={{ gap: spacing.sm }}>
        {hoyaLine === null ? <Hoya pose="idle" size={touchTarget.min} /> : <HoyaBubble tone={cheer === null ? 'idle' : 'cheering'} message={hoyaLine} />}
        {cheer !== null && instruction.visible !== null ? (
          <Body align="center" testID="placement-instruction">
            {instruction.visible}
          </Body>
        ) : null}
      </View>,
    )
  );
  // The route's ScreenHeader holds Close (the exit sheet through the check's back guard, AMENDMENTS-DISPLAY-NAV
  // section 7.1) and, as its middle part, the footsteps; its Display control hides while an item is timed.
  const trail = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm }}>
      {ack ? (
        <Body tone="secondary" testID="placement-got-it">
          {copy.gotIt}
        </Body>
      ) : null}
      <FootstepTrail answered={answered} />
    </View>
  );
  const header = { middle: trail, displayHidden: true };

  const pause = sheet === null ? null : <PauseSheet sheet={sheet} />;

  if (arrangement !== 'portrait') {
    const grid = <ChoiceGrid columns={2}>{cards}</ChoiceGrid>;
    return (
      // Side by side, the header sits at the top of the left column, so the choices keep the whole height.
      <Screen tone="canvas" scrollable={false} testID="placement-item" header={{ ...header, drawnByScreen: true }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: spacing.lg }}>
          <View style={{ flex: 1, gap: spacing.md }}>
            <LearnerScreenHeader options={header} inLayout />
            {hoya}
          </View>
          <View style={{ flex: 1, gap: spacing.md }}>
            {arrangement === 'landscape-scroll' ? <ScrollView style={{ flex: 1 }}>{grid}</ScrollView> : grid}
            {notSureButton}
          </View>
        </View>
        {pause}
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" testID="placement-item" header={header}>
      {hoya}
      {short ? null : (
        <>
          <Spacer size="md" />
          {promptBlock}
        </>
      )}
      <Spacer size={short ? 'md' : 'lg'} />
      <ChoiceGrid columns={columns}>{cards}</ChoiceGrid>
      <Spacer size="md" />
      {notSureButton}
      {pause}
    </Screen>
  );
}
