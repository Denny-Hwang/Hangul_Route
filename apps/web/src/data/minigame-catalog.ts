/**
 * The Stage 1 mini-games the `/learners` games fold lists (F-SITE-002 §3.4). No typed count here: the page counts
 * the list.
 *
 * The list is the set of Stage 1 kinds `apps/mobile/src/logic/minigame-config.ts` configures (minigame-catalog.test.ts
 * reads that file and fails on a kind the app does not play in Stage 1), in the order a learner meets them most:
 * listen-pick (22 steps), match-sound (7), build-letter (7), pic-word-match (4), trace-stroke (2), odd-one-out (1),
 * culture-quiz (1), story-sequence (1). Games of later stages (tap-respond, card-match) are not on this list.
 *
 * Titles and blurbs are UI strings in the UI language (`landing.games.items.<kind>` in packages/i18n); this file holds
 * only the kind, the family tint, the icon and the status. The kinds are the `MinigameKind` names of
 * `packages/content-schema/src/schemas/minigame.ts`; the families are the site's own grouping.
 */
import type { iconGlyphs } from '@hangul-route/design-system/icon-glyphs';

/**
 * A design-system icon (design/components/Icon/spec.md); the site draws no emoji (CLAUDE.md).
 *
 * The marks are decorative (aria-hidden, always beside the game title) and reuse the shipped
 * glyph set; there is no glyph per game. Picks, closest shape first:
 * ear = listen and pick · speaker = hear a letter, match it · plus = put letters together · card = a picture and its
 * word · pencil = trace · sparkle = the one that stands out · journey (the route map) = the world behind the word ·
 * book = story.
 * A dedicated glyph goes through the design-mock path first (design/components/Icon).
 */
export type LandingIconName = keyof typeof iconGlyphs;

export type MinigameFamily = 'recognition' | 'production' | 'application' | 'review';

/** The Stage 1 kinds the site lists; each has `landing.games.items.<kind>` in every UI locale. */
export type SiteGameKind =
  | 'listen-pick'
  | 'match-sound'
  | 'build-letter'
  | 'pic-word-match'
  | 'trace-stroke'
  | 'odd-one-out'
  | 'culture-quiz'
  | 'story-sequence';

export interface LandingMinigame {
  kind: SiteGameKind;
  family: MinigameFamily;
  icon: LandingIconName;
  status: 'shipped' | 'beta';
}

export const minigameCatalog: readonly LandingMinigame[] = [
  { kind: 'listen-pick', family: 'recognition', icon: 'ear', status: 'shipped' },
  { kind: 'match-sound', family: 'recognition', icon: 'speaker', status: 'shipped' },
  { kind: 'build-letter', family: 'production', icon: 'plus', status: 'shipped' },
  { kind: 'pic-word-match', family: 'recognition', icon: 'card', status: 'shipped' },
  { kind: 'trace-stroke', family: 'production', icon: 'pencil', status: 'shipped' },
  { kind: 'odd-one-out', family: 'recognition', icon: 'sparkle', status: 'shipped' },
  { kind: 'culture-quiz', family: 'application', icon: 'journey', status: 'shipped' },
  { kind: 'story-sequence', family: 'application', icon: 'book', status: 'shipped' },
];

/**
 * Mini-games the learner plays by speaking (the beta voice echo). The site lists none (owner decision 2026-10-10;
 * F-SITE-002 §3.4 "no speaking line anywhere"), so `siteGames` drops any that a later edit puts in the catalogue.
 */
export const SPEAKING_GAME_KINDS: readonly string[] = ['voice-echo'];

/** The mini-games `/learners` shows: reading, listening and writing only, never a speaking game. */
export const siteGames: readonly LandingMinigame[] = minigameCatalog.filter((game) => !SPEAKING_GAME_KINDS.includes(game.kind));
