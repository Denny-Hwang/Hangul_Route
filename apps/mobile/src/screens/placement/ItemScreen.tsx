import {
  Body,
  Button,
  Caption,
  ChoiceCard,
  HoyaBubble,
  Hoya,
  Icon,
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
} from '@hangul-route/design-system';
import { currentQuestion, type AssessmentQuestion } from '@hangul-route/content-schema';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { cheerLine } from '../../logic/placement/copy';
import { acknowledgement, choicesEnabled, choicesFallbackMs, pauseSheet, promptPlayback, speaksInstruction } from '../../logic/placement/flow';
import {
  audioFallback,
  choiceColumns,
  estimatedPromptMs,
  instructionFor,
  optionViews,
  promptView,
  questionLabel,
  revealAvailable,
  shortLayout,
  type OptionView,
} from '../../logic/placement/item-view';
import { rungPosition } from '../../logic/placement/session';
import { playPrompt, stop } from '../../platform/audio';
import { PictureArt } from '../minigames/PictureArt';
import { usePlacement } from './context';
import { PauseSheet } from './PauseSheet';
import { ChoiceGrid, FootstepTrail, SpeakerButton } from './parts';

/** How long the neutral "Got it" stays (Standard and Deep). */
const ACK_MS = 900;

/** Focus target for assistive tech when a question opens (web; a no-op where the node has no `focus`). */
interface Focusable {
  focus?: () => void;
}

/**
 * Items (F-PLC-001 section 3.1 step 5, wireframe placement E and E2): one
 * question at a time. Answers are final: no right or wrong, no retry, no
 * hint; a neutral "Got it" (not in Short) and the next question. "I am not
 * sure" is the same size as a choice and never red; the footstep trail only
 * fills; the exit is always there. Prompts play on open (the warm-up tap
 * unlocked audio), except the first one after a resume, and never with a
 * screen reader on. Short keeps a 2 x 2 grid (two columns in landscape) and
 * enables the cards when the prompt ends or after the fallback delay.
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
  const [shownAt] = useState(() => Date.now());
  const [now, setNow] = useState(shownAt);
  const playing = useRef(false);
  const promptRef = useRef<Focusable | null>(null);

  const instruction = instructionFor(m, question.format, flow.testLocale);
  const options = optionViews(question, { revealed, mode, testLocale: flow.testLocale, m });
  const cheer = cheerLine(m, mode, answered);
  const canReveal = revealAvailable(question, state.config) && !revealed;
  const enabled = choicesEnabled({
    mode,
    playbackEnded,
    shownAtMs: shownAt,
    nowMs: now,
    estimatedPromptMs: heard ? estimatedPromptMs(prompt.text) : 0,
  });

  const playKorean = (): void => {
    if (!heard || playing.current) return;
    playing.current = true;
    void playPrompt({
      text: prompt.text,
      ...(prompt.audioRef === undefined ? {} : { audioRef: prompt.audioRef }),
      kind: question.format === 'reply-pick' ? 'sentence' : question.format === 'hear-pick-picture' ? 'word' : 'sound',
      source: 'placement',
    }).then((result) => {
      playing.current = false;
      setPlaybackEnded(true);
      if (result !== 'unavailable') return;
      // Section 3.11: read the words or the reply instead; a heard letter or syllable would be the answer.
      if (audioFallback(question.format) === 'text') setTextFallback(true);
      else applyRun({ type: 'notSure' });
    });
  };

  // On open: a cheer every few answers, the instruction (Short: first item of a rung only), then the prompt.
  useEffect(() => {
    promptRef.current?.focus?.();
    if (promptPlayback({ screenReader, needsGesture }) !== 'auto') return;
    let alive = true;
    void (async () => {
      if (cheer !== null) await say(cheer);
      if (alive && speaksInstruction(mode, position?.indexInRung ?? 0)) await say(instruction.spoken);
      if (alive) playKorean();
    })();
    return () => {
      alive = false;
      stop();
    };
    // Once per question (this view is keyed by it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Short: the cards enable after the fallback delay even if the prompt never reports its end.
  useEffect(() => {
    if (!short || playbackEnded) return;
    const id = setTimeout(() => setNow(Date.now()), choicesFallbackMs(heard ? estimatedPromptMs(prompt.text) : 0));
    return () => clearTimeout(id);
  }, [short, playbackEnded, heard, prompt]);

  const hear = (): void => {
    markGesture();
    applyRun({ type: 'touch' });
    playKorean();
  };
  const reveal = (): void => {
    applyRun({ type: 'touch' });
    setRevealed(true);
  };
  const choose = (option: OptionView): void => {
    if (!enabled || sheet !== null) return;
    stop();
    if (acknowledgement(mode) === 'got-it') onAck();
    applyRun({ type: 'answer', optionId: option.id, assisted: revealed });
  };
  const notSure = (): void => {
    if (sheet !== null) return;
    stop();
    applyRun({ type: 'notSure' });
  };
  const exit = (): void => {
    stop();
    applyRun({ type: 'exit' });
  };

  const layout = useLayoutClass();
  const window = useWindowDimensions();
  const contentWidth = Math.min(layout.windowWidth - 2 * layout.gutter, layout.maxWidth.reading);
  const columns = choiceColumns({ mode, contentWidth, fontScale: window.fontScale });
  const arrangement = short ? shortLayout(window, window.fontScale) : 'portrait';
  // Short in landscape: smaller pictures so two rows and "I am not sure" fit 568 x 320 (cards keep touchTarget.child).
  const artSize = useMediaSize(short ? (arrangement === 'portrait' ? touchTarget.child : spacing.xxxl) : touchTarget.hero);
  // Standard and Deep: the speaker grows with the window like the games' speakers.
  const speakerSize = useMediaSize(touchTarget.hero);

  const exitControl = short ? (
    <Pressable
      testID="placement-exit"
      onPress={exit}
      accessibilityRole="button"
      accessibilityLabel={copy.exit}
      style={{ width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="close" size={spacing.xl} color={colors.text.secondary} />
    </Pressable>
  ) : (
    <Button label={copy.exit} tone="ghost" size="md" onPress={exit} testID="placement-exit" />
  );

  /** Focus lands here on each question: "Question, 4 choices" and the instruction. */
  const announced = (children: React.ReactNode): React.ReactElement => (
    <View
      ref={(node) => {
        promptRef.current = node as unknown as Focusable | null;
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
          label={needsGesture || screenReader ? copy.tapToHear : copy.hearAgain}
          size={short ? touchTarget.hero : speakerSize}
          testID="placement-speaker"
        />
      ) : null}
      {prompt.kind === 'speaker' && needsGesture ? <Caption tone="secondary">{copy.tapToHear}</Caption> : null}
      {prompt.kind === 'written' ? <KoreanText ko={prompt.ko} romanization={prompt.romanization} size="lg" /> : null}
      {textFallback && (question.promptKo !== undefined || question.spokenKo !== undefined) ? (
        <View style={{ alignItems: 'center', gap: spacing.xs }} testID="placement-text-fallback">
          <Caption tone="secondary">{copy.noSoundFallback}</Caption>
          <KoreanText ko={question.promptKo ?? question.spokenKo ?? ''} romanization={revealed ? (question.promptRomanization ?? '') : ''} size="lg" />
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
        minHeight: short ? touchTarget.child : touchTarget.min,
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
  const hoyaLine = cheer ?? instruction.visible;
  const hoya = short ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
      {announced(<Hoya pose={cheer === null ? 'idle' : 'cheering'} size={touchTarget.min} />)}
      {promptBlock}
    </View>
  ) : (
    announced(hoyaLine === null ? <Hoya pose="idle" size={touchTarget.min} /> : <HoyaBubble tone={cheer === null ? 'idle' : 'cheering'} message={hoyaLine} />)
  );
  const topBar = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      {exitControl}
      <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {ack ? (
          <Caption tone="secondary" testID="placement-got-it">
            {copy.gotIt}
          </Caption>
        ) : null}
        <FootstepTrail answered={answered} />
      </View>
    </View>
  );

  const pause = sheet === null ? null : <PauseSheet sheet={sheet} />;

  if (arrangement !== 'portrait') {
    const grid = <ChoiceGrid columns={2}>{cards}</ChoiceGrid>;
    return (
      <Screen tone="canvas" scrollable={false} testID="placement-item">
        <View style={{ flex: 1, flexDirection: 'row', gap: spacing.lg }}>
          <View style={{ flex: 1, gap: spacing.md }}>
            {topBar}
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
    <Screen tone="canvas" testID="placement-item">
      {topBar}
      <Spacer size={short ? 'sm' : 'md'} />
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
