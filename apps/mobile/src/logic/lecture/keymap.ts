/**
 * Presenter keyboard and clicker map (F-TCH-004 §3.5), pure. The web
 * platform layer (`platform/presenter.web.ts`, PR 6) turns a `keydown` into a
 * `KeyInput`, asks for the command and calls `preventDefault()` only when one
 * comes back, so every unmapped key keeps its browser meaning.
 *
 * Presentation clickers send PageUp, PageDown, B or "." and Escape, so they
 * work with no setup. Keys held with Ctrl, Meta or Alt are browser or OS
 * shortcuts and are never taken.
 *
 * Fields the platform layer (PR 6) fills from the `keydown` event:
 * - `onActivatable`: `document.activeElement` is a button, link or
 *   role=button / checkbox / menuitem / switch. Enter and Space then belong
 *   to that control (keyboard-only operation of the control bar, §3.13), so
 *   they map to nothing; arrows, clicker keys and letters still map.
 * - `repeat`: `KeyboardEvent.repeat`. Auto-repeat maps to nothing, so a held
 *   key or clicker button cannot toggle the full-screen blank, grid or help
 *   overlay at the repeat rate (no flashing on a projector, §3.13).
 * - `code`: `KeyboardEvent.code`. With a Hangul (or other non-Latin) input
 *   source the letter keys arrive as jamo, "Process" or "Unidentified"; the
 *   physical key then decides. A Latin `key` always wins, so AZERTY and Dvorak
 *   letters keep their own meaning.
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
  | { overlay: 'blank' | 'timer' | 'grid' | 'help' };

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
  /** `KeyboardEvent.code`, the physical key; used only when `key` is not a Latin character. */
  code?: string;
  /** `KeyboardEvent.repeat`: the key is held down. */
  repeat?: boolean;
  /** Focus is on a button, link or other control that Enter / Space activate. */
  onActivatable?: boolean;
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
  ['g', { overlay: 'grid' }],
  ['f', 'fullscreen'],
  ['h', { overlay: 'help' }],
]);

/** Keys a focused control activates itself. */
const ACTIVATE_KEYS = new Set(['Enter', ' ', 'Spacebar']);

/** A printable ASCII character: the layout produced a Latin key, so `key` is trusted over `code`. */
const LATIN_KEY = /^[\x21-\x7e]$/;

/** Physical key -> the character the US layout gives it, for non-Latin input sources. */
function keyFromCode(code: string | undefined, shiftKey: boolean | undefined): string | null {
  if (code === undefined) return null;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1]!.toLowerCase();
  if (code === 'Period') return '.';
  if (code === 'Slash' && shiftKey) return '?';
  return null;
}

function letterCommand(letter: string, shiftKey: boolean | undefined): KeyCommand | null {
  if (letter === 'r' && shiftKey) return 'toggle-romanization';
  return LETTERS.get(letter) ?? null;
}

export function commandForKey(input: KeyInput): KeyCommand | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  if (input.inTextInput || input.isComposing || input.repeat) return null;
  if (input.onActivatable && ACTIVATE_KEYS.has(input.key)) return null;
  const named = NAMED.get(input.key);
  if (named !== undefined) return named;
  if (LATIN_KEY.test(input.key)) return letterCommand(input.key.toLowerCase(), input.shiftKey);
  const physical = keyFromCode(input.code, input.shiftKey);
  if (physical === null) return null;
  return NAMED.get(physical) ?? letterCommand(physical, input.shiftKey);
}
