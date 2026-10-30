import type { MinigameKind } from '@hangul-route/content-schema';

/**
 * The minigame kinds the app can play: exactly the `case` arms of the switch in
 * `screens/minigames/MinigameScreen.tsx` that draw a game (a test reads that
 * file and checks the two agree). `voice-echo` is left out: it is behind a flag
 * and has no place in a reading, listening and writing path. A kind outside this
 * set falls to the "coming soon" screen, so a ready lesson cell must not use one
 * (`upper-stage-curriculum.test.ts`), and the My Route skill sheet does not
 * name it as a game that counts (F-CURR-001 §3.11).
 */
export const PLAYABLE_KINDS: ReadonlySet<MinigameKind> = new Set<MinigameKind>([
  'match-sound',
  'build-letter',
  'trace-stroke',
  'card-match',
  'story-sequence',
  'odd-one-out',
  'culture-quiz',
  'listen-pick',
  'pic-word-match',
  'tap-respond',
  'story-read',
  'story-check',
  // F-CURR-001 G-1: Sentence Builder, also the Stage 7 Check.
  'order-it',
  // F-CURR-001 G-2
  'realia-read',
  'type-hangul',
  'trace-word',
  // F-CURR-001 G-5
  'write-frame',
  // F-CURR-002 row CM-30 (its Listen & Pick fallback while `game.cloze-pick` is off)
  'cloze-pick',
  // F-CURR-002 CM-34: behind `game.story-order`, whose off state plays Story Sequence (`logic/game-switches.ts`).
  'story-order',
  // F-CURR-002 row CM-35: Role Play (its fallback, Tap to Respond, while `game.role-play` is off)
  'role-play',
  // F-CURR-002 row CM-36: the game, or its Pic-Word Match fallback while `game.hidden-heritage` is off.
  'hidden-heritage',
  // F-CURR-002 row CM-32 (Listen & Pick on the block while `game.syllable-build` is off)
  'syllable-build',
]);
