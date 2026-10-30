/**
 * The Hidden Heritage game's chunk (F-CURR-002 §7.1 F7 and §10, row CM-36; marker below): the screen, its rules
 * (`logic/hidden-heritage-flow.ts`) and the scene renderer, loaded by `./hidden-heritage-entry.tsx` while
 * `game.hidden-heritage` is on. The scenes are chunks of their own (`./hidden-heritage-scenes.ts`).
 */
export { HiddenHeritageGame } from './HiddenHeritageGame';
// The projector slide draws the scene with the same renderer and spot geometry, through this chunk too, so no module is
// shared by the presenter's root chunk and this one (a shared module would be hoisted into the start bundle).
export { HiddenHeritageSceneArt } from './HiddenHeritageScene';
export { spotRect } from '../../logic/hidden-heritage-flow';

export const HIDDEN_HERITAGE_CHUNK = 'screen-chunk:hidden-heritage';
