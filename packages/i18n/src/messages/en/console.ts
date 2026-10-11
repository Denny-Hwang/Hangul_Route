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
 * `plan` and `billing` (at the end of this object) the same way.
 *
 * Every string here is caregiver surface (no "behind", "lazy" or a learner-banned word),
 * checked per locale by console-messages.test.ts.
 */
/** "1 item" / "4 items": `planCounts.items`, also the plan item count inside `plan.summary.*`. */
const planItems = (items: number): string => plural('en', items, { one: `${items} item`, other: `${items} items` });
/** "1 learner" / "3 students": `planCounts.targets`, also the target count inside `plan.summary.some.*`. */
const planTargets = (kind: 'family' | 'class' | 'school', n: number): string =>
  kind === 'family'
    ? plural('en', n, { one: `${n} learner`, other: `${n} learners` })
    : kind === 'class'
      ? plural('en', n, { one: `${n} student`, other: `${n} students` })
      : plural('en', n, { one: `${n} member`, other: `${n} members` });

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

  /** The header of every console page (`ConsoleShell`), and the note shown when the build has no API address. */
  shell: {
    backToSite: '← Hangul Route',
    home: 'Console',
    account: { cta: 'Account' },
    billing: { cta: 'Billing' },
    signOut: { cta: 'Sign out' },
    noApi: 'The console needs an API address (NEXT_PUBLIC_API_BASE_URL) on this build.',
  },
  /** Space kinds: a label ("Class code"), the home-page group heading, and what the members are called. */
  kind: {
    label: { family: 'Family', class: 'Class', school: 'School' },
    group: { family: 'Family', class: 'Classes', school: 'School' },
    members: { family: 'learners', class: 'students', school: 'members' },
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
    backToSite: 'Back to Hangul Route',
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
  /** Console home (`/teach/home`): counts only, no names, no percentages. */
  home: {
    title: (name: string) => `Hi, ${name}`,
    lastList: 'Showing the last list we loaded.',
    archived: '(archived)',
    open: { cta: 'Open →' },
    newSpace: { cta: '+ New space' },
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
    },
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
  /** Plan builder counts (`teach/space/plan`): the items in a plan, and the members it targets (worded per space kind, as `kind.members`). */
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
    planTitle: { free: 'Free', family_lifetime: 'Family Lifetime', group_license: 'Group License', school_seat: 'School Contract' },
    includes: {
      /** `cap` / `freeCap` are content-schema `FREE_CLASS_STUDENT_CAP`. */
      free: (cap: number) => `Stage 1, local progress, Rescue Code, file backup; classes up to ${cap} students`,
      family_lifetime: (learners: number) => `Every Stage, now and later, for one family: up to ${learners} learners, cloud sync, grown-up dashboard and plans`,
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
    },
    choose: { cta: 'Choose' },
    contact: { cta: 'Contact us' },
    isCurrent: { pill: 'current' },
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
    /** An episode that is not released yet; a ready one uses `plan.catalog.episodeLabel`. */
    catalog: {
      comingSoon: (title: string) => `${title} (coming soon)`,
    },
  },
} as const;
