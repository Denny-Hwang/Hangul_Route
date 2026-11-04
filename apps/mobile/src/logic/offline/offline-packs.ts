import { StageKeySchema, type StageKey } from '@hangul-route/content-schema';

/**
 * Save for offline (F-CURR-002 §10 item 4, row CM-5B), the pure side. The learner precache keeps Volume 1, Stage 1
 * and the start-up chunks; the later chunks (a lesson cell's Volume 2, the tales only a book 2 holds) are cached the
 * first time they are used, and a grown-up can save a stage's later chunks, with the stage's audio pack, ahead of time.
 * The web build lists them in `offline-packs.json` (scripts/pwa/offline-packs.mjs); this module reads that index
 * against what the device's caches hold.
 */

/** The cache the later chunks live in (the service worker's runtime rule writes the same one). */
export const LATER_CACHE = 'hr-later-v1';
/** The shape version this build reads. */
export const OFFLINE_PACKS_VERSION = 1;

export interface OfflineFile {
  /** Site-relative URL (`/_expo/static/js/web/<name>-<md5>.js`, or a clip). */
  url: string;
  bytes: number;
  /** The Cache Storage cache the service worker reads it from. */
  cache: string;
}

export interface OfflineStagePack {
  stage: StageKey;
  bytes: number;
  files: readonly OfflineFile[];
}

export interface OfflinePacksIndex {
  version: number;
  stages: readonly OfflineStagePack[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStage = (v: unknown): v is StageKey => StageKeySchema.safeParse(v).success;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** The index, checked; null for anything else (an older or newer build's shape, an HTML page, a broken file). */
export function parseOfflinePacks(raw: unknown): OfflinePacksIndex | null {
  if (!isRecord(raw) || raw.version !== OFFLINE_PACKS_VERSION || !Array.isArray(raw.stages)) return null;
  const stages: OfflineStagePack[] = [];
  for (const s of raw.stages) {
    if (!isRecord(s) || !isStage(s.stage) || !Array.isArray(s.files)) return null;
    const files: OfflineFile[] = [];
    for (const f of s.files) {
      if (!isRecord(f) || typeof f.url !== 'string' || !f.url.startsWith('/') || !isCount(f.bytes) || typeof f.cache !== 'string') return null;
      files.push({ url: f.url, bytes: f.bytes, cache: f.cache });
    }
    stages.push({ stage: s.stage, bytes: files.reduce((sum, f) => sum + f.bytes, 0), files });
  }
  return { version: OFFLINE_PACKS_VERSION, stages };
}

/** Every URL the index names. */
export const indexUrls = (index: OfflinePacksIndex): string[] => index.stages.flatMap((s) => s.files.map((f) => f.url));

export type StageSaveState = 'saved' | 'partly' | 'notSaved';

export interface StagePackRow {
  stage: StageKey;
  /** The whole pack. */
  bytes: number;
  /** What is not on the device yet (0 once saved). */
  missingBytes: number;
  state: StageSaveState;
  /** The grown-up asked to keep this stage (it is topped up after an update). */
  chosen: boolean;
}

/**
 * One row per stage of the index: saved when every file is on the device, partly when some are (a lesson opened
 * online once keeps its chunk, row CM-5B's first use), else not saved.
 */
export function stagePackRows(index: OfflinePacksIndex, cached: ReadonlySet<string>, chosen: readonly StageKey[]): StagePackRow[] {
  return index.stages.map((s) => {
    const missing = s.files.filter((f) => !cached.has(f.url));
    const missingBytes = missing.reduce((sum, f) => sum + f.bytes, 0);
    const state: StageSaveState = missing.length === 0 ? 'saved' : missing.length === s.files.length ? 'notSaved' : 'partly';
    return { stage: s.stage, bytes: s.bytes, missingBytes, state, chosen: chosen.includes(s.stage) };
  });
}

/** The files of these stages that are not on the device yet, each once. */
export function filesToSave(index: OfflinePacksIndex, stages: readonly StageKey[], cached: ReadonlySet<string>): OfflineFile[] {
  const seen = new Set<string>();
  const out: OfflineFile[] = [];
  for (const s of index.stages) {
    if (!stages.includes(s.stage)) continue;
    for (const f of s.files) {
      if (cached.has(f.url) || seen.has(f.url)) continue;
      seen.add(f.url);
      out.push(f);
    }
  }
  return out;
}

/** The files a Remove takes away: the stage's own, minus any another stage still keeps (a shared clip). */
export function filesToRemove(index: OfflinePacksIndex, stage: StageKey, keep: readonly StageKey[]): OfflineFile[] {
  const kept = new Set(index.stages.filter((s) => s.stage !== stage && keep.includes(s.stage)).flatMap((s) => s.files.map((f) => f.url)));
  return (index.stages.find((s) => s.stage === stage)?.files ?? []).filter((f) => !kept.has(f.url));
}

const NAMED = /\/_expo\/static\/js\/web\/(.+)-[0-9a-f]{32}\.js$/;

/** The chunk name of a later bundle's URL (`lessons-cell-stage2-nature-v2`); undefined for a clip or another file. */
export function chunkNameOfUrl(url: string): string | undefined {
  return NAMED.exec(url)?.[1];
}

/** The later chunks (by name) whose bundle is on the device: they open offline. */
export function availableChunks(index: OfflinePacksIndex, cached: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const s of index.stages) {
    for (const f of s.files) {
      const name = f.cache === LATER_CACHE ? chunkNameOfUrl(f.url) : undefined;
      if (name !== undefined && cached.has(f.url)) out.add(name);
    }
  }
  return out;
}

/** Entries of the later cache this build does not name (an older build's chunks): safe to drop once this build runs. */
export function staleLaterUrls(laterCacheUrls: readonly string[], index: OfflinePacksIndex): string[] {
  const current = new Set(indexUrls(index));
  return laterCacheUrls.filter((u) => !current.has(u));
}

/** The browser's storage estimate, when it gives one. */
export interface SpaceEstimate {
  quota: number;
  usage: number;
}

/** Bytes the app may still store; null when the browser does not say. */
export function freeBytes(estimate: SpaceEstimate | null): number | null {
  if (estimate === null || !isCount(estimate.quota) || !isCount(estimate.usage) || estimate.quota === 0) return null;
  return Math.max(0, estimate.quota - estimate.usage);
}

/** Whether this many bytes fit; true when the browser does not say (the save then finds out). */
export function fits(estimate: SpaceEstimate | null, bytes: number): boolean {
  const free = freeBytes(estimate);
  return free === null || bytes <= free;
}

/**
 * Megabytes for the grown-up copy: one decimal, at least 0.1 for anything above zero, so a small pack never reads
 * as "0 MB". Decimal megabytes (1,000,000 B), the unit phones show in their storage settings.
 */
export function megabytes(bytes: number): number {
  if (bytes <= 0) return 0;
  return Math.max(0.1, Math.round(bytes / 100_000) / 10);
}

/** A cell id of a later volume: `episode:stage<n>-<theme>-v<k>`, k at least 2 (F-CURR-002 row CM-40). */
export const isLaterCellId = (cellId: string): boolean => /-v[2-9]$/.test(cellId);

/** A lesson cell's chunk name, as scripts/build-lessons.mjs `cellChunkName` writes it. */
export const cellChunkName = (cellId: string): string => `lessons-cell-${cellId.replace(/^episode:/, '')}`;

/** A story's chunk name, as scripts/build-stories.mjs `storyChunkName` writes it. */
export const storyChunkName = (storyId: string): string => `story-${storyId.replace(/^story:/, '')}`;

/** The book definitions' fields this reads. */
export interface BookVolume {
  storyIds: readonly string[];
  volume?: number;
}

/**
 * The tales only a book 2 holds (F-CURR-002 §5.1, row CM-46): a story of a volume 2 book that no book 1 holds. The
 * web build reads the same set from books.ts (scripts/pwa/offline-packs.mjs `laterStoryIds`); a test holds them equal.
 */
export function laterStoryIdsOf(books: readonly BookVolume[]): string[] {
  const first = new Set(books.filter((b) => (b.volume ?? 1) === 1).flatMap((b) => b.storyIds));
  return [...new Set(books.filter((b) => (b.volume ?? 1) >= 2).flatMap((b) => b.storyIds))].filter((id) => !first.has(id)).sort();
}
