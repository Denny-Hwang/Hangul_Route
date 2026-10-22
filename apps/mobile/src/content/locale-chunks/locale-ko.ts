import type { LocalePackChunk } from '../../logic/locale/locale-pack-store';

/**
 * The Korean locale chunk of the learner PWA (F-CURR-002 §10): the Korean UI messages and the Korean
 * content overlays, one precached web bundle (`locale-ko-<md5>.js`) reached only through the literal
 * `import()` of `platform/locale-packs.web.ts`. Never import it statically (see `locale-es.ts`).
 */
export const LOCALE_PACK: LocalePackChunk['LOCALE_PACK'] = 'locale-pack:ko';
export { ko as LOCALE_MESSAGES } from '@hangul-route/i18n/messages-ko';
export { OVERLAYS_KO as LOCALE_CONTENT } from '@hangul-route/content-schema/overlays-ko';
