/**
 * The Cloze Pick chunk (F-CURR-002 sections 7.1 and 10, row CM-30): the game, its flow and its prompt view, reached
 * only through the literal `import()` of `./cloze-pick-entry.tsx` while `game.cloze-pick` is on, so the web build emits
 * it as one precached bundle (`cloze-pick-chunk-<md5>.js`). Its Listen & Pick fallback (`./cloze-pick-fallback.tsx`)
 * stays in the start bundle with the door.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const CLOZE_PICK_CHUNK = 'screen-chunk:cloze-pick';

export { ClozePickGame } from './ClozePickGame';
// The fixture build's e2e hook and step (row CM-30). They ship in every build's chunk, unmounted: only a fixture build
// (`STORY_FIXTURES_BUILD`, navigation/root.tsx) mounts the hook and registers the screen.
export { ClozePickE2eBody, ClozePickE2eHookBody } from '../../navigation/cloze-pick-e2e';
