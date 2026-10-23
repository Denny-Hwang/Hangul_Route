import type { BlockParts, SyllableZone } from '@hangul-route/content-schema';
import { NO_FINAL, wantedLetter, type BuildState } from './flow';
import { letterName } from './letters';
import type { TileRows } from './tiles';

/**
 * What a Syllable Build round draws (F-CURR-002 row CM-32; design/wireframes/minigame/syllable-build.md, D5 of
 * design/screens/minigame-variety/README.md). Pure view models over the round state:
 *
 * - **Tiles show the jamo only**, never a sound value, before and after the check; a tile's accessible name is its jamo
 *   and the letter's name ("ㅂ, letter bieup"), and a final tile adds "as a final". No final is a text tile.
 * - **The romanization is held back** until the block is right, or after Show how it sounds (a hint), or from the start
 *   with no device voice (reading is then the only way to the sound, so it is no hint).
 * - The zones: empty, filled, fixed (a symbol item's own zone), marked (a zone that did not fit) and right.
 */

export interface BuildCopy {
  row: Record<SyllableZone, string>;
  noFinal: string;
}

export interface BuildA11y {
  tile: (jamo: string, name: string) => string;
  finalTile: (jamo: string, name: string) => string;
  noFinal: string;
  /** A zone: its part, then what fills it (a tile's name), or empty. */
  zone: (part: string, filled?: string) => string;
  marked: (label: string) => string;
  block: (ko: string, romanization: string) => string;
}

export type TileLook = 'idle' | 'selected' | 'marked' | 'ring';

export interface TileView {
  key: string;
  zone: SyllableZone;
  /** The letter it puts in its zone; `NO_FINAL` for the No final tile. */
  letter: string;
  /** What the tile face shows: the jamo, or the No final label. */
  face: string;
  /** No final is a text label (it grows with the text setting); the jamo faces are media. */
  text: boolean;
  look: TileLook;
  accessibilityLabel: string;
}

export interface RowView {
  zone: SyllableZone;
  caption: string;
  tiles: TileView[];
}

function tileLabel(zone: SyllableZone, letter: string, a11y: BuildA11y): string {
  if (zone === 'final' && letter === NO_FINAL) return a11y.noFinal;
  return zone === 'final' ? a11y.finalTile(letter, letterName(letter)) : a11y.tile(letter, letterName(letter));
}

function tileLook(state: BuildState, target: BlockParts, zone: SyllableZone, letter: string): TileLook {
  const selected = state.zones[zone] === letter;
  if (selected) return state.marked.includes(zone) ? 'marked' : 'selected';
  return state.ring === zone && wantedLetter(target, zone) === letter ? 'ring' : 'idle';
}

/** The tile rows in block order; the fixed zone's row is not drawn (its zone is already filled). */
export function rowViews(rows: TileRows, state: BuildState, target: BlockParts, copy: BuildCopy, a11y: BuildA11y): RowView[] {
  const lists: ReadonlyArray<readonly [SyllableZone, readonly string[]]> = [
    ['first', rows.firstTiles],
    ['vowel', rows.vowelTiles],
    ['final', [...rows.finalTiles, NO_FINAL]],
  ];
  return lists
    .filter(([zone]) => zone !== state.fixed)
    .map(([zone, letters]) => ({
      zone,
      caption: copy.row[zone],
      tiles: letters.map((letter) => ({
        key: `${zone}:${letter === NO_FINAL ? 'none' : letter}`,
        zone,
        letter,
        face: zone === 'final' && letter === NO_FINAL ? copy.noFinal : letter,
        text: zone === 'final' && letter === NO_FINAL,
        look: tileLook(state, target, zone, letter),
        accessibilityLabel: tileLabel(zone, letter, a11y),
      })),
    }));
}

export type ZoneLook = 'empty' | 'filled' | 'fixed' | 'marked' | 'right';

export interface ZoneView {
  zone: SyllableZone;
  /** The letter in the zone, the No final label, or null when empty. */
  face: string | null;
  text: boolean;
  look: ZoneLook;
  /** A filled zone the learner placed empties on a tap; a fixed zone and a right block do not. */
  tappable: boolean;
  accessibilityLabel: string;
}

export function zoneViews(state: BuildState, copy: BuildCopy, a11y: BuildA11y): ZoneView[] {
  return (['first', 'vowel', 'final'] as const).map((zone) => {
    const letter = state.zones[zone];
    const part = copy.row[zone];
    if (letter === null) return { zone, face: null, text: false, look: 'empty', tappable: false, accessibilityLabel: a11y.zone(part) };
    const none = zone === 'final' && letter === NO_FINAL;
    const name = tileLabel(zone, letter, a11y);
    const look: ZoneLook = state.status === 'right' ? 'right' : zone === state.fixed ? 'fixed' : state.marked.includes(zone) ? 'marked' : 'filled';
    const label = a11y.zone(part, name);
    return {
      zone,
      face: none ? copy.noFinal : letter,
      text: none,
      look,
      tappable: look === 'filled' || look === 'marked',
      accessibilityLabel: look === 'marked' ? a11y.marked(label) : label,
    };
  });
}

export interface PromptView {
  /** The word's meaning (a block that is not a word has none). */
  gloss: string | undefined;
  /** The romanization when it may show: right, revealed, or no device voice; else null. */
  sound: string | null;
  /** Show how it sounds: offered while the romanization is held back. */
  showLink: boolean;
  /** The block's name once it is built ("Block 밥, bap, built"), else null. */
  blockLabel: string | null;
}

export interface PromptTarget {
  ko: string;
  romanization: string;
  gloss?: string | undefined;
}

export function promptView(target: PromptTarget, state: BuildState, noVoice: boolean, a11y: Pick<BuildA11y, 'block'>): PromptView {
  const right = state.status === 'right';
  const sound = right || state.revealed || noVoice ? target.romanization : null;
  return { gloss: target.gloss, sound, showLink: sound === null, blockLabel: right ? a11y.block(target.ko, target.romanization) : null };
}
