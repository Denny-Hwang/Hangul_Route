import { discoverItemTexts, type DiscoverPage } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';

/**
 * Adaptive pacing inside a quest (F-CURR-002 section 4.6, row CM-24), the rules in one pure module. A strong Practice
 * (90% or more right on the first try) makes the second Discover page of the cell's later quests compact and their
 * Apply one round shorter; a hard Practice (two first-try misses) adds one scaffold round before Apply. Nothing is
 * taken away: every Discover item still shows, the steps, their `durationSeconds` and the stars are the quest's own.
 * Only upper-stage lesson cells adapt (the Stage 1 letters and the story quests keep their one path). This module and
 * the scaffold's are reached only from the pacing chunk (`screens/quest/quest-pacing-chunk.tsx`), never the start bundle.
 */

/** One first answer of a quest run, with the step it was given in (`quest-run-store`). */
export interface StepTry {
  step: number;
  correct: boolean;
}

/** The right and wrong first tries of one step. */
export function tallyOf(tries: readonly StepTry[], step: number): { right: number; wrong: number } {
  let right = 0;
  let wrong = 0;
  for (const t of tries) {
    if (t.step !== step) continue;
    if (t.correct) right += 1;
    else wrong += 1;
  }
  return { right, wrong };
}

/**
 * 90% or more of the step's first tries right, in whole numbers (9 of 10 is strong, 8 of 9 is not), over 3 rounds or
 * more, so a Practice left after a round or two (the game's Skip) is never strong.
 */
export const strongRound = (t: { right: number; wrong: number }): boolean => t.right + t.wrong >= 3 && t.right * 10 >= (t.right + t.wrong) * 9;
/** Two first-try misses or more. */
export const hardRound = (t: { wrong: number }): boolean => t.wrong >= 2;

/**
 * Where a cell's strong round lives: in memory for this app session, per profile and cell (device-only, never sent or
 * stored, gone with the session). The value is the lowest quest index of the cell whose Practice was strong.
 */
const strongFrom = new Map<string, number>();
const cellKey = (profileId: string, episodeId: string): string => `${profileId}\n${episodeId}`;

export function noteStrongRound(profileId: string, episodeId: string, questIndex: number): void {
  const key = cellKey(profileId, episodeId);
  const was = strongFrom.get(key);
  if (questIndex >= 0 && (was === undefined || questIndex < was)) strongFrom.set(key, questIndex);
}

/** A later quest of a cell with a strong round plays compact. */
export function compactFor(profileId: string, episodeId: string, questIndex: number): boolean {
  const from = strongFrom.get(cellKey(profileId, episodeId));
  return from !== undefined && questIndex > from;
}

/** Tests only. */
export function resetQuestAdaptForTests(): void {
  strongFrom.clear();
}

/** The same rule on the authored page: two taught texts and no letter or exchange (what `compactView` of `./pacing-view.ts` sees once built). */
export const compactSource = (page: DiscoverPage | undefined): boolean =>
  !!page && page.items.every((i) => i.type !== 'jamo' && i.type !== 'exchange') && page.items.flatMap((i) => discoverItemTexts(i)).length === 2;

/** A list of rounds without its last one, put back into the scope; null when fewer than 3 rounds would be left with 2. */
const drop = <T,>(list: readonly T[] | undefined, put: (rest: T[]) => MinigameScope): MinigameScope | null =>
  list && list.length >= 3 ? put(list.slice(0, -1)) : null;

/**
 * The Apply scope one round shorter, or null when it keeps its rounds: fewer than 3 rounds, or a kind whose rounds
 * are one piece (a story order, the blocks of a word). Only the last round goes; nothing new is asked.
 */
export function shortenScope(scope: MinigameScope): MinigameScope | null {
  const s = (patch: Partial<MinigameScope>): MinigameScope => ({ ...scope, ...patch, ...(scope.rounds === undefined ? {} : { rounds: scope.rounds - 1 }) });
  switch (scope.kind) {
    case 'listen-pick':
      return drop(scope.listenPick?.rounds, (rounds) => s({ listenPick: { rounds } }));
    case 'pic-word-match':
      return drop(scope.picWord?.boards, (boards) => s({ picWord: { boards } }));
    case 'order-it':
      return drop(scope.orderIt?.rounds, (rounds) => s({ orderIt: { rounds } }));
    case 'type-hangul':
      return drop(scope.typeHangul?.rounds, (rounds) => s({ typeHangul: { rounds } }));
    case 'write-frame':
      return drop(scope.writeFrame?.rounds, (rounds) => s({ writeFrame: { rounds } }));
    case 'cloze-pick':
      return drop(scope.clozePick?.rounds, (rounds) => s({ clozePick: { ...scope.clozePick, rounds } }));
    case 'card-match':
      return drop(scope.cardPairs, (cardPairs) => s({ cardPairs }));
    case 'tap-respond':
      return drop(scope.dialogue, (dialogue) => s({ dialogue }));
    default:
      return null;
  }
}
