import type { EntityOverlay, OverlayLocale, Overlays, Quest, QuestStep, UiLocale } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';

/**
 * The upper-stage lesson content at runtime (F-CURR-002 §10, row CM-5). The start bundle holds
 * only the manifest (`__generated__/lessons-index.ts`: episodes and quest headers in English).
 * Each cell's body (its quests' steps, its game scopes and their es / ko glosses) is one
 * content-hashed chunk, and the es / ko titles are one chunk per locale; both come through
 * injected loaders (the manifest's literal `import()`s), on demand, once each. The web build
 * makes every chunk its own precached bundle; the native build keeps them in its one bundle.
 *
 * Pure over the injected loaders, so the lazy path is testable without Metro
 * (`content/lessons.ts` binds the real ones). A loaded chunk is checked against the hash the
 * manifest names, so a shell never reads a chunk of another build.
 */

/** A quest of the manifest: everything but its steps, which live in its cell's body chunk. */
export type LessonQuestHeader = Omit<Quest, 'steps'>;

/** One locale's glosses by entity id. */
export type OverlayTable = Readonly<Record<string, EntityOverlay>>;

/** The module of a cell's body chunk (`lesson-chunks/lessons-cell-<stage>-<theme>.ts`). */
export interface LessonCellChunk {
  CHUNK_HASH: string;
  LESSON_STEPS: Readonly<Record<string, readonly QuestStep[]>>;
  LESSON_SCOPES: Readonly<Record<string, MinigameScope>>;
  LESSON_OVERLAYS: Overlays;
}

/** The module of a locale's title chunk (`lesson-chunks/lessons-titles-<locale>.ts`). */
export interface LessonTitleChunk {
  CHUNK_HASH: string;
  LESSON_TITLE_OVERLAYS: OverlayTable;
}

export interface LessonManifest {
  episodes: readonly { id: string; questIds: readonly string[] }[];
  /** Episode id -> the hash its body chunk carries. */
  cells: Readonly<Record<string, string>>;
  /** Overlay locale -> the hash its title chunk carries. */
  titles: Readonly<Record<OverlayLocale, string>>;
}

export interface LessonLoaders {
  /** The body chunk of a cell of the manifest; undefined for any other id. */
  cell: (cellId: string) => Promise<LessonCellChunk> | undefined;
  titles: (locale: OverlayLocale) => Promise<LessonTitleChunk>;
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

export interface LessonStoreOptions {
  /** A load that has not settled after this many ms fails with `LessonChunkTimeout`; none when omitted. */
  timeoutMs?: number;
}

export interface LessonStore {
  /** The cell (episode id) that holds a lesson quest; undefined for every other quest. */
  cellOfQuest: (questId: string) => string | undefined;
  /** Loads the body chunks of these cells (ids outside the manifest are skipped); rejects on a failed or mismatched chunk. */
  ensureCells: (cellIds: readonly string[]) => Promise<void>;
  /** Every cell of the manifest. */
  ensureAll: () => Promise<void>;
  /** The title chunk of a UI locale; English needs none. */
  ensureTitles: (locale: UiLocale) => Promise<void>;
  /** True when the quest's body is in (always true for a quest that is not a lesson quest). */
  isQuestReady: (questId: string) => boolean;
  isAllReady: () => boolean;
  /** True when the locale's titles are in, or their load has failed (the English stays). */
  titlesSettled: (locale: UiLocale) => boolean;
  /** A lesson quest's steps, once its cell is loaded. */
  stepsOf: (questId: string) => readonly QuestStep[] | undefined;
  /** A lesson minigame ref's scope, once its cell is loaded. */
  scopeFor: (ref: string) => MinigameScope | undefined;
  /** Every scope of the loaded cells, by ref. */
  loadedScopes: () => Readonly<Record<string, MinigameScope>>;
  /** Called with the glosses of every chunk loaded so far, then of each chunk as it loads. */
  onOverlays: (listener: (overlays: Overlays) => void) => () => void;
  /** Change notifications for React (`useSyncExternalStore`): a chunk loaded or failed. */
  subscribe: (listener: () => void) => () => void;
  /** Bumps on every change. */
  version: () => number;
}

/** `minigame:s<n>-<theme>-q<k>-<step>` -> `episode:stage<n>-<theme>`; undefined for any other ref. */
const SCOPE_REF = /^minigame:s([2-467])-(letters|life|rites|nature|crafts)-q[1-9]-[a-z0-9-]+$/;
export function cellOfScopeRef(ref: string): string | undefined {
  const match = SCOPE_REF.exec(ref);
  return match === null ? undefined : `episode:stage${match[1]}-${match[2]}`;
}

export function createLessonStore(manifest: LessonManifest, load: LessonLoaders, options: LessonStoreOptions = {}): LessonStore {
  const { timeoutMs } = options;
  const questCell = new Map<string, string>();
  for (const e of manifest.episodes) {
    if (manifest.cells[e.id] === undefined) continue;
    for (const id of e.questIds) questCell.set(id, e.id);
  }
  const cells = new Map<string, LessonCellChunk>();
  const cellLoads = new Map<string, Promise<void>>();
  const titles = new Map<OverlayLocale, LessonTitleChunk>();
  const titleLoads = new Map<OverlayLocale, Promise<void>>();
  const titleFailed = new Set<OverlayLocale>();
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
  const checked = <T extends { CHUNK_HASH: string }>(chunk: string, expected: string, mod: T): T => {
    if (mod.CHUNK_HASH !== expected) throw new LessonChunkMismatch(chunk, expected, mod.CHUNK_HASH);
    return mod;
  };

  const withinTime = <T>(chunk: string, started: Promise<T>): Promise<T> => {
    if (timeoutMs === undefined) return started;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new LessonChunkTimeout(chunk, timeoutMs)), timeoutMs);
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

  const ensureTitles = (locale: UiLocale): Promise<void> => {
    if (locale === 'en') return Promise.resolve();
    if (titles.has(locale)) return Promise.resolve();
    const pending = titleLoads.get(locale);
    if (pending !== undefined) return pending;
    const expected = manifest.titles[locale];
    const promise = withinTime(`titles-${locale}`, load.titles(locale))
      .then((mod) => checked(`titles-${locale}`, expected, mod))
      .then(
        (mod) => {
          titles.set(locale, mod);
          titleFailed.delete(locale);
          titleLoads.delete(locale);
          addOverlays(locale === 'es' ? { es: mod.LESSON_TITLE_OVERLAYS, ko: {} } : { es: {}, ko: mod.LESSON_TITLE_OVERLAYS });
          changed();
        },
        (error: unknown) => {
          titleFailed.add(locale);
          titleLoads.delete(locale);
          changed();
          throw error;
        },
      );
    titleLoads.set(locale, promise);
    return promise;
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
    titlesSettled: (locale) => locale === 'en' || titles.has(locale) || titleFailed.has(locale),
    stepsOf,
    scopeFor: (ref) => {
      const cell = cellOfScopeRef(ref);
      return cell === undefined ? undefined : cells.get(cell)?.LESSON_SCOPES[ref];
    },
    loadedScopes: () => Object.assign({}, ...[...cells.values()].map((c) => c.LESSON_SCOPES)) as Record<string, MinigameScope>,
    onOverlays: (listener) => {
      for (const o of glosses) listener(o);
      overlayListeners.add(listener);
      return () => {
        overlayListeners.delete(listener);
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    version: () => changes,
  };
}

/**
 * The manifest's quest headers as `Quest`s whose `steps` read the store: a lesson quest's steps
 * once its cell is loaded, none before. Screens that play or summarise a lesson quest wait for
 * its cell (`isQuestReady`) before they read them.
 */
export function questsOverStore(headers: readonly LessonQuestHeader[], store: Pick<LessonStore, 'stepsOf'>): Quest[] {
  const none: readonly QuestStep[] = [];
  return headers.map((header) => {
    const quest = { ...header } as Quest;
    Object.defineProperty(quest, 'steps', {
      enumerable: true,
      configurable: false,
      get: () => store.stepsOf(header.id) ?? none,
    });
    return quest;
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
