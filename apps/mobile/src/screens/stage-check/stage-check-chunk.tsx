/**
 * The Stage Check's chunk (F-CURR-002 section 10, row CM-22): the Stages 2-7 ceremony, the Stage Check, the one
 * retroactive summary and the Journey header's extras, reached only through the literal `import()` of
 * `./stage-check-entry.tsx`, so the web build emits it as one precached bundle (`stage-check-chunk-<md5>.js`) and the
 * start bundle carries none of it. The session logic is the memory chunk's (`stageCheckApi()`), the rounds the Daily
 * Review chunk's, each reached at run time, so no module sits in two chunks (Metro would hoist it into the start bundle).
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const STAGE_CHECK_CHUNK = 'screen-chunk:stage-check';

export { StageCheckScreen } from './StageCheckScreen';
export { StageHeaderExtras } from './StageHeaderExtras';
export { StageRecapScreen } from './StageRecapScreen';
export { UpperStageCompleteScreen } from './UpperStageCompleteScreen';
