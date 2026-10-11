/**
 * Colour-word pairs that collapse under a colour-vision deficiency (F-VOC-002
 * §3.4, measured on `colors.vocab` with CIEDE2000 under the Machado
 * simulations, threshold 8). Item-id pairs: F-VOC-004's distractor policy
 * never puts both words of a pair into one question as the only difference.
 * `color-science.test.ts` recomputes the list from the tokens and fails when
 * this constant is stale.
 */
export const COLOR_CONFUSION_PAIRS: readonly (readonly [string, string])[] = Object.freeze([
  ['vocab:ppalgansaek', 'vocab:galsaek'], // red / brown, protanopia
  ['vocab:juhwangsaek', 'vocab:choroksaek'], // orange / green, protanopia
  ['vocab:paransaek', 'vocab:borasaek'], // blue / purple, deuteranopia
  ['vocab:bunhongsaek', 'vocab:hoesaek'], // pink / gray, deuteranopia
  ['vocab:ppalgansaek', 'vocab:choroksaek'], // red / green, deuteranopia
  ['vocab:juhwangsaek', 'vocab:bunhongsaek'], // orange / pink, tritanopia
] as const);
