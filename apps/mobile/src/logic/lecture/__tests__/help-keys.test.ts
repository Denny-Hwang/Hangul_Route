import { describe, expect, it } from 'vitest';
import { HELP_KEYS, HELP_TOUCH, rowCommands } from '../help-keys';
import { commandForKey } from '../keymap';

describe('HELP_KEYS (the Keys and controls overlay, section 3.5)', () => {
  it('every key a row shows sends that row command (the point row: each digit its own option)', () => {
    for (const row of HELP_KEYS) {
      const commands = rowCommands(row);
      expect(commands, row.row).toHaveLength(row.keys.length);
      row.keys.forEach((key, i) => {
        expect(commandForKey({ key, ...(row.shift ? { shiftKey: true } : {}) }), `${row.row}: ${key}`).toEqual(commands[i]);
      });
    }
  });

  it('the point row lists exactly 1, 2, 3 and 4, each pointing at its option (section 9.2, O2)', () => {
    const point = HELP_KEYS.find((r) => r.row === 'point')!;
    expect(point.caps).toEqual(['1', '2', '3', '4'].map((text) => ({ kind: 'plain', text })));
    expect(point.keys).toEqual(['1', '2', '3', '4']);
    expect(rowCommands(point)).toEqual([{ point: 1 }, { point: 2 }, { point: 3 }, { point: 4 }]);
    // It sits after the navigation rows, before the tools.
    const rows = HELP_KEYS.map((r) => r.row);
    expect(rows.indexOf('point')).toBe(rows.indexOf('first') + 1);
  });

  it('HELP_TOUCH has the point line (section 9.2; PN-3 adds the others)', () => {
    expect(HELP_TOUCH).toContain('point');
    expect(new Set(HELP_TOUCH).size).toBe(HELP_TOUCH.length);
  });

  it('End is the last slide, beside Home on the first-and-last row', () => {
    expect(commandForKey({ key: 'End' })).toBe('last');
    expect(HELP_KEYS.find((r) => r.row === 'first')!.caps).toEqual([
      { kind: 'plain', text: 'Home' },
      { kind: 'plain', text: 'End' },
    ]);
  });

  it('lists every command of the key map once', () => {
    // A row's own keys may share its command (Next has five); no command shows on two rows.
    const commands = HELP_KEYS.flatMap((r) => [...new Set(rowCommands(r).map((c) => JSON.stringify(c)))]);
    expect(new Set(commands).size).toBe(commands.length);
    for (const c of ['next', 'prev', 'first', 'replay-sound', 'replay-stroke', 'toggle-romanization', 'fullscreen', 'escape']) {
      expect(commands).toContain(JSON.stringify(c));
    }
    for (const o of ['blank', 'timer', 'grid', 'help']) expect(commands).toContain(JSON.stringify({ overlay: o }));
    for (const n of [1, 2, 3, 4]) expect(commands).toContain(JSON.stringify({ point: n }));
  });

  it('has no helper picker row (LV-H)', () => {
    expect(HELP_KEYS.map((r) => r.row)).not.toContain('picker');
    expect(HELP_KEYS.flatMap((r) => r.keys)).not.toContain('p');
  });

  it('the next and back rows show the up and down arrows too (README review)', () => {
    const next = HELP_KEYS.find((r) => r.row === 'next')!;
    const back = HELP_KEYS.find((r) => r.row === 'back')!;
    expect(next.caps).toContainEqual({ kind: 'arrow', dir: 'down' });
    expect(back.caps).toContainEqual({ kind: 'arrow', dir: 'up' });
  });
});
