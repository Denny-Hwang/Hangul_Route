/**
 * `@hangul-route/content-schema/blend` (AMENDMENTS-ROUTE-CLASS-BLEND sections 6.2, 6.3 and 9.4, rows BL-1 and BL-8):
 * class cycles, packing and `placePractice`, kept out of the package barrel. At the package root, as `memory.ts` is,
 * so Metro (which reads the path, not `exports`) finds it; the app's practice-days chunk is the reader.
 */
export * from './src/curriculum/blend';
