import { HiddenHeritageRoundSchema } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import { RomanizationModeOverride } from '../i18n/use-romanization-mode';
import type { MinigameScope } from '../logic/minigame-config';
import { LessonWaiting } from '../screens/lesson-content';
import { HiddenHeritageStep } from '../screens/minigames/hidden-heritage-entry';
import { loadScene } from '../screens/minigames/hidden-heritage-scenes';
import type { MinigameHost } from '../screens/minigames/host';
import { e2eLog as log } from './hidden-heritage-e2e';
import type { RootStackParamList } from './types';

/**
 * The Hidden Heritage e2e screen (F-CURR-002 row CM-36; fixture builds only), loaded by `./hidden-heritage-e2e.tsx` through
 * its literal `import()`, so a release start bundle carries only the hook. Opens the step on a scene's reference round
 * (`sceneId`, the Food market by default; row CM-37 adds the theme scenes), read from the scene's own lazy chunk;
 * `missing` names a scene this build does not have.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'HiddenHeritageE2e'>;

export function HiddenHeritageE2eBody({ route, navigation }: Props): ReactElement {
  const missing = route.params.missing === true;
  const sceneId = route.params.sceneId ?? 'scene:food-market';
  const [scope, setScope] = useState<MinigameScope | null>(null);
  useEffect(() => {
    log.answers = [];
    log.completed = 0;
    void loadScene(sceneId).then((scene) => {
      if (!scene) return;
      const round = HiddenHeritageRoundSchema.parse(missing ? { ...scene.round, sceneId: 'scene:not-in-this-build' } : scene.round);
      setScope({ kind: 'hidden-heritage', rounds: round.targets.length, hiddenHeritage: { rounds: [round] } });
    });
  }, [missing, sceneId]);
  const host: MinigameHost = {
    mode: 'quest',
    answer: (key, correct) => log.answers.push({ key: String(key), correct }),
    complete: () => {
      log.completed += 1;
    },
  };
  if (scope === null) return <LessonWaiting />;
  return (
    <RomanizationModeOverride mode="always">
      <HiddenHeritageStep scope={scope} host={host} onBack={() => navigation.goBack()} />
    </RomanizationModeOverride>
  );
}
