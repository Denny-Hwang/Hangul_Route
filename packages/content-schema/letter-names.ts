/**
 * `@hangul-route/content-schema/letter-names` (F-CURR-002 §4.5, row CM-31): Hangul spelled block by block with the
 * letter names, for the spelling round's screen-reader labels, kept out of the package barrel. At the package root,
 * as `review-items.ts` is, so Metro (which reads the path, not `exports`) finds it; the dictation chunk is the reader.
 */
export * from './src/hangul/letter-names';
