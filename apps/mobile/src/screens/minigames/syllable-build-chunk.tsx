/**
 * The Syllable Build chunk (F-CURR-002 sections 7.1 F3 and F9, 10 and 12.2, row CM-32): the quest game, its board, the
 * review round at the produce rung, the Listen & Pick fallback and the Block Sprint, reached only through the literal
 * `import()` of `./syllable-build-entry.tsx`, so the web build emits it as one precached bundle
 * (`syllable-build-chunk-<md5>.js`) and the start bundle carries none of it. The Daily Review chunk reaches the review
 * round at run time through `syllableBuildChunk()` of the entry, so no module sits in two chunks (Metro would hoist it
 * into the start bundle).
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const SYLLABLE_BUILD_CHUNK = 'screen-chunk:syllable-build';

export { SyllableBuildGame } from './SyllableBuildGame';
export { SprintOffer, SyllableBuildStepBody } from './SyllableBuildStepBody';
export { BuildRoundView } from './BuildRoundView';
export { DecodingSprintScreen } from '../decode-sprint/DecodingSprintScreen';
