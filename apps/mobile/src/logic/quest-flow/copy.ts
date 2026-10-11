/**
 * Quest-flow copy (F-QUEST-002 §3.1): plain Pre-A1 English in one module until
 * the F-I18N-001 catalog ships. Learner-facing step labels live in
 * `logic/quest-steps.ts`; the Discover strings in `logic/stage1/discover-flow.ts`.
 * No age words, no failure language, no emoji.
 */
export const QUEST_FLOW_COPY = {
  game: {
    heading: 'Ready for a quick game?',
    body: "Tap to play. When the game is done you'll come right back.",
    play: 'Play minigame',
    skip: 'Skip for now',
  },
  check: {
    heading: 'Two quick ones',
    go: 'Go',
  },
} as const;
