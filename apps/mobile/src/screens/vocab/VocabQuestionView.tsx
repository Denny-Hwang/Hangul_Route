import {
  Body,
  ChoiceCard,
  HoyaBubble,
  Icon,
  KoreanText,
  Pill,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useLayoutClass,
  useMediaSize,
  type HoyaTone,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { localizedGloss, vocabItem, vocabTopic } from '../../content/vocab';
import { useLocale, useMessages } from '../../i18n/use-messages';
import type { VocabQuestion } from '../../logic/vocab/question-builder';
import {
  startQuestionFlow,
  stepQuestionFlow,
  type QuestionFlowEffect,
  type QuestionFlowEvent,
  type QuestionFlowMode,
  type QuestionFlowState,
} from '../../logic/vocab/question-flow';
import {
  QUESTION_AUDIO_SOURCE,
  announcement,
  optionColumns,
  optionView,
  promptView,
  speechFor,
  type QuestionViewContext,
} from '../../logic/vocab/question-view';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { focusForScreenReader } from '../../platform/screen-reader';
import type { MinigameHost } from '../minigames/host';
import { PictureArt } from '../minigames/PictureArt';

/**
 * VocabQuestionView (F-VOC-004 §3.9): one vocabulary question, its prompt and
 * its options, in `speed` mode (the Speed Round: the first tap decides, then
 * the reveal beat) or `check` mode (F-VOC-003's quick check: try again until
 * right). The flow is `logic/vocab/question-flow.ts` and every look and name
 * is `logic/vocab/question-view.ts`; this file renders them and runs the
 * effects (voice, haptics, the reveal timer). No header, clock, meter or Back:
 * the host screen draws those, chooses Hoya's line and decides what comes next.
 * Design: design/screens/vocab/question-view.md.
 */

export interface VocabQuestionHoya {
  tone: HoyaTone;
  message: string;
}

export interface VocabQuestionViewProps {
  question: VocabQuestion;
  mode: QuestionFlowMode;
  /** Every accepted tap goes to `host.answer(question.key, correct, { itemId })`; the first per key is scored. */
  host: MinigameHost;
  /** A Korean voice can play (decided once by the host, S7). */
  canPlay: boolean;
  /** The learner's romanization setting. */
  romanizationShown: boolean;
  /** The first tap of the question (the Speed Round's session `answer`). */
  onAnswer?: (optionId: string) => void;
  /** The reveal beat is over: open the next question (speed: the session's `reveal-done`). */
  onAdvance: () => void;
  /** The session's hint ring on the right option (Relaxed at 20 s). */
  ring?: boolean;
  /** Hoya's line under the options, chosen by the host (`nudgeFor` in the Speed Round). */
  hoya?: VocabQuestionHoya | null;
  testID?: string;
}

/**
 * What a `ChoiceCard` adds around a picture: horizontal padding, the thickest state border, and the
 * status mark with its gap (ChoiceCard.tsx), as in Listen & Pick.
 */
const CARD_CHROME = 2 * spacing.lg + 2 * borderWidth.thick + spacing.xl + spacing.md;

/** Read by assistive tech, not drawn (the web live line; native announces the outcome itself). */
const SCREEN_READER_ONLY = {
  position: 'absolute',
  width: borderWidth.thin,
  height: borderWidth.thin,
  margin: -borderWidth.thin,
  overflow: 'hidden',
} as const;

interface Flow {
  key: string;
  state: QuestionFlowState;
}

export function VocabQuestionView({
  question,
  mode,
  host,
  canPlay,
  romanizationShown,
  onAnswer,
  onAdvance,
  ring = false,
  hoya = null,
  testID = 'vocab-question',
}: VocabQuestionViewProps): React.ReactElement {
  const m = useMessages();
  const locale = useLocale();
  const say = m.a11y.vocab.question;
  const layoutClass = useLayoutClass();
  const pictureSize = useMediaSize(touchTarget.hero);
  const promptPictureSize = useMediaSize(2 * touchTarget.child);
  const bigSpeaker = useMediaSize(touchTarget.hero);
  const bigSpeakerIcon = useMediaSize(spacing.xxxl);
  const [width, setWidth] = useState<number | null>(null);

  // The flow lives in a ref that only `dispatch` advances (two quick taps each see the state the other left),
  // and a new question starts a new flow, so the state of the last one never leaks into it.
  const flowRef = useRef<Flow>({ key: question.key, state: startQuestionFlow() });
  if (flowRef.current.key !== question.key) flowRef.current = { key: question.key, state: startQuestionFlow() };
  const state = flowRef.current.state;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const latest = useRef({ question, mode, host, onAnswer, onAdvance });
  latest.current = { question, mode, host, onAnswer, onAdvance };
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptRef = useRef<View | null>(null);
  const dispatchRef = useRef<(event: QuestionFlowEvent, key: string) => void>(() => undefined);

  const play = useCallback((text: string, audioRef: string | undefined, key: string, reportFailure: boolean): void => {
    const { mode: currentMode } = latest.current;
    void playPrompt({ text, audioRef, kind: 'word', source: QUESTION_AUDIO_SOURCE[currentMode] }).then((result) => {
      if (reportFailure && result !== 'played') dispatchRef.current({ type: 'audio-failed' }, key);
    });
  }, []);

  const playPromptWord = useCallback(
    (key: string): void => {
      const { question: q } = latest.current;
      if (q.prompt.ko === undefined) return;
      // A sound question whose voice fails shows its word as text (F-AUDIO-004 §3.8).
      play(q.prompt.spokenKo ?? q.prompt.ko, q.prompt.audioRef, key, q.prompt.kind === 'audio');
    },
    [play],
  );

  const runEffect = useCallback(
    (effect: QuestionFlowEffect, key: string): void => {
      const current = latest.current;
      switch (effect.type) {
        case 'answer':
          current.host.answer(current.question.key, effect.correct, { itemId: current.question.itemId });
          if (effect.firstTry) current.onAnswer?.(effect.optionId);
          return;
        case 'haptic':
          if (effect.kind === 'success') {
            tapLight();
            success();
          } else {
            nudge();
          }
          return;
        case 'speak': {
          const item = vocabItem(current.question.itemId);
          const words = speechFor(current.question, item);
          if (words) play(words.text, words.audioRef, key, false);
          return;
        }
        case 'schedule-advance':
          if (advanceTimer.current) clearTimeout(advanceTimer.current);
          advanceTimer.current = setTimeout(() => {
            advanceTimer.current = null;
            if (flowRef.current.key === key) latest.current.onAdvance();
          }, effect.ms);
          return;
      }
    },
    [play],
  );

  const dispatch = useCallback(
    (event: QuestionFlowEvent, key: string): void => {
      const current = flowRef.current;
      // A late voice result or tap for an earlier question says nothing about this one.
      if (current.key !== key) return;
      const out = stepQuestionFlow(current.state, event, latest.current.question, latest.current.mode);
      if (out.state === current.state) return;
      flowRef.current = { key, state: out.state };
      rerender();
      out.effects.forEach((effect) => runEffect(effect, key));
    },
    [runEffect],
  );
  dispatchRef.current = dispatch;

  // Each new question: the word plays by itself (word and sound prompts) and focus moves to the prompt
  // (the word, the picture, or the speaker of a sound question).
  const key = question.key;
  useEffect(() => {
    if (canPlay && question.prompt.kind !== 'image') playPromptWord(key);
    focusForScreenReader(promptRef.current);
    // The prompt plays once per question, not again when the host re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      stop();
    },
    [],
  );

  const ctx: QuestionViewContext = {
    mode,
    romanizationShown,
    canPlay,
    glossOf: (id) => {
      const item = vocabItem(id);
      return item ? localizedGloss(item, locale) : undefined;
    },
    topicTitle: (topicKey) => vocabTopic(topicKey)?.titleEn,
  };
  const prompt = promptView(question, state, ctx);
  const line = announcement(question, state, ctx, say);

  // Native screen readers announce the outcome line; the web reads the hidden live line below instead.
  useEffect(() => {
    if (line !== null && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(line);
  }, [line]);

  const columnWidth = width ?? layoutClass.windowWidth;
  const columns = optionColumns(question, columnWidth, { minPictureCard: pictureSize + CARD_CHROME, gap: spacing.md });
  const basis = columns === 3 ? '30%' : columns === 2 ? '45%' : '100%';
  const onLayout = (e: LayoutChangeEvent): void => setWidth(e.nativeEvent.layout.width);

  const speakerButton = (size: 'small' | 'large'): React.ReactElement => {
    const side = size === 'large' ? bigSpeaker : touchTarget.min;
    return (
      <Pressable
        ref={(node) => {
          if (size === 'large') promptRef.current = node as unknown as View | null;
        }}
        testID={`${testID}-speaker`}
        onPress={() => playPromptWord(key)}
        accessibilityRole="button"
        accessibilityLabel={say.speaker}
        hitSlop={spacing.sm}
        style={{
          width: side,
          height: side,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brand.secondaryLight,
          borderColor: colors.brand.secondary,
          borderWidth: borderWidth.base,
        }}
      >
        <Icon name="speaker" size={size === 'large' ? bigSpeakerIcon : spacing.xl} color={colors.brand.secondaryDark} />
      </Pressable>
    );
  };

  const word = prompt.word ? (
    <KoreanText
      ko={prompt.word.ko}
      romanization={prompt.word.romanization}
      romanizationShown={prompt.word.romanizationShown}
      gloss={prompt.word.gloss}
      size="lg"
      testID={`${testID}-word`}
    />
  ) : null;

  return (
    <View testID={testID} onLayout={onLayout} style={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        {prompt.topicChip !== null ? (
          <View accessible accessibilityLabel={say.topic(prompt.topicChip)} testID={`${testID}-topic`}>
            <Pill label={prompt.topicChip} tone="secondary" size="sm" />
          </View>
        ) : null}

        {prompt.kind === 'word' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              ref={(node) => {
                promptRef.current = node;
              }}
              accessible
            >
              {word}
            </View>
            {prompt.speaker === 'small' ? speakerButton('small') : null}
          </View>
        ) : null}

        {prompt.kind === 'image' && prompt.picture ? (
          <View
            ref={(node) => {
              promptRef.current = node;
            }}
            accessible
            style={{ alignItems: 'center', gap: spacing.md }}
          >
            <PictureArt pictureRef={prompt.picture.ref} gloss={prompt.picture.gloss} size={promptPictureSize} testID={`${testID}-picture`} />
            {word}
          </View>
        ) : null}

        {prompt.kind === 'audio' ? (
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            {speakerButton('large')}
            {prompt.readHere ? <Body tone="muted">{m.learner.audio.readHere}</Body> : null}
            {word}
          </View>
        ) : null}
      </View>

      <View testID={`${testID}-options`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {question.options.map((option) => {
          const view = optionView(question, option, state, ctx, ring, m.a11y.minigame);
          return (
            <View key={option.id} style={{ flexGrow: 1, flexBasis: basis, minWidth: touchTarget.hero }}>
              <ChoiceCard
                testID={`${testID}-option-${option.id}`}
                state={view.cardState}
                ko={view.ko}
                romanization={view.romanization}
                art={
                  view.ko === undefined ? <PictureArt pictureRef={view.pictureRef} gloss={view.gloss} size={pictureSize} decorative /> : undefined
                }
                accessibilityLabel={view.accessibilityLabel}
                onPress={() => dispatch({ type: 'tap', optionId: option.id, at: Date.now() }, key)}
              />
            </View>
          );
        })}
      </View>

      <View accessibilityLiveRegion={Platform.OS === 'web' ? 'polite' : 'none'}>
        {Platform.OS === 'web' && line !== null ? (
          <Text style={SCREEN_READER_ONLY} testID={`${testID}-outcome`}>
            {line}
          </Text>
        ) : null}
        {hoya ? <HoyaBubble tone={hoya.tone} message={hoya.message} testID={`${testID}-hoya`} /> : null}
      </View>
    </View>
  );
}
