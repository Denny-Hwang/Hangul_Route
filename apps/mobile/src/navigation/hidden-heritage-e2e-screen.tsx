import { HiddenHeritageRoundSchema } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import { useLocale } from '../i18n/use-messages';
import { RomanizationModeOverride } from '../i18n/use-romanization-mode';
import { CONTENT_OVERLAYS } from '../logic/content-locale';
import { localizeReferenceRound } from '../logic/hidden-heritage-reference';
import type { MinigameScope } from '../logic/minigame-config';
import { LessonWaiting } from '../screens/lesson-content';
import { HiddenHeritageStep } from '../screens/minigames/hidden-heritage-entry';
import { loadScene } from '../screens/minigames/hidden-heritage-scenes';
import type { MinigameHost } from '../screens/minigames/host';
import { e2eLog as log } from './hidden-heritage-e2e';
import type { RootStackParamList } from './types';

/**
 * The Hidden Heritage e2e screen (F-CURR-002 row CM-36; fixture builds only), loaded by `./hidden-heritage-e2e.tsx` through
 * its literal `import()`, so a release start bundle carries only the hook. Opens the step on the Food market scene's
 * reference round, read from the scene's own lazy chunk; `missing` names a scene this build does not have. `sceneId`
 * opens another scene's reference round (row CM-37), with its `scene:<id>` overlay (`content/i18n/{es,ko}/hidden-heritage.json`) in those UI languages.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'HiddenHeritageE2e'>;

export function HiddenHeritageE2eBody({ route, navigation }: Props): ReactElement {
  const missing = route.params.missing === true;
  const sceneId = route.params.sceneId ?? 'scene:food-market';
  const locale = useLocale();
  const [scope, setScope] = useState<MinigameScope | null>(null);
  useEffect(() => {
    let live = true;
    log.answers = [];
    log.completed = 0;
    void loadScene(sceneId).then((scene) => {
      if (!live || !scene) return;
      const parsed = HiddenHeritageRoundSchema.parse(missing ? { ...scene.round, sceneId: 'scene:not-in-this-build' } : scene.round);
      const round = localizeReferenceRound(scene.id, parsed, locale, CONTENT_OVERLAYS);
      setScope({ kind: 'hidden-heritage', rounds: round.targets.length, hiddenHeritage: { rounds: [round] } });
    });
    return () => {
      live = false;
    };
  }, [missing, sceneId, locale]);
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
