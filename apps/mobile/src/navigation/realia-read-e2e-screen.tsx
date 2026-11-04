import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, type ReactElement } from 'react';
import { RomanizationModeOverride } from '../i18n/use-romanization-mode';
import type { MinigameScope } from '../logic/minigame-config';
import { minigameFinishedEvent } from '../logic/minigame-finished';
import { track } from '../platform/telemetry';
import type { MinigameHost } from '../screens/minigames/host';
import { RealiaReadGame } from '../screens/minigames/RealiaReadGame';
import { REALIA_KIND_FIXTURES } from './realia-kinds-e2e-fixture';
import { REALIA_FIXTURES } from './realia-read-e2e-fixture';
import { e2eLog as log } from './realia-read-e2e';
import type { RootStackParamList } from './types';

/**
 * The Realia Read e2e screen (F-CURR-001 row G-2; fixture builds only), loaded by `./realia-read-e2e.tsx` through its
 * literal `import()`, so a release start bundle carries neither it nor its fixtures: the four D-2 realia and one per
 * CM-47 kind (F-CURR-002 row CM-47).
 */

/** The quest id the e2e host reports in `minigame.finished` (no lesson cell plays Realia Read yet). */
const E2E_QUEST_ID = 'quest:stage6-e2e-realia-read';

const SCOPES: Readonly<Record<string, MinigameScope>> = { ...REALIA_FIXTURES, ...REALIA_KIND_FIXTURES };

export function RealiaReadE2eBody({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'RealiaReadE2e'>): ReactElement {
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
      <RealiaReadGame scope={SCOPES[fixture]!} host={host} onBack={() => navigation.goBack()} />
    </RomanizationModeOverride>
  );
}
