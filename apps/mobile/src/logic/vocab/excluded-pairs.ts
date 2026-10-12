/**
 * Words whose pictures or meanings overlap although their `ko` and sense groups
 * differ (F-VOC-004 §3.3 rule 1): the builder never shows the two words of a
 * pair in one question, as answer and option or as two options. Never relaxed.
 *
 * - gong "ball" against each ball sport: the sport glyphs of F-VOC-002 §3.11
 *   are drawn as their ball, so two pictures would read as "ball".
 * - bul "fire" against bit "light": bul also means a light that is on (its
 *   note says so), so the bulb picture of bit is a right answer for bul.
 */
export const VOCAB_EXCLUDED_PAIRS: readonly (readonly [string, string])[] = Object.freeze([
  ['vocab:gong-ball', 'vocab:chukgu'],
  ['vocab:gong-ball', 'vocab:yagu'],
  ['vocab:gong-ball', 'vocab:nonggu'],
  ['vocab:gong-ball', 'vocab:baegu'],
  ['vocab:bul', 'vocab:bit'],
] as const);

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
const EXCLUDED: ReadonlySet<string> = new Set(VOCAB_EXCLUDED_PAIRS.map(([a, b]) => pairKey(a, b)));

/** Whether two item ids form a pair of `VOCAB_EXCLUDED_PAIRS`, in either order. */
export function excludedPair(a: string, b: string): boolean {
  return EXCLUDED.has(pairKey(a, b));
}
