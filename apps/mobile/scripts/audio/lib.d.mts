// Types for the unit tests in apps/mobile (F-AUDIO-004 §3.10); the script itself is dependency-free JS.

export interface AssetEntry {
  /** `audio/jamo/giyeok.mp3` */
  ref: string;
  /** Literal require path from the generated file. */
  require: string;
  /** The clip's pack (AMENDMENTS-AUDIO-CLIPS AC-B6), when it has one. */
  pack?: string;
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
export const JAMO_PACK_STAGE1: 'jamo-s1';
export const JAMO_PACK_WORD_BUILDER: 'jamo-wb';
export const RUNTIME_AUDIO_GROUPS: readonly string[];
export const ASSET_MAP_FILE: string;
export const AUDIO_DIR: string;
export const AUDIO_REQUIRE_BASE: string;
export const E2E_FIXTURE_DIR: string;
export const E2E_FIXTURE_REQUIRE_BASE: string;
export const AUDIO_PRECACHE_IGNORES: readonly string[];

export function refFromFile(file: string): string;
export function buildAssetMap(files: readonly string[], base?: string, packOf?: (ref: string) => string | undefined): AssetEntry[];
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

export type ClipKind = 'jamo' | 'word' | 'sentence' | 'narration';
export type JamoPack = 'jamo-s1' | 'jamo-wb';

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

export const CLIP_PADDING_S: number;
export const PER_SYLLABLE_S: Readonly<{ min: number; max: number }>;
export const SAY_KBPS: 48;
export const CLIP_LIMITS: Readonly<{
  jamo: { minS: number; maxS: number; maxBytes: number };
  word: { minS: number; maxS: number; maxBytes: number; setMaxBytes: number };
  sentence: { perSyllable: { min: number; max: number }; paddingS: number; kbps: 48 };
  narration: { perSyllable: { min: number; max: number }; paddingS: number; kbps: 48 };
}>;
export const PACK_SET_LIMITS: Readonly<Record<JamoPack, Readonly<{ clips: number; maxBytes: number }>>>;
export function spokenSyllableCount(text: string): number;
export function clipLimitsOf(kind: ClipKind, context?: { syllables?: number; kbps?: 64 | 48 }): { minS: number; maxS: number; maxBytes: number };
export function clipClassOf(row: { kind: string; text: string }): ClipKind;
export function recordingGroupOf(ref: string): 'jamo' | 'vocab' | 'say' | null;
export function clipKbpsOf(ref: string, context?: { kbps?: 64 | 48; sampleRate?: number }): 64 | 48;
/** `audio/jamo/giyeok-batchim.mp3` => `giyeok-batchim`. */
export function fileIdOf(audioRef: string): string;
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
/** Every jamo clip ref jamo.ts declares (sound and name clips, Stage 1 and Word Builder), each once, with its pack. */
export function jamoClipRefs(source: string): Array<{ ref: string; pack: string }>;
export const TTS_MANIFEST_FILE: string;
export function clipPacksOf(manifest: { rows?: ReadonlyArray<{ ref: string; pack: string }> } | null | undefined): Map<string, string>;
export function evaluateReport(kind: ClipKind, report: ClipReport, context?: { syllables?: number; kbps?: 64 | 48 }): string[];
export function evaluateSet(set: 'word' | JamoPack | (string & {}), sizes: readonly number[], label?: string): string[];
export function clipSets(
  kind: 'jamo' | 'word',
  fileIds: readonly string[],
  context?: { packByFileId?: ReadonlyMap<string, string>; topicByFileId?: ReadonlyMap<string, string> },
): Array<{ label: string; pack?: string; fileIds: string[] }>;
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

export const MP3_BITRATES: Readonly<Record<64 | 48, number>>;
export const DEFAULT_MP3_BITRATE: 64;
export function parseBitrate(value: string | undefined): 64 | 48;
export function mp3EncodeArgs(kbps?: 64 | 48): string[];
export const GROUP_BITRATES: Readonly<{ jamo: readonly 64[]; vocab: readonly 64[]; say: readonly (48 | 64)[] }>;
export const RECORDING_GROUPS: readonly ('jamo' | 'vocab' | 'say')[];
export function groupBitrate(group: string, value: string | undefined): 64 | 48;
export function sayRecordingIds(manifest: { rows?: Array<{ ref: string; key: string }> } | null | undefined): string[];
