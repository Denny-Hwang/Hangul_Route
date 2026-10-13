import { localize, type Overlays, type RuntimeVocabItem, type UiLocale, type VocabProgress, type VocabTopic } from '@hangul-route/content-schema';
import { romanizationShown, type RomanizationMode } from '@hangul-route/i18n';
import { localizedGloss } from './catalog';
import { speedActivityLine, type VocabCopy } from './copy';
import { chunkSize, chunksFor } from './flashcards';
import { MATCH_MIN_COLLECTED, type VocabActivity } from './suggest';
import { topicState } from './topics';
import { wallTiles } from './wall';

/**
 * View models of the Words screens — F-VOC-003 C-4: the topic tile (the
 * picker and the Library Words section), the topic page (meter, activities)
 * and the word wall. Pure; the screens only paint what these return
 * (`design/screens/vocab/topics.md`, `topic.md`). Counts only, never "n of m"
 * or a percentage (D3).
 */

/** The topic's title and Hoya line in the UI language (its `vocab-topic:<key>` overlay), else English. Taught Korean never changes. */
export function localizedTopic(topic: VocabTopic, locale: UiLocale, overlays?: Overlays): VocabTopic {
  return localize(topic, topic.id, locale, overlays);
}

/** Topic grid columns by window width (section 3.3): 1 below 360 dp, 2 up to 767, 3 from 768. An unknown width is one column. */
export function topicGridColumns(windowWidth: number): 1 | 2 | 3 {
  if (!Number.isFinite(windowWidth) || windowWidth < 360) return 1;
  return windowWidth < 768 ? 2 : 3;
}

export interface TopicTileInput {
  /** In the UI language already (`localizedTopic`). */
  topic: VocabTopic;
  /** The topic's words (`wordsOfTopic` of the visible words). */
  items: readonly RuntimeVocabItem[];
  progress: VocabProgress;
  locale: UiLocale;
  romanizationMode: RomanizationMode;
  /** `isContentLocked` for this topic (always false while gating is off, D5). */
  locked: boolean;
  copy: VocabCopy;
}

export interface TopicTileView {
  key: string;
  title: string;
  ko: string;
  romanization: string;
  /** Reading practice hides it: the tile is one button, so there is no reveal on the tile. */
  romanizationShown: boolean;
  /** The cover item's picture; its gloss is the picture's text fallback. */
  cover: { pictureRef: string | undefined; gloss: string };
  tint: VocabTopic['tint'];
  total: number;
  collected: number;
  /** "5 collected": a plain count; "Not open yet" on a locked tile (gating on only). */
  countLine: string;
  /** "Food. 5 words collected."; "Food. Not open yet." on a locked tile. */
  accessibilityLabel: string;
  locked: boolean;
}

export function topicTileView(i: TopicTileInput): TopicTileView {
  const counts = topicState(
    i.topic.key,
    i.items.map((item) => item.id),
    i.progress,
  );
  const coverItem = i.items.find((item) => item.id === i.topic.coverItemId) ?? i.items[0];
  return {
    key: i.topic.key,
    title: i.topic.titleEn,
    ko: i.topic.titleKo.ko,
    romanization: i.topic.titleKo.romanization,
    romanizationShown: romanizationShown(i.romanizationMode, false),
    cover: coverItem
      ? { pictureRef: coverItem.visual, gloss: localizedGloss(coverItem, i.locale) }
      : { pictureRef: undefined, gloss: i.topic.titleEn },
    tint: i.topic.tint,
    total: counts.total,
    collected: counts.collected,
    // A locked tile (gating on only, D5) says "Not open yet" (F-ENT-003 OD-6) and nothing else about progress.
    countLine: i.locked ? i.copy.topics.locked : i.copy.topics.collected(counts.collected),
    accessibilityLabel: i.locked ? i.copy.topics.lockedA11y(i.topic.titleEn) : i.copy.topics.tileA11y(i.topic.titleEn, counts.collected),
    locked: i.locked,
  };
}

/** Distinct collected words across the topics (a word filed under two topics counts once): the Library Words count. */
export function wordsCollected(
  topics: readonly VocabTopic[],
  itemsOf: (topicKey: string) => readonly RuntimeVocabItem[],
  progress: VocabProgress,
): number {
  const known = new Set(progress.items.map((s) => s.id));
  const ids = new Set(topics.flatMap((t) => itemsOf(t.key).map((item) => item.id)));
  let n = 0;
  for (const id of ids) if (known.has(id)) n += 1;
  return n;
}

/**
 * The topic page meter (section 3.4): a row of dots when `total` dots of `dot`
 * dp with `gap` between them fit `width`, otherwise the bar (a longer topic,
 * a narrow window). Either one is hidden from assistive technology; the count
 * is text.
 */
export function meterVariant(total: number, width: number, dot: number, gap: number): 'dots' | 'bar' {
  if (total <= 0) return 'bar';
  return total * dot + (total - 1) * gap <= width ? 'dots' : 'bar';
}

/** Options per question at the learner's level (F-VOC-004 section 3.2): 3 for Pictures first, else 4. */
export function optionCountFor(levelOrder: 0 | 1 | 2 | null): 3 | 4 {
  return levelOrder === 0 ? 3 : 4;
}

/**
 * The smallest word wall tile, in dp at 1x text: the `KoreanText` `sm` chip of
 * a three-syllable word (about 109 dp) and its romanization at `bodySm`
 * ("geomeunsaek", about 104 dp), plus the tile's chrome. Measured, see
 * `design/screens/vocab/topic.md`.
 */
export const WALL_TILE_MIN = 120;
export const WALL_MAX_COLUMNS = 4;
/** The largest font scale the minimum follows (200 % text). */
const WALL_MAX_SCALE = 2;

/**
 * Word wall columns: as many `WALL_TILE_MIN` tiles as fit the measured grid
 * width, 1 to 4, so every word and its romanization stay whole. At large text
 * the minimum grows with the font scale (up to 2x) and the grid drops columns.
 */
export function wallColumns(gridWidth: number, gap: number, fontScale = 1): number {
  if (!Number.isFinite(gridWidth) || gridWidth <= 0) return 1;
  const scale = Number.isFinite(fontScale) ? Math.min(Math.max(fontScale, 1), WALL_MAX_SCALE) : 1;
  const columns = Math.floor((gridWidth + gap) / (WALL_TILE_MIN * scale + gap));
  return Math.max(1, Math.min(WALL_MAX_COLUMNS, columns));
}

/** Picture side on a wall tile (section 3.4: `PictureArt` at 64-96). */
export const WALL_ART = { min: 64, max: 96 } as const;

/** The tile's inner width (less its padding and border), kept between 64 and 96 dp. */
export function wallArtSize(tileWidth: number, chrome: number): number {
  return Math.min(WALL_ART.max, Math.max(WALL_ART.min, Math.floor(tileWidth - chrome)));
}

export type WallTileView =
  | {
      id: string;
      state: 'collected';
      ko: string;
      romanization: string;
      romanizationShown: boolean;
      pictureRef: string;
      /** The meaning in the UI language: the picture's text fallback and part of the name. */
      gloss: string;
      /** "Korean: <word>, <romanization>, <meaning>", e.g. the word for apple, "sagwa", "apple". */
      accessibilityLabel: string;
    }
  | {
      id: string;
      state: 'new';
      /** Drawn as a silhouette (`PictureArt mono`); no Korean and no meaning (no spoilers). */
      pictureRef: string;
      /** "Not collected yet". */
      accessibilityLabel: string;
    };

export interface WallContext {
  locale: UiLocale;
  romanizationMode: RomanizationMode;
  copy: VocabCopy;
  /** `m.a11y.koreanItem`. */
  koreanItem: (item: { ko: string; romanization: string; gloss?: string }) => string;
  /** The topic page's Show sound was tapped (reading practice): the wall's romanization shows too. */
  revealed?: boolean;
}

/**
 * The word wall's tiles in the order given (file order, never re-sorted by
 * progress). Romanization follows the learner's setting; in reading practice
 * the page's Show sound reveals it on the wall as on the title (`revealed`).
 */
export function wallTileViews(items: readonly RuntimeVocabItem[], progress: VocabProgress, ctx: WallContext): WallTileView[] {
  const shown = romanizationShown(ctx.romanizationMode, ctx.revealed ?? false);
  return wallTiles(items, progress).map((tile, index) => {
    const item = items[index]!; // wallTiles maps `items` one to one
    if (tile.state === 'new') {
      return { id: item.id, state: 'new', pictureRef: item.visual, accessibilityLabel: ctx.copy.topic.wallNew };
    }
    const gloss = localizedGloss(item, ctx.locale);
    return {
      id: item.id,
      state: 'collected',
      ko: item.ko,
      romanization: item.romanization,
      romanizationShown: shown,
      pictureRef: item.visual,
      gloss,
      accessibilityLabel: ctx.koreanItem({ ko: item.ko, romanization: item.romanization, gloss }),
    };
  });
}

/**
 * A topic's words a learner may meet, in file order (the word wall's order,
 * section 3.4): every word of `visible` filed under the topic, also as its
 * second topic. Pass the catalogue's `visibleItems`, so a word whose own
 * topic is still a draft never reaches a learner through another topic (V12).
 * The flashcards sort by level themselves (`chunksFor`).
 */
export function wordsOfTopic<T extends Pick<RuntimeVocabItem, 'topics'>>(visible: readonly T[], topicKey: string): T[] {
  return visible.filter((item) => (item.topics as readonly string[]).includes(topicKey));
}

export interface ActivityInput {
  /** Collected words of the topic. */
  collected: number;
  /** `suggestActivity`. */
  suggestion: VocabActivity;
  /** The level's options per question (`optionCountFor`). */
  optionCount: 3 | 4;
  /** F-QUEST-002's Pic-Word Match is in the build (`capabilities.picWordMatch`). */
  picWordMatch: boolean;
  /** The collected words deal a Match board (`matchPlayable`): words that cannot share one board draw no Match. */
  matchPlayable: boolean;
  /** The activity screens this build has (`VOCAB_SCREENS`): an activity without its screen is not drawn. */
  screens: Readonly<Record<VocabActivity, boolean>>;
  copy: VocabCopy;
}

export interface ActivityButtonView {
  kind: VocabActivity;
  label: string;
  line: string;
  /** The one primary button: the suggestion, or the first button drawn when the suggestion is not. */
  primary: boolean;
  /** Where the button goes: the Speed round below the option count opens Learn (never a dead end). */
  opens: VocabActivity;
}

/**
 * The topic page's activity buttons (T7), in the order Learn, Speed round,
 * Match. A button is drawn only when the screen it opens is in the build, so
 * no button goes nowhere; Match is drawn only once it is available (it has no
 * "learn first" line of its own).
 */
export function topicActivities(i: ActivityInput): ActivityButtonView[] {
  const t = i.copy.topic;
  const speedReady = i.collected >= i.optionCount;
  const drafts: Omit<ActivityButtonView, 'primary'>[] = [];
  if (i.screens.learn) drafts.push({ kind: 'learn', label: t.learn.label, line: t.learn.line, opens: 'learn' });
  const speedOpens: VocabActivity = speedReady ? 'speed' : 'learn';
  if (i.screens.speed && i.screens[speedOpens]) {
    drafts.push({ kind: 'speed', label: t.speed.label, line: speedActivityLine(i.copy, i.collected, i.optionCount), opens: speedOpens });
  }
  if (i.screens.match && i.picWordMatch && i.collected >= MATCH_MIN_COLLECTED && i.matchPlayable) {
    drafts.push({ kind: 'match', label: t.match.label, line: t.match.line, opens: 'match' });
  }
  const primary = drafts.some((d) => d.kind === i.suggestion) ? i.suggestion : drafts[0]?.kind;
  return drafts.map((d) => ({ ...d, primary: d.kind === primary }));
}

export interface CardsTarget {
  topicKey: string;
  /** 0-based chunk at the learner's chunk size. */
  chunk: number;
  /** The run starts at this word (back face). */
  startId: string;
}

/** Where a collected wall tile goes (section 3.4): the chunk that holds the word, starting at it; null for a word not in the topic. */
export function cardsTarget(
  topic: Pick<VocabTopic, 'key' | 'fixedOrder'>,
  items: readonly RuntimeVocabItem[],
  levelOrder: 0 | 1 | 2 | null,
  id: string,
): CardsTarget | null {
  const chunks = chunksFor(items, chunkSize(levelOrder), topic.fixedOrder);
  const chunk = chunks.findIndex((c) => c.some((item) => item.id === id));
  return chunk < 0 ? null : { topicKey: topic.key, chunk, startId: id };
}

export type TopicOpenSource = 'library' | 'home' | 'plan' | 'results';

/** `vocab.topic_opened` (section 3.7): the topic and where it was opened from; no name, no free text. */
export function topicOpenedEvent(
  topicKey: string,
  source: TopicOpenSource,
): { name: 'vocab.topic_opened'; payload: { topicKey: string; source: TopicOpenSource } } {
  return { name: 'vocab.topic_opened', payload: { topicKey, source } };
}

export interface IntroMemory {
  /** Hoya has not said this topic's line to this learner in this session yet. */
  due(profileId: string, topicKey: string): boolean;
  mark(profileId: string, topicKey: string): void;
}

/**
 * Hoya's topic line once per topic per session (section 3.4): one memory per
 * app session, kept per learner so each profile on a shared device hears it.
 */
export function createIntroMemory(): IntroMemory {
  const said = new Map<string, Set<string>>();
  return {
    due: (profileId, topicKey) => !(said.get(profileId)?.has(topicKey) ?? false),
    mark: (profileId, topicKey) => {
      const topics = said.get(profileId) ?? new Set<string>();
      topics.add(topicKey);
      said.set(profileId, topics);
    },
  };
}

/**
 * What the topic page does with its key (T8, F-STORY-004 section 3.9): a key
 * the picker does not show is "Topic not found"; a locked topic (gating on
 * only, never at launch, D5) goes through the grown-up gate, so every entry
 * point (the grid, Home, a plan, Browse) is held to the same lock.
 */
export function topicPageAccess(i: { found: boolean; locked: boolean }): 'open' | 'not-found' | 'locked' {
  if (!i.found) return 'not-found';
  return i.locked ? 'locked' : 'open';
}
