/** Generic buttons, time words and errors shared by every surface (F-I18N-001 §3.4 rule 2). */
export const common = {
  buttons: {
    ok: 'OK',
    cancel: 'Cancel',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    close: 'Close',
    save: 'Save',
    tryAgain: 'Try again',
    continue: 'Continue',
  },
  /** Words for `describeRelativeDay`. */
  time: {
    today: 'today',
    yesterday: 'yesterday',
    notYet: 'not yet',
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
  },
  /**
   * Notes from grown-ups (F-FEEDBACK-001 FB-5, sections 6.3, 6.6 and 6.11): ids rendered in the
   * viewer's UI language, so the learner app, the grown-up zone and the console share one wording.
   * Keys are the frozen ids of `@hangul-route/content-schema` (`NOTE_PRESET_IDS`, `NOTE_REACTION_IDS`,
   * `FAMILY_LABEL_IDS`), in that order. ko / es fall back to English until a native review (OD-15).
   */
  notes: {
    presets: {
      effort_keep_trying: 'You keep trying. That is how we learn.',
      effort_proud: 'I am proud of how hard you worked.',
      effort_practice_helps: 'Your practice is helping you.',
      progress_new_letters: 'You learned new letters. Great work!',
      progress_reading: 'Your reading is getting stronger.',
      progress_writing: 'Your writing looks neat and clear.',
      progress_listening: 'You listen so carefully.',
      progress_new_card: 'You earned a new card. Well done!',
      next_try_this: 'Try this quest next. I think you will like it.',
      next_look_again: "Let's look at your letters again together.",
      next_take_time: 'Take your time. There is no rush.',
      warm_thinking_of_you: 'Thinking of you. Have fun learning today.',
      warm_cheering: 'Hoya and I are cheering for you.',
      warm_see_you_in_class: 'See you in class soon.',
      warm_learning_together: 'We love learning Korean with you.',
    },
    /** An unknown preset id (a newer Worker), or a "try this quest" note whose quest this app cannot show. */
    presetFallback: 'A note for you.',
    reactions: {
      thanks: 'Thank you',
      will_try: 'I will try it',
      did_it: 'I did it',
      happy: 'This made me happy',
    },
    /** How a family sender signs. `partner` is read as `family` unless the learner is a self learner (FB-7 view.ts). */
    familyLabels: {
      family: 'Your family',
      mom: 'Mom',
      dad: 'Dad',
      grandma: 'Grandma',
      grandpa: 'Grandpa',
      aunt: 'Aunt',
      uncle: 'Uncle',
      guardian: 'Your guardian',
      partner: 'Your partner',
    },
    /** A class note's sender: the class name the learner's app already knows, never an account name (OD-5). */
    teacherLabel: (className: string) => `Your teacher · ${className}`,
    /** A class note whose class name this device does not know yet (its membership row has not arrived). */
    teacherOnly: 'Your teacher',
    /** Note dates: these two words, otherwise a short date from `formatDate` (section 6.11). */
    date: { today: 'Today', yesterday: 'Yesterday' },
    /** The pill on a new note, the Home card and a grown-up row: a word, never only a dot (section 6.12). */
    new: { pill: 'New' },
  },
  /**
   * The Display (Aa) sheet (owner items 6 and 7): the device's one UI language and text size, read by
   * the learner app, All lessons, the presenter and the grown-up pages, so every surface words it the
   * same way (AMENDMENTS-DISPLAY-NAV section 10). Done and the scrim reuse `buttons.done` and `buttons.close`.
   */
  display: {
    /** The Aa button: the sign it draws (hidden from assistive tech) and its accessible name. */
    button: 'Aa',
    a11y: 'Display: language and text size',
    title: 'Display',
    language: 'Language',
    textSize: 'Text size',
    size: { standard: 'Standard', large: 'Large', larger: 'Larger', largest: 'Largest' },
    /** The live preview line, drawn at the chosen size. */
    preview: 'This is how text looks.',
    note: 'For everyone on this device. Change it any time.',
    /** Choosing another language: the confirm step, drawn in the language chosen (F-I18N-001 §3.3 safety rule). */
    confirm: {
      question: (endonym: string) => `Use ${endonym} on this device?`,
      use: (endonym: string) => `Use ${endonym}`,
      back: (endonym: string) => `Back to ${endonym}`,
    },
  },
  /**
   * The learner level's words (F-LEARN-001 §3.7, content-schema `LEARNER_LEVELS`) in level order: how much the learner
   * reads, never an age. `levelWords` (levels.ts) finds them by the stored level id.
   */
  levels: {
    pictures: { label: 'Pictures first', description: 'Big tiles and pictures, very little to read.' },
    someReading: { label: 'Some reading', description: 'Short words and short sentences.' },
    readsEasily: { label: 'Reads easily', description: 'Longer text, stories and conversations.' },
  },
} as const;
