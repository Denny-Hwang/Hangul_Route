/**
 * The realia kinds chunk (F-CURR-002 row CM-47): the eight added realia layouts, their looks and their dressings, one
 * precached web bundle of its own, reached only through the literal `import()` of `./realia-kinds-entry.tsx` (the
 * learner's sheet and the presenter's stage sheet both ask for it there). Never import it, or the modules it
 * re-exports, statically from anywhere else: Metro would fold them back into the start bundle. Its marker is
 * `REALIA_KINDS_CHUNK`.
 */
export const REALIA_KINDS_CHUNK = 'screen-chunk:realia-kinds';

export { RealiaKindSheet } from '@hangul-route/design-system/src/components/RealiaSheet/RealiaKindSheet';
export { REALIA_KIND_LOOKS, REALIA_TILE, realiaRowRule } from '@hangul-route/design-system/src/components/RealiaSheet/kinds-style';
export { REALIA_KIND_REGISTRY } from '@hangul-route/design-system/src/scene-art/realia-kinds-registry';
