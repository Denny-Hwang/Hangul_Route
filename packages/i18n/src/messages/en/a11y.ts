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
  /** Bottom tab labels. */
  tabs: { home: 'Today', journey: 'Journey', library: 'Library' },
  cardArt: (title: string) => `Card art for ${title}`,
  /** The cub button on Home: the only way to profiles, backup, classes and the grown-up zone. */
  profileEntry: 'Profile and settings',
  openHomework: 'Open homework',
  /** One of Today's mission cards; a collected card keeps its slot and says so. */
  missionCard: (title: string, subtitle: string, collected: boolean) =>
    `${title}. ${subtitle}.${collected ? ' Collected.' : ''}`,
  /** A Journey grid cell: the theme's episode for a stage; a preview cell is not open yet. */
  gridCell: (themeTitle: string, stage: string, comingSoon: boolean) =>
    `${themeTitle} episode for ${stage}${comingSoon ? ', coming soon' : ''}`,
  /** A Journey grid cell with a level-check mark (F-PLC-001 section 3.7): the start pin, the placed-out outline, or both. */
  gridCellMarked: (themeTitle: string, stage: string, start: boolean, placedOut: boolean) =>
    `${themeTitle} episode for ${stage}.${start ? ' You started here.' : ''}${placedOut ? ' You can skip ahead here, and it is still open to play.' : ''}`,
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
  /** The paywall offer card: its name, then the already-formatted price. */
  familyOffer: (name: string, price: string) => `${name}, ${price}`,

  /** My route (F-ROUTE-001 section 3.14): each row label reads the row; the pips are hidden. */
  myRoute: {
    stage: (order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number) =>
      [
        `Stage ${order}, ${title}.`,
        `${stateWord}.`,
        here ? 'You are here.' : '',
        start ? 'You started here.' : '',
        played > 0 ? `${plural('en', played, { one: '1 quest', other: `${played} quests` })} played.` : '',
      ]
        .filter((part) => part !== '')
        .join(' '),
    stageGrownup: (name: string, order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number) =>
      [
        `Stage ${order}, ${title}.`,
        `${stateWord}.`,
        here ? `${name} is here.` : '',
        start ? `${name} started here.` : '',
        played > 0 ? `${plural('en', played, { one: '1 quest', other: `${played} quests` })} played.` : '',
      ]
        .filter((part) => part !== '')
        .join(' '),
    /** The merged coming-later row ("Stages 5 to 7") and a single one. */
    later: (label: string, stateWord: string) => `${label}. ${stateWord}.`,
    trail: 'Stage list',
    cell: (theme: string, title: string, word: string) => `${theme}: ${title}. ${word}.`,
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
} as const;
