import { plural } from '../../plural';

/**
 * Progress reports (F-REPORT-001 section 3.11, RP-6): the learner report and the class report on the console,
 * and the in-app report behind the grown-up gate. One namespace for all three, so the console and the learner
 * app say the same thing about the same data. Screen-reader labels live in `a11y.report`.
 *
 * - The report module (`packages/content-schema/src/reports/`) returns codes and numbers; the renderer picks
 *   these messages. Insight keys are the codes of section 3.6 (`insight.showed_up`, ...), so a code maps to
 *   one key.
 * - Third person, warm, about the learner. `you` holds the second-person twin of every message that names
 *   the learner (OD-17: the in-app report on a self-only device talks to the adult learner).
 * - Plan lines have a class variant ("homework") and a family variant ("this week's plan").
 * - Counts go through `plural()`; dates and month names arrive formatted (`formatDate`), never written here.
 * - A message never embeds taught Korean: letters and words arrive as one argument that the page renders in
 *   place (`aroundSlot`, Korean marked `lang="ko"`), used exactly once in every locale.
 * - Anti-shame (CLAUDE.md section 1): no percentages, no ranking or comparison with anyone else, no "down"
 *   words, no word about speaking. `report-messages.test.ts` holds the banned and whole-word lists.
 */
const dayCount = (n: number): string => plural('en', n, { one: `${n} day`, other: `${n} days` });
const minuteCount = (n: number): string => plural('en', n, { one: `${n} minute`, other: `${n} minutes` });
const questCount = (n: number): string => plural('en', n, { one: `${n} quest`, other: `${n} quests` });
const cardCount = (n: number): string => plural('en', n, { one: `${n} card`, other: `${n} cards` });
const learnerCount = (n: number): string => plural('en', n, { one: `${n} learner`, other: `${n} learners` });

export const report = {
  /** `document.title` of every report page: never the learner's name (section 3.10, browser history and print header). */
  documentTitle: 'Report - Hangul Route',
  /** The page `h1`. `name` is the roster's name (initials when the class anonymizes). */
  title: {
    learner: (name: string) => `${name}: report`,
    class: (className: string) => `${className}: class report`,
  },
  /** The parent chooser (`/parent/learner`) and the teacher chooser (`/teach/space/report`) without an id. */
  chooser: { learner: 'Whose report?', class: 'Which class?' },
  /** The four period tabs. */
  period: { day: 'Today', week: 'This week', month: 'This month', all: 'All time' },
  /**
   * A window inside a sentence ("{name} practiced on 3 days {when}."): the current window, the first step
   * back, an older window (with a formatted date or month), and the step forward for `a11y.report.step`.
   */
  when: {
    day: 'today',
    week: 'this week',
    month: 'this month',
    all: 'so far',
    prevDay: 'yesterday',
    prevWeek: 'last week',
    prevMonth: 'last month',
    onDay: (date: string) => `on ${date}`,
    weekTo: (date: string) => `in the week to ${date}`,
    inMonth: (month: string) => `in ${month}`,
    nextDay: 'the next day',
    nextWeek: 'the next week',
    nextMonth: 'the next month',
  },
  /** The Previous / Next stepper (OD-18). The first step back is named; further steps show the dates. */
  step: {
    prevDay: 'Yesterday',
    prevWeek: 'Last week',
    prevMonth: 'Last month',
    next: 'Next',
    /** A week window older than the first step: two formatted dates. */
    range: (from: string, to: string) => `${from} to ${to}`,
  },
  /** The back link (`from`): the parent home, or the space's roster. */
  back: {
    home: 'Back to home',
    space: (space: string) => `Back to ${space}`,
  },
  /** At a glance: two lines that do not depend on the period. `stage` is the stage's title. */
  glance: {
    nowOn: (n: number, stage: string) => `Now on Stage ${n}: ${stage}`,
    openRoute: 'Open Learning Route',
    lastPractice: (date: string) => `Last practice: ${date}`,
  },
  /**
   * One sentence under the tabs (section 3.5 item 5). `when` is a `report.when` value. `practicedOn` is the
   * `day` period's sentence ("Mina practiced today."); `stageDoneAll` the `all` period's; `noneThen` is
   * `noneYet` for a window in the past ("No practice last week.").
   */
  headline: {
    practiced: (name: string, days: number, when: string) => `${name} practiced on ${dayCount(days)} ${when}.`,
    practicedOn: (name: string, when: string) => `${name} practiced ${when}.`,
    stageDone: (name: string, n: number, stage: string, when: string) => `${name} finished Stage ${n}: ${stage} ${when}!`,
    stageDoneAll: (name: string, n: number, stage: string) => `${name} finished Stage ${n}: ${stage}!`,
    noneYet: (when: string) => `No practice yet ${when}.`,
    noneThen: (when: string) => `No practice ${when}.`,
    noneSaved: (name: string, when: string) => `Nothing saved from ${name}'s device ${when} yet.`,
    gettingStarted: (name: string) => `${name} is just getting started.`,
  },
  /** Under the headline when the window reaches past the last day the device saved (section 3.2). */
  horizon: (date: string) => `Figures up to ${date}.`,
  /** The `h2` headings of the learner report, in reading order, and the More detail disclosure. */
  section: {
    wentWell: 'What went well',
    practiceNext: 'What to practice next',
    thisPeriod: 'This period',
    moreDetail: 'More detail',
  },
  /** Figure labels (layer 2). `up` sits under a figure only when it grew (OD-11); nothing says less. */
  figure: {
    days: 'Practice days',
    minutes: 'Minutes',
    quests: 'New quests',
    cards: 'New cards',
    letters: 'New letters',
    words: 'New words',
    up: (previous: string) => `More than ${previous}`,
  },
  /** The window a figure grew against (`figure.up`, `insight.minutes_up`): the current one, then a past one. */
  previous: {
    week: 'last week',
    month: 'all of last month',
    weekBefore: 'the week before',
    monthBefore: 'all of the month before',
  },
  /** The `all` period's growth block: a cumulative line of quests and cards (OD-10) and its table. */
  growth: {
    quests: 'Quests',
    cards: 'Cards',
    month: 'Month',
    showTable: 'Show as table',
    hideTable: 'Hide table',
    since: (date: string, days: number) =>
      plural('en', days, { one: `Since ${date}: 1 practice day`, other: `Since ${date}: ${days} practice days` }),
  },
  /** More detail (layer 3). `letters` slots take taught Korean, rendered by the page. */
  detail: {
    lettersStrong: (name: string) => `Letters ${name} knows well`,
    lettersPractising: 'Letters being practiced',
    lettersNew: 'New letters this period',
    totals: (quests: number, cards: number) => `Since the start: ${questCount(quests)}, ${cardCount(cards)}`,
    milestones: 'Milestones',
    milestone: (n: number, stage: string, date: string) => `Stage ${n}: ${stage}, finished ${date}`,
    levelCheck: 'Level check',
    levelCheckOn: (date: string) => `Checked ${date}`,
    /** `strand` from `caregiver.placementReport.strand`, `status` from `report.strand.status`. */
    strand: (strand: string, status: string) => `${strand}: ${status}`,
    plan: 'Plan',
    /** Done and ready to play; items the device could not assign yet are left out, never called locked. */
    planRow: {
      class: (done: number, ready: number) => `Homework: ${done} done, ${ready} ready to play`,
      family: (done: number, ready: number) => `This week's plan: ${done} done, ${ready} ready to play`,
      self: (done: number, ready: number) => `Own route: ${done} done, ${ready} ready to play`,
      device: (done: number, ready: number) => `Plans and homework: ${done} done, ${ready} ready to play`,
    },
  },
  /**
   * "What went well" and "What to practice next" lines (section 3.6), keyed by insight code. `when` is a
   * `report.when` value, `previous` a `report.previous` value. `letters` and `words` take taught Korean
   * (the page renders the chips in place). `practice_day` is `practice_days` on the `day` period.
   */
  insight: {
    showed_up: (name: string, days: number, when: string) => `${name} practiced on ${dayCount(days)} ${when}.`,
    stage_done: (name: string, n: number, stage: string) => `${name} finished Stage ${n}: ${stage}.`,
    letters_new: (name: string, letters: string) => `${name} got strong on ${letters}.`,
    practice_days: (name: string, days: number) => `${name} practiced on ${dayCount(days)}.`,
    practice_day: (name: string) => `${name} made time to practice.`,
    minutes_up: (previous: string, minutes: number) => `More practice time than ${previous}: ${minuteCount(minutes)}.`,
    quests_new: (count: number) => plural('en', count, { one: '1 new quest finished.', other: `${count} new quests finished.` }),
    cards_new: (count: number) =>
      plural('en', count, { one: '1 new heritage card collected.', other: `${count} new heritage cards collected.` }),
    /** `strands` is a list of strand names (`report.list`); `count` how many it holds. */
    level_secure: (strands: string, count: number) =>
      plural('en', count, { one: `Level check: ${strands} looks secure.`, other: `Level check: ${strands} look secure.` }),
    plan_done: {
      class: 'Every homework item in this plan is done.',
      family: "Everything in this week's plan is done.",
    },
    streak: (days: number) => plural('en', days, { one: '1 day in a row. Hoya is proud!', other: `${days} days in a row. Hoya is proud!` }),
    words_new: (count: number) => plural('en', count, { one: '1 new word met.', other: `${count} new words met.` }),
    rhythm: 'A short session on two days a week is a great start.',
    letters_revisit: (letters: string) => `${letters}: worth another visit.`,
    strand_next: (strand: string) => `${strand} is next to grow.`,
    plan_open: {
      class: (count: number) =>
        plural('en', count, { one: '1 homework item is ready to play.', other: `${count} homework items are ready to play.` }),
      family: (count: number) => plural('en', count, { one: '1 plan item is ready to play.', other: `${count} plan items are ready to play.` }),
    },
    next_in_plan: (quest: string) => `Next in the plan: ${quest}.`,
    next_on_route: (quest: string) => `Next on the Learning Route: ${quest}.`,
    free_days_done: (name: string) => `${name} finished the free lessons.`,
    words_revisit: (words: string) => `${words}: worth another look together.`,
  },
  /**
   * Second person (OD-17), for the in-app report on a self-only device: the twin of every message above
   * that names the learner. Everything else reads the same in both voices.
   */
  you: {
    title: 'Your report',
    headline: {
      practiced: (days: number, when: string) => `You practiced on ${dayCount(days)} ${when}.`,
      practicedOn: (when: string) => `You practiced ${when}.`,
      stageDone: (n: number, stage: string, when: string) => `You finished Stage ${n}: ${stage} ${when}!`,
      stageDoneAll: (n: number, stage: string) => `You finished Stage ${n}: ${stage}!`,
      noneSaved: (when: string) => `Nothing saved on your device ${when} yet.`,
      gettingStarted: 'You are just getting started.',
    },
    detail: {
      lettersStrong: 'Letters you know well',
    },
    insight: {
      showed_up: (days: number, when: string) => `You practiced on ${dayCount(days)} ${when}.`,
      stage_done: (n: number, stage: string) => `You finished Stage ${n}: ${stage}.`,
      letters_new: (letters: string) => `You got strong on ${letters}.`,
      practice_days: (days: number) => `You practiced on ${dayCount(days)}.`,
      practice_day: 'You made time to practice.',
      free_days_done: 'You finished the free lessons.',
    },
    state: {
      empty: 'You have not started yet. The report fills in after your first practice.',
    },
  },
  /**
   * One fixed tip per level-check strand (section 3.11), under `insight.strand_next`. `game` is the game's
   * title from the minigame catalogue (content, localized by its overlay), never written here.
   */
  tip: {
    'hangul-recognition': (game: string) => `Letter games help: try ${game}.`,
    'sound-letter': (game: string) => `Listening games help: try ${game}.`,
    'syllable-reading': 'Read short words together.',
    vocabulary: 'Word cards help: try a word topic.',
    sentences: 'Read a short story together.',
  },
  /** Actions on a line or in the header. They open a page; none changes learner data by itself. */
  action: {
    addToPlan: 'Add to a plan',
    openPlan: 'Open the plan',
    sendNote: 'Send a note',
  },
  /** Level-check strand statuses, as words (OD-6: no percentages). Keyed by `StrandStatus`. */
  strand: {
    status: {
      secure: 'Secure',
      'getting-there': 'Getting there',
      'not-yet': 'Next to learn',
      'not-tested': 'Not checked yet',
    },
  },
  /** Page states (section 3.14). Neutral: no warning words, no blame. */
  state: {
    noData: (name: string) => `No saved progress from ${name}'s device yet.`,
    noDataAction: 'Open Hangul Route on that device while online.',
    empty: (name: string) => `${name} has not started yet. The report fills in after the first practice.`,
    legacy: 'Day-by-day figures are not available yet.',
    updateAction: (name: string) => `Open Hangul Route on ${name}'s device while online to update.`,
    stale: (date: string) => `Last saved ${date}.`,
    unavailable: 'This report is not available.',
    error: "Can't load the report right now.",
    flagOff: 'Reports are not available yet.',
  },
  /** The class report (section 3.7): counts for the class as a whole, never a name or an order of learners. */
  class: {
    headline: (count: number, total: number, when: string) => `${count} of ${learnerCount(total)} practiced ${when}.`,
    learners: (count: number) => learnerCount(count),
    olderApp: (count: number) =>
      plural('en', count, {
        one: '1 learner has an older app: their day-by-day figures appear after an update.',
        other: `${count} learners have an older app: their day-by-day figures appear after an update.`,
      }),
    notSaved: (count: number) =>
      plural('en', count, {
        one: '1 learner last saved more than 7 days ago.',
        other: `${count} learners last saved more than 7 days ago.`,
      }),
    section: {
      wentWell: 'What went well',
      practiceTogether: 'Practice together',
      daysPracticed: 'Days practiced',
      time: 'Time',
      levelCheck: 'Level check (learners who took one)',
      homework: 'Homework',
    },
    lettersNew: 'Letters the class got strong on',
    revisit: 'Letters to revisit together',
    questsNew: (count: number) => `New quests: ${count}`,
    cardsNew: (count: number) => `New cards: ${count}`,
    milestones: (when: string) => `Stage milestones ${when}`,
    milestone: (n: number, stage: string, count: number) =>
      plural('en', count, { one: `Stage ${n}: ${stage}, finished 1 time`, other: `Stage ${n}: ${stage}, finished ${count} times` }),
    /** Day bands (section 3.7): `none` is the `0` band, never highlighted; `practiced` is the `day` band. */
    band: {
      none: 'Not yet',
      practiced: 'Practiced',
      range: (from: number, to: number) => `${from} to ${to} days`,
      atLeast: (from: number) => `${from} days or more`,
    },
    /** A band or a strand status with its number of learners. */
    count: (label: string, count: number) => `${label}: ${count}`,
    minutesTotal: (minutes: number) => `Total time: ${minuteCount(minutes)}`,
    medianMinutes: (minutes: number) => `Typical time for those who practiced: ${minuteCount(minutes)}`,
    planLesson: 'Plan a lesson',
    planRow: (assigned: number, started: number, finished: number) => `Assigned to ${assigned}, started by ${started}, finished by ${finished}`,
    empty: 'No learners yet.',
    afterUpdate: "Appears after learners' apps update.",
  },
  /** Print or save as PDF (OD-7): the header button, its helper line and the printed footer. */
  print: {
    button: 'Print or save as PDF',
    hint: 'Turn off headers and footers in the print dialog.',
    footer: (date: string) => `Private: shared from Hangul Route on ${date}.`,
  },
  /** Adult navigation items (F-APP-001 `ADULT_NAV`, RP-7c). */
  nav: { reports: 'Reports', classReports: 'Class reports' },
  /** A taught letter inside a sentence, with its romanization ("ㅂ (b)"); `letter` is taught Korean. */
  letter: (letter: string, romanization: string) => `${letter} (${romanization})`,
  /** A list inside a sentence: "a", "a and b", "a, b and c". */
  list: (items: readonly string[]) =>
    items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`,
} as const;
