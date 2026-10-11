/**
 * Presenter keyboard and clicker map (F-TCH-004 §3.5), pure. The web
 * platform layer (`platform/presenter.web.ts`, PR 6) turns a `keydown` into a
 * `KeyInput`, asks for the command and calls `preventDefault()` only when one
 * comes back, so every unmapped key keeps its browser meaning.
 *
 * Presentation clickers send PageUp, PageDown, B or "." and Escape, so they
 * work with no setup. Keys held with Ctrl, Meta or Alt are browser or OS
 * shortcuts and are never taken.
 */

export type KeyCommand =
  | 'next'
  | 'prev'
  | 'first'
  | 'last'
  | 'escape'
  | 'replay-sound'
  | 'replay-stroke'
  | 'toggle-romanization'
  | 'fullscreen'
  | { overlay: 'blank' | 'timer' | 'picker' | 'grid' | 'help' };

export interface KeyInput {
  /** `KeyboardEvent.key`. */
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Focus is in a text field (none exist in the MVP; kept so a later field cannot be hijacked). */
  inTextInput?: boolean;
  /** An IME composition is in progress. */
  isComposing?: boolean;
}

const NAMED = new Map<string, KeyCommand>([
  ['ArrowRight', 'next'],
  ['ArrowDown', 'next'],
  ['PageDown', 'next'],
  [' ', 'next'],
  ['Spacebar', 'next'],
  ['Enter', 'next'],
  ['ArrowLeft', 'prev'],
  ['ArrowUp', 'prev'],
  ['PageUp', 'prev'],
  ['Backspace', 'prev'],
  ['Home', 'first'],
  ['End', 'last'],
  ['Escape', 'escape'],
  ['Esc', 'escape'],
  ['.', { overlay: 'blank' }],
  ['?', { overlay: 'help' }],
]);

/** Letter keys, matched case-insensitively (Caps Lock and Shift do not matter, except Shift+R). */
const LETTERS = new Map<string, KeyCommand>([
  ['b', { overlay: 'blank' }],
  ['s', 'replay-sound'],
  ['r', 'replay-stroke'],
  ['t', { overlay: 'timer' }],
  ['p', { overlay: 'picker' }],
  ['g', { overlay: 'grid' }],
  ['f', 'fullscreen'],
  ['h', { overlay: 'help' }],
]);

export function commandForKey(input: KeyInput): KeyCommand | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  if (input.inTextInput || input.isComposing) return null;
  const named = NAMED.get(input.key);
  if (named !== undefined) return named;
  if (input.key.length !== 1) return null;
  const letter = input.key.toLowerCase();
  if (letter === 'r' && input.shiftKey) return 'toggle-romanization';
  return LETTERS.get(letter) ?? null;
}
