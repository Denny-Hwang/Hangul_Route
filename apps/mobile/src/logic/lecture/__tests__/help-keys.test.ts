import { describe, expect, it } from 'vitest';
import { HELP_KEYS } from '../help-keys';
import { commandForKey } from '../keymap';

describe('HELP_KEYS (the Keys and controls overlay, section 3.5)', () => {
  it('every key a row shows sends that row command', () => {
    for (const row of HELP_KEYS) {
      for (const key of row.keys) {
        expect(commandForKey({ key, ...(row.shift ? { shiftKey: true } : {}) }), `${row.row}: ${key}`).toEqual(row.command);
      }
    }
  });

  it('End is the last slide, beside Home on the first-and-last row', () => {
    expect(commandForKey({ key: 'End' })).toBe('last');
    expect(HELP_KEYS.find((r) => r.row === 'first')!.caps).toEqual([
      { kind: 'plain', text: 'Home' },
      { kind: 'plain', text: 'End' },
    ]);
  });

  it('lists every command of the key map once', () => {
    const commands = HELP_KEYS.map((r) => JSON.stringify(r.command));
    expect(new Set(commands).size).toBe(commands.length);
    for (const c of ['next', 'prev', 'first', 'replay-sound', 'replay-stroke', 'toggle-romanization', 'fullscreen', 'escape']) {
      expect(commands).toContain(JSON.stringify(c));
    }
    for (const o of ['blank', 'timer', 'picker', 'grid', 'help']) expect(commands).toContain(JSON.stringify({ overlay: o }));
  });

  it('the next and back rows show the up and down arrows too (README review)', () => {
    const next = HELP_KEYS.find((r) => r.row === 'next')!;
    const back = HELP_KEYS.find((r) => r.row === 'back')!;
    expect(next.caps).toContainEqual({ kind: 'arrow', dir: 'down' });
    expect(back.caps).toContainEqual({ kind: 'arrow', dir: 'up' });
  });
});
