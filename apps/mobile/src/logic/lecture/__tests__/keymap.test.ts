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

  it('unmapped keys return null (so the browser keeps them)', () => {
    for (const k of ['a', 'x', 'Tab', 'F5', 'Shift', 'Control', '1', 'Delete', '', 'ArrowRightX']) expect(key(k)).toBeNull();
  });
});
