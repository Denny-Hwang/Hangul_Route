import { useState, type ReactElement } from 'react';
import { fallbackScope } from '../../logic/match-shape/fallback';
import type { MinigameScope } from '../../logic/minigame-config';
import type { MinigameHost } from './host';
import { MatchShapeGame } from './MatchShapeGame';
import { ReadPickGame } from './ReadPickGame';

/**
 * What a `match-shape` quest step plays (F-CURR-002 sections 7.1 F4 and 12.2, row CM-33), in the Match Shape chunk: the
 * game while `game.match-shape` is on; while it is off, **Read Pick** (`fallbackScope`, its answers read from its own
 * scope at the read rung, reported as `listen-pick`), so no switch bricks a quest. The switch is read once by the entry
 * (`MatchShapeStep`), so a remote copy arriving mid-step never swaps the game.
 */
export interface MatchShapeStepBodyProps {
  scope: MinigameScope;
  hostFor: (played: MinigameScope) => MinigameHost;
  onBack: () => void;
  on: boolean;
}

export function MatchShapeStepBody({ scope, hostFor, onBack, on }: MatchShapeStepBodyProps): ReactElement {
  const [played] = useState(() => (on ? scope : fallbackScope(scope)));
  if (on) return <MatchShapeGame scope={scope} host={hostFor(scope)} onBack={onBack} />;
  return <ReadPickGame scope={played} host={hostFor(played)} onBack={onBack} />;
}
