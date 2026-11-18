/**
 * The level check's question bank (F-PLC-001 section 3.4; AMENDMENTS-FINISH-2026-11 FN-7): a chunk of its own, reached
 * only through the literal `import()` of `./placement-bank.ts`, so the web build emits it as one precached bundle
 * (`placement-bank-chunk-<md5>.js`) and the start bundle carries none of the bank (about 150 KB). The start bundle
 * reads `placement-meta.generated.ts` instead: the bank's version, its count of ready templates and the warm-up's id.
 * Readers: the level check (`screens/placement/PlacementScreen.tsx`) and its grown-up report. Never import this module
 * statically.
 */

/** The chunk's marker (`LEARNER_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const PLACEMENT_BANK_CHUNK = 'placement-bank-chunk:bank';

export { PLACEMENT_BANK, PLACEMENT_WARMUP } from './placement.generated';
