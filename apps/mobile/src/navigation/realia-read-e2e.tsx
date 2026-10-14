import type { RomanizationMode } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { RomanizationModeOverride } from '../i18n/use-romanization-mode';
import { minigameFinishedEvent } from '../logic/minigame-finished';
import { addTelemetryListener, track, type TelemetryEvent } from '../platform/telemetry';
import type { HostMode, MinigameHost } from '../screens/minigames/host';
import { RealiaReadGame } from '../screens/minigames/RealiaReadGame';
import { REALIA_FIXTURES, type RealiaFixtureKey } from './realia-read-e2e-fixture';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Realia Read (F-CURR-001 row G-2), for fixture builds only (the same switch
 * as `story-e2e.tsx`: only the e2e bundle has story fixture ids, so a real build never registers
 * this screen or installs the hook). No lesson cell plays Realia Read until S6-1 .. S6-5 ship, so
 * its e2e opens the game on the four D-2 realia through `window.__hrRealiaE2E.open(...)`.
 */

export interface RealiaReadE2eParams {
  fixture: RealiaFixtureKey;
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

export function RealiaReadE2eScreen({ route, navigation }: Props): React.ReactElement {
  const { fixture, mode = 'quest', romanization = 'always' } = route.params;
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
  return (
    <RomanizationModeOverride mode={romanization}>
      <RealiaReadGame scope={REALIA_FIXTURES[fixture]} host={host} onBack={() => navigation.goBack()} />
    </RomanizationModeOverride>
  );
}
