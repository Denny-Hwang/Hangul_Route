import type { StoryShelfChunk } from './story-chunk-store';

/**
 * The story shelf as a chunk of its own (F-CURR-002 §10, row CM-8b). The web app loads it before it evaluates
 * the app (`content/story-shelf.web.ts`, `index.ts`): every story list, the shelf episodes and quests, the books
 * and the story cards are derived from it at module load. Pure over the injected loader (the index's literal
 * `import()`), so the lazy path is testable without Metro.
 */

/** The bundle name of the shelf chunk (`stories-shelf-<md5>.js`); `SHELF_CHUNK` of scripts/build-stories.mjs. */
export const STORY_SHELF_BUNDLE = 'stories-shelf';

/** A shelf chunk whose hash is not the one the start bundle names (another build's file under this name). */
export class StoryShelfMismatch extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`the story shelf chunk carries ${actual}, the start bundle names ${expected}`);
    this.name = 'StoryShelfMismatch';
  }
}

/** A shelf chunk that did not arrive in time (a hung request); Try again asks again. */
export class StoryShelfTimeout extends Error {
  constructor(readonly ms: number) {
    super(`the story shelf chunk did not load within ${ms} ms`);
    this.name = 'StoryShelfTimeout';
  }
}

/**
 * True for a shelf failure that only a fresh page can mend: another build's chunk under this name, or the app's
 * HTML page served in its place (Metro then finds no module in it). A network failure is not one.
 */
export function isStoryShelfNewBuildError(error: unknown): boolean {
  if (error instanceof StoryShelfMismatch) return true;
  return error instanceof Error && /^Requiring unknown module\b/.test(error.message);
}

export interface StoryShelfLoadOptions {
  /** The literal `import()` of the shelf chunk (`loadStoryShelf` of the generated index). */
  load: () => Promise<StoryShelfChunk>;
  /** The hash the start bundle names (`STORY_SHELF_HASH`). */
  hash: string;
  /** A load that has not settled after this many ms fails with `StoryShelfTimeout`; none when omitted. */
  timeoutMs?: number;
  /** Gives up the hung chunk's pending script by its bundle name, so the next try asks again. */
  abandon?: (bundleName: string) => void;
}

/** Loads the shelf chunk once, within the time allowed, and checks its hash; rejects otherwise. */
export function loadShelfChunk({ load, hash, timeoutMs, abandon }: StoryShelfLoadOptions): Promise<StoryShelfChunk> {
  const checked = (mod: StoryShelfChunk): StoryShelfChunk => {
    if (mod.CHUNK_HASH !== hash) throw new StoryShelfMismatch(hash, mod.CHUNK_HASH);
    return mod;
  };
  if (timeoutMs === undefined) return load().then(checked);
  return new Promise<StoryShelfChunk>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new StoryShelfTimeout(timeoutMs));
      abandon?.(STORY_SHELF_BUNDLE);
    }, timeoutMs);
    load().then(
      (mod) => {
        clearTimeout(timer);
        try {
          resolve(checked(mod));
        } catch (error) {
          reject(error);
        }
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export interface StoryShelfSlot {
  /** The shelf, once it is in; throws before (a module read it too early: a static import of the app). */
  shelf: () => StoryShelfChunk;
  isIn: () => boolean;
  /** Loads the shelf (once; a failed load is forgotten, so the next call asks again). */
  ensure: () => Promise<void>;
}

/** The web app's one shelf: loaded by `ensure` before the app's modules are evaluated. */
export function createStoryShelfSlot(options: StoryShelfLoadOptions): StoryShelfSlot {
  let installed: StoryShelfChunk | null = null;
  let pending: Promise<void> | null = null;
  return {
    shelf: () => {
      if (installed === null) {
        throw new Error('the story shelf is read before its chunk is in: nothing that reads the stories may be imported before index.ts loads it');
      }
      return installed;
    },
    isIn: () => installed !== null,
    ensure: () => {
      if (installed !== null) return Promise.resolve();
      if (pending !== null) return pending;
      pending = loadShelfChunk(options).then(
        (mod) => {
          installed = mod;
          pending = null;
        },
        (error: unknown) => {
          pending = null;
          throw error;
        },
      );
      return pending;
    },
  };
}
