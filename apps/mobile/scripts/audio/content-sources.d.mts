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
