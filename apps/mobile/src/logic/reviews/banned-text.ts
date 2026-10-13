/**
 * The learner result surfaces show stars, never a score (F-RVW-001 §3.1): no percent and no
 * `x / y` fraction. A sound value such as `g/k` is letters, so it passes. Pure.
 */
const BANNED: readonly RegExp[] = [/\d+\s*%/u, /\d+\s*\/\s*\d+/u];

/** The first percent or fraction in `text`, or null. */
export function bannedNumberIn(text: string): string | null {
  for (const re of BANNED) {
    const hit = re.exec(text);
    if (hit) return hit[0];
  }
  return null;
}

/**
 * Every string leaf of a message tree, in key order; a function leaf is called with a sample
 * word for each parameter, so its output is scanned too. Other values are skipped.
 */
export function leafStrings(tree: unknown): string[] {
  if (typeof tree === 'string') return [tree];
  if (typeof tree === 'function') {
    const out: unknown = (tree as (...args: string[]) => unknown)(...Array.from({ length: tree.length }, () => 'x'));
    return typeof out === 'string' ? [out] : [];
  }
  if (tree !== null && typeof tree === 'object') return Object.values(tree).flatMap(leafStrings);
  return [];
}
