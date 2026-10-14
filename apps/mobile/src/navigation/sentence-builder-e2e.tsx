import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { RomanizationModeOverride } from '../i18n/use-romanization-mode';
import { useLocale } from '../i18n/use-messages';
import { localizeScope } from '../logic/content-locale';
import type { MinigameScope } from '../logic/minigame-config';
import type { HostMode, MinigameHost } from '../screens/minigames/host';
import { SentenceBuilderGame } from '../screens/minigames/SentenceBuilderGame';
import { CHECK, PATTERN_NOTE, PRACTICE } from './sentence-builder-e2e-fixtures';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Sentence Builder (F-CURR-001 G-1), for fixture builds only (the same switch
 * as `story-e2e.tsx`: only the e2e bundle has story fixture ids, so a real build never registers
 * this screen or installs the hook). No shipped lesson cell plays `order-it` until the Stage 3
 * cells (S3-1 on), so the e2e opens the game here, through `window.__hrSentenceE2E.open(...)`, on
 * the sample sentences of the D-1 mock (F-CURR-001 §3.4, §3.7), as a practice step or as the
 * two-question Stage 7 Check.
 */

/** `empty`: a scope with no playable round (the empty state and its way back). */
export type SentenceE2eSet = 'practice' | 'check' | 'empty';

export interface SentenceE2eParams {
  set: SentenceE2eSet;
  mode: Extract<HostMode, 'quest' | 'check'>;
  /** `tap`: the reading-practice setting (no romanization line on the tiles). Default: the profile's mode. */
  romanization?: 'tap';
}

export interface SentenceE2eLog {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  completes: number;
  /** Presses of the empty state's way back. */
  backs: number;
}

export interface SentenceE2eHandle {
  open(params: SentenceE2eParams): void;
  /** Every `host.answer` and `host.complete` call since the screen opened. */
  log(): SentenceE2eLog;
}

const log: SentenceE2eLog = { answers: [], completes: 0, backs: 0 };

export function SentenceE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrSentenceE2E?: SentenceE2eHandle };
    g.__hrSentenceE2E = {
      open: (params) => navigation.dispatch(StackActions.push('SentenceBuilderE2e', params)),
      log: () => ({ answers: log.answers.map((a) => ({ ...a })), completes: log.completes, backs: log.backs }),
    };
    return () => {
      delete g.__hrSentenceE2E;
    };
  }, [navigation]);
  return null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'SentenceBuilderE2e'>;

export function SentenceBuilderE2eScreen({ route }: Props): React.ReactElement {
  const { set, mode, romanization } = route.params;
  const locale = useLocale();
  const scope = useMemo<MinigameScope>(() => {
    const rounds = set === 'check' ? CHECK : set === 'empty' ? [] : PRACTICE;
    return localizeScope({ kind: 'order-it', rounds: rounds.length, orderIt: { rounds: [...rounds] } }, 'minigame:e2e-sentence-builder', locale);
  }, [set, locale]);
  useEffect(() => {
    log.answers = [];
    log.completes = 0;
    log.backs = 0;
  }, [route.params]);
  const host: MinigameHost = {
    mode,
    answer: (key, correct, meta) => log.answers.push({ key: String(key), correct, ...(meta?.itemId === undefined ? {} : { itemId: meta.itemId }) }),
    complete: () => {
      log.completes += 1;
    },
  };
  const game = (
    <SentenceBuilderGame
      key={`${set}-${mode}-${romanization ?? 'profile'}`}
      scope={scope}
      host={host}
      patternNote={PATTERN_NOTE}
      onBack={() => {
        log.backs += 1;
      }}
    />
  );
  return romanization === 'tap' ? <RomanizationModeOverride mode="tap">{game}</RomanizationModeOverride> : game;
}
