import { formatDate, type UiLocale } from '@hangul-route/i18n';
import type { LoadedRecent, RecentList } from './recent';

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

/** What the home draws from the boot read of `lecture:recent` (`readRecent`): null while it is in flight. */
export function recentView(loaded: LoadedRecent | null): RecentState {
  if (loaded === null) return { status: 'loading' };
  return loaded.off ? { status: 'off' } : { status: 'ready', list: loaded.list };
}
