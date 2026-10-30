import { describe, expect, it } from 'vitest';
import { HELP_KEYS } from '../help-keys';
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
    ['g', { overlay: 'grid' }],
    ['f', 'fullscreen'],
    ['h', { overlay: 'help' }],
    ['?', { overlay: 'help' }],
    ['Escape', 'escape'],
    ['Esc', 'escape'],
  ] as Array<[string, KeyCommand]>)('%j -> %j', (k, command) => {
    expect(key(k)).toEqual(command);
  });

  it('P maps to nothing: the helper picker is gone (LV-H), so the key keeps its browser meaning', () => {
    expect(key('p')).toBeNull();
    expect(key('P')).toBeNull();
    expect(commandForKey({ key: 'ㅔ', code: 'KeyP' })).toBeNull();
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
    for (const k of ['a', 'x', 'Tab', 'F5', 'Shift', 'Control', '0', '5', '9', 'Delete', '', 'ArrowRightX']) expect(key(k)).toBeNull();
  });
});

describe('keys 1 to 4 point at an option (AMENDMENTS-PRESENTER-NAV section 7.3, owner choice O2)', () => {
  it.each([1, 2, 3, 4])('key %j points at that option', (n) => {
    expect(key(String(n))).toEqual({ point: n });
  });

  it.each([1, 2, 3, 4])('matched by the physical key too: Digit%i and Numpad%i, whatever the layout gives (AZERTY, a Hangul source)', (n) => {
    expect(commandForKey({ key: ['&', 'é', '"', "'"][n - 1]!, code: `Digit${n}` })).toEqual({ point: n });
    expect(commandForKey({ key: 'Process', code: `Digit${n}` })).toEqual({ point: n });
    expect(commandForKey({ key: 'Unidentified', code: `Numpad${n}` })).toEqual({ point: n });
    expect(commandForKey({ key: String(n), code: `Numpad${n}` })).toEqual({ point: n });
  });

  it('AZERTY with Shift (the digit row needs it there) still points', () => {
    expect(commandForKey({ key: '3', code: 'Digit3', shiftKey: true })).toEqual({ point: 3 });
  });

  it('a numpad key with Num Lock off keeps its navigation meaning (End, the arrows, PageDown)', () => {
    expect(commandForKey({ key: 'End', code: 'Numpad1' })).toBe('last');
    expect(commandForKey({ key: 'ArrowDown', code: 'Numpad2' })).toBe('next');
    expect(commandForKey({ key: 'PageDown', code: 'Numpad3' })).toBe('next');
    expect(commandForKey({ key: 'ArrowLeft', code: 'Numpad4' })).toBe('prev');
  });

  it('other digits and their physical keys point at nothing', () => {
    for (const code of ['Digit0', 'Digit5', 'Digit9', 'Numpad0', 'Numpad5', 'Numpad9', 'NumpadEnter']) {
      expect(commandForKey({ key: 'Unidentified', code }), code).toBeNull();
    }
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])('not with %j held (Ctrl+1 is the browser tab)', (mods) => {
    for (const n of ['1', '2', '3', '4']) {
      expect(commandForKey({ key: n, code: `Digit${n}`, ...mods })).toBeNull();
      expect(commandForKey({ key: n, code: `Numpad${n}`, ...mods })).toBeNull();
    }
  });

  it('not on auto-repeat, not during IME composition, not in a text field', () => {
    for (const n of ['1', '2', '3', '4']) {
      expect(commandForKey({ key: n, code: `Digit${n}`, repeat: true })).toBeNull();
      expect(commandForKey({ key: n, code: `Digit${n}`, isComposing: true })).toBeNull();
      expect(commandForKey({ key: 'Process', code: `Digit${n}`, isComposing: true })).toBeNull();
      expect(commandForKey({ key: n, inTextInput: true })).toBeNull();
    }
  });

  it('focus on a control does not block them (after a click on Previous or Next, focus stays there)', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(commandForKey({ key: String(n), onActivatable: true })).toEqual({ point: n });
      expect(commandForKey({ key: 'Unidentified', code: `Digit${n}`, onActivatable: true })).toEqual({ point: n });
    }
  });

  it('Enter and Space on a focused control still map to nothing (they activate the control)', () => {
    for (const k of ['Enter', ' ', 'Spacebar']) expect(commandForKey({ key: k, onActivatable: true })).toBeNull();
  });
});

describe('the docked bar order and the Touch and mouse group change no key (AMENDMENTS-PRESENTER-NAV section 8, row PN-3)', () => {
  // The PR 4 cases, verbatim: every next and previous key of the clicker map.
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
  ] as Array<[string, KeyCommand]>)('%j -> %j', (k, command) => {
    expect(key(k)).toEqual(command);
  });

  it('Help still shows exactly those keys on its next and previous rows', () => {
    expect(HELP_KEYS.find((r) => r.row === 'next')!.keys).toEqual(['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter']);
    expect(HELP_KEYS.find((r) => r.row === 'back')!.keys).toEqual(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']);
  });
});
