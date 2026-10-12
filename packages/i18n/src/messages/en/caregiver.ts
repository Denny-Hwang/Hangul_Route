import { plural } from '../../plural';

/**
 * Grown-up surfaces (F-I18N-001 §3.4 rule 2): the PIN screens, the Family Dashboard, the paywall,
 * the Classes & family and Progress backup cards, and the audience copy that used to live in
 * `logic/audience-copy.ts` (family and self-only variants, PIN titles, paywall and restore lines).
 * PR 8a moved them in with the wording unchanged; PR 8b adds Restore, Save my progress, Join a
 * class, the cloud status line and the install sheet. PR 7a added the Quest-assignment gating reasons.
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
    /** A closed lesson (F-ENT-003 section 3.6): the products that open it, never a price. */
    'quest-closed': (learnerName: string) => `${learnerName} can play this lesson with the Family Plan or a Group License.`,
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
      joinCodeFull: "You're already in three classes. Leave one under Classes & family in your Profile first.",
      /** A code that is not a class code was entered. */
      joinCodeNotForLearners: "That code isn't for joining as a learner. Ask for a class code.",
      promoHint: 'Have a promo or referral code? Enter it on the web console.',
      paywallBuyOnWeb:
        'Buy it on the web console, so no store fees reach your family. Sign in there and come back — this device updates on its next sync.',
      paywallBuyLater:
        'Buying inside this app arrives with the store update. Until then, you can buy it on the web console.',
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
        /** Also the Restore screen's invalid-code line (`claimErrorMessage('invalid')`): one message for both. */
        badFormat:
          'Type every word and the number, like TIGER-MOON-RIVER-APPLE-482139 (older codes: TIGER-MOON-4821).',
      },
    },
  },

  dashboard: {
    title: 'Family Dashboard',
    /** The dashboard lists the learners saved on this device; their progress is also backed up (see `privacy.body`). */
    readOnly: 'Read-only — learners on this device.',
    noProfiles: 'No profiles yet.',
    stats: { quests: 'Quests', cards: 'Cards', sessions: 'Sessions', minutes: 'Minutes' },
    recent: 'Recent',
    privacy: {
      title: 'Privacy',
      /** Leads with `landing.persona.parents.safe.bullets.backup`, word for word: the app backs up every learner with no sign-in. */
      body: "Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code. When a learner joins a class or family with a code, that space sees the name they join with and their progress. A family's grown-ups can also restore their progress. We do not share with third parties.",
      /**
       * Shown instead of `body` on a build with cloud saving off (`syncApi()` null): nothing is backed up there, so the
       * card says so in the "Save now" note's words and names the file backup button (`backup.file.cta`).
       */
      bodyDeviceOnly:
        'Each learner\'s nickname and progress are kept on this device. Cloud saving is not set up on this build, so use "Back up to a file" to keep a copy. We do not share with third parties.',
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
      unlocks: (offer: string) => `What the ${offer} unlocks`,
      openConsole: { cta: 'Open the web console' },
      openFailed: (url: string) => `Open ${url} on a computer or phone browser.`,
      terms: 'Renews yearly until cancelled. Terms and privacy are on the website.',
    },
    /** What the Family Plan adds (every Stage, one family; renews yearly since 2026-10-11). */
    bullets: {
      everyStage: 'Every Stage, new ones included',
      cloudSave: 'Cloud save on every device',
      dashboard: 'Grown-up dashboard and plans',
      learners: (n: number) =>
        plural('en', n, { one: `Up to ${n} learner in your family`, other: `Up to ${n} learners in your family` }),
    },
    /** The single offer; the amount arrives already formatted (`formatUsd`) and is never written here. */
    offer: {
      name: 'Family Plan',
      line: 'Renews every year. Cancel any time.',
      price: { once: (amount: string) => `${amount} once`, year: (amount: string) => `${amount} / year` },
    },
  },

  /**
   * The learner Plan screen (F-BILL-002 §4.7, §6.2, wireframe billing/plan-status): status only, no
   * PIN, never a price, an offer or a purchase word. One variant per audience (`family` names the
   * learner, `self` speaks to them). `openBilling` and `openFailed` are web only; a native build
   * renders none of them (§4.8). F-ENT-003 E3-8 adds `freePlan` here.
   */
  plan: {
    title: 'Plan',
    /** The learner's name when there is no active profile. */
    learnerFallback: 'Your learner',
    covered: {
      title: {
        family: (name: string, source: string) => `${name} is covered by ${source}.`,
        self: (source: string) => `You're covered by ${source}.`,
      },
      note: { family: 'Everything is open while they are in it.', self: 'Everything is open while you are in it.' },
      sourceFallback: 'the class',
    },
    full: {
      title: { family: (name: string) => `${name} has the full route.`, self: 'You have the full route.' },
      fromFamily: { family: "From your family's Family Plan.", self: 'From your Family Plan.' },
      noSource: 'Everything is open.',
    },
    free: {
      title: { family: (name: string) => `${name} is on the free plan.`, self: "You're on the free plan." },
      /** The free slot while F-ENT-003's switch is off (moved from `paywall.free.bubble`, same words). */
      open: 'Stage 1 is always free.',
    },
    openBilling: {
      cta: 'Open billing',
      caption: { family: 'Plans and receipts are on the billing page for grown-ups.', self: 'Your plan and receipts are on the billing page.' },
      a11yHint: 'Opens the billing page',
    },
    openFailed: (url: string) => `Open ${url} in a browser.`,
    backToJourney: { cta: 'Back to journey' },
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

  /** Settings card: backup. Its cloud status line is `sync.status`. */
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

  /**
   * Calm lines Restore and Join a class share when the server asks to slow down, the device is
   * offline, or anything else goes wrong (`claimErrorMessage`, `joinErrorMessage`). Never blames.
   */
  retry: {
    tooManyAttempts: "Let's wait a few minutes before trying again.",
    offline: 'This needs internet. Try again when you are online.',
    unknown: 'Something went wrong. Try again in a moment.',
  },

  /**
   * The one-line cloud status (Progress backup card, Save my progress) and the line after
   * "Save now" — `logic/sync/status-line`. Calm: an old timestamp or an error never reads as alarm.
   */
  sync: {
    status: {
      deviceOnly: 'Saved on this device only.',
      /** 403: a class linked this device (SEC-4); a rescue code entered here turns cloud saving on. */
      needsRescueCode: 'Saved on this device. A rescue code turns on cloud saving here.',
      retrying: "Couldn't reach the cloud — will retry.",
      saving: 'Saving to the cloud…',
      waiting: 'Waiting for the first cloud save.',
      justNow: 'Saved to the cloud · just now',
      /** English "min" does not inflect; the plural() call is the slot other locales fill. */
      minutesAgo: (minutes: number) =>
        plural('en', minutes, {
          one: `Saved to the cloud · ${minutes} min ago`,
          other: `Saved to the cloud · ${minutes} min ago`,
        }),
    },
    saveNow: {
      saved: 'Saved to the cloud.',
      off: 'Cloud saving is not set up on this build.',
      /** Same 403 as `status.needsRescueCode`: the device needs a rescue code, the cloud is not down. */
      needsRescueCode: "This device can't save to the cloud yet. A rescue code turns it on.",
      unreachable: "Couldn't reach the cloud — try again later.",
    },
  },

  /**
   * sync/restore: a Rescue Code, a grown-up sign-in (not yet) or a saved file; never overwrites.
   * The Hoya prompt, the sign-in label and "cards come back" line are `audience.shared`; the
   * invalid-code line is `pin.reset.failure.badFormat`, the one wording both screens use.
   */
  restore: {
    title: 'Bring back progress',
    code: {
      cta: 'I have a rescue code',
      /** Greyed in the empty field. */
      placeholder: 'Words, then the number',
      example: 'Like TIGER-MOON-RIVER-APPLE-482139. Older codes look like TIGER-MOON-4821.',
      find: { cta: 'Find my cards' },
      /** The find button while the claim is in flight. */
      looking: { cta: 'Looking…' },
      notFound: 'Check the code and try again.',
    },
    cloudOff: 'Cloud restore is not set up on this build.',
    cloudOffUseFile: 'Cloud restore is not set up on this build. Use a saved file instead.',
    signIn: { comingSoon: 'Coming soon' },
    file: {
      cta: 'Open a saved file',
      openFailed: "Couldn't open that file.",
      newerVersion: 'This backup comes from a newer version. Update the app first.',
      unreadable: "This file can't be read. Choose a .hangulroute.json backup.",
    },
    startFresh: { cta: 'Start fresh instead' },
    great: { cta: 'Great' },
    /** The merge notice: warm, never "overwritten". `name` is the learner's display name. */
    notice: {
      created: (name: string) => `Welcome back, ${name}! Your journey is here.`,
      nothingNew: (name: string) => `${name} already has everything from this file.`,
      /** At least one count is above zero (`nothingNew` covers the rest). */
      added: (name: string, cards: number, quests: number) => {
        const parts = [
          cards > 0 ? plural('en', cards, { one: `${cards} card`, other: `${cards} cards` }) : null,
          quests > 0 ? plural('en', quests, { one: `${quests} quest`, other: `${quests} quests` }) : null,
        ].filter((p): p is string => p !== null);
        return `We found ${name}'s progress! Added ${parts.join(' and ')}.`;
      },
      /** A teacher approved a class re-link (F-TCH-001 §10.1). */
      relinked: (name: string) => `Welcome back, ${name}! You're in the class again.`,
    },
  },

  /** sync/save-progress (PIN-gated): the rescue code shown as a block a parent writes down. */
  saveProgress: {
    title: 'Save my progress',
    bubble: {
      /** `name` is the active learner; null only when no profile is active. */
      code: (name: string | null) =>
        name === null
          ? 'Write this down. It brings your cards back on any device.'
          : `Write this down. It brings ${name}'s cards back on any device.`,
      noCode: 'Once progress is saved to the cloud, a rescue code appears here.',
    },
    /** The caption under the code: four words + six digits (SEC-5), or two + four for an older code. */
    codeShape: (words: number, digits: number) => `${words === 4 ? 'four' : 'two'} words + ${digits} digits`,
    copy: { cta: 'Copy', done: 'Copied.', unavailable: 'Copy is not available here — write it down.' },
    share: {
      cta: 'Share',
      /** The share sheet's title. */
      title: 'Rescue code',
      /** The shared message; `name` is null only when no profile is active. */
      text: (name: string | null, code: string) => `Hangul Route rescue code for ${name ?? 'my learner'}: ${code}`,
      unavailable: 'Sharing is not available here — copy it instead.',
    },
    saveNow: { cta: 'Save now', saving: { cta: 'Saving…' } },
    /** Getting a new code is last and small on purpose: the old one stops working. */
    rotate: {
      cta: 'Get a new code',
      caption: 'The old code stops working.',
      confirmTitle: 'Get a new code?',
      confirmMessage: 'The old code will stop working. Write the new one down.',
      keep: { cta: 'Keep my code' },
      ready: 'New code ready. The old one no longer works.',
      unavailable: "Couldn't get a new code right now.",
    },
  },

  /**
   * sync/join-space (not PIN-gated: the teacher is in the room). The learner-facing lines name the
   * fix, never a person (F-LEARN-001 §3.9). `cap_learner` and `not_joinable` read
   * `audience.shared.joinCodeFull` / `joinCodeNotForLearners`; busy, offline and unknown read `retry`.
   */
  join: {
    title: 'Join a class',
    bubble: {
      idle: 'Type the code your teacher gave you.',
      /** `space` is the class or family name the server returned. */
      found: (space: string) => `${space} found!`,
      done: (space: string) => `You're in ${space}!`,
    },
    code: {
      /** A sample code, greyed in the empty field. */
      placeholder: 'ABC123',
      rules: '6 letters or numbers — no O, I, 0 or 1',
      join: { cta: 'Join' },
      looking: { cta: 'Looking…' },
    },
    confirm: {
      /** Who sees the roster name: a family space, or a teacher's class or school. */
      seeYouAs: { family: 'Your family will see you as:', teacher: 'Your teacher will see you as:' },
      me: { cta: "That's me" },
      joining: { cta: 'Joining…' },
      alreadyIn: { cta: 'I was already in this class' },
      notThis: { cta: 'Not this one' },
    },
    /** A learner who was in the class before picks their roster name; the teacher approves. */
    pick: {
      prompt: 'Which one is you? Your teacher will check.',
      newHere: { cta: "I'm new here" },
    },
    waiting: {
      line: (name: string) => `Waiting for your teacher to say yes for ${name}.`,
      caption: 'Ask them to open the class on their screen. This request lasts about 10 minutes.',
      neverMind: { cta: 'Never mind' },
    },
    relink: {
      denied: 'Your teacher said not now. Ask them in class.',
      expired: 'That took too long. Ask your teacher and try again.',
    },
    done: {
      joined: (space: string) => `You're in ${space}. New missions may show up on Today.`,
      already: (space: string) => `You're already in ${space}.`,
      backToToday: { cta: 'Back to today' },
    },
    errors: {
      codeNotFound: "That code didn't work. Check it with your teacher.",
      codeExpired: 'That code is too old. Ask for a new one.',
      classFull: 'This class is full. Ask your teacher.',
      learnerGone: 'That name is not in this class anymore. Ask your teacher.',
      alreadyOnDevice: 'This device already has that learner — switch profiles instead.',
      badFormat: 'A code has 6 letters or numbers.',
      off: 'Joining a class is not set up on this build.',
    },
  },

  /** The install bottom sheet (web); its heading and help line are `audience.installGuideLine` / `installGuideHelp`. */
  install: {
    offline: 'Then Hangul Route opens like an app and your cards stay safe, even without Wi-Fi.',
    /** The step chips: iOS Safari (Share, then Add to Home Screen) and the desktop/Android hint. */
    steps: {
      share: 'Tap Share',
      addToHome: 'Add to Home Screen',
      browserMenu: 'Browser menu',
      installApp: 'Install app / Add to Home screen',
    },
    install: { cta: 'Install' },
    inAppBrowser: 'Open this page in Safari or Chrome first.',
    copyLink: { cta: 'Copy link' },
    linkCopied: { cta: 'Link copied' },
    notNow: { cta: 'Not now' },
  },

  /**
   * The level-check report (F-PLC-001 section 3.9, wireframe placement J): status words, never a
   * comparison with other learners. Counts are framed as growth for Short and Standard only; a
   * Deep rung shows a status word and "checked twice" or "not finished".
   */
  placementReport: {
    title: 'Starting spot',
    whatWeSaw: 'What we saw',
    strand: {
      'hangul-recognition': 'Letters (shapes)',
      'sound-letter': 'Sounds of letters',
      'syllable-reading': 'Reading syllables',
      vocabulary: 'Words',
      sentences: 'Sentences',
    },
    status: { secure: 'secure', gettingThere: 'getting there', notYet: 'not yet', notTested: 'not tested' },
    rung: {
      recog: 'Letter shapes',
      'sound-basic': 'First letter sounds',
      'syl-cv': 'Simple syllables',
      'sound-rest': 'More letter sounds',
      'syl-cvc': 'Syllables with a final',
      vocab: 'Words',
      sentence: 'Sentences',
    },
    form: { decode: 'reading', read: 'reading', oral: 'listening' },
    /** One row of a rung, correct out of what was asked, framed as growth (Short and Standard only). */
    count: (correct: number, asked: number) => `${correct} of ${asked}`,
    notTestedReason: {
      noSound: 'Listening was not checked: no sound on this device.',
      soundGuide: 'Reading was not checked: the sound guide was set to always show.',
      screenReader: 'Letter shapes were not checked: a screen reader was on.',
      screenReaderPictures: 'Words and sentences were not checked: their Korean picture choices cannot be read aloud by a screen reader.',
      endedEarly: 'The check ended early, so some parts were not reached.',
    },
    shortNotTested: 'Shapes of letters and sentences are not part of the short check.',
    notTestedShort: 'not tested (short check)',
    shortHint: 'The short check looks at the first letters only. The standard check can find a later starting spot.',
    tryStandard: 'Try the standard check',
    checkedTwice: 'checked twice',
    notFinished: 'not finished',
    spellingTiles: 'Spelling with tiles',
    onlyForward: 'A new check can only move the route forward.',
    /** The date of the newest check and the language it was taken in (`LOCALE_META` endonym). */
    takenOn: (date: string, language: string) => `Checked ${date}, in ${language}`,
    whereStarts: 'Where the route starts',
    changedByGrownUp: 'Changed by a grown-up',
    takeAgain: 'Take the check again',
    takeFirst: 'Take the level check',
    noCheck: 'No check taken yet.',
    /** On a child profile the one-tap retake with the sound guide hidden lives here, not on the result (AM-23). */
    retryHidden: 'Try it with the sound guide hidden',
    /** A stage the account does not include: a plain note, no price, no plan name, no purchase button (assumption 10). */
    needsStage: (name: string, stage: number) =>
      `${name} is ready for Stage ${stage}. Stage ${stage} lessons are not included with this account yet.`,
    noStart: (name: string) => `${name} knows everything that is open right now. More is coming.`,
    /** Labels before the letters drawn with KoreanText in a strand's example. */
    examples: { known: 'Knows', fresh: 'New for now' },
    chooseStart: 'Choose a different start',
    sheet: {
      title: 'Choose a different start',
      help: 'Quests before the one you pick are skipped. It and every quest after it stay on the route.',
      /** A quest's place on the route in force; a quest still ahead shows no word. */
      state: { start: 'starts here', done: 'done', placedOut: 'skipped ahead' },
    },
    saved: 'The start is changed.',
    /** The dashboard's row under each profile's stats. */
    row: { label: 'Starting spot', seeCheck: 'See the check' },
  },

  /**
   * Learning Route about a child (F-ROUTE-001 sections 3.12, Appendix B; LR-1): a grown-up viewing another
   * profile's page read-only. Every sentence is written about the child, from the profile name.
   */
  journey: {
    here: (name: string, n: number, title: string) => `${name} is on Stage ${n}: ${title}.`,
    next: (title: string) => `Next: ${title}`,
    canDoLead: (name: string) => `By the end of this stage, ${name} can:`,
    started: (name: string) => `${name} started here.`,
    known: (name: string) => `${name} already knew this.`,
    quests: (name: string, n: number) => `In ${plural('en', n, { one: '1 quest', other: `${n} quests` })} ${name} finished`,
    viewing: (name: string) => `Viewing ${name}'s Learning Route`,
    tiles: (n: number) => `Spelling with tiles: ${plural('en', n, { one: '1 quest', other: `${n} quests` })}`,
    start: (name: string) => `${name}'s Learning Route starts here.`,
    goal: 'First goal: read every Hangul letter.',
    rest: (name: string) => `${name} did everything that is open right now. More is coming.`,
    beyond: (name: string) => `${name} knows a lot! More adventures are coming.`,
    hereTag: (name: string) => `${name} is here`,
    ready: (name: string) => `Ready when ${name} is`,
    explored: (name: string) => `${name} explored everything that is open right now`,
    skillsTitle: (name: string) => `What ${name}'s quests practice`,
    /** The Learning Route row on each profile card of the in-app parent dashboard (R-9b, amendment LR-A6). */
    row: {
      title: 'Learning Route',
      now: (n: number, title: string) => `Now: Stage ${n} · ${title}`,
      goal: (n: number, title: string) => `Goal: Stage ${n} · ${title}`,
      /** From the newest level check: its stage, band label and date. */
      started: (n: number, band: string, date: string) => `Started: Stage ${n} · ${band} · ${date}`,
      cta: 'See Learning Route',
    },
  },
  /** One wording everywhere (F-ROUTE-001 section 3.12): the placement report and My route's skills rows. */
  skillsNote:
    'The level check looks at reading and listening. Writing is practiced with tracing games and is not scored. The rows count finished quests that include these games; a game skipped inside a quest still counts.',
} as const;
