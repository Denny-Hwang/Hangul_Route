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
 * Below those, one group per console page (F-I18N-001 PR 10a): `shell` (the header of every
 * page), `signIn`, `start`, `home`, `space` and `relink`, plus `kind` (space kinds) and `joinCode`.
 * A sentence with a number or a name in it is one function message; the English wording is
 * the pages' former text, byte for byte, except that counts now go through `plural()`
 * (F-I18N-001 §10, closed): "1 learner", "1 card", "1 hasn't synced".
 * Four former COPY fragments the space page glued around numbers (practicedThisWeek, anchor,
 * revisitTogether, notSyncedWeek) became whole sentences under `space.week`. PR 10b added
 * `plan` and `billing` (at the end of this object) the same way, and PR 10c `settings`, `school`
 * and `parent` after `curriculum`.
 *
 * Every string here is caregiver surface (no "behind", "lazy" or a learner-banned word),
 * checked per locale by console-messages.test.ts.
 */
/** F-BILL-002 B-6: "St. Mary's license", not "St. Mary's's license", for a school name that already ends in a possessive. */
const licenseOf = (school: string): string => (/['’]s$/i.test(school) ? `${school} license` : `${school}'s license`);
/** F-BILL-002 B-6: a usage count, "{n} of {cap} <nouns>" or "{n} <nouns>" when there is no cap (null). */
const usageCount =
  (one: string, other: string) =>
  (n: number, cap: number | null): string =>
    cap === null ? plural('en', n, { one: `${n} ${one}`, other: `${n} ${other}` }) : plural('en', cap, { one: `${n} of ${cap} ${one}`, other: `${n} of ${cap} ${other}` });
/** "1 item" / "4 items": `planCounts.items`, also the plan item count inside `plan.summary.*`. */
const planItems = (items: number): string => plural('en', items, { one: `${items} item`, other: `${items} items` });
/** "1 learner" / "3 students": `planCounts.targets`, also the target count inside `plan.summary.some.*`. */
const planTargets = (kind: 'family' | 'class' | 'school', n: number): string =>
  kind === 'family'
    ? plural('en', n, { one: `${n} learner`, other: `${n} learners` })
    : kind === 'class'
      ? plural('en', n, { one: `${n} student`, other: `${n} students` })
      : plural('en', n, { one: `${n} member`, other: `${n} members` });
/** "3 more lessons open with a Group License. They are left out of this plan." (F-ENT-003 section 3.9.3). */
const leftOut = (n: number, product: string): string =>
  plural('en', n, {
    one: `${n} more lesson opens with ${product}. It is left out of this plan.`,
    other: `${n} more lessons open with ${product}. They are left out of this plan.`,
  });

export const consoleMsgs = {
  devSignInHint: 'Development sign-in: the account id stands in for a verified session until the Clerk connection lands.',
  clerkPending: 'Sign-in is not set up on this build yet. The learner app works without an account.',
  cantReach: "Can't reach the console right now.",
  tryAgain: 'Try again',
  noSpaces: "You're not in any space yet.",
  createSpace: 'Create a space',
  writeOnBoard: 'Write it on the board. Students join from Profile → Classes & family → Join a class.',
  oldCodeStops: 'The old code stops working the moment a new one is made.',
  notSyncedYet: 'not synced yet',
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
  familyLine: 'Renews yearly. Cancel from Manage subscription any time.',
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

  /**
   * The adult frame of every grown-up page (`AdultFrame`, F-APP-001 A-5a, section 3.8;
   * design/screens/app-shell/adult-frame.md), and the note shown when the build has no API address.
   */
  shell: {
    home: 'Console',
    signOut: { cta: 'Sign out' },
    /** The way back to the learner app; "Open the learner app" on a device with no learner profile (a teacher's laptop). */
    backToLearning: 'Back to learning',
    openLearnerApp: 'Open the learner app',
    /** Footer links to the site (hangulroute.com). */
    aboutSite: 'About Hangul Route',
    privacy: 'Privacy',
    terms: 'Terms',
    /** The persona switch and the persona name; the parent persona is labelled Family (OD-14). */
    persona: { parent: 'Family', teacher: 'Teacher' },
    /** Adult nav labels (F-APP-001 `ADULT_NAV`); an item whose sibling flag is off is not drawn. */
    nav: { home: 'Home', reports: 'Reports', notes: 'Notes', classes: 'Classes', lessons: 'Lessons', billing: 'Billing' },
    noApi: 'The console needs an API address (NEXT_PUBLIC_API_BASE_URL) on this build.',
  },
  /** Space kinds: a label ("Class code") and the home-page group heading. */
  kind: {
    label: { family: 'Family', class: 'Class', school: 'School' },
    group: { family: 'Family', class: 'Classes', school: 'School' },
  },
  /** A join code on the start and space pages. */
  joinCode: {
    copy: { cta: 'Copy' },
    copied: { cta: 'Copied' },
  },
  /** Sign-in (`/teach`): the dev form shows only on builds without Clerk. */
  signIn: {
    title: 'Grown-ups sign in',
    panelLabel: 'Sign in',
    accountId: { label: 'Account id', placeholder: 'teacher-kim' },
    displayName: { label: 'Your name', placeholder: 'Ms Kim' },
    email: { label: 'Email (optional)', placeholder: 'kim@example.com' },
    submit: { cta: 'Continue' },
    submitting: { cta: 'Signing in…' },
    /**
     * `/signin` on the app host (F-APP-001 A-4b, section 3.7; design/screens/app-shell/signin.md).
     * A shared surface a child can reach: no age wording, never "kids". The intro follows the
     * persona hint (`?persona=`, or its alias `?as=`); none or an unknown value gets the neutral line.
     */
    persona: {
      parent: { intro: "Sign in to see your family's learning." },
      teacher: { intro: 'Sign in to see your classes.' },
    },
    neutralIntro: 'Sign in to your grown-up account.',
    learnersNoAccount: "Learners don't need an account. They start learning right away, or join a class with a code.",
    imLearning: "I'm here to learn",
    /** The adult step before Clerk's sign-up (`?mode=create`, OD-13): the sign-up form renders only after the tick. */
    create: {
      link: 'New here? Create a grown-up account',
      lead: 'Grown-up accounts are for parents, guardians and teachers.',
      affirm: 'I am a parent, guardian or teacher',
      continue: { cta: 'Continue' },
      back: { cta: 'Back to sign in' },
    },
    /** The router's visible link (section 3.16); the polite "Taking you to your home…" line is `a11y.shell.redirecting`. */
    router: { goNow: 'Go now' },
    unreachable: "Sign-in can't load right now.",
    /** An installed iOS PWA where Google finished in Safari (section 3.19): the email code keeps the sign-in in this window. */
    standaloneFinish: 'Finish signing in here with an email code',
    /** Reverification after an OAuth sign-in on a device with learner profiles (section 3.9); names no factor. */
    reverify: {
      title: "Confirm it's you",
      line: "This device has learner profiles. Confirm it's you to open grown-up pages.",
    },
  },
  /** New space (`/teach/start`): role, then name, then (for a class) the code. */
  start: {
    title: 'New space',
    roleTitle: 'Who are you?',
    roleLabel: 'Role',
    roles: {
      family: { title: 'Parent / caregiver', line: 'Home — my kids' },
      class: { title: 'Teacher', line: 'My class' },
      school: { title: 'School admin', line: 'Teachers and classes' },
    },
    continue: { cta: 'Continue' },
    back: { cta: 'Back' },
    nameTitle: { family: 'Name your family', class: 'Name your class', school: 'Name your school' },
    nameLabel: 'Space name',
    classJoinHint: 'Students join with a code — no accounts for kids.',
    create: { cta: 'Create' },
    creating: { cta: 'Creating…' },
    signInAgain: 'Please sign in again.',
    createFailed: "Couldn't create it yet.",
    codeTitle: 'Your class code',
    goToClass: { cta: 'Go to my class' },
    /** The suggested space name (`prefillName`); the grown-up can change it before creating. */
    prefill: {
      family: (name: string) => `${name} family`,
      familyDefault: 'Our family',
      class: 'Class A',
      school: (name: string) => `${name} school`,
      schoolDefault: 'Our school',
    },
  },
  /**
   * The teacher home (`/teach/home`, F-APP-001 A-5a, section 3.8; design/screens/app-shell/teacher-home.md):
   * counts only, no names, no percentages. The row links show only with their sibling flags.
   */
  home: {
    lastList: 'Showing the last list we loaded.',
    archived: '(archived)',
    open: { cta: 'Open →' },
    newClass: { cta: '+ New class' },
    classReport: 'Class report',
    notes: 'Notes',
    lessons: 'Lessons',
    /** The account holds no class or school space yet (section 3.8). */
    noClass: { title: "You don't have a class yet.", setUp: 'Set up a class', goFamily: 'Go to Family' },
    /** The quiet cross-link at the bottom: set up the other persona, or switch to it. */
    cross: { addFamily: 'Learning at home too? Set up a family space', toFamily: 'Your family is under Family' },
  },
  /** A class or family roster (`/teach/space`). */
  space: {
    loading: 'Loading…',
    title: {
      family: (space: string, count: number) => plural('en', count, { one: `${space} · ${count} learner`, other: `${space} · ${count} learners` }),
      class: (space: string, count: number) => plural('en', count, { one: `${space} · ${count} student`, other: `${space} · ${count} students` }),
      school: (space: string, count: number) => plural('en', count, { one: `${space} · ${count} member`, other: `${space} · ${count} members` }),
    },
    forbidden: "This space isn't yours to view.",
    gone: 'This space is gone.',
    /** Followed by `oldCodeStops` in the confirm dialog. */
    regenerateAsk: (space: string) => `Make a new code for ${space}?`,
    regenerateFailed: "Couldn't make a new code right now.",
    joinCodeLabel: 'Join code',
    codeLabel: { family: 'Family code', class: 'Class code', school: 'School code' },
    regenerate: { cta: 'Regenerate' },
    createCode: { cta: 'Create a code' },
    upgrade: 'Upgrade',
    /**
     * The class roll-up (`classRollup`); the accuracy arrives formatted, the jamo joined.
     * `revisit` takes taught Korean: the page splits it with `aroundSlot` and renders the jamo
     * itself, marked `lang="ko"`, so the message never holds the Korean (§3.4 rule 5, §3.5).
     */
    week: {
      title: 'This week',
      practiced: (practiced: number, students: number) => `${practiced} of ${students} practiced this week`,
      anchor: (accuracy: string) => `Stage 1 anchor: ${accuracy}`,
      revisit: (jamo: string) => `Jamo to revisit together: ${jamo}`,
      notSynced: (count: number) => plural('en', count, { one: `${count} hasn't synced in a week`, other: `${count} haven't synced in a week` }),
      /** F-VOC-005 P-4: up to three words most often on the students' lists, never a ranking of students. The page fills the words. */
      wordsRevisit: (words: string) => `Words to revisit together: ${words}`,
    },
    /** The latest plan's button. Holds a user-entered plan title, so it is not a budgeted `cta`; its fixed words are budgeted in length-budget.test.ts and the button wraps. */
    openPlan: { label: (plan: string) => `Plan: ${plan}` },
    relinkRequests: { cta: 'Re-link requests' },
    relinkPending: {
      cta: (count: number) => plural('en', count, { one: `${count} re-link request`, other: `${count} re-link requests` }),
    },
    settings: { cta: 'Settings' },
    studentsLabel: 'Students',
    recentFirst: 'Most recent activity first',
    /**
     * One student card; the day words come from `relativeDay`, the readout from `readoutLine`
     * (`plan.readout`). `revisit` takes taught Korean, rendered by the page through `aroundSlot`
     * like `week.revisit`.
     */
    learner: {
      lastActive: (when: string) => `Last active ${when}`,
      questsCards: (done: number, total: number, cards: number) =>
        plural('en', cards, { one: `Quests ${done} / ${total} · ${cards} card`, other: `Quests ${done} / ${total} · ${cards} cards` }),
      minutesThisWeek: (minutes: number) => `${minutes} min this week`,
      revisit: (jamo: string) => `Revisit: ${jamo}`,
      planReadout: (plan: string, readout: string) => `${plan}: ${readout}`,
      joined: (when: string) => `joined ${when}`,
      /** F-VOC-005 P-4 (section 3.8): counts only; the first-try rate stays off the roster. */
      words: (collected: number, strong: number) => `Words: ${collected} collected · ${strong} strong`,
      /** Up to three words to look at together. The page fills the words (Korean marked lang="ko", romanization and gloss). */
      wordsRevisit: (words: string) => `Words to revisit: ${words}`,
    },
    /** One taught word after its Hangul: the romanization and the gloss in the UI language (CLAUDE.md section 1). */
    wordGloss: (romanization: string, gloss: string) => `${romanization} (${gloss})`,
  },
  /** Re-link approval (`/teach/space/relink`, `relink.ts`): identity and timing only, no progress numbers. */
  relink: {
    title: 'Re-link requests',
    titleFor: (space: string) => `${space} · re-link requests`,
    back: (space: string | null) => `← Back to ${space ?? 'the space'}`,
    approved: (name: string) => `${name} can open their new device now.`,
    denied: (name: string) => `Closed. ${name}'s device will say "ask your teacher".`,
    /** Followed by `oldCodeStops` in the confirm dialog. */
    issueAsk: (name: string) => `Issue a new rescue code for ${name}?`,
    issueFailed: "Couldn't issue a code right now.",
    /** The page shows the name in bold (`aroundSlot`), so a translation may put it anywhere, exactly once. */
    askingToBe: (name: string) => `Someone is asking to be ${name}`,
    /** When the request names no platform. */
    device: 'device',
    approve: { cta: 'Approve' },
    deny: { cta: 'Deny' },
    anotherWay: 'Another way',
    done: { cta: 'Done' },
    learnerLabel: 'Learner',
    chooseLearner: 'Choose a learner…',
    issue: { cta: 'Issue a new rescue code' },
    cardsLabel: 'Cards and progress',
    expired: 'expired',
    expiresIn: (minutes: number) => `expires in ${minutes} min`,
    askedJustNow: 'asked just now',
    askedAgo: (minutes: number) => `asked ${minutes} min ago`,
    closed: 'This request already closed — the learner can ask again.',
    failed: "Didn't go through. Try again.",
  },

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
  /** Plan builder counts (`teach/space/plan`): the items in a plan, and the members it targets (worded per space kind). */
  planCounts: {
    items: planItems,
    targets: planTargets,
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
    activeRenews: (date: string) => `active · renews ${date}`,
    /** F-BILL-002 B-6: "full route", never "premium" (§6.1). */
    pastDueKept: 'payment needs attention · full route kept for a week',
    pastDuePaused: 'payment needs attention · full route paused',
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

  /**
   * The plan page (`/teach/space/plan`, F-I18N-001 PR 10b): the builder for a draft, the
   * readout once published (`plans.ts readoutLine`), and the catalog labels (`catalogLabel`).
   * Quest and episode titles are content and arrive as arguments. Kind-keyed groups take
   * `space` where the roster has not loaded.
   */
  plan: {
    title: 'Plan',
    titleFor: (space: string) => `${space} · plan`,
    back: (space: string | null) => `← Back to ${space ?? 'the space'}`,
    saveInvalid: "Some learners are no longer in this space — check who it's for.",
    saveFailed: "Didn't save. Try again.",
    archiveFailed: "Couldn't archive it right now.",
    readoutLabel: 'Plan readout',
    /**
     * The readout's one-line summary (`plans.ts planSummary`): "4 items · for everyone in this
     * class" · "4 items · for 3 students". One whole sentence per audience (§3.1), so a locale
     * words "for" together with its noun instead of gluing a phrase after it.
     */
    summary: {
      everyone: {
        family: (items: number) => `${planItems(items)} · for everyone in this family`,
        class: (items: number) => `${planItems(items)} · for everyone in this class`,
        school: (items: number) => `${planItems(items)} · for everyone in this school`,
        space: (items: number) => `${planItems(items)} · for everyone in this space`,
      },
      /** The target count reads `planCounts.targets` ("for 1 learner", F-I18N-001 §10 console counts, closed). */
      some: {
        family: (items: number, count: number) => `${planItems(items)} · for ${planTargets('family', count)}`,
        class: (items: number, count: number) => `${planItems(items)} · for ${planTargets('class', count)}`,
        school: (items: number, count: number) => `${planItems(items)} · for ${planTargets('school', count)}`,
      },
    },
    edit: { cta: 'Edit' },
    archive: { cta: 'Archive' },
    newPlan: { cta: 'New plan' },
    progressTitle: 'Progress',
    noMembers: { family: 'No learners yet.', class: 'No students yet.', school: 'No members yet.' },
    /** One learner's progress on the plan (`readoutLine`); counts only, never a ranking. */
    readout: {
      waiting: 'waiting for the next sync',
      progress: (done: number, total: number) => `${done} / ${total}`,
      withNotReady: (done: number, total: number, notReady: number) => `${done} / ${total} · ${notReady} not ready yet`,
    },
    builderLabel: 'Plan builder',
    editTitle: 'Edit plan',
    newTitle: 'New plan',
    titleField: { label: 'Plan title', placeholder: 'Week 3' },
    catalog: {
      label: 'Catalog',
      title: 'Catalog (Stage 1)',
      addEpisode: { cta: '+ episode' },
      /** A quest row; `minutes` is null for a quest the catalog does not know. */
      questLine: (title: string, minutes: number | null) => `${title} · ${minutes ?? '?'} min`,
      add: { cta: '+ add' },
      added: { cta: 'added' },
      /** An episode as a plan item (`catalogLabel`). */
      episodeLabel: (title: string, quests: number) => `${title} (${plural('en', quests, { one: `${quests} quest`, other: `${quests} quests` })})`,
    },
    yours: {
      label: 'Your plan',
      title: (items: number) => `Your plan (${items})`,
      empty: 'Add quests or whole episodes from the catalog.',
      /** The reorder and remove buttons on each item (glyphs; a locale may swap them). */
      moveUp: { cta: '↑' },
      moveDown: { cta: '↓' },
      remove: { cta: '×' },
      dateFor: (item: number) => `Target date for item ${item}`,
      noteFor: (item: number) => `Note for item ${item}`,
      notePlaceholder: 'note (optional)',
    },
    pace: {
      title: 'Pace',
      start: 'Start date',
      perWeekLabel: 'Items per week',
      perWeek: (items: number) => `${items} / week`,
    },
    /** The audience choice; `everyone` is a stand-alone radio label (`planEveryone`). */
    who: {
      title: 'Who is this for',
      everyone: { family: 'everyone in this family', class: 'everyone in this class', school: 'everyone in this school', space: 'everyone in this space' },
      only: 'only:',
    },
    noneJoined: { family: 'No learners have joined yet.', class: 'No students have joined yet.', school: 'No members have joined yet.' },
    saving: { cta: 'Saving…' },
    cancel: { cta: 'Cancel' },
  },
  /**
   * The billing page (`/teach/billing`, `billing.ts`, F-I18N-001 PR 10b). Prices come from
   * `price.*` and `formatUsd`; plan limits, the free-class cap among them, arrive as numbers
   * from content-schema, so no locale types a limit into its copy.
   */
  billing: {
    title: 'Billing',
    cantCheck: "Can't check your plan right now.",
    checkoutFailed: "Couldn't start checkout. Try again.",
    portalFailed: "Couldn't open the billing portal.",
    current: {
      title: 'Current plan',
      /** `cap` is content-schema `FREE_CLASS_STUDENT_CAP` (`billing.ts freePlanLine`). */
      freeLine: (cap: number) => `Stage 1, local progress, Rescue Code, file backup. Classes hold up to ${cap} students.`,
    },
    yourAccount: 'your account',
    /**
     * How the plan was obtained (`sourceLine`) — never "paid": a 100%-off code costs nothing.
     * One whole sentence per provider (§3.1); the provider names live inside it.
     */
    source: (provider: 'stripe' | 'apple' | 'google' | 'manual', code: string | null) =>
      `via ${{ stripe: 'web (Stripe)', apple: 'App Store', google: 'Google Play', manual: 'contract' }[provider]}${code ? ` · code ${code}` : ''}`,
    seats: (seats: number) => plural('en', seats, { one: `${seats} seat`, other: `${seats} seats` }),
    manage: { cta: 'Manage subscription' },
    planTitle: { free: 'Free', family_lifetime: 'Family Plan', group_license: 'Group License', school_seat: 'School Contract' },
    includes: {
      /** `cap` / `freeCap` are content-schema `FREE_CLASS_STUDENT_CAP`. */
      free: (cap: number) => `Stage 1, local progress, Rescue Code, file backup; classes up to ${cap} students`,
      family_lifetime: (learners: number) => `Every Stage, new ones included, for one family: up to ${learners} learners, cloud sync, grown-up dashboard and plans`,
      group_license: (teachers: number, students: number, freeCap: number) =>
        `A class or school: every student premium while enrolled, no ${freeCap}-student cap; a school holds up to ${teachers} teachers / ${students} students`,
      school_seat: (students: number, teachers: number) => `Beyond ${students} students or ${teachers} teachers — seats by contract`,
    },
    /** The price column of the contract row. */
    contactPrice: 'Contact us',
    plans: { title: 'Plans' },
    promo: {
      formLabel: 'Promo code',
      placeholder: 'HOYA20',
      apply: { cta: 'Apply code' },
      change: { cta: 'Change code' },
      /** `name` is the promotion's own name, when it has one. */
      applied: (code: string, name: string | null) => `${code} applied${name ? ` · ${name}` : ''}.`,
      /** F-BILL-002 B-6: the collapsed promo box under the price line it rewrites. */
      disclosure: 'Have a code?',
    },
    choose: { cta: 'Choose' },
    contact: {
      cta: 'Contact us',
      /** F-BILL-002 B-6: the subject of the school contract mail link (no space name or id in it). */
      mailSubject: 'Hangul Route school contract',
    },
    isCurrent: { pill: 'current' },

    /*
     * F-BILL-002 B-6 (§6.1): the billing home on app.hangulroute.com (`APP_ROUTES.billing`), its
     * checkout return, receipts page and step-up dialog (wireframes billing/*). Names, dates and
     * amounts arrive as arguments (`formatDate`, `formatUsd`); limits arrive as numbers from
     * content-schema. The Family Plan renews yearly (AMENDMENTS-BILLING-FAMILY-YEARLY BY-D9).
     */
    testMode: 'Test mode: no real card is charged.',
    notConfigured: "Payments aren't set up yet. Nothing was charged.",
    liveOff: 'Payments are not open yet. Nothing was charged.',
    offline: "You're offline. Plans and receipts need a connection.",
    retry: { cta: 'Try again' },
    sections: { yours: 'Your plans', add: 'Add a plan', help: 'Help' },
    /** The kind half of a card heading ("Family · <space name>"). */
    kind: { family: 'Family', class: 'Class', school: 'School' },
    archived: '(archived)',
    /** The heading of a legacy account-subject card (section 4.2). */
    accountCard: { title: 'Your account' },
    /** The plan line of a card. */
    coverage: {
      free: 'Free plan',
      family: 'Family Plan',
      license: 'Group License',
      contract: 'School Contract',
      school: (school: string) => `Covered by ${licenseOf(school)}`,
      schoolUntil: (school: string, date: string) => `Covered by ${licenseOf(school)} until ${date}`,
    },
    /** The status line of a renewing plan; the date arrives formatted. */
    status: {
      renewsOn: (date: string) => `Renews on ${date}`,
      endsOn: (date: string) => `Ends on ${date}`,
    },
    /** What a viewer (not the payer) reads instead of actions. */
    readOnly: {
      family: 'The person who set up this family manages this plan.',
      class: 'The class owner manages this plan.',
      school: 'Your school manages this plan.',
    },
    /** The usage line; a null cap means no cap (`Usage.learnerCap` / `teacherCap`). */
    usage: {
      learners: usageCount('learner', 'learners'),
      students: usageCount('student', 'students'),
      teachers: usageCount('teacher', 'teachers'),
    },
    /** A family whose plan is active and that has no learner yet. */
    connectLearner: { line: 'Next: connect a learner to this family.', cta: 'Connect a learner' },
    /** A buy row: the plan title (`planTitle`) and the space name arrive as arguments. */
    buy: {
      forSpace: (plan: string, space: string) => `${plan} for ${space}`,
      family_lifetime: { cta: 'Get Family Plan' },
      group_license: { cta: 'Get Group License' },
    },
    /**
     * What a plan includes. The feature lines (`browse`, `reports`, `notes`) render only while the
     * feature is live (`SITE_CLAIMS`, F-SITE-002); limits arrive from content-schema.
     */
    includesLines: {
      family: {
        everyLesson: 'Every lesson of every Stage, new ones included',
        learners: (n: number) => plural('en', n, { one: `Up to ${n} learner in one family`, other: `Up to ${n} learners in one family` }),
        cloudSave: 'Cloud save on every device',
        browse: 'Browse every lesson as your learner sees it',
        reports: 'Reports on what went well and what to practice next',
        notes: 'Send notes to your learners',
      },
      license: {
        everyStudent: 'Every lesson for every student while they are enrolled',
        noCap: (cap: number) => `No ${cap}-student cap`,
        school: (teachers: number, students: number) =>
          `A school holds up to ${plural('en', teachers, { one: `${teachers} teacher`, other: `${teachers} teachers` })} and ${plural('en', students, { one: `${students} student`, other: `${students} students` })}`,
        browse: 'Browse every lesson as your students see it',
        reports: 'Student and class reports',
        notes: 'Send notes to your students',
      },
    },
    /** A grown-up with no space yet. */
    noSpaces: {
      title: 'Plans belong to a family or a class.',
      family: { cta: 'Set up for me or my family' },
      class: { cta: 'Set up a class' },
    },
    /** Checkout answered 409 `already_active`. */
    alreadyActive: 'This plan is already active. Nothing was charged.',
    /** The checkout return (wireframe billing/checkout-return). */
    checking: 'Almost there: checking your plan.',
    done: 'Thank you. The plan is active. Learners get it the next time they open Hangul Route.',
    stillProcessing: 'Your payment went through. The plan shows here in a minute.',
    checkAgain: { cta: 'Check again' },
    /** Receipts inline on a payer card and on the receipts page (wireframe billing/receipts). */
    receipts: {
      title: 'Receipts',
      all: { cta: 'All receipts' },
      empty: 'No receipts yet.',
      older: 'Older payments are in the receipt email from Stripe.',
      beyondLimit: "Older receipts: see Stripe's emails or write to us.",
      kind: { purchase: 'Payment', renewal: 'Renewal', refund: 'Refund', failed: "Payment didn't go through" },
      /** The column headers of the wide receipts table (the date column is the row header, §8). */
      column: { date: 'Date', what: 'What', plan: 'Plan', amount: 'Amount' },
      test: { pill: 'test' },
      view: { cta: 'View receipt' },
      viewA11y: (date: string) => `View receipt from ${date} (opens Stripe in a new tab)`,
      linkFailed: "Can't open this receipt right now.",
      pageTitle: (space: string) => `${space} · receipts`,
      notYours: 'This page is for the person who pays for this space.',
      cantLoad: "Can't load receipts right now.",
      back: { cta: 'Back to Billing' },
    },
    /** Confirm the grown-up before a payment, a plan change or a receipt (wireframe billing/step-up). */
    stepUp: {
      title: "Confirm it's you",
      body: 'Before a payment, a plan change or a receipt, sign in again.',
      reason: 'This keeps payments safe on a shared device.',
      cta: 'Continue',
      cancel: { cta: 'Not now' },
      cancelled: 'Nothing was changed.',
      unavailable: "Can't confirm right now. Try again in a moment.",
    },
    help: {
      refund: (email: string) => `Questions or a refund? Write to ${email}.`,
      learners: 'Learners never see prices or receipts.',
      sharedDevice: 'On a shared device? Sign out when you are done.',
    },
    /** One neutral note above the cards while a payer card is past due (never the danger colour). */
    pastDue: "A payment didn't go through. Update your card in Manage subscription; learners keep the full route for a week.",
    /**
     * F-BILL-002 B-12 (section 4.6): the space settings archive confirm names the plan the archive
     * affects. Archiving pauses the plan for learners; it never stops a subscription from renewing.
     */
    archiveConfirm: {
      familyLoses: (space: string) => `Learners in ${space} lose the Family Plan while it is archived.`,
      familyRenews: 'It keeps renewing until you cancel it in Billing.',
      licenseRenews: 'The Group License keeps renewing until you cancel it in Billing.',
    },
  },

  /**
   * The curriculum planner (F-PLAN-002 section 3.8, wireframe console/curriculum-planner): the
   * wizard at `teach/space/curriculum`, the week groups, readout and re-pace of a route plan on
   * the plan page, the roster and home entries, and the shared-catalogue item labels. The
   * generator emits codes and ids only; every word it implies is here. Caregiver surface:
   * never "behind", "late", "missed", "overdue" or a comparison; warnings are invitations.
   * Quest, story and episode titles are content and arrive as arguments.
   */
  curriculum: {
    title: 'Plan a term',
    pageTitle: (space: string) => `${space} · plan a term`,
    back: (space: string | null) => `← Back to ${space ?? 'the space'}`,
    step: (step: number, total: number) => `Step ${step} of ${total}`,
    next: { cta: 'Next' },
    previous: { cta: 'Back' },
    learner: {
      label: 'For',
      choose: 'Choose a learner…',
      required: 'Choose who this route is for to go on.',
    },
    start: {
      title: 'Where do they start?',
      label: 'Starting point',
      points: {
        'brand-new': { title: 'Brand new', line: 'Has not met Hangul yet.' },
        'some-letters': { title: 'Knows some letters', line: 'Knows a few letters and their sounds.' },
        'all-letters': { title: 'Knows all the letters', line: 'Knows the letters; syllables still take time.' },
        'reads-words': { title: 'Reads words', line: 'Reads syllables, final letters too.' },
        'first-words': { title: 'Reads first words', line: 'Ready for everyday words.' },
        'first-sentences': { title: 'Reads first sentences', line: 'Ready for short sentences.' },
      },
      /** One line, a pre-selection, never a list or a ranking (section 3.8 step 1). */
      hint: {
        class: (point: string) => `Most of your students start here: ${point}`,
        family: (point: string) => `Most of your learners start here: ${point}`,
      },
    },
    rhythm: {
      title: 'How long and how often?',
      length: 'How long?',
      lengths: {
        '4-week': { cta: '4 weeks' },
        '12-week': { cta: '12 weeks' },
        '6-month': { cta: '6 months' },
        custom: { cta: 'Choose weeks' },
      },
      weeks: 'Number of weeks (1 to 52)',
      chooseLength: 'Choose a length to go on.',
      badWeeks: 'Choose between 1 and 52 weeks.',
      startDate: 'Starts',
      startPast: 'Pick today or a later day.',
      sessions: 'Sessions a week',
      sessionsOption: (n: number) => `${n} a week`,
      days: 'Days they learn (optional)',
      daysHint: {
        class: 'Pick a class day and a homework day.',
        family: 'Leave them all off to spread the sessions over the week.',
      },
      daysChosen: (n: number) => plural('en', n, { one: `${n} day a week`, other: `${n} days a week` }),
      minutes: 'Minutes a session',
      minutesOption: (n: number) => `${n} min`,
      daysOff: 'Days off',
      daysOffHint: 'No sessions on these days. The route simply goes on after them.',
      addBreak: { cta: '+ Add a break' },
      breakFrom: 'From',
      breakTo: 'To',
      removeBreak: (n: number) => `Remove break ${n}`,
      remove: { cta: 'Remove' },
      breakMissing: 'Pick both dates for each break.',
      breakReversed: 'A break ends before it starts. Check its dates.',
      tooManyBreaks: 'A route holds up to 12 breaks.',
      sessionsNote: (sessions: number, weeks: number) =>
        `That is ${plural('en', sessions, { one: `${sessions} session`, other: `${sessions} sessions` })} in ${plural('en', weeks, { one: `${weeks} week`, other: `${weeks} weeks` })}.`,
      tooMany: 'That is more than a plan can hold. Choose fewer weeks or sessions.',
      /** Pace chips (F-PLAN-002 PR P2-6b, OD-13): Gentle 2, Steady 3, Brisk 4 days a week. */
      pace: 'How many days a week?',
      paces: { gentle: 'Gentle', steady: 'Steady', brisk: 'Brisk' },
      paceOption: (pace: string, n: number) => `${pace} · ${plural('en', n, { one: `${n} day a week`, other: `${n} days a week` })}`,
      /** The tag on the recommended pace and length (`proposeRoute`, the same as the app's). */
      suggested: 'Suggested',
      /** Weekdays whose count is on no pace chip: no suggestion is shown. */
      offChips: 'Your chosen days set the pace. Pick a pace to see a suggested length.',
    },
    goals: {
      title: 'What matters most?',
      focusLabel: 'Focus',
      focus: {
        balanced: 'A bit of everything',
        reading: 'Read Hangul',
        words: 'First words',
        culture: 'Culture and stories',
      },
      themes: 'Themes to start with (tap them in order)',
      themesHint: 'Stage 1 keeps its own order. The themes decide what comes after it.',
      themeNames: {
        letters: 'Letters',
        life: 'Food & Daily Life',
        rites: 'Holidays',
        nature: 'Nature',
        crafts: 'Play & Crafts',
      },
      themeChosen: (n: number, theme: string) => `${n}. ${theme}`,
      anchors: 'Mark Korean holidays (Hangeul Day, Seollal, Chuseok)',
      comingSoon: 'Include lessons that are not released yet',
      comingSoonLine: 'New episodes appear as they are released.',
      see: { cta: 'See the route' },
    },
    preview: {
      title: 'Your route',
      stats: (items: number, minutes: number, stage: number) =>
        `${plural('en', items, { one: `${items} lesson or story`, other: `${items} lessons and stories` })} · about ${minutes} minutes · ends in Stage ${stage}`,
      empty: 'Nothing is ready to plan for this starting point yet. Change something to try another range.',
      table: {
        label: 'The weeks of the route',
        week: 'Week',
        dates: 'Dates',
        kind: 'Kind',
        what: 'What',
        items: 'Items',
        extras: 'Extras',
      },
      dateRange: (from: string, to: string) => `${from} – ${to}`,
      kind: { learn: 'Learn', culture: 'Culture', review: 'Review', break: 'Days off' },
      label: {
        review: 'Review and collect',
        break: 'Days off',
        culture: (story: string) => `Culture week: ${story}`,
        cultureNoStory: 'Culture week',
        stories: 'Heritage stories',
        comingSoon: 'New episodes are on the way',
        freePractice: 'Free practice',
      },
      itemTag: { story: 'story', comingSoon: 'coming soon' },
      taggedItem: (title: string, tag: string) => `${title} (${tag})`,
      itemLine: (date: string, title: string) => `${date} · ${title}`,
      noItems: 'No items',
      extras: {
        vocab: (topic: string) => `Words: ${topic} (optional)`,
        hangulCheck: 'Hangul Check',
      },
      warnings: {
        contentRunsOut: (week: number) => `No new episodes yet from week ${week}. Free practice and word topics fill those weeks.`,
        comingSoon: (count: number) =>
          plural('en', count, {
            one: '1 episode is not released yet. It is in the plan and starts on its date once it is.',
            other: `${count} episodes are not released yet. They are in the plan and start on their dates once they are.`,
          }),
        premium: (count: number) =>
          plural('en', count, {
            one: '1 lesson needs Premium and is not in the plan.',
            other: `${count} lessons need Premium and are not in the plan.`,
          }),
        seePlans: { cta: 'See plans' },
        didNotFit: (count: number) =>
          plural('en', count, {
            one: '1 lesson or story did not fit. Add a week or a session to include it.',
            other: `${count} lessons and stories did not fit. Add a week or a session to include them.`,
          }),
        tooShort: (count: number) =>
          plural('en', count, {
            one: '1 item may take longer than one session.',
            other: `${count} items may take longer than one session.`,
          }),
        alreadyDone: (count: number) =>
          plural('en', count, {
            one: '1 lesson is left out because the starting point is past it.',
            other: `${count} lessons are left out because the starting point is past them.`,
          }),
      },
      change: { cta: 'Change something' },
      use: { cta: 'Use this route' },
      saving: { cta: 'Saving…' },
      draftNote: 'Using it saves a draft. Nothing reaches a learner until you publish it.',
      saveFailed: "Didn't save. Try again.",
      defaultTitle: (weeks: number) => plural('en', weeks, { one: `Route · ${weeks} week`, other: `Route · ${weeks} weeks` }),
    },
    builder: {
      fromTemplate: { cta: 'Start from a template' },
      plans: 'Plans',
      planChip: (title: string, status: string) => `${title} · ${status}`,
      activeRoute: 'active route',
      weekHeader: (week: number, dates: string, kind: string) => `Week ${week} · ${dates} · ${kind}`,
      reviewWeek: 'No items: a week to catch up or replay.',
      breakWeek: 'Days off: no sessions this week.',
      emptyWeek: 'No items this week: free practice.',
      unscheduled: 'Not in a week yet',
      discardEdits: 'Open another plan? The changes you have not saved here will be lost.',
      datesFromCalendar: 'Dates come from the route calendar. You can still change one date; a re-pace lays them out again.',
    },
    readout: {
      thisWeek: (week: number) => `This week (week ${week})`,
      notStarted: (date: string) => `The route starts ${date}.`,
      ended: 'The route has ended. Everything finished stays finished.',
      allWeeks: 'All weeks',
      line: (done: number, total: number, planned: number) => `${done} / ${total} so far · ${planned} planned`,
      lineNotReady: (done: number, total: number, planned: number, notReady: number) =>
        `${done} / ${total} so far · ${planned} planned · ${notReady} not ready yet`,
      waiting: 'waiting for the next sync',
      repace: { cta: 'Re-pace from today' },
      repaceHint: 'Keeps what is done and lays the rest from the next session.',
      repaceAsk: (date: string) => `Re-pace from today? What is done stays done. The rest moves to the next sessions, from ${date}.`,
      repaceNoSessions: 'No sessions are left before the route ends. Add weeks to keep going.',
      repaceLeftOver: (count: number, end: string) =>
        plural('en', count, {
          one: `1 item no longer fits before the route ends on ${end}.`,
          other: `${count} items no longer fit before the route ends on ${end}.`,
        }),
      repaceConfirm: { cta: 'Re-pace' },
      addWeeks: { cta: (n: number) => plural('en', n, { one: 'Add 1 week and re-pace', other: `Add ${n} weeks and re-pace` }) },
      cancel: { cta: 'Cancel' },
      repaced: 'Re-paced. Devices pick up the new dates on their next sync.',
      repaceFailed: "Couldn't re-pace right now. Try again.",
      refresh: { cta: 'Refresh route' },
      refreshLine: 'The catalogue has changed since this route was made. Refresh lays the rest of the route out again from today.',
      refreshAsk: (date: string) => `Refresh the route? What is done stays done. The rest is laid out again on the current catalogue, from ${date}.`,
    },
    entries: {
      planTerm: { cta: 'Plan this term' },
      ownRoute: (done: number, total: number, weeks: number) =>
        `Own route: ${done} / ${total} so far · ${plural('en', weeks, { one: `${weeks} week`, other: `${weeks} weeks` })}`,
    },
    /**
     * One honest line under each length chip (AMENDMENTS-PLC-PLAN-HANDOFF section 1.3, P2-6b): a
     * projection, never a deadline; a card never claims a finish its draft does not reach.
     */
    proposal: {
      lessonsAndStories: (stage: number, week: number) =>
        stage === 1 ? `Stage 1 is done around week ${week}, then heritage stories.` : `The lessons ready now are done around week ${week}, then heritage stories.`,
      lessonsCutShort: (weeks: number) => `The first lessons fit in ${weeks} weeks. More weeks hold the rest.`,
      lessonsThenFree: (weeks: number) =>
        plural('en', weeks, {
          one: 'About 1 week of lessons is ready now. The rest is free practice.',
          other: `About ${weeks} weeks of lessons are ready now. The rest is free practice.`,
        }),
      lessonsFill: (weeks: number) => `Lessons fill all ${weeks} weeks.`,
      storiesAndWords: (stories: number) =>
        stories > 0
          ? plural('en', stories, { one: 'No lessons left at this start: 1 heritage story and word topics.', other: `No lessons left at this start: ${stories} heritage stories and word topics.` })
          : 'No lessons left at this start: word topics and free practice.',
    },
    /**
     * A family learner card after a newer level check (section 3.8 step 4, FP-B5): the route can
     * move its start ahead (`reseed`) and keep its end date. Never per learner in a class.
     */
    update: {
      line: (name: string) => `${name}'s newest check found a later place to start.`,
      cta: 'Update the plan',
      label: (name: string) => `Update the plan for ${name}`,
      ask: (removed: number, added: number, next: string | null) => {
        const counts =
          removed > 0
            ? ` ${plural('en', removed, { one: '1 item leaves the plan', other: `${removed} items leave the plan` })}${
                added > 0 ? `, ${plural('en', added, { one: '1 joins it', other: `${added} join it` })}` : ''
              }.`
            : added > 0
              ? ` ${plural('en', added, { one: '1 item joins the plan', other: `${added} items join the plan` })}.`
              : '';
        return `Update the plan? It moves ahead from today and keeps the same end date.${counts}${next ? ` Next: ${next}.` : ''} What is done stays done.`;
      },
      done: 'Updated. Devices pick up the new plan on their next sync.',
      failed: "Couldn't update the plan right now. Try again.",
    },
    /** An episode that is not released yet; a ready one uses `plan.catalog.episodeLabel`. */
    catalog: {
      comingSoon: (title: string) => `${title} (coming soon)`,
    },
    /**
     * The wizard preview of an unlicensed space while the free-plan switch is on (F-ENT-003
     * section 3.9.3, wireframe console/curriculum-free-days; `NEXT_PUBLIC_CONTENT_GATING_ENABLED`).
     * `warning` replaces `preview.warnings.premium` with the weeks that hold lessons (`first` is
     * week 1 unless days off open the plan); `product` is `console.access.product.*`.
     * `warningNoLessons` is the same line when nothing open is scheduled (the wireframe's empty
     * state). `shortPlan` when stories follow the last lesson week, `shortPlanPractice` when
     * only practice, review or days off do. Never "day": the free plan is lessons, not time.
     */
    freeDays: {
      warning: (first: number, last: number, n: number, product: string) =>
        `The free plan covers Stage 1 (${first === last ? `lessons in week ${first}` : `lessons in weeks ${first} to ${last}`}). ${leftOut(n, product)}`,
      warningNoLessons: (n: number, product: string) => `The free plan covers Stage 1. ${leftOut(n, product)}`,
      shortPlan: (lastWeek: number) => `This plan has lessons until week ${lastWeek}. After that it has stories and practice.`,
      shortPlanPractice: (lastWeek: number) => `This plan has lessons until week ${lastWeek}. After that it has practice.`,
      useWeeks: { cta: (weeks: number) => plural('en', weeks, { one: `Use ${weeks} week`, other: `Use ${weeks} weeks` }) },
      /** Appended to the short-plan line when coming-soon episodes sit after the last lesson week. */
      shortPlanSoon: 'Episodes that are not released yet are listed there as well.',
      /** The left-out line while the switch is on and this viewer cannot tell whether a plan covers the space (section 3.11's neutral product words; no billing link). */
      warningNeutral: (n: number) => leftOut(n, 'the Family Plan or a Group License'),
      /** Replaces `preview.warnings.comingSoon` when `closed` of the `n` coming-soon episodes are past Stage 1: those open with `product` once released, not on their dates. */
      comingSoon: (n: number, closed: number, product: string) =>
        `${plural('en', n, { one: '1 episode is not released yet.', other: `${n} episodes are not released yet.` })} ${
          closed >= n
            ? plural('en', n, { one: `It is past Stage 1 and opens with ${product} once it is released.`, other: `They are past Stage 1 and open with ${product} once they are released.` })
            : `${plural('en', closed, { one: `1 of them is past Stage 1 and opens with ${product} once released.`, other: `${closed} of them are past Stage 1 and open with ${product} once released.` })} The others start on their dates once they are released.`
        }`,
    },
  },
  /**
   * The roster's level-check line and the advisory hand-off (F-PLC-001 section 3.9, wireframe
   * placement K). Summary only: no class average, no distribution, no ranking. The band label
   * comes from `learner.placement.band`, the same words the learner saw.
   */
  placement: {
    startingSpot: (stage: number, band: string, date: string) => `Starting spot: Stage ${stage} · ${band} · ${date}`,
    overridden: 'Changed by a grown-up',
    suggest: {
      cta: 'Suggest a different start',
      /** The control's accessible name on a roster card: starts with the visible words, then the learner. */
      label: (name: string) => `Suggest a different start for ${name}`,
    },
    /**
     * The pre-filled plan title (at most 60 characters). It names no learner: a plan title is
     * stored with the plan and outlives learner removal and roster aliases.
     */
    suggestTitle: 'A suggested next step',
    /** The pre-filled item note (a plan item note holds at most 80 characters). */
    suggestNote: 'Try this next',
    suggestFor: (name: string) => `A suggestion for ${name}. It arrives as a plan and never changes ${name}'s level check or progress.`,
  },

  /**
   * Lecture setup (`/teach/space/lecture`, `lecture.ts`, F-TCH-004 §3.11) and its entry points
   * (`entry` on the roster, `presentPlan` on the plan readout, `revisitChip` beside the roll-up).
   * Catalogue titles are content and arrive as arguments; taught jamo stay outside the messages
   * (the page renders them marked `lang="ko"`, §3.4 rule 5). No learner name is ever an argument.
   */
  lecture: {
    title: 'Lecture',
    titleFor: (space: string) => `${space} · lecture`,
    back: (space: string | null) => (space ? `← Back to ${space}` : '← Back to the space'),
    intro: 'Build a slide lesson from your content and show it on a classroom screen.',
    /** The page while `NEXT_PUBLIC_LECTURE_MODE` is off (the presenter is not in the learner app yet). */
    comingSoon: 'Lecture mode is coming soon: slide lessons you can show on a classroom screen.',
    plansFailed: "This space's plans did not load, so this week's plan is not offered. Try again to load them.",
    replaceOutline: 'Start a new outline from this source? The changes you made here will be replaced.',
    entry: { cta: 'Lecture' },
    presentPlan: { cta: 'Present this plan' },
    revisitChip: { cta: 'Revisit together' },
    source: {
      title: 'Source',
      plan: (plan: string, items: number) => `This week's plan: ${plan} (${planItems(items)})`,
      noPlan: 'No published plan yet.',
      catalogue: 'Pick from the catalogue',
      revisit: 'Revisit together',
      noRevisit: 'Nothing to revisit yet.',
      /** Taught jamo arrive as the argument; the page splits it with `aroundSlot` and marks them `lang="ko"`. */
      revisitWith: (jamo: string) => `Revisit together: ${jamo}`,
      trimmed: (count: number, max: number) =>
        plural('en', count, { one: `${count} more item did not fit: a lesson holds ${max} at most.`, other: `${count} more items did not fit: a lesson holds ${max} at most.` }),
    },
    catalogue: {
      title: 'Catalogue',
      stage1: 'Stage 1',
      stories: 'Stories',
      vocab: 'Vocabulary',
      add: { cta: '+ add' },
      added: { cta: 'Added' },
      line: (title: string, minutes: number | null) => `${title} · ${minutes === null ? '?' : minutes} min`,
      topicLine: (title: string, words: number, minutes: number | null) => {
        const time = `${minutes === null ? '?' : minutes} min`;
        return plural('en', words, { one: `${title} · ${words} word · ${time}`, other: `${title} · ${words} words · ${time}` });
      },
    },
    outline: {
      title: 'Outline',
      about: (minutes: number) => `about ${minutes} min`,
      empty: 'Add something to teach.',
      minutes: (minutes: number | null) => `${minutes === null ? '?' : minutes} min`,
      up: 'Move up',
      down: 'Move down',
      remove: 'Remove',
      upGlyph: '↑',
      downGlyph: '↓',
      /** Accessible names of a row's buttons; `item` is the row's own label (content title or block name). */
      upItem: (item: string) => `Move up: ${item}`,
      downItem: (item: string) => `Move down: ${item}`,
      removeItem: (item: string) => `Remove: ${item}`,
      quizLength: 'Quiz length',
      activityKind: 'Activity',
      activityLength: 'Activity length',
      full: (max: number) => `The outline is full: a lesson holds ${max} items at most.`,
      quizTooSmall: 'This quiz needs 4 or more letters or words taught before it. Add some above it, or the presenter leaves it out.',
      /** One outline row; content titles come from the catalogue mirrors (an unknown id shows itself). */
      block: {
        quiz: (rounds: number) => plural('en', rounds, { one: `Quick quiz: ${rounds} question`, other: `Quick quiz: ${rounds} questions` }),
        classCode: 'Class code on the last slide',
        letters: (count: number) => plural('en', count, { one: `${count} letter`, other: `${count} letters` }),
        cards: (count: number) => plural('en', count, { one: `${count} heritage card`, other: `${count} heritage cards` }),
      },
      addQuiz: { cta: '+ Quiz' },
      addActivity: { cta: '+ Activity' },
      addClassCode: { cta: '+ Class code' },
    },
    /** `ACTIVITY_PRESETS` (content-schema), the same names the presenter shows. */
    activity: {
      'air-write': 'Write it in the air',
      'say-together': 'Say it together',
      'pair-share': 'Pair and share',
      'copy-on-paper': 'Copy it on paper',
      'stretch-break': 'Stretch break',
    },
    options: {
      title: 'Options',
      romanization: 'Romanization',
      romanizationAlways: 'always',
      romanizationTap: 'hide until tapped',
      strokeGuide: 'Stroke guide',
      strokeNote: 'Simplified: not a calligraphy reference.',
      sound: 'Play sounds',
      language: 'Presenter language',
    },
    picker: {
      title: 'Helper picker',
      mode: { names: 'names', initials: 'initials', numbers: 'numbers', none: 'none' },
      hidden: 'This space hides names, so the picker uses initials.',
      privacy: 'Names are sent straight to the presenter tab and are not in the link. They are not saved on the classroom device. A copied link has no names.',
    },
    titleField: { label: 'Lesson title', placeholder: 'Week 3 letters', hint: "Do not put a student's name in the title." },
    titleProblem: {
      empty: 'Give the lesson a title.',
      chars: 'Use letters, numbers, spaces and simple punctuation, 60 at most.',
      banned: 'Choose kinder words for the title.',
      name: 'Take the name out of the title: names are never put in the link.',
    },
    check: {
      title: 'Check the classroom device',
      offline: 'Open the presenter once with Wi-Fi so it works offline.',
      voice: 'Check there is a Korean voice (the presenter tells you).',
      screen: 'Check the projector or TV shows the whole slide.',
      progress: "This changes nobody's progress.",
      prepare: 'Prepare here online; the presenter works offline.',
    },
    open: { cta: 'Open presenter' },
    copyLink: { cta: 'Copy link' },
    copied: { cta: 'Link copied' },
    copyFailed: 'The link was not copied. Try again, or use Open presenter.',
    linkFailed: 'This lesson does not fit in a link. Take out a few items and try again.',
    copyNoNames: 'A copied link has no names: its picker uses numbers.',
    copyHasCode: 'This link holds your class join code. Anyone with the link can join until you make a new code. Copy it anyway?',
    popupBlocked: 'Allow pop-ups for this site to open the presenter, or copy the link.',
    nothing: 'Add at least one item to the outline.',
  },

  /**
   * Space settings (`/teach/space/settings`, F-TCH-001 §10.3, F-I18N-001 PR 10c): housekeeping
   * only, never progress data. Space, member and learner names arrive as arguments; the page keeps
   * a note key (`notes.*`) and words it at render time. Kind-keyed groups are one whole sentence
   * or label per kind (§3.1), so no locale glues a kind into a phrase.
   */
  settings: {
    title: 'Settings',
    titleFor: (space: string) => `${space} · settings`,
    back: (space: string | null) => `← Back to ${space ?? 'the space'}`,
    forbidden: "This space isn't yours to manage.",
    archived: {
      family: 'This family is archived — read-only until you unarchive it.',
      class: 'This class is archived — read-only until you unarchive it.',
      school: 'This school is archived — read-only until you unarchive it.',
    },
    notes: {
      codeReady: 'New code ready.',
      codeFailed: "Couldn't make a new code right now.",
      saved: 'Saved.',
      saveFailed: "Didn't save.",
      removed: 'Removed.',
      removeFailed: "Didn't remove.",
      archived: 'Archived.',
      unarchived: 'Unarchived.',
      deleted: 'Deleted everywhere.',
      deleteFailed: "Couldn't delete.",
    },
    joinCode: {
      title: 'Join code',
      /** Followed by `oldCodeStops` in the confirm dialog. */
      regenerateAsk: 'Make a new code?',
      regenerate: { cta: 'Regenerate' },
      create: { cta: 'Create a code' },
    },
    consent: {
      title: 'Consent mode',
      parent: 'A parent consents (email at join — coming later)',
      school: 'The school attests for its students',
      notYet: 'not yet',
    },
    privacy: {
      title: 'Privacy',
      anonymize: 'Anonymize roster',
    },
    grownUps: {
      label: 'Members',
      title: 'Grown-ups',
      /** A member's role: a server code (content-schema `SpaceRole`) worded here. */
      role: { owner: 'owner', caregiver: 'caregiver', teacher: 'teacher', admin: 'admin', student: 'student' },
      /** `role` arrives worded (`role.*`); `you` marks the signed-in grown-up. */
      roleLine: (role: string, you: boolean) => (you ? `${role} (you)` : role),
      removeAsk: (name: string, space: string) => `Remove ${name} from ${space}?`,
      remove: { cta: 'Remove' },
      invite: {
        family: 'Invite a co-parent: they sign in and enter the code above.',
        class: 'Co-teachers arrive later.',
        school: 'Invite a teacher: they sign in and enter the code above.',
      },
    },
    learners: {
      label: 'Learners',
      title: { family: 'Family learners', class: 'Class students', school: 'School members' },
      none: 'No one has joined yet — share the code.',
      removeAsk: (name: string, space: string) => `Remove ${name} from ${space}? Their progress stays with them.`,
      remove: {
        family: { cta: 'Remove from family' },
        class: { cta: 'Remove from class' },
        school: { cta: 'Remove from school' },
      },
    },
    danger: {
      title: 'Danger zone',
      /** Followed by `archiveKeeps` in the confirm dialog. */
      archiveAsk: (space: string) => `Archive ${space}?`,
      archive: {
        family: { cta: 'Archive this family' },
        class: { cta: 'Archive this class' },
        school: { cta: 'Archive this school' },
      },
      unarchive: { cta: 'Unarchive' },
      deleteTitle: "Delete a learner's data",
      deleteLabel: 'Learner to delete',
      chooseLearner: 'Choose a learner…',
      typeToConfirm: (name: string) => `Type "${name}" to confirm`,
      /** Holds the learner's name, so it is not a budgeted `cta`; the button wraps. */
      deleteData: (name: string) => `Delete ${name}'s data`,
    },
    backToConsole: { cta: 'Back to console' },
  },
  /**
   * The school admin view (`SchoolAdmin`, `school.ts`, F-SCHOOL-001 §3.3, F-I18N-001 PR 10c),
   * rendered by `/teach/space` for a school: aggregates only. Plan names come from
   * `billing.planTitle`, the licence status from `entitlementStatus`, the code expiry from
   * `codeExpiry`; class, teacher and school names arrive as arguments.
   */
  school: {
    title: 'School',
    titleFor: (school: string) => `${school} · school`,
    forbidden: "This school isn't yours to manage.",
    /** The link after `schoolLicenceLapsed`. */
    billingLink: 'Billing',
    notes: {
      codeReady: 'New invite code ready.',
      codeFailed: "Couldn't make a new code.",
      assigned: 'Teacher assigned.',
      assignFailed: "Couldn't assign — have they joined the school?",
      classCreated: 'Class created — assign a teacher when they have joined.',
      createFailed: "Couldn't create the class.",
    },
    licence: {
      label: 'Licence and seats',
      title: 'Licence',
      line: (plan: string, status: string) => `${plan} · ${status}`,
      none: 'none',
      seats: 'Seats',
      /** Seats used against the licence (`usageLine`); a `null` limit has no cap. */
      usage: (students: number, studentLimit: number | null, teachers: number, teacherLimit: number | null) =>
        `${studentLimit === null ? `students ${students}` : `students ${students} / ${studentLimit}`} · ${teacherLimit === null ? `teachers ${teachers}` : `teachers ${teachers} / ${teacherLimit}`}`,
      manage: { cta: 'Manage billing' },
    },
    invite: {
      title: 'Invite a teacher',
      /** `expiry` comes from `codeExpiry`. */
      role: (expiry: string) => `role: teacher · ${expiry}`,
      /** Followed by `oldCodeStops` in the confirm dialog. */
      regenerateAsk: 'Make a new invite code?',
      regenerate: { cta: 'Regenerate' },
      create: { cta: 'Create a code' },
    },
    week: {
      label: 'This week',
      title: 'This week (whole school)',
      line: (practiced: number, students: number, classesWithPlan: number, classes: number) =>
        `${practiced} of ${students} students practiced · ${classesWithPlan} of ${classes} classes have a published plan`,
    },
    classes: {
      title: 'Classes',
      /** One class row; `active` comes from `relativeDay`, the student count goes through plural(). */
      line: (teacher: string | null, students: number, active: string, planPublished: boolean) =>
        `${teacher ?? 'no teacher yet'} · ${plural('en', students, { one: `${students} student`, other: `${students} students` })} · active ${active}${planPublished ? ' · plan published' : ''}`,
      teacherFor: (className: string) => `Teacher for ${className}`,
      chooseTeacher: 'Choose a teacher…',
      cancel: { cta: 'Cancel' },
      change: { cta: 'Change teacher' },
      assign: { cta: 'Assign teacher' },
      open: { cta: 'Open roster →' },
      newField: { label: 'New class', placeholder: 'Sunday Class C' },
      add: { cta: '+ New class' },
    },
    settingsLink: 'School settings',
    /** The page renders `link` as a link (`aroundSlot`), so a translation may put it anywhere, exactly once. */
    footer: (link: string) => `${link} · rosters opened from here show initials by default.`,
  },
  /**
   * The family home `/parent` (F-APP-001 A-5b, section 3.8; design/screens/app-shell/parent-home.md):
   * one section per family space, one card per learner in join order. Counts only, labelled "last 7
   * days", never ranked or compared. Card and family actions show only with their sibling flags.
   */
  parentHome: {
    /** Visually hidden page heading; each family's name is its section heading. */
    title: 'Family home',
    minutes7d: (n: number) => `Minutes, last 7 days: ${n}`,
    child: { open: 'Open', seeReport: 'See report', sendNote: 'Send a note', route: 'Learning Route' },
    actions: { lessons: 'Lessons', planWeek: 'Plan the week', planTerm: 'Plan the term', settings: 'Family settings', addLearner: 'Add a learner' },
    /** A family with no learner yet: the join code panel, this line and the hand-off to the learner app on this device. */
    empty: {
      title: 'No learner has joined yet.',
      /** `profile`, `section` and `join` are the learner app's own labels (`learner.home.profileLabel`, `caregiver.spaces.title`, `caregiver.spaces.join.cta`). */
      line: (profile: string, section: string, join: string) => `On the learner's own device, go to ${profile}, then ${section}, then "${join}", and enter this family code.`,
      openApp: 'Open the app on this device',
    },
    /** The account holds no family space (a teacher who chose Family, an old link). */
    noFamily: { title: "You don't have a family space yet.", setUp: 'Set up my family', goTeacher: 'Go to Classes' },
    /** The quiet cross-link at the bottom: set up a class, or switch to it. */
    cross: { addClass: 'Also teach a class? Set up a class', toTeacher: 'Your classes are under Teacher' },
    /** The name of a family's side column of actions, apart from the family's own section (its heading). */
    actionsFor: (family: string) => `Actions for ${family}`,
    /** A caregiver who is not the owner: only the owner makes a family code (the API sends it with `space.manage`). */
    askOwner: 'Ask the family owner for a family code.',
    /** The clipboard refused: the code is still on screen. */
    copyFailed: "Couldn't copy. The code is on the screen.",
  },
  /**
   * The journey strip on a roster card (F-ROUTE-001 section 3.12, R-9a; Appendix B
   * `console.journey`; wireframe `design/wireframes/console/roster.md` "Journey strip"): seven
   * drawn segments with a word each, "On Stage N", and one line per stage in a `<details>`.
   * Counts only: a stage's `total` is never shown, and nothing is averaged, ranked or sorted.
   * The stage states are the words of `summary.journey` (`complete`, `known`, `explored`, `open`,
   * `later`); grown-up copy may name the level check.
   */
  journey: {
    /** The page name (AMENDMENTS-ROUTE-LEARNING-ROUTE section 7.2, LR-1). */
    title: 'Learning Route',
    onStage: (n: number) => `On Stage ${n}`,
    /** "4 known from the level check, 2 quests done"; the known part is left out when it is 0. */
    stageLine: (known: number, done: number) => {
      const quests = plural('en', done, { one: `${done} quest done`, other: `${done} quests done` });
      return known > 0 ? `${known} known from the level check, ${quests}` : quests;
    },
    /** One stage with its line or its state word: "Stage 1: 4 quests done". */
    stage: (n: number, text: string) => `Stage ${n}: ${text}`,
    /** A run of stages with nothing in them yet: "Stages 5 to 7: Coming later". */
    stages: (from: number, to: number, text: string) => `Stages ${from} to ${to}: ${text}`,
    details: 'Stage by stage',
    state: {
      complete: 'Complete',
      known: 'Known from the level check',
      explored: 'Explored',
      open: 'Open',
      later: 'Coming later',
    },
  },
  /**
   * The offline page of grown-up paths on the app host (F-APP-001 sections 3.4 and 3.12, A-2;
   * wireframe `design/wireframes/shell/offline.md`). Not drawn by the console: the learner app's
   * `scripts/pwa-postbuild.mjs` reads it at build time into `dist/grown-ups-offline.html`, which
   * the service worker serves when a grown-up page is opened without a network. A learner may
   * follow a grown-up link and see it, so the copy is neutral (no age wording).
   */
  offline: {
    title: "You're offline",
    line: 'Grown-up pages need the internet. Learning still works offline.',
    back: 'Back to learning',
    retry: 'Try again',
  },
  /**
   * The grown-up lock (F-APP-001 section 3.9, wireframe shell/grown-up-lock.md): the screen a
   * grown-up page shows on a shared device until a fresh PIN or a sign-in opens it. It is the
   * screen a child would meet, so it names nobody, shows no number and has no countdown.
   * `line` goes with the PIN button; the other lines are the sign-in-only cases, and each
   * promises only what a sign-in can do on that device: `pinRenew` for a PIN set before A-6
   * (never trusted), `signInOnly` where no PIN path exists (a learner app older than A-6, or a
   * device read that failed).
   */
  lock: {
    title: 'Grown-ups only',
    line: "Enter this device's grown-up PIN, or sign in again.",
    usePin: { cta: 'Use the grown-up PIN' },
    signInAgain: { cta: 'Sign in again' },
    backToLearning: { cta: 'Back to learning' },
    pinChanged: 'The grown-up PIN changed on this device. Sign in again to use it.',
    firstSignIn: 'Sign in once on this device to use the grown-up PIN here.',
    noPin: 'Set a grown-up PIN in the app, or sign in again.',
    pinRenew: 'To use the grown-up PIN here, set it again in the app, then sign in once.',
    signInOnly: 'Sign in again to open grown-up pages on this device.',
  },
  /**
   * The free-plan words of grown-up console surfaces (F-ENT-003 section 3.11 glossary): the
   * product that opens Stage 2 and later, named by space kind (a family space -> the Family Plan,
   * which renews yearly [BY]; a class or school -> a Group License), and the link to the
   * console's Billing route. No price, no "Premium"; the link is F-BILL-002's **Open billing**,
   * never "See plans".
   */
  access: {
    product: {
      family: 'the Family Plan',
      class: 'a Group License',
    },
    openBilling: { cta: 'Open billing' },
    /**
     * The free-lessons line (F-ENT-003 section 3.9.2, E3-12; wireframe console/free-lessons-line),
     * worded from `freeLessonsLine`'s code: `freeEnd` (the device knows), `planWaiting` (a roster
     * card: every open item of this plan is done, `n` closed items remain), `freePlan` (the
     * learner report's neutral line; `lessons` from `freeLessonsFacts`). Shown to the space
     * owner only, followed by **Open billing**.
     */
    freeEnd: (name: string, product: string) => `${name} finished the free lessons. Stage 2 and later open with ${product}.`,
    planWaiting: (name: string, n: number, product: string) =>
      `${name} finished everything open in this plan. ${plural('en', n, { one: `${n} more lesson opens with ${product}.`, other: `${n} more lessons open with ${product}.` })}`,
    freePlan: (lessons: number, product: string) =>
      `On the free plan, all of Stage 1 is open (${plural('en', lessons, { one: `${lessons} lesson`, other: `${lessons} lessons` })}). Stage 2 and later open with ${product}.`,
  },
  /**
   * The grown-up Learning Route (AMENDMENTS-ROUTE-LEARNING-ROUTE sections 6.1, 6.3 and 11.1, LR-7;
   * wireframes console/learning-route.md and parent/learning-route.md): the goal line, the route
   * card, the stage list page of one learner and the class plan line. Written about the learner
   * from the roster name; it may address the grown-up ("Your class's ...").
   * - Case 1 (`learnerGoal`, `fromLead`, `reached`, `goalTag`) is the only one that names the
   *   learner's own goal: the family space holds `summary.routeGoal`, the goal the learner's device
   *   shows. Cases 2 and 3 speak about the plan or the road, never "{name}'s goal" (section 7.3).
   * - No count of zero, no ratio, no ranking, no date pressure and no billing words: the stage line
   *   leaves its zero parts out (`knownLine` is the known part alone, worded as `journey.stageLine`).
   * - "Weekly plan" names every dated plan; the page is "Learning Route" in title case (LR-OD-1).
   * The can-do lines are the shared `learner.myRoute.stage.canDo` entry, never copied here.
   */
  learningRoute: {
    title: (name: string) => `${name}'s Learning Route`,
    /** The report's "At a glance" link (F-REPORT-001 RP-7a2) and the family home card link (F-APP-001). */
    open: 'Open Learning Route',
    /** The label of the card's section on the report. */
    section: 'Learning Route',
    /** The heading over the stage list page's list of stages (LR-D). */
    stagesTitle: 'Stages',
    /** `space`: the kind-neutral words while the space is still loading or could not be read (LR-8). */
    back: { report: 'Back to the report', class: 'Back to the class', family: 'Back to the family', space: 'Back' },
    now: (name: string, n: number, title: string) => `${name} is on Stage ${n}: ${title}.`,
    learnerGoal: (name: string, n: number, title: string) => `${name}'s goal: Stage ${n} · ${title}`,
    /** Who set the goal the learner's device shows (`summary.routeGoal.from`). */
    fromLead: {
      class: "From the class's weekly plan",
      school: "From the school's weekly plan",
      family: "From your family's weekly plan",
      self: (name: string) => `From ${name}'s own weekly plan`,
      default: "Hoya's suggestion: the next open stage",
    },
    reached: (name: string, n: number, title: string) => `${name} reached the goal: Stage ${n} · ${title}.`,
    planReaches: {
      class: (n: number, title: string) => `Your class's weekly plan reaches Stage ${n} · ${title}`,
      family: (n: number, title: string) => `Your family's weekly plan reaches Stage ${n} · ${title}`,
    },
    stageReached: (name: string) => `${name} reached this stage.`,
    nextOpen: (n: number, title: string) => `Next open stage: Stage ${n} · ${title}`,
    canDoLead: (name: string) => `By the end of this stage, ${name} can:`,
    /** The date arrives formatted; grown-up views only (LR-OD-7), never "late" or "behind". */
    planEnds: (date: string) => `Plan ends ${date}`,
    endOfRoad: (name: string) => `${name} reached the end of the open road. More is coming.`,
    hereTag: (name: string) => `${name} is here`,
    startTag: (name: string) => `${name} started here`,
    goalTag: (name: string) => `${name}'s goal`,
    planGoalTag: 'Plan goal',
    updated: (date: string) => `Updated ${date}`,
    notSynced: (name: string) => `The Learning Route appears after ${name}'s next sync on the newest app.`,
    notFound: 'We could not find this learner in this space.',
    /** A stage line with nothing done: the known part of `journey.stageLine` alone, so a row never reads "0 quests done". */
    knownLine: (known: number) => `${known} known from the level check`,
    /** A stage row's heading, "2. Words · Open": the order, the stage title and its state word, ordered by the locale (LR-8). */
    stageRow: (n: number, title: string, state: string) => `${n}. ${title} · ${state}`,
  },
  /**
   * Class moves (F-SPACE-002 section 4.8, PR T-6a; mockups `design/screens/transfer/`, T-0b #472). "Move" is the
   * user-facing word everywhere; `transfer` stays the internal name. The class pages say "student" through
   * `memberNoun` (`memberNounSingular`), the family page says "learner". No card ever names who said no: every
   * ending is `ended` with a date. No countdown on a family or destination surface (`daysLeft` is source-only
   * meta text), no red, no price or plan name. Dates arrive formatted. The consent lines themselves are not here:
   * they are the keyed en / ko / es catalogue `TRANSFER_CONSENT_TEXT` in content-schema (section 4.11); `consent`
   * below holds only the sheet's frame around them.
   */
  transfer: {
    /** Page heading and the document title's first part (T14: never a name in a title). */
    title: 'Class moves',
    /** `memberNounSingular(kind)`: one member of a space, for teacher and class copy. */
    memberNoun: { family: 'learner', class: 'student', school: 'member' },
    /** The roster button (permanent, as Re-link's) and the home and school-row counts; a count of 0 shows `entry.cta`. */
    entry: { cta: 'Class moves' },
    waiting: (n: number) => plural('en', n, { one: `${n} class move waiting`, other: `${n} class moves waiting` }),
    /** A school row's link to one child class (counts only). */
    schoolRow: (className: string, n: number) => `${className}: ${plural('en', n, { one: `${n} class move waiting`, other: `${n} class moves waiting` })}`,
    back: (space: string) => `Back to ${space}`,
    groups: {
      leaving: 'Leaving this class',
      joining: 'Joining this class',
      asked: 'Asked about your learners',
      start: 'Start a move',
      prefs: 'Move requests from teachers',
      history: 'Earlier',
    },
    empty: 'Nothing waiting.',
    /** Each step is a glyph, the step name and a state word (never colour alone). */
    steps: {
      family: 'Family',
      thisClass: 'This class',
      newClass: 'New class',
      saidYes: 'said yes',
      youSaidYes: 'you said yes',
      waiting: 'waiting',
    },
    /** Card meta: when it was asked; `days` is whole days since the request (0 = today). */
    meta: {
      asked: (days: number) => (days === 0 ? 'asked today' : plural('en', days, { one: `asked ${days} day ago`, other: `asked ${days} days ago` })),
      askedByFamily: (days: number) =>
        days === 0 ? 'asked by the family · today' : plural('en', days, { one: `asked by the family · ${days} day ago`, other: `asked by the family · ${days} days ago` }),
      askedByClass: (className: string, days: number) =>
        days === 0
          ? `Asked by the teacher of ${className} · today`
          : plural('en', days, { one: `Asked by the teacher of ${className} · ${days} day ago`, other: `Asked by the teacher of ${className} · ${days} days ago` }),
      /** Source teacher's cards only, plain meta text (no countdown elsewhere). */
      daysLeft: (days: number) => plural('en', days, { one: `${days} day left`, other: `${days} days left` }),
    },
    /** Card lines, one short sentence each. */
    lines: {
      familyAsked: (name: string) => `${name}'s family asked to move to another class.`,
      familyAskedTo: (name: string, destination: string) => `${name}'s family asked to move to ${destination}.`,
      waitingAll: 'Nothing changes until all three say yes.',
      waitingFamily: 'Waiting for the family.',
      newClass: (destination: string) => `New class: ${destination}`,
      agreedBySchoolAdmin: 'Agreed by the school admin.',
      waitingRoom: 'Waiting for room in the new class.',
      scheduled: (date: string) => `Everyone agreed. The move happens on ${date}.`,
      familySaidYes: 'The family has said yes.',
      comingFrom: (source: string) => `Coming from ${source}.`,
      youSaidYes: 'You said yes. Nothing changes until everyone says yes.',
      fullClass: 'Everyone has said yes. This class is full right now.',
      fullSchool: 'Everyone has said yes. The school is full right now.',
      moveWaiting: 'Everyone has said yes. The move is waiting.',
      learnerCap: (name: string) => `${name} is in the most classes allowed. Leave one, then the move can go ahead.`,
      newCode: 'Your class code may have been shared during the move. You can make a new one.',
      /** Family cards. */
      waitingBoth: (date: string) => `Waiting for the other classes. The move happens after ${date} if both say yes. You can cancel any time.`,
      waitingOne: (date: string) => `Waiting for the other class. The move happens after ${date} if it says yes. You can cancel any time.`,
      planned: (date: string) => `A move is planned for ${date}.`,
      checkAgain: 'Please check this again.',
      moved: (name: string, className: string) => `Moved. ${name} is now in ${className}. Cards and stars stayed with ${name}.`,
      movedTablet: (source: string) => `A tablet that joined through ${source} needs to join again.`,
      movedOwn: (name: string, className: string) => `${name} moved to ${className} on their own.`,
      notNowEnds: 'Not now ends this request. You can start a move yourself any time.',
      manageOwn: (name: string) => `${name} manages their own classes. Ask them to start a move on their device.`,
    },
    /** History rows: a date and one of these, never a name (`noun` is `memberNoun`). */
    history: {
      movedOut: (noun: string) => `A ${noun} moved to another class`,
      joined: (noun: string) => `A ${noun} joined this class`,
      ended: 'This request ended.',
      endedFromTablet: (name: string) => `Ended from ${name}'s tablet.`,
    },
    actions: {
      agree: { cta: 'Agree' },
      agreeBoth: { cta: 'Agree for both classes' },
      notNow: { cta: 'Not now' },
      noRoom: { cta: 'No room' },
      accept: { cta: 'Accept' },
      cancelRequest: { cta: 'Cancel request' },
      cancel: { cta: 'Cancel' },
      tryAgain: { cta: 'Try again' },
      refresh: { cta: 'Refresh' },
      newCode: { cta: 'New class code' },
      review: { cta: 'Review and agree' },
      view: { cta: 'View' },
      backToRoster: { cta: 'Back to the roster' },
    },
    /** Page and card states (wireframe "States"). */
    states: {
      failed: "Didn't go through",
      changed: 'Something changed. Look again.',
      forbidden: "You can no longer answer this class's moves.",
      locked: "Class moves aren't available yet.",
      offline: 'This needs internet.',
      familyTooNew: 'Moves open one day after a family is set up.',
      conflicted: "A teacher of this class can't answer for the family.",
    },
    /** The settings learner row and the start sheet (T-6c; `start-sheet.md`). */
    start: {
      move: { class: { cta: 'Move to another class' }, family: { cta: 'Move to a class' } },
      title: (name: string) => `Move ${name} to another class`,
      step1: 'Ask the other teacher for their class code.',
      find: { cta: 'Find class' },
      looking: { cta: 'Looking…' },
      found: (destination: string) => `Move to "${destination}"?`,
      familyFirst: 'The family is asked first. The other class sees nothing until the family says yes. Then it sees only initials, a picture and a level until the move.',
      nothingUntil: 'Nothing changes until everyone has said yes, and then not for 2 days.',
      keeps: (name: string) => `${name} keeps cards and stars. You can cancel any time before the move.`,
      send: { cta: 'Send request' },
      sending: { cta: 'Sending…' },
      sent: 'Request sent. Nothing changes until everyone says yes.',
      /** The family's Start a move panel (T-6d; `family-page.md`). */
      learner: 'Learner',
      nowIn: 'Now in',
      newCode: 'New class code',
      noLearner: 'No learner here is in a class right now.',
      prefs: 'Do not accept move requests from teachers',
    },
    /** One sentence per answer of preview / create, under the code field (`startErrorKey`). */
    errors: {
      codeNotFound: "That code didn't work.",
      codeExpired: 'That code is too old. Ask for a new one.',
      full: 'That class is full right now.',
      alreadyMember: (name: string) => `${name} is already in that class.`,
      tooManyAttempts: 'Too many tries. Try again later.',
      cannotSend: "This request can't be sent right now.",
      familyNeeded: 'A family account is needed to answer this. Ask the family to start the move from their app.',
      sameSpace: (name: string) => `That code is for the class ${name} is in now.`,
      alreadyOpen: (name: string) => `${name} already has a move waiting.`,
      alreadyOpenClass: (name: string) => `A class already asked about moving ${name}. Its card is above.`,
      alreadyOpenFamily: (name: string) => `A move for ${name} is already waiting. Its card is above.`,
      destinationBusy: 'That class has many moves waiting. Try again in a few days.',
      tooManyRequests: 'Too many moves were started today. Try again tomorrow.',
      notTransferable: "That code can't be used for a move.",
      cooldown: 'You can ask again in about a week.',
      localeUnavailable: 'Not available in your language yet.',
    },
    /**
     * The consent sheet's frame (T-6d; `consent-sheet.md`): title, identity block, `visible_today` items, the reading
     * hint and the buttons. The sheet renders this frame in the language its switch picks, like the lines.
     */
    consent: {
      title: (name: string, destination: string) => `Move ${name} to ${destination}?`,
      language: 'Language',
      who: 'Who is the new class?',
      teacher: (owner: string) => `Teacher: ${owner}`,
      learners: (n: number) => plural('en', n, { one: `${n} learner`, other: `${n} learners` }),
      age: { days: 'Less than a week old', weeks: 'A few weeks old', months: 'A few months old', years: 'More than a year old' },
      visibleClass: (space: string, owner: string) => `${space} (teacher ${owner})`,
      visibleYou: (family: string) => `${family} (you)`,
      visibleFamily: (family: string, owner: string) => `${family} (family, ${owner})`,
      readToEnd: 'Read to the end to continue.',
      updated: 'This text was updated. Please read it again.',
      unavailable: 'Not available in your language yet.',
      yes: (name: string) => `Yes, move ${name}`,
      notNow: { cta: 'Not now' },
      tryAgain: { cta: 'Try again' },
      failed: "Didn't go through",
    },
    /** Read aloud, never drawn. */
    a11y: {
      steps: 'Who has said yes',
      reasons: 'Choose an answer',
      notNowReasons: 'Not now, choose a reason',
      updated: 'Class moves updated.',
      to: 'to',
      close: 'Close',
      moveRow: (name: string) => `Move ${name} to another class`,
      moveRowFamily: (name: string) => `Move ${name} to a class`,
    },
  },
  /**
   * Notes from grown-ups on app.hangulroute.com (F-FEEDBACK-001 FB-5; wireframes console/note-composer.md,
   * console/notes-sent.md, console/family-notes.md, console/notes-hub.md). FB-10 builds the view models,
   * FB-11a, FB-11b and FB-12 render them. Where the space kind changes the word, a `class` / `family`
   * pair says "students" or "learners". Status words stay neutral (section 9): never "unread" or "no
   * reply", and a class sender never sees "Opened" (OD-8). A teacher is named by the class, never by the
   * account (section 8.2-a). Nothing here mentions a price or a plan (OD-7).
   */
  notes: {
    sendNote: { cta: 'Send a note' },
    newNote: { cta: 'New note' },
    /** The roster header action of a class or family page (FB-11a). */
    roster: { notes: { cta: 'Notes' } },
    hub: {
      title: 'Notes',
      open: { cta: 'Notes' },
      none: { parent: 'Create your family space to send notes.', teacher: 'Create a class to send notes.' },
      start: { cta: 'Start' },
      error: 'Could not load your spaces. Try again.',
      retry: { cta: 'Try again' },
    },
    /** Status words of a sent note; keys are the API statuses. `opened` is shown in a family space only. */
    status: { sent: 'Sent', opened: 'Opened', not_shown: 'Not shown', withdrawn: 'Taken back' },
    sent: {
      title: (space: string) => `Notes · ${space}`,
      back: { class: 'Back to class', family: 'Back to family' },
      disclosure: 'Teachers see the answer a student picks. They do not see when a note was read.',
      filter: { label: 'Show', everyone: 'Everyone' },
      to: {
        everyone: {
          class: (n: number) => `To everyone (${n} ${plural('en', n, { one: 'student', other: 'students' })})`,
          family: (n: number) => `To everyone (${n} ${plural('en', n, { one: 'learner', other: 'learners' })})`,
        },
        learner: (name: string) => `To ${name}`,
      },
      signed: (label: string) => `Signed ${label}`,
      sentBy: (account: string) => `Sent by ${account}`,
      otherAdult: 'Sent by another grown-up of this space',
      takeBack: {
        cta: 'Take back',
        title: 'Take back this note?',
        body: (name: string) => `It goes away from ${name}'s app at the next sync. The family can still see that it was sent.`,
        bodyEveryone: "It goes away from everyone's app at the next sync. The family can still see that it was sent.",
        confirm: { cta: 'Take back' },
        cancel: { cta: 'Cancel' },
        /** `409 note_reported`: the row reads "Not shown". */
        locked: 'This note can no longer be changed.',
        failed: 'That did not save. Try again.',
      },
      empty: 'No notes sent yet.',
      error: 'Notes could not load. Try again.',
      retry: { cta: 'Try again' },
      older: { cta: 'Show older' },
    },
    composer: {
      title: 'Send a note',
      close: 'Close',
      to: {
        title: 'To',
        everyone: {
          class: (space: string, n: number) => `Everyone in ${space} (${n} ${plural('en', n, { one: 'student', other: 'students' })})`,
          family: (space: string, n: number) => `Everyone in ${space} (${n} ${plural('en', n, { one: 'learner', other: 'learners' })})`,
        },
        choose: 'Choose',
        picker: { class: 'Students', family: 'Learners' },
      },
      /** A learner the send would skip: notes mode off or a family block, in the same words (section 6.1 item 4). */
      notesOff: { class: 'Notes are off for this student', family: 'Notes are off for this learner' },
      presetsOnly: 'Encouragement only for this student',
      presetsOnlyShort: 'Encouragement only',
      /** Notes this account sent that learner in the last 24 hours, at the per-learner limit. */
      limit: (n: number) => `${n} ${plural('en', n, { one: 'note', other: 'notes' })} today. You can send more tomorrow.`,
      preset: { title: 'Pick an encouragement', required: 'Required' },
      /** The four preset groups, keyed by the id prefix (`effort_`, `progress_`, `next_`, `warm_`). */
      groups: { effort: 'Effort', progress: 'Progress', next: 'Next step', warm: 'Warm' },
      text: {
        label: 'Add a few words (optional)',
        counter: (n: number, max: number) => `${n} of ${max}`,
        /** Announced politely at 100 and at the limit (section 6.12). */
        counterA11y: (n: number, max: number) => `${n} of ${max} characters used`,
      },
      /** One line per `checkNoteText` problem (`@hangul-route/i18n/note-text`); `word` is the token as typed. */
      problems: {
        empty: 'Please add a few words, or leave the box empty.',
        too_long: (max: number) => `Please keep it to ${max} characters.`,
        line_break: 'Please keep the note to one line.',
        link: (word: string) => `Links can't be sent in a note ("${word}").`,
        contact: "Email addresses, handles and phone numbers can't be sent in a note.",
        emoji: 'Please use words instead of emoji.',
        tone: (word: string) => `Please choose a kinder word than "${word}".`,
        invalid: 'Some characters cannot be sent in a note. Please type the words again.',
      },
      /** The picked list is longer than the 300 learners one send takes (`NOTE_SEND_MAX_LEARNERS`). */
      recipientsProblem: { class: 'Choose up to 300 students.', family: 'Choose up to 300 learners.' },
      /** The picked list holds an id the form cannot send (a stale or damaged roster row). */
      recipientsInvalid: 'This list cannot be sent as it is. Refresh and try again.',
      quest: {
        title: 'Suggest a quest (optional)',
        needed: 'Needed for this encouragement',
        choose: { cta: 'Choose a quest' },
        remove: { cta: 'Remove' },
        pickerTitle: 'Pick a quest',
      },
      /** Under a picked quest, only with content gating on and an unlicensed space (F-ENT-003). Never a price or a link. */
      closedMark: 'Some learners can open this lesson only with the full route.',
      signAs: 'Sign as',
      preview: {
        title: 'Preview',
        from: (sender: string) => `From ${sender}`,
        quest: (title: string) => `Try this quest: ${title}`,
        language: 'The learner reads the encouragement in their own app language. Your words show as you typed them.',
        /** Class spaces only (section 7.7). */
        disclosure: 'Teachers see the answer a student picks. They do not see when a note was read.',
      },
      send: { cta: 'Send' },
      sending: 'Sending…',
      cancel: { cta: 'Cancel' },
      /** After Send: counts only, never names (wireframe B). */
      result: {
        sent: {
          class: (n: number) => `Sent to ${n} ${plural('en', n, { one: 'student', other: 'students' })}.`,
          family: (n: number) => `Sent to ${n} ${plural('en', n, { one: 'learner', other: 'learners' })}.`,
        },
        notesOff: {
          class: (n: number) => plural('en', n, { one: '1 student has notes off.', other: `${n} students have notes off.` }),
          family: (n: number) => plural('en', n, { one: '1 learner has notes off.', other: `${n} learners have notes off.` }),
        },
        presetsOnly: (n: number) =>
          plural('en', n, { one: '1 student gets the encouragement only.', other: `${n} students get the encouragement only.` }),
        limit: {
          class: (n: number) => plural('en', n, { one: "1 student is at today's limit.", other: `${n} students are at today's limit.` }),
          family: (n: number) => plural('en', n, { one: "1 learner is at today's limit.", other: `${n} learners are at today's limit.` }),
        },
        nothing: {
          class: "Nothing was sent. Notes are off or today's limit is reached for these students.",
          family: "Nothing was sent. Notes are off or today's limit is reached for these learners.",
        },
        another: { cta: 'Send another' },
        done: { cta: 'Done' },
      },
      /** Server answers (section 7.2); the form keeps its content. */
      errors: {
        badPreset: 'Pick a quest for this encouragement.',
        badSuggest: 'That quest cannot be suggested. Pick another one.',
        tooMany: 'You have sent many notes today. You can send more tomorrow.',
        /** A short limiter `429` (several sends in a minute), never the daily limit. */
        wait: 'Please wait a minute and try again.',
        /** `not_in_space`: a picked learner left the space between loading and Send (section 6.1 item 2). */
        notInSpace: 'Someone on this list is no longer in this space. Refresh and try again.',
        paused: 'Sending notes is paused for this account. Write to hello@hangulroute.com.',
        notAllowed: 'The family owner can let you send notes.',
        notAllowedClass: 'Only the teachers of this class can send notes.',
        sendingOff: 'Sending notes is not open yet.',
        network: 'Could not send. Check your connection and try again.',
        archived: { class: 'This class is archived.', family: 'This family space is archived.' },
        generic: 'Something went wrong. Please try again.',
      },
      empty: { class: 'No students yet. Share the join code first.', family: 'Add a learner to your family first.' },
      backToRoster: { cta: 'Back to the roster' },
    },
    /** The family page, Received tab and settings (FB-12), and the family settings panel "Can send notes". */
    family: {
      title: 'Notes',
      learner: 'Learner',
      tabs: { label: 'Notes for this learner', received: 'Received', sent: 'Sent' },
      from: {
        class: (className: string) => `From ${className} (teacher)`,
        /** A family note with no readable sign-off; the sender is never named here (OD-5). */
        home: 'From home',
        /** A family note with its sign-off, one whole line so a translation can reorder it. */
        homeSigned: (label: string) => `From home, signed ${label}`,
      },
      sentBy: (account: string) => `Sent by ${account}`,
      youSent: 'You sent this',
      withdrawn: 'Taken back by the sender',
      hiddenBy: (account: string) => `Hidden by ${account}`,
      hiddenOnDevice: 'Hidden on a device',
      reportedBy: (account: string) => `Reported by ${account} · Our team is looking at it`,
      reportedOnDevice: 'Reported on a device',
      actions: {
        hide: { cta: 'Hide' },
        report: { cta: 'Report' },
        block: { cta: 'Stop notes from this sender' },
      },
      hideConfirm: {
        title: (learner: string) => `Hide this note from ${learner}?`,
        body: (learner: string) => `It goes away from ${learner}'s app at the next sync. The sender sees 'Not shown'.`,
        cta: 'Hide',
        cancel: { cta: 'Cancel' },
      },
      blockConfirm: {
        title: 'Stop notes from this sender?',
        body: (learner: string) => `${learner} will not get notes from this sender. The sender is not told.`,
        cta: 'Stop notes',
        cancel: { cta: 'Cancel' },
      },
      report: {
        title: 'Report this note',
        why: 'Why?',
        reasons: {
          unkind: 'Unkind',
          unsafe: 'Unsafe',
          not_for_me: (learner: string) => `Not meant for ${learner}`,
          other: 'Something else',
        },
        submit: { cta: 'Report and hide' },
        cancel: { cta: 'Cancel' },
        line: 'Our team looks at every report.',
        tooMany: 'Too many reports today. Write to hello@hangulroute.com if you need help now.',
        /** `422 own_note`: the reporter sent this note. */
        ownNote: 'This is your own note. You can take it back instead.',
      },
      settings: {
        title: (learner: string) => `Settings for ${learner}`,
        classes: 'Notes from classes',
        options: { all: 'All notes', presets: 'Encouragements only', off: 'Off' },
        familyAlways: 'Notes from your family always arrive.',
        lastChangedBy: (account: string) => `Last changed by ${account}`,
        lastChangedOnDevice: 'Last changed on a device',
        saved: 'Saved',
        stopped: { title: 'Stopped senders', allowAgain: { cta: 'Allow again' } },
      },
      disclosure: (learner: string) => `Teachers see the answer ${learner} picks on their notes. They do not see when a note was read.`,
      /** The one-time class-notes card; `mode` is a `settings.options` value. */
      oneTimeCard: {
        line: (mode: string) => `Notes from classes: ${mode}.`,
        keep: { cta: 'Keep' },
        change: { cta: 'Change' },
      },
      empty: (learner: string) => `No notes for ${learner} yet.`,
      noLearners: 'Add a learner to your family first.',
      error: 'Notes could not load. Try again.',
      retry: { cta: 'Try again' },
      saveFailed: 'That did not save. Try again.',
      /** A short limiter `429` on hide, stop, allow again or a setting; `report.tooMany` is the daily report limit. */
      wait: 'Please wait a minute and try again.',
      older: { cta: 'Show older' },
      /** Panel D on the family settings page: who may send notes (OD-17). */
      senders: {
        title: 'Grown-ups in this family',
        you: (name: string) => `${name} (you)`,
        canSend: 'Can send notes',
        always: 'Can send notes: always',
        line: 'Anyone with the family code can join. Only grown-ups you turn on here can send notes.',
      },
    },
  },
  /**
   * All lessons from the console (F-BROWSE-001 sections 4.3, 4.11 and 6; wireframe browse/entry-points.md): the
   * line beside an entry when the plan check failed or the browser blocks this page's storage, and the deep-link
   * buttons (BR-11). One name everywhere: the navigation item is `shell.nav.lessons`; "Browse" is in no string.
   */
  browse: {
    checkFailed: 'Could not check your plan.',
    tryAgain: { cta: 'Try again' },
    openFree: { cta: 'Open free lessons' },
    storageBlocked: "Your browser blocked this page's storage, so lessons cannot open here.",
    preview: { cta: 'Preview' },
    previewLessons: { cta: 'Preview lessons' },
  },
} as const;
