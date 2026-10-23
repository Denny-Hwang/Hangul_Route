import type { ListenPickRound, TypeHangulRound } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import type { MinigameScope } from '../logic/minigame-config';
import { FIXTURE_ROUNDS, FIXTURE_SPELLING_ROUNDS } from '../logic/type-hangul/e2e-rounds';
import { addTelemetryListener, track, type TelemetryEvent } from '../platform/telemetry';
import type { MinigameHost } from '../screens/minigames/host';
import { useSwitchedScope } from '../screens/minigames/dictation-entry';
import { ListenPickGame } from '../screens/minigames/ListenPickGame';
import { TypeHangulGame } from '../screens/minigames/TypeHangulGame';
import { LessonWaiting } from '../screens/lesson-content';
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
  /**
   * F-CURR-002 row CM-31: play these spelling rounds (Listen & Pick, `promptKind: 'spelling'`) instead. Both kinds go
   * through the step's `game.<kind>` switches and the dictation chunk, as a quest step does (`useSwitchedScope`).
   */
  spelling?: ReadonlyArray<keyof typeof FIXTURE_SPELLING_ROUNDS>;
}

export interface TypeHangulE2eHandle {
  open(params: TypeHangulE2eParams): void;
  /** Every `host.answer` call and `host.complete` count since the screen opened. */
  log(): Log;
  /**
   * Every telemetry event `track()` accepted since the hook mounted (the e2e build sends none). The host
   * below sends `minigame.finished` on complete, as `MinigameScreen.close` does, so test P-1 reads real events.
   */
  events(): TelemetryEvent[];
}

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string; hinted?: boolean }>;
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

export function TypeHangulE2eScreen({ route, navigation }: Props): ReactElement {
  const scope = useMemo<MinigameScope>(() => {
    if (route.params.spelling !== undefined) {
      const picks = route.params.spelling.map((key) => FIXTURE_SPELLING_ROUNDS[key] as unknown as ListenPickRound);
      return { kind: 'listen-pick', rounds: picks.length, listenPick: { rounds: picks } };
    }
    const rounds = route.params.rounds.map((key) => FIXTURE_ROUNDS[key] as TypeHangulRound);
    return { kind: 'type-hangul', rounds: rounds.length, typeHangul: { rounds } };
  }, [route.params]);
  const switched = useSwitchedScope(scope);
  useEffect(() => {
    log.answers = [];
    log.completes = 0;
  }, [route.params]);

  const host: MinigameHost = {
    mode: 'quest',
    answer: (key, correct, meta) => {
      log.answers.push({ key: String(key), correct, ...(meta?.itemId === undefined ? {} : { itemId: meta.itemId }), ...(meta?.hinted ? { hinted: true } : {}) });
    },
    complete: () => {
      log.completes += 1;
      // What the quest host sends when the game closes (MinigameScreen.close): ids and the kind only.
      void track({ name: 'minigame.finished', payload: { kind: 'type-hangul', questId: 'e2e-type-hangul', stepIndex: 0 } });
    },
  };

  if (switched.kind === 'loading') return <LessonWaiting />;
  if (switched.scope.kind === 'listen-pick') {
    return <ListenPickGame key={`${route.key}:${switched.kit === null ? 'plain' : 'kit'}`} scope={switched.scope} host={host} onBack={() => navigation.goBack()} spelling={switched.kit} />;
  }
  return <TypeHangulGame key={`${route.key}:${switched.kit === null ? 'plain' : 'kit'}`} scope={switched.scope} host={host} onBack={() => navigation.goBack()} hear={switched.kit} />;
}
