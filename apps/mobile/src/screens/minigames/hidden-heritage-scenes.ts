import type { HiddenHeritageScene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';

/**
 * The Hidden Heritage scenes (F-CURR-002 §7.1 F7 and §10, rows CM-36 and CM-37): one lazy, precached chunk per scene,
 * each reached only through its literal `import()` below, so neither the start bundle nor the game's own chunk carries a
 * scene. A scene this build does not have, or a chunk that does not load (offline before the first open, a broken
 * cache), resolves to null and the step plays its Pic-Word Match fallback; it never rejects.
 */
const LOADERS: Readonly<Record<string, () => Promise<{ scene: HiddenHeritageScene }>>> = {
  'scene:food-market': () => import('./scenes/scene-food-market'),
  'scene:letters-school': () => import('./scenes/scene-letters-school'),
  'scene:seollal-room': () => import('./scenes/scene-seollal-room'),
};

const cache = new Map<string, HiddenHeritageScene>();

export function loadScene(sceneId: string): Promise<HiddenHeritageScene | null> {
  const known = cache.get(sceneId);
  if (known) return Promise.resolve(known);
  const load = Object.prototype.hasOwnProperty.call(LOADERS, sceneId) ? LOADERS[sceneId] : undefined;
  if (!load) return Promise.resolve(null);
  return load().then(
    (chunk) => {
      if (chunk.scene.id !== sceneId) return null;
      cache.set(sceneId, chunk.scene);
      return chunk.scene;
    },
    () => null,
  );
}

type GameChunk = typeof import('./hidden-heritage-chunk');
let game: Promise<GameChunk> | null = null;

/**
 * The game's own chunk (`./hidden-heritage-chunk.tsx`, marker `screen-chunk:hidden-heritage`): the screen, its rules and
 * the scene renderer. The learner step and the projector slide both load it through this one literal `import()` in the
 * start bundle (an `import()` inside the presenter's root chunk would rename that chunk after it is hashed). A failed
 * load is tried again on the next call.
 */
export function loadHiddenHeritageChunk(): Promise<GameChunk> {
  game ??= import('./hidden-heritage-chunk').catch((error: unknown) => {
    game = null;
    throw error;
  });
  return game;
}

/** Tests only. */
export function resetScenesForTests(): void {
  cache.clear();
}
