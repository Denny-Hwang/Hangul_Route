import { Screen, Spacer } from '@hangul-route/design-system';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { localizedGloss, topicItems, vocabItem } from '../content/vocab';
import { useLocale, useMessages } from '../i18n/use-messages';
import { resolvePicture } from '../logic/picture-ref';
import type { VocabFormat } from '../logic/vocab/format-for';
import { nudgeFor } from '../logic/vocab/nudges';
import { buildQuestions } from '../logic/vocab/question-builder';
import type { QuestionFlowMode } from '../logic/vocab/question-flow';
import { addTelemetryListener, type TelemetryEvent } from '../platform/telemetry';
import { activeProfileSelector, useProfileStore } from '../store/profile-store';
import { useProgressStore } from '../store/progress-store';
import type { MinigameHost } from '../screens/minigames/host';
import { PICTURE_CONTEXT } from '../screens/minigames/PictureArt';
import { VocabQuestionView, type VocabQuestionHoya } from '../screens/vocab/VocabQuestionView';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to the shared vocabulary question view (F-VOC-004 S-4b),
 * for fixture builds only (the same switch as `story-e2e.tsx`: only the e2e
 * bundle has story fixture ids, so a real build never registers this screen or
 * installs the hook). No learner screen hosts the view until the Speed Round
 * (S-5) and the quick check (F-VOC-003 C-5) ship, so its e2e opens it here
 * through `window.__hrVocabE2E.openQuestion(...)`, on real catalogue words.
 *
 * The Words picker and topic page (F-VOC-003 C-4) are reachable in a learner
 * build only with `flags.vocabTopicsEnabled`, which stays off until C-7; their
 * e2e opens them with `openTopics()` / `openTopic(key)` and collects words with
 * `collect(ids)` (the `introduced` event the flashcards will write, C-5).
 */

export interface VocabQuestionE2eParams {
  format: VocabFormat;
  mode: QuestionFlowMode;
  /** Default 4; 3 is the Pictures-first count. */
  optionCount?: 3 | 4;
  romanizationShown?: boolean;
  canPlay?: boolean;
  /** Show the homonym topic chip on the prompt. */
  topicChip?: boolean;
  /** The session's hint ring. */
  ring?: boolean;
}

export interface VocabE2eHandle {
  openQuestion(params: VocabQuestionE2eParams): void;
  /** The Words picker (`VocabTopics`). */
  openTopics(): void;
  /** A Words topic page (`VocabTopic`). */
  openTopic(topicKey: string): void;
  /** The Speed Round start sheet of a topic (`VocabSpeedRound`), also when the topic page would not offer it. */
  openSpeed(topicKey: string): void;
  /** Marks these words collected for the active learner (`recordVocab` `introduced`); false without a learner. */
  collect(ids: readonly string[]): boolean;
  /**
   * Every `host.answer` call since the screen opened, how many reveal beats ended, and how long each beat
   * lasted (ms from the last accepted tap to `onAdvance`).
   */
  log(): Log;
  /** `audio.*` and `vocab.*` telemetry events `track()` accepted since the hook mounted (the e2e build sends none). */
  events(): TelemetryEvent[];
}

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  firstTaps: string[];
  advances: number;
  answerId: string | null;
  beats: number[];
}

const log: Log = { answers: [], firstTaps: [], advances: 0, answerId: null, beats: [] };
let lastAnswerAt = 0;

/** The box that makes the builder choose each format (F-VOC-004 §3.2: 0-1 word, 2 sound, 3+ picture to word). */
const BOX_FOR: Record<VocabFormat, number> = { 'word-to-image': 0, 'audio-to-image': 2, 'image-to-word': 3 };

/** The topic the fixture questions come from: a reviewed one with WordArt pictures. */
const FIXTURE_TOPIC = 'food';

export function VocabE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrVocabE2E?: VocabE2eHandle };
    const events: TelemetryEvent[] = [];
    const stopListening = addTelemetryListener((e) => {
      if (e.name.startsWith('audio.') || e.name.startsWith('vocab.')) events.push(e);
    });
    g.__hrVocabE2E = {
      openQuestion: (params) => navigation.dispatch(StackActions.push('VocabQuestionE2e', params)),
      openTopics: () => navigation.dispatch(StackActions.push('VocabTopics')),
      openTopic: (topicKey) => navigation.dispatch(StackActions.push('VocabTopic', { topicKey })),
      openSpeed: (topicKey) => navigation.dispatch(StackActions.push('VocabSpeedRound', { topicKey })),
      collect: (ids) => {
        const profileId = activeProfileSelector(useProfileStore.getState())?.id;
        if (profileId === undefined) return false;
        useProgressStore.getState().recordVocab(
          profileId,
          ids.map((id) => ({ type: 'introduced', id })),
        );
        return true;
      },
      log: () => ({
        answers: log.answers.map((a) => ({ ...a })),
        firstTaps: [...log.firstTaps],
        advances: log.advances,
        answerId: log.answerId,
        beats: [...log.beats],
      }),
      events: () => events.map((e) => ({ ...e })),
    };
    return () => {
      stopListening();
      delete g.__hrVocabE2E;
    };
  }, [navigation]);
  return null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'VocabQuestionE2e'>;

export function VocabQuestionE2eScreen({ route }: Props): React.ReactElement {
  const { format, mode, optionCount = 4, romanizationShown = true, canPlay = true, topicChip = false, ring = false } = route.params;
  const m = useMessages();
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [hoya, setHoya] = useState<VocabQuestionHoya | null>(null);

  const questions = useMemo(() => {
    const items = topicItems(FIXTURE_TOPIC);
    return buildQuestions({
      pool: items,
      universe: items,
      count: items.length,
      optionCount,
      levelOrder: 1,
      boxOf: () => BOX_FOR[format],
      seed: 7,
      canRender: (ref) => resolvePicture(ref, PICTURE_CONTEXT).kind !== 'text',
      canPlay: format === 'audio-to-image' ? true : canPlay,
    })
      .filter((q) => q.format === format)
      .map((q) => (topicChip ? { ...q, topicChip: FIXTURE_TOPIC } : q));
  }, [format, optionCount, canPlay, topicChip]);

  const question = questions[index % Math.max(questions.length, 1)];
  useEffect(() => {
    log.answerId = question?.answerId ?? null;
  }, [question]);
  useEffect(() => {
    log.answers = [];
    log.firstTaps = [];
    log.advances = 0;
    log.beats = [];
  }, [route.params]);

  const host: MinigameHost = {
    mode: 'vocab',
    answer: (key, correct, meta) => {
      lastAnswerAt = Date.now();
      log.answers.push({ key: String(key), correct, ...(meta?.itemId === undefined ? {} : { itemId: meta.itemId }) });
      if (!question || mode !== 'speed') return;
      const item = vocabItem(question.itemId);
      const gloss = item ? localizedGloss(item, locale) : '';
      const nudge = nudgeFor({ kind: correct ? 'right' : 'miss', gloss }, correct ? 1 : 0, log.answers.length, m.learner.vocab.speed);
      setHoya({ tone: nudge.pose, message: nudge.line });
    },
    complete: () => undefined,
  };

  return (
    <Screen tone="canvas" scrollable>
      <Spacer size="lg" />
      {question ? (
        <VocabQuestionView
          question={question}
          mode={mode}
          host={host}
          canPlay={canPlay}
          romanizationShown={romanizationShown}
          ring={ring}
          hoya={hoya}
          onAnswer={(optionId) => log.firstTaps.push(optionId)}
          onAdvance={() => {
            log.advances += 1;
            log.beats.push(Date.now() - lastAnswerAt);
            setHoya(null);
            setIndex((i) => i + 1);
          }}
        />
      ) : null}
    </Screen>
  );
}
