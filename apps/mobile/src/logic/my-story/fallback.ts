import type { MinigameScope } from '../minigame-config';

/**
 * My Story's fallback round (F-CURR-002 §7.1 F8 and §12.2, row CM-38; design/wireframes/minigame/my-story.md): with
 * `game.my-story` off, the step plays **Write Frame on the first frame** of the chain, with its bank (the neutral
 * option included), then Write Frame's own My page of one sentence (shipped, not kept). The rest of the chain is not
 * played. A frame parses to a Write Frame round, so it plays unchanged. Pure, and in the start bundle (the game
 * itself is its own chunk). A chain with no frame gives an empty Write Frame scope, which shows the game's empty state.
 */
export function myStoryToWriteFrame(scope: MinigameScope): MinigameScope {
  const first = scope.myStory?.frames[0];
  return { kind: 'write-frame', rounds: first ? 1 : 0, writeFrame: { rounds: first ? [first] : [] } };
}
