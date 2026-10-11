/**
 * Seeded randomness for the shared question engine (F-PLC-001 section 3.3).
 * No `Math.random`, no clock: the same seed always gives the same sequence.
 * Hermes-safe: plain arithmetic only (`Math.imul` is available there).
 */

/** FNV-1a over the parts, each followed by its length so ['ab','c'] differs from ['a','bc']. Unsigned 32-bit. */
export const hashSeed = (parts: readonly string[]): number => {
  let h = 0x811c9dc5;
  const mix = (code: number): void => {
    h = Math.imul(h ^ code, 0x01000193);
  };
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) mix(part.charCodeAt(i));
    mix(0x1f);
    mix(part.length & 0xff);
    mix(0x1e);
  }
  return h >>> 0;
};

/** mulberry32: a small, fast generator returning floats in [0, 1). */
export const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Fisher-Yates on a copy; the input is never changed. */
export const shuffleSeeded = <T>(items: readonly T[], rng: () => number): T[] => {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
};

/** `n` distinct items (all of them when `n` exceeds the length, none when `n <= 0`). */
export const sampleSeeded = <T>(items: readonly T[], n: number, rng: () => number): T[] =>
  shuffleSeeded(items, rng).slice(0, Math.max(0, Math.trunc(n)));
