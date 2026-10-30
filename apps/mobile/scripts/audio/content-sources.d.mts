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
