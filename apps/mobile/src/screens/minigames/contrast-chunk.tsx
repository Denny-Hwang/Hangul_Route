/**
 * The contrast chunk (AMENDMENTS-MINIMAL-PAIRS sections 3.4 to 3.7, row MP-2a): the contrast catalogue (the generated
 * `contrast-sets.ts`), the playable rules and the draw, a contrast round's lines and the compare row. Two optional steps play
 * it (quest 6 and Stage 2 Letters quest 2), so it is loaded only when a Listen & Pick scope holds a round with `contrastSet`
 * (`contrast-entry.ts`, the one literal `import()`), and the start bundle carries none of it. Listen & Pick's contrast
 * branches (the mixed-scope draw, the compare player, the miss line, an answered option's naming and its kind line with
 * Hear it, the later rounds to drop) live here too (AMENDMENTS-START-BUNDLE-2026-11 row SB-4b); the board only calls them.
 * Design:
 * design/wireframes/minigame/listen-pick.md "[MP] Contrast round".
 */

/** This chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build checks it is a precached bundle of its own. */
export const CONTRAST_CHUNK = 'screen-chunk:contrast';

export { ContrastCompare } from './ContrastCompare';
export { ContrastOptionExtras as OptionExtras } from './ContrastOptionExtras';
export {
  compareItems,
  compareRow,
  contrastKindLine,
  laterContrast,
  laterUnplayable,
  memberGloss,
  missLine,
  mixedRounds,
  optionNaming,
  playCompare,
} from '../../logic/listen-pick-contrast';
export {
  contrastApproved,
  contrastClipRef,
  contrastMemberSpec,
  contrastNote,
  contrastRoundPlayable,
  contrastStepPlayable,
  drawContrastRounds,
  pairRound,
  playableContrastRounds,
  withTarget,
} from '../../logic/audio/contrast-sets';
