// Types for packages/content-schema/src/__tests__/import-real.test.ts (F-STORY-001 PR 1.6); the script itself is dependency-free JS.
import type { Story } from '../packages/content-schema/src/index';

/** One entry of content/episodes/stage-1/jamo.json (the fields the importer reads). */
export interface JamoEntry {
  ko: string;
  romanization: string;
  kind: string;
  [key: string]: unknown;
}

/** The research file a story comes from: its cluster name and its verification record. */
export interface ClusterRecord {
  cluster: string;
  /** `verification` of the `*.final.json` file; absent when the file has none. */
  verification?: { passes: number; checked_at: string; notes?: string } | undefined;
  /** YYYY-MM-DD, the file's modification date (checkedAt when there is no verification record). */
  fileDate: string;
  /** True for a `.revised.json` / `.draft.json` file imported with `--allow-unfinal`. */
  unfinal?: boolean | undefined;
}

export interface MapOptions {
  /**
   * Apply the resolutions of section 3.14 (approximations, the https upgrade, gloss and
   * hyphen clean-up). `false` reproduces the raw mapping the lint findings of section 3.14
   * describe. Default true.
   */
  resolve?: boolean;
}

export interface ImportReportEntry {
  kind: string;
  where: string;
  detail: string;
}
export interface ImportFlag {
  rule: string;
  where: string;
  detail: string;
}
export interface ImportReport {
  id: string;
  counts: { scenes: number; facts: number; sources: number; keywords: number; checks: number };
  /** Hangul terms that matched no vocab or scene Korean: the author adds romanization and a gloss. */
  unresolvedTerms: Array<{ ko: string; id: string; scene: number }>;
  /** Keywords created from jamo.json / as empty terms because narration or a check named them. */
  addedFromNarration: { jamo: number; terms: number };
  /** What the importer changed so a known lint class does not reach the draft. */
  resolved: ImportReportEntry[];
  /** Things the importer could not resolve; each one is also a lint finding or an author task. */
  flags: ImportFlag[];
  /** Fields filled with a default the author should look at. */
  defaulted: string[];
  taleScope: Array<{ factId: string; scope: 'in-the-tale' }>;
  advisoryScenes: number[];
  todo: {
    captionEn: number;
    explainEn: number;
    art: number;
    titleRomanization: number;
    termGlosses: number;
  };
}

export function mapEpisode(
  raw: unknown,
  cluster: ClusterRecord,
  jamo: readonly JamoEntry[],
  options?: MapOptions,
): { story: Story; report: ImportReport };

export function scanAdvisories(scenes: ReadonlyArray<{ n: number; narration_en: string }>): {
  advisory: Array<'war' | 'loss'>;
  scenes: number[];
  noteEn: string | undefined;
};

export function slugify(text: string): string;
export function main(argv: string[], root: string): number;
