// Types for the unit tests in apps/mobile (AMENDMENTS-AUDIO-CLIPS M8, JV-3); the script itself is dependency-free JS.

export const appRoot: string;
export const repoRoot: string;

export function readJamo(): unknown[];
export function readVocabTopics(): unknown[];
export function listFiles(dir: string): string[];

/** The content folders the app ships, relative to the repo root. */
export const SHIPPED_CONTENT_DIRS: readonly string[];

export interface ContentFile {
  /** Relative to the repo root, `/`-separated. */
  file: string;
  data: unknown;
}

export function readShippedContent(root?: string): ContentFile[];

export interface KoTextLike {
  ko: string;
  spokenKo?: unknown;
  [key: string]: unknown;
}

export function walkKoTexts(value: unknown, visit: (text: KoTextLike, path: Array<string | number>) => void, path?: Array<string | number>): void;
export function spokenTextOf(text: KoTextLike): string;
export function isLoneLetter(text: string): boolean;

export const SHOWN_ONLY_LETTERS: ReadonlyArray<{ file: RegExp; path: RegExp }>;
export function isShownOnlyLetter(file: string, path: ReadonlyArray<string | number>): boolean;

export interface BareLetter {
  file: string;
  path: string;
  ko: string;
}

export function bareLetterSpeech(files: readonly ContentFile[]): BareLetter[];

// ---- the clip manifest's readers (AMENDMENTS-AUDIO-CLIPS AC-2) ----

export function readJamoClipRefs(): Array<{ ref: string; pack: string }>;

/** One place a spoken text appears. */
export interface SpokenOccurrence {
  pack: string;
  /** The content file, or the id of a quest, game scope, card or review item. */
  source: string;
  ko: string;
  /** The object path inside its file (`quests.0.scopes.1.rounds.2.prompt`). */
  path: string;
  spokenKo?: string;
  audioRef?: string;
  kind?: 'narration';
}

export interface JamoClipVoice {
  ref: string;
  kind: 'jamo-sound' | 'jamo-name';
  text: string;
  pack: 'jamo-s1' | 'jamo-wb';
  source: string;
}

export function packOfContentFile(file: string): string | null;
export function contentOccurrences(files: readonly ContentFile[]): SpokenOccurrence[];
export function registerTsLoader(): Promise<void>;
export function importRepoTs(rel: string): Promise<Record<string, unknown>>;
export function jamoClipVoicesOf(
  stage1Records: readonly unknown[],
  wordBuilderRecords: readonly unknown[],
  jamoVoice: (jamo: never, question: 'letter' | 'sound') => { text: string; audioRef?: string },
): JamoClipVoice[];
export function stage1OccurrencesOf(stage1Quests: readonly unknown[], minigameScopes: Record<string, unknown>): SpokenOccurrence[];
export function cardOccurrencesOf(cards: readonly unknown[]): SpokenOccurrence[];
export function reviewOccurrencesOf(items: readonly unknown[]): SpokenOccurrence[];
export function readClipSources(root?: string): Promise<{ jamo: JamoClipVoice[]; occurrences: SpokenOccurrence[] }>;

// ---- the contrast-set catalogue (AMENDMENTS-MINIMAL-PAIRS section 3.1, 3.4; row MP-1a) ----

export const CONTRAST_SETS_FILE: string;
export const CONTRAST_SET_SERIES: readonly ('k' | 't' | 'p' | 'c' | 's')[];
export const CONTRAST_MEMBER_KINDS: readonly ('plain' | 'aspirated' | 'tense')[];

export interface ContrastMember {
  text: string;
  romanization: string;
  en: string;
  ref: string;
  kind: 'plain' | 'aspirated' | 'tense';
}

export interface ContrastSet {
  id: string;
  series: 'k' | 't' | 'p' | 'c' | 's';
  unit: string;
  members: ContrastMember[];
  approval?: { date: string; plays: number; correct: number; mp3Sha256: Record<string, string> };
  lapsed?: { date: string; reason: string };
}

export interface ContrastCatalogue {
  schemaVersion: 1;
  sets: ContrastSet[];
}

export function contrastUnitInfo(unit: string): { stage: number; quest: string; pack: string } | null;
export function parseContrastSets(json: unknown, file?: string): ContrastCatalogue;
export function readContrastSets(root?: string): ContrastCatalogue;
export function isJamoRef(ref: string): boolean;
export function contrastOccurrencesOf(catalogue: ContrastCatalogue): SpokenOccurrence[];

// ---- the Hangul Check's decode item pool (AMENDMENTS-STAGE1-DECODING-CHECK section 3.4; row DC-2b) ----

export const DECODE_ITEMS_FILE: string;

export interface DecodeOption {
  ko: string;
  romanization: string;
}

export interface DecodeItem {
  /** `decode:<the target's romanization>`. */
  id: string;
  target: string;
  options: DecodeOption[];
}

export interface DecodePool {
  schemaVersion: 1;
  pack: string;
  /** Items whose four clips ship today. */
  items: DecodeItem[];
  /** Items that wait for DC-2c's clips. */
  awaitingClips: DecodeItem[];
}

export function parseDecodeItems(json: unknown, file?: string): DecodePool;
export function readDecodeItems(root?: string): DecodePool;
export function decodeOccurrencesOf(pool: DecodePool, source?: string): SpokenOccurrence[];
