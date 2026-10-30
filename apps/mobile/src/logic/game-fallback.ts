import type { MinigameKind } from '@hangul-route/content-schema';
import type { MinigameScope } from './minigame-config';
import { myStoryToWriteFrame } from './my-story/fallback';

/**
 * The fallback round of each new F-CURR-002 format (§7.1: "every new round kind carries, or the build derives, a
 * fallback round of a shipped kind"), used while its `game.<kind>` switch is off (§12.2). The step then plays the
 * fallback scope, whose kind is a shipped one, so no switch bricks shipped content and its `minigame.finished`
 * names the kind that was played. Each format row adds its kind here (append only).
 */
export const GAME_FALLBACKS: Readonly<Partial<Record<MinigameKind, (scope: MinigameScope) => MinigameScope>>> = {
  // Row CM-38: Write Frame on the first frame.
  'my-story': myStoryToWriteFrame,
};

/** The kinds that have a `game.<kind>` switch, in the order the rows added them. */
export const SWITCHED_KINDS: readonly MinigameKind[] = Object.keys(GAME_FALLBACKS) as MinigameKind[];

/** The `game.<kind>` switch of a kind (`game.my-story`). */
export const gameFlagOf = (kind: MinigameKind): `game.${MinigameKind}` => `game.${kind}`;

/** The scope a step plays: its own while its `game.<kind>` switch is on (or it has none), else its fallback. */
export function playedScope(scope: MinigameScope, gameOn: (kind: MinigameKind) => boolean): MinigameScope {
  const fallback = GAME_FALLBACKS[scope.kind];
  return fallback === undefined || gameOn(scope.kind) ? scope : fallback(scope);
}
