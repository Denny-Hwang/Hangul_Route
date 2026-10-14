import type { TypeHangulRound } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import type { MinigameScope } from '../logic/minigame-config';
import { FIXTURE_ROUNDS } from '../logic/type-hangul/e2e-rounds';
import { addTelemetryListener, type TelemetryEvent } from '../platform/telemetry';
import type { MinigameHost } from '../screens/minigames/host';
import { TypeHangulGame } from '../screens/minigames/TypeHangulGame';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Type Hangul (F-CURR-001 G-3), for fixture builds only (the
 * switch of `story-e2e.tsx`: only the e2e bundle has story fixture ids, so a real
 * build never registers this screen or installs the hook). No shipped lesson cell
 * plays `type-hangul` until Stage 6 and 7 (S6-*, S7-*), so its e2e opens the game here
 * through `window.__hrTypeHangulE2E.open(...)` on the fixture rounds below, with a
 * host that records what the quest host would receive.
 */

export interface TypeHangulE2eParams {
  /** Which fixture rounds to play, in order. */
  rounds: ReadonlyArray<keyof typeof FIXTURE_ROUNDS>;
}

export interface TypeHangulE2eHandle {
  open(params: TypeHangulE2eParams): void;
  /** Every `host.answer` call and `host.complete` count since the screen opened. */
  log(): Log;
  /** Every telemetry event `track()` accepted since the hook mounted (the e2e build sends none). */
  events(): TelemetryEvent[];
}

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  completes: number;
}

const log: Log = { answers: [], completes: 0 };

export function TypeHangulE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrTypeHangulE2E?: TypeHangulE2eHandle };
    const events: TelemetryEvent[] = [];
    const stopListening = addTelemetryListener((e) => events.push(e));
    g.__hrTypeHangulE2E = {
      open: (params) => navigation.dispatch(StackActions.push('TypeHangulE2e', params)),
      log: () => ({ answers: log.answers.map((a) => ({ ...a })), completes: log.completes }),
      events: () => events.map((e) => ({ ...e })),
    };
    return () => {
      stopListening();
      delete g.__hrTypeHangulE2E;
    };
  }, [navigation]);
  return null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'TypeHangulE2e'>;

export function TypeHangulE2eScreen({ route, navigation }: Props): React.ReactElement {
  const scope = useMemo<MinigameScope>(() => {
    const rounds = route.params.rounds.map((key) => FIXTURE_ROUNDS[key] as TypeHangulRound);
    return { kind: 'type-hangul', rounds: rounds.length, typeHangul: { rounds } };
  }, [route.params]);
  useEffect(() => {
    log.answers = [];
    log.completes = 0;
  }, [route.params]);

  const host: MinigameHost = {
    mode: 'quest',
    answer: (key, correct, meta) => {
      log.answers.push({ key: String(key), correct, ...(meta?.itemId === undefined ? {} : { itemId: meta.itemId }) });
    },
    complete: () => {
      log.completes += 1;
    },
  };

  return <TypeHangulGame key={route.key} scope={scope} host={host} onBack={() => navigation.goBack()} />;
}
