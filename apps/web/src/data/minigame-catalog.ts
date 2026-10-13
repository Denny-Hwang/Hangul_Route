/**
 * 9 mini-games shown in the landing-page gallery.
 *
 * Mirrors the Stage 1 build in `apps/mobile/src/screens/minigames/`.
 * Source of truth for the catalog (kind, family) lives in
 * `packages/content-schema/src/schemas/minigame.ts`. This is the
 * marketing copy layer.
 */
import type { iconGlyphs } from '@hangul-route/design-system/icon-glyphs';

/**
 * A design-system icon (design/components/Icon/spec.md); the landing draws no emoji (CLAUDE.md).
 *
 * The marks are decorative (aria-hidden, always beside the game title) and reuse the shipped
 * glyph set; there is no glyph per game. Picks, closest shape first:
 * speaker = hear a sound · pencil = trace · plus = put two strokes together · sparkle = the one
 * that stands out · journey (the route map) = the world behind the letter · ear = listen and tap ·
 * card = card match · book = story · replay = hear it, then say it back (no mic glyph yet).
 * A dedicated glyph goes through the design-mock path first (design/components/Icon).
 */
export type LandingIconName = keyof typeof iconGlyphs;

export type MinigameFamily = 'recognition' | 'production' | 'application' | 'review';

export interface LandingMinigame {
  kind: string;
  title: string;
  family: MinigameFamily;
  blurb: string;
  icon: LandingIconName;
  status: 'shipped' | 'beta';
}

export const minigameCatalog: LandingMinigame[] = [
  {
    kind: 'match-sound',
    title: 'Match the sound',
    family: 'recognition',
    blurb: 'Hear a letter. Tap the matching tile. Three rounds, no pressure.',
    icon: 'speaker',
    status: 'shipped',
  },
  {
    kind: 'trace-stroke',
    title: 'Trace the letter',
    family: 'production',
    blurb: 'Follow the stroke order. A finger trail teaches the hand the shape.',
    icon: 'pencil',
    status: 'shipped',
  },
  {
    kind: 'build-letter',
    title: 'Build the letter',
    family: 'production',
    blurb: 'Drag two strokes together to form a real Korean syllable.',
    icon: 'plus',
    status: 'shipped',
  },
  {
    kind: 'odd-one-out',
    title: 'Odd one out',
    family: 'recognition',
    blurb: 'Three letters fit. One doesn’t. Spot it before Hoya laughs.',
    icon: 'sparkle',
    status: 'shipped',
  },
  {
    kind: 'culture-quiz',
    title: 'Culture quiz',
    family: 'application',
    blurb: 'A picture, three answers, ten seconds. Learn the world behind the letter.',
    icon: 'journey',
    status: 'shipped',
  },
  {
    kind: 'tap-respond',
    title: 'Tap when you hear it',
    family: 'recognition',
    blurb: 'A rabbit hops by. Tap only when you hear /to/. Fast, fun, real.',
    icon: 'ear',
    status: 'shipped',
  },
  {
    kind: 'card-match',
    title: 'Card match',
    family: 'review',
    blurb: 'Flip two cards. Match Korean to English. A memory game that teaches.',
    icon: 'card',
    status: 'shipped',
  },
  {
    kind: 'story-sequence',
    title: 'Story sequence',
    family: 'application',
    blurb: 'Three panels, one story. Put them in the right order.',
    icon: 'book',
    status: 'shipped',
  },
  {
    kind: 'voice-echo',
    title: 'Say it back',
    family: 'production',
    blurb: 'Hear the letter, say it back. Hoya cheers either way.',
    icon: 'replay',
    status: 'beta',
  },
];

/** Mini-games the learner plays by speaking (the beta voice echo). */
export const SPEAKING_GAME_KINDS: readonly string[] = ['voice-echo'];

/**
 * The mini-games the layered site shows on `/learners`: reading, listening and writing only, so no speaking game
 * (owner decision 2026-10-10; F-SITE-002 §3.4 "no speaking line anywhere").
 */
export const siteGames: readonly LandingMinigame[] = minigameCatalog.filter((game) => !SPEAKING_GAME_KINDS.includes(game.kind));
