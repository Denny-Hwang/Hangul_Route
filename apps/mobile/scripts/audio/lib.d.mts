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
    cacheableResponse: { statuses: number[]; headers: Record<string, string> };
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

// --- Recording script, processing and acceptance (F-AUDIO-004 §3.11) ---

/** The fields of a jamo record the recording script reads (a `Jamo` fits). */
export interface RecordingJamo {
  id: string;
  kind: 'consonant' | 'vowel' | 'batchim';
  char: string;
  order: number;
  audioRef?: string | undefined;
  spokenKo?: string | undefined;
  spokenRomanization?: string | undefined;
  spokenKind?: 'sound' | 'name' | undefined;
  nameKo?: string | undefined;
}

export interface RecordingRow {
  n: number;
  fileId: string;
  say: string;
  doNotSay: string[];
  romanization: string;
  note: string;
}

export interface NameRow {
  n: number;
  fileId: string;
  say: string;
  romanization: string;
}

export interface VocabRecordingRow {
  fileId: string;
  say: string;
  spokenKo: string;
  romanization: string;
  gloss: string;
  topic: string;
  note: string;
}

export interface ParsedJamo {
  id: string;
  kind: 'consonant' | 'vowel' | 'batchim';
  char: string;
  order: number;
  audioRef: string;
  spokenKo: string;
  spokenRomanization: string;
  spokenKind: 'sound' | 'name';
  nameKo: string | undefined;
}

export type ClipKind = 'jamo' | 'word';

export interface ClipReport {
  channels: number;
  sampleRate: number;
  codec: string;
  durationS: number;
  integratedLufs: number;
  truePeakDb: number;
  bytes: number;
}

export interface TimeSpan {
  start: number;
  end: number;
}

export const CLIP_LIMITS: Readonly<Record<ClipKind, { minS: number; maxS: number; maxBytes: number; setMaxBytes: number }>>;
export const TARGET_LUFS: number;
export const LUFS_TOLERANCE: number;
export const MAX_TRUE_PEAK_DB: number;
export const RECORDING_EXTENSIONS: readonly string[];
export const TAKE_GAP_S: number;

export function recordingRows(jamo: readonly RecordingJamo[]): RecordingRow[];
export function nameRows(jamo: readonly RecordingJamo[]): NameRow[];
export function vocabRecordingRows(topicFiles: ReadonlyArray<{ items?: readonly object[] }>): VocabRecordingRow[];
/** `vocab:<slug>` => `audio/vocab/<slug>.mp3`. */
export function vocabAudioRef(id: string): string;
/** Every word's clip path (its own `audioRef`, else derived from its id), in file order. */
export function vocabClipRefs(topicFiles: ReadonlyArray<{ items?: readonly object[] }>): string[];
export function renderRecordingScript(rows: readonly RecordingRow[], names: readonly NameRow[], vocab: readonly VocabRecordingRow[]): string;
export function parseJamoSource(source: string): ParsedJamo[];
export function evaluateReport(kind: ClipKind, report: ClipReport): string[];
export function evaluateSet(kind: ClipKind, sizes: readonly number[], label?: string): string[];
export function clipSets(
  kind: ClipKind,
  fileIds: readonly string[],
  context?: { jamoIds?: readonly string[]; topicByFileId?: ReadonlyMap<string, string> },
): Array<{ label: string; fileIds: string[] }>;
export function parseTakeFile(name: string): { fileId: string; take: number } | null;
export function parseSilences(log: string, durationS: number): TimeSpan[];
export function takeSegments(silences: readonly TimeSpan[], durationS: number, minGapS?: number): TimeSpan[];
export function parseProbe(json: string): Omit<ClipReport, 'integratedLufs' | 'truePeakDb'>;
export function parseEbur128(log: string): { integratedLufs: number; truePeakDb: number };
export function clipStatus(refs: readonly string[], files: readonly string[]): { total: number; present: number; missing: string[] };
export const LOUDNESS_SETTLE_DB: number;
export function correctionGain(measuredLufs: number, target?: number): number;
export const MAX_TOP_UP_PASSES: number;
export const MAX_TOP_UP_DB: number;
export const LIMITING_WARN_DB: number;
export function nextTopUp(measuredLufs: number, state: { passes: number; appliedDb: number }): number;
export function topUpOutcome(measuredLufs: number): 'settled' | 'accepted' | 'rejected';
export function planRecording(
  fileId: string,
  sets: { expected: ReadonlySet<string>; names: ReadonlySet<string> },
  opts: { names?: boolean; allowExtra?: boolean },
): { action: 'process' } | { action: 'skip'; reason: string };
export function isInsideDir(dir: string, root: string): boolean;
