import { StackActions, useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import { CLOZE_FIXTURE_ROUNDS, clozeFixtureScope, type ClozeFixture } from '../logic/cloze-pick/e2e-rounds';
import { addTelemetryListener, track, type TelemetryEvent } from '../platform/telemetry';
import type { ClozePickRendered } from '../screens/minigames/cloze-pick-entry';
import { ClozePickStepBody } from '../screens/minigames/cloze-pick-step';
import type { MinigameHost } from '../screens/minigames/host';
import { useCurrFlagDecided } from '../store/remote-config-store';

/**
 * End-to-end entry to a Cloze Pick step (F-CURR-002 row CM-30), for fixture builds only (the switch of
 * `story-e2e.tsx`: only the e2e bundle has story fixture ids, so a real build never registers this screen or installs
 * the hook). No shipped cell plays `cloze-pick` until the re-authoring rows (CM-3A), so its e2e opens a step here,
 * through `window.__hrClozePickE2E.open(...)`, on the fixture rounds of `logic/cloze-pick/e2e-rounds.ts`, with a host
 * that records what the quest host would receive. The step is the real one: the game while `game.cloze-pick` is on,
 * its Listen & Pick fallback while it is off. This module is in the Cloze Pick chunk; the start bundle's door
 * (`screens/minigames/cloze-pick-entry.tsx`) draws it, so a release build carries none of it.
 */

export interface ClozePickE2eParams {
  /** Which fixture rounds to play, in order (`CLOZE_FIXTURE_ROUNDS` keys). */
  rounds: readonly string[];
}

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  completes: number;
  /** The game the step drew: `cloze-pick`, or `listen-pick` (its fallback). */
  rendered: ClozePickRendered | null;
}

export interface ClozePickE2eHandle {
  open(params: ClozePickE2eParams): void;
  log(): Log;
  /** Every telemetry event `track()` accepted since the hook mounted (the e2e build sends none). */
  events(): TelemetryEvent[];
}

const log: Log = { answers: [], completes: 0, rendered: null };

export function ClozePickE2eHookBody(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrClozePickE2E?: ClozePickE2eHandle };
    const events: TelemetryEvent[] = [];
    const stopListening = addTelemetryListener((e) => events.push(e));
    g.__hrClozePickE2E = {
      open: (params) => {
        Object.assign(log, { answers: [], completes: 0, rendered: null });
        navigation.dispatch(StackActions.push('ClozePickE2e', params));
      },
      log: () => ({ answers: log.answers.map((a) => ({ ...a })), completes: log.completes, rendered: log.rendered }),
      events: () => events.map((e) => ({ ...e })),
    };
    return () => {
      stopListening();
      delete g.__hrClozePickE2E;
    };
  }, [navigation]);
  return null;
}

/** The step on the fixture rounds; on complete it sends `minigame.finished` as `MinigameScreen.close` does. */
export function ClozePickE2eBody({ rounds, onBack }: { rounds: readonly string[]; onBack: () => void }): ReactElement {
  const scope = useMemo(() => clozeFixtureScope(rounds.filter((k): k is ClozeFixture => k in CLOZE_FIXTURE_ROUNDS)), [rounds]);
  const on = useRef<boolean | null>(null);
  const now = useCurrFlagDecided('game.cloze-pick');
  if (on.current === null && now !== null) on.current = now;
  const kind = useRef<ClozePickRendered>('cloze-pick');
  const host: MinigameHost = {
    mode: 'quest',
    answer: (key, correct, meta) => {
      log.answers.push({ key: String(key), correct, ...(meta?.itemId === undefined ? {} : { itemId: meta.itemId }) });
    },
    complete: () => {
      log.completes += 1;
      void track({ name: 'minigame.finished', payload: { kind: kind.current, questId: 'e2e-cloze-pick', stepIndex: 0 } });
    },
  };
  const rendered = (k: ClozePickRendered): void => {
    kind.current = k;
    log.rendered = k;
  };
  return <ClozePickStepBody scope={scope} host={host} onBack={onBack} on={on.current ?? false} onRendered={rendered} />;
}
