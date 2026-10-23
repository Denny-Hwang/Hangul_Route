import { storyOrderPictures, type KoText, type StoryOrderRound } from '@hangul-route/content-schema';
import { initSequenceState, reduceSequence, type SequenceAction, type SequenceState } from '../story/sequence-player';

/**
 * Story Order (F-CURR-002 §7.1 F5, row CM-34; design/wireframes/minigame/story-order.md): the rounds of one
 * step over the shipped Story Sequence player (`story/sequence-player.ts`: the derangement, the slot scored
 * by its first answer, the ring after two misses, the replay). This adds the rounds, their own keys, and
 * Show meanings, a hint that holds for the rest of the round: answers after it are recorded as hinted for
 * the memory model and still score as usual, never a penalty. Pure; the chunk's `StoryOrderGame` runs the effects.
 */

/** One card: a panel's Korean line (with romanization and gloss) and, on a round that draws them, its picture. */
export interface StoryOrderCard {
  id: string;
  line: KoText;
  pictureRef?: string;
}

/** The cards of a round in their RIGHT order (the player deranges them); pictures only where the round draws them. */
export function storyOrderCards(round: StoryOrderRound): StoryOrderCard[] {
  const pictures = storyOrderPictures(round);
  return round.panels.map((p) => (pictures && p.pictureRef !== undefined ? { id: p.id, line: p.caption, pictureRef: p.pictureRef } : { id: p.id, line: p.caption }));
}

/** The step's rounds and the seed of each round's start order. */
export interface StoryOrderPlay {
  rounds: readonly StoryOrderRound[];
  seeds: readonly number[];
}

export interface StoryOrderState {
  roundIndex: number;
  /** The current round's sequence (Story Sequence's state). */
  seq: SequenceState;
  /** Show meanings was pressed in this round. */
  meanings: boolean;
  phase: 'playing' | 'done';
}

export type StoryOrderAction = SequenceAction | { type: 'showMeanings' } | { type: 'skip' };

export type StoryOrderEffect =
  /** Every tap: the run keeps only the first answer per key; `itemId` names the line the slot asked for. */
  | { type: 'answer'; roundKey: string; itemId: string; correct: boolean; hinted: boolean }
  | { type: 'placed'; cardId: string }
  | { type: 'miss'; cardId: string }
  | { type: 'highlight'; cardId: string }
  | { type: 'nextRound'; roundIndex: number }
  | { type: 'complete'; skipped: boolean };

/** One key per slot of a round, so two rounds never share one (`logic/round-keys.ts`). */
export const storyOrderRoundKey = (roundId: string, slot: number): string => `so:${roundId}:${slot}`;
/** The line a slot asked for, as the memory store reads it back from the scope (`memory/resolve.ts`). */
export const storyOrderItemId = (roundId: string, panelId: string): string => `${roundId}/${panelId}`;

function roundState(play: StoryOrderPlay, roundIndex: number): StoryOrderState {
  const round = play.rounds[roundIndex];
  return { roundIndex, seq: initSequenceState(round ? storyOrderCards(round) : [], play.seeds[roundIndex] ?? roundIndex), meanings: false, phase: 'playing' };
}

export function startStoryOrder(play: StoryOrderPlay): StoryOrderState {
  return play.rounds.length === 0 ? { ...roundState(play, 0), phase: 'done' } : roundState(play, 0);
}

const NONE = (state: StoryOrderState): { state: StoryOrderState; effects: StoryOrderEffect[] } => ({ state, effects: [] });

export function stepStoryOrder(play: StoryOrderPlay, state: StoryOrderState, action: StoryOrderAction): { state: StoryOrderState; effects: StoryOrderEffect[] } {
  if (state.phase === 'done') return NONE(state);
  if (action.type === 'skip') return { state: { ...state, phase: 'done' }, effects: [{ type: 'complete', skipped: true }] };
  if (action.type === 'showMeanings') {
    return state.seq.phase === 'ordering' && !state.meanings ? { state: { ...state, meanings: true }, effects: [] } : NONE(state);
  }
  const round = play.rounds[state.roundIndex] as StoryOrderRound;
  const slot = state.seq.placed.length;
  const out = reduceSequence(state.seq, action);
  if (out.effects.length === 0 && out.state === state.seq) return NONE(state);
  const effects: StoryOrderEffect[] = [];
  let next: StoryOrderState = { ...state, seq: out.state };
  for (const effect of out.effects) {
    if (effect.type === 'answer') {
      const asked = state.seq.solution[slot] as string;
      effects.push({ type: 'answer', roundKey: storyOrderRoundKey(round.id, slot), itemId: storyOrderItemId(round.id, asked), correct: effect.correct, hinted: state.meanings });
      if (action.type === 'tap') effects.push(effect.correct ? { type: 'placed', cardId: action.cardId } : { type: 'miss', cardId: action.cardId });
    } else if (effect.type === 'highlight') {
      effects.push(effect);
    } else if (state.roundIndex + 1 < play.rounds.length) {
      next = roundState(play, state.roundIndex + 1);
      effects.push({ type: 'nextRound', roundIndex: state.roundIndex + 1 });
    } else {
      next = { ...next, phase: 'done' };
      effects.push({ type: 'complete', skipped: false });
    }
  }
  return { state: next, effects };
}
