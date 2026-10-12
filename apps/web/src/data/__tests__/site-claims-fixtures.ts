import type { SiteClaims } from '../site-claims';

/**
 * Every claim on: each boolean true, `freePlan: 'stage1'` (its only value, F-ENT-003 OD-1) and
 * `paidPlans: 'inApp'` (F-SITE-002 §3.11). The longest state of every site page, used by the word-budget and
 * persona-page tests. Test-only: no page or component imports it (`site-claims.test.ts` checks), so a
 * production build can never show an unlaunched claim.
 */
export const ALL_CLAIMS_ON: SiteClaims = Object.freeze({
  freePlan: 'stage1',
  paidPlans: 'inApp',
  learningRoute: true,
  parentReports: true,
  teacherReports: true,
  feedbackNotes: true,
  browseAsLearner: true,
  lectureMode: true,
});
