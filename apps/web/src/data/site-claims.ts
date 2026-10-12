/**
 * Claims: which feature lines hangulroute.com shows (F-SITE-002 §3.9). A line about a feature appears only
 * once the feature is live in production, so the site never promises more than is built.
 *
 * A code constant, not a build variable: tests pin every state, and no stray environment value can switch a
 * claim on. Hand-off rule: the companion spec's flag-flip PR (the one that turns its feature on in production)
 * flips its claim here in the same PR, never ahead of the feature. A spec that makes its feature paid-only also
 * sets its `CLAIM_REQUIRES_PAID` entry in that PR and words the line with the plan, never with a price.
 *
 * | Claim                              | Flipped by                                                               |
 * |------------------------------------|--------------------------------------------------------------------------|
 * | `learningRoute`                    | F-ROUTE-001 R-10 flag flip (Learning Route amendment LR-10 keeps it)     |
 * | `parentReports`, `teacherReports`  | F-REPORT-001 RP-11                                                       |
 * | `feedbackNotes`                    | F-FEEDBACK-001 FB-14                                                     |
 * | `browseAsLearner`                  | F-BROWSE-001 BR-14 flag flip (paid line: needs `paidPlans: 'inApp'`)     |
 * | `lectureMode`                      | the PR after the owner sets `NEXT_PUBLIC_LECTURE_MODE=enabled` on the    |
 * |                                    | production console build (F-TCH-004 names no flip PR yet)                |
 * | `paidPlans: 'inApp'`               | a PR after the owner turns on Stripe Live (sandbox never counts)         |
 *
 * Page components take `claims` as a prop that defaults to `SITE_CLAIMS`. F-BILL-002 B-7 reads the boolean
 * claims for its signed-in "what the plan includes" lines; `CLAIM_REQUIRES_PAID` applies to the public site only.
 */
export interface SiteClaims {
  /**
   * The free-plan line. One value: all of Stage 1 is free, before and after F-ENT-003 turns its free boundary
   * on (F-ENT-003 OD-1, owner decision 2026-10-11), so no release flips it. The key stays so a later change to
   * the free plan is one constant and one string.
   */
  freePlan: 'stage1';
  /** `coming` until the owner turns on Stripe Live, then `inApp` (plans are managed at app.hangulroute.com). */
  paidPlans: 'coming' | 'inApp';
  /** The Learning Route is on for every learner and the grown-up read-only view is live. */
  learningRoute: boolean;
  /** F-REPORT-001 reports are live for parents. */
  parentReports: boolean;
  /** F-REPORT-001 reports and class statistics are live for teachers. */
  teacherReports: boolean;
  /** F-FEEDBACK-001 notes from grown-ups are live. */
  feedbackNotes: boolean;
  /** F-BROWSE-001 lesson browser is live for paying grown-ups. */
  browseAsLearner: boolean;
  /** F-TCH-004 presenter is on in production. */
  lectureMode: boolean;
}

/** The claims that switch one feature line on or off (every key whose value is a boolean). */
export type BooleanClaimKey = {
  [K in keyof SiteClaims]: SiteClaims[K] extends boolean ? K : never;
}[keyof SiteClaims];

/** What the site says today. Read-only by type and frozen at run time: only a reviewed flip PR changes it. */
export const SITE_CLAIMS: Readonly<SiteClaims> = Object.freeze({
  freePlan: 'stage1',
  paidPlans: 'coming',
  learningRoute: false,
  parentReports: false,
  teacherReports: false,
  feedbackNotes: false,
  browseAsLearner: false,
  lectureMode: false,
});

/** A line about a paid feature shows only when its claim is on AND `paidPlans === 'inApp'`. */
export const CLAIM_REQUIRES_PAID: Readonly<Record<keyof SiteClaims, boolean>> = Object.freeze({
  freePlan: false,
  paidPlans: false,
  learningRoute: false,
  parentReports: false,
  teacherReports: false,
  feedbackNotes: false,
  browseAsLearner: true,
  lectureMode: false,
});

/** True when the site shows the feature line of `key`: its claim is on, and paid plans are on sale if it is a paid feature. */
export function showsClaim(claims: Readonly<SiteClaims>, key: BooleanClaimKey): boolean {
  return claims[key] && (!CLAIM_REQUIRES_PAID[key] || claims.paidPlans === 'inApp');
}
