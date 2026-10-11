import { describe, expect, it } from 'vitest';
import { commandForKey, type KeyCommand } from '../keymap';

const key = (k: string, mods: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {}) =>
  commandForKey({ key: k, ...mods });

describe('commandForKey (F-TCH-004 §3.5 keyboard / clicker map)', () => {
  it.each([
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
    ['b', { overlay: 'blank' }],
    ['B', { overlay: 'blank' }],
    ['.', { overlay: 'blank' }],
    ['s', 'replay-sound'],
    ['S', 'replay-sound'],
    ['r', 'replay-stroke'],
    ['t', { overlay: 'timer' }],
    ['T', { overlay: 'timer' }],
    ['p', { overlay: 'picker' }],
    ['g', { overlay: 'grid' }],
    ['f', 'fullscreen'],
    ['h', { overlay: 'help' }],
    ['?', { overlay: 'help' }],
    ['Escape', 'escape'],
    ['Esc', 'escape'],
  ] as Array<[string, KeyCommand]>)('%j -> %j', (k, command) => {
    expect(key(k)).toEqual(command);
  });

  it('Shift+R toggles romanization; plain R replays the stroke guide', () => {
    expect(key('R', { shiftKey: true })).toBe('toggle-romanization');
    expect(key('r', { shiftKey: true })).toBe('toggle-romanization');
    expect(key('R')).toBe('replay-stroke');
  });

  it('Shift does not change the other keys (a caps-lock or shifted clicker still works)', () => {
    expect(key('B', { shiftKey: true })).toEqual({ overlay: 'blank' });
    expect(key('PageDown', { shiftKey: true })).toBe('next');
    expect(key('?', { shiftKey: true })).toEqual({ overlay: 'help' });
  });

  it('presentation clicker keys work with no setup (PageUp, PageDown, B or ., Esc)', () => {
    expect([key('PageUp'), key('PageDown'), key('b'), key('.'), key('Escape')]).toEqual([
      'prev',
      'next',
      { overlay: 'blank' },
      { overlay: 'blank' },
      'escape',
    ]);
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])('ignores keys with %j held (browser shortcuts keep working)', (mods) => {
    for (const k of ['ArrowRight', 'r', 'f', 'p', 'Home', 'b', 'Escape']) expect(key(k, mods)).toBeNull();
  });

  it('ignores every key while focus is in a text input or an IME is composing', () => {
    expect(commandForKey({ key: 'ArrowRight', inTextInput: true })).toBeNull();
    expect(commandForKey({ key: ' ', inTextInput: true })).toBeNull();
    expect(commandForKey({ key: 'Enter', isComposing: true })).toBeNull();
  });

  it('Enter and Space on a focused button, link or toggle activate it instead of advancing the slide (§3.13, WCAG 2.1.1)', () => {
    for (const k of ['Enter', ' ', 'Spacebar']) {
      expect(commandForKey({ key: k, onActivatable: true })).toBeNull();
      expect(commandForKey({ key: k, onActivatable: false })).toBe('next');
      expect(commandForKey({ key: k })).toBe('next');
    }
  });

  it('arrows, clicker keys and letter shortcuts still work while a control-bar button has focus', () => {
    expect(commandForKey({ key: 'ArrowRight', onActivatable: true })).toBe('next');
    expect(commandForKey({ key: 'PageUp', onActivatable: true })).toBe('prev');
    expect(commandForKey({ key: 'b', onActivatable: true })).toEqual({ overlay: 'blank' });
    expect(commandForKey({ key: 'Escape', onActivatable: true })).toBe('escape');
  });

  it('ignores auto-repeat, so a held key or clicker button cannot flash the blank, grid or help overlay on a projector', () => {
    for (const k of ['b', 'B', '.', 'g', 'h', '?', 'f', 't', 'p', 's', 'r', 'ArrowRight', 'PageDown', ' ', 'Backspace', 'Home', 'Escape']) {
      expect(commandForKey({ key: k, repeat: true })).toBeNull();
    }
    expect(commandForKey({ key: 'R', shiftKey: true, repeat: true })).toBeNull();
    expect(commandForKey({ key: 'b', repeat: false })).toEqual({ overlay: 'blank' });
  });

  it.each([
    ['ㅠ', 'KeyB', { overlay: 'blank' }],
    ['ㄴ', 'KeyS', 'replay-sound'],
    ['ㄱ', 'KeyR', 'replay-stroke'],
    ['ㅅ', 'KeyT', { overlay: 'timer' }],
    ['ㅔ', 'KeyP', { overlay: 'picker' }],
    ['ㅎ', 'KeyG', { overlay: 'grid' }],
    ['ㄹ', 'KeyF', 'fullscreen'],
    ['ㅗ', 'KeyH', { overlay: 'help' }],
    ['Process', 'KeyT', { overlay: 'timer' }],
    ['Unidentified', 'KeyB', { overlay: 'blank' }],
    ['Process', 'Period', { overlay: 'blank' }],
  ] as Array<[string, string, KeyCommand]>)('Hangul or another non-Latin input source: key %j with code %j -> %j', (k, code, command) => {
    expect(commandForKey({ key: k, code })).toEqual(command);
  });

  it('the physical-key fallback keeps Shift+R for romanization and Shift+/ for help', () => {
    expect(commandForKey({ key: 'ㄲ', code: 'KeyR', shiftKey: true })).toBe('toggle-romanization');
    expect(commandForKey({ key: 'Process', code: 'Slash', shiftKey: true })).toEqual({ overlay: 'help' });
    expect(commandForKey({ key: 'Process', code: 'Slash' })).toBeNull();
  });

  it('a Latin key wins over the physical position (an AZERTY or Dvorak letter keeps its own meaning)', () => {
    expect(commandForKey({ key: 'b', code: 'KeyN' })).toEqual({ overlay: 'blank' });
    expect(commandForKey({ key: 'a', code: 'KeyB' })).toBeNull();
  });

  it('the physical-key fallback still respects modifiers, text inputs and unmapped keys', () => {
    expect(commandForKey({ key: 'ㅠ', code: 'KeyB', metaKey: true })).toBeNull();
    expect(commandForKey({ key: 'ㅠ', code: 'KeyB', inTextInput: true })).toBeNull();
    expect(commandForKey({ key: 'ㅁ', code: 'KeyA' })).toBeNull();
    expect(commandForKey({ key: 'ㅠ' })).toBeNull();
  });

  it('unmapped keys return null (so the browser keeps them)', () => {
    for (const k of ['a', 'x', 'Tab', 'F5', 'Shift', 'Control', '1', 'Delete', '', 'ArrowRightX']) expect(key(k)).toBeNull();
  });
});
