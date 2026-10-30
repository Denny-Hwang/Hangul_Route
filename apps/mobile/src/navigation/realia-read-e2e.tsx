import type { RomanizationMode } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { RomanizationModeOverride } from '../i18n/use-romanization-mode';
import { LessonWaiting } from '../screens/lesson-content';
import { minigameFinishedEvent } from '../logic/minigame-finished';
import { addTelemetryListener, track, type TelemetryEvent } from '../platform/telemetry';
import type { HostMode, MinigameHost } from '../screens/minigames/host';
import { RealiaReadGame } from '../screens/minigames/RealiaReadGame';
import { REALIA_FIXTURES, type RealiaFixtureKey } from './realia-read-e2e-fixture';
import type { RealiaKindFixtureKey } from './realia-kinds-e2e-fixture';
import type { MinigameScope } from '../logic/minigame-config';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Realia Read (F-CURR-001 row G-2), for fixture builds only (the same switch
 * as `story-e2e.tsx`: only the e2e bundle has story fixture ids, so a real build never registers
 * this screen or installs the hook). No lesson cell plays Realia Read until S6-1 .. S6-5 ship, so
 * its e2e opens the game on the four D-2 realia through `window.__hrRealiaE2E.open(...)`.
 */

export interface RealiaReadE2eParams {
  /** A G-2 fixture, or one of the CM-47 kinds' (`realia-kinds-e2e-fixture.ts`, loaded on demand). */
  fixture: RealiaFixtureKey | RealiaKindFixtureKey;
  mode?: HostMode;
  romanization?: RomanizationMode;
}

export interface RealiaE2eHandle {
  open(params: RealiaReadE2eParams): void;
  /** Every `host.answer` call since the screen opened, and how often `complete` ran. */
  log(): { answers: Array<{ key: string; correct: boolean }>; completed: number };
  /** Every telemetry event `track()` accepted since the hook mounted. */
  events(): TelemetryEvent[];
}

/** The quest id the e2e host reports in `minigame.finished` (no lesson cell plays Realia Read yet). */
const E2E_QUEST_ID = 'quest:stage6-e2e-realia-read';

const log: { answers: Array<{ key: string; correct: boolean }>; completed: number } = { answers: [], completed: 0 };

export function RealiaE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrRealiaE2E?: RealiaE2eHandle };
    const events: TelemetryEvent[] = [];
    const stopListening = addTelemetryListener((e) => {
      events.push(e);
    });
    g.__hrRealiaE2E = {
      open: (params) => navigation.dispatch(StackActions.push('RealiaReadE2e', params)),
      log: () => ({ answers: log.answers.map((a) => ({ ...a })), completed: log.completed }),
      events: () => events.map((e) => ({ ...e })),
    };
    return () => {
      stopListening();
      delete g.__hrRealiaE2E;
    };
  }, [navigation]);
  return null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'RealiaReadE2e'>;

/** The scope of a fixture: a G-2 one at once, a CM-47 one once its module is in (null before). */
function useFixture(fixture: RealiaReadE2eParams['fixture']): MinigameScope | null {
  const g2 = Object.prototype.hasOwnProperty.call(REALIA_FIXTURES, fixture) ? REALIA_FIXTURES[fixture as RealiaFixtureKey] : null;
  const [added, setAdded] = useState<MinigameScope | null>(null);
  useEffect(() => {
    if (g2) return;
    let live = true;
    void import('./realia-kinds-e2e-fixture').then((m) => live && setAdded(m.REALIA_KIND_FIXTURES[fixture as RealiaKindFixtureKey]));
    return () => {
      live = false;
    };
  }, [g2, fixture]);
  return g2 ?? added;
}

export function RealiaReadE2eScreen({ route, navigation }: Props): ReactElement {
  const { fixture, mode = 'quest', romanization = 'always' } = route.params;
  const scope = useFixture(fixture);
  useEffect(() => {
    log.answers = [];
    log.completed = 0;
  }, [route.params]);
  const host: MinigameHost = {
    mode,
    answer: (key, correct) => log.answers.push({ key: String(key), correct }),
    complete: () => {
      log.completed += 1;
      // The event MinigameScreen sends when a lesson step of this game closes, so the e2e checks its payload.
      void track(minigameFinishedEvent('realia-read', E2E_QUEST_ID, 0));
    },
  };
  if (scope === null) return <LessonWaiting />;
  return (
    <RomanizationModeOverride mode={romanization}>
      <RealiaReadGame scope={scope} host={host} onBack={() => navigation.goBack()} />
    </RomanizationModeOverride>
  );
}
