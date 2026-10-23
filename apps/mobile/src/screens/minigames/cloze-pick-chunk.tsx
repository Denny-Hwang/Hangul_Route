/**
 * The Cloze Pick chunk (F-CURR-002 sections 7.1 and 10, row CM-30): the game, its Listen & Pick fallback, its flow and
 * its prompt card, reached only through the literal `import()` of `./cloze-pick-entry.tsx`, so the web build emits it
 * as one precached bundle (`cloze-pick-chunk-<md5>.js`) and the start bundle carries only the door.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const CLOZE_PICK_CHUNK = 'screen-chunk:cloze-pick';

export { ClozePickGame } from './ClozePickGame';
export { ClozePickFallback, ClozePickStepBody } from './cloze-pick-step';
// The fixture build's e2e hook and step (row CM-30): here, so a release build carries none of their fixtures.
export { ClozePickE2eBody, ClozePickE2eHookBody } from '../../navigation/cloze-pick-e2e';
