import type { Story, StoryKeyword, StoryLevel } from '@hangul-route/content-schema';

/**
 * The stories at runtime (F-CURR-002 §10, row CM-8). The start bundle holds only the story shelf
 * (`__generated__/stories-index.ts`): each story's id, titles, theme, stage, minutes, review gate,
 * shelf, card and reward blocks, Hoya lines, the levels of its tiers and its card's keyword. The
 * rest of a story (its tiers with their scenes and art, facts, keywords, summary, verification and
 * the other fields of `STORY_BODY_FIELDS`) is one content-hashed chunk per story, reached through
 * an injected loader (the manifest's literal `import()`s), on demand, once each. The web build
 * makes every chunk its own precached bundle; the native build keeps them in its one bundle.
 *
 * Pure over the injected loader, so the lazy path is testable without Metro (`content/stories.ts`
 * binds the real one). A loaded chunk is checked against the hash the manifest names, so a shell
 * never reads a chunk of another build. The twin of the split is `STORY_BODY_FIELDS` in
 * scripts/build-stories.mjs; `content/__tests__/story-chunks.test.ts` keeps the two equal.
 */

/**
 * The fields of a story that live in its body chunk; every other field is in the shelf, and
 * `review` is in both (the shelf keeps the gate only, `ShelfReview`).
 */
export const STORY_BODY_FIELDS = [
  'v',
  'contentVer',
  'summaryEn',
  'learningGoalsEn',
  'origin',
  'keywords',
  'tiers',
  'facts',
  'referenceDisplay',
  'verification',
  'authorNotes',
  'errata',
  'review',
] as const satisfies readonly (keyof Story)[];

export type StoryBodyField = (typeof STORY_BODY_FIELDS)[number];

/** What a story's chunk holds. */
export type StoryBody = Pick<Story, StoryBodyField>;

/** One tier as the shelf knows it: its level and how many scenes it has. */
export interface StoryTierHeader {
  level: StoryLevel;
  scenes: number;
}

/** The review gate as the shelf keeps it: the two sign-offs, and the advisory when there is one. */
export type ShelfReview = Pick<Story['review'], 'language' | 'culture' | 'advisoryNoteEn'> & { advisory?: Story['review']['advisory'] };

/**
 * Shelf fields the generator leaves out when they hold the schema default (`StorySchema`); the
 * stories get the default back. Twin of `SHELF_DEFAULTS` in build-stories.mjs.
 */
export const SHELF_DEFAULTS = Object.freeze({ pillarTags: [], companionId: 'hoya', cultureNotes: [] }) satisfies Partial<Story>;

type DefaultedField = keyof typeof SHELF_DEFAULTS;

/** A story as the start-loaded shelf carries it. */
export type StoryShelfEntry = Omit<Story, StoryBodyField | DefaultedField> &
  Partial<Pick<Story, DefaultedField>> & {
  review: ShelfReview;
  /** The tiers in file order, without their scenes. */
  levels: readonly StoryTierHeader[];
  /** The keyword the story's card shows (`card.keywordId`), so the card's face needs no chunk. */
  cardKeyword?: StoryKeyword;
  /** The hash the story's chunk carries as `CHUNK_HASH`. */
  chunk: string;
};

/** The module of a story's chunk (`story-chunks/story-<slug>.ts`). */
export interface StoryBodyChunk {
  CHUNK_HASH: string;
  STORY_BODY: StoryBody;
}

export interface StoryManifest {
  entries: readonly StoryShelfEntry[];
  /** Bodies that ship inside the manifest module itself (the test fixtures of an e2e build). */
  inline?: Readonly<Record<string, StoryBody>>;
}

/** The chunk of a story of the manifest; undefined for any other id. */
export type StoryLoader = (storyId: string) => Promise<StoryBodyChunk> | undefined;

/** A chunk whose hash is not the one the manifest names (another build's file under this name). */
export class StoryChunkMismatch extends Error {
  constructor(
    readonly storyId: string,
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`story chunk ${storyId} carries ${actual}, the manifest names ${expected}`);
    this.name = 'StoryChunkMismatch';
  }
}

/** A chunk that did not arrive in time (a hung request: flaky Wi-Fi, a captive portal); a later ensure tries again. */
export class StoryChunkTimeout extends Error {
  constructor(
    readonly storyId: string,
    readonly ms: number,
  ) {
    super(`story chunk ${storyId} did not load within ${ms} ms`);
    this.name = 'StoryChunkTimeout';
  }
}

export interface StoryStoreOptions {
  /** A load that has not settled after this many ms fails with `StoryChunkTimeout`; none when omitted. */
  timeoutMs?: number;
}

/**
 * True for a story chunk failure that only a fresh page can mend (the twin of `isNewBuildError` of the lesson
 * store): another build's chunk under this name, or the app's HTML page served in its place (Metro then finds
 * no module in it). A network failure (offline, a timeout) is not one: trying again later can mend it.
 */
export function isStoryNewBuildError(error: unknown): boolean {
  if (error instanceof StoryChunkMismatch) return true;
  return error instanceof Error && /^Requiring unknown module\b/.test(error.message);
}

export interface StoryStore {
  /** The shelf entry of a story of the manifest. */
  entryOf: (storyId: string) => StoryShelfEntry | undefined;
  /** Loads the chunks of these stories (ids outside the manifest are skipped); rejects on a failed or mismatched chunk. */
  ensureStories: (storyIds: readonly string[]) => Promise<void>;
  /** Every story of the manifest. */
  ensureAll: () => Promise<void>;
  /** True when the story's body is in (always true for an id outside the manifest). */
  isStoryReady: (storyId: string) => boolean;
  isAllReady: () => boolean;
  /** A story's body, once its chunk is loaded. */
  bodyOf: (storyId: string) => StoryBody | undefined;
  /** Change notifications for React (`useSyncExternalStore`): a chunk loaded or failed. */
  subscribe: (listener: () => void) => () => void;
  /** Bumps on every change. */
  version: () => number;
}

export function createStoryStore(manifest: StoryManifest, load: StoryLoader, options: StoryStoreOptions = {}): StoryStore {
  const { timeoutMs } = options;
  const entries = new Map(manifest.entries.map((e) => [e.id, e]));
  const bodies = new Map<string, StoryBody>(Object.entries(manifest.inline ?? {}));
  const loads = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  let changes = 0;

  const changed = (): void => {
    changes += 1;
    for (const l of [...listeners]) l();
  };

  const withinTime = <T>(storyId: string, started: Promise<T>): Promise<T> => {
    if (timeoutMs === undefined) return started;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new StoryChunkTimeout(storyId, timeoutMs)), timeoutMs);
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

  const ensureStory = (storyId: string): Promise<void> => {
    const entry = entries.get(storyId);
    if (entry === undefined || bodies.has(storyId)) return Promise.resolve();
    const pending = loads.get(storyId);
    if (pending !== undefined) return pending;
    const loading = load(storyId);
    if (loading === undefined) return Promise.reject(new Error(`no loader for the story chunk of ${storyId}`));
    const started = withinTime(storyId, loading);
    const promise = started.then(
      (mod) => {
        loads.delete(storyId);
        if (mod.CHUNK_HASH !== entry.chunk) throw new StoryChunkMismatch(storyId, entry.chunk, mod.CHUNK_HASH);
        bodies.set(storyId, mod.STORY_BODY);
        changed();
      },
      (error: unknown) => {
        loads.delete(storyId);
        throw error;
      },
    );
    // A failed load is a change too: a screen waiting on it shows the crash screen, whose Try again loads it again.
    promise.catch(() => changed());
    loads.set(storyId, promise);
    return promise;
  };

  const ensureStories = async (storyIds: readonly string[]): Promise<void> => {
    await Promise.all(storyIds.map(ensureStory));
  };

  return {
    entryOf: (storyId) => entries.get(storyId),
    ensureStories,
    ensureAll: () => ensureStories([...entries.keys()]),
    isStoryReady: (storyId) => !entries.has(storyId) || bodies.has(storyId),
    isAllReady: () => [...entries.keys()].every((id) => bodies.has(id)),
    bodyOf: (storyId) => bodies.get(storyId),
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
 * What a body field reads before its chunk is in: empty lists and blank text, the card's keyword
 * alone (so a card's face is drawn at start), and a schema-valid stand-in for the two objects.
 * Screens that read a body wait for the chunk (`useStoryReady`); this keeps every other reader safe.
 */
function placeholder(entry: StoryShelfEntry, field: StoryBodyField): StoryBody[StoryBodyField] {
  switch (field) {
    case 'v':
      return 1;
    case 'contentVer':
      return 1;
    case 'summaryEn':
    case 'referenceDisplay':
      return '';
    case 'keywords':
      return entry.cardKeyword === undefined ? [] : [entry.cardKeyword];
    case 'origin':
      return { type: 'original', noteEn: '' };
    case 'verification':
      return { passes: 0, checkedAt: '', scope: 'story', notes: '' };
    case 'authorNotes':
      return undefined;
    case 'review':
      return { advisory: [], ...entry.review };
    case 'learningGoalsEn':
    case 'tiers':
    case 'facts':
    case 'errata':
      return [];
  }
}

const SHELF_ONLY = new Set(['levels', 'cardKeyword', 'chunk']);

/** The shelf entry each story of `storiesOverStore` was made from (by identity: a copy reads its own tiers). */
const shelfOf = new WeakMap<object, StoryShelfEntry>();

/**
 * The shelf entries as `Story`s whose body fields read the store: a story's tiers, facts and the
 * other body fields once its chunk is loaded, placeholders before. Each object is made once, so a
 * reader that keeps one sees the body as soon as it arrives.
 */
export function storiesOverStore(entries: readonly StoryShelfEntry[], store: Pick<StoryStore, 'bodyOf'>): Story[] {
  return entries.map((entry) => {
    const shelf = Object.entries(entry).filter(([key]) => !SHELF_ONLY.has(key) && key !== 'review');
    const story = { pillarTags: [...SHELF_DEFAULTS.pillarTags], companionId: SHELF_DEFAULTS.companionId, cultureNotes: [...SHELF_DEFAULTS.cultureNotes], ...Object.fromEntries(shelf) } as Partial<Story>;
    for (const field of STORY_BODY_FIELDS) {
      const fallback = placeholder(entry, field);
      Object.defineProperty(story, field, {
        enumerable: true,
        configurable: false,
        get: () => {
          const body = store.bodyOf(entry.id);
          return body === undefined ? fallback : body[field];
        },
      });
    }
    shelfOf.set(story, entry);
    return story as Story;
  });
}

/** The shelf quest's tier (F-STORY-004 §3.1): `listen`, else the first tier. Twin of `shelfTier` in build-stories.mjs. */
export function shelfLevelOf(levels: readonly StoryTierHeader[]): StoryLevel | undefined {
  return (levels.find((t) => t.level === 'listen') ?? levels[0])?.level;
}

/**
 * The levels of a story's tiers: the shelf's for a story of `storiesOverStore` (known before its chunk
 * loads), else its own tiers (a test fixture, a copy).
 */
export function storyTierLevels(story: Pick<Story, 'tiers'>): StoryLevel[] {
  return (shelfOf.get(story)?.levels ?? story.tiers).map((t) => t.level);
}

/**
 * A full story split into its shelf entry and its body: the TypeScript twin of `planChunks` in
 * scripts/build-stories.mjs, used for stories parsed at runtime (the test fixtures of an e2e build)
 * and kept equal to the generator by `content/__tests__/story-chunks.test.ts`.
 */
export function splitStory(story: Story, chunk: string): { entry: StoryShelfEntry; body: StoryBody } {
  const body = Object.fromEntries(STORY_BODY_FIELDS.filter((f) => story[f] !== undefined).map((f) => [f, story[f]])) as StoryBody;
  const isDefault = (key: string, value: unknown): boolean =>
    key in SHELF_DEFAULTS && JSON.stringify(SHELF_DEFAULTS[key as DefaultedField]) === JSON.stringify(value);
  const shelf = Object.fromEntries(
    Object.entries(story).filter(([key, value]) => !(STORY_BODY_FIELDS as readonly string[]).includes(key) && !isDefault(key, value)),
  );
  const { language, culture, advisory, advisoryNoteEn } = story.review;
  const review: ShelfReview = {
    language,
    culture,
    ...(advisory.length > 0 ? { advisory } : {}),
    ...(advisoryNoteEn === undefined ? {} : { advisoryNoteEn }),
  };
  const cardKeyword = story.card === undefined ? undefined : story.keywords.find((k) => k.id === story.card?.keywordId);
  // `shelf` is the story less its body fields and its defaults: a StoryShelfEntry once these are added.
  const entry = {
    ...(shelf as Omit<StoryShelfEntry, 'review' | 'levels' | 'cardKeyword' | 'chunk'>),
    review,
    levels: story.tiers.map((t) => ({ level: t.level, scenes: t.scenes.length })),
    ...(cardKeyword === undefined ? {} : { cardKeyword }),
    chunk,
  };
  return { entry, body };
}
