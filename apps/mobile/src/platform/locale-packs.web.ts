import type { LocalePackLoader } from '../logic/locale/locale-pack-store';

/**
 * The learner PWA's locale chunks (F-CURR-002 §10): the start bundle carries English only, and each other
 * UI locale's messages and content overlays are one precached web bundle, loaded through these literal
 * `import()`s (Metro emits each as `locale-<locale>-<md5>.js`; the service worker answers it from its
 * precache, offline too). `content/locale-packs.ts` binds it to the store.
 */
export const loadLocalePack: LocalePackLoader = (locale) =>
  locale === 'es' ? import('../content/locale-chunks/locale-es') : import('../content/locale-chunks/locale-ko');
