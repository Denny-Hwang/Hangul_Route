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
export function koParticleSlip(text: string): string | null;
export function checkOverlayTree(
  tree: Map<string, unknown>,
  options?: { strictLocales?: readonly string[] },
): { violations: OverlayFinding[]; warnings: OverlayFinding[]; missing: Record<string, number> };
/** Proper names (keyed by the taught Korean) whose English may open with the name itself. */
export const GLOSS_NAME_ALLOWLIST: readonly string[];
/** True when `gloss` opens with the romanization of `ko` and " (", ", " or " — " (rule gloss-repeats-romanization). */
export function glossRepeatsRomanization(input: { ko?: unknown; romanization?: unknown; gloss?: unknown }): boolean;
export function glossRepeatsRule(gloss: string, romanization: string): string;
