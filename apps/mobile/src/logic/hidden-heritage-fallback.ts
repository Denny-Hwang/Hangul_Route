import type { MinigameScope } from './minigame-config';

/**
 * The Pic-Word Match fallback of a Hidden Heritage step (F-CURR-002 §7.1 F7 and §12.2, row CM-36; wireframe "States"):
 * while `game.hidden-heritage` is off, when the scene chunk cannot load, or when the scene would be drawn under 256 dp,
 * the step plays a Pic-Word Match board on the same targets, so no quest is blocked. Each board is one scene's targets
 * with their own bundled pictures (`card:` / `word:`, drawn by `PictureArt`), never the scene's props, which live in the
 * chunk that may be missing; the pair ids are the target ids, so an answer reads the same item either way. In the start
 * bundle, with the entry (`screens/minigames/hidden-heritage-entry.tsx`).
 */
export function picWordFallback(scope: MinigameScope): MinigameScope {
  const rounds = scope.hiddenHeritage?.rounds ?? [];
  return {
    kind: 'pic-word-match',
    picWord: { boards: rounds.map((r) => ({ pairs: r.targets.map((t) => ({ id: t.id, pictureRef: t.picture, word: t.word })) })) },
  };
}
