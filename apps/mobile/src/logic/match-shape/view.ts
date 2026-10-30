import type { OriginRound, OriginState, PairRound, PairState } from './flow';
import { shapeLetter } from './letters';

/**
 * What a Match Shape round draws (F-CURR-002 section 7.1 F4, row CM-33; design/wireframes/minigame/match-shape.md,
 * Interaction points and Accessibility). Pure: the screen maps each look onto tokens.
 *
 * - An origin tile shows its letter and its isolated-letter value; its name reads both ("ㄱ, g or k").
 * - A pair tile shows the letter only, and its name is the jamo with its RR letter name, never its sound, so a name
 *   never answers the round ("ㅂ, letter bieup"); once found it shows the sound and says it ("..., b or p, found").
 * - No state is colour only: a found tile carries the check, a missed one the mark and a thicker border.
 */

export type ShapeTileLook = 'plain' | 'found' | 'marked' | 'ring';

/** The a11y strings a view needs (`m.a11y.minigame.matchShape`). */
export interface ShapeA11y {
  originTile: (letter: string, sound: string) => string;
  pairTile: (letter: string, name: string) => string;
  found: (letter: string, name: string, sound: string) => string;
  pairHeading: (letter: string, name: string, sound: string) => string;
  sounds: (first: string, second: string) => string;
}

/** A sound value read as words in the UI language (`g/k` -> "g or k"; `n` stays `n`). */
export function soundSpoken(sound: string, a11y: Pick<ShapeA11y, 'sounds'>): string {
  const [first, second] = sound.split('/');
  return second === undefined ? (first ?? sound) : a11y.sounds(first as string, second);
}

export interface OriginTileView {
  id: string;
  char: string;
  sound: string;
  look: ShapeTileLook;
  accessibilityLabel: string;
}

export function originTiles(round: OriginRound, state: OriginState, a11y: ShapeA11y): OriginTileView[] {
  return round.options.map((id) => {
    const l = shapeLetter(id);
    const look: ShapeTileLook =
      state.status === 'found' && id === round.target ? 'found' : state.wrong.includes(id) ? 'marked' : state.ring && id === round.target ? 'ring' : 'plain';
    return { id, char: l.char, sound: l.sound, look, accessibilityLabel: a11y.originTile(l.char, soundSpoken(l.sound, a11y)) };
  });
}

export interface PairTileView {
  index: number;
  char: string;
  /** The sound value, shown under a found tile only. */
  sound: string | null;
  look: ShapeTileLook;
  accessibilityLabel: string;
}

export function pairTiles(round: PairRound, state: PairState, a11y: ShapeA11y): PairTileView[] {
  const target = shapeLetter(round.target);
  const lookAlike = shapeLetter(round.lookAlike);
  return [...round.layout].map((t, index) => {
    const l = t === 't' ? target : lookAlike;
    const found = state.found.includes(index);
    const look: ShapeTileLook = found ? 'found' : state.wrong.includes(index) ? 'marked' : state.ring && t === 't' ? 'ring' : 'plain';
    return {
      index,
      char: l.char,
      sound: found ? l.sound : null,
      look,
      accessibilityLabel: found ? a11y.found(l.char, l.name, soundSpoken(l.sound, a11y)) : a11y.pairTile(l.char, l.name),
    };
  });
}

/** The pair heading's target: its letter and sound on screen, and the heading's spoken name. */
export function pairHeading(round: PairRound, a11y: ShapeA11y): { char: string; sound: string; accessibilityLabel: string } {
  const l = shapeLetter(round.target);
  return { char: l.char, sound: l.sound, accessibilityLabel: a11y.pairHeading(l.char, l.name, soundSpoken(l.sound, a11y)) };
}
