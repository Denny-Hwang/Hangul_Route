import type { MatchShapeRound } from '@hangul-route/content-schema';

/**
 * One Match Shape round as a pure reducer (F-CURR-002 section 7.1 F4, row CM-33; design/wireframes/minigame/match-shape.md,
 * Interaction points and Scoring). The screen renders the state and runs the effects.
 *
 * - **Origin** (pick the letter the picture's shape comes from): the first tap is the scored answer (the shell rule).
 *   A right tile shows the letter beside the picture, says its sound and waits for Continue: the sourced line is the
 *   point of the round, so it never advances on a timer (WCAG 2.2.1). Another tile is locked with the amber nudge; a
 *   second miss rings the right tile. "Where this comes from" opens the sources in place, only once the letter is found.
 * - **Pair** (tap every copy among look-alikes): right first try when every copy is found before any look-alike is
 *   tapped; the first look-alike tap is the round's first, missed, answer and later taps are retries. A second miss rings
 *   every copy still to find. When the last copy is found the sound plays once and the round advances by itself.
 */

export type OriginRound = Extract<MatchShapeRound, { shape: 'origin' }>;
export type PairRound = Extract<MatchShapeRound, { shape: 'pair' }>;

export interface OriginState {
  shape: 'origin';
  status: 'asking' | 'found';
  /** Tiles tapped that are not the letter: locked, in the order tapped. */
  wrong: string[];
  /** The right tile is ringed after the second miss. */
  ring: boolean;
  scored: boolean;
  sourcesOpen: boolean;
}

export interface PairState {
  shape: 'pair';
  status: 'asking' | 'found';
  /** Tile positions found (copies of the target). */
  found: number[];
  /** Look-alike positions tapped: locked. */
  wrong: number[];
  /** Every copy still to find is ringed after the second miss. */
  ring: boolean;
  scored: boolean;
}

export type ShapeState = OriginState | PairState;

export type ShapeEvent = { type: 'tap'; id: string } | { type: 'tap-tile'; index: number } | { type: 'sources' } | { type: 'continue' };

export type ShapeEffect =
  | { type: 'answer'; correct: boolean }
  | { type: 'haptic'; kind: 'success' | 'nudge' }
  /** Say the target letter's sound (the right answer's extra; nothing in the round needs it). */
  | { type: 'play' }
  /** The round is over: the screen moves on (a pair after a short pause, an origin at once on Continue). */
  | { type: 'solved' };

export function startShape(round: MatchShapeRound): ShapeState {
  return round.shape === 'origin'
    ? { shape: 'origin', status: 'asking', wrong: [], ring: false, scored: false, sourcesOpen: false }
    : { shape: 'pair', status: 'asking', found: [], wrong: [], ring: false, scored: false };
}

/** The positions of the target's copies in a pair layout (`t`). */
export function copiesOf(layout: string): number[] {
  return [...layout].flatMap((c, i) => (c === 't' ? [i] : []));
}

const answered = (scored: boolean, correct: boolean): ShapeEffect[] => (scored ? [] : [{ type: 'answer', correct }]);

function stepOrigin(state: OriginState, event: ShapeEvent, round: OriginRound): { state: OriginState; effects: ShapeEffect[] } {
  switch (event.type) {
    case 'tap': {
      if (state.status === 'found' || state.wrong.includes(event.id) || !round.options.includes(event.id)) return { state, effects: [] };
      if (event.id === round.target) {
        return {
          state: { ...state, status: 'found', ring: false, scored: true },
          effects: [...answered(state.scored, true), { type: 'haptic', kind: 'success' }, { type: 'play' }],
        };
      }
      const wrong = [...state.wrong, event.id];
      return {
        state: { ...state, wrong, ring: wrong.length >= 2, scored: true },
        effects: [...answered(state.scored, false), { type: 'haptic', kind: 'nudge' }],
      };
    }
    case 'sources':
      return state.status === 'found' ? { state: { ...state, sourcesOpen: !state.sourcesOpen }, effects: [] } : { state, effects: [] };
    case 'continue':
      return state.status === 'found' ? { state, effects: [{ type: 'solved' }] } : { state, effects: [] };
    case 'tap-tile':
      return { state, effects: [] };
  }
}

function stepPair(state: PairState, event: ShapeEvent, round: PairRound): { state: PairState; effects: ShapeEffect[] } {
  if (event.type !== 'tap-tile' || state.status === 'found') return { state, effects: [] };
  const { index } = event;
  const tile = round.layout[index];
  if (tile === undefined || state.found.includes(index) || state.wrong.includes(index)) return { state, effects: [] };
  if (tile === 't') {
    const found = [...state.found, index];
    const all = copiesOf(round.layout).every((i) => found.includes(i));
    if (!all) return { state: { ...state, found }, effects: [{ type: 'haptic', kind: 'success' }] };
    return {
      state: { ...state, found, status: 'found', ring: false, scored: true },
      effects: [...answered(state.scored, true), { type: 'haptic', kind: 'success' }, { type: 'play' }, { type: 'solved' }],
    };
  }
  const wrong = [...state.wrong, index];
  return {
    state: { ...state, wrong, ring: wrong.length >= 2, scored: true },
    effects: [...answered(state.scored, false), { type: 'haptic', kind: 'nudge' }],
  };
}

export function stepShape(state: ShapeState, event: ShapeEvent, round: MatchShapeRound): { state: ShapeState; effects: ShapeEffect[] } {
  if (state.shape === 'origin' && round.shape === 'origin') return stepOrigin(state, event, round);
  if (state.shape === 'pair' && round.shape === 'pair') return stepPair(state, event, round);
  return { state, effects: [] };
}

/** Hoya's line: none while asking with no miss; after a miss the round's look-again line; after the right answer the found line. */
export type ShapeHoyaLine = 'missOrigin' | 'missPair' | 'found' | null;

export function shapeHoyaLine(state: ShapeState): ShapeHoyaLine {
  if (state.status === 'found') return 'found';
  if (state.wrong.length === 0) return null;
  return state.shape === 'origin' ? 'missOrigin' : 'missPair';
}
