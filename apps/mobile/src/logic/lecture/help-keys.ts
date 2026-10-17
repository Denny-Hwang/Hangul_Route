import type { KeyCommand } from './keymap';

/**
 * The Keys and controls overlay's rows (spec section 3.5 key map; design/screens/presenter/
 * overlays.md "Help"): every key of the map as key caps beside what it does. Pure data: the
 * overlay draws an arrow cap with the `arrow-left` / `arrow-right` glyph (rotated for up and
 * down, no new icon), a named cap (Space, Backspace) from the catalogue, and a plain cap as the
 * key's own label, which is the same on every keyboard. `keys` are the `KeyboardEvent.key` values
 * the caps stand for, so a test holds the rows to the key map.
 */

export type HelpRow =
  | 'next'
  | 'back'
  | 'first'
  | 'blank'
  | 'sound'
  | 'strokes'
  | 'romanization'
  | 'timer'
  | 'grid'
  | 'fullscreen'
  | 'help'
  | 'close';

export type KeyCap = { kind: 'arrow'; dir: 'left' | 'right' | 'up' | 'down' } | { kind: 'named'; name: 'space' | 'backspace' } | { kind: 'plain'; text: string };

export interface HelpKeys {
  row: HelpRow;
  caps: KeyCap[];
  /** What the caps send (`KeyboardEvent.key`, with Shift where `shift`). */
  keys: string[];
  shift?: true;
  command: KeyCommand;
}

const arrow = (dir: 'left' | 'right' | 'up' | 'down'): KeyCap => ({ kind: 'arrow', dir });
const plain = (text: string): KeyCap => ({ kind: 'plain', text });

export const HELP_KEYS: readonly HelpKeys[] = [
  { row: 'next', caps: [arrow('right'), arrow('down'), { kind: 'named', name: 'space' }, plain('PageDown'), plain('Enter')], keys: ['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'], command: 'next' },
  { row: 'back', caps: [arrow('left'), arrow('up'), plain('PageUp'), { kind: 'named', name: 'backspace' }], keys: ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'], command: 'prev' },
  { row: 'first', caps: [plain('Home'), plain('End')], keys: ['Home'], command: 'first' },
  { row: 'blank', caps: [plain('B'), plain('.')], keys: ['b', '.'], command: { overlay: 'blank' } },
  { row: 'sound', caps: [plain('S')], keys: ['s'], command: 'replay-sound' },
  { row: 'strokes', caps: [plain('R')], keys: ['r'], command: 'replay-stroke' },
  { row: 'romanization', caps: [plain('Shift'), plain('R')], keys: ['R'], shift: true, command: 'toggle-romanization' },
  { row: 'timer', caps: [plain('T')], keys: ['t'], command: { overlay: 'timer' } },
  { row: 'grid', caps: [plain('G')], keys: ['g'], command: { overlay: 'grid' } },
  { row: 'fullscreen', caps: [plain('F')], keys: ['f'], command: 'fullscreen' },
  { row: 'help', caps: [plain('H'), plain('?')], keys: ['h', '?'], command: { overlay: 'help' } },
  { row: 'close', caps: [plain('Esc')], keys: ['Escape'], command: 'escape' },
];
