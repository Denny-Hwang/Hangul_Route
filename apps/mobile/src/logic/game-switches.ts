import type { MinigameKind } from '@hangul-route/content-schema';
import type { CurrFlagName } from '../config/flags';

/**
 * The F-CURR-002 formats behind a `game.<kind>` switch (section 7.1, section 12.2): each new round kind,
 * its switch and the shipped kind its rounds render as while the switch is off, so no switch bricks a
 * quest. A row that adds a format appends its line.
 */
export const GAME_SWITCHES: Readonly<Partial<Record<MinigameKind, { flag: CurrFlagName; fallback: MinigameKind }>>> = {
  // Row CM-34: Story Order falls back to Story Sequence with text cards.
  'story-order': { flag: 'game.story-order', fallback: 'story-sequence' },
};

/** The kind a step of `kind` renders as, given which switches are on. */
export function renderedKind(kind: MinigameKind, on: (flag: CurrFlagName) => boolean): MinigameKind {
  const gate = GAME_SWITCHES[kind];
  return gate === undefined || on(gate.flag) ? kind : gate.fallback;
}
