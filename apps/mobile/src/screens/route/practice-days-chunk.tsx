/**
 * The practice-days chunk (AMENDMENTS-ROUTE-CLASS-BLEND section 9.4, row BL-8): the My practice days screen and the
 * device placer (`placePractice`, the content-schema `blend` subpath), reached only through the literal `import()` of
 * `./practice-days-load.ts`, so the web build emits it as one precached bundle and the start bundle carries none of
 * it. Never import this module statically.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const PRACTICE_DAYS_CHUNK = 'screen-chunk:practice-days';

export { placeSourceForLearner } from '../../logic/route/place-learner-days';
export { PracticeDaysScreen } from './PracticeDaysScreen';
