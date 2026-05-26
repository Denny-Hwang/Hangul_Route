/**
 * 9 mini-games shown in the landing-page gallery.
 *
 * Mirrors the Stage 1 build in `apps/mobile/src/screens/minigames/`.
 * Source of truth for the catalog (kind, family) lives in
 * `packages/content-schema/src/schemas/minigame.ts`. This is the
 * marketing copy layer.
 */

export type MinigameFamily = 'recognition' | 'production' | 'application' | 'review';

export interface LandingMinigame {
  kind: string;
  title: string;
  family: MinigameFamily;
  blurb: string;
  emoji: string;
  status: 'shipped' | 'beta';
}

export const minigameCatalog: LandingMinigame[] = [
  {
    kind: 'match-sound',
    title: 'Match the sound',
    family: 'recognition',
    blurb: 'Hear a letter. Tap the matching tile. Three rounds, no pressure.',
    emoji: '🔊',
    status: 'shipped',
  },
  {
    kind: 'trace-stroke',
    title: 'Trace the letter',
    family: 'production',
    blurb: 'Follow the stroke order. A finger trail teaches the hand the shape.',
    emoji: '✍️',
    status: 'shipped',
  },
  {
    kind: 'build-letter',
    title: 'Build the letter',
    family: 'production',
    blurb: 'Drag two strokes together to form a real Korean syllable.',
    emoji: '🧩',
    status: 'shipped',
  },
  {
    kind: 'odd-one-out',
    title: 'Odd one out',
    family: 'recognition',
    blurb: 'Three letters fit. One doesn’t. Spot it before Hoya laughs.',
    emoji: '🔍',
    status: 'shipped',
  },
  {
    kind: 'culture-quiz',
    title: 'Culture quiz',
    family: 'application',
    blurb: 'A picture, three answers, ten seconds. Learn the world behind the letter.',
    emoji: '🎯',
    status: 'shipped',
  },
  {
    kind: 'tap-respond',
    title: 'Tap when you hear it',
    family: 'recognition',
    blurb: 'A rabbit hops by. Tap only when you hear /to/. Fast, fun, real.',
    emoji: '🐇',
    status: 'shipped',
  },
  {
    kind: 'card-match',
    title: 'Card match',
    family: 'review',
    blurb: 'Flip two cards. Match Korean to English. A memory game that teaches.',
    emoji: '🃏',
    status: 'shipped',
  },
  {
    kind: 'story-sequence',
    title: 'Story sequence',
    family: 'application',
    blurb: 'Three panels, one story. Put them in the right order.',
    emoji: '📖',
    status: 'shipped',
  },
  {
    kind: 'voice-echo',
    title: 'Say it back',
    family: 'production',
    blurb: 'Hear the letter, say it back. Hoya cheers either way.',
    emoji: '🎤',
    status: 'beta',
  },
];
