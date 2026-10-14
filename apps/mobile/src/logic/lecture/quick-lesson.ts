import {
  LECTURE_DECK_VERSION,
  LECTURE_MAX_BLOCKS,
  LECTURE_TITLE_RE,
  LectureDeckSchema,
  type LectureBlock,
  type LectureDeck,
  type UiLocale,
} from '@hangul-route/content-schema';

/**
 * Quick lesson on the presenter home (F-TCH-004 §3.12, design `home.md`): a
 * grouped list from the bundle, multi-select, and [ Build lesson ] -> a deck
 * with `source: 'quick'`, a time seed and a numbers picker. Pure: the content
 * comes in as a `QuickSource` (`quick-source.ts` reads the bundle), so a group
 * appears only when the bundle has items for it (stories with PR 11, word
 * topics with PR 12). No name can be entered here; the deck has no field for one.
 */

/** A deck holds at most 30 blocks; a letter set over 12 letters costs more than one. */
export const QUICK_MAX_BLOCKS = LECTURE_MAX_BLOCKS;
/** `jamo-set` holds at most 12 letters (`LectureBlockSchema`). */
const JAMO_SET_MAX = 12;
const TITLE_MAX = 60;
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DECK_ID_LENGTH = 10;
const QUICK_PICKER = { mode: 'numbers', count: 12 } as const;

export type QuickGroupId = 'episodes' | 'lessons' | 'letterSets' | 'topics' | 'stories';

export type QuickDetail = { kind: 'minutes'; n: number } | { kind: 'letters'; n: number };

export interface QuickItem {
  /** The content id, or `letters:consonants` / `letters:vowels`. */
  key: string;
  group: QuickGroupId;
  title: string;
  detail: QuickDetail;
  blocks: readonly LectureBlock[];
}

export interface QuickGroup {
  id: QuickGroupId;
  items: readonly QuickItem[];
}

interface Titled {
  id: string;
  title: string;
  minutes: number;
}

export interface QuickSource {
  /** Shipped grid episodes, in content order. */
  episodes: readonly (Titled & { questIds: readonly string[] })[];
  /** Quests by id; a lesson is listed when a listed episode holds it. */
  quests: readonly Titled[];
  consonants: readonly string[];
  vowels: readonly string[];
  topics?: readonly Titled[];
  stories?: readonly Titled[];
}

export interface QuickLabels {
  consonants: string;
  vowels: string;
}

/** Splits letters into the fewest even `jamo-set` blocks of at most 12. */
function jamoBlocks(ids: readonly string[]): LectureBlock[] {
  const parts = Math.ceil(ids.length / JAMO_SET_MAX);
  const size = Math.ceil(ids.length / parts);
  const blocks: LectureBlock[] = [];
  for (let i = 0; i < ids.length; i += size) blocks.push({ kind: 'jamo-set', jamoIds: ids.slice(i, i + size) });
  return blocks;
}

const minutes = (n: number): QuickDetail => ({ kind: 'minutes', n });

export function quickGroups(source: QuickSource, labels: QuickLabels): QuickGroup[] {
  const questsById = new Map(source.quests.map((q) => [q.id, q]));
  const lessons = source.episodes.flatMap((e) =>
    e.questIds.flatMap((id) => {
      const quest = questsById.get(id);
      return quest ? [quest] : [];
    }),
  );
  const letterSets: QuickItem[] = [];
  if (source.consonants.length > 0) {
    letterSets.push({
      key: 'letters:consonants',
      group: 'letterSets',
      title: labels.consonants,
      detail: { kind: 'letters', n: source.consonants.length },
      blocks: jamoBlocks(source.consonants),
    });
  }
  if (source.vowels.length > 0) {
    letterSets.push({
      key: 'letters:vowels',
      group: 'letterSets',
      title: labels.vowels,
      detail: { kind: 'letters', n: source.vowels.length },
      blocks: jamoBlocks(source.vowels),
    });
  }
  const groups: QuickGroup[] = [
    {
      id: 'episodes',
      items: source.episodes.map((e) => ({ key: e.id, group: 'episodes', title: e.title, detail: minutes(e.minutes), blocks: [{ kind: 'episode', id: e.id }] })),
    },
    {
      id: 'lessons',
      items: lessons.map((q) => ({ key: q.id, group: 'lessons', title: q.title, detail: minutes(q.minutes), blocks: [{ kind: 'quest', id: q.id }] })),
    },
    { id: 'letterSets', items: letterSets },
    {
      id: 'topics',
      items: (source.topics ?? []).map((t) => ({ key: t.id, group: 'topics', title: t.title, detail: minutes(t.minutes), blocks: [{ kind: 'vocab', topicId: t.id }] })),
    },
    {
      id: 'stories',
      items: (source.stories ?? []).map((s) => ({
        key: s.id,
        group: 'stories',
        title: s.title,
        detail: minutes(s.minutes),
        blocks: [{ kind: 'story', storyId: s.id, checks: true }],
      })),
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export function chosenBlockCount(chosen: readonly string[], items: readonly QuickItem[]): number {
  return chosen.reduce((sum, key) => sum + (items.find((i) => i.key === key)?.blocks.length ?? 0), 0);
}

/** True when the item is chosen (it can always be unticked) or still fits under the 30-block cap. */
export function canChoose(chosen: readonly string[], key: string, items: readonly QuickItem[]): boolean {
  const item = items.find((i) => i.key === key);
  if (!item) return false;
  if (chosen.includes(key)) return true;
  return chosenBlockCount(chosen, items) + item.blocks.length <= QUICK_MAX_BLOCKS;
}

/**
 * The lesson is full when some unchosen item no longer fits: a 2-block letter set can be out of
 * reach before 30 blocks, so the status line explains every disabled row (design home.md).
 */
export function quickFull(chosen: readonly string[], items: readonly QuickItem[]): boolean {
  return items.some((i) => !chosen.includes(i.key) && !canChoose(chosen, i.key, items));
}

export function toggleChoice(chosen: readonly string[], key: string, items: readonly QuickItem[]): readonly string[] {
  if (chosen.includes(key)) return chosen.filter((k) => k !== key);
  return canChoose(chosen, key, items) ? [...chosen, key] : chosen;
}

/** A content title reduced to the deck title class (TD8): other characters dropped, spaces collapsed. */
function cleanTitle(title: string): string {
  return [...title]
    .filter((ch) => LECTURE_TITLE_RE.test(ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cuts at the last space at or before the limit; '' when one word is longer. */
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const space = text.lastIndexOf(' ', max);
  return space > 0 ? text.slice(0, space).trim() : '';
}

/**
 * The chosen titles joined by " / " while they fit in 60 characters (the
 * titles are bundle content, so the deck needs no typing); `fallback` (the
 * localised "Quick lesson") when nothing usable is left.
 */
export function quickDeckTitle(titles: readonly string[], fallback: string): string {
  const parts = titles.map(cleanTitle).filter((t) => t.length > 0);
  let title = '';
  for (const part of parts) {
    const next = title === '' ? part : `${title} / ${part}`;
    if (next.length > TITLE_MAX) break;
    title = next;
  }
  if (title === '' && parts.length > 0) title = cutAtWord(parts[0]!, TITLE_MAX);
  return title === '' ? fallback : title;
}

export interface QuickDeckInput {
  now: Date;
  /** Uniform in [0, 1): the deck id. */
  rng: () => number;
  fallbackTitle: string;
  /** The session language chip, so the start screen opens in it. */
  uiLocale?: UiLocale;
}

/** The deck for the chosen items in the order chosen; null with nothing (or too much) chosen. */
export function buildQuickDeck(chosen: readonly string[], items: readonly QuickItem[], input: QuickDeckInput): LectureDeck | null {
  const picked = chosen.flatMap((key) => items.filter((i) => i.key === key));
  const blocks = picked.flatMap((i) => i.blocks);
  if (blocks.length === 0 || blocks.length > QUICK_MAX_BLOCKS) return null;
  let id = 'lecture:';
  for (let i = 0; i < DECK_ID_LENGTH; i += 1) id += ID_CHARS[Math.floor(input.rng() * ID_CHARS.length)];
  const parsed = LectureDeckSchema.safeParse({
    v: LECTURE_DECK_VERSION,
    id,
    title: quickDeckTitle(
      picked.map((i) => i.title),
      input.fallbackTitle,
    ),
    createdAt: input.now.toISOString(),
    seed: input.now.getTime() % 2 ** 31,
    blocks,
    options: input.uiLocale ? { uiLocale: input.uiLocale } : {},
    picker: QUICK_PICKER,
    source: 'quick',
  });
  return parsed.success ? parsed.data : null;
}
