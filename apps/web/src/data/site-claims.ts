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
 * | `parentReports`, `teacherReports`  | F-REPORT-001 RP-11 (flipped on)                                          |
 * | `feedbackNotes`                    | F-FEEDBACK-001 FB-14 (flipped on)                                        |
 * | `browseAsLearner`                  | F-BROWSE-001 BR-14 (flipped on; paid line: needs `paidPlans: 'inApp'`)   |
 * | `lectureMode`                      | AMENDMENTS-LECTURE-V2 LV-7 (flipped on, with both launch defaults on).   |
 * |                                    | Rollback (LV-D1): withdrawn for more than an incident (off for more than |
 * |                                    | a day, or `/present` taken down) means a PR setting it back to `false`   |
 * |                                    | and a site redeploy; a console or app kill switch alone never moves it   |
 * | `paidPlans: 'inApp'`               | a PR after the owner turns on Stripe Live (sandbox never counts)         |
 * | `levelCheck`                       | F-PLC-001 P-10 flag flip (`placementEnabled` launch default true);       |
 * |                                    | flipped on by owner decision 2026-10-21. Rollback (as LV-D1): placement  |
 * |                                    | off for more than an incident (`EXPO_PUBLIC_PLACEMENT_ENABLED` off for   |
 * |                                    | more than a day) means a PR setting it back to `false` and a site        |
 * |                                    | redeploy; the app's kill switch alone never moves it                     |
 * | `guestLesson`                      | AMENDMENTS-GUEST-FIRST-LESSON GU-7 flag flip                             |
 * |                                    | (with `EXPO_PUBLIC_GUEST_LESSON` on). Rollback (section 13.1, as LV-D1): |
 * |                                    | the app switch off for more than a day, or killed for a CS-G failure of  |
 * |                                    | any length, means a PR setting it back to `false` and a site redeploy    |
 * |                                    | the same day                                                             |
 *
 * Page components take `claims` as a prop that defaults to `SITE_CLAIMS`. F-BILL-002 B-7 reads the boolean
 * claims for its signed-in "what the plan includes" lines; `CLAIM_REQUIRES_PAID` applies to the public site only.
 * A claim whose feature is live in some UI locales only (`CLAIM_LOCALES`) shows in those locales only, on the site
 * and in the billing lines alike (`claimLiveIn`).
 */
import type { UiLocale } from '@hangul-route/i18n';
import { REPORT_REVIEWED_LOCALES } from '../lib/console/config';

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
  /** F-TCH-004 presenter is on in production with its entry points (AMENDMENTS-LECTURE-V2 LV-7). */
  lectureMode: boolean;
  /** F-PLC-001 level check: the learner app offers it to a new profile on every platform (`flags.placementEnabled`). */
  levelCheck: boolean;
  /**
   * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 13: Start learning carries `try=1` and opens quest 1 before any profile
   * (web learner app, `EXPO_PUBLIC_GUEST_LESSON`). With it on, the hero's one line, the guest variants of How it works
   * steps 1 and 3 and the /learners level answer (section 13.2), and the Privacy Policy bullet (section 13.3) show.
   */
  guestLesson: boolean;
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
  // F-REPORT-001 RP-11: both report flags are on by default in the console and the learner app.
  parentReports: true,
  teacherReports: true,
  // F-FEEDBACK-001 FB-14: both notes flags are on by default in the console and the learner app.
  feedbackNotes: true,
  // F-BROWSE-001 BR-14: the console Lessons entry is on by default (a paid line: the site shows it with paidPlans 'inApp').
  browseAsLearner: true,
  // AMENDMENTS-LECTURE-V2 LV-7: lecture mode is on by default in the console and the learner app (kill switches kept).
  lectureMode: true,
  // F-PLC-001 P-10: placementEnabled is on by default in the learner app; the site says so (owner decision 2026-10-21).
  levelCheck: true,
  // [GU] AMENDMENTS-GUEST-FIRST-LESSON GU-6: off until GU-7 turns the learner app's guest switch on in the same PR.
  guestLesson: false,
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
  levelCheck: false,
  guestLesson: false,
});

/**
 * Claims whose feature is live in some UI locales only. Reports render only in a locale whose `report.*` words
 * passed native review (F-REPORT-001 section 3.1), so the report lines follow the same list: a ko or es page never
 * promises a report its console holds back. A key not listed here is live in every locale.
 */
export const CLAIM_LOCALES: Readonly<Partial<Record<BooleanClaimKey, readonly UiLocale[]>>> = Object.freeze({
  parentReports: REPORT_REVIEWED_LOCALES,
  teacherReports: REPORT_REVIEWED_LOCALES,
});

/** True when the claim of `key` is on and its feature is live in `locale` (the paid rule left aside). */
export function claimLiveIn(claims: Readonly<SiteClaims>, key: BooleanClaimKey, locale: UiLocale): boolean {
  const locales = CLAIM_LOCALES[key];
  return claims[key] && (locales === undefined || locales.includes(locale));
}

/**
 * True when the site shows the feature line of `key` in `locale`: its claim is on and live in that locale, and paid
 * plans are on sale if it is a paid feature.
 */
export function showsClaim(claims: Readonly<SiteClaims>, key: BooleanClaimKey, locale: UiLocale): boolean {
  return claimLiveIn(claims, key, locale) && (!CLAIM_REQUIRES_PAID[key] || claims.paidPlans === 'inApp');
}
