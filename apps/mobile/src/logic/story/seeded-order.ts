/**
 * Deterministic ordering for story games (F-STORY-003 §3.3). The same seed
 * always gives the same order, so a re-opened game shows the same layout.
 * Everything here is pure and returns a new array.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a, 32-bit, over UTF-16 code units. Returns an unsigned integer. */
export function hashSeed(str: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

/** Small seeded PRNG: returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle. */
export function shuffleSeeded<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Sattolo's algorithm: a single n-cycle, so no item keeps its index when
 * n >= 2. Lists shorter than 2 come back unchanged (as a copy).
 */
export function derangeSeeded<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** True when both lists hold the same items in the same order. */
export function isSameOrder<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
