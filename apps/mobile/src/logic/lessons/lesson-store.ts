import type { Episode, EntityOverlay, OverlayLocale, Overlays, Quest, QuestStep, UiLocale } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';

/**
 * The upper-stage lesson content at runtime (F-CURR-002 §10, rows CM-5 and CM-40). The start bundle
 * holds only the manifest (`__generated__/lessons-index.ts`: episodes and quest headers in English,
 * ids, titles and minutes). Each cell's body (its quests' steps, its game scopes and their es / ko
 * glosses) is one content-hashed chunk, a cell's Volume 2 one of its own; the es / ko titles are one
 * chunk per locale, and the display lines (an episode's subtitle, Hoya intro and reward cards, a
 * quest's blurb and teaser) one "headers" chunk per locale, English included (row CM-40). All come
 * through injected loaders (the manifest's literal `import()`s), on demand, once each. The web build
 * makes every chunk its own precached bundle; the native build keeps them in its one bundle.
 *
 * "The titles" of a locale, as the first screen waits for them (`untilTitlesSettled`), are that
 * locale's lesson text outside the bodies: the English headers for every locale, and for es or ko
 * their title chunk and headers chunk too.
 *
 * Pure over the injected loaders, so the lazy path is testable without Metro
 * (`content/lessons.ts` binds the real ones). A loaded chunk is checked against the hash the
 * manifest names, so a shell never reads a chunk of another build.
 */

/** The display lines of a lesson episode (row CM-40): in the English headers chunk, not the manifest. */
export type LessonEpisodeLines = Pick<Episode, 'subtitleEn' | 'hoyaIntroEn' | 'rewardCardIds'>;
/** The display lines of a lesson quest (row CM-40): in the English headers chunk, not the manifest. */
export type LessonQuestLines = Pick<Quest, 'blurbEn' | 'teaserEn'>;
/** An episode of the manifest: everything but its display lines (`content/lessons.ts` lays them back in). */
export type LessonManifestEpisode = Omit<Episode, keyof LessonEpisodeLines>;
/** A quest of the manifest: everything but its steps (its cell's body chunk) and its display lines (the headers chunk). */
export type LessonQuestHeader = Omit<Quest, 'steps' | keyof LessonQuestLines>;

/** One locale's glosses by entity id. */
export type OverlayTable = Readonly<Record<string, EntityOverlay>>;

/**
 * A quest's Did you know? note (F-CURR-002 §5.7, row CM-3C): one note of its cell (`culture[]`, by id), its English
 * text with `{ko:}` tokens, and its source line, the first source's publisher and title (never a URL) and how many
 * other sources it has. The es / ko text is the cell's `culture.<id>.text` gloss on the episode id.
 */
export interface LessonQuestNote {
  id: string;
  textEn: string;
  citation: { title: string; publisher: string; more: number };
}

/** The module of a cell's body chunk (`lesson-chunks/lessons-cell-<stage>-<theme>.ts`). */
export interface LessonCellChunk {
  CHUNK_HASH: string;
  LESSON_STEPS: Readonly<Record<string, readonly QuestStep[]>>;
  LESSON_SCOPES: Readonly<Record<string, MinigameScope>>;
  LESSON_OVERLAYS: Overlays;
  /** Each quest's note by quest id (row CM-3C); none for a quest of a cell with no notes. */
  LESSON_NOTES: Readonly<Record<string, LessonQuestNote>>;
}

/** The module of a locale's title chunk (`lesson-chunks/lessons-titles-<locale>.ts`). */
export interface LessonTitleChunk {
  CHUNK_HASH: string;
  LESSON_TITLE_OVERLAYS: OverlayTable;
}

/**
 * The module of a locale's headers chunk (`lesson-chunks/lessons-headers-<locale>.ts`, row CM-40): English holds the
 * display lines by episode and quest id; es and ko hold their glosses (`subtitle`, `hoyaIntro`, `blurb`, `teaser`).
 */
export interface LessonHeaderChunk {
  CHUNK_HASH: string;
  LESSON_EPISODE_HEADERS: Readonly<Record<string, LessonEpisodeLines>>;
  LESSON_QUEST_HEADERS: Readonly<Record<string, LessonQuestLines>>;
  LESSON_HEADER_OVERLAYS: OverlayTable;
}

export interface LessonManifest {
  episodes: readonly { id: string; questIds: readonly string[] }[];
  /** Episode id -> the hash its body chunk carries. */
  cells: Readonly<Record<string, string>>;
  /** Overlay locale -> the hash its title chunk carries. */
  titles: Readonly<Record<OverlayLocale, string>>;
  /** UI locale -> the hash its headers chunk carries (row CM-40); a manifest without it has no display lines to wait for. */
  headers?: Readonly<Record<UiLocale, string>>;
}

export interface LessonLoaders {
  /** The body chunk of a cell of the manifest; undefined for any other id. */
  cell: (cellId: string) => Promise<LessonCellChunk> | undefined;
  titles: (locale: OverlayLocale) => Promise<LessonTitleChunk>;
  /** The headers chunk of a UI locale (row CM-40). */
  headers?: (locale: UiLocale) => Promise<LessonHeaderChunk>;
}

/** A chunk whose hash is not the one the manifest names (another build's file under this name). */
export class LessonChunkMismatch extends Error {
  constructor(
    readonly chunk: string,
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`lesson chunk ${chunk} carries ${actual}, the manifest names ${expected}`);
    this.name = 'LessonChunkMismatch';
  }
}

/** A chunk that did not arrive in time (a hung request: flaky Wi-Fi, a captive portal); a later ensure tries again. */
export class LessonChunkTimeout extends Error {
  constructor(
    readonly chunk: string,
    readonly ms: number,
  ) {
    super(`lesson chunk ${chunk} did not load within ${ms} ms`);
    this.name = 'LessonChunkTimeout';
  }
}

/**
 * True for a chunk failure that only a fresh page can mend: the page runs an older build than the
 * server (another tab applied an update and its worker dropped the old chunks, or a deploy landed
 * while no worker controlled the page), so the chunk's URL answers with the app's HTML page
 * (Metro then finds no module in it and keeps that load as done) or with another build's chunk.
 * A network failure (offline, a timeout) is not one: trying again later can mend it.
 */
export function isNewBuildError(error: unknown): boolean {
  if (error instanceof LessonChunkMismatch) return true;
  return error instanceof Error && /^Requiring unknown module\b/.test(error.message);
}

/**
 * The web bundle name of a chunk the store loads: `lessons-cell-stage2-letters` for `episode:stage2-letters` (and
 * `lessons-cell-stage2-letters-v2` for its Volume 2), `lessons-titles-es`, `lessons-headers-en`.
 */
export function chunkBundleName(chunk: string): string {
  return chunk.startsWith('titles-') || chunk.startsWith('headers-') ? `lessons-${chunk}` : `lessons-cell-${chunk.replace(/^episode:/, '')}`;
}

export interface LessonStoreOptions {
  /** A load that has not settled after this many ms fails with `LessonChunkTimeout`; none when omitted. */
  timeoutMs?: number;
  /**
   * Called with a chunk's bundle name (`chunkBundleName`) when its load times out. Metro keeps a pending
   * load by its path until it settles, so without this a later ensure would get the same hung request
   * back; the web build fails the pending script so the next ensure asks again (`platform/lesson-chunk-abandon`).
   */
  abandon?: (bundleName: string) => void;
  /**
   * A locale's titles count as settled (`titlesSettled`) once their load has taken this many ms, while it
   * goes on: the screen then shows in that locale with the lesson titles in English (and, while the English
   * headers are not in either, without the display lines), and they change when the chunk arrives
   * (`titlesVersion`). None when omitted: settled only when in or failed.
   */
  titlesGraceMs?: number;
}

export interface LessonStore {
  /** The cell (episode id) that holds a lesson quest; undefined for every other quest. */
  cellOfQuest: (questId: string) => string | undefined;
  /** Loads the body chunks of these cells (ids outside the manifest are skipped); rejects on a failed or mismatched chunk. */
  ensureCells: (cellIds: readonly string[]) => Promise<void>;
  /** Every cell of the manifest. */
  ensureAll: () => Promise<void>;
  /** The lesson text of a UI locale: the English headers, and for es or ko its title and headers chunks (row CM-40). */
  ensureTitles: (locale: UiLocale) => Promise<void>;
  /** True when the quest's body is in (always true for a quest that is not a lesson quest). */
  isQuestReady: (questId: string) => boolean;
  isAllReady: () => boolean;
  /** True when each of the locale's text chunks is in, has failed (the English stays), or has run past `titlesGraceMs`. */
  titlesSettled: (locale: UiLocale) => boolean;
  /** Loads the locale's titles and resolves once they are settled (`titlesSettled`): within `titlesGraceMs` at most. Never rejects. */
  untilTitlesSettled: (locale: UiLocale) => Promise<void>;
  /** Bumps when a locale's titles or headers arrive, fail or run past the grace: what a localized memo keys on. */
  titlesVersion: () => number;
  /** A lesson episode's display lines, once the English headers are in (row CM-40); undefined before, or for another episode. */
  episodeLines: (episodeId: string) => LessonEpisodeLines | undefined;
  /** A lesson quest's display lines, once the English headers are in (row CM-40); undefined before, or for another quest. */
  questLines: (questId: string) => LessonQuestLines | undefined;
  /** A lesson quest's steps, once its cell is loaded. */
  stepsOf: (questId: string) => readonly QuestStep[] | undefined;
  /** A lesson minigame ref's scope, once its cell is loaded. */
  scopeFor: (ref: string) => MinigameScope | undefined;
  /** A lesson quest's Did you know? note, once its cell is loaded (row CM-3C); undefined before, or for a cell with none. */
  noteOf: (questId: string) => LessonQuestNote | undefined;
  /** Every scope of the loaded cells, by ref. */
  loadedScopes: () => Readonly<Record<string, MinigameScope>>;
  /** Called with the glosses of every chunk loaded so far, then of each chunk as it loads. */
  onOverlays: (listener: (overlays: Overlays) => void) => () => void;
  /** Change notifications for React (`useSyncExternalStore`): a chunk loaded or failed. */
  subscribe: (listener: () => void) => () => void;
  /** Bumps on every change. */
  version: () => number;
}

/**
 * `minigame:s<n>-<theme>-q<k>-<step>` -> `episode:stage<n>-<theme>`, and a Volume 2 ref
 * `minigame:s<n>-<theme>-v2-q<k>-<step>` -> `episode:stage<n>-<theme>-v2` (row CM-40); undefined for any other ref.
 */
const SCOPE_REF = /^minigame:s([2-467])-(letters|life|rites|nature|crafts)(-v2)?-q[1-9]-[a-z0-9-]+$/;
export function cellOfScopeRef(ref: string): string | undefined {
  const match = SCOPE_REF.exec(ref);
  return match === null ? undefined : `episode:stage${match[1]}-${match[2]}${match[3] ?? ''}`;
}

/** A text chunk the first screen waits for: a locale's titles or a locale's headers (row CM-40). */
type TextChunk = `titles-${OverlayLocale}` | `headers-${UiLocale}`;

export function createLessonStore(manifest: LessonManifest, load: LessonLoaders, options: LessonStoreOptions = {}): LessonStore {
  const { timeoutMs, abandon, titlesGraceMs } = options;
  const questCell = new Map<string, string>();
  for (const e of manifest.episodes) {
    if (manifest.cells[e.id] === undefined) continue;
    for (const id of e.questIds) questCell.set(id, e.id);
  }
  const cells = new Map<string, LessonCellChunk>();
  const cellLoads = new Map<string, Promise<void>>();
  // The text chunks (titles and headers), by key: in, loading, failed, or past the grace while loading.
  const textIn = new Set<TextChunk>();
  const textLoads = new Map<TextChunk, Promise<void>>();
  const textFailed = new Set<TextChunk>();
  const textLate = new Set<TextChunk>();
  let titleChanges = 0;
  let english: Pick<LessonHeaderChunk, 'LESSON_EPISODE_HEADERS' | 'LESSON_QUEST_HEADERS'> | undefined;
  const glosses: Overlays[] = [];
  const overlayListeners = new Set<(overlays: Overlays) => void>();
  const listeners = new Set<() => void>();
  let changes = 0;

  const changed = (): void => {
    changes += 1;
    for (const l of [...listeners]) l();
  };
  const addOverlays = (overlays: Overlays): void => {
    glosses.push(overlays);
    for (const l of [...overlayListeners]) l(overlays);
  };
  const checked = <T extends { CHUNK_HASH: string }>(chunk: string, expected: string | undefined, mod: T): T => {
    if (mod.CHUNK_HASH !== expected) throw new LessonChunkMismatch(chunk, expected ?? '(none)', mod.CHUNK_HASH);
    return mod;
  };

  const withinTime = <T>(chunk: string, started: Promise<T>): Promise<T> => {
    if (timeoutMs === undefined) return started;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new LessonChunkTimeout(chunk, timeoutMs));
        abandon?.(chunkBundleName(chunk));
      }, timeoutMs);
      started.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  };

  const ensureCell = (cellId: string): Promise<void> => {
    const expected = manifest.cells[cellId];
    if (expected === undefined || cells.has(cellId)) return Promise.resolve();
    const pending = cellLoads.get(cellId);
    if (pending !== undefined) return pending;
    const started = load.cell(cellId);
    if (started === undefined) return Promise.reject(new Error(`no loader for the lesson chunk of ${cellId}`));
    const promise = withinTime(cellId, started)
      .then((mod) => checked(cellId, expected, mod))
      .then(
        (mod) => {
          cells.set(cellId, mod);
          cellLoads.delete(cellId);
          addOverlays(mod.LESSON_OVERLAYS);
          changed();
        },
        (error: unknown) => {
          cellLoads.delete(cellId);
          changed();
          throw error;
        },
      );
    cellLoads.set(cellId, promise);
    return promise;
  };

  const ensureCells = async (cellIds: readonly string[]): Promise<void> => {
    await Promise.all(cellIds.map(ensureCell));
  };

  /** The text chunks a locale's screens show: the English headers for every locale, and es / ko their titles and headers. */
  const textChunksOf = (locale: UiLocale): TextChunk[] => {
    const headers = manifest.headers === undefined || load.headers === undefined ? [] : (['headers-en'] as TextChunk[]);
    if (locale === 'en') return headers;
    return [...headers, `titles-${locale}`, ...(headers.length > 0 ? [`headers-${locale}` as TextChunk] : [])];
  };

  /** Lays a loaded text chunk in: the titles' and the es / ko headers' glosses, or the English display lines. */
  const layIn = (key: TextChunk, mod: LessonTitleChunk | LessonHeaderChunk): void => {
    const locale = key.slice(key.indexOf('-') + 1) as UiLocale;
    const table = 'LESSON_TITLE_OVERLAYS' in mod ? mod.LESSON_TITLE_OVERLAYS : mod.LESSON_HEADER_OVERLAYS;
    if (locale === 'en' && 'LESSON_EPISODE_HEADERS' in mod) english = { LESSON_EPISODE_HEADERS: mod.LESSON_EPISODE_HEADERS, LESSON_QUEST_HEADERS: mod.LESSON_QUEST_HEADERS };
    if (locale === 'es') addOverlays({ es: table, ko: {} });
    if (locale === 'ko') addOverlays({ es: {}, ko: table });
  };

  const ensureText = (key: TextChunk): Promise<void> => {
    if (textIn.has(key)) return Promise.resolve();
    const pending = textLoads.get(key);
    if (pending !== undefined) return pending;
    const locale = key.slice(key.indexOf('-') + 1);
    const titles = key.startsWith('titles-');
    const expected = titles ? manifest.titles[locale as OverlayLocale] : manifest.headers?.[locale as UiLocale];
    const started: Promise<LessonTitleChunk | LessonHeaderChunk> | undefined = titles ? load.titles(locale as OverlayLocale) : load.headers?.(locale as UiLocale);
    if (started === undefined) return Promise.resolve();
    const grace =
      titlesGraceMs === undefined
        ? undefined
        : setTimeout(() => {
            if (!textLoads.has(key) || textLate.has(key)) return;
            textLate.add(key);
            titleChanges += 1;
            changed();
          }, titlesGraceMs);
    const promise = withinTime(key, started)
      .then((mod) => checked(key, expected, mod))
      .then(
        (mod) => {
          clearTimeout(grace);
          layIn(key, mod);
          textIn.add(key);
          textFailed.delete(key);
          textLoads.delete(key);
          titleChanges += 1;
          changed();
        },
        (error: unknown) => {
          clearTimeout(grace);
          textFailed.add(key);
          textLoads.delete(key);
          titleChanges += 1;
          changed();
          throw error;
        },
      );
    textLoads.set(key, promise);
    return promise;
  };

  const ensureTitles = async (locale: UiLocale): Promise<void> => {
    await Promise.all(textChunksOf(locale).map(ensureText));
  };

  const textSettled = (key: TextChunk): boolean => textIn.has(key) || textFailed.has(key) || textLate.has(key);
  const titlesSettled = (locale: UiLocale): boolean => textChunksOf(locale).every(textSettled);

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const untilTitlesSettled = (locale: UiLocale): Promise<void> => {
    ensureTitles(locale).catch(() => undefined);
    if (titlesSettled(locale)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const off = subscribe(() => {
        if (!titlesSettled(locale)) return;
        off();
        resolve();
      });
    });
  };

  const stepsOf = (questId: string): readonly QuestStep[] | undefined => {
    const cell = questCell.get(questId);
    return cell === undefined ? undefined : cells.get(cell)?.LESSON_STEPS[questId];
  };

  return {
    cellOfQuest: (questId) => questCell.get(questId),
    ensureCells,
    ensureAll: () => ensureCells(Object.keys(manifest.cells)),
    ensureTitles,
    isQuestReady: (questId) => {
      const cell = questCell.get(questId);
      return cell === undefined || cells.has(cell);
    },
    isAllReady: () => Object.keys(manifest.cells).every((id) => cells.has(id)),
    titlesSettled,
    untilTitlesSettled,
    titlesVersion: () => titleChanges,
    episodeLines: (episodeId) => english?.LESSON_EPISODE_HEADERS[episodeId],
    questLines: (questId) => english?.LESSON_QUEST_HEADERS[questId],
    stepsOf,
    scopeFor: (ref) => {
      const cell = cellOfScopeRef(ref);
      return cell === undefined ? undefined : cells.get(cell)?.LESSON_SCOPES[ref];
    },
    noteOf: (questId) => {
      const cell = questCell.get(questId);
      return cell === undefined ? undefined : cells.get(cell)?.LESSON_NOTES[questId];
    },
    loadedScopes: () => Object.assign({}, ...[...cells.values()].map((c) => c.LESSON_SCOPES)) as Record<string, MinigameScope>,
    onOverlays: (listener) => {
      for (const o of glosses) listener(o);
      overlayListeners.add(listener);
      return () => {
        overlayListeners.delete(listener);
      };
    },
    subscribe,
    version: () => changes,
  };
}

/**
 * The manifest's quest headers as `Quest`s whose `steps` read the store: a lesson quest's steps
 * once its cell is loaded, none before. Screens that play or summarise a lesson quest wait for
 * its cell (`isQuestReady`) before they read them. Its display lines (`blurbEn`, `teaserEn`, row
 * CM-40) read the English headers chunk the same way, which the first screen waits for.
 */
export function questsOverStore(headers: readonly LessonQuestHeader[], store: Pick<LessonStore, 'stepsOf'> & Partial<Pick<LessonStore, 'questLines'>>): Quest[] {
  const none: readonly QuestStep[] = [];
  return headers.map((header) => {
    const quest = { ...header } as Quest;
    Object.defineProperty(quest, 'steps', {
      enumerable: true,
      configurable: false,
      get: () => store.stepsOf(header.id) ?? none,
    });
    if (store.questLines !== undefined) {
      const lines = store.questLines;
      for (const field of QUEST_LINE_FIELDS) {
        Object.defineProperty(quest, field, { enumerable: true, configurable: false, get: () => lines(header.id)?.[field] });
      }
    }
    return quest;
  });
}

const QUEST_LINE_FIELDS = ['blurbEn', 'teaserEn'] as const satisfies readonly (keyof LessonQuestLines)[];

/**
 * The manifest's episodes as `Episode`s whose display lines (row CM-40: `subtitleEn`, `hoyaIntroEn`, `rewardCardIds`)
 * read the English headers chunk: there once it is in, which the first screen waits for (`TITLES_GRACE_MS` at most);
 * before that an episode has no subtitle, an empty Hoya intro and no reward cards, and the screens draw again when
 * the chunk arrives (`titlesVersion`).
 */
export function episodesOverStore(episodes: readonly LessonManifestEpisode[], store: Pick<LessonStore, 'episodeLines'>): Episode[] {
  const noCards: string[] = [];
  return episodes.map((manifestEpisode) => {
    const episode = { ...manifestEpisode } as Episode;
    const lines = (): LessonEpisodeLines | undefined => store.episodeLines(manifestEpisode.id);
    Object.defineProperty(episode, 'subtitleEn', { enumerable: true, configurable: false, get: () => lines()?.subtitleEn });
    Object.defineProperty(episode, 'hoyaIntroEn', { enumerable: true, configurable: false, get: () => lines()?.hoyaIntroEn ?? '' });
    Object.defineProperty(episode, 'rewardCardIds', { enumerable: true, configurable: false, get: () => lines()?.rewardCardIds ?? noCards });
    return episode;
  });
}

/**
 * Merges a chunk's glosses into `into`, field by field (one mutable table for every reader): a
 * lesson quest's titles come from the locale's title chunk and its step glosses from its cell's chunk.
 */
export function mergeOverlaysInto(into: { es: Record<string, EntityOverlay>; ko: Record<string, EntityOverlay> }, extra: Overlays): void {
  for (const locale of ['es', 'ko'] as const) {
    for (const [id, entry] of Object.entries(extra[locale])) into[locale][id] = { ...into[locale][id], ...entry };
  }
}
