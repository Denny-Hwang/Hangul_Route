/**
 * `@hangul-route/design-system/word-art`: the pure WordArt entry (F-VOC-002
 * §3.9). Hand-authored word pictures as plain data: shapes on a 0 0 100 100
 * viewBox, every colour a design-token path, no React and no react-native
 * import, so logic and tests in other packages can read the glyphs without
 * pulling react-native-svg (`entry.test.ts` holds that rule).
 *
 * The React Native renderer (W-1c) lives in `components/WordArt/`, outside
 * this entry. The colour-vision helpers (`color-science.ts`) are test-only and
 * are not exported here.
 */
export type { ExcludedTone, WordArtFamily, WordArtGlyph, WordArtMeta, WordArtPaint, WordArtShape, WordArtStatus, WordArtTone } from './types';
export { isWordArtPath, parsePath, formatNumber } from './path';
export type { PathCommand, PathCommandName } from './path';
export { arc, blob, circle, curve, drop, ellipse, face, groundShadow, leaf, line, path, poly, r1, rect, star } from './builders';
export type { FaceOptions, Pt } from './builders';
export { WORD_ART_TONES, isWordArtTone, resolveTone } from './tones';
export { glyphToSvgString, toRenderList } from './render';
export type { RenderOptions, RenderShape } from './render';
export { WORD_ART, WORD_ART_FAMILIES, WORD_ART_KEYS, WORD_ART_KEY_RE, WORD_ART_PLAN, buildRegistry, getWordArt, wordArtKeyOf } from './registry';
export type { WordArtEntry, WordArtMetaOverrides, WordArtSource } from './registry';
export { COLOR_CONFUSION_PAIRS } from './color-confusion';
