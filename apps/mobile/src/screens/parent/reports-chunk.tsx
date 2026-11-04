/**
 * The grown-up reports (F-REPORT-001 the learner report, F-PLC-001 the level-check report; F-CURR-002 section 10): a
 * chunk of their own, reached only through the literal `import()` of `./reports-entry.tsx`, so the web build emits it
 * as one precached bundle (`reports-chunk-<md5>.js`) and the start bundle carries neither screen nor the learner
 * report's view model (`logic/reports/report-view.ts`). Both open behind the grown-up gate, never on a learner's first
 * screen. Never import this module statically.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const REPORTS_CHUNK = 'screen-chunk:reports';

export { LearnerReportScreen } from './LearnerReportScreen';
export { PlacementReportScreen } from './PlacementReportScreen';
