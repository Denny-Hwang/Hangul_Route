import type { SiteClaims } from '../site-claims';

/**
 * Every claim on: each boolean true, `freePlan: 'stage1'` (its only value, F-ENT-003 OD-1) and
 * `paidPlans: 'inApp'` (F-SITE-002 §3.11). The longest state of every site page, used by the word-budget and
 * persona-page tests. Test-only: no page or component imports it (`site-claims.test.ts` checks), so a
 * production build can never show an unlaunched claim.
 */
export const ALL_CLAIMS_ON: Readonly<SiteClaims> = Object.freeze({
  freePlan: 'stage1',
  paidPlans: 'inApp',
  learningRoute: true,
  parentReports: true,
  teacherReports: true,
  feedbackNotes: true,
  browseAsLearner: true,
  lectureMode: true,
  levelCheck: true,
});

/**
 * Every feature claim off, paid plans coming: the shortest state of every site page, the one before any companion
 * flip PR. Since F-REPORT-001 RP-11 the reports claims are on in `SITE_CLAIMS`, so a test of the base lines alone
 * renders this state instead of the defaults. Test-only, like `ALL_CLAIMS_ON`.
 */
export const ALL_CLAIMS_OFF: Readonly<SiteClaims> = Object.freeze({
  freePlan: 'stage1',
  paidPlans: 'coming',
  learningRoute: false,
  parentReports: false,
  teacherReports: false,
  feedbackNotes: false,
  browseAsLearner: false,
  lectureMode: false,
  levelCheck: false,
});
