/**
 * The WordArt path grammar (F-VOC-002 §3.1): absolute `M L H V C Q A Z` only,
 * numbers with at most one decimal, one argument group per command, starting
 * with `M`. Relative commands and `S`/`T` are refused, so a path can be moved
 * and scaled by plain arithmetic on its numbers.
 */

export type PathCommandName = 'M' | 'L' | 'H' | 'V' | 'C' | 'Q' | 'A' | 'Z';

export interface PathCommand {
  c: PathCommandName;
  a: number[];
}

const ARITY: Readonly<Record<PathCommandName, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, A: 7, Z: 0 };

const TOKEN = /\s*(?:([MLHVCQAZ])|(-?\d+(?:\.\d)?)(?![\d.e]))[\s,]*/y;

/** The commands of `d`, or null when `d` is outside the grammar. */
export function parsePath(d: string): PathCommand[] | null {
  const out: PathCommand[] = [];
  TOKEN.lastIndex = 0;
  let current: PathCommand | null = null;
  while (TOKEN.lastIndex < d.length) {
    const m = TOKEN.exec(d);
    if (!m) return null;
    if (m[1] !== undefined) {
      if (current && current.a.length !== ARITY[current.c]) return null;
      current = { c: m[1] as PathCommandName, a: [] };
      if (out.length === 0 && current.c !== 'M') return null;
      out.push(current);
    } else {
      if (!current || current.a.length === ARITY[current.c]) return null;
      current.a.push(Number(m[2]));
    }
  }
  if (!current || current.a.length !== ARITY[current.c]) return null;
  for (const { c, a } of out) {
    if (c === 'A' && (a[0]! < 0 || a[1]! < 0 || (a[3] !== 0 && a[3] !== 1) || (a[4] !== 0 && a[4] !== 1))) return null;
  }
  return out;
}

export function isWordArtPath(d: string): boolean {
  return parsePath(d) !== null;
}

/** A number as the grammar writes it: one decimal at most, never `-0`. */
export function formatNumber(n: number): string {
  return String(Math.round(n * 10) / 10 + 0);
}
