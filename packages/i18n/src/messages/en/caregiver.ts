import { plural } from '../../plural';

/**
 * Grown-up surfaces (F-I18N-001 §3.4 rule 2): the PIN screens, the Family Dashboard, the Plan screen,
 * the Classes & family and Progress backup cards, and the audience copy that used to live in
 * `logic/audience-copy.ts` (family and self-only variants, PIN titles and restore lines).
 * PR 8a moved them in with the wording unchanged; PR 8b adds Restore, Save my progress, Join a
 * class, the cloud status line and the install sheet. PR 7a added the Quest-assignment gating reasons.
 *
 * No price is written here, and the learner Plan screen shows none (F-BILL-002 B-9 removed the
 * price-bearing paywall and its keys, section 6.4). Buttons and pills are keyed `cta` / `pill` so the length budgets (§3.11)
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
      /** The free slot while F-ENT-003's switch is off (moved from the removed `paywall.free.bubble`, same words). */
      open: 'Stage 1 is always free.',
    },
    openBilling: {
      cta: 'Open billing',
      caption: { family: 'Plans and receipts are on the billing page for grown-ups.', self: 'Your plan and receipts are on the billing page.' },
      a11yHint: 'Opens the billing page',
    },
    openFailed: (url: string) => `Open ${url} in a browser.`,
    /** Web only: offline, before `openFailed` (as Sources' needsConnection). */
    needsConnection: 'Opening billing needs a connection.',
    /** Web only: back from a correct PIN, a browser may block a tab opened outside a tap, so one more tap opens it (as Sources' gateDone). */
    gateDone: 'PIN accepted. Tap Open billing again.',
    backToJourney: { cta: 'Back to journey' },
    /** The way back when the Plan screen was opened from the Library or from the Home and Results asks (F-ENT-003 E3-6): it names where it goes. */
    backToLibrary: { cta: 'Back to library' },
    backHome: { cta: 'Back home' },
    /**
     * F-ENT-003 section 3.9.1 (E3-8; wireframe billing/plan-status-free-lessons): the lines on what
     * is free, shown in the Plan screen's slots only while F-ENT-003's effective switch is on. `line`
     * replaces `free.open` (OD-9); every figure comes from `freeLessonsFacts` and the build's
     * bundle, never typed here. At most one situation line (`classLine`, then `freeEnd`). The
     * premium no-plan line is `setPlan`; `setPlanWeb` names the grown-up page on the web only, with
     * no link. Never "day" (OD-8), no price, no offer.
     */
    freePlan: {
      line: (lessons: number, letters: number, minutes: number) =>
        `Stage 1 is free: ${plural('en', lessons, { one: `${lessons} lesson`, other: `${lessons} lessons` })}, ${plural('en', letters, {
          one: `${letters} letter`,
          other: `${letters} letters`,
        })}, about ${plural('en', minutes, { one: `${minutes} minute`, other: `${minutes} minutes` })}. Everything finished stays.`,
      /** When the free lessons teach no letter. */
      lineNoLetters: (lessons: number, minutes: number) =>
        `Stage 1 is free: ${plural('en', lessons, { one: `${lessons} lesson`, other: `${lessons} lessons` })}, about ${plural('en', minutes, {
          one: `${minutes} minute`,
          other: `${minutes} minutes`,
        })}. Everything finished stays.`,
      /** The What is free list; a line whose count is 0 is not shown. */
      stories: (n: number) => plural('en', n, { one: `${n} short story`, other: `${n} short stories` }),
      topics: (n: number) => plural('en', n, { one: `${n} word topic`, other: `${n} word topics` }),
      /** The learner's only space membership is a class or school. */
      classLine: {
        family: (name: string) => `${name}'s teacher can open every lesson for the class.`,
        self: 'Your teacher can open every lesson for the class.',
      },
      /** The learner has finished everything open on the free plan. */
      freeEnd: {
        family: (name: string) => `${name} finished the free lessons.`,
        self: 'You finished the free lessons.',
      },
      /** Full route with no plan (section 3.9.4). */
      setPlan: 'Set a plan to guide what comes next.',
      /** Web only, after `setPlan`: names the grown-up page, no link (F-BILL-002 owns links on this screen). */
      setPlanWeb: 'Plans are made in the grown-up area: Plan the term.',
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
    /**
     * `first` is the new-learner line (F-ROUTE-001 OD-9). The rest is the grown-up route card
     * (AMENDMENTS-ROUTE-LEARNING-ROUTE sections 6.2 and 11.1, LR-3b), about the child, from the
     * device's own goal; the shared parts (`now.label`, `goal.label`, `goal.stage`, `goal.explore`,
     * `goal.reachedStage`, `goal.tasteLine`) come from `learner.myRoute`.
     */
    goal: {
      first: 'First goal: read every Hangul letter.',
      inGoal: (name: string, n: number, title: string) => `Stage ${n} · ${title}: ${name} is in the goal stage`,
      exploreInGoal: (name: string, n: number, title: string) => `Explore Stage ${n} · ${title}: ${name} is in the goal stage`,
      reached: (name: string, n: number, title: string) => `${name} reached the goal: Stage ${n} · ${title}.`,
      from: {
        class: "From the class's weekly plan",
        school: "From the school's weekly plan",
        family: "From the family's weekly plan",
        self: (name: string) => `From ${name}'s own weekly plan`,
        default: "Hoya's suggestion",
      },
    },
    /** Grown-up views only (LR-OD-7): a date, never "late" or "behind". */
    planEnds: (date: string) => `Plan ends ${date}`,
    goalTag: (name: string) => `${name}'s goal`,
    endOfRoad: (name: string) => `${name} reached the end of the open road. More is coming.`,
    error: (name: string) => `Hoya could not open ${name}'s Learning Route.`,
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
  /**
   * The way from the learner app to the grown-up area on the app host (F-APP-001 sections 3.6 and
   * 3.9). A-6: the PIN screen opened for the grown-up area on a device with no PIN stored never
   * offers to make one; it sends the grown-up to sign in instead (wireframe
   * `parent/grown-up-home-card.md` Panel D). A-7 adds the dashboard card strings.
   */
  grownUpHome: {
    noPin: 'This device has no grown-up PIN. Sign in on the grown-up page instead.',
    continue: { cta: 'Continue' },
    /** A-7: the card at the top of the local dashboard (Panel B), web only, flag on. */
    title: 'Grown-up home',
    line: 'Your family, classes and billing.',
    cta: 'Open',
  },
  /**
   * The free-lessons line on the device's grown-up screens (F-ENT-003 section 3.9.2 and the
   * section 3.11 glossary; wireframe console/free-lessons-line B): the parent dashboard child
   * row and the in-app report, behind the grown-up gate, for the space owner only. The product
   * is named by context ([BY]: the Family Plan renews yearly): a family, a class or school, or
   * `either` when the context is unknown. No price, no "Premium".
   */
  access: {
    freeEnd: (name: string, product: string) => `${name} finished the free lessons. Stage 2 and later open with ${product}.`,
    product: {
      family: 'the Family Plan',
      class: 'a Group License',
      either: 'the Family Plan or a Group License',
    },
  },
  /**
   * Notes from grown-ups in the in-app grown-up zone (F-FEEDBACK-001 FB-5; wireframes parent/notes.md
   * and parent/note-report.md; FB-9 renders them). Behind the gate, so they address the grown-up and
   * name the learner in the third person. Senders are labels (`common.notes`), never account names.
   */
  notes: {
    /** One dashboard row per local profile with notes or memberships. */
    row: { title: (learner: string) => `Notes for ${learner}` },
    title: (learner: string) => `Notes for ${learner}`,
    empty: (learner: string) => `No notes for ${learner} yet.`,
    putAway: 'Put away on this device',
    status: { opened: 'Opened' },
    hide: {
      cta: (learner: string) => `Hide from ${learner}`,
      confirm: {
        title: (learner: string) => `Hide this note from ${learner}?`,
        body: "It goes away on every device. The sender sees 'Not shown'.",
        cta: 'Hide',
        cancel: { cta: 'Cancel' },
      },
    },
    report: {
      cta: 'Report',
      title: 'Report this note',
      why: 'Why?',
      reasons: {
        unkind: 'Unkind',
        unsafe: 'Unsafe',
        not_for_me: (learner: string) => `Not meant for ${learner}`,
        other: 'Something else',
      },
      submit: { cta: 'Report and hide' },
      line: (learner: string) => `The note goes away for ${learner} on every device. Our team looks at every report.`,
      justHide: { cta: 'Just hide it' },
      close: 'Close',
      reported: 'Thank you. The note is gone.',
      /** Shown after the reason Unsafe only. */
      emergency: 'If someone is in danger, contact local emergency services.',
      hidden: 'The note is hidden.',
      done: { cta: 'Done' },
      alreadyGone: 'This note is already gone.',
      /** The report is queued with a local hide (one pending report per note). */
      queued: 'We could not send the report. We will try again when you are online.',
      tooMany: 'Too many reports today. The note is hidden on this device.',
    },
    /** The class-notes setting (`NOTES_MODES`). */
    mode: {
      title: 'Notes from classes',
      options: { all: 'All notes', presets: 'Encouragements only', off: 'Off' },
      familyAlways: 'Notes from your family always arrive.',
      classScoped: 'Change this on a home device.',
    },
    /** The one-time class-notes card (section 6.10 item 5); `mode` is a `mode.options` value. */
    oneTimeCard: {
      line: (mode: string) => `Notes from classes: ${mode}.`,
      keep: { cta: 'Keep' },
      change: { cta: 'Change' },
    },
    disclosure: (learner: string) => `Teachers see the answer ${learner} picks on their notes.`,
    offline: 'Connect to the internet to do this.',
    saveFailed: 'That did not save. Try again.',
    /** The device's notes could not be read (the console's family notes wording). */
    error: 'Notes could not load. Try again.',
    retry: { cta: 'Try again' },
    /** Web only: opens the family notes on app.hangulroute.com. */
    sendNote: { cta: 'Send a note' },
  },
  /**
   * All lessons, the grown-up lesson browser at app.hangulroute.com/browse (F-BROWSE-001 sections
   * 4.1, 4.3, 4.5, 4.7 and 6; OD-8; mocks `design/screens/browse/`). One name everywhere: page
   * "All lessons", strip "Preview. Nothing is saved.", exits "Close" and "Leave preview"; the word
   * "Browse" is in no string. BR-6 adds the root's strings; BR-7 to BR-9 add the rest.
   */
  browse: {
    /** `document.title` on every browse screen: never a route name or an item title. */
    documentTitle: 'Hangul Route lessons',
    home: {
      title: 'All lessons',
      close: { cta: 'Close' },
      howTo: 'Tap a lesson to see what it teaches, then play it. Nothing is saved.',
      /** The header chip that opens the Lesson display sheet (home and the item page). */
      lessonDisplay: { cta: 'Lesson display' },
      /** Beside the title while the device is offline. */
      offline: 'Offline',
      /** Only with the content switch on (section 4.5 item 3): a sampler pass, or a fallback pass. */
      scope: {
        sampler: "Your learner's free lessons are open. The others show what they teach.",
        fallback: 'Showing free lessons. We could not check your plan.',
      },
      /** Account passes that are not kept, online only; links to the persona home (no learner identifier). */
      pointer: 'To see how your learner is doing, open your home page.',
      /** A deep link's note (section 4.4), dismissible. */
      note: {
        letterAcrossStage1: 'This letter is practiced across Stage 1.',
        notInVersion: 'This lesson is not in this version of the app yet.',
        dismiss: 'Dismiss',
      },
      /** The section control (a radiogroup), in the learner's order. */
      section: {
        label: 'Show lessons by',
        route: 'Route',
        journey: 'Journey',
        library: 'Library',
      },
      /** The Journey's collapsed stage line when the Route section is absent, and its expansion. */
      stages: {
        line: (n: number) => `${n} stages, from letters to your own words`,
        item: (order: number, title: string) => `Stage ${order} · ${title}`,
      },
      /** A Route stage row's accessible name: the learner row's own label, then where it goes. */
      routeRowA11y: (rowLabel: string) => `${rowLabel} Shows it on the Journey.`,
      /** The Library's card theme filter group. */
      themes: 'Themes',
      /** A card slot in the Library: the rarity word, then the episode row's name. */
      cardSlotA11y: (rarity: string, title: string, ko: string, romanization: string) => `${rarity}, ${title}, ${ko} ${romanization}. Opens the card.`,
      /** One Words row: "· 12 words" beside the topic title. */
      wordCount: (n: number) => plural('en', n, { one: `· ${n} word`, other: `· ${n} words` }),
      wordsRowA11y: (topic: string, n: number) => plural('en', n, { one: `${topic}, ${n} word. Opens the topic.`, other: `${topic}, ${n} words. Opens the topic.` }),
      /** A Story Time or Culture tile's one label: the title and its length, with no learner state (section 4.5). */
      storyTileA11y: (title: string, minutes: number) =>
        `${title}. ${plural('en', minutes, { one: `About ${minutes} minute`, other: `About ${minutes} minutes` })}.`,
    },
    /** The keep switch at the foot of home (account passes that are not a fallback). */
    keep: {
      label: 'Keep lessons on this device for 7 days, also offline',
      /** Under the switch when turning it on did not keep the lessons (the switch is back off). */
      failed: 'Lessons could not be kept on this device.',
    },
    /** The Lesson display sheet (section 4.9). It changes only this preview. */
    display: {
      title: 'Lesson display',
      romanization: 'Romanization',
      always: 'Always shown',
      tap: 'Hidden until tap',
      language: 'Language',
      note: "These choices change only this preview. No learner's settings change.",
      done: { cta: 'Done' },
    },
    /** The episode outline (section 4.6). */
    episode: {
      back: 'Back to all lessons',
      stagePill: (order: number, title: string) => `Stage ${order} · ${title}`,
      lessons: 'Lessons',
      stories: 'Stories',
      cards: 'Cards in this episode',
      comingLater: 'Coming later',
      open: { cta: 'Open' },
      openA11y: (title: string) => `Open ${title}`,
      storyMeta: (levels: number, scenes: number) =>
        `${plural('en', levels, { one: `${levels} level`, other: `${levels} levels` })} · ${plural('en', scenes, { one: `${scenes} scene`, other: `${scenes} scenes` })}`,
    },
    /** A card row (episode outline, item page): the English title, then the Korean and its romanization. */
    cardRowA11y: (title: string, ko: string, romanization: string) => `${title}, ${ko} ${romanization}. Opens the card.`,
    /** "About N minutes" (the outline sums its lessons). */
    minutes: (n: number) => plural('en', n, { one: `About ${n} minute`, other: `About ${n} minutes` }),
    /** The item page (section 4.6): one template for a lesson, a story and a word topic. */
    item: {
      back: 'Back',
      kind: { quest: 'Lesson', story: 'Story', vocabTopic: 'Words' },
      teaches: 'What this teaches',
      where: {
        title: 'Where it sits',
        stage: (order: number) => `Stage ${order}`,
        lesson: (n: number, of: number) => `lesson ${n} of ${of}`,
        see: { cta: 'See on the Journey' },
      },
      card: 'The card it awards',
      /** "Taught here:" before the letter chip, when opened for a letter. */
      focus: 'Taught here:',
      focusChipA11y: (letter: string, romanization: string) => `${letter}, ${romanization}, taught here`,
      preview: { cta: 'Preview this lesson' },
      previewStory: { cta: 'Preview this story' },
      previewQuestions: { cta: 'Preview the questions' },
      /** The grown-up line in place of the preview button (switch on, sampler pass); F-ENT-003 section 3.11 [BY]. */
      closed: 'Opens with the Family Plan or a Group License',
      /** Under the closed line, an account pass that is not kept and not a fallback (F-BILL-002's label). */
      openBilling: { cta: 'Open billing' },
      /** A word topic's count beside its kind word in the item header. */
      wordCount: (n: number) => plural('en', n, { one: `${n} word`, other: `${n} words` }),
    },
    /** The rows of "What this teaches". */
    facts: {
      letters: 'Letters',
      words: 'Words',
      syllables: 'Syllables',
      skills: 'Skills',
      steps: 'Steps',
      levels: 'Levels',
      levelGroup: 'Level',
      level: { listen: 'Listen', readAlong: 'Read along', read: 'Read' },
      scenes: 'Scenes',
      keywords: 'Key words',
      sources: 'Sources',
      seeSources: { cta: 'See the sources' },
    },
    /** The word topic page (BR-9): each word row's Hear button, named by the romanization. */
    topic: {
      hearA11y: (romanization: string) => `Hear ${romanization}`,
    },
    /** The preview strip on lesson screens and the preview end screen (`PreviewFrame`). */
    preview: {
      strip: 'Preview. Nothing is saved.',
      leave: { cta: 'Leave preview' },
      /** [ Leave preview ] asks once (mock preview-player.md C); Leave goes to the item page, no end screen. */
      leaveConfirm: {
        title: 'Leave this preview?',
        keep: { cta: 'Keep going' },
        leave: { cta: 'Leave' },
      },
    },
    /** The preview end screen (section 4.8, BD9): what a learner gets here, never stars, a score or an earned card. */
    end: {
      lesson: {
        title: 'That is the whole lesson.',
        line: 'At this point a learner sees 1 to 3 stars and collects:',
        /** A lesson that awards no card. */
        lineNoCard: 'At this point a learner sees 1 to 3 stars.',
      },
      story: {
        title: 'That is the whole story.',
        line: 'A learner can read it again any time.',
      },
      next: { cta: 'Next lesson' },
      again: { cta: 'Preview again' },
      /** Also the error screen's way out of a lesson that fails to render (section 4.7). */
      back: { cta: 'Back to the lesson page' },
      nextStory: { cta: 'Next story' },
      readAgain: { cta: 'Read again' },
      backToStory: { cta: 'Back to the story page' },
    },
    /** The Access screen: no active pass. No lesson, title or card is shown (section 4.3). */
    access: {
      title: 'This page is for parents and teachers.',
      line: {
        gate: 'Your time in the grown-up area ended.',
        /** The gate line until BR-12b ships the `gate=browse` boot intent. */
        gateUntilIntent: 'Your time in the grown-up area ended. Go back to the app, then open the grown-up area again.',
        account: 'Open lessons again from your account.',
        unknown: 'On a family device, open them from the grown-up area. Parents and teachers can also open them from their account.',
      },
      backToGrownUp: { cta: 'Back to the grown-up area' },
      backToApp: { cta: 'Back to the app' },
      openFromAccount: { cta: 'Open lessons from my account' },
      signIn: { cta: 'Sign in' },
      /** Offline, under the account actions (account and unknown sources). */
      offline: 'Grown-up pages need the internet.',
    },
  },
  /**
   * Class moves in the learner app (F-SPACE-002 section 4.12, PR T-7d): the Classes card variants and Move (T-7b,
   * `design/screens/transfer/classes-card.md`), MoveClass, ApproveTransfer, the read-only and planned sheets and the
   * Home line (T-7c, `app-sheets.md`); mocks #472, word for word. Rendered only while the inbox says
   * `transfersEnabled` (CLASS_TRANSFER stays off until counsel, flip gate G2), so these keys are unused until then.
   * Not here: the consent lines (content-schema `TRANSFER_CONSENT_TEXT`, en / ko / es) and the frame the app sheet
   * shares with the console (`console.transfer.consent`: title, language, identity block, reading hint, Yes, Not now);
   * `consent` below adds only the self-audience frame. Offline reads `retry.offline`, Back and Done read
   * `common.buttons`, the gate mark reads `audience.gated`. "Move" is the user-facing word, "learner", "class" and
   * "grown-up" the nouns; no age, no countdown, no number, no red, and no line names who said no.
   */
  transfer: {
    /** Buttons. A gated one carries the lock glyph and `audience.gated(…, true)` as its accessible name. */
    actions: {
      move: { cta: 'Move' },
      review: { cta: 'Review' },
      setUpPin: { cta: 'Set up PIN' },
      find: { cta: 'Find class' },
      sending: { cta: 'Sending…' },
      notNow: { cta: 'Not now' },
      /** The veto on a learner-side request (device cancel). */
      cancelRequest: { cta: 'Cancel the request' },
      /** The planned (cooling-off) sheet. */
      cancelMove: { cta: 'Cancel the move' },
      /** The Home line while a move is planned. */
      cancel: { cta: 'Cancel' },
    },
    /** Classes card quiet lines (variants a, b, d, d') and the pending row's first line. */
    card: {
      classScope: 'Use your rescue code first.',
      askConsole: 'Ask the grown-up with the account to answer this in the console.',
      needsPin: 'A grown-up needs to set up a PIN first. Open Profile, then Grown-up zone.',
      pinTooNew: 'Moves open one day after the PIN is set.',
      /** Teacher-started (`initiator: 'source'`). */
      sourceAsked: (source: string) => `${source} asked about a move.`,
      /** Learner-side, and any initiator value this app does not know. */
      learnerAsked: (destination: string) => `Asked: a move to ${destination}.`,
    },
    /** State lines the card, the sheets and Home share; one short sentence each, dates arrive formatted. */
    lines: {
      checkAgain: 'Please check this again.',
      waitingOther: 'Waiting for the other class to answer.',
      waitingClasses: 'Waiting for the classes to answer.',
      waitingRoom: 'Waiting for room in the new class.',
      cannotAnswer: "This move can't be answered here.",
      planned: (date: string) => `A move is planned for ${date}.`,
      ended: 'This request ended.',
      /** A one-off `role="status"` after a class tablet's inbox answers 401. */
      joinAgain: 'Join your new class again.',
      /** A one-off `role="status"` when the inbox shows `executed`. */
      moved: (name: string, destination: string) => `Moved. ${name} is now in ${destination}. Cards and stars stayed with ${name}.`,
      /** The read-only sheet's first line and the teacher-started Home line. */
      askedMoving: (source: string, name: string, destination: string) => `${source} asked about moving ${name} to ${destination}.`,
      consoleAnswers: 'A grown-up with an account answers this in the console.',
      /** Not now's description on a teacher-started read-only sheet; it names the `actions.notNow` button. */
      notNowEnds: 'Not now ends this request.',
    },
    /** MoveClass (device route, learner-started only). The code field reuses `join.code.rules` and `join.code.placeholder`. */
    move: {
      title: 'Move to another class',
      step1: 'Ask the new teacher for their class code.',
      codeLabel: 'Class code',
      sent: 'Request sent. Nothing changes until everyone says yes.',
    },
    /** One line per preview / create answer under the code field (`role="alert"`); consent is never queued. */
    errors: {
      codeNotFound: "That code didn't work.",
      codeExpired: 'That code is too old. Ask for a new one.',
      full: 'That class is full right now.',
      alreadyMember: (name: string) => `${name} is already in that class.`,
      tooManyAttempts: 'Too many tries. Try again later.',
      cooldown: 'You can ask again in about a week.',
      caregiverRequired: 'Ask the grown-up with the account to start this move in the console.',
      deviceConsentLocked: "Moves can't be started on this device yet.",
      alreadyOpenClass: (name: string) => `A class already asked about moving ${name}. Look on the Classes & family card.`,
      alreadyOpenLearner: (name: string) => `A move for ${name} is already waiting. Look on the Classes & family card.`,
      sameSpace: (name: string) => `That code is for the class ${name} is in now.`,
      notTransferable: "That code can't be used for a move.",
      destinationBusy: 'That class has many moves waiting. Try again in a few days.',
      tooManyRequests: 'Too many moves were started today. Try again tomorrow.',
      localeUnavailable: 'Not available in your language yet.',
      updateApp: 'Update the app to see the new text.',
    },
    /** The self-audience consent frame; the rest of the frame is `console.transfer.consent`. */
    consent: {
      titleSelf: (destination: string) => `Move to ${destination}?`,
      yesSelf: 'Yes, move me',
    },
    /** The read-only sheet (guard 11): the request, where the yes happens, and only the veto and Back. */
    readOnly: { title: 'A move is waiting' },
    /** One calm line under the Hoya tip when the learner side must answer; the teacher-started one is `lines.askedMoving`. */
    home: {
      learnerWaiting: (destination: string) => `A move to ${destination} is waiting.`,
      selfWaiting: 'A move is waiting for you.',
    },
    /** Read aloud, never drawn. */
    a11y: {
      review: 'Review the move',
      move: (space: string) => `Move from ${space}`,
    },
  },
} as const;
