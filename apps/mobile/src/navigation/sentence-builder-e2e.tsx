import { OrderItRoundSchema, type OrderItRound } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { useLocale } from '../i18n/use-messages';
import { localizeScope } from '../logic/content-locale';
import type { MinigameScope } from '../logic/minigame-config';
import type { HostMode, MinigameHost } from '../screens/minigames/host';
import { SentenceBuilderGame } from '../screens/minigames/SentenceBuilderGame';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Sentence Builder (F-CURR-001 G-1), for fixture builds only (the same switch
 * as `story-e2e.tsx`: only the e2e bundle has story fixture ids, so a real build never registers
 * this screen or installs the hook). No shipped lesson cell plays `order-it` until the Stage 3
 * cells (S3-1 on), so the e2e opens the game here, through `window.__hrSentenceE2E.open(...)`, on
 * the sample sentences of the D-1 mock (F-CURR-001 §3.4, §3.7), as a practice step or as the
 * two-question Stage 7 Check.
 */

export type SentenceE2eSet = 'practice' | 'check';

export interface SentenceE2eParams {
  set: SentenceE2eSet;
  mode: Extract<HostMode, 'quest' | 'check'>;
}

export interface SentenceE2eLog {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  completes: number;
}

export interface SentenceE2eHandle {
  open(params: SentenceE2eParams): void;
  /** Every `host.answer` and `host.complete` call since the screen opened. */
  log(): SentenceE2eLog;
}

const parse = (round: unknown): OrderItRound => OrderItRoundSchema.parse(round);

/** Stage 3 practice: an order round with one extra tile, a particle round, a three-word round. */
const PRACTICE: readonly OrderItRound[] = [
  parse({
    id: 'e2e-eat-rice',
    sentence: { ko: '밥을 먹어요.', romanization: 'babeul meogeoyo', en: 'I eat rice.' },
    pictureRef: 'card:rice',
    distractors: [{ ko: '물을', romanization: 'mureul', en: 'water' }],
  }),
  parse({
    id: 'e2e-book-i',
    sentence: { ko: '책이 있어요.', romanization: 'chaegi isseoyo', en: 'There is a book.' },
    pictureRef: 'card:book',
    particle: {
      tile: 0,
      choices: [
        { ko: '이', romanization: 'i', en: 'subject marker' },
        { ko: '가', romanization: 'ga', en: 'subject marker' },
      ],
    },
  }),
  parse({
    id: 'e2e-school',
    sentence: { ko: '저는 학교에 가요.', romanization: 'jeoneun hakgyoe gayo', en: 'I go to school.' },
  }),
];

/** The Stage 7 Check: exactly two rounds, no extra tile. */
const CHECK: readonly OrderItRound[] = [
  parse({
    id: 'e2e-like-tteokguk',
    sentence: { ko: '저는 떡국을 좋아해요.', romanization: 'jeoneun tteokgugeul joahaeyo', en: 'I like tteokguk.' },
  }),
  parse({
    id: 'e2e-drink-milk',
    sentence: { ko: '우유를 마셔요.', romanization: 'uyureul masyeoyo', en: 'I drink milk.' },
  }),
];

/** The Discover note a Stage 3 particle quest would carry (shown again under a particle miss). */
const PATTERN_NOTE = 'Use {ko:이} after a final consonant, {ko:가} after a vowel.';

const log: SentenceE2eLog = { answers: [], completes: 0 };

export function SentenceE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrSentenceE2E?: SentenceE2eHandle };
    g.__hrSentenceE2E = {
      open: (params) => navigation.dispatch(StackActions.push('SentenceBuilderE2e', params)),
      log: () => ({ answers: log.answers.map((a) => ({ ...a })), completes: log.completes }),
    };
    return () => {
      delete g.__hrSentenceE2E;
    };
  }, [navigation]);
  return null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'SentenceBuilderE2e'>;

export function SentenceBuilderE2eScreen({ route }: Props): React.ReactElement {
  const { set, mode } = route.params;
  const locale = useLocale();
  const scope = useMemo<MinigameScope>(() => {
    const rounds = set === 'check' ? CHECK : PRACTICE;
    return localizeScope({ kind: 'order-it', rounds: rounds.length, orderIt: { rounds: [...rounds] } }, 'minigame:e2e-sentence-builder', locale);
  }, [set, locale]);
  useEffect(() => {
    log.answers = [];
    log.completes = 0;
  }, [route.params]);
  const host: MinigameHost = {
    mode,
    answer: (key, correct, meta) => log.answers.push({ key: String(key), correct, ...(meta?.itemId === undefined ? {} : { itemId: meta.itemId }) }),
    complete: () => {
      log.completes += 1;
    },
  };
  return <SentenceBuilderGame key={`${set}-${mode}`} scope={scope} host={host} patternNote={PATTERN_NOTE} />;
}
