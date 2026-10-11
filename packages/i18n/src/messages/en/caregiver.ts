import { plural } from '../../plural';

/**
 * Grown-up surfaces (F-I18N-001 §3.4 rule 2): the PIN screens, the Family Dashboard, the paywall,
 * the Classes & family and Progress backup cards, and the audience copy that used to live in
 * `logic/audience-copy.ts` (family and self-only variants, PIN titles, paywall and restore lines).
 * PR 8a moves them in with the wording unchanged; Restore, Save progress, Join a class and the
 * install sheet follow in PR 8b. PR 7a added the Quest-assignment gating reasons.
 *
 * No price is written here: the paywall builds its amount from `PLAN_PRICING` and `formatUsd`
 * and passes it in. Buttons and pills are keyed `cta` / `pill` so the length budgets (§3.11)
 * cover them. A message never embeds taught Korean (rule 5).
 */
export const caregiver = {
  /**
   * Quest-assignment gating reasons (PR 7a): `canAssignQuest` returns a code and the learner's
   * name, and the screen renders `m.caregiver.gating[reason](name)`. Every reason takes the name
   * so the call is uniform; a locale may use it or not.
   */
  gating: {
    'unknown-quest': (_learnerName: string) => 'That quest is not available yet.',
    'episode-not-shipped': (_learnerName: string) => 'That episode is still being built.',
    'stage-locked': (learnerName: string) => `${learnerName} hasn't reached this quest yet.`,
  },
  /** `audienceCopy(audience, m.caregiver.audience)` picks `shared` plus one variant. */
  audience: {
    shared: {
      installGuideLine: 'Add me to your home screen.',
      journeyLockedA11y: (stageTitle: string) => `${stageTitle}: locked. Opens the unlock page.`,
      homeReviewsIdle: 'Reviews picked for you',
      homeworkIntro: 'Picked by Hoya, your teacher or your family.',
      restorePrompt: 'Got a rescue code, an account, or a saved file?',
      restoreSignInLabel: 'Sign in',
      restoreCardsBack: 'Your cards come back with your rescue code.',
      spacesNoClass: 'Not in a class yet. Got a code from a teacher or your family?',
      /** A learner already in three classes tries to join another. */
      joinCodeFull: "You're already in three classes. Leave one in Settings first.",
      /** A code that is not a class code was entered. */
      joinCodeNotForLearners: "That code isn't for joining as a learner. Ask for a class code.",
      promoHint: 'Have a promo or referral code? Enter it on the web console.',
      paywallBuyOnWeb:
        'Buy it once on the web console, so no store fees reach your family. Sign in there and come back — this device updates on its next sync.',
      paywallBuyLater:
        'Buying inside this app arrives with the store update. Until then, you can buy it once on the web console.',
      profileSwitchHint: 'Tap a profile to switch.',
    },
    /** "Grown-up zone" stays a family caregiver surface (CLAUDE.md §1). */
    family: {
      installGuideHelp: 'A grown-up can help.',
      zoneLabel: 'Grown-up zone',
      pinVerifyTitle: 'Grown-up zone',
      pinCreateTitle: 'Create a grown-up PIN',
      pinCreateSubtitle: 'Pick 4 digits only grown-ups will know. It protects settings and grown-up pages.',
    },
    /** A self-only device never says "grown-up"; it has no second install line. */
    self: {
      zoneLabel: 'Account & backup',
      pinVerifyTitle: 'Settings PIN',
      pinCreateTitle: 'Create a PIN',
      pinCreateSubtitle: 'Pick 4 digits to protect settings.',
    },
    /**
     * Accessible label of a gated control: `base`, an optional `detail`, and "PIN required"
     * when the device is gated (the caller decides when).
     */
    gated: (base: string, pinRequired: boolean, detail?: string) => {
      const parts = [detail, pinRequired ? 'PIN required' : undefined].filter((p): p is string => p !== undefined);
      return parts.length === 0 ? base : `${base} (${parts.join(', ')})`;
    },
  },

  pin: {
    /** The wording the PIN screen and the first-run PIN field share. */
    mismatch: "Those didn't match. Let's start again.",
    cooldown: (seconds: number) => `Let's take a short break. Try again in ${seconds}s.`,
    entry: {
      createAgain: 'Enter it once more',
      verifySubtitle: 'Enter your 4-digit PIN to continue.',
      createAgainSubtitle: 'Type the same 4 digits again.',
      triesLeft: (left: number) => plural('en', left, { one: `Not quite. ${left} more try.`, other: `Not quite. ${left} more tries.` }),
      unlock: { cta: 'Unlock' },
      forgot: { cta: 'Forgot PIN?' },
    },
    /** The create-and-confirm field inside the first-run card. */
    setup: { again: 'Type it again', set: 'PIN set', change: 'Change' },
    reset: {
      title: 'Reset the PIN',
      subtitle: 'Your learners, cards and progress are kept.',
      code: {
        heading: 'Use a Rescue Code',
        /** The shape of a code, shown greyed in the field. */
        placeholder: 'TIGER-MOON-RIVER-APPLE-482139',
        formats: 'Four words and six digits. Older codes: two words and four digits.',
      },
      noCode: { cta: "I don't have the code" },
      wait: {
        heading: 'Wait 24 hours',
        idle: {
          caption: 'Your PIN keeps working meanwhile. After 24 hours you can set a new one.',
          button: 'Start the wait',
        },
        /** `readyAt` is the end of the wait as a local date and time. */
        waiting: { caption: (readyAt: string) => `You can set a new PIN after ${readyAt}.`, button: 'Wait started' },
        ready: { caption: 'The 24 hours are up.', button: 'Set a new PIN' },
      },
      /** Calm lines for a Rescue Code entry that did not open the reset; never shaming. */
      failure: {
        wrongCode: "That isn't the code saved on this device. Check it and try again.",
        noCode: 'No rescue code is saved on this device. Use the 24-hour wait instead.',
        /** Same wording as the Restore screen's invalid-code line (PR 8b makes them one message). */
        badFormat:
          'Type every word and the number, like TIGER-MOON-RIVER-APPLE-482139 (older codes: TIGER-MOON-4821).',
      },
    },
  },

  dashboard: {
    title: 'Family Dashboard',
    readOnly: 'Read-only — data stays on this device.',
    noProfiles: 'No profiles yet.',
    stats: { quests: 'Quests', cards: 'Cards', sessions: 'Sessions', minutes: 'Minutes' },
    recent: 'Recent',
    privacy: {
      title: 'Privacy',
      body: 'All learning data stays on this device unless you sign in. We do not share with third parties.',
    },
  },

  paywall: {
    /** The learner's name when there is no active profile. */
    learnerFallback: 'Your learner',
    backToJourney: { cta: 'Back to journey' },
    covered: {
      title: (name: string, source: string) => `${name} is covered by ${source}.`,
      sourceFallback: 'the class',
      note: 'Everything is unlocked while they are in it.',
    },
    premium: {
      title: "You're on Premium.",
      note: (name: string) => `The full journey is open for ${name}. Manage your plan on the web console.`,
      manage: { cta: 'Manage plan on the web' },
    },
    free: {
      bubble: 'Stage 1 is always free.',
      unlocks: (offer: string) => `What ${offer} unlocks`,
      openConsole: { cta: 'Open the web console' },
      openFailed: (url: string) => `Open ${url} on a computer or phone browser.`,
      terms: 'One payment, no renewal. Terms and privacy are on the website.',
    },
    /** What the family plan adds (decision #30: one payment, every Stage, one family). */
    bullets: {
      everyStage: 'Every Stage, now and later',
      cloudSave: 'Cloud save on every device',
      dashboard: 'Grown-up dashboard and plans',
      learners: (n: number) =>
        plural('en', n, { one: `Up to ${n} learner in your family`, other: `Up to ${n} learners in your family` }),
    },
    /** The single offer; the amount arrives already formatted (`formatUsd`) and is never written here. */
    offer: {
      name: 'Family Lifetime',
      line: 'One payment. No subscription, nothing to cancel.',
      price: { once: (amount: string) => `${amount} once`, year: (amount: string) => `${amount} / year` },
    },
  },

  /** Settings card: the learner's classes and family. */
  spaces: {
    title: 'Classes & family',
    /** Keyed by the membership kind. */
    kind: { family: 'Family', class: 'Class', school: 'School' },
    leave: {
      cta: 'Leave',
      stay: 'Stay',
      confirmTitle: (name: string) => `Leave ${name}?`,
      confirmMessage: 'Your cards and stars stay with you. You can join again with the code.',
    },
    join: { cta: 'Join a class' },
  },

  /** Settings card: backup. The cloud status line is PR 8b (`status-line`). */
  backup: {
    title: 'Progress backup',
    /** `detail` is the part the accessible label adds to the button name. */
    save: { cta: 'Save my progress', detail: 'rescue code' },
    file: { cta: 'Back up to a file' },
    restore: { cta: 'Restore from a file' },
    note: {
      ready: 'Backup file ready.',
      unavailable: 'Saving files is not available here.',
      failed: "Couldn't make the file. Try again?",
    },
  },
} as const;
