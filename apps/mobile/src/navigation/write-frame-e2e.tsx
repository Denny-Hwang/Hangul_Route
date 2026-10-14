import type { WriteFrameRound } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import type { MinigameScope } from '../logic/minigame-config';
import { minigameFinishedEvent } from '../logic/minigame-finished';
import { FIXTURE_ROUNDS, type WriteFrameFixture } from '../logic/write-frame/e2e-rounds';
import { addTelemetryListener, track, type TelemetryEvent } from '../platform/telemetry';
import type { HostMode, MinigameHost } from '../screens/minigames/host';
import { WriteFrameGame } from '../screens/minigames/WriteFrameGame';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Write Frame (F-CURR-001 G-5), for fixture builds only (the switch of
 * `story-e2e.tsx`: only the e2e bundle has story fixture ids, so a real build never registers
 * this screen or installs the hook). No shipped lesson cell plays `write-frame` until Stage 7
 * (S7-*), so its e2e opens the game here through `window.__hrWriteFrameE2E.open(...)` on the
 * fixture rounds, with a host that records what the quest host would receive. The params name
 * fixture rounds only, never what a learner writes.
 */

export interface WriteFrameE2eParams {
  /** Which fixture rounds to play, in order. */
  rounds: readonly WriteFrameFixture[];
  /** `preview` opens the name round on the cast name, as the grown-up preview does. */
  mode?: Extract<HostMode, 'quest' | 'preview'>;
}

export interface WriteFrameE2eHandle {
  open(params: WriteFrameE2eParams): void;
  /** Every `host.answer` call and `host.complete` count since the screen opened. */
  log(): Log;
  /** Every telemetry event `track()` accepted since the hook mounted (test P-1 reads them). */
  events(): TelemetryEvent[];
}

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  completes: number;
}

const log: Log = { answers: [], completes: 0 };

export function WriteFrameE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrWriteFrameE2E?: WriteFrameE2eHandle };
    const events: TelemetryEvent[] = [];
    const stopListening = addTelemetryListener((e) => events.push(e));
    g.__hrWriteFrameE2E = {
      open: (params) => navigation.dispatch(StackActions.push('WriteFrameE2e', params)),
      log: () => ({ answers: log.answers.map((a) => ({ ...a })), completes: log.completes }),
      events: () => events.map((e) => ({ ...e })),
    };
    return () => {
      stopListening();
      delete g.__hrWriteFrameE2E;
    };
  }, [navigation]);
  return null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'WriteFrameE2e'>;

export function WriteFrameE2eScreen({ route, navigation }: Props): React.ReactElement {
  const scope = useMemo<MinigameScope>(() => {
    const rounds = route.params.rounds.map((key) => FIXTURE_ROUNDS[key] as WriteFrameRound);
    return { kind: 'write-frame', rounds: rounds.length, writeFrame: { rounds } };
  }, [route.params]);
  useEffect(() => {
    log.answers = [];
    log.completes = 0;
  }, [route.params]);

  const host: MinigameHost = {
    mode: route.params.mode ?? 'quest',
    answer: (key, correct, meta) => {
      log.answers.push({ key: String(key), correct, ...(meta?.itemId === undefined ? {} : { itemId: meta.itemId }) });
    },
    complete: () => {
      log.completes += 1;
      // What the quest host sends when the game closes (MinigameScreen.close): ids and the kind only.
      void track(minigameFinishedEvent('write-frame', 'e2e-write-frame', 0));
      navigation.goBack();
    },
  };

  return <WriteFrameGame key={route.key} scope={scope} host={host} onBack={() => navigation.goBack()} />;
}
