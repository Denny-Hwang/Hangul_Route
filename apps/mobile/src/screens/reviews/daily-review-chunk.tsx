/**
 * The Daily Review chunk (F-CURR-002 §10, row CM-14): the screen and its rounds, reached only through the literal
 * `import()` of `DailyReviewRoute.tsx`, so the web build emits it as one precached bundle (`daily-review-chunk-<md5>.js`)
 * and the start bundle carries none of it. The review engine and the session logic are in the memory chunk
 * (`dailyReviewApi`, through `memoryChunk()` of the boot module): a chunk that imported a module of another chunk would
 * have it hoisted into the start bundle, and one that `import()`ed another chunk would not be named by its md5.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const DAILY_REVIEW_CHUNK = 'review-chunk:daily';

export { DailyReviewScreen } from './DailyReviewScreen';
// Row CM-21: the Cell Check's screen (a chunk of its own) draws the same rounds, top row and headline, reached at run
// time through `dailyReviewChunk()` of the route, so no module sits in two chunks.
export { DisplayHeadline, TopRow } from './DailyReviewScreen';
export { RoundView } from './ReviewRounds';
