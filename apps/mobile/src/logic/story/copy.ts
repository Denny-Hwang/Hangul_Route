/**
 * Every UI string of the story check, Story Order v2, word recap and story
 * Results (F-STORY-003 §3.4-3.7). Plain strings, never a number-as-score,
 * ratio or percent, never red-and-cross wording (D3). Function messages carry
 * the plurals. When `packages/i18n` takes the learner strings this object
 * moves to `messages/en/learner.ts` unchanged.
 */
export const STORY_CHECK_COPY = {
  check: {
    position: (index: number, total: number): string => `${index} / ${total}`,
    positionLabel: (index: number, total: number): string => `Question ${index} of ${total}`,
    tryAnother: 'Try another',
    correct: 'Correct',
    next: 'Next',
    defaultHint: 'Not quite. Have another look.',
    lookHere: 'This one is worth a look.',
    speakerPrompt: 'Hear the question',
    speakerOptions: 'Hear the answers',
    speakerTarget: 'Hear the Korean word',
    showRomanization: 'Show how to say it',
    pictureOptionLabel: (label: string): string => `Picture: ${label}`,
    emptyLine: 'There are no questions for this story yet.',
    continue: 'Continue',
  },
  recap: {
    title: 'Words from this story',
    done: 'Done',
    wordsLabel: (count: number): string =>
      count === 1 ? `${count} word from this story` : `${count} words from this story`,
    hearWord: (romanization: string): string => `Hear ${romanization}`,
  },
  sequence: {
    title: 'Put the story in order',
    hint: 'Tap each picture, starting with what happened first.',
    skip: 'Skip this one',
    positionLabel: (index: number, total: number): string => `Picture ${index} of ${total}`,
    tryAnother: 'Try another',
    lookHere: 'This one comes next.',
    emptyLine: 'There is nothing to put in order yet.',
    continue: 'Continue',
    replay: {
      title: 'The story, in order',
      pause: 'Pause',
      play: 'Play',
      back: 'Back',
      next: 'Next',
      skip: 'Skip replay',
      done: 'Done',
    },
  },
  results: {
    nextStory: 'Next story',
    backHome: 'Back home',
    readAgain: 'Read it again',
    episodePage: 'Episode page',
    cultureNote: (title: string): string => `Learn about ${title}`,
    encourage: 'Every read helps. Want to read it again?',
  },
} as const;
