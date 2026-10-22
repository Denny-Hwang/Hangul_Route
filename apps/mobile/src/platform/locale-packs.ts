import type { LocalePackLoader } from '../logic/locale/locale-pack-store';

/**
 * Native (and the tests): the es / ko text is in the one bundle from the start (the packages' eager tables,
 * `@hangul-route/i18n` `bundled-messages.ts` and `@hangul-route/content-schema/overlays`), so there is no
 * locale chunk to load. The web build loads one per locale (`locale-packs.web.ts`, F-CURR-002 §10).
 */
export const loadLocalePack: LocalePackLoader = null;
