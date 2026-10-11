/**
 * The Sources screen strings (F-STORY-002 §3.8). Plain strings, never a
 * number-as-score, never red-and-cross wording (D3), never an age (D1).
 * Function messages carry the plurals and the interpolation. The reader and
 * end-page strings moved to `learner.story.reader` / `learner.story.end` in
 * `packages/i18n` with PR 2.6a (the first screen that shows them); these move
 * the same way with the Sources screen (PR 2.7). Korean taught content never
 * appears here: it is drawn by `KoreanText` from the story data.
 */

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

export const STORY_READER_COPY = {
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
