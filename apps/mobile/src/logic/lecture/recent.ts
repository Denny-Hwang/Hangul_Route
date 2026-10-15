import { LECTURE_CREATED_AT_RE, LECTURE_DECK_VERSIONS, LectureDeckSchema, type LectureDeck } from '@hangul-route/content-schema';
import { z } from 'zod';

/**
 * Recent lessons on this device (F-TCH-004 §3.12): up to 10 decks under
 * `lecture:recent`, newest first, with the slide that was open so a reload
 * mid-lesson resumes there. A deck is ids, a seed and options; it has no name
 * field, and every object here is strict, so a picker label cannot be saved
 * (D12, §3.9). Corrupt storage reads as an empty list.
 *
 * An item saved by a newer build (a deck version this build does not read,
 * AMENDMENTS-LECTURE-V2 section 4.5) is not shown but is kept, unchanged and in
 * its place, in the list this build writes back, so opening an older cached
 * presenter never erases it.
 *
 * Pure list operations plus a load / save over an injected store (the
 * presenter passes `platform/storage`).
 */

export const RECENT_KEY = 'lecture:recent';
export const RECENT_MAX = 10;

const SavedAtSchema = z.string().max(40).regex(LECTURE_CREATED_AT_RE);
/** A slide key (`<blockKey>/<path>`): content ids only. */
const SlideKeySchema = z.string().min(1).max(256);

const RecentItemSchema = z
  .object({
    deck: LectureDeckSchema,
    savedAt: SavedAtSchema,
    lastSlideKey: SlideKeySchema.optional(),
  })
  .strict();

const RecentListShape = z.object({ v: z.literal(1), items: z.array(z.unknown()) }).strict();

export type RecentItem = z.infer<typeof RecentItemSchema>;

/** An item this build cannot read, kept as stored at its place in the stored list (`at`, 0-based). */
export interface UnreadRecentItem {
  at: number;
  raw: unknown;
}

export interface RecentList {
  v: 1;
  /** The items shown, newest first. */
  items: RecentItem[];
  /** Items from a newer build, written back unchanged; absent when there are none. */
  unread?: UnreadRecentItem[];
}

export interface RecentStore {
  readJson(key: string): Promise<unknown>;
  writeJson(key: string, value: unknown): Promise<void>;
}

export function emptyRecent(): RecentList {
  return { v: 1, items: [] };
}

/** A valid item; one whose only fault is its slide key is kept without it (it reopens at the start). */
function parseItem(candidate: unknown): RecentItem | undefined {
  const item = RecentItemSchema.safeParse(candidate);
  if (item.success) return item.data;
  if (typeof candidate !== 'object' || candidate === null || !('lastSlideKey' in candidate)) return undefined;
  const { lastSlideKey: _dropped, ...rest } = candidate as Record<string, unknown>;
  const retry = RecentItemSchema.safeParse(rest);
  return retry.success ? retry.data : undefined;
}

/** The deck versions this build reads; an item whose deck has a higher one comes from a newer build. */
const KNOWN_DECK_VERSIONS: readonly number[] = LECTURE_DECK_VERSIONS;
/** A kept item never holds more than a deck link's worth of text (the codec's limit is 8192). */
const UNREAD_MAX_CHARS = 12_000;

/**
 * An item saved by a newer build: an object whose deck carries an integer version above every
 * one this build reads, small enough to be a deck. Anything else that does not parse is corrupt
 * and dropped, as before.
 */
function fromNewerBuild(candidate: unknown): boolean {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return false;
  const deck = (candidate as { deck?: unknown }).deck;
  if (typeof deck !== 'object' || deck === null) return false;
  const v = (deck as { v?: unknown }).v;
  if (typeof v !== 'number' || !Number.isInteger(v) || KNOWN_DECK_VERSIONS.some((known) => v <= known)) return false;
  return JSON.stringify(candidate).length <= UNREAD_MAX_CHARS;
}

type Entry = { item: RecentItem } | { raw: unknown };

/** The deck id of an entry, where readable (a kept item's `deck.id` when it is a string). */
function idOf(entry: Entry): string | undefined {
  if ('item' in entry) return entry.item.deck.id;
  const id = (entry.raw as { deck: { id?: unknown } }).deck.id;
  return typeof id === 'string' ? id : undefined;
}

/** The stored order: shown items and kept items merged back at their places. */
function entriesOf(list: RecentList): Entry[] {
  const out: Entry[] = list.items.map((item) => ({ item }));
  for (const u of [...(list.unread ?? [])].sort((a, b) => a.at - b.at)) out.splice(Math.min(u.at, out.length), 0, { raw: u.raw });
  return out;
}

/** At most 10 entries by place; the kept items' places are recorded again. */
function listOf(entries: readonly Entry[]): RecentList {
  const items: RecentItem[] = [];
  const unread: UnreadRecentItem[] = [];
  entries.slice(0, RECENT_MAX).forEach((entry, at) => {
    if ('item' in entry) items.push(entry.item);
    else unread.push({ at, raw: entry.raw });
  });
  return unread.length > 0 ? { v: 1, items, unread } : { v: 1, items };
}

/** Keeps the valid items and a newer build's items, the first of each readable deck id, at most 10 by place. */
export function parseRecent(raw: unknown): RecentList {
  const list = RecentListShape.safeParse(raw);
  if (!list.success) return emptyRecent();
  const entries: Entry[] = [];
  for (const candidate of list.data.items) {
    const item = parseItem(candidate);
    const entry: Entry | undefined = item ? { item } : fromNewerBuild(candidate) ? { raw: candidate } : undefined;
    if (!entry) continue;
    const id = idOf(entry);
    if (id !== undefined && entries.some((e) => idOf(e) === id)) continue;
    entries.push(entry);
    if (entries.length === RECENT_MAX) break;
  }
  return listOf(entries);
}

/** What `saveRecent` stores: the shown and the kept items in their stored order. */
export function storedRecent(list: RecentList): { v: 1; items: unknown[] } {
  return { v: 1, items: entriesOf(list).map((e) => ('item' in e ? e.item : e.raw)) };
}

/**
 * Saves a deck at the front (Start / Start over), with no open slide yet.
 * `savedAt` is `new Date().toISOString()`; any other string would make the
 * item unreadable on the next load, so the list is returned unchanged.
 */
export function rememberDeck(list: RecentList, deck: LectureDeck, savedAt: string): RecentList {
  if (!SavedAtSchema.safeParse(savedAt).success) return list;
  // The same deck id saved by a newer build is this lesson too: the Start just made replaces it.
  const rest = entriesOf(list).filter((e) => idOf(e) !== deck.id);
  return listOf([{ item: { deck, savedAt } }, ...rest]);
}

/** Records the open slide; a key outside 1-256 characters is ignored (the item stays readable). */
export function setLastSlide(list: RecentList, deckId: string, lastSlideKey: string): RecentList {
  if (!SlideKeySchema.safeParse(lastSlideKey).success || !list.items.some((i) => i.deck.id === deckId)) return list;
  return { ...list, items: list.items.map((i) => (i.deck.id === deckId ? { ...i, lastSlideKey } : i)) };
}

export function forgetDeck(list: RecentList, deckId: string): RecentList {
  return listOf(entriesOf(list).filter((e) => idOf(e) !== deckId));
}

/**
 * Recent as read, and whether a change may be saved over it: a read that failed, or stored data
 * that is not a Recent list, shows as empty but is never written over (only Start writes), so a
 * passing storage fault cannot replace the teacher's list with one deck.
 */
export interface LoadedRecent {
  list: RecentList;
  writable: boolean;
  /** The read failed (storage blocked or broken): the home shows its storage-off line (design home.md). */
  off?: true;
}

/** `store.readJson` must throw on a failed read (the strict storage read), not answer null. */
export async function readRecent(store: RecentStore): Promise<LoadedRecent> {
  try {
    const raw = await store.readJson(RECENT_KEY);
    if (raw === null || raw === undefined) return { list: emptyRecent(), writable: true };
    return { list: parseRecent(raw), writable: RecentListShape.safeParse(raw).success };
  } catch {
    return { list: emptyRecent(), writable: false, off: true };
  }
}

export async function loadRecent(store: RecentStore): Promise<RecentList> {
  return (await readRecent(store)).list;
}

/** Applies `change`; saves only a real change to a list that may be written. */
export async function commitRecent(store: RecentStore, loaded: LoadedRecent, change: (list: RecentList) => RecentList): Promise<LoadedRecent> {
  const next = change(loaded.list);
  if (next !== loaded.list && loaded.writable) await saveRecent(store, next);
  return { ...loaded, list: next };
}

/** False when the write failed (a full or blocked store); the lesson goes on either way. */
export async function saveRecent(store: RecentStore, list: RecentList): Promise<boolean> {
  try {
    await store.writeJson(RECENT_KEY, storedRecent(list));
    return true;
  } catch {
    return false;
  }
}
