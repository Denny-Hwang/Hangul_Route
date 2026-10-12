import {
  Body,
  ChoiceCard,
  HoyaBubble,
  Icon,
  KoreanText,
  Pill,
  borderWidth,
  choiceCardTileWidth,
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
import { PromptPanel } from '../../components/PromptPanel';
import { usePromptSlot } from '../../components/use-prompt-slot';
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
  localizedTopicTitle,
  optionColumns,
  optionView,
  outcomeKey,
  promptView,
  speechFor,
  wrongMarkFor,
  type QuestionViewContext,
} from '../../logic/vocab/question-view';
import { hasClip, playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { focusForScreenReader, isScreenReaderEnabled, subscribeScreenReader } from '../../platform/screen-reader';
import { useAudioStore } from '../../store/audio-store';
import type { MinigameHost } from '../minigames/host';
import { PictureArt } from '../minigames/PictureArt';

/**
 * VocabQuestionView (F-VOC-004 §3.9): one vocabulary question, its prompt and
 * its options, in `speed` mode (the Speed Round: the first tap decides, then
 * the reveal beat) or `check` mode (F-VOC-003's quick check: try again until
 * right). The flow is `logic/vocab/question-flow.ts` and every look and name
 * is `logic/vocab/question-view.ts`; this file renders them and runs the
 * effects (voice, haptics, the reveal timer). The prompt word plays through an
 * F-AUDIO-004 prompt slot, so sound off, no voice and a failed play show the
 * text fallback and its status. No header, clock, meter or Back: the host
 * screen draws those, chooses Hoya's line and decides what comes next.
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
  /** A Korean voice can play (decided once by the host, S7). `false`: nothing is spoken and a sound question shows its word. */
  canPlay: boolean;
  /** The learner's romanization setting. */
  romanizationShown: boolean;
  /** The first tap of the question (the Speed Round's session `answer`). */
  onAnswer?: (optionId: string) => void;
  /**
   * The reveal beat is over: open the next question (speed: the session's `reveal-done`). This is the
   * only signal that a question has ended, so the host keeps the view mounted through the reveal: an
   * unmount during the beat cancels it and `onAdvance` never fires (a pause overlay covers the view,
   * it does not replace it).
   */
  onAdvance: () => void;
  /** The session's hint ring on the right option (Relaxed at 20 s). */
  ring?: boolean;
  /** Hoya's line under the options, chosen by the host (`nudgeFor` in the Speed Round). */
  hoya?: VocabQuestionHoya | null;
  testID?: string;
}

/** Read by assistive tech, not drawn (the web live line; native announces the outcome itself). */
const SCREEN_READER_ONLY = {
  position: 'absolute',
  width: borderWidth.thin,
  height: borderWidth.thin,
  margin: -borderWidth.thin,
  overflow: 'hidden',
} as const;

/** Between option cards (§3.6: 8 dp gaps). */
const OPTION_GAP = spacing.sm;

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
  const unlocked = useAudioStore((s) => s.unlocked);
  // `null` until known: nothing plays by itself before the view knows whether a screen reader is on.
  const [screenReader, setScreenReader] = useState<boolean | null>(null);

  // The flow lives in a ref that only `dispatch` advances (two quick taps each see the state the other left),
  // and a new question starts a new flow, so the state of the last one never leaks into it.
  const flowRef = useRef<Flow>({ key: question.key, state: startQuestionFlow() });
  if (flowRef.current.key !== question.key) flowRef.current = { key: question.key, state: startQuestionFlow() };
  const state = flowRef.current.state;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const key = question.key;
  const promptKind = question.prompt.kind;
  // The prompt word's sound, or its text when there is none (F-AUDIO-004 §3.8). A word question already
  // prints its Korean, so its fallback counts once the status panel is up; a picture prompt has no sound.
  const slot = usePromptSlot({
    source: QUESTION_AUDIO_SOURCE[mode],
    hasClip: hasClip(question.prompt.audioRef),
    textOnScreen: promptKind === 'word',
    reportFallback: promptKind !== 'image',
  });

  const latest = useRef({ question, mode, host, onAnswer, onAdvance, canPlay });
  latest.current = { question, mode, host, onAnswer, onAdvance, canPlay };
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptRef = useRef<View | null>(null);
  const dispatchRef = useRef<(event: QuestionFlowEvent, key: string) => void>(() => undefined);
  // Plays this view started that have not settled: only those are stopped when the view goes away.
  const inFlight = useRef(0);

  const track = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    inFlight.current += 1;
    const settle = (): void => {
      inFlight.current -= 1;
    };
    const pending = run();
    pending.then(settle, settle);
    return pending;
  }, []);

  const { play: slotPlay, reset: slotReset } = slot;
  const playPromptWord = useCallback(
    (forKey: string): void => {
      const { question: q, mode: currentMode } = latest.current;
      if (q.prompt.ko === undefined) return;
      const spec = { text: q.prompt.spokenKo ?? q.prompt.ko, audioRef: q.prompt.audioRef, kind: 'word' as const, source: QUESTION_AUDIO_SOURCE[currentMode] };
      void slotPlay(() => track(() => playPrompt(spec))).then((result) => {
        // A sound question whose voice fails shows its word as text (F-AUDIO-004 §3.8); it scores normally.
        if (q.prompt.kind === 'audio' && result !== 'played') dispatchRef.current({ type: 'audio-failed' }, forKey);
      });
    },
    [slotPlay, track],
  );

  const runEffect = useCallback(
    (effect: QuestionFlowEffect): void => {
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
          // The host decided once that no Korean voice is used (S7): the reveal stays silent.
          if (!current.canPlay) return;
          const words = speechFor(current.question, vocabItem(current.question.itemId));
          if (words) {
            const spec = { text: words.text, audioRef: words.audioRef, kind: 'word' as const, source: QUESTION_AUDIO_SOURCE[current.mode] };
            void track(() => playPrompt(spec));
          }
          return;
        }
        case 'schedule-advance': {
          const forKey = current.question.key;
          if (advanceTimer.current) clearTimeout(advanceTimer.current);
          advanceTimer.current = setTimeout(() => {
            advanceTimer.current = null;
            if (flowRef.current.key === forKey) latest.current.onAdvance();
          }, effect.ms);
          return;
        }
      }
    },
    [track],
  );

  const dispatch = useCallback(
    (event: QuestionFlowEvent, forKey: string): void => {
      const current = flowRef.current;
      // A late voice result or tap for an earlier question says nothing about this one.
      if (current.key !== forKey) return;
      const out = stepQuestionFlow(current.state, event, latest.current.question, latest.current.mode);
      if (out.state === current.state) return;
      flowRef.current = { key: forKey, state: out.state };
      rerender();
      out.effects.forEach(runEffect);
    },
    [runEffect],
  );
  dispatchRef.current = dispatch;

  useEffect(() => {
    let live = true;
    void isScreenReaderEnabled().then((on) => {
      if (live) setScreenReader(on);
    });
    const off = subscribeScreenReader(setScreenReader);
    return () => {
      live = false;
      off();
    };
  }, []);

  // Each new question: the prompt slot forgets the last one's text, and focus moves to the prompt
  // (the word, the picture, or the speaker of a sound question).
  useEffect(() => {
    slotReset();
    focusForScreenReader(promptRef.current);
  }, [key, slotReset]);

  // The word plays by itself once per question while it is asked: only when a voice is allowed, the page
  // may play sound (the first gesture unlocks it on the web, F-AUDIO-004 §3.6), and no screen reader is
  // on (it would talk over the reader as focus lands on the prompt; the speaker stays, F-PLC-001 §3.12).
  const autoplayed = useRef<string | null>(null);
  useEffect(() => {
    if (autoplayed.current === key || !canPlay || promptKind === 'image') return;
    if (!unlocked || screenReader !== false || flowRef.current.state.status !== 'asking') return;
    autoplayed.current = key;
    playPromptWord(key);
  }, [key, canPlay, promptKind, unlocked, screenReader, playPromptWord]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      // Only this view's own speech: the next screen may already be speaking.
      if (inFlight.current > 0) stop();
    },
    [],
  );

  const ctx: QuestionViewContext = {
    mode,
    romanizationShown,
    canPlay,
    textFallback: slot.view.textShown,
    glossOf: (id) => {
      const item = vocabItem(id);
      return item ? localizedGloss(item, locale) : undefined;
    },
    topicTitle: (topicKey) => {
      const topic = vocabTopic(topicKey);
      return topic ? localizedTopicTitle(topic, locale) : undefined;
    },
  };
  const prompt = promptView(question, state, ctx);
  const line = announcement(question, state, ctx, say);
  const lineKey = outcomeKey(state);

  // Native screen readers announce the outcome line on every accepted tap (the key changes even when the
  // words do not); the web reads the hidden live line below instead.
  const lineRef = useRef(line);
  lineRef.current = line;
  useEffect(() => {
    if (lineKey !== null && lineRef.current !== null && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(lineRef.current);
  }, [lineKey]);

  // Until the first layout, the screen's column: the window less the gutters, capped like `Screen`.
  const columnWidth = width ?? Math.min(layoutClass.windowWidth - 2 * layoutClass.gutter, layoutClass.maxWidth.reading);
  const columns = optionColumns(question, columnWidth, { minPictureCard: choiceCardTileWidth(pictureSize), gap: OPTION_GAP });
  // Whole dp, so a row never overflows its column by a rounding error and wraps early.
  const cardWidth = columns === 1 ? '100%' : Math.floor((columnWidth - (columns - 1) * OPTION_GAP) / columns);
  const onLayout = (e: LayoutChangeEvent): void => setWidth(e.nativeEvent.layout.width);

  const speakerLabel = slot.view.reason === 'muted' || slot.view.reason === 'blocked' ? slot.view.speakerLabel : say.speaker;
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
        accessibilityLabel={speakerLabel}
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

  // Why there is no sound and the one action (Turn sound on / Try again / Tap to hear), once a play was tried.
  const soundStatus =
    promptKind === 'image' ? null : (
      <PromptPanel variant="status" view={slot.view} onAction={(action) => slot.act(action, () => playPromptWord(key))} testID={`${testID}-sound`} />
    );

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
              // Focusable by script only (web), never a tab stop: focus lands here on each new question.
              tabIndex={-1}
              testID={`${testID}-prompt`}
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
            tabIndex={-1}
            testID={`${testID}-prompt`}
            style={{ alignItems: 'center', gap: spacing.md }}
          >
            <PictureArt pictureRef={prompt.picture.ref} gloss={prompt.picture.gloss} size={promptPictureSize} testID={`${testID}-picture`} />
            {word}
          </View>
        ) : null}

        {prompt.kind === 'audio' ? (
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            {prompt.speaker === 'large' ? speakerButton('large') : null}
            {/* Stays mounted, so the arrival of the text is announced to a learner resting on the speaker. With no
                speaker (no voice this session) it is the prompt focus moves to. */}
            <View
              ref={(node) => {
                if (prompt.speaker === null) promptRef.current = node;
              }}
              tabIndex={-1}
              accessibilityLiveRegion="polite"
              style={{ alignItems: 'center', gap: spacing.md }}
              testID={`${testID}-text-prompt`}
            >
              {prompt.readHere ? <Body tone="muted">{m.learner.audio.readHere}</Body> : null}
              {word}
            </View>
          </View>
        ) : null}

        {soundStatus}
      </View>

      <View testID={`${testID}-options`} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: OPTION_GAP }}>
        {question.options.map((option) => {
          const view = optionView(question, option, state, ctx, ring, m.a11y.minigame);
          const picture = view.ko === undefined;
          return (
            <View key={option.id} style={{ width: cardWidth }}>
              <ChoiceCard
                testID={`${testID}-option-${option.id}`}
                state={view.cardState}
                wrongMark={wrongMarkFor(mode)}
                layout={picture ? 'tile' : 'row'}
                ko={view.ko}
                romanization={view.romanization}
                art={picture ? <PictureArt pictureRef={view.pictureRef} gloss={view.gloss} size={pictureSize} decorative /> : undefined}
                accessibilityLabel={view.accessibilityLabel}
                onPress={() => dispatch({ type: 'tap', optionId: option.id, at: Date.now() }, key)}
              />
            </View>
          );
        })}
      </View>

      {Platform.OS === 'web' ? (
        // One polite line for the outcome; a new node on every accepted tap, so the same words are said again.
        <View accessibilityLiveRegion="polite">
          {line !== null ? (
            <Text key={lineKey ?? undefined} style={SCREEN_READER_ONLY} testID={`${testID}-outcome`}>
              {line}
            </Text>
          ) : null}
        </View>
      ) : null}
      {/* Hoya's bubble is its own polite live region (design system), outside the outcome line's. */}
      {hoya ? <HoyaBubble tone={hoya.tone} message={hoya.message} testID={`${testID}-hoya`} /> : null}
    </View>
  );
}
