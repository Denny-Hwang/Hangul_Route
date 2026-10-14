import { LECTURE_CREATED_AT_RE, LectureDeckSchema, type LectureDeck } from '@hangul-route/content-schema';
import { z } from 'zod';

/**
 * Recent lessons on this device (F-TCH-004 §3.12): up to 10 decks under
 * `lecture:recent`, newest first, with the slide that was open so a reload
 * mid-lesson resumes there. A deck is ids, a seed and options; it has no name
 * field, and every object here is strict, so a picker label cannot be saved
 * (D12, §3.9). Corrupt storage reads as an empty list.
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

export interface RecentList {
  v: 1;
  items: RecentItem[];
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

/** Keeps the valid items, the first of each deck id, at most 10. */
export function parseRecent(raw: unknown): RecentList {
  const list = RecentListShape.safeParse(raw);
  if (!list.success) return emptyRecent();
  const items: RecentItem[] = [];
  for (const candidate of list.data.items) {
    const item = parseItem(candidate);
    if (!item || items.some((i) => i.deck.id === item.deck.id)) continue;
    items.push(item);
    if (items.length === RECENT_MAX) break;
  }
  return { v: 1, items };
}

/**
 * Saves a deck at the front (Start / Start over), with no open slide yet.
 * `savedAt` is `new Date().toISOString()`; any other string would make the
 * item unreadable on the next load, so the list is returned unchanged.
 */
export function rememberDeck(list: RecentList, deck: LectureDeck, savedAt: string): RecentList {
  if (!SavedAtSchema.safeParse(savedAt).success) return list;
  const rest = list.items.filter((i) => i.deck.id !== deck.id);
  return { v: 1, items: [{ deck, savedAt }, ...rest].slice(0, RECENT_MAX) };
}

/** Records the open slide; a key outside 1-256 characters is ignored (the item stays readable). */
export function setLastSlide(list: RecentList, deckId: string, lastSlideKey: string): RecentList {
  if (!SlideKeySchema.safeParse(lastSlideKey).success || !list.items.some((i) => i.deck.id === deckId)) return list;
  return { v: 1, items: list.items.map((i) => (i.deck.id === deckId ? { ...i, lastSlideKey } : i)) };
}

export function forgetDeck(list: RecentList, deckId: string): RecentList {
  return { v: 1, items: list.items.filter((i) => i.deck.id !== deckId) };
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
    await store.writeJson(RECENT_KEY, list);
    return true;
  } catch {
    return false;
  }
}
