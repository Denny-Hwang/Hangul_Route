/**
 * The colour-word pairs that collapse under a colour-vision deficiency
 * (F-VOC-002 §3.4), as item-id pairs for the distractor policy (F-VOC-004
 * §3.3 rule 3).
 *
 * The source of truth is `COLOR_CONFUSION_PAIRS` in
 * `@hangul-route/design-system/word-art`, which `color-science.test.ts`
 * recomputes from the colour tokens. It is restated here because the app's
 * bundler (Metro, Expo SDK 52) does not read package `exports`, so a runtime
 * import of that subpath would not resolve in the app; the design-system root
 * barrel would pull react-native into this pure module. The test
 * `color-confusion.test.ts` fails when the two lists differ.
 */
export const COLOR_CONFUSION_PAIRS: readonly (readonly [string, string])[] = Object.freeze([
  ['vocab:ppalgansaek', 'vocab:galsaek'], // red / brown, protanopia
  ['vocab:juhwangsaek', 'vocab:choroksaek'], // orange / green, protanopia
  ['vocab:paransaek', 'vocab:borasaek'], // blue / purple, deuteranopia
  ['vocab:bunhongsaek', 'vocab:hoesaek'], // pink / gray, deuteranopia
  ['vocab:ppalgansaek', 'vocab:choroksaek'], // red / green, deuteranopia
  ['vocab:juhwangsaek', 'vocab:bunhongsaek'], // orange / pink, tritanopia
] as const);
