/**
 * The "This week in Korea" chunk (F-CURR-002 §5.7, §10, row CM-48): the Home card and the drop's pages, reached only
 * through the literal `import()` of `./week-drop-entry.tsx`, so the web build emits it as one precached bundle
 * (`week-drop-chunk-<md5>.js`) and the start bundle carries none of it. The practice's planning is the memory chunk's
 * (`weekPracticeApi`) and its round view the Daily Review chunk's, each reached at run time; the drops themselves are
 * the content chunk `week-drops`. Never import this module statically.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const WEEK_DROP_CHUNK = 'screen-chunk:week-drop';

export { WeekDropCard } from './WeekDropCard';
export { WeekDropScreen } from './WeekDropScreen';
