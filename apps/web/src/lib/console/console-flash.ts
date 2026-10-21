import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { browserStorage, readItem, removeItem, writeItem, type KeyValueStorage } from '../i18n/safe-storage';

/**
 * [SA] The one-shot console notice (AMENDMENTS-SEATS-ADMINS section 6.6 step 7, SA-0b D14): after an invite is
 * accepted the school page says `console.adminInvite.done(school)`, and after Stop being an administrator the next home
 * says `console.admins.left(school)`. The school's name travels in this tab's `sessionStorage` (`hr:console-flash`,
 * through the safe storage wrapper), never in a query parameter, so no name reaches an address, the history or a log.
 * The next page that draws the adult frame reads it once and removes it; a remount on that same page keeps showing it.
 */
export const CONSOLE_FLASH_KEY = 'hr:console-flash';

export type ConsoleFlashKind = 'adminJoined' | 'adminLeft';
export interface ConsoleFlash {
  kind: ConsoleFlashKind;
  school: string;
}

const KINDS: ReadonlySet<string> = new Set<ConsoleFlashKind>(['adminJoined', 'adminLeft']);

function sessionArea(): KeyValueStorage | null {
  return browserStorage('session');
}

export function writeConsoleFlash(flash: ConsoleFlash, storage: KeyValueStorage | null = sessionArea()): boolean {
  return writeItem(storage, CONSOLE_FLASH_KEY, JSON.stringify(flash));
}

function parseFlash(raw: string | null): ConsoleFlash | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as { kind?: unknown; school?: unknown } | null;
    if (!value || typeof value.kind !== 'string' || !KINDS.has(value.kind) || typeof value.school !== 'string' || value.school === '') return null;
    return { kind: value.kind as ConsoleFlashKind, school: value.school };
  } catch {
    return null;
  }
}

/** The page that took the flash and what it took, so a remount of that page shows it again (memory only). */
let held: { here: string; flash: ConsoleFlash } | null = null;

/**
 * The flash for the page at `here` (its path and query): read and removed from the tab's storage the first time a page
 * asks, then kept in memory for that page only. Another page asking drops it. Corrupt or foreign records read as none.
 */
export function takeConsoleFlash(here: string, storage: KeyValueStorage | null = sessionArea()): ConsoleFlash | null {
  if (held && held.here === here) return held.flash;
  held = null;
  const raw = readItem(storage, CONSOLE_FLASH_KEY);
  if (raw === null) return null;
  removeItem(storage, CONSOLE_FLASH_KEY);
  const flash = parseFlash(raw);
  if (flash) held = { here, flash };
  return flash;
}

/** Test hook: forget the page that took the last flash. */
export function resetConsoleFlash(): void {
  held = null;
}

/** The notice's words in the console language. */
export function consoleFlashText(flash: ConsoleFlash, locale: UiLocale = DEFAULT_LOCALE): string {
  const c = getMessages(locale).console;
  return flash.kind === 'adminJoined' ? c.adminInvite.done(flash.school) : c.admins.left(flash.school);
}
