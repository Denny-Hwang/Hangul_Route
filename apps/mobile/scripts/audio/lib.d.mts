// Types for the unit tests in apps/mobile (F-AUDIO-004 §3.10); the script itself is dependency-free JS.

export interface AssetEntry {
  /** `audio/jamo/giyeok.mp3` */
  ref: string;
  /** Literal require path from the generated file. */
  require: string;
}

export interface AudioRuntimeCachingRule {
  urlPattern: RegExp;
  handler: 'CacheFirst';
  options: {
    cacheName: string;
    expiration: { maxEntries: number };
    cacheableResponse: { statuses: number[] };
  };
}

export const AUDIO_REF_PATTERN: RegExp;
export const RUNTIME_AUDIO_GROUPS: readonly string[];
export const ASSET_MAP_FILE: string;
export const AUDIO_DIR: string;
export const AUDIO_REQUIRE_BASE: string;
export const E2E_FIXTURE_DIR: string;
export const E2E_FIXTURE_REQUIRE_BASE: string;
export const AUDIO_PRECACHE_IGNORES: readonly string[];

export function refFromFile(file: string): string;
export function buildAssetMap(files: readonly string[], base?: string): AssetEntry[];
export function mergeAssetMaps(...lists: ReadonlyArray<readonly AssetEntry[]>): AssetEntry[];
export function renderAssetMap(entries: readonly AssetEntry[]): string;
export function refsInRenderedMap(source: string): string[];
export function isRuntimeAudio(path: string): boolean;
export function audioRuntimeCaching(): AudioRuntimeCachingRule;
export function precacheGaps(distMp3s: readonly string[], manifestUrls: readonly string[]): string[];
export function precacheLeaks(manifestUrls: readonly string[]): string[];
