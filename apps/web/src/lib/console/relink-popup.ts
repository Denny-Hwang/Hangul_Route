import { browserStorage, readItem, writeItem, type KeyValueStorage } from '@/lib/i18n/safe-storage';
import type { RelinkView } from './api';

/**
 * The re-link pop-up's rules (AMENDMENTS-GROWNUP-UX GX-D4, section 5.3; owner request 2026-10-31). A re-link closes after
 * 10 minutes while the learner waits at the device, so a request this tab has not shown opens an `alertdialog` once; a
 * request put off with **Later** opens it once more when `RELINK_REMIND_MS` or less is left, and never a third time.
 * Moves (open 14 days) never open a pop-up. The two sets hold request ids only (no name), in this tab's `sessionStorage`
 * through the console's safe-storage wrapper (CLAUDE.md section 8).
 */

/** The reminder opens when this much (or less) is left on a request put off with Later. */
export const RELINK_REMIND_MS = 2 * 60_000;
/** Request ids this tab has shown in the pop-up. */
export const RELINK_SHOWN_KEY = 'hr:console:relinkShown';
/** Request ids this tab has reminded about (the second and last time). */
export const RELINK_REMINDED_KEY = 'hr:console:relinkReminded';
/** A tab session never keeps more ids than this (a long day of requests); the oldest drop first. */
const MAX_IDS = 200;

/** The ids under `key`; an unreadable or foreign value reads as none. */
export function readIds(storage: KeyValueStorage | null, key: string): Set<string> {
  const raw = readItem(storage, key);
  if (raw === null) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Adds `id` under `key`; a storage that refuses (a private window) only means the pop-up may show again after a reload. */
export function addId(storage: KeyValueStorage | null, key: string, id: string): void {
  const ids = [...readIds(storage, key)].filter((v) => v !== id);
  ids.push(id);
  writeItem(storage, key, JSON.stringify(ids.slice(-MAX_IDS)));
}

/** This tab's `sessionStorage`, or null where there is none. */
export const popupStorage = (): KeyValueStorage | null => browserStorage('session');

export interface PopupPick {
  request: RelinkView;
  /** The second (and last) automatic showing, at 2 minutes left after Later. */
  reminder: boolean;
}

/** When a request closes; an unreadable date reads as closed (never a guess). */
const expiry = (r: RelinkView): number => {
  const at = Date.parse(r.expiresAt);
  return Number.isNaN(at) ? Number.NEGATIVE_INFINITY : at;
};

/**
 * The request the pop-up opens for now, or null: among the pending, unexpired requests, the soonest-closing one that this
 * tab has not shown, or that it showed and has not reminded about while `RELINK_REMIND_MS` or less is left.
 */
export function nextRelinkPopup(relinks: readonly RelinkView[] | null, shown: ReadonlySet<string>, reminded: ReadonlySet<string>, now: Date): PopupPick | null {
  const at = now.getTime();
  const open = (relinks ?? []).filter((r) => r.status === 'pending' && expiry(r) > at).sort((a, b) => expiry(a) - expiry(b));
  for (const request of open) {
    if (!shown.has(request.id)) return { request, reminder: false };
    if (!reminded.has(request.id) && expiry(request) - at <= RELINK_REMIND_MS) return { request, reminder: true };
  }
  return null;
}

/** "(3) Teacher console": the page's waiting count in front of the tab title (section 5.4); a count only, never a name. */
const COUNT_PREFIX = /^\(\d+\+?\) /;

export function titleWithCount(title: string, count: number): string {
  const base = title.replace(COUNT_PREFIX, '');
  if (count <= 0) return base;
  return `(${count > 99 ? '99+' : count}) ${base}`;
}
