import { isSpellingRound, spellingPickToListenPick, typeHangulMode, type MinigameKind } from '@hangul-route/content-schema';
import type { CurrFlagName } from '../config/flags';
import type { MinigameScope } from './minigame-config';

/**
 * The `game.<kind>` switches of the F-CURR-002 formats a step's scope can carry (section 12.2, row CM-31;
 * design/wireframes/minigame/shell.md rule 2 and 3). Each round of a switched-off format renders its fallback round,
 * decided before the step opens, so a quest never meets an "unavailable" line:
 * - `game.type-hangul-hear` off: a Dictation round (Type Hangul `hear`) is the Type Hangul `see` round of the same
 *   word (the memory store still records it at the produce rung).
 * - `game.spelling-pick` off: a spelling round is Listen & Pick on the same word (`spellingPickToListenPick`).
 * Both switches ship with built-in pct 0 (dark). Pure; the screens pass `currFlagOn`.
 */
export const DICTATION_SWITCH = 'game.type-hangul-hear' satisfies CurrFlagName;
export const SPELLING_SWITCH = 'game.spelling-pick' satisfies CurrFlagName;

/** Rounds turned from `hear` into `see` here: the game draws them as an ordinary `see` round (its heading too). */
const fromHear = new WeakSet<object>();

/** Whether `applyGameSwitches` made this round a `see` round of a word written as Dictation. */
export function switchedFromHear(round: object): boolean {
  return fromHear.has(round);
}

function seeOf<R extends object>(round: R): R & { mode: 'see' } {
  const out = { ...round, mode: 'see' as const };
  fromHear.add(out);
  return out;
}

/** The scope with every round of a switched-off format replaced by its fallback; the same object when nothing changes. */
export function applyGameSwitches(scope: MinigameScope, on: (flag: CurrFlagName) => boolean): MinigameScope {
  let out = scope;
  const hear = scope.typeHangul?.rounds;
  if (hear && hear.some((r) => typeHangulMode(r) === 'hear') && !on(DICTATION_SWITCH)) {
    out = { ...out, typeHangul: { ...scope.typeHangul, rounds: hear.map((r) => (typeHangulMode(r) === 'hear' ? seeOf(r) : r)) } };
  }
  const picks = scope.listenPick?.rounds;
  if (picks && picks.some(isSpellingRound) && !on(SPELLING_SWITCH)) {
    out = { ...out, listenPick: { rounds: picks.map(spellingPickToListenPick) } };
  }
  return out;
}

/** Whether the scope (switches applied) plays a round of the dictation chunk: a hear round or a spelling round. */
export function needsDictationChunk(scope: Pick<MinigameScope, 'typeHangul' | 'listenPick'>): boolean {
  return (scope.typeHangul?.rounds ?? []).some((r) => typeHangulMode(r) === 'hear') || (scope.listenPick?.rounds ?? []).some(isSpellingRound);
}

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
