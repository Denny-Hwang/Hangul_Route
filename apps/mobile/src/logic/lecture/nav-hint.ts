import type { Slide } from './deck-builder';
import type { NavLayout } from './stage-scale';

/**
 * The start hint (AMENDMENTS-PRESENTER-NAV section 9.3, owner choice O7): on a touch device, one line
 * at the top of the stage on the first slide of a lesson says how to move ("Swipe, or tap Previous and
 * Next."). It shows on each lesson until the device's first step by a bar or rail button or a swipe,
 * and on at most three lessons. Pure, over an injected store (the presenter passes `platform/storage`,
 * the IndexedDB wrapper on the web; never `localStorage`).
 *
 * The record under `lecture:navHint` is the number of lessons it was shown on (`'1'` to `'3'`) or
 * `'done'`; nothing else is stored. A store that cannot be read or written (private mode, blocked
 * site data) shows the hint on each lesson and never raises an error.
 */

export const NAV_HINT_KEY = 'lecture:navHint';
/** The hint shows on at most this many lessons. */
export const NAV_HINT_MAX_LESSONS = 3;
/** How long a read may take before it counts as storage off (the hint then shows, as with a blocked store). */
export const NAV_HINT_READ_BOUND_MS = 1500;

export type NavHintRecord = '1' | '2' | '3' | 'done';

export interface NavHintStore {
  readJson(key: string): Promise<unknown>;
  writeJson(key: string, value: unknown): Promise<void>;
}

const RECORDS: readonly NavHintRecord[] = ['1', '2', '3', 'done'];

/** A stored value read: one of the four records, or null (nothing stored, or anything else). */
export function parseNavHint(raw: unknown): NavHintRecord | null {
  return typeof raw === 'string' && (RECORDS as readonly string[]).includes(raw) ? (raw as NavHintRecord) : null;
}

/** Whether a lesson still shows the hint: never after a button or swipe step, and on at most three lessons. */
export function navHintDue(record: NavHintRecord | null): boolean {
  return record === null || Number(record) < NAV_HINT_MAX_LESSONS;
}

/** The record after one more lesson showed the hint. */
export function navHintAfterShow(record: NavHintRecord | null): NavHintRecord {
  if (record === 'done') return 'done';
  return String(Math.min(NAV_HINT_MAX_LESSONS, (record === null ? 0 : Number(record)) + 1)) as NavHintRecord;
}

/**
 * Whether this lesson's start may show the hint at all: touch seen (never on a mouse-only window), the
 * lesson opens on its first slide (not a resume), and that slide is a title slide, whose content sits
 * below the pill, so the hint covers no content target and no prompt (PN-0b "Start hint"). A deck that
 * opens on another slide (a warm-up's letters, a word review's cards) shows no hint and counts no lesson.
 */
export function navHintStarts(input: { touchSeen: boolean; slideIdx: number; first: Pick<Slide, 'kind'> | undefined }): boolean {
  return input.touchSeen && input.slideIdx === 0 && input.first?.kind === 'title';
}

/** The line the hint says: the overlay layout has no Previous and Next on screen until a tap shows its bar. */
export function navHintKey(layout: NavLayout): 'hint' | 'hintOverlay' {
  return layout === 'overlay' ? 'hintOverlay' : 'hint';
}

function bounded<T>(read: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    read.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/**
 * At the start of a lesson that may show the hint: reads the record and, when the hint is due, counts
 * this lesson (a failed write is ignored). Resolves to whether the hint shows; a failed, blocked or
 * slow read (`boundMs`) shows it.
 */
export async function claimNavHint(store: NavHintStore, boundMs: number = NAV_HINT_READ_BOUND_MS): Promise<boolean> {
  const read = (async () => parseNavHint(await store.readJson(NAV_HINT_KEY)))();
  const record = await bounded<NavHintRecord | null>(read, boundMs, null);
  if (!navHintDue(record)) return false;
  try {
    await store.writeJson(NAV_HINT_KEY, navHintAfterShow(record));
  } catch {
    // A blocked store shows the hint on each lesson.
  }
  return true;
}

/** The device's first bar or rail button step, or swipe step: the hint never shows again. A failed write is ignored. */
export async function finishNavHint(store: NavHintStore): Promise<void> {
  try {
    await store.writeJson(NAV_HINT_KEY, 'done');
  } catch {
    // A blocked store shows the hint on each lesson.
  }
}
