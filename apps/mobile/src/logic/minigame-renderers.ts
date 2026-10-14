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
]);
