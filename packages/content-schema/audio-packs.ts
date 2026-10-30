/**
 * `@hangul-route/content-schema/audio-packs` (AMENDMENTS-AUDIO-CLIPS AC-B6): the clip pack list alone, with no zod and
 * no package barrel, so the app's `config/flags.ts` (re-imported cold by every flag test) stays light. At the package
 * root, as `overlays.ts` and `memory.ts` are, so Metro (which reads the path, not `exports`) finds it.
 */
export * from './src/audio/packs';
