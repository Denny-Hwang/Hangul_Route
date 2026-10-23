import type { HiddenHeritageScene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { picWordFallback } from '../../logic/hidden-heritage-fallback';
import type { MinigameScope } from '../../logic/minigame-config';
import { currFlagOn } from '../../store/remote-config-store';
import { LessonWaiting } from '../lesson-content';
import { loadHiddenHeritageChunk, loadScene } from './hidden-heritage-scenes';
import type { MinigameHost } from './host';
import { PicWordMatchGame } from './PicWordMatchGame';

/*
 * The start bundle's door to Hidden Heritage (F-CURR-002 §7.1 F7, §10 and §12.2, row CM-36): the game is a chunk of its
 * own (`./hidden-heritage-chunk.tsx`, marker `screen-chunk:hidden-heritage`) and each scene another, all reached only
 * through the literal `import()`s of `./hidden-heritage-scenes.ts`. While `game.hidden-heritage` is off (its
 * built-in pct is 0, so the row merges dark), and whenever the game or a scene cannot load, the step plays Pic-Word Match
 * on the same targets, so every quest is playable. The switch is read once when the step opens, so a remote copy that
 * arrives mid-step never swaps the game under the learner.
 */

type Chunk = typeof import('./hidden-heritage-chunk');

type Loaded = { game: Chunk; scenes: ReadonlyMap<string, HiddenHeritageScene> } | 'fallback' | null;

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  onBack?: () => void;
}

export function HiddenHeritageStep({ scope, host, onBack }: Props): ReactElement {
  const [on] = useState(() => currFlagOn('game.hidden-heritage'));
  const fallbackScope = useMemo(() => picWordFallback(scope), [scope]);
  const sceneIds = useMemo(() => [...new Set((scope.hiddenHeritage?.rounds ?? []).map((r) => r.sceneId))], [scope]);
  const [loaded, setLoaded] = useState<Loaded>(on ? null : 'fallback');
  useEffect(() => {
    if (!on) return undefined;
    let live = true;
    void Promise.all([loadHiddenHeritageChunk(), Promise.all(sceneIds.map(loadScene))]).then(
      ([game, scenes]) => {
        if (!live) return;
        const map = new Map<string, HiddenHeritageScene>();
        scenes.forEach((s) => s && map.set(s.id, s));
        setLoaded(map.size === sceneIds.length ? { game, scenes: map } : 'fallback');
      },
      () => live && setLoaded('fallback'),
    );
    return () => {
      live = false;
    };
  }, [on, sceneIds]);

  if (loaded === 'fallback') return <PicWordMatchGame scope={fallbackScope} host={host} onBack={onBack} />;
  if (loaded === null) return <LessonWaiting />;
  const { HiddenHeritageGame } = loaded.game;
  return <HiddenHeritageGame scope={scope} scenes={loaded.scenes} host={host} onBack={onBack} />;
}
