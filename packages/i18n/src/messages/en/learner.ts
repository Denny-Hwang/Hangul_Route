import { plural } from '../../plural';

/**
 * Learner-facing screens, one sub-object per screen (F-I18N-001 §3.4 rule 2).
 * PR 5 moves the first-run and settings surfaces in, PR 6a Home, Journey, Library and
 * CardDetail, PR 6b Episode, Results and Homework, PR 7a the Quest player, PR 7b the minigames,
 * the audio prompt panel and the story copy, PR 8b the PWA banners and the crash screen; the
 * wording is unchanged. Strings that end up in a pill or a button are
 * keyed `pill` / `cta` so the length budgets (§3.11) cover them.
 * Content-derived text (stage, theme and card titles, blurbs) is not here: it comes from
 * content and is localised by the overlay mechanism (PR 12).
 * A message never embeds taught Korean (rule 5): the endonyms in the language
 * picker are passed in as arguments (they are constants, `LOCALE_META`).
 */

const count = (n: number, one: string, other: string): string => `${n} ${plural('en', n, { one, other })}`;

export const learner = {
  welcome: {
    title: "Hi! I'm Hoya.",
    invitation: 'Want to learn Korean letters with me? It only takes a few minutes a day.',
    cta: "Let's start",
    restore: 'I already have progress',
    trust: 'Start Korean from zero. Built with kids, parents, and grandparents in mind.',
  },

  /** The language chips (Welcome) and the Language card (Profile) share these. */
  language: {
    groupLabel: 'Language',
    sameAsDevice: (endonym: string) => `Same as this device (${endonym})`,
    /** The sheet is written in the language being chosen, so the person sees at once whether they can read it. */
    confirmProfile: (endonym: string) => `Use ${endonym} for this profile?`,
    confirmDevice: (endonym: string) => `Use ${endonym} on this device?`,
    confirmUse: (endonym: string) => `Use ${endonym}`,
    confirmBack: (endonym: string) => `Back to ${endonym}`,
  },

  /** Only the strings that were not already owned by `logic/onboarding/create-profile-copy.ts` (F-I18N-001 PR 5 row). */
  createProfile: {
    nameHint: {
      tooLong: (max: number) => `Names can be up to ${max} letters.`,
      unsupportedCharacter: "Please use letters, numbers, spaces, ' or -.",
    },
  },

  /** Cub labels, keyed by `AvatarKind` so `es` and `ko` can translate them. */
  avatars: {
    'hoya-orange': 'Book Tiger',
    'hoya-blue': 'Home Tiger',
    'hoya-green': 'Feast Tiger',
    'hoya-purple': 'Mountain Tiger',
    'hoya-pink': 'Craft Tiger',
  },

  firstQuest: {
    title: 'Your first card is waiting.',
    bubble: "In your first quest you'll meet Korean letters and earn a Heritage card.",
    bubbleNoQuest: 'Let me show you around first!',
    summary: (quests: number, minutes: number, cards: number) =>
      `${count(quests, 'quest', 'quests')} · about ${count(minutes, 'minute', 'minutes')} · ${count(cards, 'card', 'cards')} waiting`,
    firstUp: 'First up',
    /** Quest title, then its blurb when there is one. */
    questLine: (title: string, blurb: string | null) => (blurb === null || blurb === '' ? title : `${title} — ${blurb}`),
    cta: 'Start my journey',
  },

  profile: {
    title: 'Profiles & settings',
    switchTo: (name: string) => `Switch to ${name}`,
    playingNow: 'Playing now',
    addProfile: '+ Add a profile',
    /** The name the grown-up gate wraps in its own hint ("Add a profile (PIN required)"). */
    addProfileName: 'Add a profile',
    statsTitle: (name: string | null) => `${name ?? 'Your'} stats`,
    stats: { quests: 'Quests done', cards: 'Cards', threeStar: '3-star quests' },
    sound: { label: 'Sound', on: 'On', off: 'Off' },
    plan: {
      premium: 'Premium',
      free: 'Free plan',
      unlocked: (sponsor: string | null) =>
        sponsor === null ? 'The full journey is unlocked.' : `The full journey is unlocked — covered by ${sponsor}.`,
      freeNote: 'Stage 1 is free. More stages are on the way.',
      pillActive: 'Active',
      pillFree: 'Free',
      unlock: 'Unlock the journey',
    },
    install: { label: 'Install on this device', a11yLabel: 'Install Hangul Route on this device' },
    /** Shown when more than one language is offered (hidden while only English ships). */
    language: {
      title: 'Language',
      thisProfile: 'This profile',
      deviceDefault: 'New profiles and this device start in:',
    },
    /** Always shown: it does not depend on a second language (F-I18N-001 D2). */
    reading: {
      title: 'Reading practice',
      hideUntilTap: 'Hide romanization until I tap',
      on: 'On',
      off: 'Off',
    },
  },

  /**
   * Edit profile (F-LEARN-001 §3.11): name, reading level, cub and who is learning. Level labels
   * come from `LEARNER_LEVELS`, cub labels from `avatars`. The consent lines repeat the create
   * form's wording on purpose: a change of who is learning asks the same question.
   */
  editProfile: {
    /** The button on each card of the profile switcher. */
    cta: 'Edit',
    /** Its accessible name (the gate adds "PIN required" when the device is gated). */
    a11y: (name: string) => `Edit ${name}`,
    title: 'Edit profile',
    nameLabel: 'Name',
    namePlaceholder: 'Type a name',
    levelHeading: 'Reading level',
    avatarHeading: 'Pick a Hoya',
    who: {
      heading: 'Who is learning?',
      self: { label: 'Me', sub: "I'm 13 or older" },
      child: { label: 'My child or a student', sub: 'A grown-up sets it up' },
    },
    self: { agree: "I'm 13 or older and I agree to the Privacy Policy." },
    guardian: {
      heading: 'For a grown-up',
      body: 'A parent, guardian or teacher sets up the account. We collect as little as possible and never show ads.',
      pinHeading: 'Create a grown-up PIN',
      agree: "I'm a parent or guardian of this learner (or I set it up for them) and I agree to the Privacy Policy.",
    },
    privacyLink: 'Read the Privacy Policy',
    privacyFallback: 'Open hangulroute.com/privacy in a browser.',
    /** A learner in a class: the roster keeps the registered values until a server route exists. */
    classNote: "Changes show on your teacher's list after you join again",
    pinFailed: "Couldn't set the PIN. Try again.",
    /** Save did not go through for another reason; nothing was changed. */
    saveFailed: "Couldn't save. Try again.",
    /** The calm line under a disabled Save, one per missing step. */
    missing: {
      name: 'Type a name',
      /** A typed name the rule refuses; the hint under the field says why. */
      nameCheck: 'Check the name',
      agree: 'Tick the box to agree',
      pin: 'Create the PIN',
      unchanged: 'Change something to save',
    },
    /** The profile was removed while the screen was open. */
    notFound: 'This profile is no longer on this device.',
    save: { cta: 'Save' },
  },

  home: {
    /** `null` while there is no active profile. */
    greeting: (name: string | null) => `Hi, ${name ?? 'friend'}!`,
    subtitle: "Ready for today's quest?",
    /** Caption under the learner's cub, the way into profiles and settings. */
    profileLabel: 'Profile',
    streak: {
      pill: (days: number) => plural('en', days, { one: 'Streak 1 day', other: `Streak ${days} days` }),
    },
    cards: { pill: (cards: number) => `${cards} cards` },
    stars: { pill: (quests: number) => `${quests}★ quests` },
    mission: {
      heading: 'Today with Hoya',
      /** The daily-test card names itself; every other card is titled by its quest or episode (content). */
      dailyTest: { title: 'Quick review' },
      /** Keyed by `MissionSubtitle`, the code a mission card carries instead of prose. */
      subtitle: {
        replay: 'One more go with Hoya',
        story: 'Story time',
        new: 'Something new today',
        assigned: 'Picked just for you',
        dailyTest: 'About a minute with Hoya',
      },
    },
    progress: {
      heading: 'Stage 1 progress',
      label: (done: number, total: number) => `${done} of ${total} quests`,
    },
    homework: {
      title: 'Homework',
      due: (count: number) => `${count} to do today`,
      /** More due than the Homework list shows (F-PLAN-002 section 3.6): words, no number. */
      dueMany: 'A few to do today',
    },
    tip: "Tip — finish today's quest to keep your streak alive!",
    recentStars: 'Recent stars',
  },

  journey: {
    title: 'Heritage Journey',
    intro: '7 stages × 5 themes. Draw your own route.',
    premium: { pill: 'Premium' },
    /** Keyed by `StageAvailability`. */
    availability: { open: { pill: 'Open' }, taste: { pill: 'Taste' }, soon: { pill: 'Soon' } },
    tasteNote: 'A taste of this stage is open now. More episodes are coming.',
    /** Landmark names of the two panes on a wide window (F-LAYOUT-001 §3.13). */
    panes: { master: 'Journey map', detail: 'Episode details' },
    how: {
      title: 'How the journey works',
      body: 'Each cell is one episode. Finish every quest in a cell to complete it and earn its Heritage cards. More stages open as the journey grows.',
    },
  },

  library: {
    title: 'Heritage Library',
    collected: {
      line: (collected: number, total: number) => `${collected} of ${total} collected`,
      pill: (collected: number, total: number) => `${collected}/${total}`,
    },
    filterAll: 'All',
    locked: 'Locked',
    /** Keyed by the schema's `Rarity`, so `es` and `ko` can translate each. */
    rarity: { common: 'common', uncommon: 'uncommon', rare: 'rare', legendary: 'legendary' },
    how: { title: 'How to collect more', body: 'Finish quests to unlock cards.' },
    /** Landmark names of the two panes on a wide window (F-LAYOUT-001 §3.13). */
    panes: { master: 'Card gallery', detail: 'Card details' },
    /** How to earn a locked card, one line per award rule (F-STORY-006 §3.7): never how far along. */
    earnHint: {
      /** `title` is the episode's title (content). */
      episode: (title: string) => `Finish the episode: ${title}`,
      /** `title` is the story's title (content). */
      story: (title: string) => `Finish the story: ${title}`,
      stage: (stage: number) => `Finish every quest in Stage ${stage}`,
      welcome: 'A welcome gift from Hoya',
      /** `collection` is the set's name (content). */
      set: (collection: string) => `Collect every card from the ${collection} stories`,
    },
  },

  cardDetail: {
    notFound: 'Card not found.',
    /** The hint on the flip control, by the face being shown. */
    flip: { front: 'tap to flip', back: 'tap to flip back' },
    hear: { cta: 'Hear it' },
    share: { cta: 'Share', error: "Couldn't make the picture this time. Try again?" },
    /**
     * A locked card in the Library pane says where it is earned (F-LAYOUT-001 §3.6). `quest` gets the
     * quest title (content) and the stars it takes; `later` when no quest awards the card yet.
     */
    earn: {
      title: 'How to earn it',
      quest: (questTitle: string, minStars: number) =>
        plural('en', minStars, {
          one: `Get 1 star or more in ${questTitle} to earn this card.`,
          other: `Get ${minStars} or more stars in ${questTitle} to earn this card.`,
        }),
      later: 'This card comes in a later quest.',
    },
  },

  episode: {
    notFound: 'Episode not found.',
    comingSoon: {
      pill: 'Coming soon',
      title: 'Coming soon',
      note: 'Finish Stage 1 to help Hoya unlock this episode.',
    },
    quests: {
      heading: 'Quests',
      start: { cta: 'Start' },
      playAgain: { cta: 'Play again' },
    },
    /** `title` is the previous quest's title (content). */
    buildsOn: (title: string) => `Builds on: ${title}`,
    cards: { heading: 'Cards in this episode', waiting: 'Waiting for you' },
    /** The soft-prerequisite sheet (F-QUEST-002 §3.5): a note and a one-line offer, never a lock. */
    prereq: {
      message: (title: string) => `This one uses letters from ${title}. Start there?`,
      startThere: { cta: 'Start there' },
      playAnyway: { cta: 'Play anyway' },
    },
  },

  results: {
    /** One word per tier, never a number or a percent (F-RVW-001 §3.1). */
    headline: {
      allDone: 'All done!',
      wonderful: 'Wonderful!',
      great: 'Great!',
      tried: 'You tried!',
    },
    cheer: {
      noGames: 'Play the games next time to earn stars and a card!',
      perfect: 'Perfect! You got every one!',
      nice: 'Nice work! Try one more for three stars.',
      goodStart: 'Good start. Want to play it again?',
      brave: "Brave try! Let's do it together.",
    },
    backHome: { cta: 'Back home' },
    episodePage: { cta: 'Episode page' },
    /** The "Next up" teaser (F-QUEST-002 §3.5); the letters after `newLetters` are taught content. */
    nextUp: {
      title: 'Next up',
      next: { cta: 'Play next quest' },
      again: { cta: 'Try this one again' },
      newLetters: 'New letters:',
    },
    newCard: {
      title: 'New card for your library!',
      announce: (title: string) => `New card for your library! ${title}`,
      see: { cta: 'See my card' },
      seeA11y: (title: string) => `See my card: ${title}`,
    },
  },

  homework: {
    title: 'Homework',
    section: { today: 'Today', comingUp: 'Coming up', recentlyDone: 'Recently done' },
    bubble: {
      none: 'Nothing waiting today! Want to play a quest anyway?',
      some: (n: number) =>
        plural('en', n, { one: 'You have 1 thing to do today.', other: `You have ${n} things to do today.` }),
      /** More due than the list shows (F-PLAN-002 section 3.6): words, no number. */
      aFew: 'You have a few things to do today.',
    },
    allClear: {
      title: 'All clear!',
      played: 'Hoya suggests a quick review from Today.',
      fresh: 'Try your first quest from Today.',
    },
    doneEmpty: 'Finished homework shows up here.',
    /** Shown for an assignment whose quest this build does not know. */
    questFallback: 'Quest',
    due: {
      today: 'Today',
      tomorrow: 'Tomorrow',
      inDays: (n: number) => plural('en', n, { one: 'In 1 day', other: `In ${n} days` }),
    },
    /** Who set it, keyed by the schema's `assignedBy`: no role jargon. `route` is the learner's own weekly plan (F-PLAN-002). */
    from: { parent: 'From home', teacher: 'From class', system: 'From Hoya', route: 'Your plan' },
    /** Under the first three Today rows when more are due (F-PLAN-002 section 3.6): never a number. */
    moreToday: 'More are waiting. They come one at a time.',
    /** The one collapsed row after the next seven days of Coming up: it can hold any source, so it names none. */
    later: 'Later',
  },

  /** The Quest player (QuestPlayerScreen, its game launcher cards and the Discover step), F-QUEST-002. */
  quest: {
    notFound: 'Quest not found.',
    goBack: { cta: 'Go back' },
    /** The confirm shown by the close control; stars already saved are untouched. */
    leave: {
      title: 'Leave this quest?',
      message: 'Stars from this try will not be saved.',
      confirm: { cta: 'Leave' },
      keep: { cta: 'Keep playing' },
    },
    /** The step counter pill: `step` of `total`. */
    progress: (step: number, total: number) => `${step} / ${total}`,
    /** Plain Pre-A1 words for the step kinds, not the authoring terms (audit UX-17). */
    step: {
      intro: { pill: 'Hello' },
      present: { pill: 'Look and listen' },
      discover: { pill: 'Look and learn' },
      practice: { pill: 'Practice' },
      apply: { pill: 'Try it' },
      check: { pill: 'Quick check' },
      reward: { pill: 'Finish' },
    },
    continue: { cta: 'Continue' },
    seeResults: { cta: 'See results' },
    /** Hoya's line when a narrative step authored none. */
    keepGoing: "Let's keep going!",
    /** The card before a minigame: the generic game card and the Check's own variant (F-QUEST-002 §3.3). */
    launcher: {
      game: {
        heading: 'Ready for a quick game?',
        body: "Tap to play. When the game is done you'll come right back.",
        play: { cta: 'Play minigame' },
        skip: { cta: 'Skip for now' },
      },
      check: {
        heading: 'Two quick ones',
        go: { cta: 'Go' },
      },
    },
    /** Discover (F-QUEST-002 §3.2); the symbols, sounds and words on the pages are taught content. */
    discover: {
      hearIt: { cta: 'Hear it' },
      letterName: { cta: 'Letter name' },
      /** Shown for a button whose audio could not play; `spoken` is a romanization. */
      sayLine: (spoken: string) => `Say it out loud: ${spoken}`,
      showHowToSay: { cta: 'Show how to say it' },
      heard: { pill: 'Heard' },
      continue: { cta: 'Continue' },
      wordsTitle: 'Words you can read now',
      batchimLine: 'Sits at the bottom of the block',
      empty: 'Nothing to look at here. Tap Continue.',
      pageLabel: (page: number, count: number) => `Page ${page} of ${count}`,
    },
  },

  /**
   * The minigames (MinigameScreen and the games it launches), PR 7b. The pairs, glosses and
   * step labels a game plays come from content (`minigame-config`), not from here (PR 12).
   */
  minigame: {
    notFound: 'Minigame not found.',
    comingSoon: 'This minigame is coming soon.',
    voiceSoon: 'Voice practice is opening in our next beta.',
    backToQuest: { cta: 'Back to quest' },
    noRounds: 'No rounds.',
    /** The round counter pill: `round` of `total`. */
    progress: { pill: (round: number, total: number) => `${round} / ${total}` },
    skip: { cta: 'Skip' },
    /** Build a Letter (F-QUEST-002 §3.7). */
    buildLetter: {
      heading: 'Build this letter',
      slots: 'Slots:',
      tiles: 'Tiles',
      /** Hoya after a miss; `hint` is one of `shape`. */
      notQuite: (hint: string) => `Not quite. Try again. ${hint}`,
      /** Where the letters of the block go, keyed by the block shape: whole sentences, never "left to right". */
      shape: {
        beside: 'The vowel goes beside the first letter.',
        under: 'The vowel goes under the first letter.',
        besideFinal: 'The vowel goes beside the first letter. The last letter sits at the bottom.',
        underFinal: 'The vowel goes under the first letter. The last letter sits at the bottom.',
      },
    },
    /** Trace Stroke (F-004 to F-008): coverage passes; order and direction only surface as "next time" nudges. */
    trace: {
      /** `romanization` is the letter's sound value. */
      heading: (romanization: string) => `Trace the letter ${romanization}`,
      instruction: 'Draw the letter with your finger.',
      showMe: { cta: 'Show me' },
      clear: { cta: 'Clear' },
      done: { cta: 'Done' },
      idle: 'Slowly draw the letter. Lift your finger to finish.',
      /** After a pass: the order nudge wins, then an open-stroke direction nudge, then a loop one, else praise. */
      pass: {
        order: 'You got it! Next time, try drawing the top line first.',
        open: 'Nice! Try drawing left-to-right next time.',
        loop: 'Nice! Next time, try going around the other way.',
        clean: 'Beautiful! That looks like the letter.',
      },
      /** Before a retry: order coaching (strict mode, order the only thing off), else the standard line. */
      retry: {
        order: 'Almost! Try drawing the strokes in the right order. Tap Show me to see.',
        start: 'Try again — start at the top!',
      },
    },
    /** Pic-Word Match (F-QUEST-002 §3.11): Skip is `skip`, the way out `backToQuest`. */
    picWord: {
      heading: 'Match each picture',
      instruction: 'Tap a picture, then its word.',
      /** The live line once one side is picked: `gloss` is the picture's meaning (content). */
      pictureSelected: (gloss: string) => `Picture selected: ${gloss}. Choose a word.`,
      /** `word` is the taught Korean word, passed in (never typed into the message). */
      wordSelected: (word: string) => `Word selected: ${word}. Choose a picture.`,
      missHoya: 'Try another one',
      empty: 'Nothing to play here',
    },
    /** Listen & Pick (F-QUEST-002 §3.10): the no-sound line is `audio.readHere`, the way out `backToQuest`. */
    listenPick: {
      heading: 'Listen, then pick',
      /** The header of the two-question Check. */
      checkTitle: { pill: 'Quick check' },
      hearAgain: { cta: 'Hear it again' },
      missHoya: 'Listen again',
      empty: 'Nothing to play here',
    },
    /**
     * Voice Echo (behind `flags.voiceEchoEnabled`, off at launch): listen, say it back, confirm.
     * The shipped caption ended in a tiger emoji; the dictionary carries no emoji (CLAUDE.md), so it is dropped.
     */
    voiceEcho: {
      heading: 'Say it out loud',
      bubble: "Listen to me, then say it back out loud. Tap 'I said it' when done.",
      saidIt: 'I said it!',
      note: "Voice grading is coming soon — for now it's honor system",
      continue: { cta: 'Continue' },
    },
    /** Tap & Respond: someone speaks, the learner picks a reply. */
    tapRespond: {
      noDialogue: 'No dialogue.',
      heading: 'Choose your reply',
      someoneSays: 'Someone says',
      tryAnother: "Hmm, that doesn't fit. Try another!",
    },
    /** Odd One Out: three of a kind and one that is not. */
    oddOneOut: {
      heading: "Tap the one that doesn't belong",
      instruction: 'Three are the same kind. One is different.',
      lookAgain: 'Look again — which kind is different?',
    },
    /** Culture Quiz: a Korean word, pick its meaning. */
    cultureQuiz: {
      heading: 'What does this mean?',
      tryAnother: 'Not quite — try another!',
    },
    /** Card Match: Korean words on the left, meanings on the right. */
    cardMatch: {
      heading: 'Match the meaning',
      instruction: 'Tap a Korean word, then its English meaning.',
      nowMeaning: 'Now tap its meaning on the right.',
    },
  },

  /**
   * The audio prompt panel, its speaker button and the "Add a Korean voice" sheet (F-AUDIO-004
   * §3.7-3.8), shared by the minigames, Discover and the Profile Sound card. Korean letters are
   * shown by the screens as taught content, never inside these strings.
   */
  audio: {
    readHere: 'No sound? Read it here.',
    /** The Match Sound heading: listening, or reading the sound as text. */
    heading: { listen: 'Tap the letter you hear', text: 'Tap the letter for this sound' },
    /** Hoya after a miss; the spoken syllable and its romanization follow as taught content. */
    listenAgain: 'Listen again. This one says',
    hearIt: { cta: 'Hear it' },
    tapToHear: 'Tap to hear',
    tapToReplay: 'Tap to replay',
    /** The panel's one button, keyed by `FallbackAction` (`none` has no button). */
    action: {
      turn_on: { cta: 'Turn sound on' },
      try_again: { cta: 'Try again' },
      tap_to_hear: { cta: 'Tap to hear' },
    },
    soundIsOff: 'Sound is off.',
    noKoreanVoice: 'No Korean voice on this device',
    /** The panel's second line, a sentence. */
    noKoreanVoiceSentence: 'No Korean voice on this device.',
    didNotPlay: 'The sound did not play.',
    letterName: { cta: 'Letter name' },
    /** Accessibility label of the speaker button; it states the state. */
    speaker: { on: 'Play sound', off: 'Play sound, sound is off' },
    /** The Profile Sound card's second line. */
    voice: {
      ready: 'Korean voice: ready',
      needsInternet: 'Korean voice needs the internet',
      looking: 'Looking for a Korean voice',
    },
    howToAddVoice: { cta: 'How to add a voice' },
    /** Menu names follow Apple, Google and Microsoft help pages and vary by OS version, so the sheet says so. */
    voiceHelp: {
      title: 'Add a Korean voice',
      note: 'Menu names can differ on your device.',
      sections: {
        apple: {
          title: 'iPhone or iPad',
          steps: [
            'Open Settings, then Accessibility.',
            'Tap Spoken Content, then Voices, then Korean.',
            'Download a voice, such as Yuna. Enhanced or Premium sounds best.',
            'Come back and reopen Hangul Route.',
          ],
        },
        android: {
          title: 'Android',
          steps: [
            'Open Settings, then search for Text-to-speech output.',
            'Choose Speech Services by Google and tap the gear.',
            'Tap Install voice data, then Korean.',
            'Come back and reopen Hangul Route.',
          ],
        },
        computer: {
          title: 'Computer',
          steps: [
            'Mac: System Settings, Accessibility, Spoken Content, System Voice, Manage Voices, then Korean.',
            'Windows: Settings, Time & language, Speech, Manage voices, then Add voices and Korean.',
            'Chrome and Edge: some Korean voices need the internet, so check you are online.',
            'Reload this page.',
          ],
        },
      },
      footer: 'You can still play: the sound is written on screen.',
    },
  },

  /**
   * The story check, Story Order, word recap and story Results (F-STORY-003 §3.4-3.7), moved from
   * `logic/story/copy.ts` in PR 7b. Never a number-as-score, ratio or percent; never red-and-cross
   * wording (D3). Story text itself (titles, captions, narration) is content.
   */
  story: {
    check: {
      position: { pill: (index: number, total: number) => `${index} / ${total}` },
      positionLabel: (index: number, total: number) => `Question ${index} of ${total}`,
      tryAnother: 'Try another',
      correct: 'Correct',
      next: { cta: 'Next' },
      defaultHint: 'Not quite. Have another look.',
      lookHere: 'This one is worth a look.',
      speakerPrompt: 'Hear the question',
      speakerOptions: 'Hear the answers',
      speakerTarget: 'Hear the Korean word',
      showRomanization: { cta: 'Show how to say it' },
      pictureOptionLabel: (label: string) => `Picture: ${label}`,
      emptyLine: 'There are no questions for this story yet.',
      continue: { cta: 'Continue' },
    },
    recap: {
      title: 'Words from this story',
      done: { cta: 'Done' },
      wordsLabel: (count: number) =>
        plural('en', count, { one: '1 word from this story', other: `${count} words from this story` }),
      hearWord: (romanization: string) => `Hear ${romanization}`,
    },
    sequence: {
      title: 'Put the story in order',
      hint: 'Tap each picture, starting with what happened first.',
      /** The hint while the cards are text only (no scene art yet). */
      stepHint: 'Tap each step, starting with what happened first.',
      skip: { cta: 'Skip this one' },
      positionLabel: (index: number, total: number) => `Picture ${index} of ${total}`,
      /** A slot of the row the learner fills: its place, and the card in it when it has one. */
      slotLabel: (index: number, total: number, caption?: string) =>
        caption === undefined ? `Place ${index} of ${total}, empty` : `Place ${index} of ${total}: ${caption}`,
      tryAnother: 'Try another',
      lookHere: 'This one comes next.',
      emptyLine: 'There is nothing to put in order yet.',
      continue: { cta: 'Continue' },
      replay: {
        title: 'The story, in order',
        pause: { cta: 'Pause' },
        play: { cta: 'Play' },
        back: { cta: 'Back' },
        next: { cta: 'Next' },
        skip: { cta: 'Skip replay' },
        done: { cta: 'Done' },
      },
    },
    results: {
      nextStory: { cta: 'Next story' },
      backHome: { cta: 'Back home' },
      readAgain: { cta: 'Read it again' },
      episodePage: { cta: 'Episode page' },
      /** `title` is the culture note's title (content). */
      cultureNote: (title: string) => `Learn about ${title}`,
      encourage: 'Every read helps. Want to read it again?',
    },
    /**
     * The story reader (F-STORY-002 §3.3-3.7), moved unchanged from `logic/story/story-reader-copy.ts`
     * in PR 2.6a. Never a number-as-score, never an age (D1, D3). Taught Korean is never here: the
     * reader draws it with `KoreanText` from the story data.
     */
    reader: {
      close: 'Close',
      back: { cta: 'Back' },
      next: { cta: 'Next' },
      finish: { cta: 'Finish' },
      sources: { cta: 'Sources' },
      readToMe: 'Read to me',
      /** A page number, not a meter: it may go down on Back. */
      position: { pill: (index: number, total: number) => `${index} / ${total}` },
      sceneOf: (index: number, total: number) => `Scene ${index} of ${total}`,
      /** Announced when a scene opens: position, then the picture. */
      announce: (index: number, total: number, artDescription: string) =>
        `Scene ${index} of ${total}. ${artDescription}`,
      traditionalTale: { pill: 'Traditional tale' },
      inEnglish: 'In English',
      didYouKnow: { cta: 'Did you know?' },
      sayItYourself: { pill: 'Say it yourself' },
      tapToHear: 'Tap to hear',
      hearStory: 'Hear this scene',
      hearKorean: 'Hear the Korean',
      hearTerm: (romanization: string) => `Hear ${romanization}`,
      /** Screen-reader label of an inline term chip. */
      termLabel: (romanization: string, gloss: string) => `Korean word ${romanization}, ${gloss}. Double tap to hear.`,
      showRomanization: { cta: 'Show how to say it' },
      closeGloss: { cta: 'Close' },
      /** One line, then Back and (quest mode) Continue: a content problem never traps a quest. */
      unavailable: 'This story is not ready to read yet.',
      continue: { cta: 'Continue' },
      advisory: (note: string) => `A note for grown-ups: ${note}`,
      dismiss: { cta: 'Dismiss' },
      cultureNote: {
        moreInCultureNotes: { cta: 'More in Culture notes' },
        close: { cta: 'Close' },
      },
      checkpoint: {
        tryIt: 'Try it',
        skip: { cta: 'Skip' },
      },
    },
    /** The reader's end page (F-STORY-002 §3.7): one primary, at most two ghosts. */
    end: {
      title: 'The End',
      continue: { cta: 'Continue' },
      done: { cta: 'Done' },
      readAgain: { cta: 'Read again' },
      sources: { cta: 'Sources' },
    },
    /**
     * The Sources screen (F-STORY-002 §3.8), moved unchanged from `logic/story/story-reader-copy.ts`
     * in PR 2.7. Counts are allowed here (not a learner result); never an age (D1). Titles,
     * publishers, quotes and the Korean claim are citations from the story data, never here.
     */
    sources: {
      title: 'Sources',
      back: 'Back',
      traditionalTale: { pill: 'Traditional tale' },
      traditionalNote: 'One version of a story told in many versions',
      checked: (passes: number, date: string, contentVer: number) =>
        `Checked in ${count(passes, 'independent pass', 'independent passes')} · last checked ${date} · story version ${contentVer}`,
      /** A `scope: 'cluster'` verification record: say only what the record says. */
      clusterChecked: 'These checks covered a group of related stories, not this story alone.',
      howChecked: { cta: 'How it was checked' },
      advisoryHeading: 'A gentle note for grown-ups',
      corrections: 'Corrections',
      sceneHeading: (sceneNumber: number) => `Scene ${sceneNumber}`,
      seeFact: (factId: string) => `See fact ${factId}`,
      korean: { cta: 'Korean' },
      scope: {
        documented: 'What we know',
        inTheTale: 'What the tale says',
      },
      updated: { pill: 'Updated' },
      updatedOn: { pill: (date: string) => `Updated ${date}` },
      sourcesHeading: (n: number) => `Sources (${n})`,
      accessed: (date: string) => `accessed ${date}`,
      sourceLabel: (index: number, total: number, title: string, publisher: string) =>
        `Source ${index} of ${total}: ${title}, ${publisher}`,
      approximation: (text: string, rationale: string) => `About “${text}”: ${rationale}`,
      dependsOnToday: 'This depends on today’s date.',
      usedInQuestions: 'Used in questions and notes',
      highlighted: { pill: 'Highlighted' },
      /** A grown-up action: the link is opened only after the gate. */
      openLink: { cta: 'Open link' },
      copyLink: { cta: 'Copy link' },
      linkCopied: 'Link copied',
      copyUnavailable: 'Copying is not available here. The link is above.',
      openFailed: (url: string) => `Open this link in a browser: ${url}`,
      needsConnection: 'Opening a link needs a connection.',
      /** Web, back from the grown-up gate: the browser needs a tap of its own to open a tab. */
      gateDone: 'Grown-up check done. Tap Open link to open it.',
      counts: (facts: number, sources: number) => `${count(facts, 'fact', 'facts')} · ${count(sources, 'source', 'sources')}`,
      noSources: 'No sources are listed for this story.',
    },
  },

  /**
   * The non-modal PWA banners (wireframe pwa/system-banners, PR 8b): the offline chip, the
   * offline-ready toast and the update bar. Hoya-toned; the update only applies when tapped.
   */
  pwa: {
    offline: 'Offline — everything still works',
    offlineReady: 'All set! You can play without Wi-Fi now.',
    update: {
      title: 'New lessons are ready.',
      hint: 'Tap when you finish what you are doing.',
      refresh: { cta: 'Refresh' },
    },
  },

  /** The top-level crash screen (PR 8b): warm and blame-free; its button is `common.buttons.tryAgain`. */
  oops: {
    title: 'Hoya tripped over a rock.',
    body: "Your cards and stars are safe. Let's hop back in.",
    bubble: 'Oops! That was not your fault. Tap the button and we go again.',
  },

  /** The soft portrait guard on a phone held sideways (F-LAYOUT-001 §3.4, wireframe layout/wide E). */
  portraitGuard: {
    title: 'Turn your phone upright',
    keepSideways: { cta: 'Keep sideways' },
  },

  /**
   * The level check (F-PLC-001 sections 3.1 and 3.12, wireframe placement). Every screen of the
   * flow lives here, the grown-up options and sound-needed screens included, so one copy scan
   * covers them: no digit except the two allow-listed duration lines, no percent, no ratio, no
   * age words, no score words and never "test" in the learner-facing name. Hoya's cheers are
   * effort-only and never say whether an answer was right.
   */
  placement: {
    invite: {
      title: 'Where should we start?',
      newToKorean: 'I am new to Korean',
      knowSome: 'I already know some Korean',
      duration: 'It takes a few minutes. You can stop at any time.',
    },
    language: {
      title: 'Pick the language for the check',
      note: 'This does not change the app language.',
      noKoreanVoice: 'No Korean voice on this device',
      noVoice: 'No voice for this language here',
      continue: { cta: 'Continue' },
    },
    options: {
      cardTitle: 'Set up the check',
      title: 'A few choices',
      howLong: 'How long?',
      change: 'Change',
      start: { cta: 'Start' },
      next: { cta: 'Next' },
      mode: {
        short: {
          label: 'Short',
          help: 'A few picture and sound questions.',
          duration: 'Just a few minutes.',
          needsSound: 'The short check needs sound.',
        },
        standard: {
          label: 'Standard',
          help: 'Letters, sounds, words and sentences.',
          duration: 'Usually under 10 minutes.',
        },
        deep: {
          label: 'Deep',
          help: 'More questions, to be extra sure. Hoya takes a break halfway.',
          duration: 'Usually under 20 minutes.',
        },
      },
      soundGuide: {
        title: 'Sound guide',
        always: 'Always show it',
        tap: 'Show it only when I tap',
        consequence:
          'With the guide shown, the check looks at shapes and listening. With it hidden until you tap, it can also look at reading. Your own setting is not changed.',
      },
      takeMyTime: { label: 'Take my time', help: 'No time limits.' },
      /** Section 3.12: the web cannot tell whether a screen reader is on (spec assumption 5), so the grown-up says so here. */
      screenReader: { label: 'I use a screen reader', help: 'Questions play when you tap them, with no time limits.' },
      why: {
        title: 'Why Korean?',
        heritage: 'My family',
        kculture: 'K-culture',
        curious: 'Just curious',
        friends: 'A Korean friend',
        skip: 'Skip',
      },
      limited: 'This device cannot play Korean sound, so we will use pictures and reading.',
    },
    handoff: {
      ready: 'Ready? Tap Hoya to start.',
      helper: 'Helping? Let them choose. "Not sure" is a fine answer.',
    },
    warmup: {
      line: 'Listen, then tap the picture.',
      noSound: 'No sound here, so we will use pictures and reading.',
    },
    item: {
      tapToHear: 'Tap to hear it.',
      hearAgain: 'Hear it again',
      showSound: 'Show how it sounds',
      notSure: 'I am not sure',
      exit: 'Let us start learning',
      gotIt: 'Got it',
      noSoundFallback: 'No sound? Read it here.',
      /** Screen readers, on each question: "Question, 4 choices". */
      questionLabel: (choices: number) =>
        plural('en', choices, { one: 'Question, 1 choice', other: `Question, ${choices} choices` }),
      /** A picture option's accessible name when its meaning would be the answer (test language Korean). */
      pictureChoice: (position: number) => `Picture ${position}`,
    },
    /**
     * One short instruction per question format, written and spoken (section 3.2).
     * It never names the answer, a letter or a Korean word. With Korean as the test
     * language the four letter formats are spoken only (the screen hides the line).
     */
    instruction: {
      shapeOddOneOut: 'Which one is different?',
      hearPickWritten: 'Listen. Tap what you hear.',
      seePickSound: 'Look. Tap how it sounds.',
      buildSyllable: 'Listen. Tap the block you hear.',
      hearPickPicture: 'Listen. Tap the picture.',
      readPickPicture: 'Read it. Tap the picture.',
      replyPick: 'Listen. Tap a good answer.',
    },
    /** Every third answer in Standard and Deep, whatever the answers were. */
    cheer: ['You are doing fine. Keep going!', 'Hoya likes how you try.', 'Nice and calm. On we go!'],
    /** Every second answer in Short: effort only, never a word about being right. */
    cheerShort: ['Thanks for listening!', 'Nice and steady.', 'Hoya likes your listening.'],
    pause: {
      title: 'Need a break?',
      keepGoing: 'Keep going',
      enough: 'That is enough, start learning',
      grownUp: 'For grown-ups: finish now',
    },
    rest: { line: 'Hoya is stretching. Keep going?' },
    soundNeeded: {
      title: 'Turn on sound to play',
      tryAgain: 'Try again',
      startLearning: 'Start learning',
      withoutSound: 'Check without sound',
    },
    resume: { title: 'Pick up where you left off?', continue: 'Continue', startAgain: 'Start again' },
    /** Band labels: the only words about level on a learner screen (section 3.6). */
    band: {
      beginning: 'At the beginning',
      lettersAndSounds: 'Letters and sounds',
      everyLetter: 'Every letter',
      readingWords: 'Reading words',
      firstWords: 'First words',
      firstSentences: 'First sentences',
    },
    result: {
      found: 'Hoya found your starting spot!',
      goodPlace: 'Here is a good place to start',
      notTestedLine: 'We checked listening and shapes. To find where to start reading, try the check with the sound guide hidden.',
      retryHidden: 'Try it with the sound guide hidden',
      startHere: 'Start here',
      next: 'Next',
      later: 'Later',
      start: { cta: 'Start' },
      seeMyRoute: 'See my route',
      seeMap: 'See the whole map',
      forGrownUps: 'For grown-ups',
      forGrownUpsPlan: 'For grown-ups: set up a weekly plan',
      knowALot: 'You know a lot! More adventures are coming.',
      openStories: 'Open stories',
      routeStays: 'Your route stays right where it is.',
      planStays: 'Your plan stays right where it is.',
      laterStart: 'Hoya found a later place to start.',
      planCanMove: 'Your weekly plan can move ahead and keep the same end date.',
      updatePlan: 'Update my plan',
      keepPlan: 'Keep my plan',
      tryStandard: 'Try the standard check',
      /** The mini map's accessible name: the start cell has a pin, cells to skip ahead of a light outline. */
      map: 'Your route on the map. The pin is where you start.',
      strip: {
        title: 'Hoya made a weekly plan for you',
        usePlan: 'Use this plan',
        change: 'Change',
        justStart: 'Just start',
      },
    },
    homeCard: {
      line: 'Already know some Korean?',
      take: 'Take the level check',
      continue: 'Continue the level check',
      notNow: 'Not now',
    },
    profileRow: 'Find my starting spot again',
  },

  /**
   * The story shelf (F-STORY-004 §3.3-3.8): Library sections, story tiles and the Picked for you
   * hero, the story episode page, Culture notes and the Home story card. Counts, never fractions or
   * "behind" (D3); no "Premium" anywhere (D5). Story and note text (titles, bodies, terms, sources)
   * is content. Whole-sentence messages, never suffix concatenation (audit I18N-08).
   */
  storyShelf: {
    /** Section tab labels, keyed by `LibrarySectionId` (`logic/story/library-sections.ts`). */
    sections: { cards: 'Cards', 'story-time': 'Story Time', culture: 'Culture', 'theme-packs': 'Theme packs' },
    /** Screen-reader name of the section tab row. */
    sectionsLabel: 'Library sections',
    pickedForYou: 'Picked for you',
    start: { cta: 'Start' },
    keepReading: { cta: 'Keep reading' },
    readAgain: { cta: 'Read it again' },
    playAgain: { cta: 'Play again' },
    startOver: { cta: 'Start over' },
    /** The state line of a tile or tale row: always words, never colour alone. */
    state: { new: 'New', inProgress: 'Keep reading', finished: 'Finished', locked: 'Locked' },
    minutes: { pill: (minutes: number) => `about ${minutes} min` },
    /**
     * The one label of a whole story tile: `title` is the story's title (content), `state` a `state`
     * line. `stars` (a finished story with at least one star) is read out too, since the tile's
     * StarRow sits inside the one button; a 0-star finish says nothing about stars (D3).
     */
    tileLabel: (title: string, state: string, minutes: number, stars = 0) =>
      `${title}. ${state}. ${plural('en', minutes, { one: 'About 1 minute', other: `About ${minutes} minutes` })}.` +
      (stars > 0 ? ` ${plural('en', stars, { one: '1 star', other: `${stars} stars` })}.` : ''),
    /** The Home story card subtitle by `storyReason`, and the `explore` card that replaces the old "Story time" label. */
    home: {
      subtitle: { continue: 'Keep reading', next: 'A short story', again: 'Read it again' },
      explore: 'Take a look',
    },
    episode: {
      minutes: { pill: (minutes: number) => `${minutes} min` },
      wordsTitle: 'Words in this story',
      hearWord: (romanization: string) => `Hear ${romanization}`,
      cultureNotes: (found: number) => `Culture notes: ${found} found`,
    },
    cultureNotes: {
      title: 'Culture notes',
      found: { pill: (found: number) => `${found} found` },
      /** `title` is the story's title (content). */
      fromStory: (title: string) => `From the story: ${title}`,
      /** The collapsed sources row: the same words for every reader, whatever their age (CLAUDE.md §1). */
      whereFrom: 'Where this comes from',
      /** One source line, plain text (no links): the work's title and its publisher (content). */
      source: (title: string, publisher: string) => `${title}, ${publisher}`,
      hearTerm: (romanization: string) => `Hear ${romanization}`,
      empty: {
        line: 'Finish a story to find your first culture note.',
        toStoryTime: { cta: 'Go to Story Time' },
      },
    },
  },
} as const;
