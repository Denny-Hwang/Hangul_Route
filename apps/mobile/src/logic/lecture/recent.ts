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

const RecentItemSchema = z
  .object({
    deck: LectureDeckSchema,
    savedAt: z.string().max(40).regex(LECTURE_CREATED_AT_RE),
    /** A slide key (`<blockKey>/<path>`): content ids only. */
    lastSlideKey: z.string().min(1).max(256).optional(),
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

/** Keeps the valid items, the first of each deck id, at most 10. */
export function parseRecent(raw: unknown): RecentList {
  const list = RecentListShape.safeParse(raw);
  if (!list.success) return emptyRecent();
  const items: RecentItem[] = [];
  for (const candidate of list.data.items) {
    const item = RecentItemSchema.safeParse(candidate);
    if (!item.success || items.some((i) => i.deck.id === item.data.deck.id)) continue;
    items.push(item.data);
    if (items.length === RECENT_MAX) break;
  }
  return { v: 1, items };
}

/** Saves a deck at the front (Start / Start over), with no open slide yet. */
export function rememberDeck(list: RecentList, deck: LectureDeck, savedAt: string): RecentList {
  const rest = list.items.filter((i) => i.deck.id !== deck.id);
  return { v: 1, items: [{ deck, savedAt }, ...rest].slice(0, RECENT_MAX) };
}

export function setLastSlide(list: RecentList, deckId: string, lastSlideKey: string): RecentList {
  if (!list.items.some((i) => i.deck.id === deckId)) return list;
  return { v: 1, items: list.items.map((i) => (i.deck.id === deckId ? { ...i, lastSlideKey } : i)) };
}

export function forgetDeck(list: RecentList, deckId: string): RecentList {
  return { v: 1, items: list.items.filter((i) => i.deck.id !== deckId) };
}

export async function loadRecent(store: RecentStore): Promise<RecentList> {
  try {
    return parseRecent(await store.readJson(RECENT_KEY));
  } catch {
    return emptyRecent();
  }
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
