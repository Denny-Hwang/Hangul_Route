import { afterEach, describe, expect, it } from 'vitest';
import { CONSOLE_FLASH_KEY, consoleFlashText, resetConsoleFlash, takeConsoleFlash, writeConsoleFlash } from '../console-flash';
import type { KeyValueStorage } from '../../i18n/safe-storage';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 6.6 step 7: the one-shot notice after an accept or Stop being an administrator
 * travels in this tab's sessionStorage (never a query parameter), and the next page reads and removes it once.
 */
function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

afterEach(() => resetConsoleFlash());

describe('the console flash', () => {
  it('is read once and removed; a remount of the same page shows it again, another page does not', () => {
    const storage = memory();
    expect(writeConsoleFlash({ kind: 'adminJoined', school: 'Maple School' }, storage)).toBe(true);
    expect(takeConsoleFlash('/teach/space?id=space%3Amaple', storage)).toEqual({ kind: 'adminJoined', school: 'Maple School' });
    expect(storage.data.has(CONSOLE_FLASH_KEY)).toBe(false);
    expect(takeConsoleFlash('/teach/space?id=space%3Amaple', storage)).toEqual({ kind: 'adminJoined', school: 'Maple School' });
    expect(takeConsoleFlash('/teach/home', storage)).toBeNull();
    expect(takeConsoleFlash('/teach/space?id=space%3Amaple', storage)).toBeNull();
  });

  it('a corrupt or foreign record reads as none and is removed', () => {
    const storage = memory();
    for (const raw of ['{', 'null', JSON.stringify({ kind: 'other', school: 'X' }), JSON.stringify({ kind: 'adminLeft', school: '' }), JSON.stringify({ kind: 'adminLeft' })]) {
      storage.setItem(CONSOLE_FLASH_KEY, raw);
      expect(takeConsoleFlash('/teach/home', storage)).toBeNull();
      expect(storage.data.has(CONSOLE_FLASH_KEY)).toBe(false);
    }
    expect(takeConsoleFlash('/teach/home', null)).toBeNull();
    expect(writeConsoleFlash({ kind: 'adminLeft', school: 'Maple School' }, null)).toBe(false);
  });

  it('is worded in the console language', () => {
    expect(consoleFlashText({ kind: 'adminJoined', school: 'Maple School' })).toBe("You're an administrator of Maple School.");
    expect(consoleFlashText({ kind: 'adminLeft', school: 'Maple School' })).toBe("You're no longer an administrator of Maple School.");
    expect(consoleFlashText({ kind: 'adminJoined', school: 'Maple School' }, 'ko')).toBe('이제 관리자예요: Maple School');
    expect(consoleFlashText({ kind: 'adminLeft', school: 'Maple School' }, 'es')).toBe('Ya no eres admin de Maple School.');
  });
});
