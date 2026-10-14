import { formatDate, type UiLocale } from '@hangul-route/i18n';
import { RECENT_KEY, forgetDeck, parseRecent, saveRecent, type RecentList, type RecentStore } from './recent';

/**
 * When a Recent lesson was saved (design `home.md`): "Today" / "Yesterday"
 * (`common.date.*`, the capitalised standalone forms) by the local calendar
 * day, else a short date in the presenter language.
 */
export interface DayWords {
  today: string;
  yesterday: string;
}

const DAY_MS = 86_400_000;

export function recentDayLabel(locale: UiLocale, words: DayWords, savedAt: string, now: Date): string {
  const then = new Date(savedAt);
  if (Number.isNaN(then.getTime())) return '';
  const startOf = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / DAY_MS);
  if (days <= 0) return words.today;
  if (days === 1) return words.yesterday;
  return formatDate(locale, then, 'monthDay');
}

/** The option the arrow keys and Home / End select in a one-tab-stop chip radiogroup (README D19). */
export function radioAfter<T>(options: readonly T[], current: T, key: string): T | null {
  const at = options.indexOf(current);
  if (at === -1) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return options[(at + 1) % options.length]!;
    case 'ArrowLeft':
    case 'ArrowUp':
      return options[(at - 1 + options.length) % options.length]!;
    case 'Home':
      return options[0]!;
    case 'End':
      return options[options.length - 1]!;
    default:
      return null;
  }
}

/** Recent as the home draws it: the list, or `off` when this device's storage cannot be read. */
export type RecentState = { status: 'loading' } | { status: 'ready'; list: RecentList } | { status: 'off' };

/**
 * Reads `lecture:recent` through a store whose read throws when storage is
 * blocked (the presenter passes `readJsonStrict`), so a private window or a
 * locked-down device shows the storage-off line instead of a list that looks
 * empty; nothing stored or corrupt data is an empty list (section 3.12).
 */
export async function loadRecentState(store: RecentStore): Promise<RecentState> {
  try {
    return { status: 'ready', list: parseRecent(await store.readJson(RECENT_KEY)) };
  } catch {
    return { status: 'off' };
  }
}

/** Drops a deck from Recent; the row goes even when the write fails (the next load may show it again). */
export async function removeRecent(store: RecentStore, list: RecentList, deckId: string): Promise<RecentState> {
  const next = forgetDeck(list, deckId);
  await saveRecent(store, next);
  return { status: 'ready', list: next };
}
