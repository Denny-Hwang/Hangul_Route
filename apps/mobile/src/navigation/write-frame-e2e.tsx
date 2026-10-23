import type { MyStoryFrame, WriteFrameRound } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { playedScope } from '../logic/game-fallback';
import type { MinigameScope } from '../logic/minigame-config';
import { minigameFinishedEvent } from '../logic/minigame-finished';
import { FIXTURE_ROUNDS, type WriteFrameFixture } from '../logic/write-frame/e2e-rounds';
import { addTelemetryListener, track, type TelemetryEvent } from '../platform/telemetry';
import type { HostMode, MinigameHost } from '../screens/minigames/host';
import { loadMyStoryChunk, MyStoryRoute } from '../screens/minigames/my-story-entry';
import { WriteFrameGame } from '../screens/minigames/WriteFrameGame';
import { LessonWaiting } from '../screens/lesson-content';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Write Frame (F-CURR-001 G-5), for fixture builds only (the switch of
 * `story-e2e.tsx`: only the e2e bundle has story fixture ids, so a real build never registers
 * this screen or installs the hook). No shipped lesson cell plays `write-frame` until Stage 7
 * (S7-*), so its e2e opens the game here through `window.__hrWriteFrameE2E.open(...)` on the
 * fixture rounds, with a host that records what the quest host would receive. The params name
 * fixture rounds only, never what a learner writes. With `story` it plays My Story's fixture chain
 * instead (F-CURR-002 row CM-38), so My Story needs no hook or route of its own in every bundle.
 */

export interface WriteFrameE2eParams {
  /** Which fixture rounds to play, in order. */
  rounds: readonly WriteFrameFixture[];
  /** `preview` plays as the All lessons preview does: the quest host, with the name round opening on the cast name. */
  mode?: Extract<HostMode, 'quest' | 'preview'>;
  /**
   * F-CURR-002 row CM-38: play My Story's fixture chain instead of `rounds`, through the switch and fallback of
   * MinigameScreen (`playedScope`) with `game.my-story` on or off, and the game's own chunk (which holds the chain);
   * `long` plays the 5-frame chain with the switch on.
   */
  story?: 'on' | 'off' | 'long';
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

export function WriteFrameE2eScreen({ route, navigation }: Props): ReactElement {
  const { story } = route.params;
  const [chain, setChain] = useState<readonly MyStoryFrame[] | null>(null);
  useEffect(() => {
    if (story !== undefined) void loadMyStoryChunk().then((c) => setChain(story === 'long' ? c.FIXTURE_CHAIN_LONG : c.FIXTURE_CHAIN));
  }, [story]);
  const scope = useMemo<MinigameScope | null>(() => {
    if (story !== undefined) {
      return chain === null ? null : playedScope({ kind: 'my-story', rounds: chain.length, myStory: { frames: [...chain] } }, () => story !== 'off');
    }
    const rounds = route.params.rounds.map((key) => FIXTURE_ROUNDS[key] as WriteFrameRound);
    return { kind: 'write-frame', rounds: rounds.length, writeFrame: { rounds } };
  }, [route.params, story, chain]);
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
      // What the quest host sends when the game closes (MinigameScreen.close): ids and the kind played only.
      void track(minigameFinishedEvent(scope?.kind ?? 'write-frame', story === undefined ? 'e2e-write-frame' : 'e2e-my-story', 0));
      navigation.goBack();
    },
  };

  if (scope === null) return <LessonWaiting />;
  if (scope.kind === 'my-story') return <MyStoryRoute key={route.key} scope={scope} host={host} onBack={() => navigation.goBack()} />;
  return <WriteFrameGame key={route.key} scope={scope} host={host} onBack={() => navigation.goBack()} inPreview={route.params.mode === 'preview'} />;
}
