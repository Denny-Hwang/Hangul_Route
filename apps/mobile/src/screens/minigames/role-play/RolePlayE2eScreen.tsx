import type { RolePlayScene } from '@hangul-route/content-schema';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { minigameFinishedEvent } from '../../../logic/minigame-finished';
import { playedScope } from '../../../logic/role-play/fallback';
import { addTelemetryListener, track, type TelemetryEvent } from '../../../platform/telemetry';
import { useFrozenCurrFlag } from '../../../store/remote-config-store';
import { LessonWaiting } from '../../lesson-content';
import type { MinigameHost } from '../host';
import { TapRespondGame } from '../TapRespondGame';
import { RolePlayGame } from './RolePlayGame';

/**
 * The fixture build's Role Play host (row CM-35; `navigation/role-play-e2e.tsx` opens it). It decides `game.role-play`
 * as the quest screen does (read once the stored copy is in, then kept): on, the game; off, Tap to Respond on the same turns. It
 * records what the quest host would receive and the telemetry sent, on `window.__hrRolePlayE2E`. Only the fixture
 * build registers its route; in a real build the code sits unused in the chunk.
 */

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string; hinted?: boolean }>;
  completes: number;
}

export interface RolePlayE2eScreenProps {
  route: { key: string; params: { scene: RolePlayScene } };
  navigation: { goBack: () => void };
}

export function RolePlayE2eScreen({ route, navigation }: RolePlayE2eScreenProps): ReactElement {
  const on = useFrozenCurrFlag('game.role-play');
  const scope = useMemo(() => playedScope({ kind: 'role-play', rounds: 0, rolePlay: { scene: route.params.scene } }, on === true), [route.params, on]);
  const [log] = useState<Log>(() => ({ answers: [], completes: 0 }));
  useEffect(() => {
    const events: TelemetryEvent[] = [];
    const stopListening = addTelemetryListener((e) => events.push(e));
    const g = globalThis as { __hrRolePlayE2E?: object };
    g.__hrRolePlayE2E = {
      ...g.__hrRolePlayE2E,
      log: () => ({ answers: log.answers.map((a) => ({ ...a })), completes: log.completes }),
      events: () => events.map((e) => ({ ...e })),
    };
    return stopListening;
  }, [log]);
  const finish = (): void => {
    // What the quest host sends when the game closes (MinigameScreen.close): the kind shown and ids only, never the branch.
    void track(minigameFinishedEvent(scope.kind, 'e2e-role-play', 0));
    navigation.goBack();
  };
  if (on === null) return <LessonWaiting />;
  if (scope.kind === 'tap-respond') return <TapRespondGame key={route.key} scope={scope} onFinish={finish} />;
  const host: MinigameHost = {
    mode: 'quest',
    answer: (key, correct, meta) => {
      log.answers.push({ key: String(key), correct, ...(meta?.itemId === undefined ? {} : { itemId: meta.itemId }), ...(meta?.hinted ? { hinted: true } : {}) });
    },
    complete: () => {
      log.completes += 1;
      finish();
    },
  };
  return <RolePlayGame key={route.key} scope={scope} host={host} onBack={() => navigation.goBack()} />;
}
