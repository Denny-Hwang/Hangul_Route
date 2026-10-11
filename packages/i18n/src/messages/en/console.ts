import { plural } from '../../plural';

/**
 * The web console (F-CONSOLE-001, F-ENT-001, F-PLAN-001; moved here by F-I18N-001 PR 9).
 *
 * The flat keys are the former `COPY` (apps/web/src/lib/console/copy.ts) with their
 * keys, wording and the `capWarning(used, total)` function unchanged. The groups below
 * them hold the words the console view models put around a formatted value: dates come
 * from `formatDate`, amounts from `formatUsd` and counts go through `plural`, so no date,
 * price or plural suffix is written into a message.
 *
 * Every string here is caregiver surface (no "behind", "lazy" or a learner-banned word),
 * checked per locale by console-messages.test.ts.
 */
export const consoleMsgs = {
  whySignIn: ['Keep progress safe across devices', 'Bring cards back after a reinstall', 'Manage plans and billing'],
  kidsNoAccount: "Kids don't need an account — they join with a code.",
  devSignInHint: 'Development sign-in: the account id stands in for a verified session until the Clerk connection lands.',
  clerkPending: 'Sign-in is not set up on this build yet. The learner app works without an account.',
  clerkIntro: 'Sign in with your email or Google. Kids never need this page.',
  cantReach: "Can't reach the console right now.",
  tryAgain: 'Try again',
  noSpaces: "You're not in any space yet.",
  createSpace: 'Create a space',
  writeOnBoard: 'Write it on the board. Students join from Settings → Classes & family → Join a class.',
  oldCodeStops: 'The old code stops working the moment a new one is made.',
  notSyncedYet: 'not synced yet',
  notSyncedWeek: "haven't synced in a week",
  revisitTogether: 'Jamo to revisit together',
  practicedThisWeek: 'practiced this week',
  anchor: 'Stage 1 anchor',
  comingWithPlans: 'Coming with plans',
  capWarning: (used: number, total: number) => `Free plan: ${used} / ${total} students`,
  capReached: 'This class is at the free limit — new students will be asked to check with you.',
  planThisWeek: 'Plan this week',
  publishPlan: 'Publish plan',
  saveDraft: 'Save draft',
  spreadDates: 'Spread dates',
  onePerDay: 'One per day — the later item moved to the next day.',
  draftNeverReaches: 'A draft never reaches a learner. Publishing sends it on their next sync.',
  readoutHint: 'Most recent activity first — not a ranking. "Not ready yet" means the learner has not unlocked that item.',
  archivePlanConfirm: 'Archive this plan? Learners keep what they finished; unfinished items disappear from their list.',
  noPlanYet: 'No plan yet. Pick a few quests, spread the dates, and publish before class.',
  relinkApproveHint: 'Approve only if this learner is with you or you expect this device.',
  relinkNothing: 'Nothing waiting. Requests appear here for 10 minutes after a learner asks.',
  relinkAnotherWay: 'Another way: issue a new rescue code and read it to the learner. The old code stops working.',
  relinkCardsComeBack: "Approving brings the learner back into this class. Their cards come back with the rescue code their grown-up keeps in the app (Save my progress) — teachers can't see or reissue it.",
  rescueIssued: 'Read this to the learner or their grown-up now — it is shown once.',
  archiveKeeps: 'Keeps everything, stops new joins. You can unarchive later.',
  deleteLearnerWarn: 'Permanent. Removes this learner everywhere: devices, progress, memberships.',
  deleteAskParent: 'Only a parent can delete a learner in this class (consent mode: parent).',
  anonymizeHint: 'Show initials instead of names on the roster and re-link list.',
  consentHint: 'Who consented for the children in this class. School mode lets you delete learner data yourself.',
  consentLocked: 'School mode opens after a legal review. Until then, a parent consents for each child.',
  billingKidsLine: 'Kids never see billing — this page opens only after the grown-up gate.',
  billingNotConfigured: 'Checkout is not set up on this deployment yet. Nothing was charged.',
  billingCancelled: 'Nothing was charged.',
  billingSuccess: 'Thank you — the plan is active. Learners see it on their next sync.',
  billingPastDue: "A payment didn't go through. Update your card in Manage subscription; learners keep premium for a week.",
  lifetimeLine: 'One payment. No renewal, no subscription to cancel.',
  groupLine: 'Renews yearly. Cancel from Manage subscription any time.',
  contactLine: 'More than 300 students or 10 teachers? Write to us for a contract.',
  promoLabel: 'Promo or referral code',
  promoHint: 'Got a code from a teacher, a friend or a post? It comes off at checkout.',
  promoInvalid: "That code can't be used right now — check the spelling or the date.",
  promoTooMany: 'Too many tries — wait a minute and try again.',
  promoNotConfigured: 'Codes are not set up on this deployment yet.',
  schoolInviteHint: 'Teachers sign in, enter this code, then create their class — or you create it and assign them.',
  schoolEmpty: 'Invite a teacher with the code, or create a class and assign one.',
  schoolNoLicence: 'No licence yet — each class keeps the free cap of 20 students.',
  schoolNearLimit: 'Close to the licence limit — see billing before the next class fills up.',
  schoolAtLimit: 'At the licence limit — new students will be asked to check with their teacher.',
  schoolLicenceLapsed: 'The licence needs attention. Classes stay readable; students keep Stage 1 either way.',

  /** Header language select (`LanguageSelect`); hidden while only English ships. */
  language: {
    label: 'Language',
  },
  /** Join-code expiry (`codeExpiry`). */
  codeExpiry: {
    none: 'no code yet',
    expired: 'expired',
    today: 'expires today',
    inDays: (days: number) => plural('en', days, { one: `expires in ${days} day`, other: `expires in ${days} days` }),
  },
  /** One neutral status line per space row (`routing.statusLine`): counts only, never names or percentages. */
  spaceCounts: {
    learners: (n: number) => plural('en', n, { one: `${n} learner`, other: `${n} learners` }),
    students: (n: number) => plural('en', n, { one: `${n} student`, other: `${n} students` }),
    classes: (n: number) => plural('en', n, { one: `${n} class`, other: `${n} classes` }),
  },
  /** Plan builder status (`planStatusLabel`); the date arrives formatted. */
  planStatus: {
    archived: 'Archived',
    draft: 'Draft',
    published: (date: string) => `Published ${date}`,
  },
  /** Entitlement status on billing and the school page (`billing.statusLine`); the date arrives formatted. */
  entitlementStatus: {
    trial: 'trial',
    trialEnds: (date: string) => `trial · ends ${date}`,
    active: 'active',
    activeForGood: 'active · yours for good',
    activeRenews: (date: string) => `active · renews ${date}`,
    pastDueKept: 'payment needs attention · premium kept for a week',
    pastDuePaused: 'payment needs attention · premium paused',
    cancelled: 'cancelled',
    cancelledEnds: (date: string) => `cancelled · ends ${date}`,
    ended: 'ended',
    endedOn: (date: string) => `ended ${date}`,
  },
  /** A plan price around an amount already run through `formatUsd` (`PLAN_PRICING.amountUsd` and `.per`). */
  price: {
    once: (amount: string) => `${amount} once`,
    year: (amount: string) => `${amount} / year`,
  },
  /** Price line once a promo code is applied (F-ENT-002 §3.3); `price` and `was` come from `price.*`. */
  promoPrice: (price: string, code: string, off: string, firstYear: boolean, was: string) =>
    `${price} with ${code} (${off}${firstYear ? ', first year' : ''}), was ${was}`,
} as const;
