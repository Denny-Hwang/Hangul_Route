// Types for the content-schema test helpers (vocab gate, story gate); the script is dependency-free JS.
export interface OverlayFinding {
  /** Path relative to the repo root ("content/i18n/es/vocab-food.json"). */
  file: string;
  /** "entries.<id>.<field>", "<id>.<field>" for a strict missing field, or "(root)". */
  path: string;
  /** "<rule>" or "<rule>: <message>". */
  rule: string;
}
export function bannedWordIn(text: string, locale: string): string | null;
export function koCopulaSlip(text: string): string | null;
export function checkOverlayTree(
  tree: Map<string, unknown>,
  options?: { strictLocales?: readonly string[] },
): { violations: OverlayFinding[]; warnings: OverlayFinding[]; missing: Record<string, number> };
