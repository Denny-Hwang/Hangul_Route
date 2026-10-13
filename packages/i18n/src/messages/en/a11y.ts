import { plural } from '../../plural';

/**
 * Accessibility labels (F-I18N-001 §3.4). The design system takes these as props
 * with its own English default, so it needs no i18n dependency.
 */
export const a11y = {
  tile: (label: string) => `Korean letter ${label}, tap to select`,
  stars: (earned: number) => `${earned} of 3 stars earned`,
  hoya: (pose: string) => `Hoya the tiger, ${pose}`,
  dismissHoya: 'Close Hoya message',
  goBack: 'Go back',
  /**
   * Bottom tab labels. `route` is the Learning Route tab (LR-OD-1: the tab budget is 12; its accessibility label is `myRoute.tab`).
   * Translators: with the Route tab the bar has four items of 80 px at a 320 px width, so each label must fit 80 px at the
   * caption size (14 px), in one word where the language allows. The 12-character budget alone does not guarantee this,
   * because it counts characters, not width (design/screens/learning-route/tab-bar.md, "Other languages").
   */
  tabs: { home: 'Today', journey: 'Journey', library: 'Library', route: 'Route' },
  /**
   * The four-tab bar's spoken tab name on iOS, where a tab reads as a button: the name, the word "tab" and its place,
   * e.g. "Learning Route, tab, 2 of 4" (AMENDMENTS-ROUTE-LEARNING-ROUTE LR-4). Read aloud, never drawn.
   */
  tabPosition: (name: string, position: number, count: number) => `${name}, tab, ${position} of ${count}`,
  cardArt: (title: string) => `Card art for ${title}`,
  /** The cub button on Home: the only way to profiles, backup, classes and the grown-up zone. */
  profileEntry: 'Profile and settings',
  openHomework: 'Open homework',
  /** One of Today's mission cards; a collected card keeps its slot and says so. */
  missionCard: (title: string, subtitle: string, collected: boolean) =>
    `${title}. ${subtitle}.${collected ? ' Collected.' : ''}`,
  /**
   * A Journey grid cell (F-STORY-005 §3.5, §3.12): the stage by its number and title, the theme, what the
   * cell holds (`kind` is the cell's `CellKind`) and how many heritage stories call it home; then the
   * level-check marks as their own sentences (F-PLC-001 section 3.7). `finished` is said only when > 0.
   */
  journeyCell: (c: {
    stage: number;
    stageTitle: string;
    themeTitle: string;
    kind: 'lesson' | 'book' | 'stories-only' | 'placeholder';
    complete: boolean;
    stories: number;
    finished: number;
    start: boolean;
    placedOut: boolean;
  }) => {
    const where = `Stage ${c.stage} ${c.stageTitle}, ${c.themeTitle}`;
    const count = plural('en', c.stories, { one: '1 heritage story', other: `${c.stories} heritage stories` });
    const stories = c.stories === 0 ? '' : c.finished > 0 ? `${count}, ${c.finished} finished` : count;
    const holds = c.kind === 'book' ? 'story book' : 'lesson';
    const head =
      c.kind === 'placeholder'
        ? `${where}, coming soon`
        : c.kind === 'stories-only'
          ? `${where}: ${stories}`
          : `${where}: ${holds}${c.complete ? ', complete' : ''}${stories === '' ? '' : `, ${stories}`}`;
    const marks = `${c.start ? ' You started here.' : ''}${c.placedOut ? ' You can skip ahead here, and it is still open to play.' : ''}`;
    return marks === '' ? head : `${head}.${marks}`;
  },
  /** An earned card on the Episode page, and the placeholder for one not yet earned. */
  episodeCard: (title: string) => `${title} card`,
  cardWaiting: 'A card you can earn by finishing this episode',
  /** A finished homework row, and an open one with its due word. */
  playAgainQuest: (title: string) => `Play again: ${title}`,
  homeworkRow: (title: string, due: string) => `${title}, ${due}`,
  /** The close control of the Quest player, and the Discover labels (`label` is already-built screen-reader text). */
  leaveQuest: 'Leave quest',
  hearItLabel: (label: string) => `Hear it. ${label}`,
  hearExample: (spoken: string) => `Hear it: ${spoken}`,
  /** A Discover symbol: `romanization` is the sound value; `soundHint` is the optional content hint. */
  discoverLetter: (romanization: string, soundHint?: string) =>
    soundHint === undefined ? `Korean letter ${romanization}` : `Korean letter ${romanization}. ${soundHint}`,
  discoverFinal: (romanization: string) => `Korean final consonant ${romanization}`,
  /** A Hangul Check tip letter (F-QUEST-002 §3.9): opens the quest that teaches it. */
  practiceLetter: (romanization: string) => `Practice the letter ${romanization} again`,
  /** A Hangul Check tip that is a final consonant (F-QUEST-002 §3.9, §3.14): named as a final, never "the letter". */
  practiceFinal: (romanization: string) => `Practice the final consonant ${romanization} again`,
  lockedCard: 'Locked card',
  /** A locked Library tile or card page, with how it is earned (an earn hint, F-STORY-006 §3.7). */
  lockedCardHint: (hint: string) => `Locked card. ${hint}`,
  /** An owned Library tile earned since the learner last opened it (the New pill). */
  newCard: (title: string) => `${title}. New`,
  flipToBack: 'Tap to flip card to back',
  flipToFront: 'Tap to flip card to front',
  shareCard: 'Share this card',
  /** The Profile Sound switch, its state and the voice line read as one group (`voice` has no colon). */
  soundSwitch: (muted: boolean, voice: string) => `Sound, ${muted ? 'off' : 'on'}. ${voice}.`,
  /** The minigames' screen-reader labels (PR 7b); `romanization` is a sound value, never Hangul. */
  minigame: {
    hear: (romanization: string) => `Hear ${romanization}`,
    /** A batchim tile in Build a Letter. */
    finalTile: (romanization: string) => `final ${romanization}`,
    /** The block-shape hint picture; `hint` is one of `learner.minigame.buildLetter.shape`. */
    blockShape: (hint: string) => `Block shape. ${hint}`,
    traceLetter: (romanization: string) => `Trace the letter ${romanization}`,
    /** The trace heading over a final consonant (a `*-batchim` jamo). */
    traceFinal: (romanization: string) => `Trace the final ${romanization}`,
    traceCanvas: (romanization: string) => `Draw the letter ${romanization} with your finger`,
    /** The still stroke-order diagram read aloud: "Stroke order. 1: right, then down. 2: a loop." */
    strokeOrder: {
      guide: 'Stroke order guide',
      /** `strokes` are the per-stroke descriptions, in writing order. */
      summary: (strokes: readonly string[]) =>
        `${plural('en', strokes.length, {
          one: 'Stroke order. One stroke',
          other: `Stroke order. ${strokes.length} strokes`,
        })}. ${strokes.map((stroke, i) => `${i + 1}: ${stroke}`).join('. ')}.`,
      dot: 'a dot',
      loop: 'a loop',
      /** A stroke that turns too often, described by where it ends. */
      curving: (direction: string) => `curving ${direction}`,
      /** The legs of one stroke, in drawing order. */
      legs: (directions: readonly string[]) => directions.join(', then '),
      /** By octant, clockwise from right (screen y grows downward). */
      direction: {
        right: 'right',
        downRight: 'down and right',
        down: 'down',
        downLeft: 'down and left',
        left: 'left',
        upLeft: 'up and left',
        up: 'up',
        upRight: 'up and right',
      },
      /** The diagram's label: its description, then how to close it. */
      close: (description: string) => `${description} Tap to close.`,
    },
    /** Listen & Pick: the speaker button, and a picture option with no label. */
    hearAgain: 'Play the sound again',
    picture: 'Picture',
    /** An answer card in its state (Listen & Pick, Pic-Word Match); `label` is what the card says. */
    option: {
      correct: (label: string) => `Right answer: ${label}`,
      wrong: (label: string) => `Not this one: ${label}`,
      hint: (label: string) => `Look here: ${label}`,
      /** Pic-Word Match: picked, waiting for its partner; and a matched pair with its match number. */
      selected: (label: string) => `Selected: ${label}`,
      matched: (badge: number, label: string) => `Matched, number ${badge}: ${label}`,
    },
    /** Card Match: a Korean word (its romanization, else the word) and a meaning (content gloss). */
    koreanWord: (word: string) => `Korean word ${word}`,
    meaning: (gloss: string) => `English meaning ${gloss}`,
  },
  /** A taught Korean item: Korean text, its romanization and (optionally) a gloss in the UI language. */
  koreanItem: (item: { ko: string; romanization: string; gloss?: string }) =>
    item.gloss === undefined
      ? `Korean: ${item.ko}, ${item.romanization}`
      : `Korean: ${item.ko}, ${item.romanization}, ${item.gloss}`,
  /** The grown-up PIN pad; "Digit n" and "Delete last digit" are part of the e2e contract. */
  pinDigit: (digit: number) => `Digit ${digit}`,
  pinDelete: 'Delete last digit',
  pinDots: (entered: number, total: number) => `${entered} of ${total} digits entered`,
  rescueCode: 'Rescue code',
  /** Join a class: the code field and the roster-name field. */
  classCode: 'Class code',
  joinName: 'Name your teacher will see',
  leaveSpace: (name: string) => `Leave ${name}`,
  /** The learner Plan screen's summary heading, its first accessible element (F-BILL-002 §8). */
  planStatus: (name: string, state: string) => `${name}: ${state}.`,

  /** Learning Route (F-ROUTE-001 section 3.14): each row label reads the row; the pips are hidden. */
  myRoute: {
    /** The Route tab's accessibility label: the full page name (LR-OD-1). */
    tab: 'Learning Route',
    /** `goal` (LR-3b, trailing and optional so existing callers do not change) is spoken between the here and start parts, the order the tags show. */
    stage: (order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number, goal = false) =>
      [
        `Stage ${order}, ${title}.`,
        `${stateWord}.`,
        here ? 'You are here.' : '',
        goal ? 'Your goal.' : '',
        start ? 'You started here.' : '',
        played > 0 ? `${plural('en', played, { one: '1 quest', other: `${played} quests` })} played.` : '',
      ]
        .filter((part) => part !== '')
        .join(' '),
    stageGrownup: (name: string, order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number, goal = false) =>
      [
        `Stage ${order}, ${title}.`,
        `${stateWord}.`,
        here ? `${name} is here.` : '',
        goal ? `${name}'s goal.` : '',
        start ? `${name} started here.` : '',
        played > 0 ? `${plural('en', played, { one: '1 quest', other: `${played} quests` })} played.` : '',
      ]
        .filter((part) => part !== '')
        .join(' '),
    /** The merged coming-later row ("Stages 5 to 7") and a single one. */
    later: (label: string, stateWord: string) => `${label}. ${stateWord}.`,
    trail: 'Stage list',
    cell: (theme: string, title: string, word: string) => `${theme}: ${title}. ${word}.`,
    /** A cell label with F-ENT-003's "In your plan" word after it (LR-5a), the learner's own page only. */
    cellInPlan: (cellLabel: string, tag: string) => `${cellLabel} ${tag}.`,
    skill: (label: string, detail: string) => `${label}. ${detail}.`,
    gain: (word: string, n: number) => `${word}: ${n}`,
    /** The Home route strip read as one button (R-4b): no middle dot, each line a sentence; `progress` is the here stage's caption. */
    homeStrip: (title: string, here: string, progress: readonly string[], goal: string | null, week: string | null) =>
      [`${title}.`, here, ...progress.map((line) => `${line}.`), goal === null ? '' : `${goal}.`, week === null ? '' : `${week}.`]
        .filter((part) => part !== '')
        .join(' '),
    homeStripGoal: (n: number, title: string) => `Goal: Stage ${n}, ${title}`,
    /** The parent dashboard row (R-9b): its goal and started lines, read without the middle dot. */
    rowGoal: (n: number, title: string) => `Goal: Stage ${n}, ${title}.`,
    rowStarted: (n: number, band: string, date: string) => `Started: Stage ${n}, ${band}, ${date}.`,
    /**
     * The route card read as one summary (AMENDMENTS-ROUTE-LEARNING-ROUTE section 10, LR-3b): the
     * Hoya sentence as written, then the visible parts in order, each one a sentence; a part that is
     * not shown is passed as null. The middle dot of the visible lines is read as a comma
     * ("Goal: Stage 2, Words").
     */
    routeCard: (
      hoyaText: string | null,
      nowText: string | null,
      goalText: string | null,
      fromText: string | null,
      planEndsText: string | null,
      pipsText: string | null,
      nextText: string | null,
    ) =>
      [
        hoyaText,
        ...[nowText, goalText, fromText, planEndsText, pipsText, nextText]
          .filter((part): part is string => part !== null && part !== '')
          .map((part) => `${part.replace(/ · /g, ', ').replace(/[.!]$/, '')}.`),
      ]
        .filter((part): part is string => part !== null && part !== '')
        .join(' '),
    /** One labelled line of the route card's where block, read as "Goal: Stage 2 · Words". */
    labelled: (label: string, line: string) => `${label}: ${line}`,
    /**
     * The goal stage's pips in one label, without digits. `someDone` is for some quests done and none
     * of the rest open yet, so the label never says "more are ready" when none is.
     */
    goalPips: { none: 'Ready when you are', some: 'Some quests done, more are ready', someDone: 'Some quests done', all: 'Every quest here is done' },
    /** One letter-wall tile (R-7c): the letter, its sound (with "at the end" for a final) and its state word. */
    letter: (letter: string, sound: string, state: string) => `${letter}, ${sound}. ${state}.`,
  },
  /**
   * The vocabulary question view (F-VOC-004 §3.8, S-4b): the speaker, the outcome said in words after a
   * tap (`gloss` is the answer's meaning in the UI language, content), and the homonym topic chip.
   */
  vocab: {
    question: {
      speaker: 'Play the word again',
      /** The meaning starts the sentence, so its first letter is upper case ("Right. Apple."). */
      right: (gloss: string) => `Right. ${gloss.charAt(0).toUpperCase()}${gloss.slice(1)}.`,
      reveal: (gloss: string) => `Not this one. The answer is ${gloss}.`,
      /** The quick check after a miss: the learner taps again. */
      tryAnother: 'Not this one. Try another.',
      topic: (title: string) => `Topic: ${title}`,
      /** `right` / `reveal` for a question with no word to name (a degenerate question; never an empty name). */
      rightPlain: 'Right.',
      revealPlain: 'Not this one.',
    },
  },
  /**
   * Progress reports (F-REPORT-001 section 3.12, RP-6): the period tabs and stepper, the live region, and the
   * text alternatives of the calendar and the growth line. `days` is a list of formatted days (`report.list`).
   * `window` names a window: `report.when.day` / `week` / `month` ("this week"), `prevDay` / `prevWeek` /
   * `prevMonth` ("last week"), or for an older window its formatted date or dates (`report.step.range`).
   */
  report: {
    periods: 'Report period',
    periodChanged: (window: string) => `Showing ${window}`,
    periodChangedAll: 'Showing all time',
    /** The Previous and Next buttons, each naming the window it opens ("Show last week", "Show this week"). */
    step: (window: string) => `Show ${window}`,
    /**
     * The Next button's name: its visible label first, then the window it opens ("Next: show this week"), so a
     * voice-control user who says "Next" reaches it (WCAG 2.5.3, Label in Name). Previous keeps `step`, whose
     * name already holds its visible label ("Last week", the dates).
     */
    stepNext: (window: string) => `Next: show ${window}`,
    calendar: (days: string) => `Practiced on ${days}.`,
    calendarNone: 'No practice days in this period.',
    notSaved: (days: string) => `Not saved yet: ${days}.`,
    growthTable: 'Quests and cards by month',
    loading: 'Loading the report',
  },
  /**
   * Notes from grown-ups (F-FEEDBACK-001 FB-5, section 6.12): the Home card read as one group, a list
   * row, the learner's own answer and the announced pick. `preset` and `label` are already-rendered
   * `common.notes` lines; `date` is the note date as drawn.
   */
  notes: {
    card: (sender: string, preset: string) => `New note from ${sender}: ${preset} Read.`,
    cardMany: (n: number, sender: string) => `${plural('en', n, { one: '1 new note', other: `${n} new notes` })}. Newest from ${sender}. Read.`,
    row: (sender: string, preset: string, date: string, isNew: boolean) =>
      `${isNew ? 'New. ' : ''}From ${sender}, ${date}. ${preset}`,
    answer: (label: string) => `Your answer: ${label}`,
    reactionPicked: (label: string) => `You picked: ${label}`,
    questCard: (title: string) => `Try this quest: ${title}`,
  },
  /** The grown-up shell (F-APP-001 section 3.16): router pages announce this in a polite live region. */
  shell: {
    redirecting: 'Taking you to your home…',
    /** The persona switch's group label (F-APP-001 section 3.16). */
    personaSwitch: 'Switch between Family and Teacher',
  },
  /**
   * The route marks read as words (F-ENT-003 section 3.7, 3.14, Appendix A; PR E3-5): a Journey cell label
   * appends them after its own words in the order Next, In your plan, not open yet. `notOpen` is the only key
   * for a closed cell's words; `title` is the cell's episode title in the UI locale.
   */
  access: {
    next: 'Next',
    inPlan: 'In your plan',
    notOpen: (title: string) => `${title}: not open yet. Opens the lesson page.`,
  },
} as const;
