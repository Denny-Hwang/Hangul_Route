/**
 * `@hangul-route/design-system/word-art`: the pure WordArt entry (F-VOC-002
 * §3.9). Hand-authored word pictures as plain data: shapes on a 0 0 100 100
 * viewBox, every colour a design-token path, no React and no react-native
 * import, so logic and tests in other packages can read the glyphs without
 * pulling react-native-svg (`entry.test.ts` holds that rule).
 *
 * PR W-1a opens the entry. PR W-1b adds the data model, builders, tone
 * resolver, render list, registry and colour-confusion pairs here; the React
 * Native renderer (W-1c) lives in `components/WordArt/`, outside this entry.
 */
export {};
