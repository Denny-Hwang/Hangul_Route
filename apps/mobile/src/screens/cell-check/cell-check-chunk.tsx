/**
 * The Cell Check's chunk (F-CURR-002 section 10, row CM-21): the cell page's block and Test out line, and the screen,
 * reached only through the literal `import()` of `./cell-check-entry.tsx`, so the web build emits it as one precached
 * bundle (`cell-check-chunk-<md5>.js`) and the start bundle carries none of it. The session logic is the memory chunk's
 * (`cellCheckApi()`), the rounds the Daily Review chunk's, the ring the mastery chunk's, each reached at run time, so no
 * module sits in two chunks (Metro would hoist it into the start bundle).
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const CELL_CHECK_CHUNK = 'screen-chunk:cell-check';

export { CellCheckBlock } from './CellCheckBlock';
export { CellCheckScreen } from './CellCheckScreen';
