import type { LocalePackChunk } from '../../logic/locale/locale-pack-store';

/**
 * The Spanish locale chunk of the learner PWA (F-CURR-002 §10): the Spanish UI messages and the Spanish
 * content overlays, one precached web bundle (`locale-es-<md5>.js`) reached only through the literal
 * `import()` of `platform/locale-packs.web.ts`. Never import it statically: Metro would then keep it in the
 * start bundle (the post-build check fails the build on the marker below).
 */
export const LOCALE_PACK: LocalePackChunk['LOCALE_PACK'] = 'locale-pack:es';
export { es as LOCALE_MESSAGES } from '@hangul-route/i18n/messages-es';
export { OVERLAYS_ES as LOCALE_CONTENT } from '@hangul-route/content-schema/overlays-es';
