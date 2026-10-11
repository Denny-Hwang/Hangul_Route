/**
 * Every UI string of the story reader, its end page and the Sources screen
 * (F-STORY-002 §3.3-3.8). Plain strings, never a number-as-score, never
 * red-and-cross wording (D3), never an age (D1). Function messages carry the
 * plurals and the interpolation. English only until `packages/i18n` takes the
 * learner strings; then this object moves to `messages/en/learner.ts`
 * unchanged. Korean taught content never appears here: it is drawn by
 * `KoreanText` from the story data.
 */

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

export const STORY_READER_COPY = {
  reader: {
    close: 'Close',
    back: 'Back',
    next: 'Next',
    finish: 'Finish',
    sources: 'Sources',
    readToMe: 'Read to me',
    /** A page number, not a meter: it may go down on Back. */
    position: (index: number, total: number): string => `${index} / ${total}`,
    sceneOf: (index: number, total: number): string => `Scene ${index} of ${total}`,
    /** Announced when a scene opens: position, then the picture. */
    announce: (index: number, total: number, artDescription: string): string =>
      `Scene ${index} of ${total}. ${artDescription}`,
    traditionalTale: 'Traditional tale',
    inEnglish: 'In English',
    didYouKnow: 'Did you know?',
    sayItYourself: 'Say it yourself',
    tapToHear: 'Tap to hear',
    hearStory: 'Hear this scene',
    hearKorean: 'Hear the Korean',
    hearTerm: (romanization: string): string => `Hear ${romanization}`,
    /** Screen-reader label of an inline term chip. */
    termLabel: (romanization: string, gloss: string): string =>
      `Korean word ${romanization}, ${gloss}. Double tap to hear.`,
    showRomanization: 'Show how to say it',
    closeGloss: 'Close',
    /** One line, then Back and (quest mode) Continue: a content problem never traps a quest. */
    unavailable: 'This story is not ready to read yet.',
    continue: 'Continue',
    advisory: (note: string): string => `A note for grown-ups: ${note}`,
    dismiss: 'Dismiss',
    cultureNote: {
      moreInCultureNotes: 'More in Culture notes',
      close: 'Close',
    },
    checkpoint: {
      tryIt: 'Try it',
      skip: 'Skip',
    },
  },
  end: {
    title: 'The End',
    continue: 'Continue',
    done: 'Done',
    readAgain: 'Read again',
    sources: 'Sources',
  },
  sources: {
    title: 'Sources',
    back: 'Back',
    traditionalTale: 'Traditional tale',
    traditionalNote: 'One version of a story told in many versions',
    checked: (passes: number, date: string, contentVer: number): string =>
      `Checked in ${passes} independent ${plural(passes, 'pass', 'passes')} · last checked ${date} · story version ${contentVer}`,
    /** A `scope: 'cluster'` verification record: say only what the record says. */
    clusterChecked: 'These checks covered a group of related stories, not this story alone.',
    howChecked: 'How it was checked',
    advisoryHeading: 'A gentle note for grown-ups',
    corrections: 'Corrections',
    sceneHeading: (sceneNumber: number): string => `Scene ${sceneNumber}`,
    seeFact: (factId: string): string => `See fact ${factId}`,
    korean: 'Korean',
    scope: {
      documented: 'What we know',
      inTheTale: 'What the tale says',
    },
    updated: 'Updated',
    updatedOn: (date: string): string => `Updated ${date}`,
    sourcesHeading: (count: number): string => `Sources (${count})`,
    accessed: (date: string): string => `accessed ${date}`,
    sourceLabel: (index: number, total: number, title: string, publisher: string): string =>
      `Source ${index} of ${total}: ${title}, ${publisher}`,
    approximation: (text: string, rationale: string): string => `About “${text}”: ${rationale}`,
    dependsOnToday: 'This depends on today’s date.',
    usedInQuestions: 'Used in questions and notes',
    highlighted: 'Highlighted',
    /** A grown-up action: the link is opened only after the gate. */
    openLink: 'Open link',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    openFailed: (url: string): string => `Open this link in a browser: ${url}`,
    needsConnection: 'Opening a link needs a connection.',
    counts: (facts: number, sources: number): string =>
      `${facts} ${plural(facts, 'fact', 'facts')} · ${sources} ${plural(sources, 'source', 'sources')}`,
    noSources: 'No sources are listed for this story.',
  },
} as const;
