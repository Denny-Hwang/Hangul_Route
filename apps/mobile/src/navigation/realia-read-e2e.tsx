import type { RomanizationMode } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { LessonWaiting } from '../screens/lesson-content';
import { addTelemetryListener, type TelemetryEvent } from '../platform/telemetry';
import type { HostMode } from '../screens/minigames/host';
import type { RealiaFixtureKey } from './realia-read-e2e-fixture';
import type { RealiaKindFixtureKey } from './realia-kinds-e2e-fixture';
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

/** What the e2e host saw since the screen opened (the screen module, `./realia-read-e2e-screen.tsx`, writes it). */
export const e2eLog: { answers: Array<{ key: string; correct: boolean }>; completed: number } = { answers: [], completed: 0 };
const log = e2eLog;

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

type Body = typeof import('./realia-read-e2e-screen');
type Props = NativeStackScreenProps<RootStackParamList, 'RealiaReadE2e'>;

/**
 * The screen itself (its game host and the fixtures of every kind) is a chunk of its own (`./realia-read-e2e-screen.tsx`),
 * reached only through the literal `import()` below, so a release start bundle carries only this hook (row CM-47).
 */
export function RealiaReadE2eScreen(props: Props): ReactElement {
  const [body, setBody] = useState<Body | null>(null);
  useEffect(() => {
    void import('./realia-read-e2e-screen').then(setBody);
  }, []);
  if (body === null) return <LessonWaiting />;
  const { RealiaReadE2eBody } = body;
  return <RealiaReadE2eBody {...props} />;
}
