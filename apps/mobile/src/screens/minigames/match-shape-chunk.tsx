/**
 * The Match Shape chunk (F-CURR-002 sections 7.1 F4, 10 and 12.2, row CM-33): the quest game, its board and origin
 * pictures (`ShapeOriginArt`, reached by its file path), the facts' sources, the review round at the produce rung and
 * the Read Pick fallback, reached only through the literal `import()` of `./match-shape-entry.tsx`, so the web build
 * emits it as one precached bundle and the start bundle carries none of it. The Daily Review chunk reaches the review
 * round at run time through `matchShapeChunk()` of the entry, so no module sits in two chunks.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const MATCH_SHAPE_CHUNK = 'screen-chunk:match-shape';

export { MatchShapeStepBody } from './MatchShapeStepBody';
export { ShapeRoundView } from './ShapeRoundView';
