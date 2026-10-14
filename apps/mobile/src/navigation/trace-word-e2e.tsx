import type { KoText, TraceWordRound } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { strokesForJamo, type JamoStrokePoint } from '../content/jamo-strokes';
import type { MinigameScope } from '../logic/minigame-config';
import { placeWordStrokes } from '../logic/trace-word/block-strokes';
import type { MinigameHost } from '../screens/minigames/host';
import { TraceWordGame } from '../screens/minigames/TraceWordGame';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Trace a Word (F-CURR-001 row G-4), for fixture builds only (the same switch
 * as `story-e2e.tsx`: only the e2e bundle has story fixture ids, so a real build never registers
 * this screen or installs the hook). No lesson cell plays `trace-word` until the Stage 7 cells
 * (S7-*) ship, so its e2e opens the game here through `window.__hrTraceWordE2E.open(...)` with
 * the spec's Stage 7 words, and draws over the placed ghost that `blocks(word)` returns.
 */

export interface TraceWordE2eParams {
  rounds: Array<{ id: string; word: KoText; mode?: TraceWordRound['mode'] }>;
}

export interface TraceWordE2eHandle {
  open(params: TraceWordE2eParams): void;
  /** Each block of a word as the canvas draws it: every letter's placed strokes (200 viewBox), in writing order. */
  blocks(word: string): Array<{ syllable: string; letters: JamoStrokePoint[][][] }> | null;
  /** Every `host.answer` since the screen opened, and how many times the step completed. */
  log(): { answers: Array<{ key: string; correct: boolean }>; completed: number };
}

const log: { answers: Array<{ key: string; correct: boolean }>; completed: number } = { answers: [], completed: 0 };

export function TraceWordE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrTraceWordE2E?: TraceWordE2eHandle };
    g.__hrTraceWordE2E = {
      open: (params) => {
        log.answers = [];
        log.completed = 0;
        navigation.dispatch(StackActions.push('TraceWordE2e', params));
      },
      blocks: (word) =>
        placeWordStrokes(word, strokesForJamo)?.map((b) => ({ syllable: b.syllable, letters: b.letters.map((l) => l.strokes) })) ?? null,
      log: () => ({ answers: log.answers.map((a) => ({ ...a })), completed: log.completed }),
    };
    return () => {
      delete g.__hrTraceWordE2E;
    };
  }, [navigation]);
  return null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'TraceWordE2e'>;

export function TraceWordE2eScreen({ route, navigation }: Props): React.ReactElement {
  const scope = useMemo<MinigameScope>(
    () => ({ kind: 'trace-word', rounds: route.params.rounds.length, traceWord: { rounds: route.params.rounds } }),
    [route.params],
  );
  const host: MinigameHost = {
    mode: 'preview',
    answer: (key, correct) => {
      log.answers.push({ key: String(key), correct });
    },
    complete: () => {
      log.completed += 1;
    },
  };
  return <TraceWordGame scope={scope} host={host} onBack={() => navigation.goBack()} />;
}
