/**
 * Words whose pictures or meanings overlap although their `ko` and sense groups
 * differ (F-VOC-004 §3.3 rule 1): the builder never shows the two words of a
 * pair in one question, as answer and option or as two options. Never relaxed.
 *
 * - gureum "cloud" against bi "rain" and haneul "sky", and chilpan "board"
 *   against seonsaengnim "teacher" (F-VOC-002 W-5): the rain is a cloud with
 *   drops, the sky draws two clouds, and the teacher stands at a board, so the
 *   other picture is a right answer too.
 * - gong "ball" against each ball sport: the sport glyphs of F-VOC-002 §3.11
 *   are drawn as their ball, so two pictures would read as "ball".
 * - bul "fire" against bit "light": bul also means a light that is on (its
 *   note says so), so the bulb picture of bit is a right answer for bul.
 * - ip "mouth" against i-tooth "tooth" (F-VOC-002 W-4): the mouth glyph is an
 *   open smile with the teeth showing, so it is a right answer for tooth too.
 * - son "hand" against pal "arm", and dari "leg" against bal "foot"
 *   (F-VOC-002 W-4): the ring sits on the same limb of the same figure, about
 *   10 units apart, so at the 48 px option size the two pictures are too close
 *   to tell apart.
 * - Each colour word against the word its swatch draws as a sticker
 *   (F-VOC-002 §3.6.1): the red swatch carries the apple, yellow the banana,
 *   blue the water, sky blue the cloud, brown the bear, gray the elephant,
 *   white the milk and pink the flower, so the swatch is a right answer for
 *   the object word too. Rule 2 compares `visual` keys only and does not see
 *   a glyph inside a swatch. haneul "sky" (two clouds) joins the sky-blue pair.
 */
export const VOCAB_EXCLUDED_PAIRS: readonly (readonly [string, string])[] = Object.freeze([
  ['vocab:gureum', 'vocab:bi-rain'],
  ['vocab:gureum', 'vocab:haneul'],
  ['vocab:chilpan', 'vocab:seonsaengnim'],
  ['vocab:gong-ball', 'vocab:chukgu'],
  ['vocab:gong-ball', 'vocab:yagu'],
  ['vocab:gong-ball', 'vocab:nonggu'],
  ['vocab:gong-ball', 'vocab:baegu'],
  ['vocab:bul', 'vocab:bit'],
  ['vocab:ip', 'vocab:i-tooth'],
  ['vocab:son', 'vocab:pal-arm'],
  ['vocab:dari-leg', 'vocab:bal'],
  ['vocab:ppalgansaek', 'vocab:sagwa-apple'],
  ['vocab:noransaek', 'vocab:banana'],
  ['vocab:paransaek', 'vocab:mul'],
  ['vocab:haneulsaek', 'vocab:gureum'],
  ['vocab:haneulsaek', 'vocab:haneul'],
  ['vocab:galsaek', 'vocab:gom'],
  ['vocab:hoesaek', 'vocab:kokkiri'],
  ['vocab:hayansaek', 'vocab:uyu'],
  ['vocab:bunhongsaek', 'vocab:kkot'],
] as const);

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
const EXCLUDED: ReadonlySet<string> = new Set(VOCAB_EXCLUDED_PAIRS.map(([a, b]) => pairKey(a, b)));

/** Whether two item ids form a pair of `VOCAB_EXCLUDED_PAIRS`, in either order. */
export function excludedPair(a: string, b: string): boolean {
  return EXCLUDED.has(pairKey(a, b));
}
