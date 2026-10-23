/**
 * The mastery chunk (F-CURR-002 sections 4.4 and 10, row CM-20): the ring round each Journey cell and the Results
 * banners, one precached web bundle of its own, reached only through the literal `import()` of
 * `store/mastery-entry.ts` while `mastery` is on. The level derivation itself rides in the memory chunk
 * (`logic/memory/mastery.ts`), so the two share no module. Never import it statically from the start bundle (Metro
 * would then fold it back in). Its marker is `MASTERY_CHUNK`.
 */
export const MASTERY_CHUNK = 'mastery-chunk:ui';
export { MasteryRing } from './MasteryRing';
export { LevelRing, MasteryBanners } from './MasteryBanners';
